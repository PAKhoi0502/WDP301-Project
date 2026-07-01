const toUserDto = (user) => {
    if (!user) {
        return null;
    }

    const plainUser = user.toObject ? user.toObject() : user;

    return {
        id: plainUser._id?.toString() || plainUser.id || null,
        full_name: plainUser.full_name || '',
        email: plainUser.email || null,
        phone: plainUser.phone || null,
        phone_verified_at: plainUser.phone_verified_at || null,
        role: plainUser.role,
        avatar_url: plainUser.avatar_url || '',
        is_active: plainUser.is_active,
        onboarding_status: plainUser.onboarding_status || 'ACTIVE',
        last_login_at: plainUser.last_login_at || null,
        password_changed_at: plainUser.password_changed_at || null,
        created_at: plainUser.created_at,
        updated_at: plainUser.updated_at,
    };
};

const toUserDtoList = (users = []) => {
    return users.map((user) => toUserDto(user));
};

const toUpdatePayload = (data = {}) => {
    const update = {};

    if (data.full_name !== undefined) {
        update.full_name = data.full_name;
    }

    if (data.email !== undefined) {
        update.email = data.email;
    }

    if (data.phone !== undefined) {
        update.phone = data.phone;
    }

    if (data.avatar_url !== undefined) {
        update.avatar_url = data.avatar_url;
    }

    return update;
};

const toAdminUpdatePayload = (data = {}) => {
    const update = toUpdatePayload(data);

    if (data.role !== undefined) {
        update.role = data.role;
    }

    if (data.is_active !== undefined) {
        update.is_active = data.is_active;
    }

    return update;
};

module.exports = {
    toUserDto,
    toUserDtoList,
    toUpdatePayload,
    toAdminUpdatePayload,
};
