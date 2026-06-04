const StaffProfile = require('./staffProfile.model');
const StaffProfileMapper = require('./staffProfile.mapper');
const User = require('../users/user.model');
const Garage = require('../garages/garage.model');
const { AppError } = require('../../shared/utils/appError');
const { USER_ROLES } = require('../../shared/constants/roles.constant');
const { STAFF_TYPE_VALUES } = require('../../shared/constants/staff.constant');

const normalizeText = (value) => {
    if (typeof value !== 'string') {
        return value;
    }

    return value.trim();
};

const normalizeStaffCode = (staffCode) => {
    if (typeof staffCode !== 'string') {
        return staffCode;
    }

    return staffCode.trim().toUpperCase();
};

const normalizeObjectIdOrNull = (value) => {
    if (value === null) {
        return null;
    }

    if (typeof value === 'string') {
        const trimmedValue = value.trim();

        if (!trimmedValue) {
            return null;
        }

        return trimmedValue;
    }

    return value;
};

const normalizeCreatePayload = (payload = {}) => {
    const createPayload = {};

    if (payload.user_id !== undefined) {
        createPayload.user_id = normalizeObjectIdOrNull(payload.user_id);
    }

    if (payload.staff_code !== undefined) {
        createPayload.staff_code = normalizeStaffCode(payload.staff_code);
    }

    if (payload.staff_type !== undefined) {
        createPayload.staff_type = normalizeText(payload.staff_type);
    }

    if (payload.garage_id !== undefined) {
        createPayload.garage_id = normalizeObjectIdOrNull(payload.garage_id);
    }

    if (payload.is_active !== undefined) {
        createPayload.is_active = payload.is_active;
    }

    return createPayload;
};

const normalizeUpdatePayload = (payload = {}) => {
    const updatePayload = {};

    if (payload.staff_code !== undefined) {
        updatePayload.staff_code = normalizeStaffCode(payload.staff_code);
    }

    if (payload.staff_type !== undefined) {
        updatePayload.staff_type = normalizeText(payload.staff_type);
    }

    if (payload.garage_id !== undefined) {
        updatePayload.garage_id = normalizeObjectIdOrNull(payload.garage_id);
    }

    if (payload.is_active !== undefined) {
        updatePayload.is_active = payload.is_active;
    }

    return updatePayload;
};

const buildSearchFilter = ({ search, staff_type, garage_id, user_id, is_active } = {}) => {
    const filter = {};

    if (search) {
        const keyword = search.trim();

        filter.staff_code = { $regex: keyword, $options: 'i' };
    }

    if (staff_type) {
        filter.staff_type = staff_type;
    }

    if (garage_id) {
        filter.garage_id = garage_id;
    }

    if (user_id) {
        filter.user_id = user_id;
    }

    if (is_active !== undefined) {
        filter.is_active = is_active;
    }

    return filter;
};

const assertUpdatePayloadNotEmpty = (payload) => {
    if (!payload || Object.keys(payload).length === 0) {
        throw new AppError(
            'No valid fields to update',
            400,
            'NO_VALID_FIELDS_TO_UPDATE'
        );
    }
};

const assertStaffTypeValid = (staffType) => {
    if (staffType !== undefined && !STAFF_TYPE_VALUES.includes(staffType)) {
        throw new AppError('Invalid staff type', 400, 'INVALID_STAFF_TYPE');
    }
};

const getGarageDocument = async (garageId) => {
    if (!garageId) {
        return null;
    }

    const garage = await Garage.findById(garageId);

    if (!garage) {
        throw new AppError('Garage not found', 404, 'GARAGE_NOT_FOUND');
    }

    if (!garage.is_active) {
        throw new AppError('Garage is inactive', 400, 'GARAGE_INACTIVE');
    }

    return garage;
};

const getStaffUserDocument = async (userId) => {
    const user = await User.findById(userId);

    if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (user.role !== USER_ROLES.STAFF) {
        throw new AppError(
            'User must have STAFF role',
            400,
            'USER_MUST_HAVE_STAFF_ROLE'
        );
    }

    return user;
};

const getStaffProfileDocumentById = async (staffProfileId) => {
    const staffProfile = await StaffProfile.findById(staffProfileId).populate(
        'user_id',
        'full_name email phone role avatar_url is_active last_login_at created_at updated_at'
    );

    if (!staffProfile) {
        throw new AppError(
            'Staff profile not found',
            404,
            'STAFF_PROFILE_NOT_FOUND'
        );
    }

    return staffProfile;
};

