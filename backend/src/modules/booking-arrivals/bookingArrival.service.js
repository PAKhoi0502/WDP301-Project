const BookingPlateScan = require('./bookingPlateScan.model');
const Booking = require('../bookings/booking.model');
const Upload = require('../uploads/upload.model');
const StaffProfile = require('../staff-profiles/staffProfile.model');
const User = require('../users/user.model');
const BookingArrivalMapper = require('./bookingArrival.mapper');
const plateRecognitionService = require('./plateRecognition.service');
const bookingService = require('../bookings/booking.service');
const auditLogService = require('../audit-logs/auditLog.service');
const notificationService = require('../notifications/notification.service');
const uploadService = require('../uploads/upload.service');
const { AppError } = require('../../shared/utils/appError');
const { USER_ROLES } = require('../../shared/constants/roles.constant');
const { STAFF_TYPES } = require('../../shared/constants/staff.constant');
const { BOOKING_STATUS } = require('../../shared/constants/booking.constant');
const { UPLOAD_PURPOSES, UPLOAD_RELATED_TYPES } = require('../../shared/constants/upload.constant');
const { NOTIFICATION_TYPES, NOTIFICATION_RELATED_TYPES } = require('../../shared/constants/notification.constant');
const { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } = require('../../shared/constants/audit.constant');
const {
    PLATE_SCAN_STATUSES,
    PLATE_SCAN_MODES,
    PLATE_CAPTURE_SOURCES,
    PLATE_MATCH_TYPES,
    PLATE_QUALITY_FLAGS,
    ALTERNATE_VEHICLE_STATUSES,
    normalizeLicensePlate,
} = require('../../shared/constants/bookingArrival.constant');

const OPEN_BOOKING_STATUSES = [BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED];
const TERMINAL_SCAN_STATUSES = [
    PLATE_SCAN_STATUSES.CONFIRMED,
    PLATE_SCAN_STATUSES.REJECTED,
    PLATE_SCAN_STATUSES.EXPIRED,
];

const envInteger = (name, fallback, max = Number.MAX_SAFE_INTEGER) => {
    const value = Number(process.env[name]);
    return Number.isInteger(value) && value > 0 ? Math.min(value, max) : fallback;
};

const getPolicy = () => ({
    beforeMinutes: envInteger('PLATE_CHECK_IN_BEFORE_MINUTES', 120, 1440),
    afterMinutes: envInteger('PLATE_CHECK_IN_AFTER_MINUTES', 180, 1440),
    retainDays: envInteger('PLATE_SCAN_RETENTION_DAYS', 7, 365),
    scanExpiryMinutes: envInteger('PLATE_SCAN_CONFIRM_EXPIRY_MINUTES', 30, 1440),
    gateScanExpiryMinutes: envInteger('PLATE_GATE_SCAN_EXPIRY_MINUTES', 360, 10080),
    minFileBytes: envInteger('PLATE_SCAN_MIN_FILE_BYTES', 15000, 1000000),
    minWidth: envInteger('PLATE_SCAN_MIN_WIDTH', 640, 10000),
    minHeight: envInteger('PLATE_SCAN_MIN_HEIGHT', 360, 10000),
    gateConfidence: Math.min(Math.max(Number(process.env.PLATE_GATE_MIN_CONFIDENCE) || 0.92, 0), 1),
});

const addMinutes = (date, minutes) => new Date(new Date(date).getTime() + minutes * 60000);
const addDays = (date, days) => new Date(new Date(date).getTime() + days * 86400000);
const toId = (value) => value?._id?.toString?.() || value?.toString?.() || null;

const getStaffGarageId = async (user) => {
    if (user.role === USER_ROLES.ADMIN) return null;
    const profile = await StaffProfile.findOne({ user_id: user._id });

    if (!profile?.garage_id || !profile.is_active) {
        throw new AppError('Active staff garage assignment is required', 403, 'STAFF_GARAGE_REQUIRED');
    }
    return toId(profile.garage_id);
};

const assertGarageAccess = async (user, garageId) => {
    const staffGarageId = await getStaffGarageId(user);

    if (staffGarageId && staffGarageId !== toId(garageId)) {
        throw new AppError('You can only access arrivals in your assigned garage', 403, 'BOOKING_ARRIVAL_GARAGE_FORBIDDEN');
    }
};

const populateScan = (query) => query.populate({
    path: 'candidates.booking_id',
    populate: [
        { path: 'customer_id', select: 'full_name email phone role is_active' },
        { path: 'vehicle_id' },
        { path: 'garage_id' },
    ],
});

