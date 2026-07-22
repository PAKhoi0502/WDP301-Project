const tags = [
    { name: 'Booking Arrivals', description: 'Staff license-plate verification and arrival queue' },
    { name: 'Arrival Administration', description: 'Recognition metrics, alternate vehicles and gate camera registration' },
    { name: 'Camera Devices', description: 'Fixed gate camera ingestion and health APIs' },
];

const bearer = [{ bearerAuth: [] }];
const deviceSecurity = [{ cameraDeviceCode: [], cameraDeviceKey: [] }];
const scanId = { name: 'scanId', in: 'path', required: true, schema: { type: 'string' } };
const deviceId = { name: 'id', in: 'path', required: true, schema: { type: 'string' } };
const jsonBody = (schema) => ({ required: true, content: { 'application/json': { schema } } });
const response = (schema = { $ref: '#/components/schemas/BookingPlateScan' }) => ({
    200: { description: 'Success', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: schema } } } } },
    400: { description: 'Validation or image quality error' },
    401: { description: 'Authentication failed' },
    403: { description: 'Garage, capability or assignment forbidden' },
    409: { description: 'Workflow conflict' },
    502: { description: 'Image storage or recognition provider failed' },
});

const createScanRequest = {
    type: 'object',
    required: ['garage_id', 'upload_ids'],
    description: 'SINGLE mode requires exactly one upload. LIVE_BATCH mode requires 2-5 uploads.',
    properties: {
        garage_id: { type: 'string' },
        upload_ids: {
            type: 'array',
            minItems: 1,
            maxItems: 5,
            items: { type: 'string' },
            description: 'Upload resource IDs returned by POST /uploads, not image URLs.',
        },
        captured_at: { type: 'string', format: 'date-time' },
        mode: { type: 'string', enum: ['SINGLE', 'LIVE_BATCH'], default: 'SINGLE' },
        capture_source: { type: 'string', enum: ['STAFF_CAMERA', 'GALLERY', 'LIVE_CAMERA'] },
    },
};

const schemas = {
    BookingPlateScan: {
        type: 'object',
        properties: {
            id: { type: 'string' }, garage_id: { type: 'string' }, staff_id: { type: 'string', nullable: true },
            camera_device_id: { type: 'string', nullable: true }, client_event_id: { type: 'string', nullable: true },
            mode: { type: 'string', enum: ['SINGLE', 'LIVE_BATCH', 'GATE'] },
            capture_source: { type: 'string' }, captured_at: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['CAPTURED', 'QUALITY_REJECTED', 'RECOGNIZING', 'EXACT_MATCH', 'FUZZY_CANDIDATES', 'AMBIGUOUS', 'NO_MATCH', 'MULTIPLE_PLATES', 'ARRIVAL_DETECTED', 'CONFIRMED', 'REJECTED', 'EXPIRED', 'FAILED'] },
            upload_ids: { type: 'array', items: { type: 'string' } }, plate_crop_url: { type: 'string', nullable: true },
            frames: { type: 'array', items: { type: 'object', properties: { upload_id: { type: 'string' }, url: { type: 'string' }, mime_type: { type: 'string' }, size: { type: 'integer' }, width: { type: 'integer', nullable: true }, height: { type: 'integer', nullable: true }, created_at: { type: 'string', format: 'date-time' } } } },
            raw_plate_text: { type: 'string', nullable: true }, normalized_plate: { type: 'string', nullable: true },
            confidence: { type: 'number', minimum: 0, maximum: 1 }, detected_vehicle_type: { type: 'string', enum: ['CAR', 'MOTORBIKE', 'UNKNOWN'] },
            quality_flags: { type: 'array', items: { type: 'string' } }, multiple_plate_count: { type: 'integer' },
            processing_time_ms: { type: 'integer' }, retry_count: { type: 'integer' },
            candidates: { type: 'array', items: { type: 'object', properties: { booking_id: { type: 'string' }, booking: { type: 'object' }, match_type: { type: 'string' }, edit_distance: { type: 'integer' }, vehicle_type_mismatch: { type: 'boolean' } } } },
            matched_booking_id: { type: 'string', nullable: true }, match_type: { type: 'string' },
            confirmed_booking_id: { type: 'string', nullable: true }, confirmed_by_id: { type: 'string', nullable: true }, confirmed_at: { type: 'string', format: 'date-time', nullable: true },
            manual_override: { type: 'boolean' }, override_reason: { type: 'string', nullable: true },
            alternate_vehicle_status: { type: 'string', enum: ['NONE', 'REQUESTED', 'APPROVED', 'REJECTED'] },
            alternate_vehicle: {
                type: 'object',
                nullable: true,
                properties: {
                    booking_id: { type: 'string' },
                    license_plate: { type: 'string' },
                    normalized_license_plate: { type: 'string' },
                    vehicle_type: { type: 'string', enum: ['CAR', 'MOTORBIKE'] },
                    brand: { type: 'string', nullable: true },
                    model: { type: 'string', nullable: true },
                    color: { type: 'string', nullable: true },
                    reason: { type: 'string' },
                    requested_by_id: { type: 'string' },
                    requested_at: { type: 'string', format: 'date-time' },
                    reviewed_by_id: { type: 'string', nullable: true },
                    reviewed_at: { type: 'string', format: 'date-time', nullable: true },
                    review_note: { type: 'string', nullable: true },
                },
            },
            retain_until: { type: 'string', format: 'date-time' }, image_deleted_at: { type: 'string', format: 'date-time', nullable: true },
            expires_at: { type: 'string', format: 'date-time' },
        },
    },
    CameraDevice: {
        type: 'object', properties: {
            id: { type: 'string' }, device_code: { type: 'string' }, name: { type: 'string' }, garage_id: { type: 'string' },
            location: { type: 'string', nullable: true }, status: { type: 'string', enum: ['ACTIVE', 'MAINTENANCE', 'INACTIVE', 'REVOKED'] },
            health_status: { type: 'string', enum: ['ONLINE', 'STALE', 'OFFLINE', 'DISABLED'] }, last_heartbeat_at: { type: 'string', format: 'date-time', nullable: true },
        },
    },
    CreateBookingPlateScanRequest: createScanRequest,
};

