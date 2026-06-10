const { z } = require('zod');

const {
    SURVEY_STATUS_VALUES,
    SURVEY_QUESTION_TYPES,
    SURVEY_QUESTION_TYPE_VALUES,
} = require('../../shared/constants/survey.constant');

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

const objectIdField = z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid resource id');

const questionField = z.object({
    text: z.string().trim().min(1).max(500),
    type: z.enum(SURVEY_QUESTION_TYPE_VALUES),
    is_required: z.boolean().default(false),
    options: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
    order: z.coerce.number().int().min(1).max(100),
}).strict().refine((question) => {
    const isChoiceQuestion = [
        SURVEY_QUESTION_TYPES.SINGLE_CHOICE,
        SURVEY_QUESTION_TYPES.MULTI_CHOICE,
    ].includes(question.type);

    if (isChoiceQuestion) {
        return question.options.length >= 2 && new Set(question.options).size === question.options.length;
    }

    return question.options.length === 0;
}, {
    message: 'Question options do not match question type',
});

const questionsField = z.array(questionField).max(100).refine((questions) => {
    const orders = questions.map((question) => question.order);

    return new Set(orders).size === orders.length;
}, {
    message: 'Question order must be unique',
});

const atLeastOneField = (data) => Object.values(data).some((value) => value !== undefined);

const idParamSchema = z.object({
    params: z.object({
        id: objectIdField,
    }).strict(),
});

const getAdminSurveysSchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        search: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
        status: z.enum(SURVEY_STATUS_VALUES).optional(),
        created_by: z.preprocess(emptyToUndefined, objectIdField.optional()),
    }).strict(),
});

const createSurveySchema = z.object({
    body: z.object({
        title: z.string().trim().min(2).max(200),
        description: z.preprocess(emptyToNull, z.string().trim().max(2000).nullable().optional()),
        questions: questionsField.default([]),
        response_window_days: z.coerce.number().int().min(1).max(365).default(7),
    }).strict(),
});

const updateSurveySchema = z.object({
    params: z.object({
        id: objectIdField,
    }).strict(),
    body: z.object({
        title: z.preprocess(emptyToUndefined, z.string().trim().min(2).max(200).optional()),
        description: z.preprocess(emptyToNull, z.string().trim().max(2000).nullable().optional()),
        questions: questionsField.optional(),
        response_window_days: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(365).optional()),
    }).strict().refine(atLeastOneField, {
        message: 'At least one field is required',
    }),
});

const emptyOperationSchema = idParamSchema;

const availableSurveysSchema = z.object({
    query: z.object({
        booking_id: objectIdField,
    }).strict(),
});

const submitSurveyResponseSchema = z.object({
    params: z.object({
        id: objectIdField,
    }).strict(),
    body: z.object({
        booking_id: objectIdField,
        answers: z.array(z.object({
            question_id: objectIdField,
            value: z.unknown(),
        }).strict()).max(100).default([]),
        upload_ids: z.array(objectIdField).max(10).default([]),
    }).strict(),
});

const getSurveyResponsesSchema = z.object({
    params: z.object({
        id: objectIdField,
    }).strict(),
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        customer_id: z.preprocess(emptyToUndefined, objectIdField.optional()),
        booking_id: z.preprocess(emptyToUndefined, objectIdField.optional()),
        from: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
        to: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    }).strict().refine((data) => !data.from || !data.to || data.from <= data.to, {
        message: 'from must be before or equal to to',
    }),
});

module.exports = {
    idParamSchema,
    getAdminSurveysSchema,
    createSurveySchema,
    updateSurveySchema,
    emptyOperationSchema,
    availableSurveysSchema,
    submitSurveyResponseSchema,
    getSurveyResponsesSchema,
};
