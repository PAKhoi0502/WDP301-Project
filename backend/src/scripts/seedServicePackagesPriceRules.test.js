const mongoose = require('mongoose');

const ServicePackage = require('../modules/service-packages/servicePackage.model');
const ServicePriceRule = require('../modules/service-price-rules/servicePriceRule.model');
const {
    VEHICLE_TYPES,
    ENGINE_TYPES,
    MOTORBIKE_CC_GROUPS,
    CAR_BODY_TYPES,
} = require('../shared/constants/vehicle.constant');
const {
    SERVICE_PACKAGE_TYPES,
} = require('../shared/constants/servicePackage.constant');
const {
    buildServicePackageDefinitions,
    buildServicePriceRuleDefinitions,
    servicePriceRuleMatchesVehicle,
} = require('./seedServiceCatalogData');
const {
    buildVehicleDefinitions,
} = require('./seedWashBaysVehiclesCatalog');
const {
    assertUniqueServicePackageDefinitions,
} = require('./seedServicePackage');
const {
    assertUniqueServicePriceRuleDefinitions,
} = require('./seedServicePriceRule');
const { getSeedReferenceDate } = require('./seedTime');

describe('service packages and price rules seed catalog', () => {
    const referenceDate = getSeedReferenceDate({
        value: '2026-07-28',
        timezoneOffset: '+07:00',
    });

    test('builds 39 deterministic service packages with the agreed distribution', () => {
        const first = buildServicePackageDefinitions(referenceDate);
        const second = buildServicePackageDefinitions(referenceDate);
        const byType = first.reduce((counts, definition) => ({
            ...counts,
            [definition.service_type]: (
                counts[definition.service_type] || 0
            ) + 1,
        }), {});
        const byVehicle = first.reduce((counts, definition) => ({
            ...counts,
            [definition.vehicle_type]: (
                counts[definition.vehicle_type] || 0
            ) + 1,
        }), {});

        expect(first).toHaveLength(39);
        expect(first).toEqual(second);
        expect(byType).toEqual({
            [SERVICE_PACKAGE_TYPES.WASH]: 9,
            [SERVICE_PACKAGE_TYPES.ADDON]: 21,
            [SERVICE_PACKAGE_TYPES.COMBO]: 9,
        });
        expect(byVehicle).toEqual({
            [VEHICLE_TYPES.MOTORBIKE]: 12,
            [VEHICLE_TYPES.CAR]: 27,
        });
        expect(
            () => assertUniqueServicePackageDefinitions(first)
        ).not.toThrow();
    });

    test('produces schema-valid packages and child-only combo workflows', () => {
        const definitions = buildServicePackageDefinitions(referenceDate);
        const idByCode = new Map(
            definitions.map((definition) => [
                definition.service_code,
                new mongoose.Types.ObjectId(),
            ])
        );

        for (const definition of definitions) {
            const includedServiceIds = definition.included_service_codes.map(
                (serviceCode) => idByCode.get(serviceCode)
            );
            const validationError = new ServicePackage({
                service_code: definition.service_code,
                name: definition.name,
                vehicle_type: definition.vehicle_type,
                service_type: definition.service_type,
                description: definition.description,
                base_price: definition.base_price,
                duration_minutes: definition.duration_minutes,
                countdown_duration_seconds: definition.duration_minutes * 60,
                transition_mode: definition.transition_mode,
                wash_bay_duration_minutes:
                    definition.wash_bay_duration_minutes,
                wash_bay_start_offset_minutes:
                    definition.wash_bay_start_offset_minutes,
                points_earned: definition.points_earned,
                requires_wash_bay: definition.requires_wash_bay,
                requires_care_staff: definition.requires_care_staff,
                care_staff_type: definition.care_staff_type,
                care_staff_required_count:
                    definition.care_staff_required_count,
                care_staff_duration_minutes:
                    definition.care_staff_duration_minutes,
                care_staff_start_offset_minutes:
                    definition.care_staff_start_offset_minutes,
                included_service_ids: includedServiceIds,
                steps_template: definition.steps_template,
                is_active: definition.is_active,
            }).validateSync();

            expect(validationError).toBeUndefined();

            if (definition.service_type === SERVICE_PACKAGE_TYPES.COMBO) {
                expect(definition.included_service_codes.length).toBeGreaterThan(
                    0
                );
                expect(definition.steps_template).toEqual([]);
            } else {
                expect(definition.included_service_codes).toEqual([]);
                expect(definition.steps_template).toHaveLength(1);
            }
        }
    });

    test('derives combo durations, resource windows and proportional points', () => {
        const definitions = buildServicePackageDefinitions(referenceDate);
        const byCode = new Map(
            definitions.map((definition) => [
                definition.service_code,
                definition,
            ])
        );
        const expected = {
            MOTORBIKE_COMBO_WASH_OIL: [35, 14],
            MOTORBIKE_COMBO_FULL_SERVICE: [60, 15],
            CAR_COMBO_EXPRESS: [65, 14],
            CAR_COMBO_STANDARD: [120, 31],
            CAR_COMBO_PREMIUM: [135, 37],
            CAR_COMBO_PROTECT: [165, 92],
            CAR_COMBO_GLASS: [90, 39],
            CAR_COMBO_NEW_CAR: [150, 65],
            CAR_COMBO_FULL_DETAIL: [240, 89],
        };

        for (const [serviceCode, [duration, points]] of Object.entries(
            expected
        )) {
            const combo = byCode.get(serviceCode);
            const children = combo.included_service_codes.map(
                (childCode) => byCode.get(childCode)
            );

            expect(combo.duration_minutes).toBe(duration);
            expect(combo.points_earned).toBe(points);
            expect(combo.duration_minutes).toBe(
                children.reduce(
                    (total, child) => total + child.duration_minutes,
                    0
                )
            );
            expect(
                combo.wash_bay_start_offset_minutes
                + combo.wash_bay_duration_minutes
            ).toBeLessThanOrEqual(combo.duration_minutes);
            expect(
                combo.care_staff_start_offset_minutes
                + combo.care_staff_duration_minutes
            ).toBeLessThanOrEqual(combo.duration_minutes);
        }
    });

    test('builds 51 deterministic global price rules without duration overrides', () => {
        const first = buildServicePriceRuleDefinitions(referenceDate);
        const second = buildServicePriceRuleDefinitions(referenceDate);
        const packages = buildServicePackageDefinitions(referenceDate);
        const packageByCode = new Map(
            packages.map((definition) => [
                definition.service_code,
                definition,
            ])
        );
        const serviceIdByCode = new Map(
            packages.map((definition) => [
                definition.service_code,
                new mongoose.Types.ObjectId(),
            ])
        );

        expect(first).toHaveLength(51);
        expect(first).toEqual(second);
        expect(first.filter(
            (definition) => definition.vehicle_type === VEHICLE_TYPES.MOTORBIKE
        )).toHaveLength(12);
        expect(first.filter(
            (definition) => definition.vehicle_type === VEHICLE_TYPES.CAR
        )).toHaveLength(39);
        expect(
            () => assertUniqueServicePriceRuleDefinitions(first)
        ).not.toThrow();

        for (const definition of first) {
            const servicePackage = packageByCode.get(
                definition.service_code
            );
            const validationError = new ServicePriceRule({
                ...definition,
                service_package_id: serviceIdByCode.get(
                    definition.service_code
                ),
                garage_id: null,
                created_by: new mongoose.Types.ObjectId(),
                updated_by: new mongoose.Types.ObjectId(),
            }).validateSync();

            expect(validationError).toBeUndefined();
            expect(definition.garage_code).toBeNull();
            expect(definition.duration_minutes).toBeNull();
            expect(definition.wash_bay_duration_minutes).toBeNull();
            expect(definition.care_staff_duration_minutes).toBeNull();
            expect(definition.price).toBe(servicePackage.base_price);
        }
    });

    test('prevents smaller wash packages from matching large or electric vehicles', () => {
        const rules = buildServicePriceRuleDefinitions(referenceDate);
        const rulesFor = (serviceCode) => rules.filter(
            (rule) => rule.service_code === serviceCode
        );
        const motorbikeUnder175 = {
            vehicle_type: VEHICLE_TYPES.MOTORBIKE,
            engine_type: ENGINE_TYPES.GASOLINE,
            motorbike_cc_group: MOTORBIKE_CC_GROUPS.UNDER_175CC,
            car_body_type: null,
            seat_count: null,
        };
        const motorbikeOver175 = {
            ...motorbikeUnder175,
            motorbike_cc_group: MOTORBIKE_CC_GROUPS.OVER_175CC,
        };
        const gasolineSedan = {
            vehicle_type: VEHICLE_TYPES.CAR,
            engine_type: ENGINE_TYPES.GASOLINE,
            motorbike_cc_group: null,
            car_body_type: CAR_BODY_TYPES.SEDAN,
            seat_count: 5,
        };
        const gasolineSuv = {
            ...gasolineSedan,
            car_body_type: CAR_BODY_TYPES.SUV,
            seat_count: 7,
        };
        const electricSuv = {
            ...gasolineSuv,
            engine_type: ENGINE_TYPES.ELECTRIC,
        };

        expect(rulesFor('MOTORBIKE_WASH_BASIC').some(
            (rule) => servicePriceRuleMatchesVehicle(
                rule,
                motorbikeUnder175
            )
        )).toBe(true);
        expect(rulesFor('MOTORBIKE_WASH_BASIC').some(
            (rule) => servicePriceRuleMatchesVehicle(
                rule,
                motorbikeOver175
            )
        )).toBe(false);
        expect(rulesFor('MOTORBIKE_WASH_BIG').some(
            (rule) => servicePriceRuleMatchesVehicle(
                rule,
                motorbikeOver175
            )
        )).toBe(true);
        expect(rulesFor('CAR_WASH_BASIC').some(
            (rule) => servicePriceRuleMatchesVehicle(rule, gasolineSedan)
        )).toBe(true);
        expect(rulesFor('CAR_WASH_BASIC').some(
            (rule) => servicePriceRuleMatchesVehicle(rule, gasolineSuv)
        )).toBe(false);
        expect(rulesFor('CAR_WASH_SUV_PICKUP').some(
            (rule) => servicePriceRuleMatchesVehicle(rule, gasolineSuv)
        )).toBe(true);
        expect(rulesFor('CAR_WASH_ELECTRIC').some(
            (rule) => servicePriceRuleMatchesVehicle(rule, electricSuv)
        )).toBe(true);
        expect(rulesFor('CAR_WASH_ELECTRIC').some(
            (rule) => servicePriceRuleMatchesVehicle(rule, gasolineSuv)
        )).toBe(false);
    });

    test('gives every seeded vehicle a wash option without ambiguous rules', () => {
        const packages = buildServicePackageDefinitions(referenceDate);
        const rules = buildServicePriceRuleDefinitions(referenceDate);
        const vehicles = buildVehicleDefinitions(referenceDate);

        for (const vehicle of vehicles) {
            const washPackages = packages.filter(
                (servicePackage) => (
                    servicePackage.vehicle_type === vehicle.vehicle_type
                    && servicePackage.service_type
                        === SERVICE_PACKAGE_TYPES.WASH
                )
            );
            const eligibleWashPackages = washPackages.filter(
                (servicePackage) => {
                    const matchingRules = rules.filter(
                        (rule) => (
                            rule.service_code === servicePackage.service_code
                            && servicePriceRuleMatchesVehicle(rule, vehicle)
                        )
                    );

                    expect(matchingRules.length).toBeLessThanOrEqual(1);

                    return matchingRules.length === 1;
                }
            );

            expect(eligibleWashPackages.length).toBeGreaterThan(0);
        }
    });
});
