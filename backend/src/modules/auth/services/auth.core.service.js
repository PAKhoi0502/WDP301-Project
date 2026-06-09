const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const User = require('../../users/user.model');
const AuthMapper = require('../auth.mapper');
const TokenService = require('../services/token.service');
const emailService = require('../../emails/email.service');
const notificationService = require('../../notifications/notification.service');
const { hashToken } = require('../security/token.hash');
const PasswordReset = require('../models/passwordResetToken.model');
const PasswordResetRateLimit = require('../models/passwordResetRateLimit.model');
const { AppError } = require('../../../shared/utils/appError');
const { USER_ROLES } = require('../../../shared/constants/roles.constant');
const {
    NOTIFICATION_TYPES,
    NOTIFICATION_RELATED_TYPES,
} = require('../../../shared/constants/notification.constant');
const { signAccessToken, signRefreshToken } = require('../../../shared/utils/jwt');

const DEFAULT_SALT_ROUNDS = 10;
const DEFAULT_REFRESH_TOKEN_DAYS = 7;
const DEFAULT_PASSWORD_RESET_MINUTES = 15;
const DEFAULT_PASSWORD_RESET_WINDOW_MINUTES = 15;
const DEFAULT_PASSWORD_RESET_MAX_REQUESTS = 5;
const DEFAULT_PASSWORD_RESET_COOLDOWN_SECONDS = 60;
const MAX_RESET_ATTEMPTS = 5;

const normalizePhone = (phone) => {
    return phone.trim();
};

const normalizeEmail = (email) => {
    if (!email) {
        return undefined;
    }

    return email.trim().toLowerCase();
};

const getSaltRounds = () => {
    return Number(process.env.BCRYPT_SALT_ROUNDS) || DEFAULT_SALT_ROUNDS;
};

const getRefreshTokenExpiresAt = () => {
    const days = Number(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS)
        || DEFAULT_REFRESH_TOKEN_DAYS;

    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
};

const getPasswordResetExpiresAt = () => {
    const minutes = Number(process.env.PASSWORD_RESET_EXPIRES_IN_MINUTES)
        || DEFAULT_PASSWORD_RESET_MINUTES;

    return new Date(Date.now() + minutes * 60 * 1000);
};

const getPasswordResetExpiresInMinutes = () => {
    return Number(process.env.PASSWORD_RESET_EXPIRES_IN_MINUTES)
        || DEFAULT_PASSWORD_RESET_MINUTES;
};

const generateRandomToken = () => {
    return crypto.randomBytes(64).toString('hex');
};

const sendPasswordResetEmail = async ({ user, resetToken, phone }) => {
    if (!user.email) {
        return null;
    }

    const expiresInMinutes = getPasswordResetExpiresInMinutes();
    const emailPayload = emailService.buildPasswordResetEmail({
        resetToken,
        expiresInMinutes,
        fullName: user.full_name,
    });

    return notificationService.createEmailNotification({
        userId: user._id,
        recipientEmail: user.email,
        type: NOTIFICATION_TYPES.AUTH_PASSWORD_RESET_REQUESTED,
        title: emailPayload.subject,
        message: emailPayload.text,
        relatedType: NOTIFICATION_RELATED_TYPES.AUTH,
        relatedId: user._id,
        metadata: {
            phone,
            expires_in_minutes: expiresInMinutes,
        },
        html: emailPayload.html,
        text: emailPayload.text,
        throwOnFailure: false,
    });
};

