const tags = [
    {
        name: 'Wash Histories',
        description: 'Customer wash history APIs',
    },
    {
        name: 'Admin Wash Histories',
        description: 'Staff and admin wash history APIs',
    },
];

const userSummarySchema = {
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

const bookingSummarySchema = {
    type: 'object',
    nullable: true,
    properties: {
        id: { type: 'string' },
        booking_date: { type: 'string', format: 'date-time' },
        start_time: { type: 'string', format: 'date-time' },
        end_time: { type: 'string', format: 'date-time' },
        status: { type: 'string' },
        payment_status: { type: 'string' },
    },
};

const vehicleSummarySchema = {
    type: 'object',
    nullable: true,
    properties: {
        id: { type: 'string' },
        raw_license_plate: { type: 'string' },
        normalized_license_plate: { type: 'string' },
        vehicle_type: { type: 'string', enum: ['MOTORBIKE', 'CAR'] },
        engine_type: { type: 'string' },
        brand: { type: 'string', nullable: true },
        model: { type: 'string', nullable: true },
        color: { type: 'string', nullable: true },
        is_active: { type: 'boolean' },
    },
};

const garageSummarySchema = {
    type: 'object',
    nullable: true,
    properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        garage_code: { type: 'string' },
        address: { type: 'string' },
        city: { type: 'string', nullable: true },
        is_active: { type: 'boolean' },
    },
};

const washBaySummarySchema = {
    type: 'object',
    nullable: true,
    properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        bay_code: { type: 'string' },
        vehicle_type: { type: 'string', enum: ['MOTORBIKE', 'CAR'] },
        status: { type: 'string' },
        is_active: { type: 'boolean' },
    },
};

const servicePackageSummarySchema = {
    type: 'object',
    nullable: true,
    properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        vehicle_type: { type: 'string', enum: ['MOTORBIKE', 'CAR'] },
        service_type: { type: 'string' },
        base_price: { type: 'number' },
        duration_minutes: { type: 'number' },
        requires_wash_bay: { type: 'boolean' },
        is_active: { type: 'boolean' },
    },
};

const washHistorySchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        booking_id: { type: 'string' },
        booking: bookingSummarySchema,
        customer_id: { type: 'string', nullable: true },
        customer: userSummarySchema,
        vehicle_id: { type: 'string', nullable: true },
        vehicle: vehicleSummarySchema,
        garage_id: { type: 'string' },
        garage: garageSummarySchema,
        wash_bay_id: { type: 'string', nullable: true },
        wash_bay: washBaySummarySchema,
        service_package_id: { type: 'string' },
        service_package: servicePackageSummarySchema,
        vehicle_type: { type: 'string', enum: ['MOTORBIKE', 'CAR'] },
        amount_paid: { type: 'number' },
        original_price: { type: 'number' },
        discount_amount: { type: 'number' },
        points_earned: { type: 'number' },
        points_used: { type: 'number' },
        payment_method: { type: 'string', enum: ['CASH', 'PAYOS'] },
        paid_at: { type: 'string', format: 'date-time' },
        service_started_at: { type: 'string', format: 'date-time', nullable: true },
        service_completed_at: { type: 'string', format: 'date-time' },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
    },
};

const washHistoryListResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
            type: 'array',
            items: washHistorySchema,
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

const washHistoryResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: washHistorySchema,
    },
};

const claimResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
            type: 'object',
            properties: {
                claimed_bookings: { type: 'number' },
                claimed_wash_histories: { type: 'number' },
                linked_promotion_usages: { type: 'number' },
            },
        },
    },
};

const paginationParameters = [
    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
    { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
];

const commonFilterParameters = [
    ...paginationParameters,
    { name: 'vehicle_id', in: 'query', schema: { type: 'string' } },
    { name: 'garage_id', in: 'query', schema: { type: 'string' } },
    { name: 'service_package_id', in: 'query', schema: { type: 'string' } },
    { name: 'vehicle_type', in: 'query', schema: { type: 'string', enum: ['MOTORBIKE', 'CAR'] } },
    { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
    { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
];

const commonErrorResponses = {
    400: { description: 'Bad request' },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden' },
    404: { description: 'Not found' },
};

const paths = {
    '/wash-histories': {
        get: {
            tags: ['Wash Histories'],
            summary: 'Get current customer wash histories',
            security: [{ bearerAuth: [] }],
            parameters: commonFilterParameters,
            responses: {
                200: {
                    description: 'Success',
                    content: {
                        'application/json': {
                            schema: washHistoryListResponse,
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/wash-histories/{id}': {
        get: {
            tags: ['Wash Histories'],
            summary: 'Get current customer wash history detail',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Success',
                    content: {
                        'application/json': {
                            schema: washHistoryResponse,
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/wash-histories/claim': {
        post: {
            tags: ['Wash Histories'],
            summary: 'Claim completed paid walk-in histories by verified phone',
            security: [{ bearerAuth: [] }],
            responses: {
                200: {
                    description: 'Success',
                    content: {
                        'application/json': {
                            schema: claimResponse,
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/wash-histories': {
        get: {
            tags: ['Admin Wash Histories'],
            summary: 'Get wash histories for staff or admin',
            security: [{ bearerAuth: [] }],
            parameters: [
                ...commonFilterParameters,
                { name: 'customer_id', in: 'query', schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Success',
                    content: {
                        'application/json': {
                            schema: washHistoryListResponse,
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/wash-histories/{id}': {
        get: {
            tags: ['Admin Wash Histories'],
            summary: 'Get wash history detail for staff or admin',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Success',
                    content: {
                        'application/json': {
                            schema: washHistoryResponse,
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
        WashHistory: washHistorySchema,
    },
};
