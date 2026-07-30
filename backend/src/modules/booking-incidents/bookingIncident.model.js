const mongoose = require('mongoose');

const {
    BOOKING_INCIDENT_TYPES,
    BOOKING_INCIDENT_TYPE_VALUES,
    BOOKING_INCIDENT_STATUS,
    BOOKING_INCIDENT_STATUS_VALUES,
    BOOKING_INCIDENT_DECISION_VALUES,
    BOOKING_INCIDENT_CONTACT_CHANNEL_VALUES,
    BOOKING_INCIDENT_DECISION_SOURCE_VALUES,
    BOOKING_INCIDENT_CONTINUATION_POLICY_VALUES,
} = require('../../shared/constants/bookingIncident.constant');
const { BOOKING_STATUS_VALUES } = require('../../shared/constants/booking.constant');

const bookingIncidentSchema = new mongoose.Schema(
    {
        booking_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking',
            required: [true, 'Booking is required'],
        },

        garage_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Garage',
            required: [true, 'Garage is required'],
        },

        customer_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

        incident_type: {
            type: String,
            enum: BOOKING_INCIDENT_TYPE_VALUES,
            required: [true, 'Incident type is required'],
        },

        description: {
            type: String,
            trim: true,
            maxlength: [1000, 'Incident description must not exceed 1000 characters'],
            default: null,
        },

        status: {
            type: String,
            enum: BOOKING_INCIDENT_STATUS_VALUES,
            default: BOOKING_INCIDENT_STATUS.AWAITING_CUSTOMER_DECISION,
        },

        affected_booking_item_key: {
            type: String,
            trim: true,
            uppercase: true,
            maxlength: [100, 'Affected booking item key must not exceed 100 characters'],
            default: null,
        },

        affected_wash_bay_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'WashBay',
            default: null,
        },

        affected_staff_profile_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'StaffProfile',
            default: null,
        },

        released_booking_item_keys: [
            {
                type: String,
                trim: true,
                uppercase: true,
                maxlength: [100, 'Released booking item key must not exceed 100 characters'],
            },
        ],

        reported_by_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Incident reporter is required'],
        },

        reported_booking_status: {
            type: String,
            enum: BOOKING_STATUS_VALUES,
            required: [true, 'Reported booking status is required'],
        },

        reported_schedule_snapshot: {
            type: mongoose.Schema.Types.Mixed,
            required: [true, 'Reported schedule snapshot is required'],
        },

        countdown_paused_automatically: {
            type: Boolean,
            default: false,
        },

        decision: {
            type: String,
            enum: BOOKING_INCIDENT_DECISION_VALUES,
            default: null,
        },

        decision_source: {
            type: String,
            enum: BOOKING_INCIDENT_DECISION_SOURCE_VALUES,
            default: null,
        },

        contact_channel: {
            type: String,
            enum: BOOKING_INCIDENT_CONTACT_CHANNEL_VALUES,
            default: null,
        },

        customer_note: {
            type: String,
            trim: true,
            maxlength: [1000, 'Customer note must not exceed 1000 characters'],
            default: null,
        },

        new_start_time: {
            type: Date,
            default: null,
        },

        continuation_policy: {
            type: String,
            enum: BOOKING_INCIDENT_CONTINUATION_POLICY_VALUES,
            default: null,
        },

        customer_confirmed_at: {
            type: Date,
            default: null,
        },

        decision_recorded_by_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

        resolved_at: {
            type: Date,
            default: null,
        },

        resolved_by_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

        compensation_voucher_ids: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'CustomerVoucher',
            },
        ],
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
        collection: 'booking_incidents',
    }
);

bookingIncidentSchema.index({ booking_id: 1, created_at: -1 });
bookingIncidentSchema.index({ garage_id: 1, status: 1, created_at: -1 });
bookingIncidentSchema.index(
    { booking_id: 1, status: 1 },
    {
        unique: true,
        partialFilterExpression: {
            status: BOOKING_INCIDENT_STATUS.AWAITING_CUSTOMER_DECISION,
        },
    }
);

bookingIncidentSchema.pre('validate', function (next) {
    if (
        this.incident_type === BOOKING_INCIDENT_TYPES.OTHER_GARAGE_INCIDENT
        && !this.description
    ) {
        this.invalidate('description', 'Description is required for other garage incidents');
    }

    next();
});

bookingIncidentSchema.methods.toJSON = function () {
    const incident = this.toObject();

    delete incident.__v;

    return incident;
};

const BookingIncident = mongoose.model('BookingIncident', bookingIncidentSchema);

module.exports = BookingIncident;
