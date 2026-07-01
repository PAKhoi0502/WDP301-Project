const crypto = require('crypto');
const mongoose = require('mongoose');

const User = require('../../users/user.model');
const PhoneVerification = require('../models/phoneVerification.model');
const smsService = require('../../sms/sms.service');
const { hashToken } = require('../security/token.hash');
const { AppError } = require('../../../shared/utils/appError');
const { USER_ROLES } = require('../../../shared/constants/roles.constant');
const {
    USER_ONBOARDING_STATUSES,
} = require('../../../shared/constants/userOnboarding.constant');
const { normalizePhone } = require('../../../shared/utils/phone');
const {
    PHONE_VERIFICATION_PURPOSES,
    PHONE_VERIFICATION_PURPOSE_VALUES,
} = require('../phoneVerification.constant');

const DEFAULT_OTP_EXPIRES_MINUTES = 5;
const DEFAULT_VERIFICATION_TOKEN_EXPIRES_MINUTES = 10;
const DEFAULT_RATE_LIMIT_WINDOW_MINUTES = 60;
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 5;
const DEFAULT_IP_RATE_LIMIT_MAX_REQUESTS = 20;
const DEFAULT_COOLDOWN_SECONDS = 60;
const DEFAULT_MAX_ATTEMPTS = 5;

const getPositiveNumber = (name, fallback) => {
    const value = Number(process.env[name]);

    return Number.isFinite(value) && value > 0 ? value : fallback;
};

const isEnvEnabled = (name) => {
    return ['true', '1', 'yes', 'on'].includes(
        String(process.env[name] || '').trim().toLowerCase()
    );
};

const shouldExposeDebugOtp = (smsResult) => {
    return smsResult.provider === 'mock'
        && (
            process.env.NODE_ENV !== 'production'
            || isEnvEnabled('SHOW_DEBUG_OTP')
        );
};

const getOtpSecret = () => {
    const secret = process.env.OTP_SECRET;

    if (secret) {
        return secret;
    }

    if (process.env.NODE_ENV !== 'production') {
        return 'autowash-development-otp-secret';
    }

    throw new AppError(
        'OTP_SECRET is not configured',
        500,
        'OTP_SECRET_MISSING'
    );
};

const validateConfiguration = () => {
    getOtpSecret();
    smsService.validateConfiguration();

    return true;
};

const generateOtp = () => {
    return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
};

const hashOtp = ({ challengeId, otp }) => {
    return crypto
        .createHmac('sha256', getOtpSecret())
        .update(`${challengeId}:${otp}`)
        .digest('hex');
};

const otpMatches = ({ challengeId, otp, otpHash }) => {
    const expectedHash = Buffer.from(
        hashOtp({ challengeId, otp }),
        'hex'
    );
    const storedHash = Buffer.from(otpHash, 'hex');

    return expectedHash.length === storedHash.length
        && crypto.timingSafeEqual(expectedHash, storedHash);
};

const assertPurpose = (purpose) => {
    if (!PHONE_VERIFICATION_PURPOSE_VALUES.includes(purpose)) {
        throw new AppError(
            'Invalid phone verification purpose',
            400,
            'INVALID_PHONE_VERIFICATION_PURPOSE'
        );
    }
};

