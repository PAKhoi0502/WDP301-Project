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

const toVehicleInspectionDto = (inspection) => {
    if (!inspection) {
        return null;
    }

    const plainInspection = inspection.toObject ? inspection.toObject() : inspection;

    return {
        id: plainInspection._id?.toString() || plainInspection.id || null,
        booking_id: toId(plainInspection.booking_id),
        type: plainInspection.type,
        note: plainInspection.note,
        images: plainInspection.images || [],
        inspected_by_id: toId(plainInspection.inspected_by),
        inspected_by: toUserSummaryDto(plainInspection.inspected_by),
        inspected_at: plainInspection.inspected_at,
        created_at: plainInspection.created_at,
        updated_at: plainInspection.updated_at,
    };
};

const toVehicleInspectionDtoList = (inspections = []) => {
    return inspections.map((inspection) => toVehicleInspectionDto(inspection));
};

module.exports = {
    toVehicleInspectionDto,
    toVehicleInspectionDtoList,
};
