const {
    VEHICLE_TYPES,
    ENGINE_TYPES,
    MOTORBIKE_CC_GROUPS,
    CAR_BODY_TYPES,
} = require('../shared/constants/vehicle.constant');
const { WASH_BAY_STATUS } = require('../shared/constants/washBay.constant');
const {
    GARAGE_SEEDS,
    buildCustomerSeedUsers,
} = require('./seedCatalog');
const { atLocalDayAndMinute, getSeedReferenceDate } = require('./seedTime');

const WASH_BAY_LAYOUTS = Object.freeze([
    Object.freeze({ garage_code: 'GAR001', car_count: 2, motorbike_count: 2 }),
    Object.freeze({ garage_code: 'GAR002', car_count: 0, motorbike_count: 3 }),
    Object.freeze({ garage_code: 'GAR003', car_count: 2, motorbike_count: 2 }),
    Object.freeze({ garage_code: 'GAR004', car_count: 2, motorbike_count: 2 }),
    Object.freeze({ garage_code: 'GAR005', car_count: 3, motorbike_count: 0 }),
]);

const VEHICLE_GROUP_TARGETS = Object.freeze({
    GAR001: Object.freeze({ car_count: 14, motorbike_count: 16 }),
    GAR002: Object.freeze({ car_count: 0, motorbike_count: 30 }),
    GAR003: Object.freeze({ car_count: 14, motorbike_count: 16 }),
    GAR004: Object.freeze({ car_count: 16, motorbike_count: 14 }),
    GAR005: Object.freeze({ car_count: 30, motorbike_count: 0 }),
});

const CAR_VARIANTS = Object.freeze([
    Object.freeze({
        brand: 'VinFast',
        model: 'VF 5',
        engine_type: ENGINE_TYPES.ELECTRIC,
        car_body_type: CAR_BODY_TYPES.HATCHBACK,
        seat_count: 5,
    }),
    Object.freeze({
        brand: 'Toyota',
        model: 'Vios',
        engine_type: ENGINE_TYPES.GASOLINE,
        car_body_type: CAR_BODY_TYPES.SEDAN,
        seat_count: 5,
    }),
    Object.freeze({
        brand: 'Hyundai',
        model: 'Accent',
        engine_type: ENGINE_TYPES.GASOLINE,
        car_body_type: CAR_BODY_TYPES.SEDAN,
        seat_count: 5,
    }),
    Object.freeze({
        brand: 'Mitsubishi',
        model: 'Xpander',
        engine_type: ENGINE_TYPES.GASOLINE,
        car_body_type: CAR_BODY_TYPES.MPV,
        seat_count: 7,
    }),
    Object.freeze({
        brand: 'Mazda',
        model: 'CX-5',
        engine_type: ENGINE_TYPES.GASOLINE,
        car_body_type: CAR_BODY_TYPES.SUV,
        seat_count: 5,
    }),
    Object.freeze({
        brand: 'VinFast',
        model: 'VF 8',
        engine_type: ENGINE_TYPES.ELECTRIC,
        car_body_type: CAR_BODY_TYPES.SUV,
        seat_count: 5,
    }),
    Object.freeze({
        brand: 'Honda',
        model: 'City',
        engine_type: ENGINE_TYPES.GASOLINE,
        car_body_type: CAR_BODY_TYPES.SEDAN,
        seat_count: 5,
    }),
    Object.freeze({
        brand: 'Kia',
        model: 'Carnival',
        engine_type: ENGINE_TYPES.GASOLINE,
        car_body_type: CAR_BODY_TYPES.MPV,
        seat_count: 8,
    }),
    Object.freeze({
        brand: 'Ford',
        model: 'Ranger',
        engine_type: ENGINE_TYPES.GASOLINE,
        car_body_type: CAR_BODY_TYPES.PICKUP,
        seat_count: 5,
    }),
    Object.freeze({
        brand: 'Ford',
        model: 'Transit',
        engine_type: ENGINE_TYPES.GASOLINE,
        car_body_type: CAR_BODY_TYPES.VAN,
        seat_count: 16,
    }),
]);

