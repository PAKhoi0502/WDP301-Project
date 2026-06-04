const TierRule = require('../modules/loyalty/tierRule.model');

const tierRules = [
    {
        tier_name: 'BRONZE',
        booking_window_days: 7,
        max_upcoming_bookings: 1,
        point_multiplier: 1,
        priority_level: 1,
        min_total_spent: 0,
        min_total_visits: 0,
        min_total_points: 0,
        is_active: true,
    },
    {
        tier_name: 'SILVER',
        booking_window_days: 10,
        max_upcoming_bookings: 1,
        point_multiplier: 1.2,
        priority_level: 2,
        min_total_spent: 500000,
        min_total_visits: 5,
        min_total_points: 100,
        is_active: true,
    },
    {
        tier_name: 'GOLD',
        booking_window_days: 12,
        max_upcoming_bookings: 2,
        point_multiplier: 1.35,
        priority_level: 3,
        min_total_spent: 1500000,
        min_total_visits: 12,
        min_total_points: 300,
        is_active: true,
    },
    {
        tier_name: 'PLATINUM',
        booking_window_days: 14,
        max_upcoming_bookings: 3,
        point_multiplier: 1.5,
        priority_level: 4,
        min_total_spent: 3000000,
        min_total_visits: 25,
        min_total_points: 700,
        is_active: true,
    },
];

const seedTierRule = async () => {
    for (const tierRule of tierRules) {
        await TierRule.findOneAndUpdate(
            { tier_name: tierRule.tier_name },
            { $set: tierRule },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
    }

    console.log('Tier rules seeded');
};

module.exports = seedTierRule;
