const crypto = require('crypto');

const CameraDevice = require('./cameraDevice.model');
const { AppError } = require('../../shared/utils/appError');
const { CAMERA_DEVICE_STATUSES } = require('../../shared/constants/bookingArrival.constant');

const hashDeviceKey = (value) => crypto
    .createHash('sha256')
    .update(`${process.env.CAMERA_DEVICE_KEY_PEPPER || ''}:${value}`)
    .digest('hex');

const constantTimeEquals = (left, right) => {
    const a = Buffer.from(left || '');
    const b = Buffer.from(right || '');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const authenticateCameraDevice = async (req, res, next) => {
    try {
        const code = String(req.headers['x-camera-device-code'] || '').trim().toUpperCase();
        const key = String(req.headers['x-camera-device-key'] || '').trim();

        if (!code || !key) {
            throw new AppError('Camera device credentials are required', 401, 'CAMERA_DEVICE_CREDENTIALS_REQUIRED');
        }

        const device = await CameraDevice.findOne({ device_code: code }).select('+api_key_hash');

        if (!device || !constantTimeEquals(device.api_key_hash, hashDeviceKey(key))) {
            throw new AppError('Invalid camera device credentials', 401, 'CAMERA_DEVICE_CREDENTIALS_INVALID');
        }
        if (device.status !== CAMERA_DEVICE_STATUSES.ACTIVE) {
            throw new AppError('Camera device is not active', 403, 'CAMERA_DEVICE_INACTIVE');
        }

        req.cameraDevice = device;
        return next();
    } catch (error) {
        return next(error);
    }
};

module.exports = { authenticateCameraDevice, hashDeviceKey };
