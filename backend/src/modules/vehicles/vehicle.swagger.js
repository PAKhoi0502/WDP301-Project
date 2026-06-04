const tags = [
    {
        name: 'Vehicles',
        description: 'Customer vehicle management APIs',
    },
    {
        name: 'Admin Vehicles',
        description: 'Admin vehicle management APIs',
    },
];

const schemas = {
    VehicleCreateRequest: {
        type: 'object',
        required: ['raw_license_plate', 'vehicle_type', 'engine_type'],
        properties: {
            raw_license_plate: {
                type: 'string',
                example: '51G-123.45',
            },
            vehicle_type: {
                type: 'string',
                enum: ['MOTORBIKE', 'CAR'],
                example: 'MOTORBIKE',
            },
            engine_type: {
                type: 'string',
                enum: ['GASOLINE', 'ELECTRIC'],
                example: 'GASOLINE',
            },
            motorbike_cc_group: {
                type: 'string',
                nullable: true,
                enum: ['UNDER_175CC', 'OVER_175CC'],
                example: 'UNDER_175CC',
            },
            car_body_type: {
                type: 'string',
                nullable: true,
                enum: ['HATCHBACK', 'SEDAN', 'SUV', 'MPV', 'PICKUP', 'VAN'],
                example: null,
            },
            seat_count: {
                type: 'integer',
                nullable: true,
                example: null,
            },
            brand: {
                type: 'string',
                example: 'Honda',
            },
            model: {
                type: 'string',
                example: 'Air Blade',
            },
            color: {
                type: 'string',
                example: 'Black',
            },
            is_default: {
                type: 'boolean',
                example: true,
            },
        },
    },
    VehicleAdminCreateRequest: {
        type: 'object',
        required: ['customer_id', 'raw_license_plate', 'vehicle_type', 'engine_type'],
        properties: {
            customer_id: {
                type: 'string',
                example: '665f1b7b2a5f9d0012a11111',
            },
            raw_license_plate: {
                type: 'string',
                example: '30A-123.45',
            },
            vehicle_type: {
                type: 'string',
                enum: ['MOTORBIKE', 'CAR'],
                example: 'CAR',
            },
            engine_type: {
                type: 'string',
                enum: ['GASOLINE', 'ELECTRIC'],
                example: 'GASOLINE',
            },
            motorbike_cc_group: {
                type: 'string',
                nullable: true,
                enum: ['UNDER_175CC', 'OVER_175CC'],
                example: null,
            },
            car_body_type: {
                type: 'string',
                nullable: true,
                enum: ['HATCHBACK', 'SEDAN', 'SUV', 'MPV', 'PICKUP', 'VAN'],
                example: 'SEDAN',
            },
            seat_count: {
                type: 'integer',
                nullable: true,
                example: 5,
            },
            brand: {
                type: 'string',
                example: 'Toyota',
            },
            model: {
                type: 'string',
                example: 'Vios',
            },
            color: {
                type: 'string',
                example: 'White',
            },
            is_default: {
                type: 'boolean',
                example: true,
            },
        },
    },
    VehicleUpdateRequest: {
        type: 'object',
        properties: {
            raw_license_plate: {
                type: 'string',
                example: '51G12345',
            },
            vehicle_type: {
                type: 'string',
                enum: ['MOTORBIKE', 'CAR'],
                example: 'MOTORBIKE',
            },
            engine_type: {
                type: 'string',
                enum: ['GASOLINE', 'ELECTRIC'],
                example: 'GASOLINE',
            },
            motorbike_cc_group: {
                type: 'string',
                nullable: true,
                enum: ['UNDER_175CC', 'OVER_175CC'],
                example: 'UNDER_175CC',
            },
            car_body_type: {
                type: 'string',
                nullable: true,
                enum: ['HATCHBACK', 'SEDAN', 'SUV', 'MPV', 'PICKUP', 'VAN'],
                example: null,
            },
            seat_count: {
                type: 'integer',
                nullable: true,
                example: null,
            },
            brand: {
                type: 'string',
                example: 'Honda',
            },
            model: {
                type: 'string',
                example: 'Air Blade',
            },
            color: {
                type: 'string',
                example: 'Black',
            },
            is_default: {
                type: 'boolean',
                example: true,
            },
            is_active: {
                type: 'boolean',
                example: true,
            },
        },
    },
    VehicleAdminUpdateRequest: {
        type: 'object',
        properties: {
            customer_id: {
                type: 'string',
                example: '665f1b7b2a5f9d0012a11111',
            },
            raw_license_plate: {
                type: 'string',
                example: '30A12345',
            },
            vehicle_type: {
                type: 'string',
                enum: ['MOTORBIKE', 'CAR'],
                example: 'CAR',
            },
            engine_type: {
                type: 'string',
                enum: ['GASOLINE', 'ELECTRIC'],
                example: 'GASOLINE',
            },
            motorbike_cc_group: {
                type: 'string',
                nullable: true,
                enum: ['UNDER_175CC', 'OVER_175CC'],
                example: null,
            },
            car_body_type: {
                type: 'string',
                nullable: true,
                enum: ['HATCHBACK', 'SEDAN', 'SUV', 'MPV', 'PICKUP', 'VAN'],
                example: 'SEDAN',
            },
            seat_count: {
                type: 'integer',
                nullable: true,
                example: 5,
            },
            brand: {
                type: 'string',
                example: 'Toyota',
            },
            model: {
                type: 'string',
                example: 'Vios',
            },
            color: {
                type: 'string',
                example: 'White',
            },
            is_default: {
                type: 'boolean',
                example: true,
            },
            is_active: {
                type: 'boolean',
                example: true,
            },
        },
    },
    Vehicle: {
        type: 'object',
        properties: {
            id: {
                type: 'string',
                example: '665f1b7b2a5f9d0012a11111',
            },
            customer_id: {
                type: 'string',
                example: '665f1b7b2a5f9d0012a22222',
            },
            raw_license_plate: {
                type: 'string',
                example: '51G-123.45',
            },
            normalized_license_plate: {
                type: 'string',
                example: '51G12345',
            },
            vehicle_type: {
                type: 'string',
                example: 'MOTORBIKE',
            },
            engine_type: {
                type: 'string',
                example: 'GASOLINE',
            },
            motorbike_cc_group: {
                type: 'string',
                nullable: true,
                example: 'UNDER_175CC',
            },
            car_body_type: {
                type: 'string',
                nullable: true,
                example: null,
            },
            seat_count: {
                type: 'integer',
                nullable: true,
                example: null,
            },
            brand: {
                type: 'string',
                example: 'Honda',
            },
            model: {
                type: 'string',
                example: 'Air Blade',
            },
            color: {
                type: 'string',
                example: 'Black',
            },
            is_default: {
                type: 'boolean',
                example: true,
            },
            is_active: {
                type: 'boolean',
                example: true,
            },
            created_at: {
                type: 'string',
                format: 'date-time',
            },
            updated_at: {
                type: 'string',
                format: 'date-time',
            },
        },
    },
};

