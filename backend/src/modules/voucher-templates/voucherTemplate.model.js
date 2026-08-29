const mongoose = require('mongoose');

const {
    CUSTOMER_VOUCHER_TYPE_VALUES,
    CUSTOMER_VOUCHER_TYPES,
} = require('../../shared/constants/customerVoucher.constant');

const voucherTemplateSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Voucher template name is required'],
            trim: true,
            minlength: [2, 'Voucher template name must be at least 2 characters'],
            maxlength: [150, 'Voucher template name must not exceed 150 characters'],
        },

        description: {
            type: String,
            trim: true,
            maxlength: [2000, 'Description must not exceed 2000 characters'],
            default: null,
        },

        voucher_type: {
            type: String,
            enum: CUSTOMER_VOUCHER_TYPE_VALUES,
            required: [true, 'Voucher type is required'],
        },

        value: {
            type: Number,
            min: [0, 'Voucher value must be greater than or equal to 0'],
            required: [true, 'Voucher value is required'],
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

        service_package_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ServicePackage',
            default: null,
        },

        points_cost: {
            type: Number,
            required: [true, 'Points cost is required'],
            min: [1, 'Points cost must be at least 1'],
        },

        voucher_validity_days: {
            type: Number,
            required: [true, 'Voucher validity days is required'],
            min: [1, 'Voucher validity days must be at least 1'],
        },

        total_quantity: {
            type: Number,
            min: [1, 'Total quantity must be at least 1'],
            default: null,
        },

        redeemed_count: {
            type: Number,
            min: [0, 'Redeemed count must be greater than or equal to 0'],
            default: 0,
        },

        per_customer_limit: {
            type: Number,
            min: [1, 'Per customer limit must be at least 1'],
            default: null,
        },

        applicable_tiers: {
            type: [
                {
                    type: String,
                    trim: true,
                    uppercase: true,
                    minlength: [1, 'Applicable tier name cannot be empty'],
                },
            ],
            default: [],
        },

        start_at: {
            type: Date,
            required: [true, 'Voucher template start time is required'],
        },

        end_at: {
            type: Date,
            required: [true, 'Voucher template end time is required'],
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
        collection: 'voucher_templates',
    }
);

voucherTemplateSchema.index({ is_active: 1, start_at: 1, end_at: 1 });
voucherTemplateSchema.index({ applicable_tiers: 1 });
voucherTemplateSchema.index({ points_cost: 1 });
voucherTemplateSchema.index({ created_at: -1 });

voucherTemplateSchema.pre('validate', function (next) {
    if (this.start_at && this.end_at && this.start_at >= this.end_at) {
        this.invalidate('end_at', 'End time must be after start time');
    }

    if (this.voucher_type === CUSTOMER_VOUCHER_TYPES.PERCENTAGE && this.value > 100) {
        this.invalidate('value', 'Percentage voucher value must not exceed 100');
    }

    if (this.voucher_type === CUSTOMER_VOUCHER_TYPES.FREE_SERVICE && !this.service_package_id) {
        this.invalidate('service_package_id', 'Free service voucher template requires a service package');
    }

    if (this.voucher_type === CUSTOMER_VOUCHER_TYPES.FREE_SERVICE && this.value !== 0) {
        this.invalidate('value', 'Free service voucher template value must be 0');
    }

    if (this.voucher_type !== CUSTOMER_VOUCHER_TYPES.FREE_SERVICE && this.value <= 0) {
        this.invalidate('value', 'Voucher template value must be greater than 0');
    }

    if (this.max_discount_amount === undefined) {
        this.max_discount_amount = null;
    }

    if (this.total_quantity === undefined) {
        this.total_quantity = null;
    }

    if (this.per_customer_limit === undefined) {
        this.per_customer_limit = null;
    }

    if (this.total_quantity !== null && this.redeemed_count > this.total_quantity) {
        this.invalidate('total_quantity', 'Total quantity cannot be lower than the number already redeemed');
    }

    next();
});

voucherTemplateSchema.methods.toJSON = function () {
    const voucherTemplate = this.toObject();

    delete voucherTemplate.__v;

    return voucherTemplate;
};

const VoucherTemplate = mongoose.model('VoucherTemplate', voucherTemplateSchema);

module.exports = VoucherTemplate;
