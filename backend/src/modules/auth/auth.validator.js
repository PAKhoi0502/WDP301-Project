const { z } = require('zod');

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
    .max(15, 'Phone must have at most 15 characters')
    .regex(/^\+?[0-9]{9,15}$/, 'Phone is invalid');

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

const registerSchema = z.object({
    body: z
        .object({
            phone: phoneField,
            password: passwordField,
            email: optionalEmailField,
            full_name: optionalFullNameField,
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
    loginSchema,
    changePasswordSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
};
