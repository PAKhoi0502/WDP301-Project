const tags = [
    {
        name: 'Waitlists',
        description: 'Customer waitlist APIs',
    },
    {
        name: 'Admin Waitlists',
        description: 'Staff and admin waitlist APIs',
    },
];

const waitlistStatusEnum = ['WAITING', 'OFFERED', 'ACCEPTED', 'CANCELED', 'EXPIRED'];

const bookingWaitlistSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        customer_id: { type: 'string' },
        customer: { type: 'object', nullable: true },
        vehicle_id: { type: 'string' },
        vehicle: { type: 'object', nullable: true },
        garage_id: { type: 'string' },
        garage: { type: 'object', nullable: true },
        service_package_id: { type: 'string' },
        service_package: { type: 'object', nullable: true },
        add_on_service_ids: {
            type: 'array',
            items: { type: 'string' },
        },
        vehicle_type: { type: 'string', enum: ['MOTORBIKE', 'CAR'] },
        desired_start_time: { type: 'string', format: 'date-time' },
        status: { type: 'string', enum: waitlistStatusEnum },
        offered_at: { type: 'string', format: 'date-time', nullable: true },
        offer_expires_at: { type: 'string', format: 'date-time', nullable: true },
        accepted_at: { type: 'string', format: 'date-time', nullable: true },
        canceled_at: { type: 'string', format: 'date-time', nullable: true },
        canceled_by_id: { type: 'string', nullable: true },
        canceled_by: { type: 'object', nullable: true },
        cancel_reason: { type: 'string', nullable: true },
        expired_at: { type: 'string', format: 'date-time', nullable: true },
        created_booking_id: { type: 'string', nullable: true },
        created_booking: { type: 'object', nullable: true },
        source_booking_id: { type: 'string', nullable: true },
        source_booking: { type: 'object', nullable: true },
        note: { type: 'string', nullable: true },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
    },
};

const createWaitlistRequest = {
    type: 'object',
    required: ['garage_id', 'vehicle_id', 'service_package_id', 'desired_start_time'],
    properties: {
        garage_id: { type: 'string', example: '665f0d3d8b4f5d0012a00001' },
        vehicle_id: { type: 'string', example: '665f0d3d8b4f5d0012a00002' },
        service_package_id: { type: 'string', example: '665f0d3d8b4f5d0012a00003' },
        add_on_service_ids: {
            type: 'array',
            items: { type: 'string' },
            example: ['665f0d3d8b4f5d0012a00004'],
        },
        desired_start_time: { type: 'string', format: 'date-time', example: '2026-06-10T09:00:00+07:00' },
        note: { type: 'string', example: 'Customer wants this exact slot' },
    },
};

const cancelWaitlistRequest = {
    type: 'object',
    properties: {
        reason: { type: 'string', example: 'Customer changed schedule' },
    },
};

const offerWaitlistRequest = {
    type: 'object',
    properties: {
        offer_expires_in_minutes: {
            type: 'integer',
            minimum: 1,
            maximum: 1440,
            example: 15,
        },
    },
};

const waitlistResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: bookingWaitlistSchema,
    },
};

const waitlistListResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
            type: 'array',
            items: bookingWaitlistSchema,
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

const acceptWaitlistResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
            type: 'object',
            properties: {
                waitlist: bookingWaitlistSchema,
                booking: { $ref: '#/components/schemas/Booking' },
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
    '/waitlists': {
        get: {
            tags: ['Waitlists'],
            summary: 'Get my waitlists',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                { name: 'status', in: 'query', schema: { type: 'string', enum: waitlistStatusEnum } },
                { name: 'garage_id', in: 'query', schema: { type: 'string' } },
                { name: 'service_package_id', in: 'query', schema: { type: 'string' } },
                { name: 'vehicle_id', in: 'query', schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Waitlists',
                    content: { 'application/json': { schema: waitlistListResponse } },
                },
                ...commonErrorResponses,
            },
        },
        post: {
            tags: ['Waitlists'],
            summary: 'Join waitlist for an unavailable slot',
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: true,
                content: { 'application/json': { schema: createWaitlistRequest } },
            },
            responses: {
                201: {
                    description: 'Waitlist created',
                    content: { 'application/json': { schema: waitlistResponse } },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/waitlists/{id}': {
        get: {
            tags: ['Waitlists'],
            summary: 'Get my waitlist by id',
            security: [{ bearerAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            responses: {
                200: {
                    description: 'Waitlist detail',
                    content: { 'application/json': { schema: waitlistResponse } },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/waitlists/{id}/cancel': {
        patch: {
            tags: ['Waitlists'],
            summary: 'Cancel my waitlist',
            security: [{ bearerAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            requestBody: {
                required: false,
                content: { 'application/json': { schema: cancelWaitlistRequest } },
            },
            responses: {
                200: {
                    description: 'Waitlist canceled',
                    content: { 'application/json': { schema: waitlistResponse } },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/waitlists/{id}/accept': {
        patch: {
            tags: ['Waitlists'],
            summary: 'Accept my waitlist offer and create booking',
            security: [{ bearerAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            responses: {
                201: {
                    description: 'Waitlist offer accepted',
                    content: { 'application/json': { schema: acceptWaitlistResponse } },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/waitlists': {
        get: {
            tags: ['Admin Waitlists'],
            summary: 'Get all waitlists for staff or admin',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                { name: 'status', in: 'query', schema: { type: 'string', enum: waitlistStatusEnum } },
                { name: 'customer_id', in: 'query', schema: { type: 'string' } },
                { name: 'vehicle_id', in: 'query', schema: { type: 'string' } },
                { name: 'garage_id', in: 'query', schema: { type: 'string' } },
                { name: 'service_package_id', in: 'query', schema: { type: 'string' } },
                { name: 'vehicle_type', in: 'query', schema: { type: 'string', enum: ['MOTORBIKE', 'CAR'] } },
                { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
                { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
            ],
            responses: {
                200: {
                    description: 'Waitlists',
                    content: { 'application/json': { schema: waitlistListResponse } },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/waitlists/{id}/cancel': {
        patch: {
            tags: ['Admin Waitlists'],
            summary: 'Cancel waitlist as staff or admin',
            security: [{ bearerAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            requestBody: {
                required: false,
                content: { 'application/json': { schema: cancelWaitlistRequest } },
            },
            responses: {
                200: {
                    description: 'Waitlist canceled',
                    content: { 'application/json': { schema: waitlistResponse } },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/waitlists/{id}/offer': {
        patch: {
            tags: ['Admin Waitlists'],
            summary: 'Offer a waitlist slot as staff or admin',
            security: [{ bearerAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            requestBody: {
                required: false,
                content: { 'application/json': { schema: offerWaitlistRequest } },
            },
            responses: {
                200: {
                    description: 'Waitlist offered',
                    content: { 'application/json': { schema: waitlistResponse } },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/waitlists/{id}/expire': {
        patch: {
            tags: ['Admin Waitlists'],
            summary: 'Expire a waitlist offer as staff or admin',
            security: [{ bearerAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            responses: {
                200: {
                    description: 'Waitlist offer expired',
                    content: { 'application/json': { schema: waitlistResponse } },
                },
                ...commonErrorResponses,
            },
        },
    },
};

const schemas = {
    BookingWaitlist: bookingWaitlistSchema,
    CreateWaitlistRequest: createWaitlistRequest,
    CancelWaitlistRequest: cancelWaitlistRequest,
    OfferWaitlistRequest: offerWaitlistRequest,
};

module.exports = {
    tags,
    paths,
    schemas,
};
