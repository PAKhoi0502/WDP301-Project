const mongoose = require('mongoose');

const WashBay = require('../modules/wash-bays/washBay.model');
const Vehicle = require('../modules/vehicles/vehicle.model');
const { normalizeLicensePlate } = require('../modules/vehicles/vehicle.service');
const {
    VEHICLE_TYPES,
    ENGINE_TYPES,
    CAR_BODY_TYPE_VALUES,
} = require('../shared/constants/vehicle.constant');
const { normalizePhone } = require('../shared/utils/phone');
const { buildCustomerSeedUsers } = require('./seedCatalog');
const {
    WASH_BAY_LAYOUTS,
    VEHICLE_GROUP_TARGETS,
    buildWashBayDefinitions,
    buildVehicleDefinitions,
} = require('./seedWashBaysVehiclesCatalog');
const {
    assertUniqueWashBayDefinitions,
} = require('./seedWashBay');
const {
    assertUniqueVehicleDefinitions,
} = require('./seedVehicle');
const { getSeedReferenceDate } = require('./seedTime');

describe('wash bays and vehicles seed catalog', () => {
    const referenceDate = getSeedReferenceDate({
        value: '2026-07-28',
        timezoneOffset: '+07:00',
    });

    test('builds the agreed wash bay layout for all garages', () => {
        const first = buildWashBayDefinitions(referenceDate);
        const second = buildWashBayDefinitions(referenceDate);

        expect(first).toHaveLength(18);
        expect(first).toEqual(second);
        expect(() => assertUniqueWashBayDefinitions(first)).not.toThrow();

        for (const layout of WASH_BAY_LAYOUTS) {
            const garageWashBays = first.filter(
                (washBay) => washBay.garage_code === layout.garage_code
            );
            const carCount = garageWashBays.filter(
                (washBay) => washBay.vehicle_type === VEHICLE_TYPES.CAR
            ).length;
            const motorbikeCount = garageWashBays.filter(
                (washBay) => washBay.vehicle_type === VEHICLE_TYPES.MOTORBIKE
            ).length;

            expect(garageWashBays).toHaveLength(
                layout.car_count + layout.motorbike_count
            );
            expect(carCount).toBe(layout.car_count);
            expect(motorbikeCount).toBe(layout.motorbike_count);
        }
    });

    test('produces schema-valid available wash bays', () => {
        const definitions = buildWashBayDefinitions(referenceDate);

        for (const definition of definitions) {
            const error = new WashBay({
                garage_id: new mongoose.Types.ObjectId(),
                name: definition.name,
                bay_code: definition.bay_code,
                vehicle_type: definition.vehicle_type,
                status: definition.status,
                current_booking_id: definition.current_booking_id,
                is_active: definition.is_active,
                created_at: definition.created_at,
                updated_at: definition.created_at,
            }).validateSync();

            expect(error).toBeUndefined();
            expect(definition.created_at.getTime()).toBeLessThan(
                referenceDate.getTime()
            );
        }
    });

    test('builds 150 deterministic vehicles with the agreed distribution', () => {
        const first = buildVehicleDefinitions(referenceDate);
        const second = buildVehicleDefinitions(referenceDate);
        const vehicleTypeCounts = first.reduce((counts, vehicle) => ({
            ...counts,
            [vehicle.vehicle_type]: (counts[vehicle.vehicle_type] || 0) + 1,
        }), {});

        expect(first).toHaveLength(150);
        expect(first).toEqual(second);
        expect(vehicleTypeCounts).toEqual({
            [VEHICLE_TYPES.CAR]: 74,
            [VEHICLE_TYPES.MOTORBIKE]: 76,
        });
        expect(() => assertUniqueVehicleDefinitions(first)).not.toThrow();

        for (const [garageCode, target] of Object.entries(VEHICLE_GROUP_TARGETS)) {
            const garageVehicles = first.filter(
                (vehicle) => vehicle.preferred_garage_code === garageCode
            );

            expect(garageVehicles).toHaveLength(30);
            expect(
                garageVehicles.filter(
                    (vehicle) => vehicle.vehicle_type === VEHICLE_TYPES.CAR
                )
            ).toHaveLength(target.car_count);
            expect(
                garageVehicles.filter(
                    (vehicle) => vehicle.vehicle_type === VEHICLE_TYPES.MOTORBIKE
                )
            ).toHaveLength(target.motorbike_count);
        }
    });

    test('gives every customer one default and no more than two vehicles', () => {
        const definitions = buildVehicleDefinitions(referenceDate);
        const ownership = new Map();

        for (const definition of definitions) {
            const customerPhone = normalizePhone(definition.customer_phone);
            const customer = ownership.get(customerPhone) || {
                total: 0,
                defaults: 0,
            };

            customer.total += 1;
            customer.defaults += definition.is_default ? 1 : 0;
            ownership.set(customerPhone, customer);
        }

        expect(ownership.size).toBe(125);
        expect(
            [...ownership.values()].filter((customer) => customer.total === 1)
        ).toHaveLength(100);
        expect(
            [...ownership.values()].filter((customer) => customer.total === 2)
        ).toHaveLength(25);
        expect(
            [...ownership.values()].every((customer) => customer.defaults === 1)
        ).toBe(true);
    });

    test('uses unique realistic plates and valid type-specific fields', () => {
        const definitions = buildVehicleDefinitions(referenceDate);
        const customers = buildCustomerSeedUsers(referenceDate);
        const customerByPhone = new Map(
            customers.map((customer) => [
                normalizePhone(customer.phone),
                customer,
            ])
        );
        const normalizedPlates = new Set();
        const carBodyTypes = new Set();
        let nearbyProvinceCount = 0;

        for (const definition of definitions) {
            const customer = customerByPhone.get(
                normalizePhone(definition.customer_phone)
            );
            const rawPlatePattern = definition.vehicle_type === VEHICLE_TYPES.CAR
                ? /^(50|51|59|60|61|72)[A-Z]-\d{3}\.\d{2}$/
                : /^(59|60|61|72)-[A-Z]\d \d{3}\.\d{2}$/;
            const error = new Vehicle({
                customer_id: new mongoose.Types.ObjectId(),
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
            }).validateSync();

            expect(error).toBeUndefined();
            expect(definition.raw_license_plate).toMatch(rawPlatePattern);
            expect(definition.normalized_license_plate).toBe(
                normalizeLicensePlate(definition.raw_license_plate)
            );
            expect(definition.created_at.getTime()).toBeGreaterThan(
                customer.created_at.getTime()
            );
            expect(definition.created_at.getTime()).toBeLessThan(
                referenceDate.getTime()
            );

            normalizedPlates.add(definition.normalized_license_plate);

            if (/^(60|61|72)/.test(definition.raw_license_plate)) {
                nearbyProvinceCount += 1;
            }

            if (definition.car_body_type) {
                carBodyTypes.add(definition.car_body_type);
            }
        }

        expect(normalizedPlates.size).toBe(150);
        expect(nearbyProvinceCount).toBe(30);
        expect([...carBodyTypes].sort()).toEqual(
            [...CAR_BODY_TYPE_VALUES].sort()
        );
        expect(
            definitions.some(
                (vehicle) => vehicle.engine_type === ENGINE_TYPES.ELECTRIC
            )
        ).toBe(true);
        expect(
            definitions.some(
                (vehicle) => vehicle.engine_type === ENGINE_TYPES.GASOLINE
            )
        ).toBe(true);
    });
});
