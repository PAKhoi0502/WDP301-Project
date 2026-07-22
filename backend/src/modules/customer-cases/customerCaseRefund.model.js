const mongoose = require('mongoose');

const {
    CUSTOMER_CASE_REFUND_METHOD_VALUES,
    CUSTOMER_CASE_REFUND_STATUSES,
    CUSTOMER_CASE_REFUND_STATUS_VALUES,
} = require('../../shared/constants/customerCase.constant');

const schema = new mongoose.Schema({
    case_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerCase', required: true },
    resolution_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerCaseResolution', required: true },
    booking_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    amount: { type: Number, min: 1, required: true },
    method: { type: String, enum: CUSTOMER_CASE_REFUND_METHOD_VALUES, required: true },
    status: {
        type: String,
        enum: CUSTOMER_CASE_REFUND_STATUS_VALUES,
        default: CUSTOMER_CASE_REFUND_STATUSES.APPROVED,
    },
    approved_by_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    approved_at: { type: Date, required: true },
    processed_by_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    processed_at: { type: Date, default: null },
    transaction_reference: { type: String, trim: true, maxlength: 200, default: null },
    note: { type: String, trim: true, maxlength: 2000, default: null },
    failure_reason: { type: String, trim: true, maxlength: 2000, default: null },
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'customer_case_refunds',
});

schema.index({ case_id: 1, created_at: -1 });
schema.index({ resolution_id: 1 }, { unique: true });
schema.index({ booking_id: 1, status: 1 });

schema.pre('validate', function (next) {
    if (this.status === CUSTOMER_CASE_REFUND_STATUSES.COMPLETED && !this.transaction_reference) {
        this.invalidate('transaction_reference', 'Completed refund requires a transaction reference');
    }
    if (this.status === CUSTOMER_CASE_REFUND_STATUSES.FAILED && !this.failure_reason) {
        this.invalidate('failure_reason', 'Failed refund requires a failure reason');
    }
    next();
});

module.exports = mongoose.model('CustomerCaseRefund', schema);
