const StaffProfileMapper = require('../staff-profiles/staffProfile.mapper');

const toId = (value) => {
    if (!value) {
        return null;
    }

    if (value._id) {
        return value._id.toString();
    }

    if (value.toString) {
        return value.toString();
    }

    return value;
};

const toUserSummaryDto = (user) => {
    if (!user || !user._id) {
        return null;
    }

    return {
        id: user._id.toString(),
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        is_active: user.is_active,
    };
};

const toVehicleSummaryDto = (vehicle) => {
    if (!vehicle || !vehicle._id) {
        return null;
    }

    return {
        id: vehicle._id.toString(),
        raw_license_plate: vehicle.raw_license_plate,
        normalized_license_plate: vehicle.normalized_license_plate,
        vehicle_type: vehicle.vehicle_type,
        engine_type: vehicle.engine_type,
        brand: vehicle.brand,
        model: vehicle.model,
        color: vehicle.color,
        is_active: vehicle.is_active,
    };
};

const toGarageSummaryDto = (garage) => {
    if (!garage || !garage._id) {
        return null;
    }

    return {
        id: garage._id.toString(),
        name: garage.name,
        garage_code: garage.garage_code,
        address: garage.address,
        city: garage.city,
        opening_time: garage.opening_time,
        closing_time: garage.closing_time,
        slot_interval_minutes: garage.slot_interval_minutes,
        late_grace_minutes: garage.late_grace_minutes,
        is_active: garage.is_active,
    };
};

const toServicePackageSummaryDto = (servicePackage) => {
    if (!servicePackage || !servicePackage._id) {
        return null;
    }

    return {
        id: servicePackage._id.toString(),
        name: servicePackage.name,
        vehicle_type: servicePackage.vehicle_type,
        service_type: servicePackage.service_type,
        base_price: servicePackage.base_price,
        duration_minutes: servicePackage.duration_minutes,
        countdown_duration_seconds: servicePackage.countdown_duration_seconds || servicePackage.duration_minutes * 60,
        transition_mode: servicePackage.transition_mode || 'REQUIRE_CONFIRMATION',
        wash_bay_duration_minutes: servicePackage.wash_bay_duration_minutes,
        points_earned: servicePackage.points_earned,
        requires_wash_bay: servicePackage.requires_wash_bay,
        requires_care_staff: servicePackage.requires_care_staff,
        care_staff_type: servicePackage.care_staff_type,
        care_staff_required_count: servicePackage.care_staff_required_count,
        care_staff_duration_minutes: servicePackage.care_staff_duration_minutes,
        is_active: servicePackage.is_active,
    };
};

const toStaffProfileSummaryDto = (staffProfile) => {
    if (!staffProfile || typeof staffProfile !== 'object' || !staffProfile._id) {
        return null;
    }

    return StaffProfileMapper.toStaffProfileDto(staffProfile);
};

const toCareStaffAssignmentDto = (assignment = {}) => {
    return {
        staff_profile_id: toId(assignment.staff_profile_id),
        staff_profile: toStaffProfileSummaryDto(assignment.staff_profile_id),
        user_id: toId(assignment.user_id),
        user: toUserSummaryDto(assignment.user_id),
        assigned_at: assignment.assigned_at,
        released_at: assignment.released_at,
    };
};

const toBookingItemDto = (item = {}) => {
    return {
        item_key: item.item_key,
        service_package_id: toId(item.service_package_id),
        source: item.source,
        parent_combo_id: toId(item.parent_combo_id),
        name_snapshot: item.name_snapshot,
        price_snapshot: item.price_snapshot,
        duration_minutes: item.duration_minutes,
        countdown_duration_seconds: item.countdown_duration_seconds || item.duration_minutes * 60,
        transition_mode: item.transition_mode || 'REQUIRE_CONFIRMATION',
        item_start_time: item.item_start_time,
        item_end_time: item.item_end_time,
        sequence: item.sequence,
        requires_wash_bay: item.requires_wash_bay,
        wash_bay_start_time: item.wash_bay_start_time,
        wash_bay_end_time: item.wash_bay_end_time,
        wash_bay_work_end_time: item.wash_bay_work_end_time || item.wash_bay_end_time,
        wash_bay_reserved_until: item.wash_bay_reserved_until || item.wash_bay_end_time,
        requires_care_staff: item.requires_care_staff,
        care_staff_type: item.care_staff_type,
        care_staff_required_count: item.care_staff_required_count,
        care_staff_start_time: item.care_staff_start_time,
        care_staff_end_time: item.care_staff_end_time,
        care_staff_work_end_time: item.care_staff_work_end_time || item.care_staff_end_time,
        care_staff_reserved_until: item.care_staff_reserved_until || item.care_staff_end_time,
        assigned_care_staff: (item.assigned_care_staff || []).map((assignment) => toCareStaffAssignmentDto(assignment)),
        status: item.status,
        actual_started_at: item.actual_started_at,
        countdown_ends_at: item.countdown_ends_at,
        actual_completed_at: item.actual_completed_at,
        remaining_seconds_at_pause: item.remaining_seconds_at_pause,
        paused_at: item.paused_at,
        paused_by_staff_id: toId(item.paused_by_staff_id),
        pause_reason: item.pause_reason,
        total_paused_seconds: item.total_paused_seconds || 0,
        completion_source: item.completion_source,
        completed_by_staff_id: toId(item.completed_by_staff_id),
        completion_note: item.completion_note,
    };
};