const createRefreshTokenForUser = async (user, meta = {}) => {
    const jti = crypto.randomUUID();
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

const createAccessTokenForUser = (user) => {
    return signAccessToken({
        user_id: user._id.toString(),
        role: user.role,
    });
};

const consumePasswordResetQuota = async (phone) => {
    const now = new Date();
    const windowMinutes = Number(process.env.PASSWORD_RESET_RATE_LIMIT_WINDOW_MINUTES)
        || DEFAULT_PASSWORD_RESET_WINDOW_MINUTES;
    const maxRequests = Number(process.env.PASSWORD_RESET_RATE_LIMIT_MAX_REQUESTS)
        || DEFAULT_PASSWORD_RESET_MAX_REQUESTS;
    const cooldownSeconds = Number(process.env.PASSWORD_RESET_RATE_LIMIT_COOLDOWN_SECONDS)
        || DEFAULT_PASSWORD_RESET_COOLDOWN_SECONDS;

    const windowMs = windowMinutes * 60 * 1000;
    const cooldownMs = cooldownSeconds * 1000;
    const windowCutoff = new Date(now.getTime() - windowMs);
    const cooldownCutoff = new Date(now.getTime() - cooldownMs);

    const existing = await PasswordResetRateLimit.findOne({ phone });

    if (existing) {
        if (existing.last_requested_at > cooldownCutoff) {
            throw new AppError(
                'Please wait before requesting a new reset token',
                429,
                'PASSWORD_RESET_COOLDOWN'
            );
        }

        if (
            existing.window_started_at >= windowCutoff
            && existing.request_count >= maxRequests
        ) {
            throw new AppError(
                'Too many password reset requests',
                429,
                'PASSWORD_RESET_RATE_LIMITED'
            );
        }
    }

    const windowExpired = !existing || existing.window_started_at < windowCutoff;
    const windowStartedAt = windowExpired ? now : existing.window_started_at;
    const expiresAt = new Date(windowStartedAt.getTime() + windowMs);

    if (windowExpired) {
        await PasswordResetRateLimit.findOneAndUpdate(
            { phone },
            {
                $set: {
                    phone,
                    window_started_at: now,
                    request_count: 1,
                    last_requested_at: now,
                    expires_at: expiresAt,
                },
            },
            {
                upsert: true,
                new: true,
                runValidators: true,
            }
        );

        return;
    }

    const updated = await PasswordResetRateLimit.findOneAndUpdate(
        {
            phone,
            last_requested_at: { $lte: cooldownCutoff },
            request_count: { $lt: maxRequests },
        },
        {
            $inc: { request_count: 1 },
            $set: {
                last_requested_at: now,
                expires_at: expiresAt,
            },
        },
        {
            new: true,
            runValidators: true,
        }
    );

    if (!updated) {
        throw new AppError(
            'Too many password reset requests',
            429,
            'PASSWORD_RESET_RATE_LIMITED'
        );
    }
};

const register = async (payload) => {
    const phone = normalizePhone(payload.phone);
    const email = normalizeEmail(payload.email);
    const fullName = payload.full_name?.trim() || '';

    const existingPhone = await User.exists({ phone });

    if (existingPhone) {
        throw new AppError(
            'Phone already exists',
            409,
            'PHONE_ALREADY_EXISTS'
        );
    }

    if (email) {
        const existingEmail = await User.exists({ email });

        if (existingEmail) {
            throw new AppError(
                'Email already exists',
                409,
                'EMAIL_ALREADY_EXISTS'
            );
        }
    }

    const passwordHash = await bcrypt.hash(payload.password, getSaltRounds());

    const user = await User.create({
        full_name: fullName,
        email,
        phone,
        password_hash: passwordHash,
        role: USER_ROLES.CUSTOMER,
    });

    return {
        user: AuthMapper.toUserDto(user),
    };
};

const login = async (payload, meta = {}) => {
    const phone = normalizePhone(payload.phone);

    const user = await User.findOne({ phone }).select('+password_hash');

    if (!user) {
        throw new AppError(
            'Invalid phone or password',
            401,
            'INVALID_CREDENTIALS'
        );
    }

    if (!user.is_active) {
        throw new AppError(
            'User account is inactive',
            403,
            'USER_INACTIVE'
        );
    }

    const isPasswordValid = await bcrypt.compare(
        payload.password,
        user.password_hash
    );

    if (!isPasswordValid) {
        throw new AppError(
            'Invalid phone or password',
            401,
            'INVALID_CREDENTIALS'
        );
    }

    const lastLoginAt = new Date();

    await User.updateOne(
        { _id: user._id },
        { $set: { last_login_at: lastLoginAt } }
    );

    user.last_login_at = lastLoginAt;

    const accessToken = createAccessTokenForUser(user);
    const refreshToken = await createRefreshTokenForUser(user, meta);

    return {
        user: AuthMapper.toUserDto(user),
        tokens: {
            access_token: accessToken,
            refresh_token: refreshToken,
        },
    };
};

const changePassword = async (userId, payload) => {
    const user = await User.findById(userId).select('+password_hash');

    if (!user) {
        throw new AppError(
            'User not found',
            404,
            'USER_NOT_FOUND'
        );
    }

    const isPasswordValid = await bcrypt.compare(
        payload.current_password,
        user.password_hash
    );

    if (!isPasswordValid) {
        throw new AppError(
            'Current password is incorrect',
            401,
            'INVALID_CURRENT_PASSWORD'
        );
    }

    const passwordHash = await bcrypt.hash(payload.new_password, getSaltRounds());

    await User.updateOne(
        { _id: user._id },
        {
            $set: {
                password_hash: passwordHash,
                password_changed_at: new Date(),
            },
        }
    );

    await TokenService.revokeAllByUser(user._id, 'password_changed');

    return {
        message: 'Password changed successfully',
    };
};

const forgotPassword = async (payload) => {
    const phone = normalizePhone(payload.phone);

    const genericResponse = {
        message: 'If the phone exists, a password reset token has been generated',
    };

    const user = await User.findOne({ phone });

    if (!user || !user.is_active) {
        return genericResponse;
    }

    await consumePasswordResetQuota(phone);

    await PasswordReset.updateMany(
        {
            user_id: user._id,
            is_used: false,
        },
        {
            $set: {
                is_used: true,
                used_at: new Date(),
            },
        }
    );

    const resetToken = generateRandomToken();

    await PasswordReset.create({
        user_id: user._id,
        phone,
        reset_token_hash: hashToken(resetToken),
        expires_at: getPasswordResetExpiresAt(),
    });

    await sendPasswordResetEmail({
        user,
        resetToken,
        phone,
    });

    if (process.env.NODE_ENV !== 'production') {
        return {
            ...genericResponse,
            reset_token: resetToken,
        };
    }

    return genericResponse;
};

const resetPassword = async (payload) => {
    const phone = normalizePhone(payload.phone);
    const resetTokenHash = hashToken(payload.reset_token);

    const user = await User.findOne({ phone });

    if (!user || !user.is_active) {
        throw new AppError(
            'Invalid or expired reset token',
            400,
            'INVALID_OR_EXPIRED_RESET_TOKEN'
        );
    }

    const resetRecord = await PasswordReset.findOne({
        user_id: user._id,
        reset_token_hash: resetTokenHash,
        is_used: false,
        expires_at: { $gt: new Date() },
    });

    if (!resetRecord) {
        const latestRecord = await PasswordReset.findOne({
            user_id: user._id,
            is_used: false,
            expires_at: { $gt: new Date() },
        }).sort({ created_at: -1 });

        if (latestRecord) {
            latestRecord.attempt_count += 1;

            if (latestRecord.attempt_count >= MAX_RESET_ATTEMPTS) {
                latestRecord.is_used = true;
                latestRecord.used_at = new Date();
            }

            await latestRecord.save();
        }

        throw new AppError(
            'Invalid or expired reset token',
            400,
            'INVALID_OR_EXPIRED_RESET_TOKEN'
        );
    }

    if (resetRecord.attempt_count >= MAX_RESET_ATTEMPTS) {
        throw new AppError(
            'Invalid or expired reset token',
            400,
            'INVALID_OR_EXPIRED_RESET_TOKEN'
        );
    }

    const passwordHash = await bcrypt.hash(payload.new_password, getSaltRounds());

    await User.updateOne(
        { _id: user._id },
        {
            $set: {
                password_hash: passwordHash,
                password_changed_at: new Date(),
            },
        }
    );

    resetRecord.is_used = true;
    resetRecord.used_at = new Date();
    await resetRecord.save();

    await TokenService.revokeAllByUser(user._id, 'password_reset');

    return {
        message: 'Password reset successfully',
    };
};

module.exports = {
    register,
    login,
    changePassword,
    forgotPassword,
    resetPassword,
    createAccessTokenForUser,
    createRefreshTokenForUser,
};
