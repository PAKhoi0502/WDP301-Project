const toUserDto = (user) => {
    if (!user) {
        return null;
    }

    const plainUser = user.toObject ? user.toObject() : user;

    return {
        id: plainUser._id.toString(),
        full_name: plainUser.full_name || '',
        email: plainUser.email || null,
        phone: plainUser.phone,
        role: plainUser.role,
        avatar_url: plainUser.avatar_url || '',
        is_active: plainUser.is_active,
        last_login_at: plainUser.last_login_at || null,
        password_changed_at: plainUser.password_changed_at || null,
        created_at: plainUser.created_at,
        updated_at: plainUser.updated_at,
    };
};

const toAuthResponse = (user, accessToken) => {
    return {
        access_token: accessToken,
        user: toUserDto(user),
    };
};

module.exports = {
    toUserDto,
    toAuthResponse,
};
