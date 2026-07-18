const mongoose = require('mongoose');

const {
    BOOKING_HANDOVER_STATES,
    BOOKING_HANDOVER_STATE_VALUES,
    BOOKING_HANDOVER_RESPONSES,
    BOOKING_HANDOVER_RESPONSE_VALUES,
} = require('../../shared/constants/customerCase.constant');

const bookingHandoverSchema = new mongoose.Schema(
    {
        booking_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking',
            required: [true, 'Booking is required'],
            unique: true,
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
        guest_name: { type: String, trim: true, maxlength: 120, default: null },
        guest_phone: { type: String, trim: true, maxlength: 20, default: null },
        vehicle_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Vehicle',
            default: null,
        },
        state: {
            type: String,
            enum: BOOKING_HANDOVER_STATE_VALUES,
            default: BOOKING_HANDOVER_STATES.PENDING,
        },
        customer_response: {
            type: String,
            enum: BOOKING_HANDOVER_RESPONSE_VALUES,
            default: BOOKING_HANDOVER_RESPONSES.PENDING,
        },
        ready_at: { type: Date, default: null },
        ready_by_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        ready_note: {
            type: String,
            trim: true,
            maxlength: [1000, 'Ready note must not exceed 1000 characters'],
            default: null,
        },
        customer_responded_at: { type: Date, default: null },
        accepted_at: { type: Date, default: null },
        released_at: { type: Date, default: null },
        released_by_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        release_note: {
            type: String,
            trim: true,
            maxlength: [1000, 'Release note must not exceed 1000 characters'],
            default: null,
        },
        issue_case_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CustomerCase' }],
        inspection_snapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        collection: 'booking_handovers',
    }
);

bookingHandoverSchema.index({ garage_id: 1, state: 1, created_at: -1 });
bookingHandoverSchema.index({ customer_id: 1, created_at: -1 });

bookingHandoverSchema.pre('validate', function (next) {
    if (this.state === BOOKING_HANDOVER_STATES.READY_FOR_CUSTOMER && !this.ready_at) {
        this.invalidate('ready_at', 'Ready time is required for a ready handover');
    }

    if (this.state === BOOKING_HANDOVER_STATES.RELEASED && !this.released_at) {
        this.invalidate('released_at', 'Release time is required for a released handover');
    }

    if (this.customer_response === BOOKING_HANDOVER_RESPONSES.ACCEPTED && !this.accepted_at) {
        this.invalidate('accepted_at', 'Accepted time is required for an accepted handover');
    }

    if (
        this.customer_response === BOOKING_HANDOVER_RESPONSES.ISSUE_REPORTED
        && (!this.issue_case_ids || this.issue_case_ids.length === 0)
    ) {
        this.invalidate('issue_case_ids', 'At least one customer case is required for a reported issue');
    }

    next();
});

bookingHandoverSchema.methods.toJSON = function () {
    const handover = this.toObject();
    delete handover.__v;
    return handover;
};

module.exports = mongoose.model('BookingHandover', bookingHandoverSchema);
