const mongoose = require('mongoose');

const { VEHICLE_TYPE_VALUES } = require('../../shared/constants/vehicle.constant');
const {
    WAITLIST_STATUS,
    WAITLIST_STATUS_VALUES,
} = require('../../shared/constants/waitlist.constant');

const bookingWaitlistSchema = new mongoose.Schema(
    {
        customer_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Customer is required'],
        },

        vehicle_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Vehicle',
            required: [true, 'Vehicle is required'],
        },

        garage_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Garage',
            required: [true, 'Garage is required'],
        },

        service_package_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ServicePackage',
            required: [true, 'Service package is required'],
        },

        add_on_service_ids: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'ServicePackage',
            },
        ],

        vehicle_type: {
            type: String,
            enum: VEHICLE_TYPE_VALUES,
            required: [true, 'Vehicle type is required'],
        },

        desired_start_time: {
            type: Date,
            required: [true, 'Desired start time is required'],
        },

        status: {
            type: String,
            enum: WAITLIST_STATUS_VALUES,
            default: WAITLIST_STATUS.WAITING,
        },

        offered_at: {
            type: Date,
            default: null,
        },

        offer_expires_at: {
            type: Date,
            default: null,
        },

        accepted_at: {
            type: Date,
            default: null,
        },

        canceled_at: {
            type: Date,
            default: null,
        },

        canceled_by_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

        cancel_reason: {
            type: String,
            trim: true,
            maxlength: [500, 'Cancel reason must not exceed 500 characters'],
            default: null,
        },

        expired_at: {
            type: Date,
            default: null,
        },

        created_booking_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking',
            default: null,
        },

        source_booking_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking',
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
        collection: 'booking_waitlists',
    }
);

bookingWaitlistSchema.index({ customer_id: 1, status: 1, desired_start_time: 1 });
bookingWaitlistSchema.index({ garage_id: 1, service_package_id: 1, vehicle_type: 1, desired_start_time: 1, status: 1 });
bookingWaitlistSchema.index({ source_booking_id: 1 });
bookingWaitlistSchema.index({ created_booking_id: 1 });
bookingWaitlistSchema.index({ created_at: 1 });

bookingWaitlistSchema.pre('validate', function (next) {
    if (this.status === WAITLIST_STATUS.OFFERED && (!this.offered_at || !this.offer_expires_at)) {
        this.invalidate('offered_at', 'Offered waitlist requires offer time and expiration time');
    }

    if (this.status === WAITLIST_STATUS.ACCEPTED && (!this.accepted_at || !this.created_booking_id)) {
        this.invalidate('accepted_at', 'Accepted waitlist requires accepted time and booking');
    }

    if (this.status === WAITLIST_STATUS.CANCELED && !this.canceled_at) {
        this.invalidate('canceled_at', 'Canceled waitlist requires canceled at');
    }

    if (this.status === WAITLIST_STATUS.EXPIRED && !this.expired_at) {
        this.invalidate('expired_at', 'Expired waitlist requires expired at');
    }

    next();
});

bookingWaitlistSchema.methods.toJSON = function () {
    const waitlist = this.toObject();

    delete waitlist.__v;

    return waitlist;
};

const BookingWaitlist = mongoose.model('BookingWaitlist', bookingWaitlistSchema);

module.exports = BookingWaitlist;
