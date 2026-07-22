const mongoose = require('mongoose');

const { STAFF_TYPE_VALUES } = require('../../shared/constants/staff.constant');
const { USER_ROLES } = require('../../shared/constants/roles.constant');
const {
    STAFF_TYPE_CHANGE_STATUS,
    STAFF_TYPE_CHANGE_STATUS_VALUES,
    STAFF_TYPE_CHANGE_ACTIVE_STATUSES,
    STAFF_TYPE_CHANGE_REQUEST_SOURCES,
    STAFF_TYPE_CHANGE_REQUEST_SOURCE_VALUES,
} = require('../../shared/constants/staffTypeChange.constant');

const staffTypeChangeSchema = new mongoose.Schema(
    {
        staff_profile_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'StaffProfile',
            required: [true, 'Staff profile is required'],
        },
        from_staff_type: {
            type: String,
            enum: STAFF_TYPE_VALUES,
            required: [true, 'Current staff type is required'],
        },
        to_staff_type: {
            type: String,
            enum: STAFF_TYPE_VALUES,
            required: [true, 'Target staff type is required'],
        },
        from_garage_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Garage',
            default: null,
        },
        to_garage_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Garage',
            default: null,
        },
        reason: {
            type: String,
            required: [true, 'Change reason is required'],
            trim: true,
            minlength: [5, 'Change reason must be at least 5 characters'],
            maxlength: [1000, 'Change reason must not exceed 1000 characters'],
        },
        effective_at: {
            type: Date,
            required: [true, 'Effective time is required'],
        },
        status: {
            type: String,
            enum: STAFF_TYPE_CHANGE_STATUS_VALUES,
            default: STAFF_TYPE_CHANGE_STATUS.REQUESTED,
        },
        is_open: {
            type: Boolean,
            default: true,
        },
        requested_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Requester is required'],
        },
        request_source: {
            type: String,
            enum: STAFF_TYPE_CHANGE_REQUEST_SOURCE_VALUES,
            default: STAFF_TYPE_CHANGE_REQUEST_SOURCES.STAFF_SELF_REQUEST,
            required: [true, 'Request source is required'],
        },
        requested_by_role: {
            type: String,
            enum: [USER_ROLES.STAFF, USER_ROLES.ADMIN],
            default: USER_ROLES.STAFF,
            required: [true, 'Requester role is required'],
        },
        approved_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        approved_at: {
            type: Date,
            default: null,
        },
        applied_at: {
            type: Date,
            default: null,
        },
        rejected_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        rejected_at: {
            type: Date,
            default: null,
        },
        cancelled_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        cancelled_at: {
            type: Date,
            default: null,
        },
        decision_reason: {
            type: String,
            trim: true,
            maxlength: [1000, 'Decision reason must not exceed 1000 characters'],
            default: null,
        },
        handover_note: {
            type: String,
            trim: true,
            maxlength: [2000, 'Handover note must not exceed 2000 characters'],
            default: null,
        },
        emergency_override: {
            type: Boolean,
            default: false,
        },
        override_reason: {
            type: String,
            trim: true,
            maxlength: [1000, 'Override reason must not exceed 1000 characters'],
            default: null,
        },
        impact_snapshot: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },
        failure_reason: {
            type: String,
            trim: true,
            maxlength: [1000, 'Failure reason must not exceed 1000 characters'],
            default: null,
        },
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
        collection: 'staff_type_change_requests',
    }
);

staffTypeChangeSchema.index({ staff_profile_id: 1, created_at: -1 });
staffTypeChangeSchema.index({ status: 1, effective_at: 1 });
staffTypeChangeSchema.index(
    { staff_profile_id: 1 },
    {
        unique: true,
        partialFilterExpression: {
            is_open: true,
        },
    }
);

staffTypeChangeSchema.pre('validate', function (next) {
    this.is_open = STAFF_TYPE_CHANGE_ACTIVE_STATUSES.includes(this.status);

    if (this.from_staff_type === this.to_staff_type) {
        this.invalidate('to_staff_type', 'Target staff type must be different');
    }

    next();
});

staffTypeChangeSchema.methods.toJSON = function () {
    const request = this.toObject();

    delete request.__v;

    return request;
};

module.exports = mongoose.model('StaffTypeChangeRequest', staffTypeChangeSchema);
