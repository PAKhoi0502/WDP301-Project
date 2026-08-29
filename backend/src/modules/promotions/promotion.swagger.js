const tags = [
    {
        name: 'Promotions',
        description: 'Public and customer promotion APIs',
    },
    {
        name: 'Admin Promotions',
        description: 'Admin promotion management APIs',
    },
];

const promotionSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        code: { type: 'string', example: 'WELCOME10' },
        name: { type: 'string', example: 'Welcome discount' },
        description: { type: 'string', nullable: true },
        discount_type: { type: 'string', enum: ['PERCENTAGE', 'FIXED_AMOUNT'] },
        discount_value: { type: 'number' },
        max_discount_amount: { type: 'number', nullable: true },
        min_order_amount: { type: 'number' },
        audience: { type: 'string', enum: ['ALL', 'CUSTOMER', 'WALK_IN'] },
        phone_required: { type: 'boolean' },
        per_phone_limit: { type: 'number', nullable: true, enum: [1] },
        applicable_tiers: {
            type: 'array',
            items: { type: 'string' },
        },
        applicable_vehicle_types: {
            type: 'array',
            items: { type: 'string', enum: ['MOTORBIKE', 'CAR'] },
        },
        applicable_service_package_ids: {
            type: 'array',
            items: { type: 'string' },
        },
        start_at: { type: 'string', format: 'date-time' },
        end_at: { type: 'string', format: 'date-time' },
        usage_limit: { type: 'number', nullable: true },
        per_customer_limit: { type: 'number', nullable: true },
        used_count: { type: 'number' },
        reserved_count: { type: 'number' },
        is_active: { type: 'boolean' },
        created_by_id: { type: 'string', nullable: true },
        updated_by_id: { type: 'string', nullable: true },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
    },
};

const createPromotionRequest = {
    type: 'object',
    required: ['code', 'name', 'discount_type', 'discount_value', 'start_at', 'end_at'],
    properties: {
        code: { type: 'string', example: 'WELCOME10' },
        name: { type: 'string', example: 'Welcome discount' },
        description: { type: 'string', nullable: true },
        discount_type: { type: 'string', enum: ['PERCENTAGE', 'FIXED_AMOUNT'], example: 'PERCENTAGE' },
        discount_value: { type: 'number', example: 10 },
        max_discount_amount: { type: 'number', nullable: true, example: 50000 },
        min_order_amount: { type: 'number', example: 100000 },
        audience: { type: 'string', enum: ['ALL', 'CUSTOMER', 'WALK_IN'], example: 'WALK_IN' },
        phone_required: { type: 'boolean', example: true },
        per_phone_limit: { type: 'number', nullable: true, enum: [1], example: 1 },
        applicable_tiers: {
            type: 'array',
            items: { type: 'string' },
            example: ['BRONZE', 'SILVER'],
        },
        applicable_vehicle_types: {
            type: 'array',
            items: { type: 'string', enum: ['MOTORBIKE', 'CAR'] },
            example: ['CAR'],
        },
        applicable_service_package_ids: {
            type: 'array',
            items: { type: 'string' },
        },
        start_at: { type: 'string', format: 'date-time', example: '2026-06-01T00:00:00+07:00' },
        end_at: { type: 'string', format: 'date-time', example: '2026-06-30T23:59:59+07:00' },
        usage_limit: { type: 'number', nullable: true, example: 100 },
        per_customer_limit: { type: 'number', nullable: true, example: 1 },
        is_active: { type: 'boolean', example: true },
    },
};

const validatePromotionRequest = {
    type: 'object',
    required: ['promotion_code', 'service_package_id'],
    properties: {
        promotion_code: { type: 'string', example: 'WELCOME10' },
        service_package_id: { type: 'string', example: '665f0d3d8b4f5d0012a00003' },
    },
};

const promotionResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: promotionSchema,
    },
};

const promotionListResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
            type: 'array',
            items: promotionSchema,
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

const validatePromotionResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
            type: 'object',
            properties: {
                promotion: promotionSchema,
                discount_amount: { type: 'number' },
                final_price: { type: 'number' },
            },
        },
    },
};

const commonErrorResponses = {
    400: { description: 'Bad request' },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden' },
    404: { description: 'Not found' },
    409: { description: 'Conflict' },
};

const paths = {
    '/promotions': {
        get: {
            tags: ['Promotions'],
            summary: 'Get active valid promotions',
            parameters: [
                { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                { name: 'search', in: 'query', schema: { type: 'string' } },
                { name: 'vehicle_type', in: 'query', schema: { type: 'string', enum: ['MOTORBIKE', 'CAR'] } },
                { name: 'audience', in: 'query', schema: { type: 'string', enum: ['ALL', 'CUSTOMER', 'WALK_IN'] } },
                { name: 'service_package_id', in: 'query', schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Success',
                    content: {
                        'application/json': {
                            schema: promotionListResponse,
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/promotions/validate': {
        post: {
            tags: ['Promotions'],
            summary: 'Validate promotion for current customer',
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: validatePromotionRequest,
                    },
                },
            },
            responses: {
                200: {
                    description: 'Success',
                    content: {
                        'application/json': {
                            schema: validatePromotionResponse,
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/promotions/{id}': {
        get: {
            tags: ['Promotions'],
            summary: 'Get active valid promotion detail',
            parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Success',
                    content: {
                        'application/json': {
                            schema: promotionResponse,
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/promotions': {
        get: {
            tags: ['Admin Promotions'],
            summary: 'Get promotions for admin',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                { name: 'search', in: 'query', schema: { type: 'string' } },
                { name: 'vehicle_type', in: 'query', schema: { type: 'string', enum: ['MOTORBIKE', 'CAR'] } },
                { name: 'tier', in: 'query', schema: { type: 'string' } },
                { name: 'audience', in: 'query', schema: { type: 'string', enum: ['ALL', 'CUSTOMER', 'WALK_IN'] } },
                { name: 'is_active', in: 'query', schema: { type: 'boolean' } },
                { name: 'valid_only', in: 'query', schema: { type: 'boolean' } },
            ],
            responses: {
                200: {
                    description: 'Success',
                    content: {
                        'application/json': {
                            schema: promotionListResponse,
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
        post: {
            tags: ['Admin Promotions'],
            summary: 'Create promotion',
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: createPromotionRequest,
                    },
                },
            },
            responses: {
                201: {
                    description: 'Created',
                    content: {
                        'application/json': {
                            schema: promotionResponse,
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/promotions/{id}': {
        get: {
            tags: ['Admin Promotions'],
            summary: 'Get promotion detail for admin',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Success',
                    content: {
                        'application/json': {
                            schema: promotionResponse,
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
        patch: {
            tags: ['Admin Promotions'],
            summary: 'Update promotion',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            ],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: createPromotionRequest,
                    },
                },
            },
            responses: {
                200: {
                    description: 'Success',
                    content: {
                        'application/json': {
                            schema: promotionResponse,
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
        delete: {
            tags: ['Admin Promotions'],
            summary: 'Delete promotion if it has no usage history',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Success',
                    content: {
                        'application/json': {
                            schema: promotionResponse,
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/promotions/{id}/activate': {
        patch: {
            tags: ['Admin Promotions'],
            summary: 'Activate promotion',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Success',
                    content: {
                        'application/json': {
                            schema: promotionResponse,
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/promotions/{id}/deactivate': {
        patch: {
            tags: ['Admin Promotions'],
            summary: 'Deactivate promotion',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Success',
                    content: {
                        'application/json': {
                            schema: promotionResponse,
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
    schemas: {
        Promotion: promotionSchema,
    },
    paths,
};