const MOTORBIKE_VARIANTS = Object.freeze([
    Object.freeze({
        brand: 'VinFast',
        model: 'Evo200',
        engine_type: ENGINE_TYPES.ELECTRIC,
        motorbike_cc_group: MOTORBIKE_CC_GROUPS.UNDER_175CC,
    }),
    Object.freeze({
        brand: 'Honda',
        model: 'Vision',
        engine_type: ENGINE_TYPES.GASOLINE,
        motorbike_cc_group: MOTORBIKE_CC_GROUPS.UNDER_175CC,
    }),
    Object.freeze({
        brand: 'Honda',
        model: 'Air Blade',
        engine_type: ENGINE_TYPES.GASOLINE,
        motorbike_cc_group: MOTORBIKE_CC_GROUPS.UNDER_175CC,
    }),
    Object.freeze({
        brand: 'Yamaha',
        model: 'Janus',
        engine_type: ENGINE_TYPES.GASOLINE,
        motorbike_cc_group: MOTORBIKE_CC_GROUPS.UNDER_175CC,
    }),
    Object.freeze({
        brand: 'Yamaha',
        model: 'Exciter',
        engine_type: ENGINE_TYPES.GASOLINE,
        motorbike_cc_group: MOTORBIKE_CC_GROUPS.UNDER_175CC,
    }),
    Object.freeze({
        brand: 'Piaggio',
        model: 'Liberty',
        engine_type: ENGINE_TYPES.GASOLINE,
        motorbike_cc_group: MOTORBIKE_CC_GROUPS.UNDER_175CC,
    }),
    Object.freeze({
        brand: 'Suzuki',
        model: 'Raider',
        engine_type: ENGINE_TYPES.GASOLINE,
        motorbike_cc_group: MOTORBIKE_CC_GROUPS.UNDER_175CC,
    }),
    Object.freeze({
        brand: 'Honda',
        model: 'CB350 Hness',
        engine_type: ENGINE_TYPES.GASOLINE,
        motorbike_cc_group: MOTORBIKE_CC_GROUPS.OVER_175CC,
    }),
]);

const VEHICLE_COLORS = Object.freeze([
    'Trắng',
    'Đen',
    'Bạc',
    'Xám',
    'Đỏ',
    'Xanh dương',
    'Xanh lá',
]);

const CAR_HCM_SERIES = Object.freeze([
    '51A',
    '51G',
    '51H',
    '51K',
    '50E',
    '59A',
    '51L',
    '50F',
]);
const CAR_NEARBY_SERIES = Object.freeze(['60A', '61K', '72A']);
const MOTORBIKE_HCM_SERIES = Object.freeze([
    '59-X1',
    '59-V1',
    '59-S1',
    '59-P1',
    '59-T1',
    '59-C1',
    '59-B1',
    '59-D1',
]);
const MOTORBIKE_NEARBY_SERIES = Object.freeze([
    '60-B1',
    '61-B1',
    '72-C1',
]);

const buildWashBayDefinitions = (
    referenceDate = getSeedReferenceDate()
) => WASH_BAY_LAYOUTS.flatMap((layout, garageIndex) => {
    const definitions = [];

    for (let index = 1; index <= layout.car_count; index += 1) {
        const sequence = String(index).padStart(2, '0');

        definitions.push({
            garage_code: layout.garage_code,
            name: `Buồng rửa ô tô ${sequence}`,
            bay_code: `CAR-${sequence}`,
            vehicle_type: VEHICLE_TYPES.CAR,
            status: WASH_BAY_STATUS.AVAILABLE,
            is_active: true,
            current_booking_id: null,
            created_at: atLocalDayAndMinute({
                referenceDate,
                dayOffset: -120 + garageIndex * 7 + index,
                minuteOfDay: 8 * 60 + 15 + index * 23,
            }),
        });
    }

    for (let index = 1; index <= layout.motorbike_count; index += 1) {
        const sequence = String(index).padStart(2, '0');

        definitions.push({
            garage_code: layout.garage_code,
            name: `Buồng rửa xe máy ${sequence}`,
            bay_code: `MB-${sequence}`,
            vehicle_type: VEHICLE_TYPES.MOTORBIKE,
            status: WASH_BAY_STATUS.AVAILABLE,
            is_active: true,
            current_booking_id: null,
            created_at: atLocalDayAndMinute({
                referenceDate,
                dayOffset: -118 + garageIndex * 7 + index,
                minuteOfDay: 9 * 60 + 10 + index * 19,
            }),
        });
    }

    return definitions;
});

