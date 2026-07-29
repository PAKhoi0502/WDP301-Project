const tags = [
    {
        name: 'Notifications',
        description: 'Authenticated in-app notification APIs',
    },
];

const notificationSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        user_id: { type: 'string', nullable: true },
        recipient_email: { type: 'string', nullable: true },
        type: {
            type: 'string',
            enum: [
                'AUTH_REGISTER_SUCCESS',
                'AUTH_PASSWORD_RESET_REQUESTED',
                'AUTH_STAFF_INVITED',
                'BOOKING_CONFIRMED',
                'BOOKING_REMINDER',
                'BOOKING_CANCELED',
                'BOOKING_INCIDENT_REPORTED',
                'BOOKING_CUSTOMER_DECISION_REQUIRED',
                'BOOKING_INCIDENT_RESOLVED',
                'COMPENSATION_VOUCHER_ISSUED',
                'CUSTOMER_VOUCHER_ISSUED',
                'WAITLIST_JOINED',
                'WAITLIST_OFFERED',
                'WAITLIST_OFFER_ACCEPTED',
                'WAITLIST_OFFER_EXPIRED',
                'WAITLIST_EXPIRED',
                'WAITLIST_CANCELED',
                'CHECKED_IN',
                'BOOKING_ARRIVAL_DETECTED',
                'SERVICE_STARTED',
                'SERVICE_STEP_DONE',
                'SERVICE_COMPLETED',
                'PAYMENT_READY',
                'PAYMENT_CONFIRMED',
                'REWARD_EARNED',
                'POINTS_EXPIRING',
                'TIER_UPGRADED',
                'TIER_DOWNGRADED',
                'PROMOTION_AVAILABLE',
                'SURVEY_REQUEST',
                'REVIEW_REQUEST',
                'FEEDBACK_REWARD_EARNED',
                'FEEDBACK_REMINDER',
                'REVIEW_REPLIED',
                'REVIEW_HIDDEN',
                'REVIEW_PUBLISHED',
                'BOOKING_HANDOVER_READY',
                'BOOKING_HANDOVER_ACCEPTED',
                'BOOKING_HANDOVER_RELEASED',
                'CUSTOMER_CASE_SUBMITTED',
                'CUSTOMER_CASE_ASSIGNED',
                'CUSTOMER_CASE_ACKNOWLEDGED',
                'CUSTOMER_CASE_MESSAGE_RECEIVED',
                'CUSTOMER_CASE_RESOLVED',
                'CUSTOMER_CASE_CLOSED',
                'CUSTOMER_CASE_TECHNICAL_ASSESSMENT_ASSIGNED',
                'CUSTOMER_CASE_TECHNICAL_ASSESSMENT_SUBMITTED',
                'CUSTOMER_CASE_RESOLUTION_PROPOSED',
                'CUSTOMER_CASE_RESOLUTION_RESPONDED',
                'CUSTOMER_CASE_RESOLUTION_APPLIED',
                'CUSTOMER_CASE_SLA_ESCALATED',
                'CUSTOMER_CASE_REOPENED',
                'CUSTOMER_CASE_REFUND_UPDATED',
            ],
        },
        title: { type: 'string', example: 'Payment confirmed' },
        message: { type: 'string', example: 'Your cash payment has been confirmed at the garage.' },
        channels: {
            type: 'array',
            items: { type: 'string', enum: ['IN_APP', 'EMAIL'] },
        },
        related_type: { type: 'string', enum: ['AUTH', 'BOOKING', 'WAITLIST', 'LOYALTY', 'PROMOTION', 'CUSTOMER_VOUCHER', 'SURVEY', 'REVIEW', 'BOOKING_HANDOVER', 'CUSTOMER_CASE', 'STAFF', 'BOOKING_PLATE_SCAN'] },
        related_id: { type: 'string' },
        in_app_status: { type: 'string', enum: ['UNREAD', 'READ'] },
        read_at: { type: 'string', format: 'date-time', nullable: true },
        email_status: { type: 'string', enum: ['NOT_REQUIRED', 'PENDING', 'SENT', 'FAILED'] },
        email_sent_at: { type: 'string', format: 'date-time', nullable: true },
        email_failed_reason: { type: 'string', nullable: true },
        metadata: { type: 'object' },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
    },
};

const notificationListResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
            type: 'array',
            items: notificationSchema,
        },
        meta: {
            type: 'object',
            properties: {
                page: { type: 'number' },
                limit: { type: 'number' },
                total: { type: 'number' },
                total_pages: { type: 'number' },
                unread_count: { type: 'number' },
            },
        },
    },
};

const notificationResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: notificationSchema,
    },
};

const countResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
            type: 'object',
            properties: {
                unread_count: { type: 'number' },
            },
        },
    },
};

const modifiedCountResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
            type: 'object',
            properties: {
                modified_count: { type: 'number' },
            },
        },
    },
};

const deletedCountResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
            type: 'object',
            properties: {
                deleted_count: { type: 'number' },
            },
        },
    },
};

const commonErrorResponses = {
    400: { description: 'Bad request' },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden' },
    404: { description: 'Not found' },
};

const paths = {
    '/notifications': {
        get: {
            tags: ['Notifications'],
            summary: 'Get current customer notifications',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                { name: 'type', in: 'query', schema: { type: 'string' } },
                { name: 'related_type', in: 'query', schema: { type: 'string', enum: ['AUTH', 'BOOKING', 'WAITLIST', 'LOYALTY', 'PROMOTION', 'CUSTOMER_VOUCHER', 'SURVEY', 'REVIEW', 'BOOKING_HANDOVER', 'CUSTOMER_CASE', 'STAFF'] } },
                { name: 'in_app_status', in: 'query', schema: { type: 'string', enum: ['UNREAD', 'READ'] } },
            ],
            responses: {
                200: {
                    description: 'Success',
                    content: {
                        'application/json': {
                            schema: notificationListResponse,
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
        delete: {
            tags: ['Notifications'],
            summary: 'Delete all current customer notifications',
            security: [{ bearerAuth: [] }],
            responses: {
                200: {
                    description: 'Success',
                    content: {
                        'application/json': {
                            schema: deletedCountResponse,
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/notifications/unread-count': {
        get: {
            tags: ['Notifications'],
            summary: 'Get current customer unread notification count',
            security: [{ bearerAuth: [] }],
            responses: {
                200: {
                    description: 'Success',
                    content: {
                        'application/json': {
                            schema: countResponse,
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/notifications/mark-all-read': {
        patch: {
            tags: ['Notifications'],
            summary: 'Mark all current customer notifications as read',
            security: [{ bearerAuth: [] }],
            responses: {
                200: {
                    description: 'Success',
                    content: {
                        'application/json': {
                            schema: modifiedCountResponse,
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/notifications/{id}/read': {
        patch: {
            tags: ['Notifications'],
            summary: 'Mark current customer notification as read',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Success',
                    content: {
                        'application/json': {
                            schema: notificationResponse,
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/notifications/{id}': {
        delete: {
            tags: ['Notifications'],
            summary: 'Delete current customer notification',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Success',
                    content: {
                        'application/json': {
                            schema: notificationResponse,
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
};

const schemas = {
    Notification: notificationSchema,
};

module.exports = {
    tags,
    paths,
    schemas,
};
