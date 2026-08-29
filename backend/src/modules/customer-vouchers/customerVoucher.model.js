const mongoose = require('mongoose');

const {
    CUSTOMER_VOUCHER_TYPES,
    CUSTOMER_VOUCHER_TYPE_VALUES,
    CUSTOMER_VOUCHER_STATUS,
    CUSTOMER_VOUCHER_STATUS_VALUES,
    CUSTOMER_VOUCHER_SOURCES,
    CUSTOMER_VOUCHER_SOURCE_VALUES,
} = require('../../shared/constants/customerVoucher.constant');
const { normalizePhone, isValidPhone } = require('../../shared/utils/phone');

const customerVoucherSchema = new mongoose.Schema(
    {
        code: {
            type: String,
            required: [true, 'Voucher code is required'],
            trim: true,
            uppercase: true,
            minlength: [6, 'Voucher code must be at least 6 characters'],
            maxlength: [40, 'Voucher code must not exceed 40 characters'],
            match: [/^[A-Z0-9_]+$/, 'Voucher code is invalid'],
        },

        customer_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

        guest_phone: {
            type: String,
            trim: true,
            maxlength: [20, 'Voucher guest phone must not exceed 20 characters'],
            default: null,
        },

        normalized_guest_phone: {
            type: String,
            trim: true,
            maxlength: [20, 'Voucher normalized guest phone must not exceed 20 characters'],
            default: null,
        },

        garage_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Garage',
            default: null,
        },

        source_type: {
            type: String,
            enum: CUSTOMER_VOUCHER_SOURCE_VALUES,
            default: null,
        },

        source_booking_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking',
            default: null,
        },

        source_incident_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'BookingIncident',
            default: null,
        },

        source_customer_case_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'CustomerCase',
            default: null,
        },

        source_customer_case_resolution_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'CustomerCaseResolution',
            default: null,
        },

        source_voucher_template_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'VoucherTemplate',
            default: null,
        },

        voucher_type: {
            type: String,
            enum: CUSTOMER_VOUCHER_TYPE_VALUES,
            required: [true, 'Voucher type is required'],
        },

        value: {
            type: Number,
            min: [0, 'Voucher value must be greater than 0'],
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

        status: {
            type: String,
            enum: CUSTOMER_VOUCHER_STATUS_VALUES,
            default: CUSTOMER_VOUCHER_STATUS.ISSUED,
        },

        expires_at: {
            type: Date,
            required: [true, 'Voucher expiration time is required'],
        },

        note: {
            type: String,
            trim: true,
            maxlength: [1000, 'Voucher note must not exceed 1000 characters'],
            default: null,
        },

        issued_by_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Voucher issuer is required'],
        },

        approved_by_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

        approved_at: {
            type: Date,
            default: null,
        },

        reserved_booking_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking',
            default: null,
        },

        reserved_at: {
            type: Date,
            default: null,
        },

        used_at: {
            type: Date,
            default: null,
        },

        revoked_at: {
            type: Date,
            default: null,
        },

        revoked_by_id: {
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
        collection: 'customer_vouchers',
    }
);

customerVoucherSchema.index({ code: 1 }, { unique: true });
customerVoucherSchema.index({ customer_id: 1, status: 1, expires_at: 1 });
customerVoucherSchema.index({ normalized_guest_phone: 1, status: 1, expires_at: 1 });
customerVoucherSchema.index({ garage_id: 1, status: 1, created_at: -1 });
customerVoucherSchema.index({ source_type: 1, created_at: -1 });
customerVoucherSchema.index({ source_incident_id: 1, created_at: -1 });
customerVoucherSchema.index({ source_customer_case_id: 1, created_at: -1 });
customerVoucherSchema.index(
    { source_customer_case_resolution_id: 1 },
    { unique: true, partialFilterExpression: { source_customer_case_resolution_id: { $type: 'objectId' } } }
);
customerVoucherSchema.index({ reserved_booking_id: 1 });
customerVoucherSchema.index({ source_voucher_template_id: 1, customer_id: 1 });

