const mongoose = require('mongoose');

const {
    PLATE_SCAN_STATUSES,
    PLATE_SCAN_STATUS_VALUES,
    PLATE_SCAN_MODE_VALUES,
    PLATE_CAPTURE_SOURCE_VALUES,
    PLATE_MATCH_TYPES,
    PLATE_MATCH_TYPE_VALUES,
    PLATE_QUALITY_FLAG_VALUES,
    ALTERNATE_VEHICLE_STATUSES,
    ALTERNATE_VEHICLE_STATUS_VALUES,
} = require('../../shared/constants/bookingArrival.constant');
const { VEHICLE_TYPE_VALUES } = require('../../shared/constants/vehicle.constant');

const characterConfidenceSchema = new mongoose.Schema({
    character: { type: String, trim: true, maxlength: 2, required: true },
    confidence: { type: Number, min: 0, max: 1, required: true },
}, { _id: false });

const boundingBoxSchema = new mongoose.Schema({
    x: { type: Number, min: 0, max: 1, required: true },
    y: { type: Number, min: 0, max: 1, required: true },
    width: { type: Number, min: 0, max: 1, required: true },
    height: { type: Number, min: 0, max: 1, required: true },
}, { _id: false });

const frameResultSchema = new mongoose.Schema({
    upload_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Upload', required: true },
    raw_plate_text: { type: String, trim: true, maxlength: 40, default: null },
    normalized_plate: { type: String, trim: true, uppercase: true, maxlength: 20, default: null },
    confidence: { type: Number, min: 0, max: 1, default: 0 },
    character_confidences: { type: [characterConfidenceSchema], default: [] },
    vehicle_type: { type: String, enum: [...VEHICLE_TYPE_VALUES, 'UNKNOWN'], default: 'UNKNOWN' },
    quality_flags: [{ type: String, enum: PLATE_QUALITY_FLAG_VALUES }],
    multiple_plate_count: { type: Number, min: 0, default: 0 },
    bounding_box: { type: boundingBoxSchema, default: null },
    processing_time_ms: { type: Number, min: 0, default: 0 },
    error_code: { type: String, trim: true, maxlength: 100, default: null },
}, { _id: false });

const candidateSchema = new mongoose.Schema({
    booking_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    match_type: { type: String, enum: PLATE_MATCH_TYPE_VALUES, required: true },
    edit_distance: { type: Number, min: 0, default: 0 },
    scheduled_distance_minutes: { type: Number, min: 0, default: 0 },
    vehicle_type_mismatch: { type: Boolean, default: false },
}, { _id: false });

