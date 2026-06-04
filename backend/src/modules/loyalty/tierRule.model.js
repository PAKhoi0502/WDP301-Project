const mongoose = require('mongoose');

const {
    LOYALTY_TIER_VALUES,
} = require('../../shared/constants/loyalty.constant');

const tierRuleSchema = new mongoose.Schema(
    {
        tier_name: {
            type: String,
            enum: LOYALTY_TIER_VALUES,
            required: [true, 'Tier name is required'],
            unique: true,
        },

        booking_window_days: {
            type: Number,
            min: [1, 'Booking window days must be at least 1'],
            required: [true, 'Booking window days are required'],
        },

        max_upcoming_bookings: {
            type: Number,
            min: [1, 'Max upcoming bookings must be at least 1'],
            required: [true, 'Max upcoming bookings are required'],
        },

        point_multiplier: {
            type: Number,
            min: [0, 'Point multiplier must be greater than or equal to 0'],
            required: [true, 'Point multiplier is required'],
        },

        priority_level: {
            type: Number,
            min: [1, 'Priority level must be at least 1'],
            required: [true, 'Priority level is required'],
        },

        min_total_spent: {
            type: Number,
            min: [0, 'Min total spent must be greater than or equal to 0'],
            default: 0,
        },

        min_total_visits: {
            type: Number,
            min: [0, 'Min total visits must be greater than or equal to 0'],
            default: 0,
        },

        min_total_points: {
            type: Number,
            min: [0, 'Min total points must be greater than or equal to 0'],
            default: 0,
        },

        is_active: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
        collection: 'tier_rules',
    }
);

tierRuleSchema.index({ is_active: 1, priority_level: -1 });
tierRuleSchema.index({ created_at: -1 });

tierRuleSchema.methods.toJSON = function () {
    const tierRule = this.toObject();

    delete tierRule.__v;

    return tierRule;
};

const TierRule = mongoose.model('TierRule', tierRuleSchema);

module.exports = TierRule;
