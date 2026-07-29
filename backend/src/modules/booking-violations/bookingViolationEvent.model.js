const mongoose = require('mongoose');

const {
    BOOKING_VIOLATION_EVENT_VALUES,
} = require('./bookingViolation.constant');

const bookingViolationEventSchema = new mongoose.Schema(
    {
        booking_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking',
            required: [true, 'Booking is required'],
        },

        customer_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Customer is required'],
        },

        event: {
            type: String,
            enum: BOOKING_VIOLATION_EVENT_VALUES,
            required: [true, 'Booking violation event is required'],
        },

        score_change: {
            type: Number,
            required: [true, 'Score change is required'],
        },

        score_before: {
            type: Number,
            min: [0, 'Score before must be greater than or equal to 0'],
            required: [true, 'Score before is required'],
        },

        score_after: {
            type: Number,
            min: [0, 'Score after must be greater than or equal to 0'],
            required: [true, 'Score after is required'],
        },

        reason: {
            type: String,
            trim: true,
            maxlength: [500, 'Reason must not exceed 500 characters'],
            default: null,
        },

        created_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

        is_reversed: {
            type: Boolean,
            default: false,
        },

        reversed_at: {
            type: Date,
            default: null,
        },

        reversed_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

        reversal_reason: {
            type: String,
            trim: true,
            maxlength: [1000, 'Reversal reason must not exceed 1000 characters'],
            default: null,
        },
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: false,
        },
        collection: 'booking_violation_events',
    }
);

bookingViolationEventSchema.index({ booking_id: 1, event: 1 }, { unique: true });
bookingViolationEventSchema.index({ customer_id: 1, created_at: -1 });
bookingViolationEventSchema.index({ event: 1, created_at: -1 });

bookingViolationEventSchema.methods.toJSON = function () {
    const event = this.toObject();

    delete event.__v;

    return event;
};

const BookingViolationEvent = mongoose.model('BookingViolationEvent', bookingViolationEventSchema);

module.exports = BookingViolationEvent;