const assertRequestAllowed = async ({ phone, purpose, requestIp }) => {
    const now = new Date();
    const cooldownSeconds = getPositiveNumber(
        'OTP_REQUEST_COOLDOWN_SECONDS',
        DEFAULT_COOLDOWN_SECONDS
    );
    const windowMinutes = getPositiveNumber(
        'OTP_RATE_LIMIT_WINDOW_MINUTES',
        DEFAULT_RATE_LIMIT_WINDOW_MINUTES
    );
    const maxRequests = getPositiveNumber(
        'OTP_RATE_LIMIT_MAX_REQUESTS',
        DEFAULT_RATE_LIMIT_MAX_REQUESTS
    );
    const maxIpRequests = getPositiveNumber(
        'OTP_IP_RATE_LIMIT_MAX_REQUESTS',
        DEFAULT_IP_RATE_LIMIT_MAX_REQUESTS
    );
    const cooldownCutoff = new Date(
        now.getTime() - cooldownSeconds * 1000
    );
    const windowCutoff = new Date(
        now.getTime() - windowMinutes * 60 * 1000
    );

    const latestRequest = await PhoneVerification.findOne({
        phone,
        purpose,
    }).sort({ created_at: -1 });

    if (latestRequest?.created_at > cooldownCutoff) {
        throw new AppError(
            'Please wait before requesting another OTP',
            429,
            'OTP_REQUEST_COOLDOWN'
        );
    }

    const phoneRequestCount = await PhoneVerification.countDocuments({
        phone,
        created_at: { $gte: windowCutoff },
    });

    if (phoneRequestCount >= maxRequests) {
        throw new AppError(
            'Too many OTP requests for this phone',
            429,
            'OTP_RATE_LIMITED'
        );
    }

    if (requestIp) {
        const ipRequestCount = await PhoneVerification.countDocuments({
            request_ip: requestIp,
            created_at: { $gte: windowCutoff },
        });

        if (ipRequestCount >= maxIpRequests) {
            throw new AppError(
                'Too many OTP requests from this IP address',
                429,
                'OTP_IP_RATE_LIMITED'
            );
        }
    }
};

const assertTargetPhoneAllowed = async ({ phone, purpose, userId }) => {
    if (purpose === PHONE_VERIFICATION_PURPOSES.REGISTER) {
        const existingUser = await User.exists({ phone });

        if (existingUser) {
            throw new AppError(
                'Phone already exists',
                409,
                'PHONE_ALREADY_EXISTS'
            );
        }

        return;
    }

    if (!userId) {
        throw new AppError(
            'Authentication is required',
            401,
            'AUTHENTICATION_REQUIRED'
        );
    }

    const user = await User.findById(userId);

    if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (purpose === PHONE_VERIFICATION_PURPOSES.STAFF_ACTIVATION) {
        if (user.role !== USER_ROLES.STAFF) {
            throw new AppError(
                'Only staff accounts can use staff activation OTP',
                400,
                'STAFF_ACTIVATION_NOT_ALLOWED'
            );
        }

        if (normalizePhone(user.phone) !== phone) {
            throw new AppError(
                'Staff activation phone must match current account phone',
                400,
                'STAFF_ACTIVATION_PHONE_MISMATCH'
            );
        }

        if (
            user.onboarding_status !== USER_ONBOARDING_STATUSES.PENDING_PHONE_VERIFICATION
            || user.phone_verified_at
        ) {
            throw new AppError(
                'Staff account is not pending phone verification',
                400,
                'STAFF_ACTIVATION_NOT_PENDING'
            );
        }

        return;
    }

    if (normalizePhone(user.phone) === phone) {
        throw new AppError(
            'New phone must be different from current phone',
            400,
            'PHONE_UNCHANGED'
        );
    }

    const existingUser = await User.exists({
        phone,
        _id: { $ne: userId },
    });

    if (existingUser) {
        throw new AppError(
            'Phone already exists',
            409,
            'PHONE_ALREADY_EXISTS'
        );
    }
};

