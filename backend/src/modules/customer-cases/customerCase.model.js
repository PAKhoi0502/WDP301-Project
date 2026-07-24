const mongoose = require('mongoose');

const {
    CUSTOMER_CASE_CATEGORY_VALUES,
    CUSTOMER_CASE_PRIORITY_VALUES,
    CUSTOMER_CASE_STATUSES,
    CUSTOMER_CASE_STATUS_VALUES,
    CUSTOMER_CASE_SOURCE_VALUES,
    CUSTOMER_CASE_LIABILITY_STATUSES,
    CUSTOMER_CASE_LIABILITY_STATUS_VALUES,
} = require('../../shared/constants/customerCase.constant');

const customerCaseSchema = new mongoose.Schema(
    {
        case_code: {
            type: String,
            required: [true, 'Case code is required'],
            trim: true,
            uppercase: true,
            unique: true,
            maxlength: [30, 'Case code must not exceed 30 characters'],
        },
        booking_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
        handover_id: { type: mongoose.Schema.Types.ObjectId, ref: 'BookingHandover', required: true },
        garage_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Garage', required: true },
        customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        vehicle_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', default: null },
        is_walk_in_case: { type: Boolean, default: false },
        reporter_name: { type: String, trim: true, maxlength: 120, default: null },
        reporter_phone: { type: String, trim: true, maxlength: 20, default: null },
        created_by_staff_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        category: { type: String, enum: CUSTOMER_CASE_CATEGORY_VALUES, required: true },
        priority: { type: String, enum: CUSTOMER_CASE_PRIORITY_VALUES, required: true },
        priority_rank: { type: Number, min: 1, max: 3, required: true },
        open_dedupe_key: {
            type: String,
            trim: true,
            maxlength: [100, 'Open dedupe key must not exceed 100 characters'],
            default: null,
        },
        source: { type: String, enum: CUSTOMER_CASE_SOURCE_VALUES, required: true },
        status: {
            type: String,
            enum: CUSTOMER_CASE_STATUS_VALUES,
            default: CUSTOMER_CASE_STATUSES.SUBMITTED,
        },
        description: {
            type: String,
            required: [true, 'Description is required'],
            trim: true,
            minlength: [10, 'Description must be at least 10 characters'],
            maxlength: [2000, 'Description must not exceed 2000 characters'],
        },
        damage_location: {
            type: String,
            trim: true,
            maxlength: [500, 'Damage location must not exceed 500 characters'],
            default: null,
        },
        desired_resolution: {
            type: String,
            trim: true,
            maxlength: [1000, 'Desired resolution must not exceed 1000 characters'],
            default: null,
        },
        discovered_at: { type: Date, default: Date.now },
        vehicle_received: { type: Boolean, default: false },
        upload_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Upload' }],
        booking_snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
        inspection_snapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
        assigned_to_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        assigned_by_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        assigned_at: { type: Date, default: null },
        acknowledged_by_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        acknowledged_at: { type: Date, default: null },
        first_response_due_at: {
            type: Date,
            default: function () {
                const minutes = { NORMAL: 240, HIGH: 120, CRITICAL: 15 }[this.priority] || 240;
                return new Date(Date.now() + minutes * 60000);
            },
        },
        resolution_due_at: {
            type: Date,
            default: function () {
                const minutes = { NORMAL: 4320, HIGH: 1440, CRITICAL: 240 }[this.priority] || 4320;
                return new Date(Date.now() + minutes * 60000);
            },
        },
        first_response_breached_at: { type: Date, default: null },
        resolution_breached_at: { type: Date, default: null },
        escalation_level: { type: Number, min: 0, max: 3, default: 0 },
        escalated_at: { type: Date, default: null },
        reopen_count: { type: Number, min: 0, default: 0 },
        last_reopened_at: { type: Date, default: null },
        last_reopened_by_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        last_reopen_reason: { type: String, trim: true, maxlength: 2000, default: null },
        liability_status: {
            type: String,
            enum: CUSTOMER_CASE_LIABILITY_STATUS_VALUES,
            default: CUSTOMER_CASE_LIABILITY_STATUSES.UNDETERMINED,
        },
        conclusion: {
            type: String,
            trim: true,
            maxlength: [3000, 'Conclusion must not exceed 3000 characters'],
            default: null,
        },
        resolution_summary: {
            type: String,
            trim: true,
            maxlength: [3000, 'Resolution summary must not exceed 3000 characters'],
            default: null,
        },
        resolved_by_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        resolved_at: { type: Date, default: null },
        closed_by_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        closed_at: { type: Date, default: null },
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        collection: 'customer_cases',
    }
);

customerCaseSchema.index({ customer_id: 1, created_at: -1 });
customerCaseSchema.index({ garage_id: 1, status: 1, priority: 1, created_at: -1 });
customerCaseSchema.index({ booking_id: 1, created_at: -1 });
customerCaseSchema.index({ assigned_to_id: 1, status: 1, created_at: -1 });
customerCaseSchema.index({ status: 1, first_response_due_at: 1 });
customerCaseSchema.index({ status: 1, resolution_due_at: 1 });
customerCaseSchema.index(
    { open_dedupe_key: 1 },
    {
        unique: true,
        partialFilterExpression: { open_dedupe_key: { $type: 'string' } },
    }
);

customerCaseSchema.pre('validate', function (next) {
    if (!this.is_walk_in_case && !this.customer_id) {
        this.invalidate('customer_id', 'Registered customer case requires a customer');
    }

    if (this.is_walk_in_case && (!this.reporter_phone || !this.created_by_staff_id)) {
        this.invalidate('reporter_phone', 'Walk-in case requires reporter and staff information');
    }

    if (
        [
            CUSTOMER_CASE_STATUSES.SUBMITTED,
            CUSTOMER_CASE_STATUSES.ACKNOWLEDGED,
            CUSTOMER_CASE_STATUSES.INVESTIGATING,
        ].includes(this.status)
        && !this.open_dedupe_key
    ) {
        this.invalidate('open_dedupe_key', 'Open dedupe key is required for an open case');
    }

    if ([CUSTOMER_CASE_STATUSES.RESOLVED, CUSTOMER_CASE_STATUSES.CLOSED].includes(this.status)) {
        if (!this.conclusion || !this.resolved_at || !this.resolved_by_id) {
            this.invalidate('conclusion', 'Conclusion and resolution audit fields are required');
        }

        if (this.liability_status === CUSTOMER_CASE_LIABILITY_STATUSES.UNDETERMINED) {
            this.invalidate('liability_status', 'Final liability status is required');
        }
    }

    if (this.status === CUSTOMER_CASE_STATUSES.CLOSED && (!this.closed_at || !this.closed_by_id)) {
        this.invalidate('closed_at', 'Close audit fields are required for a closed case');
    }

    next();
});

customerCaseSchema.methods.toJSON = function () {
    const customerCase = this.toObject();
    delete customerCase.__v;
    return customerCase;
};

module.exports = mongoose.model('CustomerCase', customerCaseSchema);
