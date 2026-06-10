const tags = [
    {
        name: 'Admin Audit Logs',
        description: 'Admin audit log APIs',
    },
];

const auditActorSchema = {
    type: 'object',
    nullable: true,
    properties: {
        id: { type: 'string' },
        full_name: { type: 'string' },
        email: { type: 'string', nullable: true },
        phone: { type: 'string', nullable: true },
        role: { type: 'string' },
        is_active: { type: 'boolean' },
    },
};

const auditLogSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        actor_id: { type: 'string', nullable: true },
        actor: auditActorSchema,
        action: { type: 'string', example: 'UPLOAD_CREATED' },
        resource_type: { type: 'string', example: 'UPLOAD' },
        resource_id: { type: 'string' },
        before: { type: 'object', nullable: true, additionalProperties: true },
        after: { type: 'object', nullable: true, additionalProperties: true },
        ip: { type: 'string', nullable: true },
        user_agent: { type: 'string', nullable: true },
        metadata: { type: 'object', additionalProperties: true },
        created_at: { type: 'string', format: 'date-time' },
    },
};

const auditLogListResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
            type: 'array',
            items: auditLogSchema,
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

const paths = {
    '/admin/audit-logs': {
        get: {
            tags: ['Admin Audit Logs'],
            summary: 'Get audit logs',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'page', in: 'query', schema: { type: 'number', default: 1 } },
                { name: 'limit', in: 'query', schema: { type: 'number', default: 20 } },
                { name: 'actor_id', in: 'query', schema: { type: 'string' } },
                { name: 'action', in: 'query', schema: { type: 'string' } },
                { name: 'resource_type', in: 'query', schema: { type: 'string' } },
                { name: 'resource_id', in: 'query', schema: { type: 'string' } },
                { name: 'ip', in: 'query', schema: { type: 'string' } },
                { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
                { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
            ],
            responses: {
                200: {
                    description: 'Audit logs list',
                    content: {
                        'application/json': {
                            schema: auditLogListResponse,
                        },
                    },
                },
                400: { description: 'Bad request' },
                401: { description: 'Unauthorized' },
                403: { description: 'Forbidden' },
            },
        },
    },
};

module.exports = {
    tags,
    paths,
    schemas: {
        AuditLog: auditLogSchema,
    },
};
