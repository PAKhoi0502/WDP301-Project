const tags = [
    {
        name: 'Payments',
        description: 'Public payment APIs',
    },
    {
        name: 'Customer Payments',
        description: 'Customer-owned booking payment APIs',
    },
    {
        name: 'Admin Payments',
        description: 'Staff and admin payment APIs',
    },
];

const paymentTransactionSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        booking_id: { type: 'string' },
        provider: { type: 'string', enum: ['PAYOS'] },
        method: { type: 'string', enum: ['QR'] },
        order_code: { type: 'number' },
        payment_link_id: { type: 'string' },
        checkout_url: { type: 'string' },
        qr_code: { type: 'string' },
        amount: { type: 'number' },
        currency: { type: 'string', enum: ['VND'] },
        description: { type: 'string' },
        status: { type: 'string', enum: ['INITIATED', 'PENDING', 'CANCELING', 'PAID', 'CANCELED', 'EXPIRED', 'FAILED'] },
        paid_at: { type: 'string', format: 'date-time', nullable: true },
        expires_at: { type: 'string', format: 'date-time', nullable: true },
        canceled_at: { type: 'string', format: 'date-time', nullable: true },
        expired_at: { type: 'string', format: 'date-time', nullable: true },
        created_by_staff_id: { type: 'string', nullable: true },
        initiated_by_user_id: { type: 'string', nullable: true },
        initiated_by_role: { type: 'string', enum: ['CUSTOMER', 'STAFF', 'ADMIN'], nullable: true },
        initiated_channel: { type: 'string', enum: ['CUSTOMER_SELF_SERVICE', 'STAFF_ASSISTED'], nullable: true },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
    },
};

const customerPaymentTransactionSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        booking_id: { type: 'string' },
        provider: { type: 'string', enum: ['PAYOS'] },
        method: { type: 'string', enum: ['QR'] },
        order_code: { type: 'number' },
        checkout_url: { type: 'string', nullable: true },
        qr_code: { type: 'string', nullable: true },
        amount: { type: 'number' },
        currency: { type: 'string', enum: ['VND'] },
        description: { type: 'string' },
        status: { type: 'string', enum: ['INITIATED', 'PENDING', 'CANCELING', 'PAID', 'CANCELED', 'EXPIRED', 'FAILED'] },
        paid_at: { type: 'string', format: 'date-time', nullable: true },
        expires_at: { type: 'string', format: 'date-time', nullable: true },
        canceled_at: { type: 'string', format: 'date-time', nullable: true },
        expired_at: { type: 'string', format: 'date-time', nullable: true },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
    },
};

const createPayosPaymentRequest = {
    type: 'object',
    properties: {
        return_url: { type: 'string', example: 'http://localhost:5173/payment/success' },
        cancel_url: { type: 'string', example: 'http://localhost:5173/payment/cancel' },
    },
};

const cancelPaymentRequest = {
    type: 'object',
    properties: {
        reason: { type: 'string', example: 'Customer changed to cash payment' },
    },
};

const paymentDetailResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
            type: 'object',
            properties: {
                booking: { $ref: '#/components/schemas/Booking' },
                payment: paymentTransactionSchema,
            },
        },
    },
};

const createPayosPaymentResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
            type: 'object',
            properties: {
                booking: { $ref: '#/components/schemas/Booking' },
                payment: paymentTransactionSchema,
                reused: { type: 'boolean' },
            },
        },
    },
};

const customerPayosPaymentResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
            type: 'object',
            properties: {
                payment: customerPaymentTransactionSchema,
                reused: { type: 'boolean' },
                poll_after_ms: { type: 'integer', nullable: true, example: 3000 },
            },
        },
    },
};

const payosWebhookRequest = {
    type: 'object',
    properties: {
        code: { type: 'string', example: '00' },
        desc: { type: 'string', example: 'success' },
        success: { type: 'boolean', example: true },
        data: {
            type: 'object',
            properties: {
                orderCode: { type: 'number' },
                amount: { type: 'number' },
                paymentLinkId: { type: 'string' },
                transactionDateTime: { type: 'string', example: '2026-06-07 10:05:00' },
                code: { type: 'string', example: '00' },
                desc: { type: 'string', example: 'Thanh cong' },
            },
        },
        signature: { type: 'string' },
    },
};

const payosWebhookResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
            type: 'object',
            properties: {
                received: { type: 'boolean' },
                ignored: { type: 'boolean' },
                already_processed: { type: 'boolean' },
                reason: { type: 'string', nullable: true },
                payment: paymentTransactionSchema,
                booking: { $ref: '#/components/schemas/Booking' },
                reward: { type: 'object', nullable: true },
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
    '/payments/payos/webhook': {
        post: {
            tags: ['Payments'],
            summary: 'Receive PayOS payment webhook',
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: payosWebhookRequest,
                    },
                },
            },
            responses: {
                200: {
                    description: 'PayOS webhook processed',
                    content: {
                        'application/json': {
                            schema: payosWebhookResponse,
                        },
                    },
                },
                400: { description: 'Invalid webhook or amount mismatch' },
            },
        },
    },
    '/payments/bookings/{bookingId}/payos': {
        post: {
            tags: ['Customer Payments'],
            summary: 'Create or reuse PayOS payment for an owned completed booking',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'bookingId', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Existing active PayOS payment returned',
                    content: { 'application/json': { schema: customerPayosPaymentResponse } },
                },
                201: {
                    description: 'PayOS payment created',
                    content: { 'application/json': { schema: customerPayosPaymentResponse } },
                },
                ...commonErrorResponses,
            },
        },
        get: {
            tags: ['Customer Payments'],
            summary: 'Poll the latest PayOS payment for an owned booking',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'bookingId', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Latest PayOS payment returned',
                    content: { 'application/json': { schema: customerPayosPaymentResponse } },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/payments/{paymentId}/cancel': {
        patch: {
            tags: ['Customer Payments'],
            summary: 'Cancel a pending PayOS payment for an owned booking',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'paymentId', in: 'path', required: true, schema: { type: 'string' } },
            ],
            requestBody: {
                required: false,
                content: {
                    'application/json': {
                        schema: cancelPaymentRequest,
                    },
                },
            },
            responses: {
                200: {
                    description: 'PayOS payment canceled',
                    content: {
                        'application/json': {
                            schema: customerPayosPaymentResponse,
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/payments/bookings/{bookingId}/payos': {
        post: {
            tags: ['Admin Payments'],
            summary: 'Create PayOS payment link for completed booking',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'bookingId', in: 'path', required: true, schema: { type: 'string' } },
            ],
            requestBody: {
                required: false,
                content: {
                    'application/json': {
                        schema: createPayosPaymentRequest,
                    },
                },
            },
            responses: {
                200: {
                    description: 'Existing active PayOS payment link returned',
                    content: {
                        'application/json': {
                            schema: createPayosPaymentResponse,
                        },
                    },
                },
                201: {
                    description: 'PayOS payment link created',
                    content: {
                        'application/json': {
                            schema: createPayosPaymentResponse,
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
        get: {
            tags: ['Admin Payments'],
            summary: 'Poll the latest PayOS payment for an accessible booking',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'bookingId', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Latest PayOS payment returned',
                    content: { 'application/json': { schema: paymentDetailResponse } },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/payments/{paymentId}': {
        get: {
            tags: ['Admin Payments'],
            summary: 'Get payment transaction detail',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'paymentId', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Payment transaction detail',
                    content: {
                        'application/json': {
                            schema: paymentDetailResponse,
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/payments/{paymentId}/cancel': {
        patch: {
            tags: ['Admin Payments'],
            summary: 'Cancel pending PayOS payment',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'paymentId', in: 'path', required: true, schema: { type: 'string' } },
            ],
            requestBody: {
                required: false,
                content: {
                    'application/json': {
                        schema: cancelPaymentRequest,
                    },
                },
            },
            responses: {
                200: {
                    description: 'PayOS payment canceled',
                    content: {
                        'application/json': {
                            schema: paymentDetailResponse,
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/payments/{paymentId}/expire': {
        patch: {
            tags: ['Admin Payments'],
            summary: 'Expire overdue PayOS payment',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'paymentId', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'PayOS payment expired',
                    content: {
                        'application/json': {
                            schema: paymentDetailResponse,
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
};

const schemas = {
    PaymentTransaction: paymentTransactionSchema,
    CustomerPaymentTransaction: customerPaymentTransactionSchema,
    CreatePayosPaymentRequest: createPayosPaymentRequest,
    CancelPaymentRequest: cancelPaymentRequest,
    PayosWebhookRequest: payosWebhookRequest,
};

module.exports = {
    tags,
    paths,
    schemas,
};
