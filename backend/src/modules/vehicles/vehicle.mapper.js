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

const toCustomerSummaryDto = (customer) => {
    if (!customer || !customer._id) {
        return null;
    }

    return {
        id: customer._id.toString(),
        full_name: customer.full_name,
        email: customer.email || null,
        phone: customer.phone,
        role: customer.role,
        is_active: customer.is_active,
    };
};

const toVehicleDto = (vehicle) => {
    if (!vehicle) {
        return null;
    }

    const plainVehicle = vehicle.toObject ? vehicle.toObject() : vehicle;

    return {
        id: plainVehicle._id?.toString() || plainVehicle.id || null,
        customer_id: toId(plainVehicle.customer_id),
        customer: toCustomerSummaryDto(plainVehicle.customer_id),
        raw_license_plate: plainVehicle.raw_license_plate,
        normalized_license_plate: plainVehicle.normalized_license_plate,
        vehicle_type: plainVehicle.vehicle_type,
        engine_type: plainVehicle.engine_type,
        motorbike_cc_group: plainVehicle.motorbike_cc_group || null,
        car_body_type: plainVehicle.car_body_type || null,
        seat_count: plainVehicle.seat_count || null,
        brand: plainVehicle.brand || '',
        model: plainVehicle.model || '',
        color: plainVehicle.color || '',
        is_default: plainVehicle.is_default,
        is_active: plainVehicle.is_active,
        created_at: plainVehicle.created_at,
        updated_at: plainVehicle.updated_at,
    };
};

const toVehicleDtoList = (vehicles = []) => {
    return vehicles.map((vehicle) => toVehicleDto(vehicle));
};

const toCreatePayload = (data = {}) => {
    const payload = {};

    if (data.raw_license_plate !== undefined) {
        payload.raw_license_plate = data.raw_license_plate;
    }

    if (data.vehicle_type !== undefined) {
        payload.vehicle_type = data.vehicle_type;
    }

    if (data.engine_type !== undefined) {
        payload.engine_type = data.engine_type;
    }

    if (data.motorbike_cc_group !== undefined) {
        payload.motorbike_cc_group = data.motorbike_cc_group;
    }

    if (data.car_body_type !== undefined) {
        payload.car_body_type = data.car_body_type;
    }

    if (data.seat_count !== undefined) {
        payload.seat_count = data.seat_count;
    }

    if (data.brand !== undefined) {
        payload.brand = data.brand;
    }

    if (data.model !== undefined) {
        payload.model = data.model;
    }

    if (data.color !== undefined) {
        payload.color = data.color;
    }

    if (data.is_default !== undefined) {
        payload.is_default = data.is_default;
    }

    if (data.is_active !== undefined) {
        payload.is_active = data.is_active;
    }

    return payload;
};

const toUpdatePayload = (data = {}) => {
    const payload = {};

    if (data.customer_id !== undefined) {
        payload.customer_id = data.customer_id;
    }

    if (data.raw_license_plate !== undefined) {
        payload.raw_license_plate = data.raw_license_plate;
    }

    if (data.vehicle_type !== undefined) {
        payload.vehicle_type = data.vehicle_type;
    }

    if (data.engine_type !== undefined) {
        payload.engine_type = data.engine_type;
    }

    if (data.motorbike_cc_group !== undefined) {
        payload.motorbike_cc_group = data.motorbike_cc_group;
    }

    if (data.car_body_type !== undefined) {
        payload.car_body_type = data.car_body_type;
    }

    if (data.seat_count !== undefined) {
        payload.seat_count = data.seat_count;
    }

    if (data.brand !== undefined) {
        payload.brand = data.brand;
    }

    if (data.model !== undefined) {
        payload.model = data.model;
    }

    if (data.color !== undefined) {
        payload.color = data.color;
    }

    if (data.is_default !== undefined) {
        payload.is_default = data.is_default;
    }

    if (data.is_active !== undefined) {
        payload.is_active = data.is_active;
    }

    return payload;
};

module.exports = {
    toVehicleDto,
    toVehicleDtoList,
    toCreatePayload,
    toUpdatePayload,
};
