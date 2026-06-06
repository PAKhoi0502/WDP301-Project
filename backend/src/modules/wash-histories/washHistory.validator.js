const { z } = require('zod');

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

const isoDateTimeField = z
    .string()
    .trim()
    .datetime({ offset: true, message: 'Datetime must be ISO 8601 with timezone offset' });

const paginationQueryFields = {
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
};

const optionalObjectIdField = z.preprocess(emptyToUndefined, objectIdField.optional());
const optionalDateTimeFilter = z.preprocess(emptyToUndefined, isoDateTimeField.optional());

const dateRangeValid = (query) => {
    if (!query.from || !query.to) {
        return true;
    }

    return new Date(query.from) <= new Date(query.to);
};

const baseQueryFields = {
    ...paginationQueryFields,
    vehicle_id: optionalObjectIdField,
    garage_id: optionalObjectIdField,
    service_package_id: optionalObjectIdField,
    vehicle_type: z.enum(VEHICLE_TYPE_VALUES).optional(),
    from: optionalDateTimeFilter,
    to: optionalDateTimeFilter,
};

const idParamSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
});

const getMyWashHistoriesSchema = z.object({
    query: z
        .object(baseQueryFields)
        .strict()
        .refine(dateRangeValid, {
            message: 'From date must be before or equal to to date',
        }),
});

const getAdminWashHistoriesSchema = z.object({
    query: z
        .object({
            ...baseQueryFields,
            customer_id: optionalObjectIdField,
        })
        .strict()
        .refine(dateRangeValid, {
            message: 'From date must be before or equal to to date',
        }),
});

module.exports = {
    idParamSchema,
    getMyWashHistoriesSchema,
    getAdminWashHistoriesSchema,
};