const toPromotionSummaryDto = (promotion) => {
    if (!promotion || !promotion._id) {
        return null;
    }

    return {
        id: promotion._id.toString(),
        code: promotion.code,
        name: promotion.name,
        discount_type: promotion.discount_type,
        discount_value: promotion.discount_value,
        max_discount_amount: promotion.max_discount_amount,
        min_order_amount: promotion.min_order_amount,
        start_at: promotion.start_at,
        end_at: promotion.end_at,
        is_active: promotion.is_active,
    };
};

const toWashBaySummaryDto = (washBay) => {
    if (!washBay || !washBay._id) {
        return null;
    }

    return {
        id: washBay._id.toString(),
        name: washBay.name,
        bay_code: washBay.bay_code,
        vehicle_type: washBay.vehicle_type,
        status: washBay.status,
        is_active: washBay.is_active,
    };
};

const toBookingDto = (booking) => {
    if (!booking) {
        return null;
    }

    const plainBooking = booking.toObject ? booking.toObject() : booking;

    return {
        id: plainBooking._id?.toString() || plainBooking.id || null,
        customer_id: toId(plainBooking.customer_id),
        customer: toUserSummaryDto(plainBooking.customer_id),
        vehicle_id: toId(plainBooking.vehicle_id),
        vehicle: toVehicleSummaryDto(plainBooking.vehicle_id),
        is_walk_in: plainBooking.is_walk_in,
        guest_name: plainBooking.guest_name,
        guest_phone: plainBooking.guest_phone,
        normalized_guest_phone: plainBooking.normalized_guest_phone,
        guest_email: plainBooking.guest_email,
        claimed_customer_id: toId(plainBooking.claimed_customer_id),
        claimed_at: plainBooking.claimed_at || null,
        license_plate: plainBooking.license_plate,
        normalized_license_plate: plainBooking.normalized_license_plate,
        vehicle_type: plainBooking.vehicle_type,
        created_by_staff_id: toId(plainBooking.created_by_staff_id),
        created_by_staff: toUserSummaryDto(plainBooking.created_by_staff_id),
        garage_id: toId(plainBooking.garage_id),
        garage: toGarageSummaryDto(plainBooking.garage_id),
        wash_bay_id: toId(plainBooking.wash_bay_id),
        wash_bay: toWashBaySummaryDto(plainBooking.wash_bay_id),
        service_package_id: toId(plainBooking.service_package_id),
        service_package: toServicePackageSummaryDto(plainBooking.service_package_id),
        add_on_service_ids: (plainBooking.add_on_service_ids || []).map((item) => toId(item)),
        booking_items: (plainBooking.booking_items || []).map((item) => toBookingItemDto(item)),
        booking_date: plainBooking.booking_date,
        start_time: plainBooking.start_time,
        end_time: plainBooking.end_time,
        wash_bay_start_time: plainBooking.wash_bay_start_time,
        wash_bay_end_time: plainBooking.wash_bay_end_time,
        wash_bay_work_end_time: plainBooking.wash_bay_work_end_time || plainBooking.wash_bay_end_time,
        wash_bay_reserved_until: plainBooking.wash_bay_reserved_until || plainBooking.wash_bay_end_time,
        requires_care_staff: plainBooking.requires_care_staff,
        care_staff_type: plainBooking.care_staff_type,
        care_staff_required_count: plainBooking.care_staff_required_count,
        care_staff_start_time: plainBooking.care_staff_start_time,
        care_staff_end_time: plainBooking.care_staff_end_time,
        care_staff_work_end_time: plainBooking.care_staff_work_end_time || plainBooking.care_staff_end_time,
        care_staff_reserved_until: plainBooking.care_staff_reserved_until || plainBooking.care_staff_end_time,
        assigned_care_staff_ids: (plainBooking.assigned_care_staff_ids || []).map((item) => toId(item)),
        assigned_care_staff: (plainBooking.assigned_care_staff_ids || [])
            .map((item) => toStaffProfileSummaryDto(item))
            .filter(Boolean),
        original_price: plainBooking.original_price,
        promotion_discount_amount: plainBooking.promotion_discount_amount,
        points_discount_amount: plainBooking.points_discount_amount,
        discount_amount: plainBooking.discount_amount,
        final_price: plainBooking.final_price,
        payment_method: plainBooking.payment_method,
        payment_status: plainBooking.payment_status,
        used_points: plainBooking.used_points,
        earned_points: plainBooking.earned_points,
        promotion_id: toId(plainBooking.promotion_id),
        promotion: toPromotionSummaryDto(plainBooking.promotion_id),
        requires_wash_bay: plainBooking.requires_wash_bay,
        status: plainBooking.status,
        arrival_status: plainBooking.arrival_status,
        arrived_at: plainBooking.arrived_at,
        arrival_reference_start_time: plainBooking.arrival_reference_start_time,
        late_minutes: plainBooking.late_minutes || 0,
        grace_exceeded_minutes: plainBooking.grace_exceeded_minutes || 0,
        late_resolution: plainBooking.late_resolution,
        late_resolution_required: plainBooking.arrival_status === 'LATE'
            && !plainBooking.late_resolution
            && ['PENDING', 'CONFIRMED'].includes(plainBooking.status),
        late_accepted_by_id: toId(plainBooking.late_accepted_by_id),
        late_accepted_at: plainBooking.late_accepted_at,
        late_resolution_note: plainBooking.late_resolution_note,
        original_start_time: plainBooking.original_start_time,
        original_end_time: plainBooking.original_end_time,
        rescheduled_at: plainBooking.rescheduled_at,
        rescheduled_by_id: toId(plainBooking.rescheduled_by_id),
        reschedule_reason: plainBooking.reschedule_reason,
        reschedule_count: plainBooking.reschedule_count || 0,
        checked_in_at: plainBooking.checked_in_at,
        started_at: plainBooking.started_at,
        completed_at: plainBooking.completed_at,
        paid_at: plainBooking.paid_at,
        canceled_at: plainBooking.canceled_at,
        canceled_by_id: toId(plainBooking.canceled_by_id),
        cancel_reason: plainBooking.cancel_reason,
        no_show_at: plainBooking.no_show_at,
        no_show_by_id: toId(plainBooking.no_show_by_id),
        no_show_by: toUserSummaryDto(plainBooking.no_show_by_id),
        no_show_reason: plainBooking.no_show_reason,
        reward_processed: plainBooking.reward_processed,
        reward_processed_at: plainBooking.reward_processed_at,
        note: plainBooking.note,
        created_at: plainBooking.created_at,
        updated_at: plainBooking.updated_at,
    };
};

const toBookingDtoList = (bookings = []) => {
    return bookings.map((booking) => toBookingDto(booking));
};

const copyDefinedFields = (data = {}, fields = []) => {
    const payload = {};

    fields.forEach((field) => {
        if (data[field] !== undefined) {
            payload[field] = data[field];
        }
    });

    return payload;
};

const customerCreateFields = [
    'garage_id',
    'vehicle_id',
    'service_package_id',
    'add_on_service_ids',
    'start_time',
    'promotion_code',
    'used_points',
    'note',
];

const walkInCreateFields = [
    'garage_id',
    'service_package_id',
    'add_on_service_ids',
    'start_time',
    'serve_now',
    'suggestion_days',
    'guest_name',
    'guest_phone',
    'guest_email',
    'license_plate',
    'vehicle_type',
    'promotion_code',
    'note',
];

const toCustomerCreatePayload = (data = {}) => copyDefinedFields(data, customerCreateFields);
const toWalkInCreatePayload = (data = {}) => copyDefinedFields(data, walkInCreateFields);

module.exports = {
    toBookingDto,
    toBookingDtoList,
    toCustomerCreatePayload,
    toWalkInCreatePayload,
};
