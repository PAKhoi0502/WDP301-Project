const { z } = require('zod');

const { STAFF_TYPE_VALUES } = require('../../shared/constants/staff.constant');

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
            is_active: z.boolean().optional(),
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
            staff_type: z.enum(STAFF_TYPE_VALUES).optional(),
            garage_id: optionalObjectIdField,
            is_active: z.boolean().optional(),
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
        })
        .strict(),
});

module.exports = {
    idParamSchema,
    getStaffProfilesSchema,
    createStaffProfileSchema,
    updateStaffProfileSchema,
    updateStaffProfileStatusSchema,
};
