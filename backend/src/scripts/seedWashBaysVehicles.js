require('dotenv').config();

const User = require('../modules/users/user.model');
const Garage = require('../modules/garages/garage.model');
const WashBay = require('../modules/wash-bays/washBay.model');
const Vehicle = require('../modules/vehicles/vehicle.model');
const { connectDB, disconnectDB } = require('../config/db');
const { USER_ROLES } = require('../shared/constants/roles.constant');
const { normalizePhone } = require('../shared/utils/phone');
const seedWashBay = require('./seedWashBay');
const seedVehicle = require('./seedVehicle');
const {
    buildWashBayDefinitions,
    buildVehicleDefinitions,
} = require('./seedWashBaysVehiclesCatalog');
const { getSeedReferenceDate } = require('./seedTime');

const verifyWashBaysVehicles = async ({ referenceDate } = {}) => {
    const washBayDefinitions = buildWashBayDefinitions(referenceDate);
    const vehicleDefinitions = buildVehicleDefinitions(referenceDate);
    const garageCodes = [...new Set(
        washBayDefinitions.map((definition) => definition.garage_code)
    )];
    const customerPhones = [...new Set(
        vehicleDefinitions.map(
            (definition) => normalizePhone(definition.customer_phone)
        )
    )];
    const [garages, customers] = await Promise.all([
        Garage.find({
            garage_code: { $in: garageCodes },
        }).select('_id garage_code').lean(),
        User.find({
            phone: { $in: customerPhones },
            role: USER_ROLES.CUSTOMER,
        }).select('_id phone created_at').lean(),
    ]);

    if (garages.length !== garageCodes.length) {
        throw new Error(
            `Wash bay garage verification failed: expected ${garageCodes.length}, found ${garages.length}`
        );
    }

    if (customers.length !== customerPhones.length) {
        throw new Error(
            `Vehicle customer verification failed: expected ${customerPhones.length}, found ${customers.length}`
        );
    }

    const garageByCode = new Map(
        garages.map((garage) => [garage.garage_code, garage])
    );
    const customerByPhone = new Map(
        customers.map((customer) => [customer.phone, customer])
    );
    const washBays = await WashBay.find({
        $or: washBayDefinitions.map((definition) => ({
            garage_id: garageByCode.get(definition.garage_code)?._id,
            bay_code: definition.bay_code,
        })),
    }).select(
        'garage_id name bay_code vehicle_type status current_booking_id is_active'
    ).lean();
    const vehicles = await Vehicle.find({
        normalized_license_plate: {
            $in: vehicleDefinitions.map(
                (definition) => definition.normalized_license_plate
            ),
        },
    }).lean();

    if (washBays.length !== washBayDefinitions.length) {
        throw new Error(
            `Wash bay verification failed: expected ${washBayDefinitions.length}, found ${washBays.length}`
        );
    }

    if (vehicles.length !== vehicleDefinitions.length) {
        throw new Error(
            `Vehicle verification failed: expected ${vehicleDefinitions.length}, found ${vehicles.length}`
        );
    }

    const washBayByKey = new Map(
        washBays.map((washBay) => [
            `${washBay.garage_id}:${washBay.bay_code}`,
            washBay,
        ])
    );
    const washBaysByGarage = {};

    for (const definition of washBayDefinitions) {
        const garage = garageByCode.get(definition.garage_code);
        const washBay = washBayByKey.get(
            `${garage?._id}:${definition.bay_code}`
        );

        if (
            !washBay
            || washBay.name !== definition.name
            || washBay.vehicle_type !== definition.vehicle_type
        ) {
            throw new Error(
                `Invalid wash bay mapping: ${definition.garage_code}:${definition.bay_code}`
            );
        }

        const garageSummary = washBaysByGarage[definition.garage_code] || {
            total: 0,
            bookable: 0,
            vehicle_types: {},
        };

        garageSummary.total += 1;
        garageSummary.bookable += (
            washBay.is_active
            && !['INACTIVE', 'MAINTENANCE'].includes(washBay.status)
        ) ? 1 : 0;
        garageSummary.vehicle_types[washBay.vehicle_type] = (
            garageSummary.vehicle_types[washBay.vehicle_type] || 0
        ) + 1;
        washBaysByGarage[definition.garage_code] = garageSummary;
    }

    const vehicleByPlate = new Map(
        vehicles.map((vehicle) => [
            vehicle.normalized_license_plate,
            vehicle,
        ])
    );
    const ownershipByCustomer = new Map();
    const vehicleTypes = {};
    const engineTypes = {};
    const byPreferredGarage = {};

    for (const definition of vehicleDefinitions) {
        const vehicle = vehicleByPlate.get(definition.normalized_license_plate);
        const customerPhone = normalizePhone(definition.customer_phone);
        const customer = customerByPhone.get(customerPhone);

        if (
            !vehicle
            || !customer
            || String(vehicle.customer_id) !== String(customer._id)
            || vehicle.vehicle_type !== definition.vehicle_type
            || vehicle.engine_type !== definition.engine_type
            || vehicle.raw_license_plate !== definition.raw_license_plate
            || vehicle.motorbike_cc_group !== definition.motorbike_cc_group
            || vehicle.car_body_type !== definition.car_body_type
            || vehicle.seat_count !== definition.seat_count
        ) {
            throw new Error(
                `Invalid vehicle mapping: ${definition.normalized_license_plate}`
            );
        }

        if (
            vehicle.created_at < customer.created_at
            || vehicle.created_at >= referenceDate
        ) {
            throw new Error(
                `Invalid vehicle timestamp: ${definition.normalized_license_plate}`
            );
        }

        const ownership = ownershipByCustomer.get(customerPhone) || {
            total: 0,
            active_defaults: 0,
        };

        ownership.total += 1;
        ownership.active_defaults += (
            vehicle.is_active && vehicle.is_default
        ) ? 1 : 0;
        ownershipByCustomer.set(customerPhone, ownership);
        vehicleTypes[vehicle.vehicle_type] = (
            vehicleTypes[vehicle.vehicle_type] || 0
        ) + 1;
        engineTypes[vehicle.engine_type] = (
            engineTypes[vehicle.engine_type] || 0
        ) + 1;

        const garageSummary = byPreferredGarage[
            definition.preferred_garage_code
        ] || {
            total: 0,
            vehicle_types: {},
        };

        garageSummary.total += 1;
        garageSummary.vehicle_types[vehicle.vehicle_type] = (
            garageSummary.vehicle_types[vehicle.vehicle_type] || 0
        ) + 1;
        byPreferredGarage[
            definition.preferred_garage_code
        ] = garageSummary;
    }

    for (const [customerPhone, ownership] of ownershipByCustomer.entries()) {
        if (
            ![1, 2].includes(ownership.total)
            || ownership.active_defaults !== 1
        ) {
            throw new Error(
                `Invalid vehicle ownership distribution: ${customerPhone}`
            );
        }
    }

    return {
        wash_bays: {
            total: washBays.length,
            bookable: washBays.filter((washBay) => (
                washBay.is_active
                && !['INACTIVE', 'MAINTENANCE'].includes(washBay.status)
            )).length,
            by_garage: washBaysByGarage,
        },
        vehicles: {
            total: vehicles.length,
            customers: ownershipByCustomer.size,
            single_vehicle_customers: [...ownershipByCustomer.values()]
                .filter((ownership) => ownership.total === 1).length,
            two_vehicle_customers: [...ownershipByCustomer.values()]
                .filter((ownership) => ownership.total === 2).length,
            vehicle_types: vehicleTypes,
            engine_types: engineTypes,
            unique_normalized_plates: new Set(
                vehicles.map((vehicle) => vehicle.normalized_license_plate)
            ).size,
            by_preferred_garage: byPreferredGarage,
        },
    };
};

