const FEEDBACK_REWARD_RULE_CODE = 'POST_SERVICE_FEEDBACK';
const FEEDBACK_REWARD_MAX_PER_BOOKING = 100;

const FEEDBACK_REWARD_SOURCES = Object.freeze({
    SURVEY: 'SURVEY',
    REVIEW: 'REVIEW',
});

const FEEDBACK_REWARD_SOURCE_VALUES = Object.freeze(
    Object.values(FEEDBACK_REWARD_SOURCES)
);

const DEFAULT_FEEDBACK_REWARD_RULE = Object.freeze({
    rule_code: FEEDBACK_REWARD_RULE_CODE,
    survey_points: 50,
    review_points: 50,
    review_window_days: 30,
    reminder_after_hours: 48,
    count_toward_tier: false,
    is_active: true,
    starts_at: null,
    ends_at: null,
});

module.exports = {
    FEEDBACK_REWARD_RULE_CODE,
    FEEDBACK_REWARD_MAX_PER_BOOKING,
    FEEDBACK_REWARD_SOURCES,
    FEEDBACK_REWARD_SOURCE_VALUES,
    DEFAULT_FEEDBACK_REWARD_RULE,
};