const buildVehicleTypeSequence = ({ carCount, garageIndex }) => (
    Array.from({ length: 30 }, (_, index) => (
        ((index * 11 + garageIndex * 7) % 30) < carCount
            ? VEHICLE_TYPES.CAR
            : VEHICLE_TYPES.MOTORBIKE
    ))
);

const buildRawLicensePlate = ({ vehicleType, globalIndex }) => {
    const serial = String(10000 + globalIndex * 173).padStart(5, '0');
    const isNearbyProvince = globalIndex % 5 === 4;
    const seriesPool = vehicleType === VEHICLE_TYPES.CAR
        ? (isNearbyProvince ? CAR_NEARBY_SERIES : CAR_HCM_SERIES)
        : (isNearbyProvince ? MOTORBIKE_NEARBY_SERIES : MOTORBIKE_HCM_SERIES);
    const series = seriesPool[globalIndex % seriesPool.length];
    const number = `${serial.slice(0, 3)}.${serial.slice(3)}`;

    return vehicleType === VEHICLE_TYPES.CAR
        ? `${series}-${number}`
        : `${series} ${number}`;
};

const buildVehicleDefinitions = (
    referenceDate = getSeedReferenceDate()
) => {
    const customers = buildCustomerSeedUsers(referenceDate);
    const definitions = [];
    let globalIndex = 0;
    let carIndex = 0;
    let motorbikeIndex = 0;

    GARAGE_SEEDS.forEach((garage, garageIndex) => {
        const garageCustomers = customers.filter(
            (customer) => customer.preferred_garage_code === garage.garage_code
        );
        const target = VEHICLE_GROUP_TARGETS[garage.garage_code];
        const typeSequence = buildVehicleTypeSequence({
            carCount: target.car_count,
            garageIndex,
        });

        typeSequence.forEach((vehicleType, vehicleIndex) => {
            const customerIndex = vehicleIndex < garageCustomers.length
                ? vehicleIndex
                : vehicleIndex - garageCustomers.length;
            const customer = garageCustomers[customerIndex];
            const isDefault = vehicleIndex < garageCustomers.length;
            const variantIndex = vehicleType === VEHICLE_TYPES.CAR
                ? carIndex
                : motorbikeIndex;
            const variant = vehicleType === VEHICLE_TYPES.CAR
                ? CAR_VARIANTS[variantIndex % CAR_VARIANTS.length]
                : MOTORBIKE_VARIANTS[variantIndex % MOTORBIKE_VARIANTS.length];
            const rawLicensePlate = buildRawLicensePlate({
                vehicleType,
                globalIndex,
            });
            const delayMinutes = isDefault
                ? 20 + (customerIndex % 5) * 7
                : 70 + (customerIndex % 5) * 6;
            const createdAt = new Date(
                customer.created_at.getTime() + delayMinutes * 60 * 1000
            );

            definitions.push({
                customer_phone: customer.phone,
                preferred_garage_code: garage.garage_code,
                raw_license_plate: rawLicensePlate,
                normalized_license_plate: rawLicensePlate
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, ''),
                vehicle_type: vehicleType,
                engine_type: variant.engine_type,
                motorbike_cc_group: variant.motorbike_cc_group || null,
                car_body_type: variant.car_body_type || null,
                seat_count: variant.seat_count || null,
                brand: variant.brand,
                model: variant.model,
                color: VEHICLE_COLORS[
                    (globalIndex * 3 + garageIndex) % VEHICLE_COLORS.length
                ],
                is_default: isDefault,
                is_active: true,
                created_at: createdAt,
            });

            globalIndex += 1;

            if (vehicleType === VEHICLE_TYPES.CAR) {
                carIndex += 1;
            } else {
                motorbikeIndex += 1;
            }
        });
    });

    return definitions;
};

module.exports = {
    WASH_BAY_LAYOUTS,
    VEHICLE_GROUP_TARGETS,
    CAR_VARIANTS,
    MOTORBIKE_VARIANTS,
    buildWashBayDefinitions,
    buildVehicleDefinitions,
    buildRawLicensePlate,
};