const getScanDocument = async (scanId) => {
    const scan = await populateScan(BookingPlateScan.findById(scanId));
    if (!scan) throw new AppError('Plate scan not found', 404, 'BOOKING_PLATE_SCAN_NOT_FOUND');
    return scan;
};

const getAccessibleScan = async (user, scanId) => {
    const scan = await getScanDocument(scanId);
    await assertGarageAccess(user, scan.garage_id);
    return scan;
};

const validateCapturedAt = (capturedAt, source) => {
    const value = new Date(capturedAt || Date.now());
    const now = Date.now();
    const maximumAgeMs = source === PLATE_CAPTURE_SOURCES.OFFLINE_GATE
        ? 7 * 86400000
        : envInteger('PLATE_CAPTURE_MAX_AGE_MINUTES', 10, 1440) * 60000;

    if (Number.isNaN(value.getTime()) || value.getTime() > now + 5 * 60000) {
        throw new AppError('Invalid capture time', 400, 'PLATE_SCAN_CAPTURE_TIME_INVALID');
    }
    if (value.getTime() < now - maximumAgeMs) {
        throw new AppError('Capture time is outside the accepted ingestion window', 409, 'PLATE_SCAN_CAPTURE_TOO_OLD');
    }
    return value;
};

const getBasicQualityFlags = (upload, policy) => {
    const flags = [];
    if (upload.size < policy.minFileBytes) flags.push(PLATE_QUALITY_FLAGS.FILE_TOO_SMALL);
    if (upload.width && upload.height && (upload.width < policy.minWidth || upload.height < policy.minHeight)) {
        flags.push(PLATE_QUALITY_FLAGS.IMAGE_TOO_SMALL);
    }
    return flags;
};

const validateUploads = async ({ user, garageId, uploadIds, device = null }) => {
    const uniqueIds = [...new Set(uploadIds.map(String))];
    const uploads = await Upload.find({ _id: { $in: uniqueIds } });

    if (uploads.length !== uniqueIds.length) {
        throw new AppError('One or more frame uploads were not found', 404, 'PLATE_SCAN_UPLOAD_NOT_FOUND');
    }

    for (const upload of uploads) {
        if (!upload.mime_type.startsWith('image/')) {
            throw new AppError('Plate scan frames must be images', 400, 'PLATE_SCAN_IMAGE_REQUIRED');
        }
        if (upload.purpose !== UPLOAD_PURPOSES.BOOKING_PLATE_SCAN) {
            throw new AppError('Upload purpose must be BOOKING_PLATE_SCAN', 409, 'PLATE_SCAN_UPLOAD_PURPOSE_INVALID');
        }
        if (upload.related_id) {
            throw new AppError('Upload is already linked to another resource', 409, 'PLATE_SCAN_UPLOAD_ALREADY_LINKED');
        }
        const expectedOwner = device ? device.created_by_id : user._id;
        const ownerMismatch = toId(upload.owner_id) !== toId(expectedOwner);
        if ((device && ownerMismatch) || (!device && ownerMismatch && user?.role !== USER_ROLES.ADMIN)) {
            throw new AppError('You do not own this frame upload', 403, 'PLATE_SCAN_UPLOAD_FORBIDDEN');
        }
    }

    await assertGarageAccess(user || { role: USER_ROLES.ADMIN }, garageId);
    return uniqueIds.map((id) => uploads.find((upload) => toId(upload._id) === id));
};

const editDistance = (left, right) => {
    const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let i = 1; i <= left.length; i += 1) {
        let diagonal = previous[0];
        previous[0] = i;
        for (let j = 1; j <= right.length; j += 1) {
            const above = previous[j];
            previous[j] = Math.min(
                previous[j] + 1,
                previous[j - 1] + 1,
                diagonal + (left[i - 1] === right[j - 1] ? 0 : 1)
            );
            diagonal = above;
        }
    }
    return previous[right.length];
};

const findCandidates = async ({ garageId, plate, vehicleType, capturedAt }) => {
    if (!plate) return [];
    const policy = getPolicy();
    const earliestStart = addMinutes(capturedAt, -policy.afterMinutes);
    const latestStart = addMinutes(capturedAt, policy.beforeMinutes);
    const filter = {
        garage_id: garageId,
        status: { $in: OPEN_BOOKING_STATUSES },
        start_time: { $gte: earliestStart, $lte: latestStart },
    };
    const bookings = await Booking.find(filter).sort({ start_time: 1 });
    const candidates = bookings.map((booking) => {
        const distance = editDistance(plate, booking.normalized_license_plate || '');
        return {
            booking_id: booking._id,
            match_type: distance === 0 ? PLATE_MATCH_TYPES.EXACT : PLATE_MATCH_TYPES.FUZZY,
            edit_distance: distance,
            scheduled_distance_minutes: Math.abs(
                Math.round((new Date(booking.start_time).getTime() - new Date(capturedAt).getTime()) / 60000)
            ),
            vehicle_type_mismatch: vehicleType && vehicleType !== 'UNKNOWN'
                ? booking.vehicle_type !== vehicleType : false,
        };
    }).filter((candidate) => candidate.edit_distance === 0
        || (candidate.edit_distance === 1 && !candidate.vehicle_type_mismatch));

    return candidates.sort((a, b) => a.edit_distance - b.edit_distance
        || a.scheduled_distance_minutes - b.scheduled_distance_minutes);
};

