const mongoose = require('mongoose');

const { STAFF_TYPE_VALUES } = require('../../shared/constants/staff.constant');
const { SERVICE_STEP_TYPE_VALUES } = require('../../shared/constants/servicePackage.constant');
const {
    BOOKING_SERVICE_STEP_STATUS,
    BOOKING_SERVICE_STEP_STATUS_VALUES,
} = require('../../shared/constants/bookingServiceStep.constant');

const bookingServiceStepSchema = new mongoose.Schema(
    {
        booking_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking',
            required: [true, 'Booking is required'],
        },

        service_package_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ServicePackage',
            required: [true, 'Service package is required'],
        },

        step_code: {
            type: String,
            required: [true, 'Step code is required'],
            trim: true,
            uppercase: true,
            minlength: [2, 'Step code must be at least 2 characters'],
            maxlength: [80, 'Step code must not exceed 80 characters'],
            match: [/^[A-Z0-9_]+$/, 'Step code is invalid'],
        },

        step_name: {
            type: String,
            required: [true, 'Step name is required'],
            trim: true,
            minlength: [2, 'Step name must be at least 2 characters'],
            maxlength: [150, 'Step name must not exceed 150 characters'],
        },

        order: {
            type: Number,
            required: [true, 'Step order is required'],
            min: [1, 'Step order must be at least 1'],
        },

        step_type: {
            type: String,
            enum: SERVICE_STEP_TYPE_VALUES,
            required: [true, 'Step type is required'],
        },

        is_required: {
            type: Boolean,
            default: true,
        },

        display_staff_type: {
            type: String,
            enum: STAFF_TYPE_VALUES,
            default: null,
        },

        assigned_staff_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

        confirmed_by_staff_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

        status: {
            type: String,
            enum: BOOKING_SERVICE_STEP_STATUS_VALUES,
            default: BOOKING_SERVICE_STEP_STATUS.PENDING,
        },

        instructions: {
            type: [String],
            default: [],
            validate: {
                validator(value) {
                    return value.every((item) => typeof item === 'string' && item.trim().length > 0 && item.trim().length <= 500);
                },
                message: 'Instructions are invalid',
            },
        },

        started_at: {
            type: Date,
            default: null,
        },

        completed_at: {
            type: Date,
            default: null,
        },

        note: {
            type: String,
            trim: true,
            maxlength: [1000, 'Note must not exceed 1000 characters'],
            default: null,
        },
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
        collection: 'booking_service_steps',
    }
);

bookingServiceStepSchema.index({ booking_id: 1, order: 1 }, { unique: true });
bookingServiceStepSchema.index({ booking_id: 1, step_code: 1 }, { unique: true });
bookingServiceStepSchema.index({ booking_id: 1, status: 1 });
bookingServiceStepSchema.index({ service_package_id: 1 });
bookingServiceStepSchema.index({ assigned_staff_id: 1 });
bookingServiceStepSchema.index({ confirmed_by_staff_id: 1 });
bookingServiceStepSchema.index({ created_at: -1 });

bookingServiceStepSchema.pre('validate', function (next) {
    if (this.status === BOOKING_SERVICE_STEP_STATUS.DONE && !this.completed_at) {
        this.completed_at = new Date();
    }

    if (this.status === BOOKING_SERVICE_STEP_STATUS.IN_PROGRESS && !this.started_at) {
        this.started_at = new Date();
    }

    next();
});

bookingServiceStepSchema.methods.toJSON = function () {
    const step = this.toObject();

    delete step.__v;

    return step;
};

const BookingServiceStep = mongoose.model('BookingServiceStep', bookingServiceStepSchema);

module.exports = BookingServiceStep;
