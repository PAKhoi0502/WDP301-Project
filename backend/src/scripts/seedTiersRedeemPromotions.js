require('dotenv').config();

const TierRule = require('../modules/loyalty/tierRule.model');
const LoyaltyRedeemRule = require('../modules/loyalty/loyaltyRedeemRule.model');
const Promotion = require('../modules/promotions/promotion.model');
const PromotionUsage = require('../modules/promotion-usages/promotionUsage.model');
const ServicePackage = require('../modules/service-packages/servicePackage.model');
const { connectDB, disconnectDB } = require('../config/db');
const {
    PROMOTION_USAGE_STATUS,
} = require('../shared/constants/promotion.constant');
const seedTierRule = require('./seedTierRule');
const seedLoyaltyRedeemRule = require('./seedLoyaltyRedeemRule');
const seedPromotion = require('./seedPromotion');
const {
    buildTierRuleDefinitions,
    buildRedeemRuleDefinition,
    buildPromotionDefinitions,
} = require('./seedLoyaltyPromotionCatalog');
const { getSeedReferenceDate } = require('./seedTime');

const sameIdSequence = (actualIds, expectedIds) => (
    actualIds.length === expectedIds.length
    && actualIds.every(
        (actualId, index) => actualId.toString() === expectedIds[index].toString()
    )
);

const verifyTiersRedeemPromotions = async ({ referenceDate } = {}) => {
    const tierDefinitions = buildTierRuleDefinitions(referenceDate);
    const redeemDefinition = buildRedeemRuleDefinition(referenceDate);
    const promotionDefinitions = buildPromotionDefinitions(referenceDate);
    const tierNames = tierDefinitions.map((definition) => definition.tier_name);
    const promotionCodes = promotionDefinitions.map(
        (definition) => definition.code
    );
    const [tierRules, redeemRules, promotions, servicePackages, usageCounts] = (
        await Promise.all([
            TierRule.find({
                tier_name: { $in: tierNames },
            }).lean(),
            LoyaltyRedeemRule.find({}).lean(),
            Promotion.find({
                code: { $in: promotionCodes },
            }).lean(),
            ServicePackage.find({
                service_code: {
                    $in: [...new Set(
                        promotionDefinitions.flatMap(
                            (definition) => (
                                definition.applicable_service_package_codes
                            )
                        )
                    )],
                },
            }).select('_id service_code').lean(),
            PromotionUsage.aggregate([
                {
                    $group: {
                        _id: {
                            promotion_id: '$promotion_id',
                            status: '$status',
                        },
                        total: { $sum: 1 },
                    },
                },
            ]),
        ])
    );

    if (tierRules.length !== tierDefinitions.length) {
        throw new Error(
            `Tier rule verification failed: expected ${tierDefinitions.length}, found ${tierRules.length}`
        );
    }

    const activeRedeemRules = redeemRules.filter(
        (redeemRule) => redeemRule.is_active
    );

    if (activeRedeemRules.length !== 1) {
        throw new Error(
            `Redeem rule verification failed: expected 1 active rule, found ${activeRedeemRules.length}`
        );
    }

    if (promotions.length !== promotionDefinitions.length) {
        throw new Error(
            `Promotion verification failed: expected ${promotionDefinitions.length}, found ${promotions.length}`
        );
    }

    const tierByName = new Map(
        tierRules.map((tierRule) => [tierRule.tier_name, tierRule])
    );

    for (const definition of tierDefinitions) {
        const tierRule = tierByName.get(definition.tier_name);

        if (
            !tierRule
            || tierRule.booking_window_days
                !== definition.booking_window_days
            || tierRule.max_upcoming_bookings
                !== definition.max_upcoming_bookings
            || tierRule.point_multiplier !== definition.point_multiplier
            || tierRule.priority_level !== definition.priority_level
            || tierRule.min_total_spent !== definition.min_total_spent
            || tierRule.min_total_visits !== definition.min_total_visits
            || tierRule.min_total_points !== definition.min_total_points
            || tierRule.is_active !== definition.is_active
        ) {
            throw new Error(
                `Invalid tier rule mapping: ${definition.tier_name}`
            );
        }
    }

    const activeRedeemRule = activeRedeemRules[0];

    if (
        activeRedeemRule.rule_code !== redeemDefinition.rule_code
        || activeRedeemRule.point_value_amount
            !== redeemDefinition.point_value_amount
        || activeRedeemRule.min_redeem_points
            !== redeemDefinition.min_redeem_points
        || activeRedeemRule.redeem_step !== redeemDefinition.redeem_step
        || activeRedeemRule.max_redeem_percent
            !== redeemDefinition.max_redeem_percent
    ) {
        throw new Error(
            `Invalid redeem rule mapping: ${redeemDefinition.rule_code}`
        );
    }

    const packageByCode = new Map(
        servicePackages.map((servicePackage) => [
            servicePackage.service_code,
            servicePackage,
        ])
    );
    const promotionByCode = new Map(
        promotions.map((promotion) => [promotion.code, promotion])
    );
    const usageCountByPromotionAndStatus = new Map(
        usageCounts.map((item) => [
            `${item._id.promotion_id}:${item._id.status}`,
            item.total,
        ])
    );

    for (const definition of promotionDefinitions) {
        const promotion = promotionByCode.get(definition.code);
        const expectedServicePackageIds = (
            definition.applicable_service_package_codes
        ).map((serviceCode) => {
            const servicePackage = packageByCode.get(serviceCode);

            if (!servicePackage) {
                throw new Error(
                    `Promotion verification service package not found: ${definition.code}:${serviceCode}`
                );
            }

            return servicePackage._id;
        });

        if (
            !promotion
            || promotion.name !== definition.name
            || promotion.description !== definition.description
            || promotion.discount_type !== definition.discount_type
            || promotion.discount_value !== definition.discount_value
            || (promotion.max_discount_amount ?? null)
                !== definition.max_discount_amount
            || promotion.min_order_amount !== definition.min_order_amount
            || promotion.audience !== definition.audience
            || promotion.phone_required !== definition.phone_required
            || (promotion.per_phone_limit ?? null)
                !== definition.per_phone_limit
            || JSON.stringify(promotion.applicable_tiers)
                !== JSON.stringify(definition.applicable_tiers)
            || JSON.stringify(promotion.applicable_vehicle_types)
                !== JSON.stringify(definition.applicable_vehicle_types)
            || !sameIdSequence(
                promotion.applicable_service_package_ids,
                expectedServicePackageIds
            )
            || promotion.start_at.getTime() !== definition.start_at.getTime()
            || promotion.end_at.getTime() !== definition.end_at.getTime()
            || promotion.usage_limit !== definition.usage_limit
            || (promotion.per_customer_limit ?? null)
                !== definition.per_customer_limit
            || promotion.is_active !== definition.is_active
        ) {
            throw new Error(
                `Invalid promotion mapping: ${definition.code}`
            );
        }

        const consumedCount = usageCountByPromotionAndStatus.get(
            `${promotion._id}:${PROMOTION_USAGE_STATUS.CONSUMED}`
        ) || 0;
        const reservedCount = usageCountByPromotionAndStatus.get(
            `${promotion._id}:${PROMOTION_USAGE_STATUS.RESERVED}`
        ) || 0;

        if (
            promotion.used_count !== consumedCount
            || promotion.reserved_count !== reservedCount
        ) {
            throw new Error(
                `Promotion usage counters are inconsistent: ${definition.code}`
            );
        }
    }

    return {
        tier_rules: {
            total: tierRules.length,
            active: tierRules.filter((tierRule) => tierRule.is_active).length,
            tiers: tierDefinitions.map((definition) => ({
                tier_name: definition.tier_name,
                booking_window_days: definition.booking_window_days,
                max_upcoming_bookings: definition.max_upcoming_bookings,
                point_multiplier: definition.point_multiplier,
                priority_level: definition.priority_level,
            })),
        },
        redeem_rule: {
            total: redeemRules.length,
            active: activeRedeemRules.length,
            rule_code: activeRedeemRule.rule_code,
            point_value_amount: activeRedeemRule.point_value_amount,
            min_redeem_points: activeRedeemRule.min_redeem_points,
            redeem_step: activeRedeemRule.redeem_step,
            max_redeem_percent: activeRedeemRule.max_redeem_percent,
        },
        promotions: {
            total: promotions.length,
            active_now: promotions.filter((promotion) => (
                promotion.is_active
                && promotion.start_at <= referenceDate
                && promotion.end_at >= referenceDate
            )).length,
            upcoming: promotions.filter((promotion) => (
                promotion.is_active
                && promotion.start_at > referenceDate
            )).length,
            expired: promotions.filter(
                (promotion) => promotion.end_at < referenceDate
            ).length,
            paused: promotions.filter((promotion) => (
                !promotion.is_active
                && promotion.start_at <= referenceDate
                && promotion.end_at >= referenceDate
            )).length,
            used_count: promotions.reduce(
                (total, promotion) => total + promotion.used_count,
                0
            ),
            reserved_count: promotions.reduce(
                (total, promotion) => total + promotion.reserved_count,
                0
            ),
        },
    };
};

