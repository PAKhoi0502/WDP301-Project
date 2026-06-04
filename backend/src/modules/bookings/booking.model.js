const mongoose = require('mongoose');

const { VEHICLE_TYPE_VALUES } = require('../../shared/constants/vehicle.constant');
const {
    BOOKING_STATUS,
    BOOKING_STATUS_VALUES,
    BOOKING_PAYMENT_METHOD,
    BOOKING_PAYMENT_METHOD_VALUES,
    BOOKING_PAYMENT_STATUS,
    BOOKING_PAYMENT_STATUS_VALUES,
} = require('../../shared/constants/booking.constant');

const bookingSchema = new mongoose.Schema(
    {
        customer_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

        vehicle_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Vehicle',
            default: null,
        },

        is_walk_in: {
            type: Boolean,
            default: false,
        },

        guest_name: {
            type: String,
            trim: true,
            maxlength: [120, 'Guest name must not exceed 120 characters'],
            default: null,
        },

        guest_phone: {
            type: String,
            trim: true,
            maxlength: [20, 'Guest phone must not exceed 20 characters'],
            default: null,
        },

        guest_email: {
            type: String,
            trim: true,
            lowercase: true,
            maxlength: [120, 'Guest email must not exceed 120 characters'],
            default: null,
        },

        license_plate: {
            type: String,
            trim: true,
            maxlength: [30, 'License plate must not exceed 30 characters'],
            default: null,
        },

        normalized_license_plate: {
            type: String,
            uppercase: true,
            trim: true,
            maxlength: [20, 'Normalized license plate must not exceed 20 characters'],
            default: null,
        },

        vehicle_type: {
            type: String,
            enum: VEHICLE_TYPE_VALUES,
            required: [true, 'Vehicle type is required'],
        },

        created_by_staff_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

        garage_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Garage',
            required: [true, 'Garage is required'],
        },

        wash_bay_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'WashBay',
            default: null,
        },

        service_package_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ServicePackage',
            required: [true, 'Service package is required'],
        },

        booking_date: {
            type: Date,
            required: [true, 'Booking date is required'],
        },

        start_time: {
            type: Date,
            required: [true, 'Start time is required'],
        },

        end_time: {
            type: Date,
            required: [true, 'End time is required'],
        },

        wash_bay_start_time: {
            type: Date,
            default: null,
        },

        wash_bay_end_time: {
            type: Date,
            default: null,
        },

        original_price: {
            type: Number,
            required: [true, 'Original price is required'],
            min: [0, 'Original price must be greater than or equal to 0'],
            default: 0,
        },

        promotion_discount_amount: {
            type: Number,
            min: [0, 'Promotion discount must be greater than or equal to 0'],
            default: 0,
        },

        points_discount_amount: {
            type: Number,
            min: [0, 'Points discount must be greater than or equal to 0'],
            default: 0,
        },

        discount_amount: {
            type: Number,
            min: [0, 'Discount amount must be greater than or equal to 0'],
            default: 0,
        },

        final_price: {
            type: Number,
            required: [true, 'Final price is required'],
            min: [0, 'Final price must be greater than or equal to 0'],
            default: 0,
        },

        payment_method: {
            type: String,
            enum: BOOKING_PAYMENT_METHOD_VALUES,
            default: BOOKING_PAYMENT_METHOD.CASH,
        },

        payment_status: {
            type: String,
            enum: BOOKING_PAYMENT_STATUS_VALUES,
            default: BOOKING_PAYMENT_STATUS.UNPAID,
        },

        used_points: {
            type: Number,
            min: [0, 'Used points must be greater than or equal to 0'],
            default: 0,
        },

        earned_points: {
            type: Number,
            min: [0, 'Earned points must be greater than or equal to 0'],
            default: 0,
        },

        promotion_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Promotion',
            default: null,
        },

        requires_wash_bay: {
            type: Boolean,
            default: false,
        },

        status: {
            type: String,
            enum: BOOKING_STATUS_VALUES,
            default: BOOKING_STATUS.CONFIRMED,
        },

        checked_in_at: {
            type: Date,
            default: null,
        },

        started_at: {
            type: Date,
            default: null,
        },

        completed_at: {
            type: Date,
            default: null,
        },

        paid_at: {
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

        reward_processed: {
            type: Boolean,
            default: false,
        },

        reward_processed_at: {
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
        collection: 'bookings',
    }
);

bookingSchema.index({ customer_id: 1, start_time: -1 });
bookingSchema.index({ vehicle_id: 1, start_time: 1, end_time: 1 });
bookingSchema.index({ garage_id: 1, vehicle_type: 1, wash_bay_start_time: 1, wash_bay_end_time: 1, status: 1 });
bookingSchema.index({ garage_id: 1, start_time: -1 });
bookingSchema.index({ service_package_id: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ payment_status: 1 });
bookingSchema.index({ is_walk_in: 1 });
bookingSchema.index({ normalized_license_plate: 1, vehicle_type: 1, start_time: 1 });
bookingSchema.index({ created_by_staff_id: 1 });
bookingSchema.index({ created_at: -1 });

bookingSchema.pre('validate', function (next) {
    if (this.start_time && this.end_time && this.start_time >= this.end_time) {
        this.invalidate('end_time', 'End time must be after start time');
    }

    if (this.requires_wash_bay) {
        if (!this.wash_bay_start_time || !this.wash_bay_end_time) {
            this.invalidate('wash_bay_start_time', 'Wash bay time is required');
        }

        if (this.wash_bay_start_time && this.wash_bay_end_time && this.wash_bay_start_time >= this.wash_bay_end_time) {
            this.invalidate('wash_bay_end_time', 'Wash bay end time must be after wash bay start time');
        }
    }

    if (!this.requires_wash_bay) {
        this.wash_bay_start_time = null;
        this.wash_bay_end_time = null;
        this.wash_bay_id = null;
    }

    if (!this.is_walk_in && (!this.customer_id || !this.vehicle_id)) {
        this.invalidate('customer_id', 'Customer booking requires customer and vehicle');
    }

    if (this.is_walk_in && (!this.guest_name || !this.guest_phone || !this.license_plate || !this.normalized_license_plate || !this.created_by_staff_id)) {
        this.invalidate('guest_name', 'Walk-in booking requires guest information');
    }

    next();
});

bookingSchema.methods.toJSON = function () {
    const booking = this.toObject();

    delete booking.__v;

    return booking;
};

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
