const UserMapper = require('../users/user.mapper');
const {
    STAFF_EMPLOYMENT_STATUS,
    getStaffCapabilities,
    getStaffGroup,
} = require('../../shared/constants/staff.constant');

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
    const employmentStatus = plainStaffProfile.employment_status
        || (plainStaffProfile.is_active
            ? STAFF_EMPLOYMENT_STATUS.ACTIVE
            : STAFF_EMPLOYMENT_STATUS.SUSPENDED);

    return {
        id: plainStaffProfile._id?.toString() || plainStaffProfile.id || null,
        user_id: toId(plainStaffProfile.user_id),
        user,
        staff_code: plainStaffProfile.staff_code,
        staff_type: plainStaffProfile.staff_type,
        staff_group: getStaffGroup(plainStaffProfile.staff_type),
        capabilities: getStaffCapabilities(plainStaffProfile.staff_type),
        garage_id: toId(plainStaffProfile.garage_id),
        is_active: plainStaffProfile.is_active,
        employment_status: employmentStatus,
        status_reason: plainStaffProfile.status_reason || null,
        suspended_at: plainStaffProfile.suspended_at || null,
        terminated_at: plainStaffProfile.terminated_at || null,
        status_changed_at: plainStaffProfile.status_changed_at || null,
        status_changed_by: toId(plainStaffProfile.status_changed_by),
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
