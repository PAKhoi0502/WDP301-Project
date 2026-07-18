const crypto = require('crypto');

const CameraDevice = require('./cameraDevice.model');
const BookingPlateScan = require('./bookingPlateScan.model');
const User = require('../users/user.model');
const BookingArrivalMapper = require('./bookingArrival.mapper');
const bookingArrivalService = require('./bookingArrival.service');
const uploadService = require('../uploads/upload.service');
const auditLogService = require('../audit-logs/auditLog.service');
const { hashDeviceKey } = require('./cameraDevice.middleware');
const { AppError } = require('../../shared/utils/appError');
const { UPLOAD_PURPOSES } = require('../../shared/constants/upload.constant');
const { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } = require('../../shared/constants/audit.constant');
const { PLATE_SCAN_MODES, PLATE_CAPTURE_SOURCES } = require('../../shared/constants/bookingArrival.constant');

const createPlainKey = () => crypto.randomBytes(32).toString('base64url');

const getDevice = async (deviceId, includeSecret = false) => {
    let query = CameraDevice.findById(deviceId);
    if (includeSecret) query = query.select('+api_key_hash');
    const device = await query;
    if (!device) throw new AppError('Camera device not found', 404, 'CAMERA_DEVICE_NOT_FOUND');
    return device;
};

const recordAudit = (device, user, action, context = {}, before = null) => auditLogService.recordAuditEvent({
    actorId: user._id,
    action,
    resourceType: AUDIT_RESOURCE_TYPES.CAMERA_DEVICE,
    resourceId: device._id,
    before,
    after: BookingArrivalMapper.toDeviceDto(device),
    ip: context.ip,
    userAgent: context.userAgent,
});

const createDevice = async (user, payload, auditContext = {}) => {
    const apiKey = createPlainKey();
    const device = await CameraDevice.create({
        ...payload,
        device_code: payload.device_code.toUpperCase(),
        api_key_hash: hashDeviceKey(apiKey),
        created_by_id: user._id,
    });
    await recordAudit(device, user, AUDIT_ACTIONS.CAMERA_DEVICE_CREATED, auditContext);
    return { device: BookingArrivalMapper.toDeviceDto(device), api_key: apiKey };
};

const listDevices = async (query = {}) => {
    const filter = {};
    if (query.garage_id) filter.garage_id = query.garage_id;
    if (query.status) filter.status = query.status;
    const page = query.page || 1;
    const limit = query.limit || 20;
    const [devices, total] = await Promise.all([
        CameraDevice.find(filter).sort({ created_at: -1 }).skip((page - 1) * limit).limit(limit),
        CameraDevice.countDocuments(filter),
    ]);
    return {
        data: devices.map(BookingArrivalMapper.toDeviceDto),
        meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
};

const updateDevice = async (user, deviceId, payload, auditContext = {}) => {
    const device = await getDevice(deviceId);
    const before = BookingArrivalMapper.toDeviceDto(device);
    Object.entries(payload).forEach(([key, value]) => { device[key] = value; });
    await device.save();
    await recordAudit(device, user, AUDIT_ACTIONS.CAMERA_DEVICE_UPDATED, auditContext, before);
    return BookingArrivalMapper.toDeviceDto(device);
};

const rotateDeviceKey = async (user, deviceId, auditContext = {}) => {
    const device = await getDevice(deviceId, true);
    const apiKey = createPlainKey();
    device.api_key_hash = hashDeviceKey(apiKey);
    device.rotated_by_id = user._id;
    device.key_rotated_at = new Date();
    await device.save();
    await recordAudit(device, user, AUDIT_ACTIONS.CAMERA_DEVICE_KEY_ROTATED, auditContext);
    return { device: BookingArrivalMapper.toDeviceDto(device), api_key: apiKey };
};

const heartbeat = async (device, payload = {}) => {
    device.last_heartbeat_at = new Date();
    if (payload.firmware_version !== undefined) device.firmware_version = payload.firmware_version;
    if (payload.client_version !== undefined) device.client_version = payload.client_version;
    if (payload.metadata !== undefined) device.metadata = { ...(device.metadata || {}), ...payload.metadata };
    await device.save();
    return BookingArrivalMapper.toDeviceDto(device);
};

const uploadFrame = async (device, file, auditContext = {}) => {
    if (!file?.mimetype?.startsWith('image/')) {
        throw new AppError('Camera frame must be an image', 400, 'CAMERA_FRAME_IMAGE_REQUIRED');
    }
    const owner = await User.findById(device.created_by_id);
    if (!owner) throw new AppError('Camera device owner was not found', 409, 'CAMERA_DEVICE_OWNER_NOT_FOUND');
    return uploadService.createUpload(owner, file, { purpose: UPLOAD_PURPOSES.BOOKING_PLATE_SCAN }, auditContext);
};

const ingestEvents = async (device, events, auditContext = {}) => {
    const owner = await User.findById(device.created_by_id);
    if (!owner) throw new AppError('Camera device owner was not found', 409, 'CAMERA_DEVICE_OWNER_NOT_FOUND');
    const results = [];

    for (const event of events) {
        try {
            const existing = await BookingPlateScan.findOne({
                camera_device_id: device._id,
                client_event_id: event.client_event_id,
            });
            if (existing) {
                results.push({
                    client_event_id: event.client_event_id,
                    accepted: true,
                    duplicate: true,
                    scan: BookingArrivalMapper.toScanDto(existing),
                });
                continue;
            }
            const scan = await bookingArrivalService.createScan({
                user: owner,
                device,
                payload: {
                    ...event,
                    garage_id: device.garage_id,
                    mode: PLATE_SCAN_MODES.GATE,
                    capture_source: event.offline
                        ? PLATE_CAPTURE_SOURCES.OFFLINE_GATE : PLATE_CAPTURE_SOURCES.GATE_CAMERA,
                },
                auditContext,
            });
            results.push({ client_event_id: event.client_event_id, accepted: true, scan });
        } catch (error) {
            if (error?.code === 11000) {
                results.push({ client_event_id: event.client_event_id, accepted: true, duplicate: true });
            } else {
                results.push({
                    client_event_id: event.client_event_id,
                    accepted: false,
                    error_code: error.errorCode || 'CAMERA_EVENT_FAILED',
                    message: error.message,
                });
            }
        }
    }
    device.last_event_at = new Date();
    await device.save();
    return {
        received: events.length,
        accepted: results.filter((item) => item.accepted).length,
        rejected: results.filter((item) => !item.accepted).length,
        results,
    };
};

module.exports = {
    createDevice,
    listDevices,
    updateDevice,
    rotateDeviceKey,
    heartbeat,
    uploadFrame,
    ingestEvents,
};
