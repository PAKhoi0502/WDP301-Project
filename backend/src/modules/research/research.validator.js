const { z } = require('zod');

const { VEHICLE_TYPE_VALUES } = require('../../shared/constants/vehicle.constant');
const { ANALYTICS_GROUP_BY_VALUES } = require('../../shared/constants/analytics.constant');
const {
    RESEARCH_REPORT_STATUS_VALUES,
    RESEARCH_REPORT_TYPE_VALUES,
} = require('../../shared/constants/research.constant');

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

const filtersField = z
    .object({
        survey_id: objectIdField,
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

const idParamSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
});

const createResearchReportSchema = z.object({
    body: z
        .object({
            title: z.string().trim().min(2).max(200),
            objective: z.string().trim().min(10).max(2000),
            type: z.enum(RESEARCH_REPORT_TYPE_VALUES).default('SURVEY_INSIGHT'),
            filters: filtersField,
        })
        .strict(),
});

const updateResearchReportSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
    body: z
        .object({
            title: z.preprocess(emptyToUndefined, z.string().trim().min(2).max(200).optional()),
            objective: z.preprocess(emptyToUndefined, z.string().trim().min(10).max(2000).optional()),
            filters: filtersField.optional(),
        })
        .strict()
        .refine((data) => Object.values(data).some((value) => value !== undefined), {
            message: 'At least one field is required',
        }),
});

const getResearchReportsSchema = z.object({
    query: z
        .object({
            page: z.coerce.number().int().min(1).default(1),
            limit: z.coerce.number().int().min(1).max(100).default(20),
            status: z.enum(RESEARCH_REPORT_STATUS_VALUES).optional(),
            type: z.enum(RESEARCH_REPORT_TYPE_VALUES).optional(),
            created_by: optionalObjectIdField,
            survey_id: optionalObjectIdField,
        })
        .strict(),
});

module.exports = {
    idParamSchema,
    createResearchReportSchema,
    updateResearchReportSchema,
    getResearchReportsSchema,
};