const seedWashBaysVehicles = async ({
    dryRun = process.argv.includes('--dry-run'),
} = {}) => {
    const referenceDate = getSeedReferenceDate();

    if (dryRun) {
        return {
            dry_run: true,
            reference_date: referenceDate,
            wash_bays: await seedWashBay({
                referenceDate,
                dryRun: true,
            }),
            vehicles: await seedVehicle({
                referenceDate,
                dryRun: true,
            }),
        };
    }

    await connectDB();

    const session = await User.startSession();
    const result = {
        dry_run: false,
        reference_date: referenceDate,
    };

    try {
        await session.withTransaction(async () => {
            result.wash_bays = await seedWashBay({
                session,
                referenceDate,
            });
            result.vehicles = await seedVehicle({
                session,
                referenceDate,
            });
        });

        result.verification = await verifyWashBaysVehicles({
            referenceDate,
        });

        return result;
    } finally {
        await session.endSession();
        await disconnectDB();
    }
};

const run = async () => {
    try {
        const result = await seedWashBaysVehicles();

        console.log('Wash bays and vehicles seed completed');
        console.dir(result.verification || result, { depth: null });
    } catch (error) {
        console.error('Wash bays and vehicles seed failed:', error);
        process.exitCode = 1;

        await disconnectDB().catch(() => {});
    }
};

if (require.main === module) {
    run();
}

module.exports = {
    seedWashBaysVehicles,
    verifyWashBaysVehicles,
};