const voteFrameResults = (frameResults) => {
    const usable = frameResults.filter((item) => item.normalized_plate && !item.error_code);
    if (!usable.length) return null;
    const groups = new Map();

    usable.forEach((item) => {
        const group = groups.get(item.normalized_plate) || { frames: [], score: 0 };
        group.frames.push(item);
        group.score += item.confidence;
        groups.set(item.normalized_plate, group);
    });

    const ranked = [...groups.entries()].sort((a, b) => b[1].frames.length - a[1].frames.length
        || b[1].score - a[1].score);
    const [plate, winner] = ranked[0];
    if (usable.length > 1 && winner.frames.length < 2) return { ambiguous: true };
    const best = [...winner.frames].sort((a, b) => b.confidence - a.confidence)[0];

    return {
        ...best,
        normalized_plate: plate,
        confidence: winner.score / winner.frames.length,
        processing_time_ms: frameResults.reduce((sum, item) => sum + (item.processing_time_ms || 0), 0),
    };
};

const buildCropUrl = (upload, boundingBox) => {
    if (!boundingBox || !upload?.width || !upload?.height || !upload.url?.includes('/upload/')) return null;
    const x = Math.round(boundingBox.x * upload.width);
    const y = Math.round(boundingBox.y * upload.height);
    const width = Math.max(1, Math.round(boundingBox.width * upload.width));
    const height = Math.max(1, Math.round(boundingBox.height * upload.height));
    return upload.url.replace('/upload/', `/upload/c_crop,x_${x},y_${y},w_${width},h_${height}/`);
};

