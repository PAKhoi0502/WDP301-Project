const statusSchema = {
    type: 'object',
    properties: {
        customer_id: { type: 'string', nullable: true },
        violation_score: { type: 'integer', example: 3 },
        risk_status: {
            type: 'string',
            enum: ['NORMAL', 'WARNING', 'DEPOSIT_REQUIRED', 'BLOCKED'],
        },
        warning_required: { type: 'boolean' },
        deposit_required: { type: 'boolean' },
        booking_blocked: { type: 'boolean' },
        booking_blocked_until: { type: 'string', format: 'date-time', nullable: true },
        booking_block_count: { type: 'integer' },
        last_violation_at: { type: 'string', format: 'date-time', nullable: true },
        last_event_at: { type: 'string', format: 'date-time', nullable: true },
        last_recovery_at: { type: 'string', format: 'date-time', nullable: true },
    },
};

const historySchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        source: { type: 'string', enum: ['BOOKING_EVENT', 'ADJUSTMENT'] },
        booking_id: { type: 'string', nullable: true },
        booking_code: { type: 'string', nullable: true },
        event: { type: 'string' },
        score_change: { type: 'integer' },
        score_before: { type: 'integer' },
        score_after: { type: 'integer' },
        reason: { type: 'string', nullable: true },
        is_reversed: { type: 'boolean' },
        created_at: { type: 'string', format: 'date-time' },
    },
};

const appealSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        customer_id: { type: 'string' },
        event: historySchema,
        reason: { type: 'string' },
        status: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED'] },
        admin_note: { type: 'string', nullable: true },
        resolution_score_change: { type: 'integer' },
        created_at: { type: 'string', format: 'date-time' },
    },
};

const successResponse = (schema) => ({
    type: 'object',
    properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: schema,
    },
});

const bearer = [{ bearerAuth: [] }];
const paginationParameters = [
    { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
    { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
];

const paths = {
    '/booking-violations/me': {
        get: {
            tags: ['Booking Violations'],
            summary: 'Get current customer booking reliability status',
            security: bearer,
            responses: {
                200: {
                    description: 'Booking violation status',
                    content: { 'application/json': { schema: successResponse(statusSchema) } },
                },
            },
        },
    },
    '/booking-violations/me/history': {
        get: {
            tags: ['Booking Violations'],
            summary: 'Get current customer booking violation history',
            security: bearer,
            parameters: paginationParameters,
            responses: {
                200: {
                    description: 'Booking violation history',
                    content: {
                        'application/json': {
                            schema: successResponse({
                                type: 'array',
                                items: historySchema,
                            }),
                        },
                    },
                },
            },
        },
    },
    '/booking-violations/me/appeals': {
        get: {
            tags: ['Booking Violations'],
            summary: 'Get current customer appeals',
            security: bearer,
            parameters: paginationParameters,
            responses: {
                200: {
                    description: 'Appeal list',
                    content: {
                        'application/json': {
                            schema: successResponse({ type: 'array', items: appealSchema }),
                        },
                    },
                },
            },
        },
        post: {
            tags: ['Booking Violations'],
            summary: 'Appeal a booking violation event',
            security: bearer,
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['event_id', 'reason'],
                            properties: {
                                event_id: { type: 'string' },
                                reason: { type: 'string', minLength: 10, maxLength: 1000 },
                            },
                        },
                    },
                },
            },
            responses: {
                201: {
                    description: 'Appeal created',
                    content: { 'application/json': { schema: successResponse(appealSchema) } },
                },
            },
        },
    },
    '/admin/booking-violations': {
        get: {
            tags: ['Admin Booking Violations'],
            summary: 'List customer booking risk status',
            security: bearer,
            parameters: [
                ...paginationParameters,
                {
                    name: 'risk_status',
                    in: 'query',
                    schema: {
                        type: 'string',
                        enum: ['NORMAL', 'WARNING', 'DEPOSIT_REQUIRED', 'BLOCKED'],
                    },
                },
                { name: 'search', in: 'query', schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Customer risk list',
                    content: {
                        'application/json': {
                            schema: successResponse({ type: 'array', items: statusSchema }),
                        },
                    },
                },
            },
        },
    },
    '/admin/booking-violations/{customerId}': {
        get: {
            tags: ['Admin Booking Violations'],
            summary: 'Get customer booking violation detail',
            security: bearer,
            parameters: [
                { name: 'customerId', in: 'path', required: true, schema: { type: 'string' } },
                ...paginationParameters,
            ],
            responses: {
                200: { description: 'Customer violation detail' },
            },
        },
    },
    '/admin/booking-violations/{customerId}/adjustments': {
        post: {
            tags: ['Admin Booking Violations'],
            summary: 'Adjust customer booking violation score with audit reason',
            security: bearer,
            parameters: [
                { name: 'customerId', in: 'path', required: true, schema: { type: 'string' } },
            ],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['score_change', 'reason'],
                            properties: {
                                score_change: { type: 'integer', minimum: -20, maximum: 20 },
                                reason: { type: 'string', minLength: 5, maxLength: 1000 },
                            },
                        },
                    },
                },
            },
            responses: {
                201: { description: 'Score adjusted' },
            },
        },
    },
    '/admin/booking-violations/appeals': {
        get: {
            tags: ['Admin Booking Violations'],
            summary: 'List booking violation appeals',
            security: bearer,
            parameters: [
                ...paginationParameters,
                {
                    name: 'status',
                    in: 'query',
                    schema: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED'] },
                },
            ],
            responses: {
                200: {
                    description: 'Appeal list',
                    content: {
                        'application/json': {
                            schema: successResponse({ type: 'array', items: appealSchema }),
                        },
                    },
                },
            },
        },
    },
    '/admin/booking-violations/appeals/{appealId}': {
        patch: {
            tags: ['Admin Booking Violations'],
            summary: 'Approve or reject a booking violation appeal',
            security: bearer,
            parameters: [
                { name: 'appealId', in: 'path', required: true, schema: { type: 'string' } },
            ],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['status', 'admin_note'],
                            properties: {
                                status: { type: 'string', enum: ['APPROVED', 'REJECTED'] },
                                admin_note: { type: 'string', minLength: 5, maxLength: 1000 },
                            },
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: 'Appeal reviewed',
                    content: { 'application/json': { schema: successResponse(appealSchema) } },
                },
            },
        },
    },
};

module.exports = {
    tags: [
        { name: 'Booking Violations', description: 'Customer booking reliability' },
        { name: 'Admin Booking Violations', description: 'Booking risk administration' },
    ],
    schemas: {
        BookingViolationStatus: statusSchema,
        BookingViolationHistory: historySchema,
        BookingViolationAppeal: appealSchema,
    },
    paths,
};
