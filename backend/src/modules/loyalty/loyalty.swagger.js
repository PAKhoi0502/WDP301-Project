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
        current_tier: { type: 'string' },
        total_points: { type: 'number' },
        qualifying_points: { type: 'number' },
        bonus_points: { type: 'number' },
        available_points: { type: 'number' },
        redeemed_points: { type: 'number' },
        expired_points: { type: 'number' },
        total_spent: { type: 'number' },
        total_visits: { type: 'number' },
        last_visit_at: { type: 'string', format: 'date-time', nullable: true },
        last_tier_review_at: { type: 'string', format: 'date-time', nullable: true },
        last_tier_downgrade_at: { type: 'string', format: 'date-time', nullable: true },
        tier_recovery_started_at: { type: 'string', format: 'date-time', nullable: true },
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
        tier_name: { type: 'string' },
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

const createTierRuleRequestSchema = {
    type: 'object',
    required: [
        'tier_name',
        'booking_window_days',
        'max_upcoming_bookings',
        'point_multiplier',
        'priority_level',
    ],
    example: {
        tier_name: 'DIAMOND',
        booking_window_days: 30,
        max_upcoming_bookings: 5,
        point_multiplier: 2,
        priority_level: 5,
        min_total_spent: 10000000,
        min_total_visits: 20,
        min_total_points: 5000,
        is_active: true,
    },
    properties: {
        tier_name: { type: 'string', example: 'DIAMOND' },
        booking_window_days: { type: 'number', minimum: 1 },
        max_upcoming_bookings: { type: 'number', minimum: 1 },
        point_multiplier: { type: 'number', minimum: 0 },
        priority_level: { type: 'number', minimum: 1 },
        min_total_spent: { type: 'number', minimum: 0, default: 0 },
        min_total_visits: { type: 'number', minimum: 0, default: 0 },
        min_total_points: { type: 'number', minimum: 0, default: 0 },
        is_active: { type: 'boolean', example: true },
    },
};

const updateTierRuleRequestSchema = {
    type: 'object',
    properties: {
        tier_name: { type: 'string', example: 'VIP' },
        booking_window_days: { type: 'number', example: 12 },
        max_upcoming_bookings: { type: 'number', example: 2 },
        point_multiplier: { type: 'number', example: 1.35 },
        priority_level: { type: 'number', example: 3 },
        min_total_spent: { type: 'number', example: 2000000 },
        min_total_visits: { type: 'number', example: 10 },
        min_total_points: { type: 'number', example: 500 },
        is_active: { type: 'boolean', example: true },
    },
};

const tierRuleResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: tierRuleSchema,
    },
};

const pointTransactionSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        customer_id: { type: 'string' },
        customer: customerSummarySchema,
        booking_id: { type: 'string', nullable: true },
        type: { type: 'string', enum: ['EARN', 'SURVEY_REWARD', 'REVIEW_REWARD', 'REDEEM', 'REFUND', 'EXPIRE', 'ADJUST'] },
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


const loyaltyRedeemRuleSchema = {
    type: 'object',
    nullable: true,
    properties: {
        id: { type: 'string' },
        rule_code: {
            type: 'string',
            nullable: true,
            example: 'LOYALTY_REDEEM_STANDARD_V1',
        },
        point_value_amount: { type: 'number', example: 100 },
        min_redeem_points: { type: 'number', example: 50 },
        redeem_step: { type: 'number', example: 10 },
        max_redeem_percent: { type: 'number', example: 30 },
        is_active: { type: 'boolean' },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
    },
};

const redeemPreviewRequestSchema = {
    type: 'object',
    required: ['service_package_id', 'used_points'],
    properties: {
        service_package_id: { type: 'string', example: '64f000000000000000000001' },
        promotion_id: { type: 'string', nullable: true, example: '64f000000000000000000002' },
        promotion_code: { type: 'string', nullable: true, example: 'WELCOME10' },
        used_points: { type: 'number', example: 50 },
    },
};

const redeemPreviewSchema = {
    type: 'object',
    properties: {
        service_package_id: { type: 'string' },
        promotion_id: { type: 'string', nullable: true },
        promotion_code: { type: 'string', nullable: true },
        original_price: { type: 'number', example: 150000 },
        promotion_discount_amount: { type: 'number', example: 20000 },
        price_after_promotion: { type: 'number', example: 130000 },
        available_points: { type: 'number', example: 350 },
        used_points: { type: 'number', example: 50 },
        point_value_amount: { type: 'number', example: 100 },
        points_discount_amount: { type: 'number', example: 5000 },
        discount_amount: { type: 'number', example: 25000 },
        final_price: { type: 'number', example: 125000 },
        redeem_rule: loyaltyRedeemRuleSchema,
    },
};

const redeemPreviewResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: redeemPreviewSchema,
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


const expirePointsResultSchema = {
    type: 'object',
    properties: {
        expired_points: { type: 'number' },
        customers_processed: { type: 'number' },
        source_transactions_processed: { type: 'number' },
        checked_at: { type: 'string', format: 'date-time' },
        expire_transactions: {
            type: 'array',
            items: pointTransactionSchema,
        },
    },
};

const expirePointsResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: expirePointsResultSchema,
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

const tierRuleDeleteErrorResponses = {
    ...commonErrorResponses,
    409: {
        description: 'Deletion is not permitted because the tier is in use or required for loyalty evaluation',
        content: {
            'application/json': {
                schema: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        message: { type: 'string' },
                        error_code: {
                            type: 'string',
                            enum: [
                                'TIER_RULE_IN_USE',
                                'TIER_RULE_USED_BY_PROMOTION',
                                'TIER_RULE_DEFAULT_OR_FALLBACK',
                                'TIER_RULE_EVALUATION_UNDEFINED',
                            ],
                        },
                    },
                },
            },
        },
    },
};

const pointTransactionQueryParameters = [
    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
    { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
    { name: 'type', in: 'query', schema: { type: 'string', enum: ['EARN', 'SURVEY_REWARD', 'REVIEW_REWARD', 'REDEEM', 'REFUND', 'EXPIRE', 'ADJUST'] } },
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
    '/loyalty/redeem-preview': {
        post: {
            tags: ['Loyalty'],
            summary: 'Preview loyalty point redeem discount',
            description: 'Calculate point discount and final price only. This API does not deduct points or create a REDEEM transaction.',
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: redeemPreviewRequestSchema,
                    },
                },
            },
            responses: {
                200: {
                    description: 'Success',
                    content: {
                        'application/json': {
                            schema: redeemPreviewResponse,
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

    '/admin/loyalty/expiring-points': {
        get: {
            tags: ['Admin Loyalty'],
            summary: 'Get point transactions that are expired or expiring soon',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                { name: 'customer_id', in: 'query', schema: { type: 'string' } },
                { name: 'days', in: 'query', schema: { type: 'integer', default: 30, minimum: 0, maximum: 365 } },
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
    '/admin/loyalty/expire-points': {
        post: {
            tags: ['Admin Loyalty'],
            summary: 'Expire due loyalty points',
            description: 'Expire only point transactions whose expires_at is less than or equal to current time.',
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: false,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                customer_id: { type: 'string', nullable: true },
                            },
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: 'Success',
                    content: {
                        'application/json': {
                            schema: expirePointsResponse,
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
                { name: 'tier', in: 'query', schema: { type: 'string' } },
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
                { name: 'type', in: 'query', schema: { type: 'string', enum: ['EARN', 'SURVEY_REWARD', 'REVIEW_REWARD', 'REDEEM', 'REFUND', 'EXPIRE', 'ADJUST'] } },
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
        post: {
            tags: ['Admin Loyalty'],
            summary: 'Create loyalty tier rule',
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: createTierRuleRequestSchema,
                    },
                },
            },
            responses: {
                201: {
                    description: 'Created',
                    content: {
                        'application/json': {
                            schema: tierRuleResponse,
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/loyalty/tier-rules/{tierRuleId}': {
        get: {
            tags: ['Admin Loyalty'],
            summary: 'Get loyalty tier rule detail',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'tierRuleId', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Success',
                    content: {
                        'application/json': {
                            schema: tierRuleResponse,
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
        patch: {
            tags: ['Admin Loyalty'],
            summary: 'Update loyalty tier rule',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'tierRuleId', in: 'path', required: true, schema: { type: 'string' } },
            ],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: updateTierRuleRequestSchema,
                    },
                },
            },
            responses: {
                200: {
                    description: 'Success',
                    content: {
                        'application/json': {
                            schema: tierRuleResponse,
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
        delete: {
            tags: ['Admin Loyalty'],
            summary: 'Delete loyalty tier rule',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'tierRuleId', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Success',
                    content: {
                        'application/json': {
                            schema: tierRuleResponse,
                        },
                    },
                },
                ...tierRuleDeleteErrorResponses,
            },
        },
    },
    '/admin/loyalty/tier-rules/{tierRuleId}/activate': {
        patch: {
            tags: ['Admin Loyalty'],
            summary: 'Activate loyalty tier rule',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'tierRuleId', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Success',
                    content: {
                        'application/json': {
                            schema: tierRuleResponse,
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/loyalty/tier-rules/{tierRuleId}/deactivate': {
        patch: {
            tags: ['Admin Loyalty'],
            summary: 'Deactivate loyalty tier rule',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'tierRuleId', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Success',
                    content: {
                        'application/json': {
                            schema: tierRuleResponse,
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
        CreateTierRuleRequest: createTierRuleRequestSchema,
        UpdateTierRuleRequest: updateTierRuleRequestSchema,
        LoyaltyOverview: loyaltyOverviewSchema,
        LoyaltyRedeemRule: loyaltyRedeemRuleSchema,
        RedeemPreviewRequest: redeemPreviewRequestSchema,
        RedeemPreview: redeemPreviewSchema,
        ExpirePointsResult: expirePointsResultSchema,
    },
    paths,
};
