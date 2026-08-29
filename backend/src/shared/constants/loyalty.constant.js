// Retained for legacy defaults and seed data. Runtime tier definitions come from TierRule.
const LOYALTY_TIERS = Object.freeze({
    BRONZE: 'BRONZE',
    SILVER: 'SILVER',
    GOLD: 'GOLD',
    PLATINUM: 'PLATINUM',
});

const POINT_TRANSACTION_TYPES = Object.freeze({
    EARN: 'EARN',
    SURVEY_REWARD: 'SURVEY_REWARD',
    REVIEW_REWARD: 'REVIEW_REWARD',
    REDEEM: 'REDEEM',
    REFUND: 'REFUND',
    EXPIRE: 'EXPIRE',
    ADJUST: 'ADJUST',
});

const POINT_TRANSACTION_TYPE_VALUES = Object.freeze(Object.values(POINT_TRANSACTION_TYPES));

const POINT_EXPIRY_MONTHS = 12;
const TIER_INACTIVITY_DOWNGRADE_DAYS = 90;

module.exports = {
    LOYALTY_TIERS,
    POINT_TRANSACTION_TYPES,
    POINT_TRANSACTION_TYPE_VALUES,
    POINT_EXPIRY_MONTHS,
    TIER_INACTIVITY_DOWNGRADE_DAYS,
};