const seedTiersRedeemPromotions = async ({
    dryRun = process.argv.includes('--dry-run'),
} = {}) => {
    const referenceDate = getSeedReferenceDate();

    if (dryRun) {
        return {
            dry_run: true,
            reference_date: referenceDate,
            tier_rules: await seedTierRule({
                referenceDate,
                dryRun: true,
            }),
            redeem_rule: await seedLoyaltyRedeemRule({
                referenceDate,
                dryRun: true,
            }),
            promotions: await seedPromotion({
                referenceDate,
                dryRun: true,
            }),
        };
    }

    await connectDB();

    const session = await TierRule.startSession();
    const result = {
        dry_run: false,
        reference_date: referenceDate,
    };

    try {
        await session.withTransaction(async () => {
            result.tier_rules = await seedTierRule({
                session,
                referenceDate,
            });
            result.redeem_rule = await seedLoyaltyRedeemRule({
                session,
                referenceDate,
            });
            result.promotions = await seedPromotion({
                session,
                referenceDate,
            });
        });

        result.verification = await verifyTiersRedeemPromotions({
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
        const result = await seedTiersRedeemPromotions();

        console.log('Tier rules, redeem rule and promotions seed completed');
        console.dir(result.verification || result, { depth: null });
    } catch (error) {
        console.error(
            'Tier rules, redeem rule and promotions seed failed:',
            error
        );
        process.exitCode = 1;

        await disconnectDB().catch(() => {});
    }
};

if (require.main === module) {
    run();
}

module.exports = {
    seedTiersRedeemPromotions,
    verifyTiersRedeemPromotions,
};
