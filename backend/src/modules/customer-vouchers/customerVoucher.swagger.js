const tags = [{
    name: 'Customer Vouchers',
    description: 'Customer-bound compensation vouchers',
}];

const customerVoucherSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        code: { type: 'string' },
        customer_id: { type: 'string' },
        garage_id: { type: 'string' },
        source_booking_id: { type: 'string' },
        source_incident_id: { type: 'string', nullable: true },
        source_customer_case_id: { type: 'string', nullable: true },
        source_customer_case_resolution_id: { type: 'string', nullable: true },
        voucher_type: {
            type: 'string',
            enum: ['FIXED_AMOUNT', 'PERCENTAGE', 'FREE_SERVICE'],
        },
        value: { type: 'integer' },
        max_discount_amount: { type: 'integer', nullable: true },
        min_order_amount: { type: 'integer' },
        service_package_id: { type: 'string', nullable: true },
        status: {
            type: 'string',
            enum: ['PENDING_APPROVAL', 'ISSUED', 'RESERVED', 'USED', 'EXPIRED', 'REVOKED'],
        },
        expires_at: { type: 'string', format: 'date-time' },
        reserved_booking_id: { type: 'string', nullable: true },
        reserved_at: { type: 'string', format: 'date-time', nullable: true },
        used_at: { type: 'string', format: 'date-time', nullable: true },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
    },
};

const voucherIdParameter = {
    name: 'id',
    in: 'path',
    required: true,
    schema: { type: 'string' },
};

const voucherListParameters = [
    {
        name: 'status',
        in: 'query',
        schema: {
            type: 'string',
            enum: ['PENDING_APPROVAL', 'ISSUED', 'RESERVED', 'USED', 'EXPIRED', 'REVOKED'],
        },
    },
    {
        name: 'garage_id',
        in: 'query',
        schema: { type: 'string' },
    },
    {
        name: 'page',
        in: 'query',
        schema: { type: 'integer', minimum: 1, default: 1 },
    },
    {
        name: 'limit',
        in: 'query',
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
];

const listResponse = {
    description: 'Voucher list returned',
    content: {
        'application/json': {
            schema: {
                type: 'object',
                properties: {
                    success: { type: 'boolean' },
                    data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/CustomerVoucher' },
                    },
                    meta: { type: 'object' },
                },
            },
        },
    },
};

const paths = {
    '/customer-vouchers': {
        get: {
            tags: ['Customer Vouchers'],
            summary: 'Get my compensation vouchers',
            parameters: voucherListParameters,
            responses: { 200: listResponse },
        },
    },
    '/customer-vouchers/validate': {
        post: {
            tags: ['Customer Vouchers'],
            summary: 'Preview my voucher discount',
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['code', 'service_package_id', 'order_amount'],
                            properties: {
                                code: { type: 'string' },
                                service_package_id: { type: 'string' },
                                order_amount: { type: 'integer', minimum: 0 },
                            },
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: 'Voucher discount returned',
                },
            },
        },
    },
    '/admin/customer-vouchers': {
        get: {
            tags: ['Customer Vouchers'],
            summary: 'List compensation vouchers',
            parameters: voucherListParameters,
            responses: { 200: listResponse },
        },
    },
    '/admin/customer-vouchers/{id}/approve': {
        patch: {
            tags: ['Customer Vouchers'],
            summary: 'Approve a pending compensation voucher',
            parameters: [voucherIdParameter],
            responses: { 200: { description: 'Voucher approved' } },
        },
    },
    '/admin/customer-vouchers/{id}/revoke': {
        patch: {
            tags: ['Customer Vouchers'],
            summary: 'Revoke an unused compensation voucher',
            parameters: [voucherIdParameter],
            responses: { 200: { description: 'Voucher revoked' } },
        },
    },
};

const schemas = {
    CustomerVoucher: customerVoucherSchema,
};

module.exports = {
    tags,
    paths,
    schemas,
};
