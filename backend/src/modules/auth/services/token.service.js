const RefreshToken = require('../models/refreshToken.model');
const { AppError } = require('../../../shared/utils/appError');

const createRefreshToken = async (payload) => {
    return RefreshToken.create({
        user_id: payload.user_id,
        jti: payload.jti,
        token_hash: payload.token_hash,
        user_agent: payload.user_agent || '',
        ip_address: payload.ip_address || '',
        is_revoked: payload.is_revoked ?? false,
        expires_at: payload.expires_at,
    });
};

const findByJti = async (jti) => {
    if (!jti) {
        throw new AppError(
            'JTI is required',
            400,
            'JTI_REQUIRED'
        );
    }

    return RefreshToken.findOne({ jti });
};

const revokeByJti = async (jti, reason = 'manual', replacedByJti = null) => {
    if (!jti) {
        throw new AppError(
            'JTI is required',
            400,
            'JTI_REQUIRED'
        );
    }

    return RefreshToken.findOneAndUpdate(
        {
            jti,
            is_revoked: false,
        },
        {
            $set: {
                is_revoked: true,
                revoked_at: new Date(),
                revoked_reason: reason,
                replaced_by_jti: replacedByJti,
            },
        },
        { new: true }
    );
};

const revokeAllByUser = async (userId, reason = 'security', session = null) => {
    if (!userId) {
        throw new AppError(
            'User id is required',
            400,
            'USER_ID_REQUIRED'
        );
    }

    return RefreshToken.updateMany(
        {
            user_id: userId,
            is_revoked: false,
        },
        {
            $set: {
                is_revoked: true,
                revoked_at: new Date(),
                revoked_reason: reason,
            },
        },
        session ? { session } : undefined
    );
};

module.exports = {
    createRefreshToken,
    findByJti,
    revokeByJti,
    revokeAllByUser,
};
