const mongoose = require('mongoose');

const { VEHICLE_TYPE_VALUES } = require('../../shared/constants/vehicle.constant');
const { STAFF_TYPE_VALUES } = require('../../shared/constants/staff.constant');
const {
    BOOKING_STATUS,
    BOOKING_STATUS_VALUES,
    BOOKING_PAYMENT_METHOD,
    BOOKING_PAYMENT_METHOD_VALUES,
    BOOKING_PAYMENT_STATUS,
    BOOKING_PAYMENT_STATUS_VALUES,
} = require('../../shared/constants/booking.constant');

const bookingItemSchema = new mongoose.Schema(
    {
        item_key: {
            type: String,
            required: [true, 'Booking item key is required'],
            trim: true,
        },

        service_package_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ServicePackage',
            required: [true, 'Service package is required'],
        },

        source: {
            type: String,
            enum: ['PRIMARY', 'COMBO_INCLUDED', 'ADD_ON'],
            required: [true, 'Booking item source is required'],
        },

        parent_combo_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ServicePackage',
            default: null,
        },

        name_snapshot: {
            type: String,
            required: [true, 'Booking item name is required'],
            trim: true,
            maxlength: [150, 'Booking item name must not exceed 150 characters'],
        },

        price_snapshot: {
            type: Number,
            min: [0, 'Booking item price must be greater than or equal to 0'],
            default: 0,
        },

        duration_minutes: {
            type: Number,
            required: [true, 'Booking item duration is required'],
            min: [1, 'Booking item duration must be at least 1 minute'],
        },

        sequence: {
            type: Number,
            required: [true, 'Booking item sequence is required'],
            min: [1, 'Booking item sequence must be at least 1'],
        },

        requires_wash_bay: {
            type: Boolean,
            default: false,
        },

        wash_bay_start_time: {
            type: Date,
            default: null,
        },

        wash_bay_end_time: {
            type: Date,
            default: null,
        },

        requires_care_staff: {
            type: Boolean,
            default: false,
        },

        care_staff_type: {
            type: String,
            enum: STAFF_TYPE_VALUES,
            default: null,
        },

        care_staff_required_count: {
            type: Number,
            min: [0, 'Care staff required count must be greater than or equal to 0'],
            max: [50, 'Care staff required count must not exceed 50'],
            default: 0,
        },

        care_staff_start_time: {
            type: Date,
            default: null,
        },

        care_staff_end_time: {
            type: Date,
            default: null,
        },

        status: {
            type: String,
            enum: ['PENDING', 'IN_PROGRESS', 'DONE', 'SKIPPED'],
            default: 'PENDING',
        },
    },
    {
        _id: false,
    }
);

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

        add_on_service_ids: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'ServicePackage',
            },
        ],

        booking_items: {
            type: [bookingItemSchema],
            default: [],
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

        requires_care_staff: {
            type: Boolean,
            default: false,
        },

        care_staff_type: {
            type: String,
            enum: STAFF_TYPE_VALUES,
            default: null,
        },

        care_staff_required_count: {
            type: Number,
            min: [0, 'Care staff required count must be greater than or equal to 0'],
            max: [50, 'Care staff required count must not exceed 50'],
            default: 0,
        },

        care_staff_start_time: {
            type: Date,
            default: null,
        },

        care_staff_end_time: {
            type: Date,
            default: null,
        },

        assigned_care_staff_ids: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'StaffProfile',
            },
        ],

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
bookingSchema.index({ garage_id: 1, care_staff_type: 1, care_staff_start_time: 1, care_staff_end_time: 1, status: 1 });
bookingSchema.index({ garage_id: 1, 'booking_items.wash_bay_start_time': 1, 'booking_items.wash_bay_end_time': 1, status: 1 });
bookingSchema.index({ garage_id: 1, 'booking_items.care_staff_type': 1, 'booking_items.care_staff_start_time': 1, 'booking_items.care_staff_end_time': 1, status: 1 });
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

    if (this.requires_care_staff) {
        if (!this.care_staff_type) {
            this.invalidate('care_staff_type', 'Care staff type is required');
        }

        if (!this.care_staff_required_count || this.care_staff_required_count < 1) {
            this.invalidate('care_staff_required_count', 'Care staff required count must be greater than 0');
        }

        if (!this.care_staff_start_time || !this.care_staff_end_time) {
            this.invalidate('care_staff_start_time', 'Care staff time is required');
        }

        if (this.care_staff_start_time && this.care_staff_end_time && this.care_staff_start_time >= this.care_staff_end_time) {
            this.invalidate('care_staff_end_time', 'Care staff end time must be after care staff start time');
        }
    }

    if (!this.requires_care_staff) {
        this.care_staff_type = null;
        this.care_staff_required_count = 0;
        this.care_staff_start_time = null;
        this.care_staff_end_time = null;
        this.assigned_care_staff_ids = [];
    }

    const itemKeys = new Set();

    for (const item of this.booking_items || []) {
        if (itemKeys.has(item.item_key)) {
            this.invalidate('booking_items', 'Booking item key must be unique');
            break;
        }

        itemKeys.add(item.item_key);

        if (item.requires_wash_bay) {
            if (!item.wash_bay_start_time || !item.wash_bay_end_time) {
                this.invalidate('booking_items', 'Wash bay time is required for wash bay booking item');
                break;
            }

            if (item.wash_bay_start_time >= item.wash_bay_end_time) {
                this.invalidate('booking_items', 'Wash bay item end time must be after start time');
                break;
            }
        }

        if (!item.requires_wash_bay) {
            item.wash_bay_start_time = null;
            item.wash_bay_end_time = null;
        }

        if (item.requires_care_staff) {
            if (!item.care_staff_type) {
                this.invalidate('booking_items', 'Care staff type is required for care staff booking item');
                break;
            }

            if (!item.care_staff_required_count || item.care_staff_required_count < 1) {
                this.invalidate('booking_items', 'Care staff required count must be greater than 0 for care staff booking item');
                break;
            }

            if (!item.care_staff_start_time || !item.care_staff_end_time) {
                this.invalidate('booking_items', 'Care staff time is required for care staff booking item');
                break;
            }

            if (item.care_staff_start_time >= item.care_staff_end_time) {
                this.invalidate('booking_items', 'Care staff item end time must be after start time');
                break;
            }
        }

        if (!item.requires_care_staff) {
            item.care_staff_type = null;
            item.care_staff_required_count = 0;
            item.care_staff_start_time = null;
            item.care_staff_end_time = null;
        }
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