const recognizeScan = async (scan, uploads) => {
    const policy = getPolicy();
    const basicFlags = [...new Set(uploads.flatMap((upload) => getBasicQualityFlags(upload, policy)))];
    if (basicFlags.length) {
        scan.status = PLATE_SCAN_STATUSES.QUALITY_REJECTED;
        scan.quality_flags = basicFlags;
        await scan.save();
        return scan;
    }

    scan.status = PLATE_SCAN_STATUSES.RECOGNIZING;
    await scan.save();
    const frameResults = [];

    for (const upload of uploads) {
        try {
            const result = await plateRecognitionService.recognizeImage({
                url: upload.url,
                mimeType: upload.mime_type,
            });
            frameResults.push({
                upload_id: upload._id,
                raw_plate_text: result.raw_plate_text,
                normalized_plate: result.normalized_plate,
                confidence: result.confidence,
                character_confidences: result.character_confidences,
                vehicle_type: result.vehicle_type,
                quality_flags: result.quality_flags,
                multiple_plate_count: result.multiple_plate_count,
                bounding_box: result.bounding_box,
                processing_time_ms: result.processing_time_ms,
            });
            scan.provider = result.provider;
            scan.model_version = result.model_version;
            scan.weather = result.weather;
            scan.time_of_day = result.time_of_day;
        } catch (error) {
            frameResults.push({
                upload_id: upload._id,
                error_code: error.errorCode || 'PLATE_RECOGNITION_FAILED',
                processing_time_ms: 0,
            });
        }
    }

    scan.frame_results = frameResults;
    const selected = voteFrameResults(frameResults);
    if (!selected) {
        const completedFrames = frameResults.filter((item) => !item.error_code);
        scan.status = completedFrames.length
            ? PLATE_SCAN_STATUSES.QUALITY_REJECTED : PLATE_SCAN_STATUSES.FAILED;
        scan.quality_flags = completedFrames.length
            ? [...new Set([
                ...completedFrames.flatMap((item) => item.quality_flags || []),
                PLATE_QUALITY_FLAGS.NO_PLATE_DETECTED,
            ])] : [];
        scan.failure_code = completedFrames.length
            ? 'PLATE_NOT_DETECTED' : (frameResults[0]?.error_code || 'PLATE_RECOGNITION_FAILED');
        scan.failure_message = completedFrames.length
            ? 'No plate was readable in the supplied frame' : 'No frame could be processed by the recognition provider';
        await scan.save();
        return scan;
    }
    if (selected.ambiguous) {
        scan.status = PLATE_SCAN_STATUSES.AMBIGUOUS;
        scan.failure_code = 'FRAME_VOTING_NO_CONSENSUS';
        scan.failure_message = 'Live frames did not agree on one license plate';
        await scan.save();
        return scan;
    }

    scan.raw_plate_text = selected.raw_plate_text;
    scan.normalized_plate = selected.normalized_plate;
    scan.confidence = selected.confidence;
    scan.character_confidences = selected.character_confidences || [];
    scan.detected_vehicle_type = selected.vehicle_type;
    scan.quality_flags = selected.quality_flags || [];
    scan.multiple_plate_count = selected.multiple_plate_count || 0;
    scan.processing_time_ms = selected.processing_time_ms;
    scan.primary_upload_id = selected.upload_id;
    const primaryUpload = uploads.find((upload) => toId(upload._id) === toId(selected.upload_id));
    scan.plate_crop_url = buildCropUrl(primaryUpload, selected.bounding_box);

    if (scan.multiple_plate_count > 1 || scan.quality_flags.includes(PLATE_QUALITY_FLAGS.MULTIPLE_PLATES)) {
        scan.status = PLATE_SCAN_STATUSES.MULTIPLE_PLATES;
        await scan.save();
        return scan;
    }
    if (!scan.normalized_plate || scan.quality_flags.includes(PLATE_QUALITY_FLAGS.NO_PLATE_DETECTED)) {
        scan.status = PLATE_SCAN_STATUSES.QUALITY_REJECTED;
        await scan.save();
        return scan;
    }

    scan.candidates = await findCandidates({
        garageId: scan.garage_id,
        plate: scan.normalized_plate,
        vehicleType: scan.detected_vehicle_type,
        capturedAt: scan.captured_at,
    });
    const exact = scan.candidates.filter((candidate) => candidate.match_type === PLATE_MATCH_TYPES.EXACT);
    if (exact.length === 1) {
        scan.status = PLATE_SCAN_STATUSES.EXACT_MATCH;
        scan.matched_booking_id = exact[0].booking_id;
        scan.match_type = PLATE_MATCH_TYPES.EXACT;
    } else if (exact.length > 1) {
        scan.status = PLATE_SCAN_STATUSES.AMBIGUOUS;
    } else if (scan.candidates.length) {
        scan.status = PLATE_SCAN_STATUSES.FUZZY_CANDIDATES;
    } else {
        scan.status = PLATE_SCAN_STATUSES.NO_MATCH;
    }
    await scan.save();
    return scan;
};

const linkUploads = async (scan, uploads) => {
    await Upload.updateMany(
        { _id: { $in: uploads.map((upload) => upload._id) }, related_id: null },
        { $set: {
            related_type: UPLOAD_RELATED_TYPES.BOOKING_PLATE_SCAN,
            related_id: scan._id,
            retained_until: scan.retain_until,
        } }
    );
};

const recordScanAudit = (scan, actorId, action, context = {}, extra = {}) => auditLogService.recordAuditEvent({
    actorId,
    action,
    resourceType: AUDIT_RESOURCE_TYPES.BOOKING_PLATE_SCAN,
    resourceId: scan._id,
    after: BookingArrivalMapper.toScanDto(scan),
    ip: context.ip,
    userAgent: context.userAgent,
    metadata: extra,
});

const createScan = async ({ user, device = null, payload, auditContext = {} }) => {
    const garageId = device?.garage_id || payload.garage_id;
    const capturedAt = validateCapturedAt(payload.captured_at, payload.capture_source);
    const uploads = await validateUploads({ user, device, garageId, uploadIds: payload.upload_ids });
    const now = new Date();
    const policy = getPolicy();
    const scan = await BookingPlateScan.create({
        garage_id: garageId,
        staff_id: device ? null : user._id,
        camera_device_id: device?._id || null,
        client_event_id: payload.client_event_id || null,
        mode: payload.mode || PLATE_SCAN_MODES.SINGLE,
        capture_source: payload.capture_source || PLATE_CAPTURE_SOURCES.STAFF_CAMERA,
        captured_at: capturedAt,
        server_received_at: now,
        upload_ids: uploads.map((upload) => upload._id),
        primary_upload_id: uploads[0]._id,
        retain_until: addDays(now, policy.retainDays),
        expires_at: addMinutes(now, device ? policy.gateScanExpiryMinutes : policy.scanExpiryMinutes),
        retry_of_scan_id: payload.retry_of_scan_id || null,
        retry_count: payload.retry_count || 0,
    });

    await linkUploads(scan, uploads);
    await recordScanAudit(scan, device?.created_by_id || user._id, AUDIT_ACTIONS.BOOKING_PLATE_SCAN_CREATED, auditContext, {
        device_id: toId(device?._id),
    });

    await recognizeScan(scan, uploads);
    await recordScanAudit(scan, device?.created_by_id || user._id, AUDIT_ACTIONS.BOOKING_PLATE_SCAN_RECOGNIZED, auditContext);

    if (device && scan.status === PLATE_SCAN_STATUSES.EXACT_MATCH && scan.confidence >= policy.gateConfidence) {
        await markArrivalDetected(scan, device, auditContext);
    }

    return BookingArrivalMapper.toScanDto(await getScanDocument(scan._id));
};

