const tags = [
    {
        name: 'Reviews',
        description: 'Public and customer review APIs',
    },
    {
        name: 'Staff Reviews',
        description: 'Garage-scoped staff review response APIs',
    },
    {
        name: 'Admin Reviews',
        description: 'Review moderation and analytics APIs',
    },
];

const ratingDistributionSchema = {
    type: 'object',
    properties: {
        1: { type: 'integer' },
        2: { type: 'integer' },
        3: { type: 'integer' },
        4: { type: 'integer' },
        5: { type: 'integer' },
    },
};

const schemas = {
    ReviewCustomer: {
        type: 'object',
        nullable: true,
        properties: {
            id: { type: 'string', nullable: true },
            full_name: { type: 'string' },
            avatar_url: { type: 'string', nullable: true },
            email: { type: 'string', nullable: true },
            phone: { type: 'string', nullable: true },
        },
    },
    ReviewGarageReply: {
        type: 'object',
        nullable: true,
        properties: {
            content: { type: 'string' },
            replied_by_id: { type: 'string' },
            replied_by: { type: 'object', nullable: true },
            replied_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
        },
    },
    Review: {
        type: 'object',
        properties: {
            id: { type: 'string' },
            booking_id: { type: 'string' },
            wash_history_id: { type: 'string' },
            customer_id: { type: 'string' },
            customer: { $ref: '#/components/schemas/ReviewCustomer' },
            garage_id: { type: 'string' },
            garage: { type: 'object' },
            service_package_id: { type: 'string' },
            service_package: { type: 'object' },
            garage_rating: { type: 'integer', minimum: 1, maximum: 5 },
            service_rating: { type: 'integer', minimum: 1, maximum: 5 },
            rating: { type: 'integer', minimum: 1, maximum: 5 },
            comment: { type: 'string', nullable: true },
            upload_ids: {
                type: 'array',
                items: { type: 'string' },
            },
            uploads: {
                type: 'array',
                items: { $ref: '#/components/schemas/Upload' },
            },
            is_anonymous: { type: 'boolean' },
            moderation_status: {
                type: 'string',
                enum: ['PUBLISHED', 'HIDDEN'],
            },
            moderation_reason: {
                type: 'string',
                nullable: true,
                enum: [
                    'INAPPROPRIATE_LANGUAGE',
                    'PERSONAL_INFORMATION',
                    'SPAM',
                    'OFF_TOPIC',
                    'FRAUD',
                    'OTHER',
                ],
            },
            moderation_note: { type: 'string', nullable: true },
            moderated_by_id: { type: 'string', nullable: true },
            moderated_by: { type: 'object', nullable: true },
            moderated_at: { type: 'string', format: 'date-time', nullable: true },
            garage_reply: { $ref: '#/components/schemas/ReviewGarageReply' },
            reward: {
                type: 'object',
                properties: {
                    awarded: { type: 'boolean' },
                    points: { type: 'integer' },
                    transaction_id: { type: 'string', nullable: true },
                    awarded_at: { type: 'string', format: 'date-time', nullable: true },
                },
            },
            deleted_at: { type: 'string', format: 'date-time', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
        },
    },
    ReviewCreateRequest: {
        type: 'object',
        required: ['booking_id', 'garage_rating', 'service_rating'],
        properties: {
            booking_id: { type: 'string' },
            garage_rating: { type: 'integer', minimum: 1, maximum: 5 },
            service_rating: { type: 'integer', minimum: 1, maximum: 5 },
            comment: { type: 'string', nullable: true, maxLength: 2000 },
            upload_ids: {
                type: 'array',
                maxItems: 5,
                items: { type: 'string' },
            },
            is_anonymous: { type: 'boolean', default: false },
        },
    },
    GarageReviewCreateRequest: {
        type: 'object',
        required: ['booking_id'],
        properties: {
            booking_id: { type: 'string' },
            rating: {
                type: 'integer',
                minimum: 1,
                maximum: 5,
                description: 'Compatibility field used for both ratings when dimension-specific ratings are omitted.',
            },
            garage_rating: { type: 'integer', minimum: 1, maximum: 5 },
            service_rating: { type: 'integer', minimum: 1, maximum: 5 },
            comment: { type: 'string', nullable: true, maxLength: 2000 },
            upload_ids: {
                type: 'array',
                maxItems: 5,
                items: { type: 'string' },
            },
            is_anonymous: { type: 'boolean', default: false },
        },
    },
    ReviewUpdateRequest: {
        type: 'object',
        properties: {
            garage_rating: { type: 'integer', minimum: 1, maximum: 5 },
            service_rating: { type: 'integer', minimum: 1, maximum: 5 },
            comment: { type: 'string', nullable: true, maxLength: 2000 },
            upload_ids: {
                type: 'array',
                maxItems: 5,
                items: { type: 'string' },
            },
            is_anonymous: { type: 'boolean' },
        },
    },
    ReviewReplyRequest: {
        type: 'object',
        required: ['content'],
        properties: {
            content: { type: 'string', minLength: 2, maxLength: 1000 },
        },
    },
    ReviewModerationRequest: {
        type: 'object',
        required: ['status'],
        properties: {
            status: {
                type: 'string',
                enum: ['PUBLISHED', 'HIDDEN'],
            },
            reason: {
                type: 'string',
                nullable: true,
                enum: [
                    'INAPPROPRIATE_LANGUAGE',
                    'PERSONAL_INFORMATION',
                    'SPAM',
                    'OFF_TOPIC',
                    'FRAUD',
                    'OTHER',
                ],
            },
            note: { type: 'string', nullable: true, maxLength: 1000 },
        },
    },
    ReviewSummary: {
        type: 'object',
        properties: {
            rating_average: { type: 'number', example: 4.6 },
            rating_count: { type: 'integer', example: 125 },
            distribution: ratingDistributionSchema,
        },
    },
    ReviewEligibility: {
        type: 'object',
        properties: {
            eligible: { type: 'boolean' },
            reason_code: { type: 'string', nullable: true },
            review: {
                allOf: [{ $ref: '#/components/schemas/Review' }],
                nullable: true,
            },
            context: {
                type: 'object',
                nullable: true,
            },
        },
    },
    ReviewAnalytics: {
        type: 'object',
        properties: {
            total: { type: 'integer' },
            garage_rating_average: { type: 'number' },
            service_rating_average: { type: 'number' },
            replied_count: { type: 'integer' },
            response_rate: { type: 'number' },
            low_rating_count: { type: 'integer' },
            garage_distribution: ratingDistributionSchema,
            service_distribution: ratingDistributionSchema,
            top_garages: {
                type: 'array',
                items: { type: 'object' },
            },
            top_services: {
                type: 'array',
                items: { type: 'object' },
            },
        },
    },
};

const reviewResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: { $ref: '#/components/schemas/Review' },
    },
};

const reviewListResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
            type: 'array',
            items: { $ref: '#/components/schemas/Review' },
        },
        meta: {
            type: 'object',
            properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
                total_pages: { type: 'integer' },
            },
        },
    },
};

const commonErrors = {
    400: { description: 'Bad request' },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden' },
    404: { description: 'Not found' },
    409: { description: 'Conflict' },
};

const publicListParameters = (idName) => [
    { name: idName, in: 'path', required: true, schema: { type: 'string' } },
    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
    { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
    { name: 'rating', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 5 } },
    { name: 'has_comment', in: 'query', schema: { type: 'boolean' } },
    {
        name: 'sort',
        in: 'query',
        schema: {
            type: 'string',
            enum: ['NEWEST', 'OLDEST', 'HIGHEST', 'LOWEST'],
            default: 'NEWEST',
        },
    },
];

const staffListParameters = [
    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
    { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
    { name: 'service_package_id', in: 'query', schema: { type: 'string' } },
    { name: 'garage_rating', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 5 } },
    { name: 'service_rating', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 5 } },
    { name: 'moderation_status', in: 'query', schema: { type: 'string', enum: ['PUBLISHED', 'HIDDEN'] } },
    { name: 'has_reply', in: 'query', schema: { type: 'boolean' } },
    { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
    { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
];

const paths = {
    '/garages/{garageId}/reviews': {
        get: {
            tags: ['Reviews'],
            summary: 'Get public garage reviews',
            parameters: publicListParameters('garageId'),
            responses: {
                200: {
                    description: 'Garage reviews',
                    content: {
                        'application/json': {
                            schema: reviewListResponse,
                        },
                    },
                },
                ...commonErrors,
            },
        },
        post: {
            tags: ['Reviews'],
            summary: 'Create a verified review for a garage booking',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'garageId', in: 'path', required: true, schema: { type: 'string' } },
            ],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/GarageReviewCreateRequest' },
                    },
                },
            },
            responses: {
                201: {
                    description: 'Review created',
                    content: {
                        'application/json': {
                            schema: reviewResponse,
                        },
                    },
                },
                ...commonErrors,
            },
        },
    },
    '/garages/{garageId}/review-summary': {
        get: {
            tags: ['Reviews'],
            summary: 'Get public garage review summary',
            parameters: [
                { name: 'garageId', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Garage review summary',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: { type: 'boolean' },
                                    message: { type: 'string' },
                                    data: { $ref: '#/components/schemas/ReviewSummary' },
                                },
                            },
                        },
                    },
                },
                ...commonErrors,
            },
        },
    },
    '/service-packages/{servicePackageId}/reviews': {
        get: {
            tags: ['Reviews'],
            summary: 'Get public service package reviews',
            parameters: publicListParameters('servicePackageId'),
            responses: {
                200: {
                    description: 'Service package reviews',
                    content: {
                        'application/json': {
                            schema: reviewListResponse,
                        },
                    },
                },
                ...commonErrors,
            },
        },
    },
    '/service-packages/{servicePackageId}/review-summary': {
        get: {
            tags: ['Reviews'],
            summary: 'Get public service package review summary',
            parameters: [
                { name: 'servicePackageId', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Service package review summary',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: { type: 'boolean' },
                                    message: { type: 'string' },
                                    data: { $ref: '#/components/schemas/ReviewSummary' },
                                },
                            },
                        },
                    },
                },
                ...commonErrors,
            },
        },
    },
    '/reviews/eligibility': {
        get: {
            tags: ['Reviews'],
            summary: 'Check current customer review eligibility',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'booking_id', in: 'query', required: true, schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Review eligibility',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: { type: 'boolean' },
                                    message: { type: 'string' },
                                    data: { $ref: '#/components/schemas/ReviewEligibility' },
                                },
                            },
                        },
                    },
                },
                ...commonErrors,
            },
        },
    },
    '/reviews': {
        post: {
            tags: ['Reviews'],
            summary: 'Create a verified booking review',
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/ReviewCreateRequest' },
                    },
                },
            },
            responses: {
                201: {
                    description: 'Review created',
                    content: {
                        'application/json': {
                            schema: reviewResponse,
                        },
                    },
                },
                ...commonErrors,
            },
        },
    },
    '/reviews/mine': {
        get: {
            tags: ['Reviews'],
            summary: 'Get current customer reviews',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
                { name: 'garage_id', in: 'query', schema: { type: 'string' } },
                { name: 'service_package_id', in: 'query', schema: { type: 'string' } },
                { name: 'moderation_status', in: 'query', schema: { type: 'string', enum: ['PUBLISHED', 'HIDDEN'] } },
            ],
            responses: {
                200: {
                    description: 'Customer reviews',
                    content: {
                        'application/json': {
                            schema: reviewListResponse,
                        },
                    },
                },
                ...commonErrors,
            },
        },
    },
    '/reviews/by-booking/{bookingId}': {
        get: {
            tags: ['Reviews'],
            summary: 'Get current customer review by booking',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'bookingId', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Booking review or null',
                    content: {
                        'application/json': {
                            schema: reviewResponse,
                        },
                    },
                },
                ...commonErrors,
            },
        },
    },
    '/reviews/{id}': {
        patch: {
            tags: ['Reviews'],
            summary: 'Update an owned review',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            ],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/ReviewUpdateRequest' },
                    },
                },
            },
            responses: {
                200: {
                    description: 'Review updated',
                    content: {
                        'application/json': {
                            schema: reviewResponse,
                        },
                    },
                },
                ...commonErrors,
            },
        },
        delete: {
            tags: ['Reviews'],
            summary: 'Soft delete an owned review',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Review deleted',
                    content: {
                        'application/json': {
                            schema: reviewResponse,
                        },
                    },
                },
                ...commonErrors,
            },
        },
    },
    '/staff/reviews': {
        get: {
            tags: ['Staff Reviews'],
            summary: 'Get reviews for current staff garage',
            security: [{ bearerAuth: [] }],
            parameters: staffListParameters,
            responses: {
                200: {
                    description: 'Garage-scoped reviews',
                    content: {
                        'application/json': {
                            schema: reviewListResponse,
                        },
                    },
                },
                ...commonErrors,
            },
        },
    },
    '/staff/reviews/{id}': {
        get: {
            tags: ['Staff Reviews'],
            summary: 'Get a review from current staff garage',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Garage-scoped review',
                    content: {
                        'application/json': {
                            schema: reviewResponse,
                        },
                    },
                },
                ...commonErrors,
            },
        },
    },
    '/staff/reviews/{id}/reply': {
        put: {
            tags: ['Staff Reviews'],
            summary: 'Create or replace the official garage reply',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            ],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/ReviewReplyRequest' },
                    },
                },
            },
            responses: {
                200: {
                    description: 'Review replied',
                    content: {
                        'application/json': {
                            schema: reviewResponse,
                        },
                    },
                },
                ...commonErrors,
            },
        },
        delete: {
            tags: ['Staff Reviews'],
            summary: 'Delete the official garage reply',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Review reply deleted',
                    content: {
                        'application/json': {
                            schema: reviewResponse,
                        },
                    },
                },
                ...commonErrors,
            },
        },
    },
    '/admin/reviews': {
        get: {
            tags: ['Admin Reviews'],
            summary: 'Get all active reviews',
            security: [{ bearerAuth: [] }],
            parameters: [
                ...staffListParameters,
                { name: 'search', in: 'query', schema: { type: 'string' } },
                { name: 'customer_id', in: 'query', schema: { type: 'string' } },
                { name: 'booking_id', in: 'query', schema: { type: 'string' } },
                { name: 'garage_id', in: 'query', schema: { type: 'string' } },
                { name: 'is_anonymous', in: 'query', schema: { type: 'boolean' } },
            ],
            responses: {
                200: {
                    description: 'Reviews',
                    content: {
                        'application/json': {
                            schema: reviewListResponse,
                        },
                    },
                },
                ...commonErrors,
            },
        },
    },
    '/admin/reviews/analytics': {
        get: {
            tags: ['Admin Reviews'],
            summary: 'Get review analytics',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'garage_id', in: 'query', schema: { type: 'string' } },
                { name: 'service_package_id', in: 'query', schema: { type: 'string' } },
                { name: 'moderation_status', in: 'query', schema: { type: 'string', enum: ['PUBLISHED', 'HIDDEN'], default: 'PUBLISHED' } },
                { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
                { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
            ],
            responses: {
                200: {
                    description: 'Review analytics',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: { type: 'boolean' },
                                    message: { type: 'string' },
                                    data: { $ref: '#/components/schemas/ReviewAnalytics' },
                                },
                            },
                        },
                    },
                },
                ...commonErrors,
            },
        },
    },
    '/admin/reviews/{id}': {
        get: {
            tags: ['Admin Reviews'],
            summary: 'Get review detail',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Review detail',
                    content: {
                        'application/json': {
                            schema: reviewResponse,
                        },
                    },
                },
                ...commonErrors,
            },
        },
    },
    '/admin/reviews/{id}/moderation': {
        patch: {
            tags: ['Admin Reviews'],
            summary: 'Hide or publish a review',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            ],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/ReviewModerationRequest' },
                    },
                },
            },
            responses: {
                200: {
                    description: 'Review moderated',
                    content: {
                        'application/json': {
                            schema: reviewResponse,
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
    schemas,
    paths,
};
