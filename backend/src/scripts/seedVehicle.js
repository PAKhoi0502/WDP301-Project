const Vehicle = require('../modules/vehicles/vehicle.model');
const User = require('../modules/users/user.model');
const { normalizeLicensePlate } = require('../modules/vehicles/vehicle.service');
const { USER_ROLES } = require('../shared/constants/roles.constant');
const { VEHICLE_TYPES } = require('../shared/constants/vehicle.constant');
const { normalizePhone } = require('../shared/utils/phone');
const {
    buildVehicleDefinitions,
} = require('./seedWashBaysVehiclesCatalog');
const { getSeedReferenceDate } = require('./seedTime');

const assertUniqueVehicleDefinitions = (definitions) => {
    const normalizedPlates = new Set();
    const defaultCountByCustomer = new Map();

    for (const definition of definitions) {
        const normalizedPlate = normalizeLicensePlate(
            definition.raw_license_plate
        );

        if (normalizedPlate !== definition.normalized_license_plate) {
            throw new Error(
                `Vehicle plate normalization mismatch: ${definition.raw_license_plate}`
            );
        }

        if (normalizedPlates.has(normalizedPlate)) {
            throw new Error(`Duplicate vehicle plate: ${normalizedPlate}`);
        }

        normalizedPlates.add(normalizedPlate);

        if (definition.is_default) {
            const customerPhone = normalizePhone(definition.customer_phone);

            defaultCountByCustomer.set(
                customerPhone,
                (defaultCountByCustomer.get(customerPhone) || 0) + 1
            );
        }

        if (
            definition.vehicle_type === VEHICLE_TYPES.CAR
            && (
                definition.motorbike_cc_group !== null
                || !definition.car_body_type
                || !definition.seat_count
            )
        ) {
            throw new Error(`Invalid car seed fields: ${normalizedPlate}`);
        }

        if (
            definition.vehicle_type === VEHICLE_TYPES.MOTORBIKE
            && (
                !definition.motorbike_cc_group
                || definition.car_body_type !== null
                || definition.seat_count !== null
            )
        ) {
            throw new Error(`Invalid motorbike seed fields: ${normalizedPlate}`);
        }
    }

    const customerPhones = new Set(
        definitions.map((definition) => normalizePhone(definition.customer_phone))
    );

    for (const customerPhone of customerPhones) {
        if (defaultCountByCustomer.get(customerPhone) !== 1) {
            throw new Error(
                `Customer must have exactly one default vehicle: ${customerPhone}`
            );
        }
    }
};

const summarizeVehicles = (definitions) => {
    const vehicleTypes = {};
    const engineTypes = {};
    const byGarage = {};

    for (const definition of definitions) {
        vehicleTypes[definition.vehicle_type] = (
            vehicleTypes[definition.vehicle_type] || 0
        ) + 1;
        engineTypes[definition.engine_type] = (
            engineTypes[definition.engine_type] || 0
        ) + 1;

        const garage = byGarage[definition.preferred_garage_code] || {
            total: 0,
            vehicle_types: {},
        };

        garage.total += 1;
        garage.vehicle_types[definition.vehicle_type] = (
            garage.vehicle_types[definition.vehicle_type] || 0
        ) + 1;
        byGarage[definition.preferred_garage_code] = garage;
    }

    return {
        planned: definitions.length,
        customers: new Set(
            definitions.map(
                (definition) => normalizePhone(definition.customer_phone)
            )
        ).size,
        vehicle_types: vehicleTypes,
        engine_types: engineTypes,
        by_preferred_garage: byGarage,
    };
};

