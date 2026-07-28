const tags = [
    {
        name: 'Admin Analytics',
        description: 'Admin operational analytics APIs',
    },
    {
        name: 'Staff Analytics',
        description: 'Garage-scoped staff dashboard analytics APIs',
    },
];

const analyticsResponseSchema = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
            type: 'object',
            additionalProperties: true,
        },
    },
};

const commonParameters = [
    { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
    { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
    { name: 'garage_id', in: 'query', schema: { type: 'string' } },
    { name: 'service_package_id', in: 'query', schema: { type: 'string' } },
    { name: 'vehicle_type', in: 'query', schema: { type: 'string', enum: ['MOTORBIKE', 'CAR'] } },
    { name: 'group_by', in: 'query', schema: { type: 'string', enum: ['DAY', 'WEEK', 'MONTH'], default: 'DAY' } },
];

const commonResponses = {
    200: {
        description: 'Analytics result',
        content: {
            'application/json': {
                schema: analyticsResponseSchema,
            },
        },
    },
    400: { description: 'Bad request' },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden' },
};

const staffParameters = commonParameters.filter(
    (parameter) => ['from', 'to', 'group_by'].includes(parameter.name)
);

const createAnalyticsPath = (summary) => ({
    get: {
        tags: ['Admin Analytics'],
        summary,
        security: [{ bearerAuth: [] }],
        parameters: commonParameters,
        responses: commonResponses,
    },
});

const paths = {
    '/staff/analytics/overview': {
        get: {
            tags: ['Staff Analytics'],
            summary: 'Get garage-scoped staff dashboard overview',
            security: [{ bearerAuth: [] }],
            parameters: staffParameters,
            responses: commonResponses,
        },
    },
    '/admin/analytics/overview': createAnalyticsPath('Get analytics overview'),
    '/admin/analytics/bookings': createAnalyticsPath('Get booking analytics'),
    '/admin/analytics/revenue': createAnalyticsPath('Get revenue analytics'),
    '/admin/analytics/garages': createAnalyticsPath('Get garage performance analytics'),
    '/admin/analytics/services': createAnalyticsPath('Get service performance analytics'),
    '/admin/analytics/promotions': createAnalyticsPath('Get promotion analytics'),
    '/admin/analytics/wash-bays': createAnalyticsPath('Get wash bay analytics'),
    '/admin/analytics/payments': createAnalyticsPath('Get payment channel analytics'),
    '/admin/analytics/surveys/{surveyId}': {
        get: {
            tags: ['Admin Analytics'],
            summary: 'Get survey analytics',
            security: [{ bearerAuth: [] }],
            parameters: [
                {
                    name: 'surveyId',
                    in: 'path',
                    required: true,
                    schema: { type: 'string' },
                },
                ...commonParameters,
            ],
            responses: {
                ...commonResponses,
                404: { description: 'Survey not found' },
            },
        },
    },
};

module.exports = {
    tags,
    paths,
    schemas: {
        AnalyticsResponse: analyticsResponseSchema,
    },
};
