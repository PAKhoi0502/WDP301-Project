const TierRule = require('../modules/loyalty/tierRule.model');
const {
    buildTierRuleDefinitions,
} = require('./seedLoyaltyPromotionCatalog');
const { getSeedReferenceDate } = require('./seedTime');

const assertTierRuleDefinitionsValid = (definitions) => {
    const tierNames = new Set();
    const priorityLevels = new Set();
    let previous = null;

    for (const definition of definitions) {
        if (tierNames.has(definition.tier_name)) {
            throw new Error(`Duplicate tier name: ${definition.tier_name}`);
        }

        if (priorityLevels.has(definition.priority_level)) {
            throw new Error(
                `Duplicate tier priority: ${definition.priority_level}`
            );
        }

        if (
            previous
            && (
                definition.booking_window_days
                    < previous.booking_window_days
                || definition.max_upcoming_bookings
                    < previous.max_upcoming_bookings
                || definition.point_multiplier < previous.point_multiplier
                || definition.min_total_spent < previous.min_total_spent
                || definition.min_total_visits < previous.min_total_visits
                || definition.min_total_points < previous.min_total_points
            )
        ) {
            throw new Error(
                `Tier benefits or thresholds are not monotonic: ${definition.tier_name}`
            );
        }

        tierNames.add(definition.tier_name);
        priorityLevels.add(definition.priority_level);
        previous = definition;
    }
};

const summarizeTierRules = (definitions) => ({
    planned: definitions.length,
    active: definitions.filter((definition) => definition.is_active).length,
    tiers: definitions.map((definition) => definition.tier_name),
});

const seedTierRule = async ({
    session = null,
    referenceDate = getSeedReferenceDate(),
    dryRun = false,
} = {}) => {
    console.log('== Seeding tier rules ==');

    const definitions = buildTierRuleDefinitions(referenceDate);

    assertTierRuleDefinitionsValid(definitions);

    const summary = summarizeTierRules(definitions);

    if (dryRun) {
        console.table(definitions.map((definition) => ({
            tier: definition.tier_name,
            booking_days: definition.booking_window_days,
            max_bookings: definition.max_upcoming_bookings,
            multiplier: definition.point_multiplier,
            min_spent: definition.min_total_spent,
            min_visits: definition.min_total_visits,
            min_points: definition.min_total_points,
        })));

        return {
            ...summary,
            dry_run: true,
        };
    }

    const operations = definitions.map((definition) => {
        const payload = {
            tier_name: definition.tier_name,
            booking_window_days: definition.booking_window_days,
            max_upcoming_bookings: definition.max_upcoming_bookings,
            point_multiplier: definition.point_multiplier,
            priority_level: definition.priority_level,
            min_total_spent: definition.min_total_spent,
            min_total_visits: definition.min_total_visits,
            min_total_points: definition.min_total_points,
            is_active: definition.is_active,
        };
        const validationError = new TierRule({
            ...payload,
            created_at: definition.created_at,
            updated_at: definition.created_at,
        }).validateSync();

        if (validationError) {
            throw validationError;
        }

        return {
            updateOne: {
                filter: {
                    tier_name: definition.tier_name,
                },
                update: {
                    $set: {
                        ...payload,
                        updated_at: definition.created_at,
                    },
                    $setOnInsert: {
                        created_at: definition.created_at,
                    },
                },
                upsert: true,
                timestamps: false,
            },
        };
    });
    const result = await TierRule.bulkWrite(operations, {
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
    console.log('Tier rules seeding completed');

    return completedSummary;
};

module.exports = seedTierRule;
module.exports.assertTierRuleDefinitionsValid = assertTierRuleDefinitionsValid;
module.exports.summarizeTierRules = summarizeTierRules;
