const mongoose = require('mongoose');
const {
    BOOKING_VIOLATION_ADJUSTMENT_TYPE_VALUES,
} = require('./bookingViolation.constant');

const bookingViolationAdjustmentSchema = new mongoose.Schema(
    {
        customer_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Customer is required'],
        },
        type: {
            type: String,
            enum: BOOKING_VIOLATION_ADJUSTMENT_TYPE_VALUES,
            required: [true, 'Adjustment type is required'],
        },
        score_change: {
            type: Number,
            required: [true, 'Score change is required'],
        },
        score_before: {
            type: Number,
            min: 0,
            required: [true, 'Score before is required'],
        },
        score_after: {
            type: Number,
            min: 0,
            required: [true, 'Score after is required'],
        },
        reason: {
            type: String,
            trim: true,
            minlength: [5, 'Reason must be at least 5 characters'],
            maxlength: [1000, 'Reason must not exceed 1000 characters'],
            required: [true, 'Reason is required'],
        },
        reference_id: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },
        created_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: false,
        },
        collection: 'booking_violation_adjustments',
    }
);

bookingViolationAdjustmentSchema.index({ customer_id: 1, created_at: -1 });
bookingViolationAdjustmentSchema.index({ type: 1, created_at: -1 });

module.exports = mongoose.model('BookingViolationAdjustment', bookingViolationAdjustmentSchema);
