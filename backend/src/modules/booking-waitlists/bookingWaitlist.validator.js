const { z } = require('zod');

const { WAITLIST_STATUS_VALUES } = require('../../shared/constants/waitlist.constant');
const { VEHICLE_TYPE_VALUES } = require('../../shared/constants/vehicle.constant');

const emptyToUndefined = (value) => {
    if (typeof value === 'string' && value.trim() === '') {
        return undefined;
    }

    return value;
};

const objectIdField = z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid resource id');

const optionalObjectIdField = z.preprocess(emptyToUndefined, objectIdField.optional());

const optionalTextField = (max = 500) => z.preprocess(
    emptyToUndefined,
    z.string().trim().max(max).optional()
);

const isoDateTimeField = z
    .string()
    .trim()
    .datetime({ offset: true, message: 'Datetime must be ISO 8601 with timezone offset' });

const paginationQueryFields = {
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
};

const idParamSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
});

const createWaitlistSchema = z.object({
    body: z
        .object({
            garage_id: objectIdField,
            vehicle_id: objectIdField,
            service_package_id: objectIdField,
            add_on_service_ids: z.array(objectIdField).default([]),
            desired_start_time: isoDateTimeField,
            note: optionalTextField(1000),
        })
        .strict(),
});

const getMyWaitlistsSchema = z.object({
    query: z
        .object({
            ...paginationQueryFields,
            status: z.enum(WAITLIST_STATUS_VALUES).optional(),
            garage_id: optionalObjectIdField,
            service_package_id: optionalObjectIdField,
            vehicle_id: optionalObjectIdField,
        })
        .strict(),
});

const getAdminWaitlistsSchema = z.object({
    query: z
        .object({
            ...paginationQueryFields,
            status: z.enum(WAITLIST_STATUS_VALUES).optional(),
            customer_id: optionalObjectIdField,
            vehicle_id: optionalObjectIdField,
            garage_id: optionalObjectIdField,
            service_package_id: optionalObjectIdField,
            vehicle_type: z.enum(VEHICLE_TYPE_VALUES).optional(),
            from: z.preprocess(emptyToUndefined, isoDateTimeField.optional()),
            to: z.preprocess(emptyToUndefined, isoDateTimeField.optional()),
        })
        .strict(),
});

const cancelWaitlistSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
    body: z
        .object({
            reason: optionalTextField(500),
        })
        .strict()
        .default({}),
});

module.exports = {
    idParamSchema,
    createWaitlistSchema,
    getMyWaitlistsSchema,
    getAdminWaitlistsSchema,
    cancelWaitlistSchema,
};
