const toGarageDto = (garage) => {
    if (!garage) {
        return null;
    }

    const plainGarage = garage.toObject ? garage.toObject() : garage;

    return {
        id: plainGarage._id?.toString() || plainGarage.id || null,
        name: plainGarage.name,
        garage_code: plainGarage.garage_code,
        address: plainGarage.address,
        ward: plainGarage.ward,
        district: plainGarage.district,
        city: plainGarage.city,
        phone: plainGarage.phone,
        email: plainGarage.email,
        latitude: plainGarage.latitude,
        longitude: plainGarage.longitude,
        opening_time: plainGarage.opening_time,
        closing_time: plainGarage.closing_time,
        slot_interval_minutes: plainGarage.slot_interval_minutes,
        late_grace_minutes: plainGarage.late_grace_minutes,
        description: plainGarage.description,
        is_active: plainGarage.is_active,
        created_at: plainGarage.created_at,
        updated_at: plainGarage.updated_at,
    };
};

const toGarageDtoList = (garages = []) => {
    return garages.map((garage) => toGarageDto(garage));
};

const toCreatePayload = (data = {}) => {
    const payload = {};

    if (data.name !== undefined) {
        payload.name = data.name;
    }

    if (data.garage_code !== undefined) {
        payload.garage_code = data.garage_code;
    }

    if (data.address !== undefined) {
        payload.address = data.address;
    }

    if (data.ward !== undefined) {
        payload.ward = data.ward;
    }

    if (data.district !== undefined) {
        payload.district = data.district;
    }

    if (data.city !== undefined) {
        payload.city = data.city;
    }

    if (data.phone !== undefined) {
        payload.phone = data.phone;
    }

    if (data.email !== undefined) {
        payload.email = data.email;
    }

    if (data.latitude !== undefined) {
        payload.latitude = data.latitude;
    }

    if (data.longitude !== undefined) {
        payload.longitude = data.longitude;
    }

    if (data.opening_time !== undefined) {
        payload.opening_time = data.opening_time;
    }

    if (data.closing_time !== undefined) {
        payload.closing_time = data.closing_time;
    }

    if (data.slot_interval_minutes !== undefined) {
        payload.slot_interval_minutes = data.slot_interval_minutes;
    }

    if (data.late_grace_minutes !== undefined) {
        payload.late_grace_minutes = data.late_grace_minutes;
    }

    if (data.description !== undefined) {
        payload.description = data.description;
    }

    if (data.is_active !== undefined) {
        payload.is_active = data.is_active;
    }

    return payload;
};

const toUpdatePayload = (data = {}) => {
    const payload = {};

    if (data.name !== undefined) {
        payload.name = data.name;
    }

    if (data.garage_code !== undefined) {
        payload.garage_code = data.garage_code;
    }

    if (data.address !== undefined) {
        payload.address = data.address;
    }

    if (data.ward !== undefined) {
        payload.ward = data.ward;
    }

    if (data.district !== undefined) {
        payload.district = data.district;
    }

    if (data.city !== undefined) {
        payload.city = data.city;
    }

    if (data.phone !== undefined) {
        payload.phone = data.phone;
    }

    if (data.email !== undefined) {
        payload.email = data.email;
    }

    if (data.latitude !== undefined) {
        payload.latitude = data.latitude;
    }

    if (data.longitude !== undefined) {
        payload.longitude = data.longitude;
    }

    if (data.opening_time !== undefined) {
        payload.opening_time = data.opening_time;
    }

    if (data.closing_time !== undefined) {
        payload.closing_time = data.closing_time;
    }

    if (data.slot_interval_minutes !== undefined) {
        payload.slot_interval_minutes = data.slot_interval_minutes;
    }

    if (data.late_grace_minutes !== undefined) {
        payload.late_grace_minutes = data.late_grace_minutes;
    }

    if (data.description !== undefined) {
        payload.description = data.description;
    }

    if (data.is_active !== undefined) {
        payload.is_active = data.is_active;
    }

    return payload;
};

module.exports = {
    toGarageDto,
    toGarageDtoList,
    toCreatePayload,
    toUpdatePayload,
};