const requestVerification = async ({
    phone: rawPhone,
    purpose,
    userId = null,
    requestIp = '',
    userAgent = '',
}) => {
    assertPurpose(purpose);

    const phone = normalizePhone(rawPhone);
    const effectiveUserId = [
        PHONE_VERIFICATION_PURPOSES.CHANGE_PHONE,
        PHONE_VERIFICATION_PURPOSES.STAFF_ACTIVATION,
    ].includes(purpose) ? userId : null;

    await assertTargetPhoneAllowed({
        phone,
        purpose,
        userId: effectiveUserId,
    });
    await assertRequestAllowed({ phone, purpose, requestIp });

    const now = new Date();
    const otpExpiresMinutes = getPositiveNumber(
        'OTP_EXPIRES_IN_MINUTES',
        DEFAULT_OTP_EXPIRES_MINUTES
    );
    const rateLimitWindowMinutes = getPositiveNumber(
        'OTP_RATE_LIMIT_WINDOW_MINUTES',
        DEFAULT_RATE_LIMIT_WINDOW_MINUTES
    );
    const challengeId = new mongoose.Types.ObjectId();
    const otp = generateOtp();
    const expiresAt = new Date(
        now.getTime() + otpExpiresMinutes * 60 * 1000
    );
    const deleteAt = new Date(
        now.getTime()
        + Math.max(otpExpiresMinutes, rateLimitWindowMinutes) * 60 * 1000
    );

    await PhoneVerification.updateMany(
        {
            phone,
            purpose,
            user_id: effectiveUserId,
            verified_at: null,
            consumed_at: null,
            invalidated_at: null,
        },
        {
            $set: {
                invalidated_at: now,
            },
        }
    );

    await PhoneVerification.create({
        _id: challengeId,
        phone,
        purpose,
        user_id: effectiveUserId,
        otp_hash: hashOtp({
            challengeId: challengeId.toString(),
            otp,
        }),
        attempt_count: 0,
        request_ip: requestIp,
        user_agent: userAgent,
        expires_at: expiresAt,
        delete_at: deleteAt,
    });

    let smsResult;

    try {
        smsResult = await smsService.sendOtp({
            phone,
            otp,
            expiresInMinutes: otpExpiresMinutes,
        });
    } catch (error) {
        await PhoneVerification.deleteOne({ _id: challengeId });

        throw error;
    }

    return {
        challenge_id: challengeId.toString(),
        phone,
        purpose,
        expires_at: expiresAt,
        retry_after_seconds: getPositiveNumber(
            'OTP_REQUEST_COOLDOWN_SECONDS',
            DEFAULT_COOLDOWN_SECONDS
        ),
        debug_otp: shouldExposeDebugOtp(smsResult)
            ? smsResult.debug_otp
            : undefined,
    };
};

