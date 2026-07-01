const mongoose = require('mongoose');

const {
    STAFF_EMPLOYMENT_STATUS,
    STAFF_EMPLOYMENT_STATUS_VALUES,
    STAFF_TYPE_VALUES,
} = require('../../shared/constants/staff.constant');

const staffProfileSchema = new mongoose.Schema(
    {
        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User is required'],
        },

        staff_code: {
            type: String,
            required: [true, 'Staff code is required'],
            trim: true,
            uppercase: true,
            minlength: [2, 'Staff code must be at least 2 characters'],
            maxlength: [30, 'Staff code must not exceed 30 characters'],
        },

        staff_type: {
            type: String,
            enum: STAFF_TYPE_VALUES,
            required: [true, 'Staff type is required'],
        },

        garage_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Garage',
            default: null,
        },

        is_active: {
            type: Boolean,
            default: true,
        },

        employment_status: {
            type: String,
            enum: STAFF_EMPLOYMENT_STATUS_VALUES,
            default: STAFF_EMPLOYMENT_STATUS.ACTIVE,
        },

        status_reason: {
            type: String,
            trim: true,
            maxlength: [500, 'Status reason must not exceed 500 characters'],
            default: null,
        },

        suspended_at: {
            type: Date,
            default: null,
        },

        terminated_at: {
            type: Date,
            default: null,
        },

        status_changed_at: {
            type: Date,
            default: null,
        },

        status_changed_by: {
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
        collection: 'staff_profiles',
    }
);

staffProfileSchema.index({ user_id: 1 }, { unique: true });
staffProfileSchema.index({ staff_code: 1 }, { unique: true });
staffProfileSchema.index({ staff_type: 1 });
staffProfileSchema.index({ garage_id: 1 });
staffProfileSchema.index({ is_active: 1 });
staffProfileSchema.index({ employment_status: 1 });

staffProfileSchema.methods.toJSON = function () {
    const staffProfile = this.toObject();

    delete staffProfile.__v;

    return staffProfile;
};

const StaffProfile = mongoose.model('StaffProfile', staffProfileSchema);

module.exports = StaffProfile;
