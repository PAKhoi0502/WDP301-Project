const mongoose = require('mongoose');

const customerBookingViolationSchema = new mongoose.Schema(
    {
        customer_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Customer is required'],
            unique: true,
        },

        violation_score: {
            type: Number,
            min: [0, 'Violation score must be greater than or equal to 0'],
            default: 0,
        },

        booking_blocked_until: {
            type: Date,
            default: null,
        },

        booking_block_count: {
            type: Number,
            min: [0, 'Booking block count must be greater than or equal to 0'],
            default: 0,
        },

        last_violation_at: {
            type: Date,
            default: null,
        },

        last_event_at: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
        collection: 'customer_booking_violations',
    }
);

customerBookingViolationSchema.index({ violation_score: -1 });
customerBookingViolationSchema.index({ booking_blocked_until: 1 });
customerBookingViolationSchema.index({ last_violation_at: -1 });

customerBookingViolationSchema.methods.toJSON = function () {
    const violation = this.toObject();

    delete violation.__v;

    return violation;
};

const CustomerBookingViolation = mongoose.model('CustomerBookingViolation', customerBookingViolationSchema);

module.exports = CustomerBookingViolation;
