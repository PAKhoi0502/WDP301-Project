const LoyaltyRedeemRule = require('../modules/loyalty/loyaltyRedeemRule.model');
const {
    buildRedeemRuleDefinition,
} = require('./seedLoyaltyPromotionCatalog');
const { getSeedReferenceDate } = require('./seedTime');

const seedLoyaltyRedeemRule = async ({
    session = null,
    referenceDate = getSeedReferenceDate(),
    dryRun = false,
} = {}) => {
    console.log('== Seeding loyalty redeem rule ==');

    const definition = buildRedeemRuleDefinition(referenceDate);
    const summary = {
        planned: 1,
        rule_code: definition.rule_code,
        point_value_amount: definition.point_value_amount,
        min_redeem_points: definition.min_redeem_points,
        redeem_step: definition.redeem_step,
        max_redeem_percent: definition.max_redeem_percent,
    };

    if (dryRun) {
        console.table([summary]);

        return {
            ...summary,
            dry_run: true,
        };
    }

    const payload = {
        rule_code: definition.rule_code,
        point_value_amount: definition.point_value_amount,
        min_redeem_points: definition.min_redeem_points,
        redeem_step: definition.redeem_step,
        max_redeem_percent: definition.max_redeem_percent,
        is_active: definition.is_active,
    };
    const validationError = new LoyaltyRedeemRule({
        ...payload,
        created_at: definition.created_at,
        updated_at: definition.created_at,
    }).validateSync();

    if (validationError) {
        throw validationError;
    }

    const deactivateResult = await LoyaltyRedeemRule.updateMany(
        {
            rule_code: { $ne: definition.rule_code },
            is_active: true,
        },
        {
            $set: {
                is_active: false,
                updated_at: definition.created_at,
            },
        },
        {
            session,
            timestamps: false,
        }
    );
    const result = await LoyaltyRedeemRule.updateOne(
        {
            rule_code: definition.rule_code,
        },
        {
            $set: {
                ...payload,
                updated_at: definition.created_at,
            },
            $setOnInsert: {
                created_at: definition.created_at,
            },
        },
        {
            upsert: true,
            runValidators: true,
            setDefaultsOnInsert: true,
            session,
            timestamps: false,
        }
    );
    const completedSummary = {
        ...summary,
        dry_run: false,
        matched: result.matchedCount,
        modified: result.modifiedCount,
        inserted: result.upsertedCount,
        deactivated: deactivateResult.modifiedCount,
    };

    console.table([{
        planned: completedSummary.planned,
        matched: completedSummary.matched,
        modified: completedSummary.modified,
        inserted: completedSummary.inserted,
        deactivated: completedSummary.deactivated,
    }]);
    console.log('Loyalty redeem rule seeding completed');

    return completedSummary;
};

module.exports = seedLoyaltyRedeemRule;
