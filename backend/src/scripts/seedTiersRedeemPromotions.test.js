const mongoose = require('mongoose');

const TierRule = require('../modules/loyalty/tierRule.model');
const LoyaltyRedeemRule = require('../modules/loyalty/loyaltyRedeemRule.model');
const Promotion = require('../modules/promotions/promotion.model');
const {
    LOYALTY_TIERS,
} = require('../shared/constants/loyalty.constant');
const {
    PROMOTION_AUDIENCES,
} = require('../shared/constants/promotion.constant');
const {
    buildServicePackageDefinitions,
} = require('./seedServiceCatalogData');
const {
    buildTierRuleDefinitions,
    buildRedeemRuleDefinition,
    buildPromotionDefinitions,
} = require('./seedLoyaltyPromotionCatalog');
const {
    assertTierRuleDefinitionsValid,
} = require('./seedTierRule');
const {
    assertPromotionDefinitionsValid,
    summarizePromotions,
} = require('./seedPromotion');
const { getSeedReferenceDate } = require('./seedTime');

describe('tier rules, redeem rule and promotions seed catalog', () => {
    const referenceDate = getSeedReferenceDate({
        value: '2026-07-28',
        timezoneOffset: '+07:00',
    });

    test('builds four deterministic and monotonic tier rules', () => {
        const first = buildTierRuleDefinitions(referenceDate);
        const second = buildTierRuleDefinitions(referenceDate);

        expect(first).toHaveLength(4);
        expect(first).toEqual(second);
        expect(
            () => assertTierRuleDefinitionsValid(first)
        ).not.toThrow();
        expect(first.map((definition) => ({
            tier: definition.tier_name,
            days: definition.booking_window_days,
            bookings: definition.max_upcoming_bookings,
            multiplier: definition.point_multiplier,
            priority: definition.priority_level,
            spent: definition.min_total_spent,
            visits: definition.min_total_visits,
            points: definition.min_total_points,
        }))).toEqual([
            {
                tier: LOYALTY_TIERS.BRONZE,
                days: 7,
                bookings: 1,
                multiplier: 1,
                priority: 1,
                spent: 0,
                visits: 0,
                points: 0,
            },
            {
                tier: LOYALTY_TIERS.SILVER,
                days: 10,
                bookings: 1,
                multiplier: 1.2,
                priority: 2,
                spent: 500000,
                visits: 3,
                points: 30,
            },
            {
                tier: LOYALTY_TIERS.GOLD,
                days: 14,
                bookings: 2,
                multiplier: 1.35,
                priority: 3,
                spent: 2000000,
                visits: 8,
                points: 120,
            },
            {
                tier: LOYALTY_TIERS.PLATINUM,
                days: 20,
                bookings: 3,
                multiplier: 1.5,
                priority: 4,
                spent: 5000000,
                visits: 15,
                points: 300,
            },
        ]);

        for (const definition of first) {
            const validationError = new TierRule(
                definition
            ).validateSync();

            expect(validationError).toBeUndefined();
        }
    });

    test('uses one hundred dong per point with practical redeem increments', () => {
        const definition = buildRedeemRuleDefinition(referenceDate);
        const validationError = new LoyaltyRedeemRule(
            definition
        ).validateSync();

        expect(validationError).toBeUndefined();
        expect(definition).toEqual(expect.objectContaining({
            rule_code: 'LOYALTY_REDEEM_STANDARD_V1',
            point_value_amount: 100,
            min_redeem_points: 50,
            redeem_step: 10,
            max_redeem_percent: 30,
            is_active: true,
        }));
        expect(
            definition.min_redeem_points * definition.point_value_amount
        ).toBe(5000);
        expect(
            definition.redeem_step * definition.point_value_amount
        ).toBe(1000);
    });

    test('builds ten deterministic promotions across lifecycle states', () => {
        const first = buildPromotionDefinitions(referenceDate);
        const second = buildPromotionDefinitions(referenceDate);
        const summary = summarizePromotions(first, referenceDate);

        expect(first).toHaveLength(10);
        expect(first).toEqual(second);
        expect(
            () => assertPromotionDefinitionsValid(first, referenceDate)
        ).not.toThrow();
        expect(summary).toEqual({
            planned: 10,
            active_now: 7,
            upcoming: 1,
            expired: 1,
            inactive: 2,
        });
        expect(first.filter(
            (definition) => (
                !definition.is_active
                && definition.start_at <= referenceDate
                && definition.end_at >= referenceDate
            )
        )).toHaveLength(1);
    });

    test('references only existing stable service package codes', () => {
        const serviceCodes = new Set(
            buildServicePackageDefinitions(referenceDate).map(
                (definition) => definition.service_code
            )
        );
        const promotions = buildPromotionDefinitions(referenceDate);

        for (const promotion of promotions) {
            for (const serviceCode of (
                promotion.applicable_service_package_codes
            )) {
                expect(serviceCodes.has(serviceCode)).toBe(true);
            }
        }
    });

    test('produces schema-valid promotions without fake usage counters', () => {
        const definitions = buildPromotionDefinitions(referenceDate);
        const servicePackageIds = new Map(
            buildServicePackageDefinitions(referenceDate).map(
                (definition) => [
                    definition.service_code,
                    new mongoose.Types.ObjectId(),
                ]
            )
        );

        for (const definition of definitions) {
            const validationError = new Promotion({
                ...definition,
                applicable_service_package_ids: (
                    definition.applicable_service_package_codes
                ).map((serviceCode) => servicePackageIds.get(serviceCode)),
                created_by_id: new mongoose.Types.ObjectId(),
                updated_by_id: new mongoose.Types.ObjectId(),
            }).validateSync();

            expect(validationError).toBeUndefined();
            expect(definition.used_count).toBe(0);
            expect(definition.reserved_count).toBe(0);

            if (definition.audience === PROMOTION_AUDIENCES.WALK_IN) {
                expect(definition.applicable_tiers).toEqual([]);
                expect(definition.per_customer_limit).toBeNull();
                expect(definition.phone_required).toBe(true);
                expect(definition.per_phone_limit).toBe(1);
            }

            if (definition.audience === PROMOTION_AUDIENCES.CUSTOMER) {
                expect(definition.phone_required).toBe(false);
                expect(definition.per_phone_limit).toBeNull();
            }
        }
    });

    test('gives higher tiers access to lower-tier benefit campaigns', () => {
        const promotionByCode = new Map(
            buildPromotionDefinitions(referenceDate).map(
                (definition) => [definition.code, definition]
            )
        );

        expect(promotionByCode.get('MEMBER5').applicable_tiers).toEqual([
            LOYALTY_TIERS.BRONZE,
            LOYALTY_TIERS.SILVER,
            LOYALTY_TIERS.GOLD,
            LOYALTY_TIERS.PLATINUM,
        ]);
        expect(promotionByCode.get('SILVER10').applicable_tiers).toEqual([
            LOYALTY_TIERS.SILVER,
            LOYALTY_TIERS.GOLD,
            LOYALTY_TIERS.PLATINUM,
        ]);
        expect(promotionByCode.get('GOLD15').applicable_tiers).toEqual([
            LOYALTY_TIERS.GOLD,
            LOYALTY_TIERS.PLATINUM,
        ]);
        expect(promotionByCode.get('PLATINUM20').applicable_tiers).toEqual([
            LOYALTY_TIERS.PLATINUM,
        ]);
    });
});