const markArrivalDetected = async (scan, device, auditContext) => {
    const booking = await Booking.findOneAndUpdate(
        {
            _id: scan.matched_booking_id,
            garage_id: device.garage_id,
            status: { $in: OPEN_BOOKING_STATUSES },
            arrival_detection_scan_id: null,
        },
        { $set: { arrival_detected_at: scan.captured_at, arrival_detection_scan_id: scan._id } },
        { new: true }
    );
    if (!booking) return false;

    scan.status = PLATE_SCAN_STATUSES.ARRIVAL_DETECTED;
    await scan.save();
    device.last_event_at = new Date();
    await device.save();

    await auditLogService.recordAuditEvent({
        actorId: device.created_by_id,
        action: AUDIT_ACTIONS.CAMERA_DEVICE_EVENT_INGESTED,
        resourceType: AUDIT_RESOURCE_TYPES.BOOKING,
        resourceId: booking._id,
        after: { arrival_detected_at: booking.arrival_detected_at, arrival_detection_scan_id: scan._id },
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
        metadata: { device_id: toId(device._id), auto_check_in: false },
    });

    const [profiles, admins] = await Promise.all([
        StaffProfile.find({ garage_id: booking.garage_id, staff_type: STAFF_TYPES.CUSTOMER_SERVICE_STAFF, is_active: true })
            .select('user_id'),
        User.find({ role: USER_ROLES.ADMIN, is_active: true }).select('_id'),
    ]);
    const recipients = [...new Set([...profiles.map((item) => toId(item.user_id)), ...admins.map((item) => toId(item._id))])];
    await Promise.allSettled(recipients.map((userId) => notificationService.createInAppNotification({
        userId,
        type: NOTIFICATION_TYPES.BOOKING_ARRIVAL_DETECTED,
        title: 'Vehicle arrival detected',
        message: `Gate camera detected plate ${scan.normalized_plate}. Staff confirmation is required.`,
        relatedType: NOTIFICATION_RELATED_TYPES.BOOKING_PLATE_SCAN,
        relatedId: scan._id,
        metadata: { booking_id: toId(booking._id), garage_id: toId(booking.garage_id), device_id: toId(device._id) },
    })));
    return true;
};

const getScan = async (user, scanId) => BookingArrivalMapper.toScanDto(await getAccessibleScan(user, scanId));