const seedVehicle = async ({
    session = null,
    referenceDate = getSeedReferenceDate(),
    dryRun = false,
} = {}) => {
    console.log('== Seeding vehicles ==');

    const definitions = buildVehicleDefinitions(referenceDate);

    assertUniqueVehicleDefinitions(definitions);

    const summary = summarizeVehicles(definitions);

    if (dryRun) {
        console.table(
            Object.entries(summary.by_preferred_garage)
                .map(([garageCode, garage]) => ({
                    preferred_garage_code: garageCode,
                    total: garage.total,
                    ...garage.vehicle_types,
                }))
        );

        return {
            ...summary,
            dry_run: true,
        };
    }

    const customerPhones = [...new Set(
        definitions.map(
            (definition) => normalizePhone(definition.customer_phone)
        )
    )];
    const customerQuery = User.find({
        phone: { $in: customerPhones },
    }).select('_id phone role created_at');

    if (session) {
        customerQuery.session(session);
    }

    const customers = await customerQuery.lean();

    if (customers.length !== customerPhones.length) {
        throw new Error(
            `Vehicle customer verification failed: expected ${customerPhones.length}, found ${customers.length}`
        );
    }

    const customerByPhone = new Map(
        customers.map((customer) => [customer.phone, customer])
    );
    const records = definitions.map((definition) => {
        const customerPhone = normalizePhone(definition.customer_phone);
        const customer = customerByPhone.get(customerPhone);

        if (!customer || customer.role !== USER_ROLES.CUSTOMER) {
            throw new Error(`Vehicle customer is invalid: ${customerPhone}`);
        }

        if (definition.created_at < customer.created_at) {
            throw new Error(
                `Vehicle was created before customer registration: ${definition.normalized_license_plate}`
            );
        }

        const payload = {
            customer_id: customer._id,
            raw_license_plate: definition.raw_license_plate,
            normalized_license_plate: definition.normalized_license_plate,
            vehicle_type: definition.vehicle_type,
            engine_type: definition.engine_type,
            motorbike_cc_group: definition.motorbike_cc_group,
            car_body_type: definition.car_body_type,
            seat_count: definition.seat_count,
            brand: definition.brand,
            model: definition.model,
            color: definition.color,
            is_default: definition.is_default,
            is_active: definition.is_active,
            created_at: definition.created_at,
            updated_at: definition.created_at,
        };
        const validationError = new Vehicle(payload).validateSync();

        if (validationError) {
            throw validationError;
        }

        return payload;
    });
    const existingQuery = Vehicle.find({
        normalized_license_plate: {
            $in: records.map((record) => record.normalized_license_plate),
        },
    }).select(
        'customer_id normalized_license_plate vehicle_type'
    );

    if (session) {
        existingQuery.session(session);
    }

    const existingVehicles = await existingQuery.lean();
    const expectedByPlate = new Map(
        records.map((record) => [record.normalized_license_plate, record])
    );

    for (const vehicle of existingVehicles) {
        const expected = expectedByPlate.get(vehicle.normalized_license_plate);

        if (
            !expected
            || String(vehicle.customer_id) !== String(expected.customer_id)
            || vehicle.vehicle_type !== expected.vehicle_type
        ) {
            throw new Error(
                `Vehicle seed ownership conflict: ${vehicle.normalized_license_plate}`
            );
        }
    }

    const operations = records.map((record) => ({
        updateOne: {
            filter: {
                normalized_license_plate: record.normalized_license_plate,
                vehicle_type: record.vehicle_type,
            },
            update: {
                $set: record,
            },
            upsert: true,
            timestamps: false,
        },
    }));
    const result = await Vehicle.bulkWrite(operations, {
        ordered: true,
        session,
    });
    const completedSummary = {
        ...summary,
        dry_run: false,
        matched: result.matchedCount,
        modified: result.modifiedCount,
        inserted: result.upsertedCount,
    };

    console.table([{
        planned: completedSummary.planned,
        matched: completedSummary.matched,
        modified: completedSummary.modified,
        inserted: completedSummary.inserted,
    }]);
    console.log('Vehicles seeding completed');

    return completedSummary;
};

module.exports = seedVehicle;
module.exports.assertUniqueVehicleDefinitions = assertUniqueVehicleDefinitions;
module.exports.summarizeVehicles = summarizeVehicles;
