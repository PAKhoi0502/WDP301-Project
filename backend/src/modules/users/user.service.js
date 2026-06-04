const User = require('./user.model');
const UserMapper = require('./user.mapper');
const { AppError } = require('../../shared/utils/appError');
const { USER_ROLES, USER_ROLE_VALUES } = require('../../shared/constants/roles.constant');

const normalizeEmail = (email) => {
    if (!email) {
        return email;
    }

    return email.trim().toLowerCase();
};

const normalizeText = (value) => {
    if (typeof value !== 'string') {
        return value;
    }

    return value.trim();
};

const normalizeUpdatePayload = (payload = {}) => {
    const update = {};

    if (payload.full_name !== undefined) {
        update.full_name = normalizeText(payload.full_name);
    }

    if (payload.email !== undefined) {
        update.email = normalizeEmail(payload.email);
    }

    if (payload.phone !== undefined) {
        update.phone = normalizeText(payload.phone);
    }

    if (payload.avatar_url !== undefined) {
        update.avatar_url = normalizeText(payload.avatar_url);
    }

    if (payload.role !== undefined) {
        update.role = payload.role;
    }

    if (payload.is_active !== undefined) {
        update.is_active = payload.is_active;
    }

    return update;
};

const buildSearchFilter = ({ search, role, is_active } = {}) => {
    const filter = {};

    if (search) {
        const keyword = search.trim();

        filter.$or = [
            { full_name: { $regex: keyword, $options: 'i' } },
            { email: { $regex: keyword, $options: 'i' } },
            { phone: { $regex: keyword, $options: 'i' } },
        ];
    }

    if (role) {
        filter.role = role;
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

const assertEmailAvailable = async (email, ignoredUserId = null) => {
    if (!email) {
        return;
    }

    const filter = { email };

    if (ignoredUserId) {
        filter._id = { $ne: ignoredUserId };
    }

    const existed = await User.exists(filter);

    if (existed) {
        throw new AppError(
            'Email already exists',
            409,
            'EMAIL_ALREADY_EXISTS'
        );
    }
};

const assertPhoneAvailable = async (phone, ignoredUserId = null) => {
    if (!phone) {
        return;
    }

    const filter = { phone };

    if (ignoredUserId) {
        filter._id = { $ne: ignoredUserId };
    }

    const existed = await User.exists(filter);

    if (existed) {
        throw new AppError(
            'Phone already exists',
            409,
            'PHONE_ALREADY_EXISTS'
        );
    }
};

const assertRoleValid = (role) => {
    if (role !== undefined && !USER_ROLE_VALUES.includes(role)) {
        throw new AppError('Invalid role', 400, 'INVALID_ROLE');
    }
};

const assertLastAdminSafe = async (userId, update) => {
    const canAffectAdminAccess =
        update.role !== undefined || update.is_active !== undefined;

    if (!canAffectAdminAccess) {
        return;
    }

    const user = await User.findById(userId);

    if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const currentlyActiveAdmin =
        user.role === USER_ROLES.ADMIN && user.is_active === true;

    if (!currentlyActiveAdmin) {
        return;
    }

    const willRemainActiveAdmin =
        (update.role === undefined || update.role === USER_ROLES.ADMIN) &&
        (update.is_active === undefined || update.is_active === true);

    if (willRemainActiveAdmin) {
        return;
    }

    const activeAdminCount = await User.countDocuments({
        role: USER_ROLES.ADMIN,
        is_active: true,
    });

    if (activeAdminCount <= 1) {
        throw new AppError(
            'System must have at least one active admin',
            400,
            'LAST_ACTIVE_ADMIN'
        );
    }
};

const getUserDocumentById = async (userId) => {
    const user = await User.findById(userId);

    if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    return user;
};

const getMe = async (userId) => {
    const user = await getUserDocumentById(userId);

    return UserMapper.toUserDto(user);
};

const getUserById = async (userId) => {
    const user = await getUserDocumentById(userId);

    return UserMapper.toUserDto(user);
};

const getAllUsers = async ({
    page = 1,
    limit = 20,
    search,
    role,
    is_active,
} = {}) => {
    const filter = buildSearchFilter({ search, role, is_active });
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
        User.find(filter)
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit),
        User.countDocuments(filter),
    ]);

    return {
        data: UserMapper.toUserDtoList(users),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

const updateMe = async (userId, payload = {}) => {
    const update = normalizeUpdatePayload(UserMapper.toUpdatePayload(payload));

    assertUpdatePayloadNotEmpty(update);

    await getUserDocumentById(userId);
    await assertEmailAvailable(update.email, userId);
    await assertPhoneAvailable(update.phone, userId);

    const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: update },
        { new: true, runValidators: true }
    );

    return UserMapper.toUserDto(updatedUser);
};

const updateUser = async (userId, payload = {}) => {
    const update = normalizeUpdatePayload(UserMapper.toAdminUpdatePayload(payload));

    assertUpdatePayloadNotEmpty(update);
    assertRoleValid(update.role);

    await getUserDocumentById(userId);
    await assertLastAdminSafe(userId, update);
    await assertEmailAvailable(update.email, userId);
    await assertPhoneAvailable(update.phone, userId);

    const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: update },
        { new: true, runValidators: true }
    );

    return UserMapper.toUserDto(updatedUser);
};

const updateUserStatus = async (userId, isActive) => {
    const update = { is_active: isActive };
    const user = await getUserDocumentById(userId);

    if (user.is_active === isActive) {
        throw new AppError('User status is unchanged', 400, 'NO_CHANGE');
    }

    await assertLastAdminSafe(userId, update);

    const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: update },
        { new: true, runValidators: true }
    );

    return UserMapper.toUserDto(updatedUser);
};

const updateUserRole = async (userId, role) => {
    assertRoleValid(role);

    const update = { role };
    const user = await getUserDocumentById(userId);

    if (user.role === role) {
        throw new AppError('User role is unchanged', 400, 'NO_CHANGE');
    }

    await assertLastAdminSafe(userId, update);

    const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: update },
        { new: true, runValidators: true }
    );

    return UserMapper.toUserDto(updatedUser);
};

module.exports = {
    getMe,
    getUserById,
    getAllUsers,
    updateMe,
    updateUser,
    updateUserStatus,
    updateUserRole,
};