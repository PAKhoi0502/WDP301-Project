const bookingArrivalService = require('./bookingArrival.service');
const cameraDeviceService = require('./cameraDevice.service');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../../shared/utils/apiResponse');
const { getAuditRequestContext } = require('../audit-logs/auditLog.service');

const createScan = asyncHandler(async (req, res) => sendCreated(res, {
    message: 'Plate scan processed successfully',
    data: await bookingArrivalService.createScan({ user: req.user, payload: req.validated.body, auditContext: getAuditRequestContext(req) }),
}));
const getScan = asyncHandler(async (req, res) => sendSuccess(res, {
    message: 'Get plate scan successfully', data: await bookingArrivalService.getScan(req.user, req.validated.params.scanId),
}));
const listScans = asyncHandler(async (req, res) => {
    const result = await bookingArrivalService.listScans(req.user, req.validated.query);
    return sendSuccess(res, { message: 'Get plate scans successfully', data: result.data, meta: result.meta });
});
const retryScan = asyncHandler(async (req, res) => sendCreated(res, {
    message: 'Plate scan retried successfully',
    data: await bookingArrivalService.retryScan(req.user, req.validated.params.scanId, req.validated.body, getAuditRequestContext(req)),
}));
const confirmScan = asyncHandler(async (req, res) => sendSuccess(res, {
    message: 'Vehicle verified and booking arrival recorded successfully',
    data: await bookingArrivalService.confirmScan(req.user, req.validated.params.scanId, req.validated.body, getAuditRequestContext(req)),
}));
const rejectScan = asyncHandler(async (req, res) => sendSuccess(res, {
    message: 'Plate scan rejected successfully',
    data: await bookingArrivalService.rejectScan(req.user, req.validated.params.scanId, req.validated.body, getAuditRequestContext(req)),
}));
const requestAlternateVehicle = asyncHandler(async (req, res) => sendSuccess(res, {
    message: 'Alternate vehicle review requested successfully',
    data: await bookingArrivalService.requestAlternateVehicle(req.user, req.validated.params.scanId, req.validated.body, getAuditRequestContext(req)),
}));
const reviewAlternateVehicle = asyncHandler(async (req, res) => sendSuccess(res, {
    message: 'Alternate vehicle request reviewed successfully',
    data: await bookingArrivalService.reviewAlternateVehicle(req.user, req.validated.params.scanId, req.validated.body, getAuditRequestContext(req)),
}));
const getMetrics = asyncHandler(async (req, res) => sendSuccess(res, {
    message: 'Get plate recognition metrics successfully', data: await bookingArrivalService.getMetrics(req.user, req.validated.query),
}));
const getArrivalQueue = asyncHandler(async (req, res) => {
    const result = await bookingArrivalService.listScans(req.user, {
        ...req.validated.query,
        status: 'ARRIVAL_DETECTED',
    });
    return sendSuccess(res, { message: 'Get arrival check-in queue successfully', data: result.data, meta: result.meta });
});

const createDevice = asyncHandler(async (req, res) => sendCreated(res, {
    message: 'Camera device registered successfully. Store the API key now; it will not be shown again.',
    data: await cameraDeviceService.createDevice(req.user, req.validated.body, getAuditRequestContext(req)),
}));
const listDevices = asyncHandler(async (req, res) => {
    const result = await cameraDeviceService.listDevices(req.validated.query);
    return sendSuccess(res, { message: 'Get camera devices successfully', data: result.data, meta: result.meta });
});
const updateDevice = asyncHandler(async (req, res) => sendSuccess(res, {
    message: 'Camera device updated successfully',
    data: await cameraDeviceService.updateDevice(req.user, req.validated.params.id, req.validated.body, getAuditRequestContext(req)),
}));
const rotateDeviceKey = asyncHandler(async (req, res) => sendSuccess(res, {
    message: 'Camera device key rotated successfully. Store the new key now.',
    data: await cameraDeviceService.rotateDeviceKey(req.user, req.validated.params.id, getAuditRequestContext(req)),
}));
const heartbeat = asyncHandler(async (req, res) => sendSuccess(res, {
    message: 'Camera heartbeat recorded successfully', data: await cameraDeviceService.heartbeat(req.cameraDevice, req.validated.body),
}));
const uploadDeviceFrame = asyncHandler(async (req, res) => sendCreated(res, {
    message: 'Camera frame uploaded successfully', data: await cameraDeviceService.uploadFrame(req.cameraDevice, req.file, getAuditRequestContext(req)),
}));
const ingestEvents = asyncHandler(async (req, res) => sendSuccess(res, {
    message: 'Camera event batch processed',
    data: await cameraDeviceService.ingestEvents(req.cameraDevice, req.validated.body.events, getAuditRequestContext(req)),
}));

module.exports = {
    createScan, getScan, listScans, retryScan, confirmScan, rejectScan,
    requestAlternateVehicle, reviewAlternateVehicle, getMetrics, getArrivalQueue,
    createDevice, listDevices, updateDevice, rotateDeviceKey,
    heartbeat, uploadDeviceFrame, ingestEvents,
};
