const crypto = require('crypto');

const User = require('../../users/user.model');
const TokenService = require('../services/token.service');
const TokenSecurity = require('../security/token.security');
const { hashToken } = require('../security/token.hash');
const AuthMapper = require('../auth.mapper');
const { AppError } = require('../../../shared/utils/appError');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../../../shared/utils/jwt');

const DEFAULT_REFRESH_TOKEN_DAYS = 7;

const getRefreshTokenExpiresAt = () => {
    const days = Number(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS)
        || DEFAULT_REFRESH_TOKEN_DAYS;

    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
};

const createAccessTokenForUser = (user) => {
    return signAccessToken({
        user_id: user._id.toString(),
        role: user.role,
    });
};

const createRefreshTokenForUser = async (user, meta = {}, jti = crypto.randomUUID()) => {
    const refreshToken = signRefreshToken({
        user_id: user._id.toString(),
        role: user.role,
        jti,
    });

    await TokenService.createRefreshToken({
        user_id: user._id,
        jti,
        token_hash: hashToken(refreshToken),
        user_agent: meta.user_agent || '',
        ip_address: meta.ip_address || '',
        expires_at: getRefreshTokenExpiresAt(),
    });

    return refreshToken;
};

const refresh = async (refreshToken, meta = {}) => {
    let decoded;

    try {
        decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
        throw new AppError(
            'Invalid refresh token',
            401,
            'INVALID_REFRESH_TOKEN'
        );
    }

    if (!decoded.user_id || !decoded.jti) {
        throw new AppError(
            'Invalid refresh token',
            401,
            'INVALID_REFRESH_TOKEN'
        );
    }

    await TokenSecurity.validateRefreshRecord(refreshToken, decoded);

    const user = await User.findById(decoded.user_id);

    if (!user) {
        throw new AppError(
            'User not found',
            401,
            'USER_NOT_FOUND'
        );
    }

    if (!user.is_active) {
        throw new AppError(
            'User account is inactive',
            403,
            'USER_INACTIVE'
        );
    }

    const newJti = crypto.randomUUID();
    const revoked = await TokenService.revokeByJti(decoded.jti, 'rotated', newJti);

    if (!revoked) {
        await TokenService.revokeAllByUser(user._id, 'rotation_conflict');

        throw new AppError(
            'Refresh token already used',
            401,
            'REFRESH_TOKEN_ALREADY_USED'
        );
    }

    const newRefreshToken = await createRefreshTokenForUser(user, meta, newJti);
    const newAccessToken = createAccessTokenForUser(user);

    return {
        user: AuthMapper.toUserDto(user),
        tokens: {
            access_token: newAccessToken,
            refresh_token: newRefreshToken,
        },
    };
};

const logout = async (refreshToken) => {
    if (!refreshToken) {
        return false;
    }

    let decoded;

    try {
        decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
        return false;
    }

    if (!decoded.user_id || !decoded.jti) {
        return false;
    }

    try {
        await TokenSecurity.validateRefreshRecord(refreshToken, decoded);
        await TokenService.revokeByJti(decoded.jti, 'manual');
    } catch (error) {
        return false;
    }

    return true;
};

const logoutAllDevices = async (userId) => {
    const user = await User.findById(userId);

    if (!user) {
        throw new AppError(
            'User not found',
            404,
            'USER_NOT_FOUND'
        );
    }

    await TokenService.revokeAllByUser(user._id, 'logout_all_devices');

    return {
        message: 'Logged out from all devices successfully',
    };
};

module.exports = {
    refresh,
    logout,
    logoutAllDevices,
    createAccessTokenForUser,
    createRefreshTokenForUser,
};
