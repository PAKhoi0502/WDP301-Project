const mongoose = require('mongoose');
const {
    CAMERA_DEVICE_STATUSES,
    CAMERA_DEVICE_STATUS_VALUES,
} = require('../../shared/constants/bookingArrival.constant');

const schema = new mongoose.Schema({
    device_code: { type: String, required: true, unique: true, trim: true, uppercase: true, maxlength: 40 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    garage_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Garage', required: true },
    location: { type: String, trim: true, maxlength: 200, default: null },
    status: { type: String, enum: CAMERA_DEVICE_STATUS_VALUES, default: CAMERA_DEVICE_STATUSES.ACTIVE },
    api_key_hash: { type: String, required: true, select: false },
    created_by_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rotated_by_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    key_rotated_at: { type: Date, default: null },
    last_heartbeat_at: { type: Date, default: null },
    last_event_at: { type: Date, default: null },
    firmware_version: { type: String, trim: true, maxlength: 80, default: null },
    client_version: { type: String, trim: true, maxlength: 80, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'camera_devices',
});

schema.index({ garage_id: 1, status: 1, created_at: -1 });
schema.index({ last_heartbeat_at: 1 });

module.exports = mongoose.model('CameraDevice', schema);