const assertStaffProfileUserAvailable = async (userId) => {
    const existed = await StaffProfile.exists({ user_id: userId });

    if (existed) {
        throw new AppError(
            'Staff profile for this user already exists',
            409,
            'STAFF_PROFILE_USER_ALREADY_EXISTS'
        );
    }
};

const assertStaffCodeAvailable = async (staffCode, ignoredStaffProfileId = null) => {
    if (!staffCode) {
        return;
    }

    const filter = { staff_code: staffCode };

    if (ignoredStaffProfileId) {
        filter._id = { $ne: ignoredStaffProfileId };
    }

    const existed = await StaffProfile.exists(filter);

    if (existed) {
        throw new AppError(
            'Staff code already exists',
            409,
            'STAFF_CODE_ALREADY_EXISTS'
        );
    }
};

const getMyStaffProfile = async (userId) => {
    const staffProfile = await StaffProfile.findOne({ user_id: userId }).populate(
        'user_id',
        'full_name email phone role avatar_url is_active last_login_at created_at updated_at'
    );

    if (!staffProfile) {
        throw new AppError(
            'Staff profile not found',
            404,
            'STAFF_PROFILE_NOT_FOUND'
        );
    }

    return StaffProfileMapper.toStaffProfileDto(staffProfile);
};

const getStaffProfileById = async (staffProfileId) => {
    const staffProfile = await getStaffProfileDocumentById(staffProfileId);

    return StaffProfileMapper.toStaffProfileDto(staffProfile);
};

const getAllStaffProfiles = async ({ page = 1, limit = 20, search, staff_type, garage_id, user_id, is_active } = {}) => {
    const filter = buildSearchFilter({ search, staff_type, garage_id, user_id, is_active });
    const skip = (page - 1) * limit;

    const [staffProfiles, total] = await Promise.all([
        StaffProfile.find(filter)
            .populate(
                'user_id',
                'full_name email phone role avatar_url is_active last_login_at created_at updated_at'
            )
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit),
        StaffProfile.countDocuments(filter),
    ]);

    return {
        data: StaffProfileMapper.toStaffProfileDtoList(staffProfiles),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

const createStaffProfile = async (payload = {}) => {
    const createPayload = normalizeCreatePayload(
        StaffProfileMapper.toCreatePayload(payload)
    );

    assertStaffTypeValid(createPayload.staff_type);
    await getStaffUserDocument(createPayload.user_id);
    await getGarageDocument(createPayload.garage_id);
    await assertStaffProfileUserAvailable(createPayload.user_id);
    await assertStaffCodeAvailable(createPayload.staff_code);

    const createdStaffProfile = await StaffProfile.create(createPayload);

    const staffProfile = await getStaffProfileDocumentById(createdStaffProfile._id);

    return StaffProfileMapper.toStaffProfileDto(staffProfile);
};

const updateStaffProfile = async (staffProfileId, payload = {}) => {
    const updatePayload = normalizeUpdatePayload(
        StaffProfileMapper.toUpdatePayload(payload)
    );

    assertUpdatePayloadNotEmpty(updatePayload);
    assertStaffTypeValid(updatePayload.staff_type);

    await getStaffProfileDocumentById(staffProfileId);
    await getGarageDocument(updatePayload.garage_id);
    await assertStaffCodeAvailable(updatePayload.staff_code, staffProfileId);

    const updatedStaffProfile = await StaffProfile.findByIdAndUpdate(
        staffProfileId,
        { $set: updatePayload },
        { new: true, runValidators: true }
    ).populate(
        'user_id',
        'full_name email phone role avatar_url is_active last_login_at created_at updated_at'
    );

    return StaffProfileMapper.toStaffProfileDto(updatedStaffProfile);
};

const updateStaffProfileStatus = async (staffProfileId, isActive) => {
    const staffProfile = await getStaffProfileDocumentById(staffProfileId);

    if (staffProfile.is_active === isActive) {
        throw new AppError('Staff profile status is unchanged', 400, 'NO_CHANGE');
    }

    const updatedStaffProfile = await StaffProfile.findByIdAndUpdate(
        staffProfileId,
        { $set: { is_active: isActive } },
        { new: true, runValidators: true }
    ).populate(
        'user_id',
        'full_name email phone role avatar_url is_active last_login_at created_at updated_at'
    );

    return StaffProfileMapper.toStaffProfileDto(updatedStaffProfile);
};

module.exports = {
    getMyStaffProfile,
    getStaffProfileById,
    getAllStaffProfiles,
    createStaffProfile,
    updateStaffProfile,
    updateStaffProfileStatus,
};
