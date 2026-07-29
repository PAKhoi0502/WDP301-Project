const mongoose = require('mongoose');
const {
    BOOKING_VIOLATION_APPEAL_STATUSES,
    BOOKING_VIOLATION_APPEAL_STATUS_VALUES,
} = require('./bookingViolation.constant');

const bookingViolationAppealSchema = new mongoose.Schema(
    {
        customer_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Customer is required'],
        },
        event_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'BookingViolationEvent',
            required: [true, 'Violation event is required'],
            unique: true,
        },
        reason: {
            type: String,
            trim: true,
            minlength: [10, 'Appeal reason must be at least 10 characters'],
            maxlength: [1000, 'Appeal reason must not exceed 1000 characters'],
            required: [true, 'Appeal reason is required'],
        },
        status: {
            type: String,
            enum: BOOKING_VIOLATION_APPEAL_STATUS_VALUES,
            default: BOOKING_VIOLATION_APPEAL_STATUSES.PENDING,
            required: true,
        },
        admin_note: {
            type: String,
            trim: true,
            maxlength: [1000, 'Admin note must not exceed 1000 characters'],
            default: null,
        },
        reviewed_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        reviewed_at: {
            type: Date,
            default: null,
        },
        resolution_score_change: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
        collection: 'booking_violation_appeals',
    }
);

bookingViolationAppealSchema.index({ status: 1, created_at: -1 });
bookingViolationAppealSchema.index({ customer_id: 1, created_at: -1 });

module.exports = mongoose.model('BookingViolationAppeal', bookingViolationAppealSchema);
