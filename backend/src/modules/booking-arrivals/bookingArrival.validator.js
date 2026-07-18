const { z } = require('zod');
const {
    PLATE_SCAN_STATUS_VALUES,
    PLATE_SCAN_REJECTION_REASON_VALUES,
    CAMERA_DEVICE_STATUS_VALUES,
} = require('../../shared/constants/bookingArrival.constant');
const { VEHICLE_TYPE_VALUES } = require('../../shared/constants/vehicle.constant');

const objectId = z.string().trim().regex(/^[0-9a-fA-F]{24}$/, 'Invalid resource id');
const optionalDate = z.preprocess((value) => value === '' ? undefined : value, z.coerce.date().optional());
const idParams = z.object({ id: objectId }).strict();
const scanParams = z.object({ scanId: objectId }).strict();
const pagination = {
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
};

const staffCaptureSources = z.enum(['STAFF_CAMERA', 'GALLERY', 'LIVE_CAMERA']);
const frameIds = z.array(objectId).min(1).max(5);

const createScanSchema = z.object({
    body: z.object({
        garage_id: objectId,
        upload_ids: frameIds,
        captured_at: z.coerce.date().optional(),
        mode: z.enum(['SINGLE', 'LIVE_BATCH']).default('SINGLE'),
        capture_source: staffCaptureSources.default('STAFF_CAMERA'),
    }).strict().refine((value) => value.mode === 'LIVE_BATCH' || value.upload_ids.length === 1, {
        message: 'Multiple frames require LIVE_BATCH mode',
        path: ['upload_ids'],
    }),
});

const retryScanSchema = z.object({
    params: scanParams,
    body: z.object({
        upload_ids: frameIds,
        captured_at: z.coerce.date().optional(),
        mode: z.enum(['SINGLE', 'LIVE_BATCH']).optional(),
        capture_source: staffCaptureSources.optional(),
    }).strict(),
});

const scanIdSchema = z.object({ params: scanParams });
const listScansSchema = z.object({
    query: z.object({
        ...pagination,
        garage_id: objectId.optional(),
        status: z.enum(PLATE_SCAN_STATUS_VALUES).optional(),
        from: optionalDate,
        to: optionalDate,
    }).strict(),
});

const confirmScanSchema = z.object({
    params: scanParams,
    body: z.object({
        booking_id: objectId,
        note: z.string().trim().max(1000).optional(),
        override_reason: z.string().trim().min(5).max(1000).optional(),
    }).strict(),
});

const rejectScanSchema = z.object({
    params: scanParams,
    body: z.object({
        reason: z.enum(PLATE_SCAN_REJECTION_REASON_VALUES),
        note: z.string().trim().max(1000).optional(),
    }).strict(),
});

const alternateVehicleSchema = z.object({
    params: scanParams,
    body: z.object({
        license_plate: z.string().trim().min(4).max(30),
        vehicle_type: z.enum(VEHICLE_TYPE_VALUES),
        brand: z.string().trim().max(80).optional(),
        model: z.string().trim().max(80).optional(),
        color: z.string().trim().max(50).optional(),
        reason: z.string().trim().min(5).max(1000),
    }).strict(),
});

const alternateReviewSchema = z.object({
    params: scanParams,
    body: z.object({
        approved: z.boolean(),
        note: z.string().trim().min(3).max(1000),
    }).strict(),
});

const metricsSchema = z.object({
    query: z.object({ garage_id: objectId.optional(), from: optionalDate, to: optionalDate }).strict(),
});

const createDeviceSchema = z.object({
    body: z.object({
        device_code: z.string().trim().regex(/^[A-Za-z0-9_-]{3,40}$/),
        name: z.string().trim().min(2).max(120),
        garage_id: objectId,
        location: z.string().trim().max(200).optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
    }).strict(),
});
const listDevicesSchema = z.object({
    query: z.object({ ...pagination, garage_id: objectId.optional(), status: z.enum(CAMERA_DEVICE_STATUS_VALUES).optional() }).strict(),
});
const updateDeviceSchema = z.object({
    params: idParams,
    body: z.object({
        name: z.string().trim().min(2).max(120).optional(),
        location: z.string().trim().max(200).nullable().optional(),
        status: z.enum(CAMERA_DEVICE_STATUS_VALUES).optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
    }).strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required'),
});
const deviceIdSchema = z.object({ params: idParams });
const heartbeatSchema = z.object({
    body: z.object({
        firmware_version: z.string().trim().max(80).optional(),
        client_version: z.string().trim().max(80).optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
    }).strict(),
});
const deviceEvent = z.object({
    client_event_id: z.string().trim().min(1).max(120),
    upload_ids: frameIds,
    captured_at: z.coerce.date(),
    offline: z.boolean().default(false),
}).strict();
const ingestEventsSchema = z.object({ body: z.object({ events: z.array(deviceEvent).min(1).max(50) }).strict() });

module.exports = {
    createScanSchema,
    retryScanSchema,
    scanIdSchema,
    listScansSchema,
    confirmScanSchema,
    rejectScanSchema,
    alternateVehicleSchema,
    alternateReviewSchema,
    metricsSchema,
    createDeviceSchema,
    listDevicesSchema,
    updateDeviceSchema,
    deviceIdSchema,
    heartbeatSchema,
    ingestEventsSchema,
};