const verifyOtp = async ({
    challengeId,
    otp,
    userId = null,
}) => {
    const challenge = await PhoneVerification.findOne({
        _id: challengeId,
        consumed_at: null,
        invalidated_at: null,
    });

    if (!challenge || challenge.expires_at <= new Date()) {
        throw new AppError(
            'OTP is invalid or expired',
            400,
            'OTP_INVALID_OR_EXPIRED'
        );
    }

    if (
        [
            PHONE_VERIFICATION_PURPOSES.CHANGE_PHONE,
            PHONE_VERIFICATION_PURPOSES.STAFF_ACTIVATION,
        ].includes(challenge.purpose)
        && (!userId || challenge.user_id?.toString() !== userId.toString())
    ) {
        throw new AppError(
            'Phone verification does not belong to this user',
            403,
            'PHONE_VERIFICATION_FORBIDDEN'
        );
    }

    if (challenge.verified_at) {
        throw new AppError(
            'OTP has already been verified',
            400,
            'OTP_ALREADY_VERIFIED'
        );
    }

    const maxAttempts = getPositiveNumber(
        'OTP_MAX_ATTEMPTS',
        DEFAULT_MAX_ATTEMPTS
    );

    if (challenge.attempt_count >= maxAttempts) {
        throw new AppError(
            'OTP is invalid or expired',
            400,
            'OTP_INVALID_OR_EXPIRED'
        );
    }

    const matches = otpMatches({
        challengeId: challenge._id.toString(),
        otp,
        otpHash: challenge.otp_hash,
    });

    if (!matches) {
        const nextAttemptCount = challenge.attempt_count + 1;
        const update = {
            $set: {
                attempt_count: nextAttemptCount,
            },
        };

        if (nextAttemptCount >= maxAttempts) {
            update.$set.invalidated_at = new Date();
        }

        await PhoneVerification.updateOne(
            {
                _id: challenge._id,
                verified_at: null,
                consumed_at: null,
                invalidated_at: null,
                attempt_count: { $lt: maxAttempts },
            },
            {
                $inc: {
                    attempt_count: 1,
                },
                ...(update.$set.invalidated_at
                    ? {
                        $set: {
                            invalidated_at: update.$set.invalidated_at,
                        },
                    }
                    : {}),
            }
        );

        throw new AppError(
            'OTP is invalid or expired',
            400,
            'OTP_INVALID_OR_EXPIRED'
        );
    }

    const verificationToken = crypto.randomBytes(48).toString('hex');
    const verifiedAt = new Date();
    const tokenExpiresMinutes = getPositiveNumber(
        'PHONE_VERIFICATION_TOKEN_EXPIRES_IN_MINUTES',
        DEFAULT_VERIFICATION_TOKEN_EXPIRES_MINUTES
    );
    const tokenExpiresAt = new Date(
        verifiedAt.getTime() + tokenExpiresMinutes * 60 * 1000
    );

    const verifiedChallenge = await PhoneVerification.findOneAndUpdate(
        {
            _id: challenge._id,
            verified_at: null,
            consumed_at: null,
            invalidated_at: null,
            expires_at: { $gt: verifiedAt },
            attempt_count: { $lt: maxAttempts },
        },
        {
            $set: {
                verification_token_hash: hashToken(verificationToken),
                verified_at: verifiedAt,
                expires_at: tokenExpiresAt,
                delete_at: tokenExpiresAt,
            },
        },
        { new: true }
    );

    if (!verifiedChallenge) {
        throw new AppError(
            'OTP is invalid or expired',
            400,
            'OTP_INVALID_OR_EXPIRED'
        );
    }

    return {
        verification_token: verificationToken,
        phone: verifiedChallenge.phone,
        purpose: verifiedChallenge.purpose,
        expires_at: tokenExpiresAt,
    };
};

const getVerifiedChallenge = async ({
    phone: rawPhone,
    purpose,
    verificationToken,
    userId = null,
    session = null,
}) => {
    const phone = normalizePhone(rawPhone);
    const query = PhoneVerification.findOne({
        phone,
        purpose,
        verification_token_hash: hashToken(verificationToken),
        verified_at: { $ne: null },
        consumed_at: null,
        invalidated_at: null,
        expires_at: { $gt: new Date() },
    });
    const challenge = session ? await query.session(session) : await query;

    if (!challenge) {
        throw new AppError(
            'Phone verification token is invalid or expired',
            400,
            'PHONE_VERIFICATION_TOKEN_INVALID'
        );
    }

    if (
        [
            PHONE_VERIFICATION_PURPOSES.CHANGE_PHONE,
            PHONE_VERIFICATION_PURPOSES.STAFF_ACTIVATION,
        ].includes(purpose)
        && (!userId || challenge.user_id?.toString() !== userId.toString())
    ) {
        throw new AppError(
            'Phone verification does not belong to this user',
            403,
            'PHONE_VERIFICATION_FORBIDDEN'
        );
    }

    return challenge;
};

const consumeVerifiedChallenge = async (challengeId, session = null) => {
    const challenge = await PhoneVerification.findOneAndUpdate(
        {
            _id: challengeId,
            consumed_at: null,
            invalidated_at: null,
            expires_at: { $gt: new Date() },
        },
        {
            $set: {
                consumed_at: new Date(),
            },
        },
        {
            new: true,
            ...(session ? { session } : {}),
        }
    );

    if (!challenge) {
        throw new AppError(
            'Phone verification token is invalid or expired',
            400,
            'PHONE_VERIFICATION_TOKEN_INVALID'
        );
    }

    return challenge;
};

module.exports = {
    validateConfiguration,
    requestVerification,
    verifyOtp,
    getVerifiedChallenge,
    consumeVerifiedChallenge,
};
