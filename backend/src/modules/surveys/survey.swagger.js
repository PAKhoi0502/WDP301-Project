const questionTypeValues = ['RATING', 'NPS', 'SINGLE_CHOICE', 'MULTI_CHOICE', 'TEXT'];
const surveyStatusValues = ['DRAFT', 'PUBLISHED', 'CLOSED'];

const tags = [
    {
        name: 'Surveys',
        description: 'Customer survey APIs',
    },
    {
        name: 'Admin Surveys',
        description: 'Admin survey management APIs',
    },
];

const surveyQuestionSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        text: { type: 'string' },
        type: { type: 'string', enum: questionTypeValues },
        is_required: { type: 'boolean' },
        options: {
            type: 'array',
            items: { type: 'string' },
        },
        order: { type: 'number' },
    },
};

const surveyQuestionRequestSchema = {
    type: 'object',
    required: ['text', 'type', 'order'],
    properties: {
        text: { type: 'string' },
        type: { type: 'string', enum: questionTypeValues },
        is_required: { type: 'boolean', default: false },
        options: {
            type: 'array',
            items: { type: 'string' },
            default: [],
        },
        order: { type: 'number' },
    },
};

const surveySchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string', nullable: true },
        status: { type: 'string', enum: surveyStatusValues },
        questions: {
            type: 'array',
            items: surveyQuestionSchema,
        },
        response_window_days: { type: 'number' },
        created_by_id: { type: 'string' },
        created_by: { type: 'object', nullable: true },
        published_at: { type: 'string', format: 'date-time', nullable: true },
        closed_at: { type: 'string', format: 'date-time', nullable: true },
        response_expires_at: { type: 'string', format: 'date-time', nullable: true },
        booking_id: { type: 'string', nullable: true },
        wash_history_id: { type: 'string', nullable: true },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
    },
};

const surveyResponseAnswerSchema = {
    type: 'object',
    properties: {
        question_id: { type: 'string' },
        question_text: { type: 'string' },
        question_type: { type: 'string', enum: questionTypeValues },
        numeric_value: { type: 'number', nullable: true },
        text_value: { type: 'string', nullable: true },
        selected_options: {
            type: 'array',
            items: { type: 'string' },
        },
    },
};

const surveyResponseSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        survey_id: { type: 'string' },
        survey: surveySchema,
        booking_id: { type: 'string' },
        wash_history_id: { type: 'string' },
        customer_id: { type: 'string' },
        customer: { type: 'object', nullable: true },
        answers: {
            type: 'array',
            items: surveyResponseAnswerSchema,
        },
        upload_ids: {
            type: 'array',
            items: { type: 'string' },
        },
        uploads: {
            type: 'array',
            items: { $ref: '#/components/schemas/Upload' },
        },
        submitted_at: { type: 'string', format: 'date-time' },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
    },
};

const surveyWriteRequestSchema = {
    type: 'object',
    required: ['title'],
    properties: {
        title: { type: 'string' },
        description: { type: 'string', nullable: true },
        questions: {
            type: 'array',
            items: surveyQuestionRequestSchema,
        },
        response_window_days: { type: 'number', default: 7 },
    },
};

const surveyUpdateRequestSchema = {
    type: 'object',
    properties: surveyWriteRequestSchema.properties,
};

const submitSurveyResponseRequestSchema = {
    type: 'object',
    required: ['booking_id', 'answers'],
    properties: {
        booking_id: { type: 'string' },
        answers: {
            type: 'array',
            items: {
                type: 'object',
                required: ['question_id', 'value'],
                properties: {
                    question_id: { type: 'string' },
                    value: {
                        oneOf: [
                            { type: 'number' },
                            { type: 'string' },
                            {
                                type: 'array',
                                items: { type: 'string' },
                            },
                        ],
                    },
                },
            },
        },
        upload_ids: {
            type: 'array',
            items: { type: 'string' },
        },
    },
};

const itemResponse = (schema) => ({
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: schema,
    },
});

const listResponse = (schema) => ({
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
            type: 'array',
            items: schema,
        },
        meta: {
            type: 'object',
            properties: {
                page: { type: 'number' },
                limit: { type: 'number' },
                total: { type: 'number' },
                total_pages: { type: 'number' },
            },
        },
    },
});

const idParameter = {
    name: 'id',
    in: 'path',
    required: true,
    schema: { type: 'string' },
};

const commonErrorResponses = {
    400: { description: 'Bad request' },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden' },
    404: { description: 'Not found' },
    409: { description: 'Conflict' },
};

