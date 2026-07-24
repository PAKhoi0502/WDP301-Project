const mongoose = require('mongoose');

const { VEHICLE_TYPE_VALUES } = require('../../shared/constants/vehicle.constant');
const { STAFF_TYPE_VALUES } = require('../../shared/constants/staff.constant');
const {
    BOOKING_STATUS,
    BOOKING_STATUS_VALUES,
    BOOKING_ARRIVAL_STATUS_VALUES,
    BOOKING_LATE_RESOLUTION_VALUES,
    BOOKING_PAYMENT_METHOD,
    BOOKING_PAYMENT_METHOD_VALUES,
    BOOKING_PAYMENT_STATUS,
    BOOKING_PAYMENT_STATUS_VALUES,
    BOOKING_ITEM_STATUS,
    BOOKING_ITEM_STATUS_VALUES,
    BOOKING_ITEM_COMPLETION_SOURCE_VALUES,
} = require('../../shared/constants/booking.constant');
const {
    SERVICE_TRANSITION_MODES,
    SERVICE_TRANSITION_MODE_VALUES,
} = require('../../shared/constants/servicePackage.constant');
const {
    BOOKING_OPERATION_STATUS,
    BOOKING_OPERATION_STATUS_VALUES,
    BOOKING_CANCELLATION_SOURCES,
    BOOKING_CANCELLATION_SOURCE_VALUES,
} = require('../../shared/constants/bookingIncident.constant');

