const express = require('express');

const controller = require('./bookingArrival.controller');
const validator = require('./bookingArrival.validator');
const { validate } = require('../../shared/middlewares/validate.middleware');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');
const { requireStaffCapabilities } = require('../../shared/middlewares/staffCapability.middleware');
const { authenticateCameraDevice } = require('./cameraDevice.middleware');
const { uploadSingleFile } = require('../uploads/upload.middleware');
const { USER_ROLES } = require('../../shared/constants/roles.constant');
const { STAFF_CAPABILITIES } = require('../../shared/constants/staff.constant');

const staffRouter = express.Router();
const adminRouter = express.Router();
const deviceRouter = express.Router();

staffRouter.use(authenticate, authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN));

staffRouter.get(
    '/arrival-queue',
    requireStaffCapabilities(STAFF_CAPABILITIES.BOOKING_ARRIVAL_QUEUE),
    validate(validator.listScansSchema),
    controller.getArrivalQueue
);
staffRouter.get(
    '/plate-scans',
    requireStaffCapabilities(STAFF_CAPABILITIES.BOOKING_PLATE_SCAN),
    validate(validator.listScansSchema),
    controller.listScans
);
staffRouter.post(
    '/plate-scans',
    requireStaffCapabilities(STAFF_CAPABILITIES.BOOKING_PLATE_SCAN),
    validate(validator.createScanSchema),
    controller.createScan
);
staffRouter.get(
    '/plate-scans/:scanId',
    requireStaffCapabilities(STAFF_CAPABILITIES.BOOKING_PLATE_SCAN),
    validate(validator.scanIdSchema),
    controller.getScan
);
staffRouter.post(
    '/plate-scans/:scanId/retry',
    requireStaffCapabilities(STAFF_CAPABILITIES.BOOKING_PLATE_SCAN),
    validate(validator.retryScanSchema),
    controller.retryScan
);
staffRouter.post(
    '/plate-scans/:scanId/confirm',
    requireStaffCapabilities(STAFF_CAPABILITIES.BOOKING_CHECK_IN),
    validate(validator.confirmScanSchema),
    controller.confirmScan
);
staffRouter.post(
    '/plate-scans/:scanId/reject',
    requireStaffCapabilities(STAFF_CAPABILITIES.BOOKING_PLATE_SCAN),
    validate(validator.rejectScanSchema),
    controller.rejectScan
);
staffRouter.post(
    '/plate-scans/:scanId/alternate-vehicle',
    requireStaffCapabilities(STAFF_CAPABILITIES.BOOKING_CHECK_IN),
    validate(validator.alternateVehicleSchema),
    controller.requestAlternateVehicle
);

adminRouter.use(authenticate, authorize(USER_ROLES.ADMIN));
adminRouter.get('/plate-scans', validate(validator.listScansSchema), controller.listScans);
adminRouter.get('/metrics', validate(validator.metricsSchema), controller.getMetrics);
adminRouter.patch(
    '/plate-scans/:scanId/alternate-vehicle',
    validate(validator.alternateReviewSchema),
    controller.reviewAlternateVehicle
);
adminRouter.get('/camera-devices', validate(validator.listDevicesSchema), controller.listDevices);
adminRouter.post('/camera-devices', validate(validator.createDeviceSchema), controller.createDevice);
adminRouter.patch('/camera-devices/:id', validate(validator.updateDeviceSchema), controller.updateDevice);
adminRouter.post('/camera-devices/:id/rotate-key', validate(validator.deviceIdSchema), controller.rotateDeviceKey);

deviceRouter.use(authenticateCameraDevice);
deviceRouter.post('/heartbeat', validate(validator.heartbeatSchema), controller.heartbeat);
deviceRouter.post('/uploads', uploadSingleFile, controller.uploadDeviceFrame);
deviceRouter.post('/events/batch', validate(validator.ingestEventsSchema), controller.ingestEvents);

module.exports = { staffRouter, adminRouter, deviceRouter };
