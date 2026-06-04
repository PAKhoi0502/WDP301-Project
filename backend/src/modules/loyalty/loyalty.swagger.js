const tags = [
    {
        name: 'Loyalty',
        description: 'Customer loyalty APIs',
    },
    {
        name: 'Admin Loyalty',
        description: 'Admin loyalty and point transaction APIs',
    },
];

const customerSummarySchema = {
    type: 'object',
    nullable: true,
    properties: {
        id: { type: 'string' },
        full_name: { type: 'string' },
        email: { type: 'string', nullable: true },
        phone: { type: 'string', nullable: true },
        role: { type: 'string', example: 'CUSTOMER' },
        is_active: { type: 'boolean' },
    },
};

const customerLoyaltySchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        customer_id: { type: 'string' },
        customer: customerSummarySchema,
        current_tier: { type: 'string', enum: ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'] },
        total_points: { type: 'number' },
        available_points: { type: 'number' },
        redeemed_points: { type: 'number' },
        expired_points: { type: 'number' },
        total_spent: { type: 'number' },
        total_visits: { type: 'number' },
        last_visit_at: { type: 'string', format: 'date-time', nullable: true },
        last_tier_review_at: { type: 'string', format: 'date-time', nullable: true },
        last_point_expiry_check_at: { type: 'string', format: 'date-time', nullable: true },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
    },
};

const tierRuleSchema = {
    type: 'object',
    nullable: true,
    properties: {
        id: { type: 'string' },
        tier_name: { type: 'string', enum: ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'] },
        booking_window_days: { type: 'number' },
        max_upcoming_bookings: { type: 'number' },
        point_multiplier: { type: 'number' },
        priority_level: { type: 'number' },
        min_total_spent: { type: 'number' },
        min_total_visits: { type: 'number' },
        min_total_points: { type: 'number' },
        is_active: { type: 'boolean' },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
    },
};

const pointTransactionSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        customer_id: { type: 'string' },
        customer: customerSummarySchema,
        booking_id: { type: 'string', nullable: true },
        type: { type: 'string', enum: ['EARN', 'REDEEM', 'REFUND', 'EXPIRE', 'ADJUST'] },
        points: { type: 'number' },
        remaining_points: { type: 'number' },
        balance_before: { type: 'number' },
        balance_after: { type: 'number' },
        description: { type: 'string', nullable: true },
        earned_at: { type: 'string', format: 'date-time', nullable: true },
        expires_at: { type: 'string', format: 'date-time', nullable: true },
        expired_at: { type: 'string', format: 'date-time', nullable: true },
        source_transaction_ids: {
            type: 'array',
            items: { type: 'string' },
        },
        created_by: { type: 'string', nullable: true },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
    },
};

const loyaltyOverviewSchema = {
    type: 'object',
    properties: {
        loyalty: customerLoyaltySchema,
        current_tier_rule: tierRuleSchema,
        next_tier_rule: tierRuleSchema,
    },
};

const loyaltyOverviewResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: loyaltyOverviewSchema,
    },
};

const loyaltyListResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
            type: 'array',
            items: customerLoyaltySchema,
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

const pointTransactionListResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
            type: 'array',
            items: pointTransactionSchema,
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

const tierRuleListResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
            type: 'array',
            items: tierRuleSchema,
        },
    },
};

const commonErrorResponses = {
    400: { description: 'Bad request' },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden' },
    404: { description: 'Not found' },
};

const pointTransactionQueryParameters = [
    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
    { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
    { name: 'type', in: 'query', schema: { type: 'string', enum: ['EARN', 'REDEEM', 'REFUND', 'EXPIRE', 'ADJUST'] } },
    { name: 'booking_id', in: 'query', schema: { type: 'string' } },
];

const paths = {
    '/loyalty/me': {
        get: {
            tags: ['Loyalty'],
            summary: 'Get current customer loyalty overview',
            security: [{ bearerAuth: [] }],
            responses: {
                200: {
                    description: 'Success',
                    content: {
                        'application/json': {
                            schema: loyaltyOverviewResponse,
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/loyalty/me/transactions': {
        get: {
            tags: ['Loyalty'],
            summary: 'Get current customer point transactions',
            security: [{ bearerAuth: [] }],
            parameters: pointTransactionQueryParameters,
            responses: {
                200: {
                    description: 'Success',
                    content: {
                        'application/json': {
                            schema: pointTransactionListResponse,
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/loyalty/tier-rules': {
        get: {
            tags: ['Loyalty'],
            summary: 'Get active loyalty tier rules',
            security: [{ bearerAuth: [] }],
            responses: {
                200: {
                    description: 'Success',
                    content: {
                        'application/json': {
                            schema: tierRuleListResponse,
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/loyalty/customers': {
        get: {
            tags: ['Admin Loyalty'],
            summary: 'Get customer loyalty list',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                { name: 'search', in: 'query', schema: { type: 'string' } },
                { name: 'tier', in: 'query', schema: { type: 'string', enum: ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'] } },
            ],
            responses: {
                200: {
                    description: 'Success',
                    content: {
                        'application/json': {
                            schema: loyaltyListResponse,
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/loyalty/customers/{customerId}': {
        get: {
            tags: ['Admin Loyalty'],
            summary: 'Get customer loyalty detail',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'customerId', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Success',
                    content: {
                        'application/json': {
                            schema: loyaltyOverviewResponse,
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/loyalty/customers/{customerId}/transactions': {
        get: {
            tags: ['Admin Loyalty'],
            summary: 'Get customer point transactions by customer id',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'customerId', in: 'path', required: true, schema: { type: 'string' } },
                ...pointTransactionQueryParameters,
            ],
            responses: {
                200: {
                    description: 'Success',
                    content: {
                        'application/json': {
                            schema: pointTransactionListResponse,
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/loyalty/transactions': {
        get: {
            tags: ['Admin Loyalty'],
            summary: 'Get all point transactions',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                { name: 'customer_id', in: 'query', schema: { type: 'string' } },
                { name: 'booking_id', in: 'query', schema: { type: 'string' } },
                { name: 'type', in: 'query', schema: { type: 'string', enum: ['EARN', 'REDEEM', 'REFUND', 'EXPIRE', 'ADJUST'] } },
            ],
            responses: {
                200: {
                    description: 'Success',
                    content: {
                        'application/json': {
                            schema: pointTransactionListResponse,
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/loyalty/tier-rules': {
        get: {
            tags: ['Admin Loyalty'],
            summary: 'Get all loyalty tier rules',
            security: [{ bearerAuth: [] }],
            responses: {
                200: {
                    description: 'Success',
                    content: {
                        'application/json': {
                            schema: tierRuleListResponse,
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
        CustomerLoyalty: customerLoyaltySchema,
        PointTransaction: pointTransactionSchema,
        TierRule: tierRuleSchema,
        LoyaltyOverview: loyaltyOverviewSchema,
    },
    paths,
};
