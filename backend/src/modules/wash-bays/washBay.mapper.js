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

const toWashBayDto = (washBay) => {
    if (!washBay) {
        return null;
    }

    const plainWashBay = washBay.toObject ? washBay.toObject() : washBay;

    return {
        id: plainWashBay._id?.toString() || plainWashBay.id || null,
        garage_id: toId(plainWashBay.garage_id),
        garage: toGarageSummaryDto(plainWashBay.garage_id),
        name: plainWashBay.name,
        bay_code: plainWashBay.bay_code,
        vehicle_type: plainWashBay.vehicle_type,
        status: plainWashBay.status,
        current_booking_id: toId(plainWashBay.current_booking_id),
        is_active: plainWashBay.is_active,
        created_at: plainWashBay.created_at,
        updated_at: plainWashBay.updated_at,
    };
};

const toWashBayDtoList = (washBays = []) => {
    return washBays.map((washBay) => toWashBayDto(washBay));
};

const toCreatePayload = (data = {}) => {
    const payload = {};

    if (data.garage_id !== undefined) {
        payload.garage_id = data.garage_id;
    }

    if (data.name !== undefined) {
        payload.name = data.name;
    }

    if (data.bay_code !== undefined) {
        payload.bay_code = data.bay_code;
    }

    if (data.vehicle_type !== undefined) {
        payload.vehicle_type = data.vehicle_type;
    }

    if (data.status !== undefined) {
        payload.status = data.status;
    }

    if (data.is_active !== undefined) {
        payload.is_active = data.is_active;
    }

    return payload;
};

const toUpdatePayload = (data = {}) => {
    const payload = {};

    if (data.garage_id !== undefined) {
        payload.garage_id = data.garage_id;
    }

    if (data.name !== undefined) {
        payload.name = data.name;
    }

    if (data.bay_code !== undefined) {
        payload.bay_code = data.bay_code;
    }

    if (data.vehicle_type !== undefined) {
        payload.vehicle_type = data.vehicle_type;
    }

    if (data.is_active !== undefined) {
        payload.is_active = data.is_active;
    }

    return payload;
};

module.exports = {
    toWashBayDto,
    toWashBayDtoList,
    toCreatePayload,
    toUpdatePayload,
};