const listScans = async (user, query = {}) => {
    const filter = {};
    const staffGarageId = await getStaffGarageId(user);
    if (staffGarageId) filter.garage_id = staffGarageId;
    else if (query.garage_id) filter.garage_id = query.garage_id;
    if (query.status) filter.status = query.status;
    if (query.status === PLATE_SCAN_STATUSES.ARRIVAL_DETECTED) filter.expires_at = { $gt: new Date() };
    if (query.from || query.to) {
        filter.captured_at = {};
        if (query.from) filter.captured_at.$gte = query.from;
        if (query.to) filter.captured_at.$lte = query.to;
    }
    const page = query.page || 1;
    const limit = query.limit || 20;
    const [items, total] = await Promise.all([
        populateScan(BookingPlateScan.find(filter).sort({ captured_at: -1 }).skip((page - 1) * limit).limit(limit)),
        BookingPlateScan.countDocuments(filter),
    ]);
    return {
        data: items.map(BookingArrivalMapper.toScanDto),
        meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
};

const retryScan = async (user, scanId, payload, auditContext) => {
    const original = await getAccessibleScan(user, scanId);
    if (TERMINAL_SCAN_STATUSES.includes(original.status)) {
        throw new AppError('Terminal plate scan cannot be retried', 409, 'BOOKING_PLATE_SCAN_RETRY_NOT_ALLOWED');
    }
    return createScan({
        user,
        payload: {
            garage_id: toId(original.garage_id),
            upload_ids: payload.upload_ids,
            captured_at: payload.captured_at || new Date(),
            mode: payload.mode || original.mode,
            capture_source: payload.capture_source || original.capture_source,
            retry_of_scan_id: original._id,
            retry_count: (original.retry_count || 0) + 1,
        },
        auditContext,
    });
};

const confirmScan = async (user, scanId, payload, auditContext = {}) => {
    const scan = await getAccessibleScan(user, scanId);
    if (TERMINAL_SCAN_STATUSES.includes(scan.status)) {
        throw new AppError('Plate scan is already finalized', 409, 'BOOKING_PLATE_SCAN_FINALIZED');
    }
    if (scan.expires_at < new Date()) {
        const wasArrivalDetected = scan.status === PLATE_SCAN_STATUSES.ARRIVAL_DETECTED;
        scan.status = PLATE_SCAN_STATUSES.EXPIRED;
        await scan.save();
        if (wasArrivalDetected && scan.matched_booking_id) {
            await Booking.updateOne(
                { _id: scan.matched_booking_id, arrival_detection_scan_id: scan._id },
                { $set: { arrival_detected_at: null, arrival_detection_scan_id: null } }
            );
        }
        await recordScanAudit(scan, user._id, AUDIT_ACTIONS.BOOKING_PLATE_SCAN_EXPIRED, auditContext);
        throw new AppError('Plate scan confirmation window has expired', 409, 'BOOKING_PLATE_SCAN_EXPIRED');
    }

    const booking = await Booking.findById(payload.booking_id);
    if (!booking) throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    if (toId(booking.garage_id) !== toId(scan.garage_id)) {
        throw new AppError('Booking and scan must belong to the same garage', 409, 'PLATE_SCAN_BOOKING_GARAGE_MISMATCH');
    }
    if (!OPEN_BOOKING_STATUSES.includes(booking.status)) {
        throw new AppError('Booking cannot be checked in', 409, 'BOOKING_CHECK_IN_NOT_ALLOWED');
    }

    const policy = getPolicy();
    const bookingStart = new Date(booking.start_time);
    const earliestStart = addMinutes(scan.captured_at, -policy.afterMinutes);
    const latestStart = addMinutes(scan.captured_at, policy.beforeMinutes);
    if (bookingStart < earliestStart || bookingStart > latestStart) {
        throw new AppError(
            'Booking is outside the scan check-in window; use manual fallback after verification',
            409,
            'PLATE_SCAN_BOOKING_OUTSIDE_CHECK_IN_WINDOW'
        );
    }

    const exactMatch = booking.normalized_license_plate === scan.normalized_plate;
    const alternateApproved = scan.alternate_vehicle_status === ALTERNATE_VEHICLE_STATUSES.APPROVED
        && scan.alternate_vehicle?.normalized_license_plate === scan.normalized_plate;
    const manualOverride = !exactMatch;
    if (manualOverride && !alternateApproved && !payload.override_reason) {
        throw new AppError('Override reason is required for a non-exact match', 400, 'PLATE_SCAN_OVERRIDE_REASON_REQUIRED');
    }

    const selectedCandidate = scan.candidates.find((item) => toId(item.booking_id) === toId(booking._id));
    const matchType = exactMatch ? PLATE_MATCH_TYPES.EXACT
        : (selectedCandidate?.match_type === PLATE_MATCH_TYPES.FUZZY
            ? PLATE_MATCH_TYPES.FUZZY : PLATE_MATCH_TYPES.MANUAL);
    const overrideReason = manualOverride
        ? (payload.override_reason || scan.alternate_vehicle?.reason || null) : null;
    const result = await bookingService.checkInBooking(user, booking._id, {
        note: payload.note,
        verification: {
            scan_id: scan._id,
            arrived_at: scan.captured_at,
            detected_plate: scan.normalized_plate,
            match_type: matchType,
            manual_override: manualOverride,
            override_reason: overrideReason,
        },
    }, auditContext);

    scan.status = PLATE_SCAN_STATUSES.CONFIRMED;
    scan.confirmed_booking_id = booking._id;
    scan.confirmed_by_id = user._id;
    scan.confirmed_at = new Date();
    scan.staff_confirmed_vehicle = true;
    scan.match_type = matchType;
    scan.manual_override = manualOverride;
    scan.override_reason = overrideReason;
    await scan.save();
    await recordScanAudit(scan, user._id, AUDIT_ACTIONS.BOOKING_PLATE_SCAN_CONFIRMED, auditContext, {
        booking_id: toId(booking._id), match_type: matchType, manual_override: manualOverride,
    });

    return { scan: BookingArrivalMapper.toScanDto(scan), booking: result };
};

const rejectScan = async (user, scanId, payload, auditContext = {}) => {
    const scan = await getAccessibleScan(user, scanId);
    if (TERMINAL_SCAN_STATUSES.includes(scan.status)) {
        throw new AppError('Plate scan is already finalized', 409, 'BOOKING_PLATE_SCAN_FINALIZED');
    }
    const wasArrivalDetected = scan.status === PLATE_SCAN_STATUSES.ARRIVAL_DETECTED;
    scan.status = PLATE_SCAN_STATUSES.REJECTED;
    scan.rejection_reason = payload.reason;
    scan.rejection_note = payload.note || null;
    scan.rejected_by_id = user._id;
    scan.rejected_at = new Date();
    await scan.save();
    if (wasArrivalDetected && scan.matched_booking_id) {
        await Booking.updateOne(
            { _id: scan.matched_booking_id, arrival_detection_scan_id: scan._id },
            { $set: { arrival_detected_at: null, arrival_detection_scan_id: null } }
        );
    }
    await recordScanAudit(scan, user._id, AUDIT_ACTIONS.BOOKING_PLATE_SCAN_REJECTED, auditContext);
    return BookingArrivalMapper.toScanDto(scan);
};

const requestAlternateVehicle = async (user, scanId, payload, auditContext = {}) => {
    const scan = await getAccessibleScan(user, scanId);
    if (TERMINAL_SCAN_STATUSES.includes(scan.status)) {
        throw new AppError('Finalized scan cannot request an alternate vehicle', 409, 'ALTERNATE_VEHICLE_REQUEST_NOT_ALLOWED');
    }
    scan.alternate_vehicle_status = ALTERNATE_VEHICLE_STATUSES.REQUESTED;
    scan.alternate_vehicle = {
        ...payload,
        normalized_license_plate: normalizeLicensePlate(payload.license_plate),
        requested_by_id: user._id,
        requested_at: new Date(),
    };
    await scan.save();
    await recordScanAudit(scan, user._id, AUDIT_ACTIONS.BOOKING_ALTERNATE_VEHICLE_REQUESTED, auditContext);
    return BookingArrivalMapper.toScanDto(scan);
};

const reviewAlternateVehicle = async (user, scanId, payload, auditContext = {}) => {
    const scan = await getAccessibleScan(user, scanId);
    if (scan.alternate_vehicle_status !== ALTERNATE_VEHICLE_STATUSES.REQUESTED) {
        throw new AppError('Alternate vehicle request is not pending', 409, 'ALTERNATE_VEHICLE_REVIEW_NOT_ALLOWED');
    }
    scan.alternate_vehicle_status = payload.approved
        ? ALTERNATE_VEHICLE_STATUSES.APPROVED : ALTERNATE_VEHICLE_STATUSES.REJECTED;
    scan.alternate_vehicle.reviewed_by_id = user._id;
    scan.alternate_vehicle.reviewed_at = new Date();
    scan.alternate_vehicle.review_note = payload.note || null;
    await scan.save();
    await recordScanAudit(scan, user._id, AUDIT_ACTIONS.BOOKING_ALTERNATE_VEHICLE_REVIEWED, auditContext);
    return BookingArrivalMapper.toScanDto(scan);
};

const getMetrics = async (user, query = {}) => {
    const match = {};
    const staffGarageId = await getStaffGarageId(user);
    if (staffGarageId) match.garage_id = staffGarageId;
    else if (query.garage_id) match.garage_id = query.garage_id;
    if (query.from || query.to) {
        match.captured_at = {};
        if (query.from) match.captured_at.$gte = query.from;
        if (query.to) match.captured_at.$lte = query.to;
    }
    const [summary, status, quality, dimensions] = await Promise.all([
        BookingPlateScan.aggregate([
            { $match: match },
            { $group: {
                _id: null,
                total: { $sum: 1 },
                average_confidence: { $avg: '$confidence' },
                average_latency_ms: { $avg: '$processing_time_ms' },
                retries: { $sum: { $cond: [{ $gt: ['$retry_count', 0] }, 1, 0] } },
                mismatches: { $sum: { $cond: [{ $or: [
                    { $eq: ['$rejection_reason', 'VEHICLE_MISMATCH'] },
                    '$manual_override',
                ] }, 1, 0] } },
                confirmed: { $sum: { $cond: [{ $eq: ['$status', PLATE_SCAN_STATUSES.CONFIRMED] }, 1, 0] } },
            } },
        ]),
        BookingPlateScan.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
        BookingPlateScan.aggregate([{ $match: match }, { $unwind: '$quality_flags' }, { $group: { _id: '$quality_flags', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
        BookingPlateScan.aggregate([{ $match: match }, { $group: {
            _id: { garage_id: '$garage_id', vehicle_type: '$detected_vehicle_type', weather: '$weather', time_of_day: '$time_of_day' },
            total: { $sum: 1 }, confidence: { $avg: '$confidence' }, latency_ms: { $avg: '$processing_time_ms' },
            confirmed: { $sum: { $cond: [{ $eq: ['$status', PLATE_SCAN_STATUSES.CONFIRMED] }, 1, 0] } },
        } }, { $sort: { total: -1 } }]),
    ]);
    const value = summary[0] || { total: 0, average_confidence: 0, average_latency_ms: 0, retries: 0, mismatches: 0, confirmed: 0 };
    return {
        ...value,
        retry_rate: value.total ? value.retries / value.total : 0,
        mismatch_rate: value.total ? value.mismatches / value.total : 0,
        confirmation_rate: value.total ? value.confirmed / value.total : 0,
        by_status: status.map((item) => ({ status: item._id, count: item.count })),
        quality_flags: quality.map((item) => ({ flag: item._id, count: item.count })),
        dimensions,
    };
};

const purgeExpiredImages = async ({ limit = 50 } = {}) => {
    const scans = await BookingPlateScan.find({ retain_until: { $lte: new Date() }, image_deleted_at: null })
        .sort({ retain_until: 1 }).limit(limit);
    let purged = 0;
    let failed = 0;
    for (const scan of scans) {
        const uploads = await Upload.find({ _id: { $in: scan.upload_ids } });
        let succeeded = true;
        for (const upload of uploads) {
            try {
                await uploadService.deleteCloudinaryAsset(upload);
                await Upload.deleteOne({ _id: upload._id });
            } catch (error) {
                succeeded = false;
                failed += 1;
            }
        }
        if (succeeded) {
            scan.image_deleted_at = new Date();
            scan.plate_crop_url = null;
            await scan.save();
            await auditLogService.recordAuditEvent({
                actorId: null,
                action: AUDIT_ACTIONS.BOOKING_PLATE_SCAN_IMAGES_PURGED,
                resourceType: AUDIT_RESOURCE_TYPES.BOOKING_PLATE_SCAN,
                resourceId: scan._id,
                after: { image_deleted_at: scan.image_deleted_at, retained_metadata: true },
                metadata: { scheduler: true, upload_count: uploads.length },
            });
            purged += 1;
        }
    }
    return { scanned: scans.length, purged, failed };
};

const expirePendingScans = async ({ limit = 50 } = {}) => {
    const scans = await BookingPlateScan.find({
        expires_at: { $lte: new Date() },
        status: { $in: [
            PLATE_SCAN_STATUSES.EXACT_MATCH,
            PLATE_SCAN_STATUSES.FUZZY_CANDIDATES,
            PLATE_SCAN_STATUSES.AMBIGUOUS,
            PLATE_SCAN_STATUSES.NO_MATCH,
            PLATE_SCAN_STATUSES.MULTIPLE_PLATES,
            PLATE_SCAN_STATUSES.ARRIVAL_DETECTED,
        ] },
    }).sort({ expires_at: 1 }).limit(limit);

    for (const scan of scans) {
        if (scan.status === PLATE_SCAN_STATUSES.ARRIVAL_DETECTED && scan.matched_booking_id) {
            await Booking.updateOne(
                { _id: scan.matched_booking_id, arrival_detection_scan_id: scan._id },
                { $set: { arrival_detected_at: null, arrival_detection_scan_id: null } }
            );
        }
        scan.status = PLATE_SCAN_STATUSES.EXPIRED;
        await scan.save();
        await auditLogService.recordAuditEvent({
            actorId: null,
            action: AUDIT_ACTIONS.BOOKING_PLATE_SCAN_EXPIRED,
            resourceType: AUDIT_RESOURCE_TYPES.BOOKING_PLATE_SCAN,
            resourceId: scan._id,
            after: { status: scan.status, expires_at: scan.expires_at },
            metadata: { scheduler: true },
        });
    }
    return { processed: scans.length, expired: scans.length };
};

module.exports = {
    createScan,
    getScan,
    listScans,
    retryScan,
    confirmScan,
    rejectScan,
    requestAlternateVehicle,
    reviewAlternateVehicle,
    getMetrics,
    expirePendingScans,
    purgeExpiredImages,
    markArrivalDetected,
    findCandidates,
    editDistance,
    voteFrameResults,
};
