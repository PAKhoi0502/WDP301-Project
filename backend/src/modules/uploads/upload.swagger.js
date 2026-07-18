const tags = [
    {
        name: 'Uploads',
        description: 'Authenticated file upload APIs',
    },
    {
        name: 'Admin Uploads',
        description: 'Admin upload management APIs',
    },
];

const uploadSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        url: { type: 'string' },
        public_id: { type: 'string' },
        mime_type: { type: 'string', enum: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'] },
        size: { type: 'number' },
        purpose: { type: 'string', enum: ['GENERAL', 'USER_AVATAR', 'VEHICLE_INSPECTION', 'SURVEY_RESPONSE', 'CUSTOMER_CASE_EVIDENCE', 'RESEARCH_ATTACHMENT'] },
        owner_id: { type: 'string' },
        owner: { type: 'object', nullable: true },
        related_type: { type: 'string', nullable: true },
        related_id: { type: 'string', nullable: true },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
    },
};

const uploadResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: uploadSchema,
    },
};

const uploadListResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
            type: 'array',
            items: uploadSchema,
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

const uploadRequest = {
    type: 'object',
    required: ['file'],
    properties: {
        file: {
            type: 'string',
            format: 'binary',
        },
        purpose: {
            type: 'string',
            enum: ['GENERAL', 'USER_AVATAR', 'VEHICLE_INSPECTION', 'SURVEY_RESPONSE', 'CUSTOMER_CASE_EVIDENCE', 'RESEARCH_ATTACHMENT'],
        },
        related_type: {
            type: 'string',
            enum: ['USER', 'BOOKING', 'VEHICLE', 'VEHICLE_INSPECTION', 'SURVEY', 'SURVEY_RESPONSE', 'CUSTOMER_CASE', 'RESEARCH_REPORT', 'WASH_HISTORY', 'GARAGE', 'SERVICE_PACKAGE'],
        },
        related_id: {
            type: 'string',
        },
    },
};

const commonErrorResponses = {
    400: { description: 'Bad request' },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden' },
    404: { description: 'Not found' },
};

const paths = {
    '/uploads': {
        post: {
            tags: ['Uploads'],
            summary: 'Upload a file',
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    'multipart/form-data': {
                        schema: uploadRequest,
                    },
                },
            },
            responses: {
                201: {
                    description: 'File uploaded',
                    content: {
                        'application/json': {
                            schema: uploadResponse,
                        },
                    },
                },
                ...commonErrorResponses,
                502: { description: 'Cloudinary upload failed' },
            },
        },
    },
    '/uploads/{id}': {
        delete: {
            tags: ['Uploads'],
            summary: 'Delete an owned upload',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Upload deleted',
                    content: {
                        'application/json': {
                            schema: uploadResponse,
                        },
                    },
                },
                ...commonErrorResponses,
                502: { description: 'Cloudinary delete failed' },
            },
        },
    },
    '/admin/uploads': {
        get: {
            tags: ['Admin Uploads'],
            summary: 'Get uploads',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'page', in: 'query', schema: { type: 'number', default: 1 } },
                { name: 'limit', in: 'query', schema: { type: 'number', default: 20 } },
                { name: 'purpose', in: 'query', schema: { type: 'string' } },
                { name: 'owner_id', in: 'query', schema: { type: 'string' } },
                { name: 'related_type', in: 'query', schema: { type: 'string' } },
                { name: 'related_id', in: 'query', schema: { type: 'string' } },
                { name: 'mime_type', in: 'query', schema: { type: 'string' } },
                { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
                { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
            ],
            responses: {
                200: {
                    description: 'Uploads list',
                    content: {
                        'application/json': {
                            schema: uploadListResponse,
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
        Upload: uploadSchema,
        UploadRequest: uploadRequest,
    },
};
