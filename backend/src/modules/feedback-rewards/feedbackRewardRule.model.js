const mongoose = require('mongoose');

const {
    FEEDBACK_REWARD_RULE_CODE,
    FEEDBACK_REWARD_MAX_PER_BOOKING,
} = require('../../shared/constants/feedbackReward.constant');

const feedbackRewardRuleSchema = new mongoose.Schema(
    {
        rule_code: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            uppercase: true,
            default: FEEDBACK_REWARD_RULE_CODE,
        },
        survey_points: {
            type: Number,
            required: true,
            min: 0,
            max: FEEDBACK_REWARD_MAX_PER_BOOKING,
            default: 50,
        },
        review_points: {
            type: Number,
            required: true,
            min: 0,
            max: FEEDBACK_REWARD_MAX_PER_BOOKING,
            default: 50,
        },
        review_window_days: {
            type: Number,
            required: true,
            min: 1,
            max: 365,
            default: 30,
        },
        reminder_after_hours: {
            type: Number,
            required: true,
            min: 1,
            max: 720,
            default: 48,
        },
        count_toward_tier: {
            type: Boolean,
            default: false,
        },
        is_active: {
            type: Boolean,
            default: true,
        },
        starts_at: {
            type: Date,
            default: null,
        },
        ends_at: {
            type: Date,
            default: null,
        },
        created_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        updated_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
        collection: 'feedback_reward_rules',
    }
);

feedbackRewardRuleSchema.index({ is_active: 1, starts_at: 1, ends_at: 1 });

feedbackRewardRuleSchema.pre('validate', function (next) {
    if (
        this.survey_points + this.review_points >
        FEEDBACK_REWARD_MAX_PER_BOOKING
    ) {
        this.invalidate(
            'review_points',
            `Feedback rewards must not exceed ${FEEDBACK_REWARD_MAX_PER_BOOKING} points per booking`
        );
    }

    if (this.starts_at && this.ends_at && this.starts_at >= this.ends_at) {
        this.invalidate('ends_at', 'End time must be after start time');
    }

    next();
});

feedbackRewardRuleSchema.methods.toJSON = function () {
    const rule = this.toObject();

    delete rule.__v;

    return rule;
};

const FeedbackRewardRule = mongoose.model('FeedbackRewardRule', feedbackRewardRuleSchema);

module.exports = FeedbackRewardRule;
