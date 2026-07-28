const { z } = require('zod');

const { VEHICLE_TYPE_VALUES } = require('../../shared/constants/vehicle.constant');
const { ANALYTICS_GROUP_BY_VALUES } = require('../../shared/constants/analytics.constant');

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
const optionalDateField = z.preprocess(emptyToUndefined, z.coerce.date().optional());

const analyticsQueryField = z
    .object({
        from: optionalDateField,
        to: optionalDateField,
        garage_id: optionalObjectIdField,
        service_package_id: optionalObjectIdField,
        vehicle_type: z.enum(VEHICLE_TYPE_VALUES).optional(),
        group_by: z.enum(ANALYTICS_GROUP_BY_VALUES).default('DAY'),
    })
    .strict()
    .refine((data) => !data.from || !data.to || data.from <= data.to, {
        message: 'from must be before or equal to to',
    });

const analyticsQuerySchema = z.object({
    query: analyticsQueryField,
});

const staffAnalyticsQuerySchema = z.object({
    query: z
        .object({
            from: optionalDateField,
            to: optionalDateField,
            group_by: z.enum(ANALYTICS_GROUP_BY_VALUES).default('DAY'),
        })
        .strict()
        .refine((data) => !data.from || !data.to || data.from <= data.to, {
            message: 'from must be before or equal to to',
        }),
});

const surveyAnalyticsSchema = z.object({
    params: z
        .object({
            surveyId: objectIdField,
        })
        .strict(),
    query: analyticsQueryField,
});

module.exports = {
    analyticsQuerySchema,
    staffAnalyticsQuerySchema,
    surveyAnalyticsSchema,
};
