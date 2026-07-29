const mongoose = require('mongoose');

const {
    LOYALTY_TIERS,
    LOYALTY_TIER_VALUES,
} = require('../../shared/constants/loyalty.constant');

const customerLoyaltySchema = new mongoose.Schema(
    {
        customer_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Customer is required'],
            unique: true,
        },

        current_tier: {
            type: String,
            enum: LOYALTY_TIER_VALUES,
            default: LOYALTY_TIERS.BRONZE,
        },

        total_points: {
            type: Number,
            min: [0, 'Total points must be greater than or equal to 0'],
            default: 0,
        },

        qualifying_points: {
            type: Number,
            min: [0, 'Qualifying points must be greater than or equal to 0'],
            default: null,
        },

        bonus_points: {
            type: Number,
            min: [0, 'Bonus points must be greater than or equal to 0'],
            default: 0,
        },

        available_points: {
            type: Number,
            min: [0, 'Available points must be greater than or equal to 0'],
            default: 0,
        },

        redeemed_points: {
            type: Number,
            min: [0, 'Redeemed points must be greater than or equal to 0'],
            default: 0,
        },

        expired_points: {
            type: Number,
            min: [0, 'Expired points must be greater than or equal to 0'],
            default: 0,
        },

        total_spent: {
            type: Number,
            min: [0, 'Total spent must be greater than or equal to 0'],
            default: 0,
        },

        total_visits: {
            type: Number,
            min: [0, 'Total visits must be greater than or equal to 0'],
            default: 0,
        },

        last_visit_at: {
            type: Date,
            default: null,
        },

        last_tier_review_at: {
            type: Date,
            default: null,
        },

        last_tier_downgrade_at: {
            type: Date,
            default: null,
        },

        tier_recovery_started_at: {
            type: Date,
            default: null,
        },

        last_point_expiry_check_at: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
        collection: 'customer_loyalties',
    }
);

customerLoyaltySchema.index({ current_tier: 1 });
customerLoyaltySchema.index({ available_points: -1 });
customerLoyaltySchema.index({ qualifying_points: -1 });
customerLoyaltySchema.index({ total_spent: -1 });
customerLoyaltySchema.index({ total_visits: -1 });
customerLoyaltySchema.index({ last_tier_downgrade_at: 1 });
customerLoyaltySchema.index({ tier_recovery_started_at: 1 });
customerLoyaltySchema.index({ last_visit_at: 1 });
customerLoyaltySchema.index({ created_at: -1 });

customerLoyaltySchema.methods.toJSON = function () {
    const loyalty = this.toObject();

    delete loyalty.__v;

    return loyalty;
};

const CustomerLoyalty = mongoose.model('CustomerLoyalty', customerLoyaltySchema);

module.exports = CustomerLoyalty;
