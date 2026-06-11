const { z } = require('zod');

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

const timeField = z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must use HH:mm format');

const optionalTextField = (maxLength) => z.preprocess(
    emptyToNull,
    z.string().trim().max(maxLength).nullable().optional()
);

const optionalPhoneField = z.preprocess(
    emptyToNull,
    z
        .string()
        .trim()
        .min(9, 'Phone must have at least 9 characters')
        .max(20, 'Phone must have at most 20 characters')
        .regex(/^[0-9+\-\s().]+$/, 'Phone is invalid')
        .nullable()
        .optional()
);

const optionalEmailField = z.preprocess(
    emptyToNull,
    z.string().trim().email('Email is invalid').max(120).nullable().optional()
);

const garageCodeField = z
    .string()
    .trim()
    .min(2, 'Garage code must have at least 2 characters')
    .max(30, 'Garage code must have at most 30 characters')
    .regex(/^[A-Za-z0-9_-]+$/, 'Garage code is invalid');

const optionalGarageCodeField = z.preprocess(emptyToUndefined, garageCodeField.optional());

const latitudeField = z.preprocess(
    emptyToNull,
    z.coerce.number().min(-90).max(90).nullable().optional()
);

const longitudeField = z.preprocess(
    emptyToNull,
    z.coerce.number().min(-180).max(180).nullable().optional()
);

const atLeastOneField = (data) => Object.values(data).some((value) => value !== undefined);

const timeToMinutes = (time) => {
    const [hour, minute] = time.split(':').map(Number);

    return hour * 60 + minute;
};

const isValidBusinessHourRange = (data) => {
    if (!data.opening_time || !data.closing_time) {
        return true;
    }

    return timeToMinutes(data.opening_time) < timeToMinutes(data.closing_time);
};

const idParamSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
});

const getGaragesSchema = z.object({
    query: z
        .object({
            page: z.coerce.number().int().min(1).default(1),
            limit: z.coerce.number().int().min(1).max(100).default(20),
            search: z.preprocess(
                emptyToUndefined,
                z.string().trim().max(100).optional()
            ),
            city: z.preprocess(
                emptyToUndefined,
                z.string().trim().max(100).optional()
            ),
            district: z.preprocess(
                emptyToUndefined,
                z.string().trim().max(100).optional()
            ),
        })
        .strict(),
});

const getAdminGaragesSchema = z.object({
    query: z
        .object({
            page: z.coerce.number().int().min(1).default(1),
            limit: z.coerce.number().int().min(1).max(100).default(20),
            search: z.preprocess(
                emptyToUndefined,
                z.string().trim().max(100).optional()
            ),
            city: z.preprocess(
                emptyToUndefined,
                z.string().trim().max(100).optional()
            ),
            district: z.preprocess(
                emptyToUndefined,
                z.string().trim().max(100).optional()
            ),
            is_active: stringBooleanField.optional(),
        })
        .strict(),
});

const createGarageSchema = z.object({
    body: z
        .object({
            name: z.string().trim().min(2).max(120),
            garage_code: garageCodeField,
            address: z.string().trim().min(5).max(500),
            ward: optionalTextField(100),
            district: optionalTextField(100),
            city: optionalTextField(100),
            phone: optionalPhoneField,
            email: optionalEmailField,
            latitude: latitudeField,
            longitude: longitudeField,
            opening_time: timeField.default('07:00'),
            closing_time: timeField.default('18:00'),
            slot_interval_minutes: z.coerce.number().int().min(5).max(240).default(30),
            late_grace_minutes: z.coerce.number().int().min(0).max(240).default(15),
            description: optionalTextField(1000),
            is_active: z.boolean().optional(),
        })
        .strict()
        .refine(isValidBusinessHourRange, {
            message: 'Opening time must be before closing time',
        }),
});

const updateGarageSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
    body: z
        .object({
            name: z.preprocess(
                emptyToUndefined,
                z.string().trim().min(2).max(120).optional()
            ),
            garage_code: optionalGarageCodeField,
            address: z.preprocess(
                emptyToUndefined,
                z.string().trim().min(5).max(500).optional()
            ),
            ward: optionalTextField(100),
            district: optionalTextField(100),
            city: optionalTextField(100),
            phone: optionalPhoneField,
            email: optionalEmailField,
            latitude: latitudeField,
            longitude: longitudeField,
            opening_time: z.preprocess(emptyToUndefined, timeField.optional()),
            closing_time: z.preprocess(emptyToUndefined, timeField.optional()),
            slot_interval_minutes: z.preprocess(
                emptyToUndefined,
                z.coerce.number().int().min(5).max(240).optional()
            ),
            late_grace_minutes: z.preprocess(
                emptyToUndefined,
                z.coerce.number().int().min(0).max(240).optional()
            ),
            description: optionalTextField(1000),
            is_active: z.boolean().optional(),
        })
        .strict()
        .refine(atLeastOneField, {
            message: 'At least one field is required',
        })
        .refine(isValidBusinessHourRange, {
            message: 'Opening time must be before closing time',
        }),
});

const updateGarageStatusSchema = z.object({
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
    getGaragesSchema,
    getAdminGaragesSchema,
    createGarageSchema,
    updateGarageSchema,
    updateGarageStatusSchema,
};