customerVoucherSchema.pre('validate', function (next) {
    if (this.guest_phone || this.normalized_guest_phone) {
        const normalizedGuestPhone = normalizePhone(
            this.normalized_guest_phone || this.guest_phone
        );

        if (!isValidPhone(normalizedGuestPhone)) {
            this.invalidate('guest_phone', 'Voucher guest phone is invalid');
        } else {
            this.guest_phone = normalizedGuestPhone;
            this.normalized_guest_phone = normalizedGuestPhone;
        }
    }

    if (Boolean(this.customer_id) === Boolean(this.normalized_guest_phone)) {
        this.invalidate(
            'customer_id',
            'Voucher must belong to exactly one registered customer or guest phone'
        );
    }

    if (!this.source_type) {
        if (this.source_incident_id) {
            this.source_type = CUSTOMER_VOUCHER_SOURCES.INCIDENT;
        } else if (this.source_customer_case_id) {
            this.source_type = CUSTOMER_VOUCHER_SOURCES.CUSTOMER_CASE;
        }
    }

    if (this.source_type === CUSTOMER_VOUCHER_SOURCES.INCIDENT) {
        if (!this.source_booking_id || !this.source_incident_id || this.source_customer_case_id) {
            this.invalidate('source_type', 'Incident voucher source is invalid');
        }
    } else if (this.source_type === CUSTOMER_VOUCHER_SOURCES.CUSTOMER_CASE) {
        if (!this.source_booking_id || !this.source_customer_case_id || this.source_incident_id) {
            this.invalidate('source_type', 'Customer case voucher source is invalid');
        }
    } else if (this.source_type === CUSTOMER_VOUCHER_SOURCES.ADMIN_GIFT) {
        if (
            this.source_booking_id
            || this.source_incident_id
            || this.source_customer_case_id
            || this.source_customer_case_resolution_id
        ) {
            this.invalidate('source_type', 'Admin gift voucher cannot reference a compensation source');
        }
    } else if (this.source_type === CUSTOMER_VOUCHER_SOURCES.POINTS_REDEMPTION) {
        this.garage_id = null;

        if (
            !this.source_voucher_template_id
            || this.source_booking_id
            || this.source_incident_id
            || this.source_customer_case_id
            || this.source_customer_case_resolution_id
        ) {
            this.invalidate('source_type', 'Points redemption voucher must reference a voucher template only');
        }
    } else {
        this.invalidate('source_type', 'Voucher source is required');
    }

    if (this.source_type && this.source_type !== CUSTOMER_VOUCHER_SOURCES.POINTS_REDEMPTION && !this.garage_id) {
        this.invalidate('garage_id', 'Voucher garage is required');
    }

    if (this.voucher_type === CUSTOMER_VOUCHER_TYPES.PERCENTAGE && this.value > 100) {
        this.invalidate('value', 'Percentage voucher value must not exceed 100');
    }

    if (
        this.voucher_type === CUSTOMER_VOUCHER_TYPES.PERCENTAGE
        && this.max_discount_amount !== null
        && this.max_discount_amount <= 0
    ) {
        this.invalidate('max_discount_amount', 'Percentage max discount amount must be greater than 0');
    }

    if (this.voucher_type === CUSTOMER_VOUCHER_TYPES.FREE_SERVICE && !this.service_package_id) {
        this.invalidate('service_package_id', 'Free service voucher requires a service package');
    }

    if (this.voucher_type === CUSTOMER_VOUCHER_TYPES.FREE_SERVICE && this.value !== 0) {
        this.invalidate('value', 'Free service voucher value must be 0');
    }

    if (this.voucher_type !== CUSTOMER_VOUCHER_TYPES.FREE_SERVICE && this.value <= 0) {
        this.invalidate('value', 'Voucher value must be greater than 0');
    }

    next();
});

customerVoucherSchema.methods.toJSON = function () {
    const voucher = this.toObject();

    delete voucher.__v;

    return voucher;
};

const CustomerVoucher = mongoose.model('CustomerVoucher', customerVoucherSchema);

module.exports = CustomerVoucher;