const listResponse = (description) => ({
    description,
    content: {
        'application/json': {
            schema: {
                allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                        type: 'object',
                        properties: {
                            data: {
                                type: 'array',
                                items: { $ref: '#/components/schemas/Vehicle' },
                            },
                        },
                    },
                ],
            },
        },
    },
});

const singleResponse = (description) => ({
    description,
    content: {
        'application/json': {
            schema: {
                allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                        type: 'object',
                        properties: {
                            data: { $ref: '#/components/schemas/Vehicle' },
                        },
                    },
                ],
            },
        },
    },
});

const vehicleQueryParameters = [
    {
        name: 'page',
        in: 'query',
        schema: { type: 'integer', default: 1 },
    },
    {
        name: 'limit',
        in: 'query',
        schema: { type: 'integer', default: 20 },
    },
    {
        name: 'search',
        in: 'query',
        schema: { type: 'string' },
    },
    {
        name: 'vehicle_type',
        in: 'query',
        schema: { type: 'string', enum: ['MOTORBIKE', 'CAR'] },
    },
    {
        name: 'engine_type',
        in: 'query',
        schema: { type: 'string', enum: ['GASOLINE', 'ELECTRIC'] },
    },
    {
        name: 'is_active',
        in: 'query',
        schema: { type: 'boolean' },
    },
];

const idParameter = {
    name: 'id',
    in: 'path',
    required: true,
    schema: { type: 'string' },
};

const paths = {
    '/vehicles': {
        get: {
            tags: ['Vehicles'],
            summary: 'Get my vehicles',
            security: [{ bearerAuth: [] }],
            parameters: vehicleQueryParameters,
            responses: {
                200: listResponse('Get vehicles successfully'),
            },
        },
        post: {
            tags: ['Vehicles'],
            summary: 'Create my vehicle',
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/VehicleCreateRequest' },
                    },
                },
            },
            responses: {
                201: singleResponse('Create vehicle successfully'),
            },
        },
    },
    '/vehicles/{id}': {
        get: {
            tags: ['Vehicles'],
            summary: 'Get my vehicle by id',
            security: [{ bearerAuth: [] }],
            parameters: [idParameter],
            responses: {
                200: singleResponse('Get vehicle successfully'),
            },
        },
        patch: {
            tags: ['Vehicles'],
            summary: 'Update my vehicle',
            security: [{ bearerAuth: [] }],
            parameters: [idParameter],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/VehicleUpdateRequest' },
                    },
                },
            },
            responses: {
                200: singleResponse('Update vehicle successfully'),
            },
        },
        delete: {
            tags: ['Vehicles'],
            summary: 'Deactivate my vehicle',
            security: [{ bearerAuth: [] }],
            parameters: [idParameter],
            responses: {
                200: singleResponse('Deactivate vehicle successfully'),
            },
        },
    },
    '/admin/vehicles': {
        get: {
            tags: ['Admin Vehicles'],
            summary: 'Get all vehicles',
            security: [{ bearerAuth: [] }],
            parameters: [
                ...vehicleQueryParameters,
                {
                    name: 'customer_id',
                    in: 'query',
                    schema: { type: 'string' },
                },
            ],
            responses: {
                200: listResponse('Get vehicles successfully'),
            },
        },
        post: {
            tags: ['Admin Vehicles'],
            summary: 'Create vehicle for customer',
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/VehicleAdminCreateRequest' },
                    },
                },
            },
            responses: {
                201: singleResponse('Create vehicle successfully'),
            },
        },
    },
    '/admin/vehicles/{id}': {
        get: {
            tags: ['Admin Vehicles'],
            summary: 'Get vehicle by id',
            security: [{ bearerAuth: [] }],
            parameters: [idParameter],
            responses: {
                200: singleResponse('Get vehicle successfully'),
            },
        },
        patch: {
            tags: ['Admin Vehicles'],
            summary: 'Update vehicle',
            security: [{ bearerAuth: [] }],
            parameters: [idParameter],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/VehicleAdminUpdateRequest' },
                    },
                },
            },
            responses: {
                200: singleResponse('Update vehicle successfully'),
            },
        },
        delete: {
            tags: ['Admin Vehicles'],
            summary: 'Deactivate vehicle',
            security: [{ bearerAuth: [] }],
            parameters: [idParameter],
            responses: {
                200: singleResponse('Deactivate vehicle successfully'),
            },
        },
    },
};

module.exports = {
    tags,
    schemas,
    paths,
};
