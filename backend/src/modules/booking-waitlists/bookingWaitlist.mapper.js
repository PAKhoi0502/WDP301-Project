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
        requires_wash_bay: servicePackage.requires_wash_bay,
        requires_care_staff: servicePackage.requires_care_staff,
        is_active: servicePackage.is_active,
    };
};

const toBookingSummaryDto = (booking) => {
    if (!booking || !booking._id) {
        return null;
    }

    return {
        id: booking._id.toString(),
        start_time: booking.start_time,
        end_time: booking.end_time,
        status: booking.status,
        payment_status: booking.payment_status,
    };
};

const toBookingWaitlistDto = (waitlist) => {
    if (!waitlist) {
        return null;
    }

    const plainWaitlist = waitlist.toObject ? waitlist.toObject() : waitlist;

    return {
        id: plainWaitlist._id?.toString() || plainWaitlist.id || null,
        customer_id: toId(plainWaitlist.customer_id),
        customer: toUserSummaryDto(plainWaitlist.customer_id),
        vehicle_id: toId(plainWaitlist.vehicle_id),
        vehicle: toVehicleSummaryDto(plainWaitlist.vehicle_id),
        garage_id: toId(plainWaitlist.garage_id),
        garage: toGarageSummaryDto(plainWaitlist.garage_id),
        service_package_id: toId(plainWaitlist.service_package_id),
        service_package: toServicePackageSummaryDto(plainWaitlist.service_package_id),
        add_on_service_ids: (plainWaitlist.add_on_service_ids || []).map((item) => toId(item)),
        vehicle_type: plainWaitlist.vehicle_type,
        desired_start_time: plainWaitlist.desired_start_time,
        status: plainWaitlist.status,
        offered_at: plainWaitlist.offered_at,
        offer_expires_at: plainWaitlist.offer_expires_at,
        accepted_at: plainWaitlist.accepted_at,
        canceled_at: plainWaitlist.canceled_at,
        canceled_by_id: toId(plainWaitlist.canceled_by_id),
        canceled_by: toUserSummaryDto(plainWaitlist.canceled_by_id),
        cancel_reason: plainWaitlist.cancel_reason,
        expired_at: plainWaitlist.expired_at,
        created_booking_id: toId(plainWaitlist.created_booking_id),
        created_booking: toBookingSummaryDto(plainWaitlist.created_booking_id),
        source_booking_id: toId(plainWaitlist.source_booking_id),
        source_booking: toBookingSummaryDto(plainWaitlist.source_booking_id),
        note: plainWaitlist.note,
        created_at: plainWaitlist.created_at,
        updated_at: plainWaitlist.updated_at,
    };
};

const toBookingWaitlistDtoList = (waitlists = []) => {
    return waitlists.map((waitlist) => toBookingWaitlistDto(waitlist));
};

module.exports = {
    toBookingWaitlistDto,
    toBookingWaitlistDtoList,
};
