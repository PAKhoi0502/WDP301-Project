const { z } = require('zod');

const { USER_ROLE_VALUES } = require('../../shared/constants/roles.constant');
const { normalizePhone, isValidPhone } = require('../../shared/utils/phone');

const emptyToUndefined = (value) => {
    if (typeof value === 'string' && value.trim() === '') {
        return undefined;
    }

    return value;
};

const stringBooleanField = z.preprocess((value) => {
    if (value === 'true') {
        return true;
    }

    if (value === 'false') {
        return false;
    }

    return value;
}, z.boolean());

const objectIdField = z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid resource id');

const phoneField = z
    .string()
    .trim()
    .min(9, 'Phone must have at least 9 characters')
    .max(30, 'Phone must have at most 30 characters')
    .transform(normalizePhone)
    .refine(isValidPhone, 'Phone is invalid');

const optionalFullNameField = z.preprocess(
    emptyToUndefined,
    z
        .string()
        .trim()
        .min(2, 'Full name must have at least 2 characters')
        .max(100, 'Full name must have at most 100 characters')
        .optional()
);

const optionalEmailField = z.preprocess(
    emptyToUndefined,
    z
        .string()
        .trim()
        .toLowerCase()
        .email('Email is invalid')
        .max(120, 'Email must have at most 120 characters')
        .optional()
);

const optionalPhoneField = z.preprocess(emptyToUndefined, phoneField.optional());

const optionalVerificationTokenField = z.preprocess(
    emptyToUndefined,
    z
        .string()
        .trim()
        .min(64, 'Phone verification token is invalid')
        .max(200, 'Phone verification token is invalid')
        .optional()
);

const optionalAvatarUrlField = z.preprocess(
    emptyToUndefined,
    z
        .string()
        .trim()
        .url('Avatar URL is invalid')
        .max(500, 'Avatar URL must have at most 500 characters')
        .optional()
);

const atLeastOneField = (data) => Object.values(data).some((value) => value !== undefined);

const idParamSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
});

const getUsersSchema = z.object({
    query: z
        .object({
            page: z.coerce.number().int().min(1).default(1),
            limit: z.coerce.number().int().min(1).max(100).default(20),
            search: z.preprocess(
                emptyToUndefined,
                z.string().trim().max(100).optional()
            ),
            role: z.enum(USER_ROLE_VALUES).optional(),
            is_active: stringBooleanField.optional(),
        })
        .strict(),
});

const updateMeSchema = z.object({
    body: z
        .object({
            full_name: optionalFullNameField,
            email: optionalEmailField,
            phone: optionalPhoneField,
            phone_verification_token: optionalVerificationTokenField,
            current_password: z.preprocess(
                emptyToUndefined,
                z.string().min(1, 'Current password is required').optional()
            ),
            avatar_url: optionalAvatarUrlField,
        })
        .strict()
        .refine(atLeastOneField, {
            message: 'At least one field is required',
        }),
});

const updateUserSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
    body: z
        .object({
            full_name: optionalFullNameField,
            email: optionalEmailField,
            phone: optionalPhoneField,
            phone_verification_token: optionalVerificationTokenField,
            avatar_url: optionalAvatarUrlField,
            role: z.enum(USER_ROLE_VALUES).optional(),
            is_active: z.boolean().optional(),
        })
        .strict()
        .refine(atLeastOneField, {
            message: 'At least one field is required',
        }),
});

const updateUserStatusSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
    body: z
        .object({
            is_active: z.boolean(),
        })
        .strict(),
});

const updateUserRoleSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
    body: z
        .object({
            role: z.enum(USER_ROLE_VALUES),
        })
        .strict(),
});

module.exports = {
    idParamSchema,
    getUsersSchema,
    updateMeSchema,
    updateUserSchema,
    updateUserStatusSchema,
    updateUserRoleSchema,
};
