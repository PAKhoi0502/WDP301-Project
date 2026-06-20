const tags = [
    {
        name: 'Admin Customers',
        description: 'Staff and admin customer lookup APIs',
    },
];

const adminCustomerVehicleSuggestionSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        license_plate: { type: 'string', nullable: true },
        vehicle_type: { type: 'string', enum: ['MOTORBIKE', 'CAR'] },
    },
};

const adminCustomerSuggestionSchema = {
    type: 'object',
    properties: {
        customer_id: { type: 'string' },
        full_name: { type: 'string' },
        phone: { type: 'string', nullable: true },
        email: { type: 'string', nullable: true },
        vehicles: {
            type: 'array',
            items: adminCustomerVehicleSuggestionSchema,
        },
        last_booking_at: { type: 'string', format: 'date-time', nullable: true },
        total_bookings_at_garage: { type: 'integer' },
    },
};

const adminCustomerListResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
            type: 'array',
            items: adminCustomerSuggestionSchema,
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

const commonErrorResponses = {
    400: { description: 'Bad request' },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden' },
};

const paths = {
    '/admin/customers': {
        get: {
            tags: ['Admin Customers'],
            summary: 'Search customers by garage for staff or admin',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'garage_id', in: 'query', required: true, schema: { type: 'string' } },
                { name: 'search', in: 'query', schema: { type: 'string' } },
                { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
            ],
            responses: {
                200: {
                    description: 'Customers',
                    content: { 'application/json': { schema: adminCustomerListResponse } },
                },
                ...commonErrorResponses,
            },
        },
    },
};

const schemas = {
    AdminCustomerSuggestion: adminCustomerSuggestionSchema,
    AdminCustomerVehicleSuggestion: adminCustomerVehicleSuggestionSchema,
};

module.exports = {
    tags,
    paths,
    schemas,
};
