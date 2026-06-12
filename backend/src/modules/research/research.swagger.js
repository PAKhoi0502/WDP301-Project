const tags = [
    {
        name: 'Admin Research',
        description: 'Admin AI research report APIs',
    },
];

const researchFiltersSchema = {
    type: 'object',
    required: ['survey_id'],
    properties: {
        survey_id: { type: 'string' },
        from: { type: 'string', format: 'date-time', nullable: true },
        to: { type: 'string', format: 'date-time', nullable: true },
        garage_id: { type: 'string', nullable: true },
        service_package_id: { type: 'string', nullable: true },
        vehicle_type: { type: 'string', enum: ['MOTORBIKE', 'CAR'], nullable: true },
        group_by: { type: 'string', enum: ['DAY', 'WEEK', 'MONTH'], default: 'DAY' },
    },
};

const researchReportSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        objective: { type: 'string' },
        type: { type: 'string', enum: ['SURVEY_INSIGHT'] },
        status: { type: 'string', enum: ['DRAFT', 'PROCESSING', 'COMPLETED', 'FAILED'] },
        filters: researchFiltersSchema,
        data_snapshot: { type: 'object', nullable: true, additionalProperties: true },
        result: { type: 'object', nullable: true, additionalProperties: true },
        model: { type: 'string', nullable: true },
        prompt_version: { type: 'string', nullable: true },
        usage_metadata: { type: 'object', nullable: true, additionalProperties: true },
        error: { type: 'object', nullable: true, additionalProperties: true },
        created_by_id: { type: 'string' },
        created_by: { type: 'object', nullable: true },
        started_at: { type: 'string', format: 'date-time', nullable: true },
        completed_at: { type: 'string', format: 'date-time', nullable: true },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
    },
};

const researchWriteSchema = {
    type: 'object',
    required: ['title', 'objective', 'filters'],
    properties: {
        title: { type: 'string' },
        objective: { type: 'string' },
        type: { type: 'string', enum: ['SURVEY_INSIGHT'], default: 'SURVEY_INSIGHT' },
        filters: researchFiltersSchema,
    },
};

const itemResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: researchReportSchema,
    },
};

const listResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
            type: 'array',
            items: researchReportSchema,
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
};

const commonErrors = {
    400: { description: 'Bad request' },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden' },
    404: { description: 'Research report not found' },
    409: { description: 'Research report state conflict' },
    502: { description: 'Gemini request or output failure' },
    503: { description: 'Gemini configuration or quota failure' },
    504: { description: 'Gemini timeout' },
};

const idParameter = {
    name: 'id',
    in: 'path',
    required: true,
    schema: { type: 'string' },
};

const paths = {
    '/admin/research': {
        get: {
            tags: ['Admin Research'],
            summary: 'Get research reports',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'page', in: 'query', schema: { type: 'number', default: 1 } },
                { name: 'limit', in: 'query', schema: { type: 'number', default: 20 } },
                { name: 'status', in: 'query', schema: { type: 'string', enum: ['DRAFT', 'PROCESSING', 'COMPLETED', 'FAILED'] } },
                { name: 'type', in: 'query', schema: { type: 'string', enum: ['SURVEY_INSIGHT'] } },
                { name: 'created_by', in: 'query', schema: { type: 'string' } },
                { name: 'survey_id', in: 'query', schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Research report list',
                    content: {
                        'application/json': {
                            schema: listResponse,
                        },
                    },
                },
                ...commonErrors,
            },
        },
        post: {
            tags: ['Admin Research'],
            summary: 'Create draft research report',
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: researchWriteSchema,
                    },
                },
            },
            responses: {
                201: {
                    description: 'Research report created',
                    content: {
                        'application/json': {
                            schema: itemResponse,
                        },
                    },
                },
                ...commonErrors,
            },
        },
    },
    '/admin/research/{id}': {
        get: {
            tags: ['Admin Research'],
            summary: 'Get research report',
            security: [{ bearerAuth: [] }],
            parameters: [idParameter],
            responses: {
                200: {
                    description: 'Research report detail',
                    content: {
                        'application/json': {
                            schema: itemResponse,
                        },
                    },
                },
                ...commonErrors,
            },
        },
        patch: {
            tags: ['Admin Research'],
            summary: 'Update draft or failed research report',
            security: [{ bearerAuth: [] }],
            parameters: [idParameter],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: researchWriteSchema,
                    },
                },
            },
            responses: {
                200: {
                    description: 'Research report updated',
                    content: {
                        'application/json': {
                            schema: itemResponse,
                        },
                    },
                },
                ...commonErrors,
            },
        },
        delete: {
            tags: ['Admin Research'],
            summary: 'Delete draft or failed research report',
            security: [{ bearerAuth: [] }],
            parameters: [idParameter],
            responses: {
                200: {
                    description: 'Research report deleted',
                    content: {
                        'application/json': {
                            schema: itemResponse,
                        },
                    },
                },
                ...commonErrors,
            },
        },
    },
    '/admin/research/{id}/run': {
        post: {
            tags: ['Admin Research'],
            summary: 'Run draft research report',
            security: [{ bearerAuth: [] }],
            parameters: [idParameter],
            responses: {
                200: {
                    description: 'Research report completed',
                    content: {
                        'application/json': {
                            schema: itemResponse,
                        },
                    },
                },
                ...commonErrors,
            },
        },
    },
    '/admin/research/{id}/retry': {
        post: {
            tags: ['Admin Research'],
            summary: 'Retry failed research report',
            security: [{ bearerAuth: [] }],
            parameters: [idParameter],
            responses: {
                200: {
                    description: 'Research report retry completed',
                    content: {
                        'application/json': {
                            schema: itemResponse,
                        },
                    },
                },
                ...commonErrors,
            },
        },
    },
};

module.exports = {
    tags,
    paths,
    schemas: {
        ResearchFilters: researchFiltersSchema,
        ResearchReport: researchReportSchema,
        ResearchWriteRequest: researchWriteSchema,
    },
};
