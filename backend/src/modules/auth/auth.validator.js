const { z } = require('zod');

const { normalizePhone, isValidPhone } = require('../../shared/utils/phone');
const {
    PHONE_VERIFICATION_PURPOSE_VALUES,
} = require('./phoneVerification.constant');

const emptyToUndefined = (value) => {
    if (typeof value === 'string' && value.trim() === '') {
        return undefined;
    }

    return value;
};

const phoneField = z
    .string()
    .trim()
    .min(9, 'Phone must have at least 9 characters')
    .max(30, 'Phone must have at most 30 characters')
    .transform(normalizePhone)
    .refine(isValidPhone, 'Phone is invalid');

const passwordField = z
    .string()
    .min(6, 'Password must have at least 6 characters')
    .max(100, 'Password must have at most 100 characters');

const optionalEmailField = z.preprocess(
    emptyToUndefined,
    z
        .string()
        .trim()
        .toLowerCase()
        .email('Email is invalid')
        .optional()
);

const optionalFullNameField = z.preprocess(
    emptyToUndefined,
    z
        .string()
        .trim()
        .min(2, 'Full name must have at least 2 characters')
        .max(100, 'Full name must have at most 100 characters')
        .optional()
);

const resetTokenField = z
    .string()
    .trim()
    .min(32, 'Reset token is invalid')
    .max(200, 'Reset token is invalid');

const phoneVerificationTokenField = z
    .string()
    .trim()
    .min(64, 'Phone verification token is invalid')
    .max(200, 'Phone verification token is invalid');

const registerSchema = z.object({
    body: z
        .object({
            phone: phoneField,
            password: passwordField,
            email: optionalEmailField,
            full_name: optionalFullNameField,
            phone_verification_token: phoneVerificationTokenField,
        })
        .strict(),
});

const requestPhoneVerificationSchema = z.object({
    body: z
        .object({
            phone: phoneField,
            purpose: z.enum(PHONE_VERIFICATION_PURPOSE_VALUES),
        })
        .strict(),
});

const verifyPhoneOtpSchema = z.object({
    body: z
        .object({
            challenge_id: z
                .string()
                .trim()
                .regex(/^[0-9a-fA-F]{24}$/, 'Challenge id is invalid'),
            otp: z
                .string()
                .trim()
                .regex(/^[0-9]{6}$/, 'OTP must contain exactly 6 digits'),
        })
        .strict(),
});

const loginSchema = z.object({
    body: z
        .object({
            phone: phoneField,
            password: z.string().min(1, 'Password is required'),
        })
        .strict(),
});

const changePasswordSchema = z.object({
    body: z
        .object({
            current_password: z.string().min(1, 'Current password is required'),
            new_password: passwordField,
        })
        .strict()
        .refine((data) => data.current_password !== data.new_password, {
            message: 'New password must be different from current password',
            path: ['new_password'],
        }),
});

const forgotPasswordSchema = z.object({
    body: z
        .object({
            phone: phoneField,
        })
        .strict(),
});

const resetPasswordSchema = z.object({
    body: z
        .object({
            phone: phoneField,
            reset_token: resetTokenField,
            new_password: passwordField,
        })
        .strict(),
});

module.exports = {
    registerSchema,
    requestPhoneVerificationSchema,
    verifyPhoneOtpSchema,
    loginSchema,
    changePasswordSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
};
