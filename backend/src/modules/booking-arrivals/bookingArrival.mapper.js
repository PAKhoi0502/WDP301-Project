const BookingMapper = require('../bookings/booking.mapper');

const toId = (value) => value?._id?.toString?.() || value?.toString?.() || null;

const toCandidateDto = (candidate = {}) => ({
    booking_id: toId(candidate.booking_id),
    booking: candidate.booking_id?._id ? BookingMapper.toBookingDto(candidate.booking_id) : null,
    match_type: candidate.match_type,
    edit_distance: candidate.edit_distance || 0,
    scheduled_distance_minutes: candidate.scheduled_distance_minutes || 0,
    vehicle_type_mismatch: !!candidate.vehicle_type_mismatch,
});

const toFrameDto = (upload) => {
    if (!upload || typeof upload !== 'object' || !upload._id || !upload.url) return null;
    const value = upload.toObject ? upload.toObject() : upload;

    return {
        upload_id: toId(value._id),
        url: value.url,
        mime_type: value.mime_type,
        size: value.size,
        width: value.width,
        height: value.height,
        created_at: value.created_at,
    };
};

const toScanDto = (scan) => {
    if (!scan) return null;
    const value = scan.toObject ? scan.toObject() : scan;

    return {
        id: toId(value._id || value.id),
        garage_id: toId(value.garage_id),
        staff_id: toId(value.staff_id),
        camera_device_id: toId(value.camera_device_id),
        client_event_id: value.client_event_id,
        mode: value.mode,
        capture_source: value.capture_source,
        captured_at: value.captured_at,
        server_received_at: value.server_received_at,
        status: value.status,
        upload_ids: (value.upload_ids || []).map(toId),
        frames: (value.upload_ids || []).map(toFrameDto).filter(Boolean),
        primary_upload_id: toId(value.primary_upload_id),
        plate_crop_url: value.plate_crop_url,
        frame_results: value.frame_results || [],
        raw_plate_text: value.raw_plate_text,
        normalized_plate: value.normalized_plate,
        confidence: value.confidence || 0,
        character_confidences: value.character_confidences || [],
        detected_vehicle_type: value.detected_vehicle_type,
        quality_flags: value.quality_flags || [],
        multiple_plate_count: value.multiple_plate_count || 0,
        weather: value.weather,
        time_of_day: value.time_of_day,
        provider: value.provider,
        model_version: value.model_version,
        processing_time_ms: value.processing_time_ms || 0,
        retry_of_scan_id: toId(value.retry_of_scan_id),
        retry_count: value.retry_count || 0,
        candidates: (value.candidates || []).map(toCandidateDto),
        matched_booking_id: toId(value.matched_booking_id),
        match_type: value.match_type,
        confirmed_booking_id: toId(value.confirmed_booking_id),
        confirmed_by_id: toId(value.confirmed_by_id),
        confirmed_at: value.confirmed_at,
        staff_confirmed_vehicle: !!value.staff_confirmed_vehicle,
        manual_override: !!value.manual_override,
        override_reason: value.override_reason,
        rejection_reason: value.rejection_reason,
        rejection_note: value.rejection_note,
        rejected_by_id: toId(value.rejected_by_id),
        rejected_at: value.rejected_at,
        alternate_vehicle_status: value.alternate_vehicle_status,
        alternate_vehicle: value.alternate_vehicle || null,
        failure_code: value.failure_code,
        failure_message: value.failure_message,
        retain_until: value.retain_until,
        image_deleted_at: value.image_deleted_at,
        expires_at: value.expires_at,
        created_at: value.created_at,
        updated_at: value.updated_at,
    };
};

const getHealthStatus = (device, now = new Date()) => {
    if (device.status !== 'ACTIVE') return 'DISABLED';
    if (!device.last_heartbeat_at) return 'OFFLINE';
    const age = now.getTime() - new Date(device.last_heartbeat_at).getTime();
    if (age <= 2 * 60 * 1000) return 'ONLINE';
    if (age <= 10 * 60 * 1000) return 'STALE';
    return 'OFFLINE';
};

const toDeviceDto = (device) => {
    if (!device) return null;
    const value = device.toObject ? device.toObject() : device;

    return {
        id: toId(value._id || value.id),
        device_code: value.device_code,
        name: value.name,
        garage_id: toId(value.garage_id),
        location: value.location,
        status: value.status,
        health_status: getHealthStatus(value),
        created_by_id: toId(value.created_by_id),
        rotated_by_id: toId(value.rotated_by_id),
        key_rotated_at: value.key_rotated_at,
        last_heartbeat_at: value.last_heartbeat_at,
        last_event_at: value.last_event_at,
        firmware_version: value.firmware_version,
        client_version: value.client_version,
        metadata: value.metadata || {},
        created_at: value.created_at,
        updated_at: value.updated_at,
    };
};

module.exports = { toScanDto, toDeviceDto, getHealthStatus };
