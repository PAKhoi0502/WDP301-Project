const UserMapper = require('../users/user.mapper');

const toId = (value) => {
    if (!value) {
        return null;
    }

    if (typeof value === 'object' && value._id) {
        return value._id.toString();
    }

    return value.toString();
};

const toStaffProfileDto = (staffProfile) => {
    if (!staffProfile) {
        return null;
    }

    const plainStaffProfile = staffProfile.toObject ? staffProfile.toObject() : staffProfile;
    const user =
        plainStaffProfile.user_id && typeof plainStaffProfile.user_id === 'object'
            ? UserMapper.toUserDto(plainStaffProfile.user_id)
            : null;

    return {
        id: plainStaffProfile._id?.toString() || plainStaffProfile.id || null,
        user_id: toId(plainStaffProfile.user_id),
        user,
        staff_code: plainStaffProfile.staff_code,
        staff_type: plainStaffProfile.staff_type,
        garage_id: toId(plainStaffProfile.garage_id),
        is_active: plainStaffProfile.is_active,
        created_at: plainStaffProfile.created_at,
        updated_at: plainStaffProfile.updated_at,
    };
};

const toStaffProfileDtoList = (staffProfiles = []) => {
    return staffProfiles.map((staffProfile) => toStaffProfileDto(staffProfile));
};

const toCreatePayload = (data = {}) => {
    const payload = {};

    if (data.user_id !== undefined) {
        payload.user_id = data.user_id;
    }

    if (data.staff_code !== undefined) {
        payload.staff_code = data.staff_code;
    }

    if (data.staff_type !== undefined) {
        payload.staff_type = data.staff_type;
    }

    if (data.garage_id !== undefined) {
        payload.garage_id = data.garage_id;
    }

    return payload;
};

const toUpdatePayload = (data = {}) => {
    const payload = {};

    if (data.staff_code !== undefined) {
        payload.staff_code = data.staff_code;
    }

    if (data.staff_type !== undefined) {
        payload.staff_type = data.staff_type;
    }

    if (data.garage_id !== undefined) {
        payload.garage_id = data.garage_id;
    }

    return payload;
};

module.exports = {
    toStaffProfileDto,
    toStaffProfileDtoList,
    toCreatePayload,
    toUpdatePayload,
};
