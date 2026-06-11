const Vehicle = require('../modules/vehicles/vehicle.model');
const User = require('../modules/users/user.model');
const { normalizeLicensePlate } = require('../modules/vehicles/vehicle.service');
const {
    VEHICLE_TYPES,
    ENGINE_TYPES,
    MOTORBIKE_CC_GROUPS,
    CAR_BODY_TYPES,
} = require('../shared/constants/vehicle.constant');
const { normalizePhone } = require('../shared/utils/phone');

const seedVehicles = [
    {
        customer_phone: '0901000001',
        raw_license_plate: '51G-123.45',
        vehicle_type: VEHICLE_TYPES.MOTORBIKE,
        engine_type: ENGINE_TYPES.GASOLINE,
        motorbike_cc_group: MOTORBIKE_CC_GROUPS.UNDER_175CC,
        brand: 'Honda',
        model: 'Air Blade',
        color: 'Black',
        is_default: true,
    },
    {
        customer_phone: '0901000002',
        raw_license_plate: '59A-222.22',
        vehicle_type: VEHICLE_TYPES.CAR,
        engine_type: ENGINE_TYPES.GASOLINE,
        car_body_type: CAR_BODY_TYPES.SEDAN,
        seat_count: 5,
        brand: 'Toyota',
        model: 'Vios',
        color: 'White',
        is_default: true,
    },
    {
        customer_phone: '0901000003',
        raw_license_plate: '30F-333.33',
        vehicle_type: VEHICLE_TYPES.CAR,
        engine_type: ENGINE_TYPES.ELECTRIC,
        car_body_type: CAR_BODY_TYPES.SUV,
        seat_count: 5,
        brand: 'VinFast',
        model: 'VF e34',
        color: 'Blue',
        is_default: true,
    },
    {
        customer_phone: '0901000004',
        raw_license_plate: '60B-444.44',
        vehicle_type: VEHICLE_TYPES.MOTORBIKE,
        engine_type: ENGINE_TYPES.ELECTRIC,
        motorbike_cc_group: MOTORBIKE_CC_GROUPS.UNDER_175CC,
        brand: 'VinFast',
        model: 'Klara',
        color: 'Red',
        is_default: true,
    },
    {
        customer_phone: '0901000005',
        raw_license_plate: '51H-555.55',
        vehicle_type: VEHICLE_TYPES.CAR,
        engine_type: ENGINE_TYPES.GASOLINE,
        car_body_type: CAR_BODY_TYPES.MPV,
        seat_count: 7,
        brand: 'Mitsubishi',
        model: 'Xpander',
        color: 'Silver',
        is_default: true,
    },
];

const seedVehicle = async () => {
    console.log('== Seeding vehicles ==');

    for (const item of seedVehicles) {
        const customer = await User.findOne({
            phone: normalizePhone(item.customer_phone),
        }).select('_id phone');

        if (!customer) {
            console.log(`Skipped vehicle because customer was not found: ${item.customer_phone}`);
            continue;
        }

        const normalized_license_plate = normalizeLicensePlate(item.raw_license_plate);
        const payload = {
            customer_id: customer._id,
            raw_license_plate: item.raw_license_plate,
            normalized_license_plate,
            vehicle_type: item.vehicle_type,
            engine_type: item.engine_type,
            motorbike_cc_group: item.motorbike_cc_group || null,
            car_body_type: item.car_body_type || null,
            seat_count: item.seat_count || null,
            brand: item.brand || '',
            model: item.model || '',
            color: item.color || '',
            is_default: item.is_default,
            is_active: true,
        };

        if (payload.is_default) {
            await Vehicle.updateMany(
                { customer_id: customer._id, is_default: true },
                { $set: { is_default: false } }
            );
        }

        const existedVehicle = await Vehicle.findOne({
            normalized_license_plate,
            vehicle_type: item.vehicle_type,
        }).select('_id');

        if (existedVehicle) {
            await Vehicle.updateOne(
                { _id: existedVehicle._id },
                { $set: payload },
                { runValidators: true }
            );

            console.log(`Updated vehicle: ${normalized_license_plate}`);
            continue;
        }

        await Vehicle.create(payload);

        console.log(`Created vehicle: ${normalized_license_plate}`);
    }

    console.log('Vehicles seeding completed');
};

module.exports = seedVehicle;