const paths = {
    '/surveys/available': {
        get: {
            tags: ['Surveys'],
            summary: 'Get surveys available for a completed paid booking',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'booking_id', in: 'query', required: true, schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Available surveys',
                    content: {
                        'application/json': {
                            schema: itemResponse({
                                type: 'array',
                                items: surveySchema,
                            }),
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/surveys/{id}/responses': {
        post: {
            tags: ['Surveys'],
            summary: 'Submit survey response',
            security: [{ bearerAuth: [] }],
            parameters: [idParameter],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: submitSurveyResponseRequestSchema,
                    },
                },
            },
            responses: {
                201: {
                    description: 'Survey response submitted',
                    content: {
                        'application/json': {
                            schema: itemResponse(surveyResponseSchema),
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/surveys': {
        get: {
            tags: ['Admin Surveys'],
            summary: 'Get surveys',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'page', in: 'query', schema: { type: 'number', default: 1 } },
                { name: 'limit', in: 'query', schema: { type: 'number', default: 20 } },
                { name: 'search', in: 'query', schema: { type: 'string' } },
                { name: 'status', in: 'query', schema: { type: 'string', enum: surveyStatusValues } },
                { name: 'created_by', in: 'query', schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Survey list',
                    content: {
                        'application/json': {
                            schema: listResponse(surveySchema),
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
        post: {
            tags: ['Admin Surveys'],
            summary: 'Create draft survey',
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: surveyWriteRequestSchema,
                    },
                },
            },
            responses: {
                201: {
                    description: 'Survey created',
                    content: {
                        'application/json': {
                            schema: itemResponse(surveySchema),
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/surveys/{id}': {
        get: {
            tags: ['Admin Surveys'],
            summary: 'Get survey detail',
            security: [{ bearerAuth: [] }],
            parameters: [idParameter],
            responses: {
                200: {
                    description: 'Survey detail',
                    content: {
                        'application/json': {
                            schema: itemResponse(surveySchema),
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
        patch: {
            tags: ['Admin Surveys'],
            summary: 'Update draft survey',
            security: [{ bearerAuth: [] }],
            parameters: [idParameter],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: surveyUpdateRequestSchema,
                    },
                },
            },
            responses: {
                200: {
                    description: 'Survey updated',
                    content: {
                        'application/json': {
                            schema: itemResponse(surveySchema),
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
        delete: {
            tags: ['Admin Surveys'],
            summary: 'Delete draft survey',
            security: [{ bearerAuth: [] }],
            parameters: [idParameter],
            responses: {
                200: {
                    description: 'Survey deleted',
                    content: {
                        'application/json': {
                            schema: itemResponse(surveySchema),
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/surveys/{id}/publish': {
        patch: {
            tags: ['Admin Surveys'],
            summary: 'Publish draft survey',
            security: [{ bearerAuth: [] }],
            parameters: [idParameter],
            responses: {
                200: {
                    description: 'Survey published',
                    content: {
                        'application/json': {
                            schema: itemResponse(surveySchema),
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/surveys/{id}/close': {
        patch: {
            tags: ['Admin Surveys'],
            summary: 'Close published survey',
            security: [{ bearerAuth: [] }],
            parameters: [idParameter],
            responses: {
                200: {
                    description: 'Survey closed',
                    content: {
                        'application/json': {
                            schema: itemResponse(surveySchema),
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/surveys/{id}/responses': {
        get: {
            tags: ['Admin Surveys'],
            summary: 'Get survey responses',
            security: [{ bearerAuth: [] }],
            parameters: [
                idParameter,
                { name: 'page', in: 'query', schema: { type: 'number', default: 1 } },
                { name: 'limit', in: 'query', schema: { type: 'number', default: 20 } },
                { name: 'customer_id', in: 'query', schema: { type: 'string' } },
                { name: 'booking_id', in: 'query', schema: { type: 'string' } },
                { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
                { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
            ],
            responses: {
                200: {
                    description: 'Survey responses',
                    content: {
                        'application/json': {
                            schema: listResponse(surveyResponseSchema),
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
};

module.exports = {
    tags,
    paths,
    schemas: {
        SurveyQuestion: surveyQuestionSchema,
        Survey: surveySchema,
        SurveyResponse: surveyResponseSchema,
        SurveyWriteRequest: surveyWriteRequestSchema,
        SurveyUpdateRequest: surveyUpdateRequestSchema,
        SubmitSurveyResponseRequest: submitSurveyResponseRequestSchema,
    },
};
