const { z } = require('zod');

const {
    STAFF_EMPLOYMENT_STATUS_VALUES,
    STAFF_TYPE_VALUES,
} = require('../../shared/constants/staff.constant');
const { normalizePhone, isValidPhone } = require('../../shared/utils/phone');

const emptyToUndefined = (value) => {
    if (typeof value === 'string' && value.trim() === '') {
        return undefined;
    }

    return value;
};

const emptyToNull = (value) => {
    if (typeof value === 'string' && value.trim() === '') {
        return null;
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

const optionalObjectIdField = z.preprocess(
    emptyToNull,
    objectIdField.nullable().optional()
);

const staffCodeField = z
    .string()
    .trim()
    .min(2, 'Staff code must have at least 2 characters')
    .max(30, 'Staff code must have at most 30 characters')
    .regex(/^[A-Za-z0-9_-]+$/, 'Staff code is invalid');

const optionalStaffCodeField = z.preprocess(emptyToUndefined, staffCodeField.optional());

const fullNameField = z
    .string()
    .trim()
    .min(2, 'Full name must have at least 2 characters')
    .max(100, 'Full name must have at most 100 characters');

const emailField = z
    .string()
    .trim()
    .toLowerCase()
    .email('Email is invalid')
    .max(120, 'Email must have at most 120 characters');

const phoneField = z
    .string()
    .trim()
    .min(9, 'Phone must have at least 9 characters')
    .max(30, 'Phone must have at most 30 characters')
    .transform(normalizePhone)
    .refine(isValidPhone, 'Phone is invalid');

const statusReasonField = z.preprocess(
    emptyToUndefined,
    z.string().trim().min(2).max(500).optional()
);

const atLeastOneField = (data) => Object.values(data).some((value) => value !== undefined);

const idParamSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
});

const getStaffProfilesSchema = z.object({
    query: z
        .object({
            page: z.coerce.number().int().min(1).default(1),
            limit: z.coerce.number().int().min(1).max(100).default(20),
            search: z.preprocess(
                emptyToUndefined,
                z.string().trim().max(100).optional()
            ),
            staff_type: z.enum(STAFF_TYPE_VALUES).optional(),
            garage_id: objectIdField.optional(),
            user_id: objectIdField.optional(),
            is_active: stringBooleanField.optional(),
        })
        .strict(),
});

const createStaffProfileSchema = z.object({
    body: z
        .object({
            user_id: objectIdField,
            staff_code: staffCodeField,
            staff_type: z.enum(STAFF_TYPE_VALUES),
            garage_id: optionalObjectIdField,
        })
        .strict(),
});

const inviteStaffSchema = z.object({
    body: z
        .object({
            full_name: fullNameField,
            email: emailField,
            phone: phoneField,
            staff_code: staffCodeField,
            staff_type: z.enum(STAFF_TYPE_VALUES),
            garage_id: objectIdField,
        })
        .strict(),
});

const updateStaffProfileSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
    body: z
        .object({
            staff_code: optionalStaffCodeField,
            garage_id: optionalObjectIdField,
        })
        .strict()
        .refine(atLeastOneField, {
            message: 'At least one field is required',
        }),
});

const updateStaffProfileStatusSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
    body: z
        .object({
            is_active: z.boolean(),
            reason: statusReasonField,
        })
        .strict(),
});

const updateStaffEmploymentStatusSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
    body: z
        .object({
            status: z.enum(STAFF_EMPLOYMENT_STATUS_VALUES),
            reason: statusReasonField,
        })
        .strict(),
});

module.exports = {
    idParamSchema,
    getStaffProfilesSchema,
    createStaffProfileSchema,
    inviteStaffSchema,
    updateStaffProfileSchema,
    updateStaffProfileStatusSchema,
    updateStaffEmploymentStatusSchema,
};