const bookingItemCareStaffAssignmentSchema = new mongoose.Schema(
    {
        staff_profile_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'StaffProfile',
            required: [true, 'Staff profile is required'],
        },

        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Staff user is required'],
        },

        assigned_at: {
            type: Date,
            required: [true, 'Care staff assigned time is required'],
        },

        released_at: {
            type: Date,
            default: null,
        },
    },
    {
        _id: false,
    }
);

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

        countdown_duration_seconds: {
            type: Number,
            min: [1, 'Booking item countdown must be at least 1 second'],
            max: [86400, 'Booking item countdown must not exceed 86400 seconds'],
            default: null,
        },

        transition_mode: {
            type: String,
            enum: SERVICE_TRANSITION_MODE_VALUES,
            default: SERVICE_TRANSITION_MODES.REQUIRE_CONFIRMATION,
        },

        item_start_time: {
            type: Date,
            default: null,
        },

        item_end_time: {
            type: Date,
            default: null,
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

        wash_bay_work_end_time: {
            type: Date,
            default: null,
        },

        wash_bay_reserved_until: {
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

        care_staff_work_end_time: {
            type: Date,
            default: null,
        },

        care_staff_reserved_until: {
            type: Date,
            default: null,
        },

        assigned_care_staff: {
            type: [bookingItemCareStaffAssignmentSchema],
            default: [],
        },

        assigned_execution_staff: {
            type: [bookingItemCareStaffAssignmentSchema],
            default: [],
        },

        status: {
            type: String,
            enum: BOOKING_ITEM_STATUS_VALUES,
            default: BOOKING_ITEM_STATUS.PENDING,
        },

        actual_started_at: {
            type: Date,
            default: null,
        },

        countdown_ends_at: {
            type: Date,
            default: null,
        },

        actual_completed_at: {
            type: Date,
            default: null,
        },

        remaining_seconds_at_pause: {
            type: Number,
            min: [0, 'Remaining pause seconds must be greater than or equal to 0'],
            default: null,
        },

        countdown_resume_seconds: {
            type: Number,
            min: [1, 'Countdown resume seconds must be greater than 0'],
            default: null,
        },

        paused_at: {
            type: Date,
            default: null,
        },

        paused_by_staff_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

        pause_reason: {
            type: String,
            trim: true,
            maxlength: [500, 'Pause reason must not exceed 500 characters'],
            default: null,
        },

        total_paused_seconds: {
            type: Number,
            min: [0, 'Total paused seconds must be greater than or equal to 0'],
            default: 0,
        },

        completion_source: {
            type: String,
            enum: BOOKING_ITEM_COMPLETION_SOURCE_VALUES,
            default: null,
        },

        completed_by_staff_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

        completion_note: {
            type: String,
            trim: true,
            maxlength: [1000, 'Completion note must not exceed 1000 characters'],
            default: null,
        },

        timer_claimed_at: {
            type: Date,
            default: null,
        },

        timer_claim_token: {
            type: String,
            trim: true,
            maxlength: [100, 'Timer claim token must not exceed 100 characters'],
            default: null,
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

        is_rework: {
            type: Boolean,
            default: false,
        },

        original_booking_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking',
            default: null,
        },

        customer_case_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'CustomerCase',
            default: null,
        },

        customer_case_resolution_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'CustomerCaseResolution',
            default: null,
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

        normalized_guest_phone: {
            type: String,
            trim: true,
            maxlength: [20, 'Normalized guest phone must not exceed 20 characters'],
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

        assigned_inspection_staff_id: {
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

        claimed_customer_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

        claimed_at: {
            type: Date,
            default: null,
        },

        wash_bay_work_end_time: {
            type: Date,
            default: null,
        },

        wash_bay_reserved_until: {
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

        voucher_discount_amount: {
            type: Number,
            min: [0, 'Voucher discount must be greater than or equal to 0'],
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

        pre_waiver_final_price: {
            type: Number,
            min: [0, 'Pre-waiver final price must be greater than or equal to 0'],
            default: null,
        },

        waived_amount: {
            type: Number,
            min: [0, 'Waived amount must be greater than or equal to 0'],
            default: 0,
        },

        waiver_resolution_ids: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'CustomerCaseResolution',
        }],

        payment_waived_at: {
            type: Date,
            default: null,
        },

        payment_waived_by_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

        payment_waiver_case_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'CustomerCase',
            default: null,
        },

        payment_waiver_reason: {
            type: String,
            trim: true,
            maxlength: [2000, 'Payment waiver reason must not exceed 2000 characters'],
            default: null,
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

        customer_voucher_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'CustomerVoucher',
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

        care_staff_work_end_time: {
            type: Date,
            default: null,
        },

        care_staff_reserved_until: {
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

        operation_status: {
            type: String,
            enum: BOOKING_OPERATION_STATUS_VALUES,
            default: BOOKING_OPERATION_STATUS.NORMAL,
        },

        active_incident_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'BookingIncident',
            default: null,
        },

        arrival_status: {
            type: String,
            enum: BOOKING_ARRIVAL_STATUS_VALUES,
            default: null,
        },

        arrival_detected_at: { type: Date, default: null },
        arrival_detection_scan_id: { type: mongoose.Schema.Types.ObjectId, ref: 'BookingPlateScan', default: null },
        check_in_method: { type: String, enum: ['MANUAL', 'PLATE_SCAN'], default: null },
        check_in_verification_id: { type: mongoose.Schema.Types.ObjectId, ref: 'BookingPlateScan', default: null },
        check_in_detected_plate: { type: String, trim: true, uppercase: true, maxlength: 20, default: null },
        check_in_match_type: { type: String, enum: ['EXACT', 'FUZZY', 'MANUAL', 'NONE'], default: null },
        check_in_manual_override: { type: Boolean, default: false },
        check_in_override_reason: { type: String, trim: true, maxlength: 1000, default: null },

        arrived_at: {
            type: Date,
            default: null,
        },

        arrival_reference_start_time: {
            type: Date,
            default: null,
        },

        late_minutes: {
            type: Number,
            min: [0, 'Late minutes must be greater than or equal to 0'],
            default: 0,
        },

        grace_exceeded_minutes: {
            type: Number,
            min: [0, 'Grace exceeded minutes must be greater than or equal to 0'],
            default: 0,
        },

        late_resolution: {
            type: String,
            enum: BOOKING_LATE_RESOLUTION_VALUES,
            default: null,
        },

        late_accepted_by_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

        late_accepted_at: {
            type: Date,
            default: null,
        },

        late_resolution_note: {
            type: String,
            trim: true,
            maxlength: [1000, 'Late resolution note must not exceed 1000 characters'],
            default: null,
        },

        original_start_time: {
            type: Date,
            default: null,
        },

        original_end_time: {
            type: Date,
            default: null,
        },

        rescheduled_at: {
            type: Date,
            default: null,
        },

        rescheduled_by_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

        reschedule_reason: {
            type: String,
            trim: true,
            maxlength: [500, 'Reschedule reason must not exceed 500 characters'],
            default: null,
        },

        reschedule_count: {
            type: Number,
            min: [0, 'Reschedule count must be greater than or equal to 0'],
            default: 0,
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

        no_show_at: {
            type: Date,
            default: null,
        },

        no_show_by_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

        no_show_reason: {
            type: String,
            trim: true,
            maxlength: [500, 'No-show reason must not exceed 500 characters'],
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

        cancellation_source: {
            type: String,
            enum: BOOKING_CANCELLATION_SOURCE_VALUES,
            default: null,
        },

        cancellation_incident_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'BookingIncident',
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
bookingSchema.index({ garage_id: 1, vehicle_type: 1, wash_bay_start_time: 1, wash_bay_reserved_until: 1, status: 1 });
bookingSchema.index({ garage_id: 1, care_staff_type: 1, care_staff_start_time: 1, care_staff_reserved_until: 1, status: 1 });
bookingSchema.index({ garage_id: 1, 'booking_items.wash_bay_start_time': 1, 'booking_items.wash_bay_reserved_until': 1, status: 1 });
bookingSchema.index({ garage_id: 1, 'booking_items.care_staff_type': 1, 'booking_items.care_staff_start_time': 1, 'booking_items.care_staff_reserved_until': 1, status: 1 });
bookingSchema.index({ garage_id: 1, start_time: -1 });
bookingSchema.index({ service_package_id: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ status: 1, 'booking_items.status': 1, 'booking_items.countdown_ends_at': 1 });
bookingSchema.index({ payment_status: 1 });
bookingSchema.index({ is_walk_in: 1 });
bookingSchema.index({ original_booking_id: 1, is_rework: 1 });
bookingSchema.index({ customer_case_id: 1 });
bookingSchema.index(
    { customer_case_resolution_id: 1 },
    { unique: true, partialFilterExpression: { customer_case_resolution_id: { $type: 'objectId' } } }
);
bookingSchema.index({ normalized_guest_phone: 1, is_walk_in: 1, claimed_customer_id: 1 });
bookingSchema.index({ normalized_license_plate: 1, vehicle_type: 1, start_time: 1 });
bookingSchema.index({ garage_id: 1, normalized_license_plate: 1, status: 1, start_time: 1 });
bookingSchema.index({ created_by_staff_id: 1 });
bookingSchema.index({ assigned_inspection_staff_id: 1, status: 1 });
bookingSchema.index({ garage_id: 1, arrival_detected_at: -1 });
bookingSchema.index({ 'booking_items.assigned_execution_staff.user_id': 1, status: 1 });
bookingSchema.index({ created_at: -1 });

bookingSchema.pre('validate', function (next) {
    if (
        this.operation_status === BOOKING_OPERATION_STATUS.AWAITING_CUSTOMER_DECISION
        && !this.active_incident_id
    ) {
        this.invalidate('active_incident_id', 'Active incident is required while awaiting customer decision');
    }

    if (
        this.active_incident_id
        && this.operation_status !== BOOKING_OPERATION_STATUS.AWAITING_CUSTOMER_DECISION
    ) {
        this.invalidate('operation_status', 'Active incident requires awaiting customer decision status');
    }

    if (
        this.cancellation_source === BOOKING_CANCELLATION_SOURCES.GARAGE_INCIDENT
        && !this.cancellation_incident_id
    ) {
        this.invalidate('cancellation_incident_id', 'Garage incident cancellation requires incident reference');
    }

    if (this.start_time && this.end_time && this.start_time >= this.end_time) {
        this.invalidate('end_time', 'End time must be after start time');
    }

    if (this.waived_amount > 0) {
        if (this.pre_waiver_final_price === null) {
            this.invalidate(
                'pre_waiver_final_price',
                'Pre-waiver final price is required when a charge is waived'
            );
        } else if (
            this.pre_waiver_final_price !== this.final_price + this.waived_amount
        ) {
            this.invalidate(
                'waived_amount',
                'Waived amount must reconcile with the remaining final price'
            );
        }
    }

    if (this.payment_status === BOOKING_PAYMENT_STATUS.WAIVED) {
        if (this.final_price !== 0) {
            this.invalidate('final_price', 'Fully waived booking must have zero final price');
        }

        if (
            !this.payment_waived_at
            || !this.payment_waived_by_id
            || !this.payment_waiver_case_id
            || !this.payment_waiver_reason
        ) {
            this.invalidate(
                'payment_status',
                'Fully waived booking requires waiver audit information'
            );
        }
    }

    if (this.requires_wash_bay) {
        this.wash_bay_work_end_time = this.wash_bay_work_end_time || this.wash_bay_end_time;
        this.wash_bay_end_time = this.wash_bay_end_time || this.wash_bay_work_end_time;
        this.wash_bay_reserved_until = this.wash_bay_reserved_until || this.wash_bay_work_end_time;

        if (!this.wash_bay_start_time || !this.wash_bay_work_end_time || !this.wash_bay_reserved_until) {
            this.invalidate('wash_bay_start_time', 'Wash bay time is required');
        }

        if (this.wash_bay_start_time && this.wash_bay_work_end_time && this.wash_bay_start_time >= this.wash_bay_work_end_time) {
            this.invalidate('wash_bay_end_time', 'Wash bay end time must be after wash bay start time');
        }

        if (this.wash_bay_work_end_time && this.wash_bay_reserved_until && this.wash_bay_work_end_time > this.wash_bay_reserved_until) {
            this.invalidate('wash_bay_reserved_until', 'Wash bay reservation must not end before work end time');
        }
    }

    if (!this.requires_wash_bay) {
        this.wash_bay_start_time = null;
        this.wash_bay_end_time = null;
        this.wash_bay_work_end_time = null;
        this.wash_bay_reserved_until = null;
        this.wash_bay_id = null;
    }

    if (this.requires_care_staff) {
        this.care_staff_work_end_time = this.care_staff_work_end_time || this.care_staff_end_time;
        this.care_staff_end_time = this.care_staff_end_time || this.care_staff_work_end_time;
        this.care_staff_reserved_until = this.care_staff_reserved_until || this.care_staff_work_end_time;

        if (!this.care_staff_type) {
            this.invalidate('care_staff_type', 'Care staff type is required');
        }

        if (!this.care_staff_required_count || this.care_staff_required_count < 1) {
            this.invalidate('care_staff_required_count', 'Care staff required count must be greater than 0');
        }

        if (!this.care_staff_start_time || !this.care_staff_work_end_time || !this.care_staff_reserved_until) {
            this.invalidate('care_staff_start_time', 'Care staff time is required');
        }

        if (this.care_staff_start_time && this.care_staff_work_end_time && this.care_staff_start_time >= this.care_staff_work_end_time) {
            this.invalidate('care_staff_end_time', 'Care staff end time must be after care staff start time');
        }

        if (this.care_staff_work_end_time && this.care_staff_reserved_until && this.care_staff_work_end_time > this.care_staff_reserved_until) {
            this.invalidate('care_staff_reserved_until', 'Care staff reservation must not end before work end time');
        }
    }

    if (!this.requires_care_staff) {
        this.care_staff_type = null;
        this.care_staff_required_count = 0;
        this.care_staff_start_time = null;
        this.care_staff_end_time = null;
        this.care_staff_work_end_time = null;
        this.care_staff_reserved_until = null;
        this.assigned_care_staff_ids = [];
    }

    const itemKeys = new Set();

    for (const item of this.booking_items || []) {
        if (!item.countdown_duration_seconds && item.duration_minutes) {
            item.countdown_duration_seconds = item.duration_minutes * 60;
        }

        if (itemKeys.has(item.item_key)) {
            this.invalidate('booking_items', 'Booking item key must be unique');
            break;
        }

        itemKeys.add(item.item_key);

        if (item.item_start_time && item.item_end_time && item.item_start_time >= item.item_end_time) {
            this.invalidate('booking_items', 'Booking item end time must be after start time');
            break;
        }

        if (item.requires_wash_bay) {
            item.wash_bay_work_end_time = item.wash_bay_work_end_time || item.wash_bay_end_time;
            item.wash_bay_end_time = item.wash_bay_end_time || item.wash_bay_work_end_time;
            item.wash_bay_reserved_until = item.wash_bay_reserved_until || item.wash_bay_work_end_time;

            if (!item.wash_bay_start_time || !item.wash_bay_work_end_time || !item.wash_bay_reserved_until) {
                this.invalidate('booking_items', 'Wash bay time is required for wash bay booking item');
                break;
            }

            if (item.wash_bay_start_time >= item.wash_bay_work_end_time) {
                this.invalidate('booking_items', 'Wash bay item end time must be after start time');
                break;
            }

            if (item.wash_bay_work_end_time > item.wash_bay_reserved_until) {
                this.invalidate('booking_items', 'Wash bay item reservation must not end before work end time');
                break;
            }
        }

        if (!item.requires_wash_bay) {
            item.wash_bay_start_time = null;
            item.wash_bay_end_time = null;
            item.wash_bay_work_end_time = null;
            item.wash_bay_reserved_until = null;
        }

        if (item.requires_care_staff) {
            item.care_staff_work_end_time = item.care_staff_work_end_time || item.care_staff_end_time;
            item.care_staff_end_time = item.care_staff_end_time || item.care_staff_work_end_time;
            item.care_staff_reserved_until = item.care_staff_reserved_until || item.care_staff_work_end_time;

            if (!item.care_staff_type) {
                this.invalidate('booking_items', 'Care staff type is required for care staff booking item');
                break;
            }

            if (!item.care_staff_required_count || item.care_staff_required_count < 1) {
                this.invalidate('booking_items', 'Care staff required count must be greater than 0 for care staff booking item');
                break;
            }

            if (!item.care_staff_start_time || !item.care_staff_work_end_time || !item.care_staff_reserved_until) {
                this.invalidate('booking_items', 'Care staff time is required for care staff booking item');
                break;
            }

            if (item.care_staff_start_time >= item.care_staff_work_end_time) {
                this.invalidate('booking_items', 'Care staff item end time must be after start time');
                break;
            }

            if (item.care_staff_work_end_time > item.care_staff_reserved_until) {
                this.invalidate('booking_items', 'Care staff item reservation must not end before work end time');
                break;
            }
        }

        if (!item.requires_care_staff) {
            item.care_staff_type = null;
            item.care_staff_required_count = 0;
            item.care_staff_start_time = null;
            item.care_staff_end_time = null;
            item.care_staff_work_end_time = null;
            item.care_staff_reserved_until = null;
            item.assigned_care_staff = [];
        }
    }

    if (!this.is_walk_in && (!this.customer_id || !this.vehicle_id)) {
        this.invalidate('customer_id', 'Customer booking requires customer and vehicle');
    }

    if (this.is_walk_in && (!this.license_plate || !this.normalized_license_plate || !this.created_by_staff_id)) {
        this.invalidate('license_plate', 'Walk-in booking requires vehicle and staff information');
    }

    if (this.is_rework && (!this.original_booking_id || !this.customer_case_id || !this.customer_case_resolution_id)) {
        this.invalidate('original_booking_id', 'Rework booking requires customer case traceability');
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
