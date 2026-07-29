const tags = [
    {
        name: 'Feedback Rewards',
        description: 'Customer survey and review reward APIs',
    },
    {
        name: 'Admin Feedback Rewards',
        description: 'Feedback reward rule and analytics APIs',
    },
];

const bearerSecurity = [{ bearerAuth: [] }];

const ruleSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        rule_code: { type: 'string', example: 'POST_SERVICE_FEEDBACK' },
        survey_points: { type: 'integer', example: 50 },
        review_points: { type: 'integer', example: 50 },
        max_points_per_booking: { type: 'integer', example: 100 },
        review_window_days: { type: 'integer', example: 30 },
        reminder_after_hours: { type: 'integer', example: 48 },
        count_toward_tier: { type: 'boolean', example: false },
        is_active: { type: 'boolean', example: true },
        starts_at: { type: 'string', format: 'date-time', nullable: true },
        ends_at: { type: 'string', format: 'date-time', nullable: true },
    },
};

const paths = {
    '/feedback-rewards/status': {
        get: {
            tags: ['Feedback Rewards'],
            summary: 'Get survey and review reward status for a customer booking',
            security: bearerSecurity,
            parameters: [
                {
                    name: 'booking_id',
                    in: 'query',
                    required: true,
                    schema: { type: 'string' },
                },
            ],
            responses: {
                200: {
                    description: 'Feedback reward status',
                },
            },
        },
    },
    '/admin/feedback-rewards/rule': {
        get: {
            tags: ['Admin Feedback Rewards'],
            summary: 'Get the post-service feedback reward rule',
            security: bearerSecurity,
            responses: {
                200: {
                    description: 'Feedback reward rule',
                },
            },
        },
        patch: {
            tags: ['Admin Feedback Rewards'],
            summary: 'Update the post-service feedback reward rule',
            security: bearerSecurity,
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: ruleSchema,
                    },
                },
            },
            responses: {
                200: {
                    description: 'Feedback reward rule updated',
                },
            },
        },
    },
    '/admin/feedback-rewards/analytics': {
        get: {
            tags: ['Admin Feedback Rewards'],
            summary: 'Get invitation, completion, and feedback reward metrics',
            security: bearerSecurity,
            parameters: [
                {
                    name: 'from',
                    in: 'query',
                    schema: { type: 'string', format: 'date-time' },
                },
                {
                    name: 'to',
                    in: 'query',
                    schema: { type: 'string', format: 'date-time' },
                },
            ],
            responses: {
                200: {
                    description: 'Feedback reward analytics',
                },
            },
        },
    },
};

const schemas = {
    FeedbackRewardRule: ruleSchema,
};

module.exports = {
    tags,
    paths,
    schemas,
};
