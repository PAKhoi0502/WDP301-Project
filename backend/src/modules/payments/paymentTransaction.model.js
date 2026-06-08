const mongoose = require('mongoose');

const {
    PAYMENT_PROVIDER,
    PAYMENT_PROVIDER_VALUES,
    PAYMENT_METHOD,
    PAYMENT_METHOD_VALUES,
    PAYMENT_TRANSACTION_STATUS,
    PAYMENT_TRANSACTION_STATUS_VALUES,
    PAYMENT_CURRENCY,
    PAYMENT_CURRENCY_VALUES,
} = require('../../shared/constants/payment.constant');

const paymentTransactionSchema = new mongoose.Schema(
    {
        booking_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking',
            required: [true, 'Booking is required'],
        },

        provider: {
            type: String,
            enum: PAYMENT_PROVIDER_VALUES,
            default: PAYMENT_PROVIDER.PAYOS,
            required: [true, 'Payment provider is required'],
        },

        method: {
            type: String,
            enum: PAYMENT_METHOD_VALUES,
            default: PAYMENT_METHOD.QR,
            required: [true, 'Payment method is required'],
        },

        order_code: {
            type: Number,
            required: [true, 'Order code is required'],
            unique: true,
            min: [1, 'Order code must be greater than 0'],
        },

        payment_link_id: {
            type: String,
            trim: true,
            default: null,
            unique: true,
            sparse: true,
        },

        checkout_url: {
            type: String,
            trim: true,
            default: null,
        },

        qr_code: {
            type: String,
            trim: true,
            default: null,
        },

        amount: {
            type: Number,
            required: [true, 'Amount is required'],
            min: [1, 'Amount must be greater than 0'],
        },

        currency: {
            type: String,
            enum: PAYMENT_CURRENCY_VALUES,
            default: PAYMENT_CURRENCY.VND,
            required: [true, 'Currency is required'],
        },

        description: {
            type: String,
            trim: true,
            maxlength: [255, 'Description must not exceed 255 characters'],
            required: [true, 'Description is required'],
        },

        status: {
            type: String,
            enum: PAYMENT_TRANSACTION_STATUS_VALUES,
            default: PAYMENT_TRANSACTION_STATUS.PENDING,
        },

        paid_at: {
            type: Date,
            default: null,
        },

        expires_at: {
            type: Date,
            default: null,
        },

        canceled_at: {
            type: Date,
            default: null,
        },

        expired_at: {
            type: Date,
            default: null,
        },

        created_by_staff_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

        raw_webhook: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
        collection: 'payment_transactions',
    }
);

paymentTransactionSchema.index({ booking_id: 1, created_at: -1 });
paymentTransactionSchema.index({ status: 1, created_at: -1 });
paymentTransactionSchema.index({ status: 1, expires_at: 1 });
paymentTransactionSchema.index({ provider: 1, status: 1 });
paymentTransactionSchema.index({ order_code: 1, payment_link_id: 1 });
paymentTransactionSchema.index({ created_by_staff_id: 1 });

paymentTransactionSchema.pre('validate', function (next) {
    if (!Number.isSafeInteger(this.order_code)) {
        this.invalidate('order_code', 'Order code must be a safe integer');
    }

    if (!Number.isInteger(this.amount)) {
        this.invalidate('amount', 'Amount must be an integer');
    }

    if ([PAYMENT_TRANSACTION_STATUS.PENDING, PAYMENT_TRANSACTION_STATUS.CANCELING, PAYMENT_TRANSACTION_STATUS.PAID].includes(this.status) && !this.payment_link_id) {
        this.invalidate('payment_link_id', 'Active PayOS transaction requires payment link id');
    }

    if (this.status === PAYMENT_TRANSACTION_STATUS.PENDING) {
        if (!this.checkout_url) {
            this.invalidate('checkout_url', 'Active PayOS transaction requires checkout url');
        }

        if (!this.qr_code) {
            this.invalidate('qr_code', 'Active PayOS transaction requires QR code');
        }
    }

    if (this.status === PAYMENT_TRANSACTION_STATUS.PAID && !this.paid_at) {
        this.invalidate('paid_at', 'Paid transaction requires paid at');
    }

    if (this.status === PAYMENT_TRANSACTION_STATUS.CANCELED && !this.canceled_at) {
        this.invalidate('canceled_at', 'Canceled transaction requires canceled at');
    }

    if (this.status === PAYMENT_TRANSACTION_STATUS.EXPIRED && !this.expired_at) {
        this.invalidate('expired_at', 'Expired transaction requires expired at');
    }

    next();
});

paymentTransactionSchema.methods.toJSON = function () {
    const paymentTransaction = this.toObject();

    delete paymentTransaction.__v;

    return paymentTransaction;
};

const PaymentTransaction = mongoose.model('PaymentTransaction', paymentTransactionSchema);

module.exports = PaymentTransaction;
