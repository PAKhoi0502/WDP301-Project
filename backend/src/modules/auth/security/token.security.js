const TokenService = require('../services/token.service');
const { compareToken } = require('./token.hash');
const { AppError } = require('../../../shared/utils/appError');

const validateRefreshRecord = async (refreshToken, decoded) => {
    const tokenRecord = await TokenService.findByJti(decoded.jti);

    if (!tokenRecord) {
        throw new AppError(
            'Refresh token not found',
            401,
            'REFRESH_TOKEN_NOT_FOUND'
        );
    }

    if (tokenRecord.user_id.toString() !== decoded.user_id) {
        throw new AppError(
            'Invalid refresh token',
            401,
            'INVALID_REFRESH_TOKEN'
        );
    }

    if (tokenRecord.replaced_by_jti) {
        await TokenService.revokeAllByUser(decoded.user_id, 'reuse_detected');

        throw new AppError(
            'Refresh token reuse detected',
            403,
            'REFRESH_TOKEN_REUSE_DETECTED'
        );
    }

    if (tokenRecord.is_revoked) {
        throw new AppError(
            'Refresh token revoked',
            401,
            'REFRESH_TOKEN_REVOKED'
        );
    }

    if (tokenRecord.expires_at <= new Date()) {
        await TokenService.revokeByJti(decoded.jti, 'expired');

        throw new AppError(
            'Refresh token expired',
            401,
            'REFRESH_TOKEN_EXPIRED'
        );
    }

    if (!compareToken(refreshToken, tokenRecord.token_hash)) {
        throw new AppError(
            'Invalid refresh token',
            401,
            'INVALID_REFRESH_TOKEN'
        );
    }

    return tokenRecord;
};

module.exports = {
    validateRefreshRecord,
};
