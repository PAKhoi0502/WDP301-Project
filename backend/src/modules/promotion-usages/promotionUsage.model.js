const mongoose = require('mongoose');

const promotionUsageSchema = new mongoose.Schema(
    {
        promotion_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Promotion',
            required: [true, 'Promotion is required'],
        },

        booking_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking',
            required: [true, 'Booking is required'],
            unique: true,
        },

        customer_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

        used_by_staff_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

        discount_amount: {
            type: Number,
            min: [0, 'Discount amount must be greater than or equal to 0'],
            default: 0,
        },

        used_at: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
        collection: 'promotion_usages',
    }
);

promotionUsageSchema.index({ promotion_id: 1, used_at: -1 });
promotionUsageSchema.index({ customer_id: 1, promotion_id: 1 });
promotionUsageSchema.index({ used_by_staff_id: 1 });
promotionUsageSchema.index({ created_at: -1 });

promotionUsageSchema.methods.toJSON = function () {
    const usage = this.toObject();

    delete usage.__v;

    return usage;
};

const PromotionUsage = mongoose.model('PromotionUsage', promotionUsageSchema);

module.exports = PromotionUsage;