const listParameters = [
    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
    { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
    { name: 'garage_id', in: 'query', schema: { type: 'string' } },
    { name: 'status', in: 'query', schema: { type: 'string' } },
    { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
    { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
];

const paths = {
    '/staff/booking-arrivals/plate-scans': {
        get: { tags: ['Booking Arrivals'], summary: 'List garage plate scans', security: bearer, parameters: listParameters, responses: response({ type: 'array', items: { $ref: '#/components/schemas/BookingPlateScan' } }) },
        post: { tags: ['Booking Arrivals'], summary: 'Recognize one photo or a live-frame batch', security: bearer, requestBody: jsonBody(createScanRequest), responses: { ...response(), 201: response()[200] } },
    },
    '/staff/booking-arrivals/arrival-queue': {
        get: { tags: ['Booking Arrivals'], summary: 'Get fixed-camera arrivals awaiting staff confirmation', security: bearer, parameters: listParameters.filter((item) => item.name !== 'status'), responses: response({ type: 'array', items: { $ref: '#/components/schemas/BookingPlateScan' } }) },
    },
    '/staff/booking-arrivals/plate-scans/{scanId}': {
        get: { tags: ['Booking Arrivals'], summary: 'Get plate scan and booking candidates', security: bearer, parameters: [scanId], responses: response() },
    },
    '/staff/booking-arrivals/plate-scans/{scanId}/retry': {
        post: {
            tags: ['Booking Arrivals'],
            summary: 'Retry recognition with new frame uploads',
            description: 'When mode is omitted, one upload becomes SINGLE and 2-5 uploads become LIVE_BATCH.',
            security: bearer,
            parameters: [scanId],
            requestBody: jsonBody({
                type: 'object',
                required: ['upload_ids'],
                properties: {
                    upload_ids: createScanRequest.properties.upload_ids,
                    captured_at: createScanRequest.properties.captured_at,
                    mode: createScanRequest.properties.mode,
                    capture_source: createScanRequest.properties.capture_source,
                },
            }),
            responses: { ...response(), 201: response()[200] },
        },
    },
    '/staff/booking-arrivals/plate-scans/{scanId}/confirm': {
        post: { tags: ['Booking Arrivals'], summary: 'Staff confirms vehicle and records booking check-in', description: 'Exact match is preferred. Fuzzy/manual selection requires an override reason unless an alternate vehicle was approved. This is the only scan endpoint that invokes check-in.', security: bearer, parameters: [scanId], requestBody: jsonBody({ type: 'object', required: ['booking_id'], properties: { booking_id: { type: 'string' }, note: { type: 'string' }, override_reason: { type: 'string' } } }), responses: response({ type: 'object' }) },
    },
    '/staff/booking-arrivals/plate-scans/{scanId}/reject': {
        post: { tags: ['Booking Arrivals'], summary: 'Reject a scan candidate or mismatch', security: bearer, parameters: [scanId], requestBody: jsonBody({ type: 'object', required: ['reason'], properties: { reason: { type: 'string', enum: ['VEHICLE_MISMATCH', 'WRONG_BOOKING', 'POOR_IMAGE', 'CUSTOMER_NOT_PRESENT', 'DUPLICATE_SCAN', 'OTHER'] }, note: { type: 'string' } } }), responses: response() },
    },
    '/staff/booking-arrivals/plate-scans/{scanId}/alternate-vehicle': {
        post: { tags: ['Booking Arrivals'], summary: 'Request approval for a replacement or different vehicle', description: 'The request is bound to one eligible booking. license_plate must match the plate recognized in this scan.', security: bearer, parameters: [scanId], requestBody: jsonBody({ type: 'object', required: ['booking_id', 'license_plate', 'vehicle_type', 'reason'], properties: { booking_id: { type: 'string' }, license_plate: { type: 'string' }, vehicle_type: { type: 'string', enum: ['CAR', 'MOTORBIKE'] }, brand: { type: 'string' }, model: { type: 'string' }, color: { type: 'string' }, reason: { type: 'string' } } }), responses: response() },
    },
    '/admin/booking-arrivals/plate-scans': {
        get: { tags: ['Arrival Administration'], summary: 'List plate scans across garages', security: bearer, parameters: listParameters, responses: response({ type: 'array', items: { $ref: '#/components/schemas/BookingPlateScan' } }) },
    },
    '/admin/booking-arrivals/metrics': {
        get: { tags: ['Arrival Administration'], summary: 'Get recognition confidence, latency, retry, mismatch and quality dashboard', security: bearer, parameters: listParameters.filter((item) => ['garage_id', 'from', 'to'].includes(item.name)), responses: response({ type: 'object' }) },
    },
    '/admin/booking-arrivals/plate-scans/{scanId}/alternate-vehicle': {
        patch: { tags: ['Arrival Administration'], summary: 'Approve or reject an alternate vehicle request', security: bearer, parameters: [scanId], requestBody: jsonBody({ type: 'object', required: ['approved', 'note'], properties: { approved: { type: 'boolean' }, note: { type: 'string' } } }), responses: response() },
    },
    '/admin/booking-arrivals/camera-devices': {
        get: { tags: ['Arrival Administration'], summary: 'List gate cameras and computed health', security: bearer, responses: response({ type: 'array', items: { $ref: '#/components/schemas/CameraDevice' } }) },
        post: { tags: ['Arrival Administration'], summary: 'Register a gate camera and return its API key once', security: bearer, requestBody: jsonBody({ type: 'object', required: ['device_code', 'name', 'garage_id'], properties: { device_code: { type: 'string' }, name: { type: 'string' }, garage_id: { type: 'string' }, location: { type: 'string' } } }), responses: { ...response({ type: 'object' }), 201: response({ type: 'object' })[200] } },
    },
    '/admin/booking-arrivals/camera-devices/{id}': {
        patch: { tags: ['Arrival Administration'], summary: 'Update or disable a gate camera', security: bearer, parameters: [deviceId], requestBody: jsonBody({ type: 'object' }), responses: response({ $ref: '#/components/schemas/CameraDevice' }) },
    },
    '/admin/booking-arrivals/camera-devices/{id}/rotate-key': {
        post: { tags: ['Arrival Administration'], summary: 'Rotate a gate camera API key', security: bearer, parameters: [deviceId], responses: response({ type: 'object' }) },
    },
    '/camera-devices/heartbeat': {
        post: { tags: ['Camera Devices'], summary: 'Report camera health and versions', security: deviceSecurity, requestBody: jsonBody({ type: 'object', properties: { firmware_version: { type: 'string' }, client_version: { type: 'string' }, metadata: { type: 'object' } } }), responses: response({ $ref: '#/components/schemas/CameraDevice' }) },
    },
    '/camera-devices/uploads': {
        post: { tags: ['Camera Devices'], summary: 'Upload one gate camera frame', security: deviceSecurity, requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } } } }, responses: { ...response({ type: 'object' }), 201: response({ type: 'object' })[200] } },
    },
    '/camera-devices/events/batch': {
        post: { tags: ['Camera Devices'], summary: 'Ingest online or offline idempotent arrival events', description: 'Each client_event_id is unique per device. Exact high-confidence matches create ARRIVAL_DETECTED only; automatic check-in is intentionally disabled.', security: deviceSecurity, requestBody: jsonBody({ type: 'object', required: ['events'], properties: { events: { type: 'array', minItems: 1, maxItems: 50, items: { type: 'object', required: ['client_event_id', 'upload_ids', 'captured_at'], properties: { client_event_id: { type: 'string' }, upload_ids: { type: 'array', minItems: 1, maxItems: 5, items: { type: 'string' } }, captured_at: { type: 'string', format: 'date-time' }, offline: { type: 'boolean' } } } } } }), responses: response({ type: 'object' }) },
    },
};

module.exports = { tags, schemas, paths };
