const mongoose = require('mongoose');

const { VEHICLE_TYPE_VALUES } = require('../../shared/constants/vehicle.constant');
const { LOYALTY_TIER_VALUES } = require('../../shared/constants/loyalty.constant');
const {
    PROMOTION_DISCOUNT_TYPES,
    PROMOTION_DISCOUNT_TYPE_VALUES,
} = require('../../shared/constants/promotion.constant');

const promotionSchema = new mongoose.Schema(
    {
        code: {
            type: String,
            required: [true, 'Promotion code is required'],
            trim: true,
            uppercase: true,
            minlength: [2, 'Promotion code must be at least 2 characters'],
            maxlength: [40, 'Promotion code must not exceed 40 characters'],
            match: [/^[A-Z0-9_]+$/, 'Promotion code is invalid'],
            unique: true,
        },

        name: {
            type: String,
            required: [true, 'Promotion name is required'],
            trim: true,
            minlength: [2, 'Promotion name must be at least 2 characters'],
            maxlength: [150, 'Promotion name must not exceed 150 characters'],
        },

        description: {
            type: String,
            trim: true,
            maxlength: [2000, 'Description must not exceed 2000 characters'],
            default: null,
        },

        discount_type: {
            type: String,
            enum: PROMOTION_DISCOUNT_TYPE_VALUES,
            required: [true, 'Discount type is required'],
        },

        discount_value: {
            type: Number,
            required: [true, 'Discount value is required'],
            min: [0, 'Discount value must be greater than 0'],
        },

        max_discount_amount: {
            type: Number,
            min: [0, 'Max discount amount must be greater than or equal to 0'],
            default: null,
        },

        min_order_amount: {
            type: Number,
            min: [0, 'Min order amount must be greater than or equal to 0'],
            default: 0,
        },

        applicable_tiers: {
            type: [String],
            enum: LOYALTY_TIER_VALUES,
            default: [],
        },

        applicable_vehicle_types: {
            type: [String],
            enum: VEHICLE_TYPE_VALUES,
            default: [],
        },

        applicable_service_package_ids: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'ServicePackage',
            },
        ],

        start_at: {
            type: Date,
            required: [true, 'Promotion start time is required'],
        },

        end_at: {
            type: Date,
            required: [true, 'Promotion end time is required'],
        },

        usage_limit: {
            type: Number,
            min: [1, 'Usage limit must be at least 1'],
            default: null,
        },

        per_customer_limit: {
            type: Number,
            min: [1, 'Per customer limit must be at least 1'],
            default: null,
        },

        used_count: {
            type: Number,
            min: [0, 'Used count must be greater than or equal to 0'],
            default: 0,
        },

        is_active: {
            type: Boolean,
            default: true,
        },

        created_by_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

        updated_by_id: {
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
        collection: 'promotions',
    }
);

promotionSchema.index({ code: 1 }, { unique: true });
promotionSchema.index({ is_active: 1, start_at: 1, end_at: 1 });
promotionSchema.index({ applicable_tiers: 1 });
promotionSchema.index({ applicable_vehicle_types: 1 });
promotionSchema.index({ applicable_service_package_ids: 1 });
promotionSchema.index({ created_at: -1 });

promotionSchema.pre('validate', function (next) {
    if (this.start_at && this.end_at && this.start_at >= this.end_at) {
        this.invalidate('end_at', 'End time must be after start time');
    }

    if (this.discount_type === PROMOTION_DISCOUNT_TYPES.PERCENTAGE && this.discount_value > 100) {
        this.invalidate('discount_value', 'Percentage discount must not exceed 100');
    }

    if (this.max_discount_amount === undefined) {
        this.max_discount_amount = null;
    }

    if (this.usage_limit === undefined) {
        this.usage_limit = null;
    }

    if (this.per_customer_limit === undefined) {
        this.per_customer_limit = null;
    }

    next();
});

promotionSchema.methods.toJSON = function () {
    const promotion = this.toObject();

    delete promotion.__v;

    return promotion;
};

const Promotion = mongoose.model('Promotion', promotionSchema);

module.exports = Promotion;