const schema = new mongoose.Schema({
    garage_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Garage', required: true },
    staff_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    camera_device_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CameraDevice', default: null },
    client_event_id: { type: String, trim: true, maxlength: 120, default: null },
    mode: { type: String, enum: PLATE_SCAN_MODE_VALUES, required: true },
    capture_source: { type: String, enum: PLATE_CAPTURE_SOURCE_VALUES, required: true },
    captured_at: { type: Date, required: true },
    server_received_at: { type: Date, required: true },
    status: { type: String, enum: PLATE_SCAN_STATUS_VALUES, default: PLATE_SCAN_STATUSES.CAPTURED },
    upload_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Upload', required: true }],
    primary_upload_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Upload', default: null },
    plate_crop_url: { type: String, trim: true, maxlength: 1500, default: null },
    frame_results: { type: [frameResultSchema], default: [] },
    raw_plate_text: { type: String, trim: true, maxlength: 40, default: null },
    normalized_plate: { type: String, trim: true, uppercase: true, maxlength: 20, default: null },
    confidence: { type: Number, min: 0, max: 1, default: 0 },
    character_confidences: { type: [characterConfidenceSchema], default: [] },
    detected_vehicle_type: { type: String, enum: [...VEHICLE_TYPE_VALUES, 'UNKNOWN'], default: 'UNKNOWN' },
    quality_flags: [{ type: String, enum: PLATE_QUALITY_FLAG_VALUES }],
    multiple_plate_count: { type: Number, min: 0, default: 0 },
    weather: { type: String, enum: ['CLEAR', 'RAIN', 'FOG', 'UNKNOWN'], default: 'UNKNOWN' },
    time_of_day: { type: String, enum: ['DAY', 'NIGHT', 'UNKNOWN'], default: 'UNKNOWN' },
    provider: { type: String, trim: true, maxlength: 80, default: null },
    model_version: { type: String, trim: true, maxlength: 120, default: null },
    processing_time_ms: { type: Number, min: 0, default: 0 },
    retry_of_scan_id: { type: mongoose.Schema.Types.ObjectId, ref: 'BookingPlateScan', default: null },
    retry_count: { type: Number, min: 0, default: 0 },
    candidates: { type: [candidateSchema], default: [] },
    matched_booking_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
    match_type: { type: String, enum: PLATE_MATCH_TYPE_VALUES, default: PLATE_MATCH_TYPES.NONE },
    confirmed_booking_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
    confirmed_by_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    confirmed_at: { type: Date, default: null },
    staff_confirmed_vehicle: { type: Boolean, default: false },
    manual_override: { type: Boolean, default: false },
    override_reason: { type: String, trim: true, maxlength: 1000, default: null },
    rejection_reason: { type: String, trim: true, maxlength: 100, default: null },
    rejection_note: { type: String, trim: true, maxlength: 1000, default: null },
    rejected_by_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    rejected_at: { type: Date, default: null },
    alternate_vehicle_status: {
        type: String,
        enum: ALTERNATE_VEHICLE_STATUS_VALUES,
        default: ALTERNATE_VEHICLE_STATUSES.NONE,
    },
    alternate_vehicle: {
        booking_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
        license_plate: { type: String, trim: true, maxlength: 30, default: null },
        normalized_license_plate: { type: String, trim: true, uppercase: true, maxlength: 20, default: null },
        vehicle_type: { type: String, enum: VEHICLE_TYPE_VALUES, default: null },
        brand: { type: String, trim: true, maxlength: 80, default: null },
        model: { type: String, trim: true, maxlength: 80, default: null },
        color: { type: String, trim: true, maxlength: 50, default: null },
        reason: { type: String, trim: true, maxlength: 1000, default: null },
        requested_by_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        requested_at: { type: Date, default: null },
        reviewed_by_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        reviewed_at: { type: Date, default: null },
        review_note: { type: String, trim: true, maxlength: 1000, default: null },
    },
    failure_code: { type: String, trim: true, maxlength: 100, default: null },
    failure_message: { type: String, trim: true, maxlength: 1000, default: null },
    retain_until: { type: Date, required: true },
    image_deleted_at: { type: Date, default: null },
    expires_at: { type: Date, required: true },
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'booking_plate_scans',
});

schema.index({ garage_id: 1, created_at: -1 });
schema.index({ garage_id: 1, status: 1, captured_at: -1 });
schema.index({ matched_booking_id: 1, captured_at: -1 });
schema.index({ confirmed_booking_id: 1 }, { sparse: true });
schema.index({ retain_until: 1, image_deleted_at: 1 });
schema.index(
    { camera_device_id: 1, client_event_id: 1 },
    { unique: true, partialFilterExpression: { camera_device_id: { $type: 'objectId' }, client_event_id: { $type: 'string' } } }
);

schema.pre('validate', function (next) {
    if (!this.upload_ids?.length) this.invalidate('upload_ids', 'At least one frame upload is required');
    if (this.status === PLATE_SCAN_STATUSES.CONFIRMED
        && (!this.confirmed_booking_id || !this.confirmed_by_id || !this.confirmed_at || !this.staff_confirmed_vehicle)) {
        this.invalidate('confirmed_booking_id', 'Confirmed scan requires booking and staff confirmation audit');
    }
    if (this.manual_override && !this.override_reason) {
        this.invalidate('override_reason', 'Manual override reason is required');
    }
    next();
});

module.exports = mongoose.model('BookingPlateScan', schema);
