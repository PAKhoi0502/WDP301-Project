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

    const plainUser = user.toObject ? user.toObject() : user;

    return {
        id: plainUser._id?.toString() || plainUser.id || null,
        full_name: plainUser.full_name || '',
        email: plainUser.email || null,
        phone: plainUser.phone || null,
        role: plainUser.role,
        is_active: plainUser.is_active,
    };
};

const toBookingSummaryDto = (booking) => {
    if (!booking || !booking._id) {
        return null;
    }

    const plainBooking = booking.toObject ? booking.toObject() : booking;

    return {
        id: plainBooking._id?.toString() || plainBooking.id || null,
        booking_date: plainBooking.booking_date,
        start_time: plainBooking.start_time,
        end_time: plainBooking.end_time,
        status: plainBooking.status,
        payment_status: plainBooking.payment_status,
    };
};

const toVehicleSummaryDto = (vehicle) => {
    if (!vehicle || !vehicle._id) {
        return null;
    }

    const plainVehicle = vehicle.toObject ? vehicle.toObject() : vehicle;

    return {
        id: plainVehicle._id?.toString() || plainVehicle.id || null,
        raw_license_plate: plainVehicle.raw_license_plate,
        normalized_license_plate: plainVehicle.normalized_license_plate,
        vehicle_type: plainVehicle.vehicle_type,
        engine_type: plainVehicle.engine_type,
        brand: plainVehicle.brand,
        model: plainVehicle.model,
        color: plainVehicle.color,
        is_active: plainVehicle.is_active,
    };
};

const toGarageSummaryDto = (garage) => {
    if (!garage || !garage._id) {
        return null;
    }

    const plainGarage = garage.toObject ? garage.toObject() : garage;

    return {
        id: plainGarage._id?.toString() || plainGarage.id || null,
        name: plainGarage.name,
        garage_code: plainGarage.garage_code,
        address: plainGarage.address,
        city: plainGarage.city,
        is_active: plainGarage.is_active,
    };
};

const toWashBaySummaryDto = (washBay) => {
    if (!washBay || !washBay._id) {
        return null;
    }

    const plainWashBay = washBay.toObject ? washBay.toObject() : washBay;

    return {
        id: plainWashBay._id?.toString() || plainWashBay.id || null,
        name: plainWashBay.name,
        bay_code: plainWashBay.bay_code,
        vehicle_type: plainWashBay.vehicle_type,
        status: plainWashBay.status,
        is_active: plainWashBay.is_active,
    };
};

const toServicePackageSummaryDto = (servicePackage) => {
    if (!servicePackage || !servicePackage._id) {
        return null;
    }

    const plainServicePackage = servicePackage.toObject ? servicePackage.toObject() : servicePackage;

    return {
        id: plainServicePackage._id?.toString() || plainServicePackage.id || null,
        name: plainServicePackage.name,
        vehicle_type: plainServicePackage.vehicle_type,
        service_type: plainServicePackage.service_type,
        base_price: plainServicePackage.base_price,
        duration_minutes: plainServicePackage.duration_minutes,
        requires_wash_bay: plainServicePackage.requires_wash_bay,
        is_active: plainServicePackage.is_active,
    };
};

const toWashHistoryDto = (washHistory) => {
    if (!washHistory) {
        return null;
    }

    const plainWashHistory = washHistory.toObject ? washHistory.toObject() : washHistory;

    return {
        id: plainWashHistory._id?.toString() || plainWashHistory.id || null,
        booking_id: toId(plainWashHistory.booking_id),
        booking: toBookingSummaryDto(plainWashHistory.booking_id),
        customer_id: toId(plainWashHistory.customer_id),
        customer: toUserSummaryDto(plainWashHistory.customer_id),
        vehicle_id: toId(plainWashHistory.vehicle_id),
        vehicle: toVehicleSummaryDto(plainWashHistory.vehicle_id),
        garage_id: toId(plainWashHistory.garage_id),
        garage: toGarageSummaryDto(plainWashHistory.garage_id),
        wash_bay_id: toId(plainWashHistory.wash_bay_id),
        wash_bay: toWashBaySummaryDto(plainWashHistory.wash_bay_id),
        service_package_id: toId(plainWashHistory.service_package_id),
        service_package: toServicePackageSummaryDto(plainWashHistory.service_package_id),
        vehicle_type: plainWashHistory.vehicle_type,
        amount_paid: plainWashHistory.amount_paid,
        original_price: plainWashHistory.original_price,
        discount_amount: plainWashHistory.discount_amount,
        points_earned: plainWashHistory.points_earned,
        points_used: plainWashHistory.points_used,
        payment_method: plainWashHistory.payment_method,
        paid_at: plainWashHistory.paid_at,
        service_started_at: plainWashHistory.service_started_at,
        service_completed_at: plainWashHistory.service_completed_at,
        created_at: plainWashHistory.created_at,
        updated_at: plainWashHistory.updated_at,
    };
};

const toWashHistoryDtoList = (washHistories = []) => {
    return washHistories.map((washHistory) => toWashHistoryDto(washHistory));
};

module.exports = {
    toWashHistoryDto,
    toWashHistoryDtoList,
};
