const mongoose = require('mongoose');

const {
    CUSTOMER_CASE_RESOLUTION_STATUSES,
    CUSTOMER_CASE_RESOLUTION_STATUS_VALUES,
    CUSTOMER_CASE_RESOLUTION_ACTION_TYPE_VALUES,
    CUSTOMER_CASE_RESOLUTION_ACTION_TYPES,
    CUSTOMER_CASE_REFUND_METHOD_VALUES,
} = require('../../shared/constants/customerCase.constant');
const { CUSTOMER_VOUCHER_TYPE_VALUES } = require('../../shared/constants/customerVoucher.constant');

const actionSchema = new mongoose.Schema({
    action_type: { type: String, enum: CUSTOMER_CASE_RESOLUTION_ACTION_TYPE_VALUES, required: true },
    amount: { type: Number, min: 0, default: null },
    refund_method: { type: String, enum: [...CUSTOMER_CASE_REFUND_METHOD_VALUES, null], default: null },
    voucher_type: { type: String, enum: [...CUSTOMER_VOUCHER_TYPE_VALUES, null], default: null },
    value: { type: Number, min: 0, default: null },
    max_discount_amount: { type: Number, min: 0, default: null },
    min_order_amount: { type: Number, min: 0, default: 0 },
    service_package_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ServicePackage', default: null },
    expires_at: { type: Date, default: null },
    rework_start_time: { type: Date, default: null },
    note: { type: String, trim: true, maxlength: 1000, default: null },
}, { _id: true });

const schema = new mongoose.Schema({
    case_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerCase', required: true },
    version: { type: Number, min: 1, required: true },
    status: {
        type: String,
        enum: CUSTOMER_CASE_RESOLUTION_STATUS_VALUES,
        default: CUSTOMER_CASE_RESOLUTION_STATUSES.PROPOSED,
    },
    summary: { type: String, trim: true, minlength: 10, maxlength: 3000, required: true },
    actions: { type: [actionSchema], default: [] },
    proposed_by_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    proposed_at: { type: Date, required: true },
    customer_responded_by_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    customer_response_note: { type: String, trim: true, maxlength: 2000, default: null },
    customer_responded_at: { type: Date, default: null },
    applied_by_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    applied_at: { type: Date, default: null },
    failure_reason: { type: String, trim: true, maxlength: 2000, default: null },
    refund_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CustomerCaseRefund' }],
    voucher_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CustomerVoucher' }],
    rework_booking_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }],
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'customer_case_resolutions',
});

schema.index({ case_id: 1, version: -1 }, { unique: true });
schema.index({ case_id: 1, status: 1 });

schema.pre('validate', function (next) {
    if (!this.actions?.length || this.actions.length > 3) {
        this.invalidate('actions', 'Resolution requires between one and three actions');
    } else {
        const actionTypes = this.actions.map((action) => action.action_type);
        if (new Set(actionTypes).size !== actionTypes.length) {
            this.invalidate('actions', 'Resolution action types must be unique');
        }
        if (actionTypes.includes(CUSTOMER_CASE_RESOLUTION_ACTION_TYPES.NO_COMPENSATION) && this.actions.length > 1) {
            this.invalidate('actions', 'No-compensation cannot be combined with another action');
        }
        if (
            actionTypes.includes(CUSTOMER_CASE_RESOLUTION_ACTION_TYPES.REFUND)
            && actionTypes.includes(CUSTOMER_CASE_RESOLUTION_ACTION_TYPES.WAIVE_CHARGE)
        ) {
            this.invalidate('actions', 'Refund and charge waiver cannot be combined');
        }
        this.actions.forEach((action) => {
            if (action.action_type === CUSTOMER_CASE_RESOLUTION_ACTION_TYPES.REFUND
                && (!action.amount || !action.refund_method)) {
                this.invalidate('actions', 'Refund action requires amount and method');
            }
            if (action.action_type === CUSTOMER_CASE_RESOLUTION_ACTION_TYPES.VOUCHER
                && (!action.voucher_type || !action.expires_at)) {
                this.invalidate('actions', 'Voucher action configuration is incomplete');
            }
            if (action.action_type === CUSTOMER_CASE_RESOLUTION_ACTION_TYPES.REWORK
                && !action.rework_start_time) {
                this.invalidate('actions', 'Rework action requires a start time');
            }
            if (
                action.action_type === CUSTOMER_CASE_RESOLUTION_ACTION_TYPES.WAIVE_CHARGE
                && !action.amount
            ) {
                this.invalidate('actions', 'Charge waiver action requires an amount');
            }
        });
    }
    if ([
        CUSTOMER_CASE_RESOLUTION_STATUSES.CUSTOMER_ACCEPTED,
        CUSTOMER_CASE_RESOLUTION_STATUSES.CUSTOMER_REJECTED,
    ].includes(this.status) && !this.customer_responded_at) {
        this.invalidate('customer_responded_at', 'Customer response audit time is required');
    }
    if (this.status === CUSTOMER_CASE_RESOLUTION_STATUSES.APPLIED
        && (!this.applied_by_id || !this.applied_at)) {
        this.invalidate('applied_at', 'Resolution application audit fields are required');
    }
    next();
});

module.exports = mongoose.model('CustomerCaseResolution', schema);
