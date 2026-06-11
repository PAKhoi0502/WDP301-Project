const tags = [
    {
        name: 'Garages',
        description: 'Garage public and admin management APIs',
    },
];

const schemas = {
    GarageCreateRequest: {
        type: 'object',
        required: ['name', 'garage_code', 'address'],
        properties: {
            name: {
                type: 'string',
                example: 'AutoWash Pro District 1',
            },
            garage_code: {
                type: 'string',
                example: 'GAR001',
            },
            address: {
                type: 'string',
                example: '123 Nguyen Hue Street',
            },
            ward: {
                type: 'string',
                nullable: true,
                example: 'Ben Nghe',
            },
            district: {
                type: 'string',
                nullable: true,
                example: 'District 1',
            },
            city: {
                type: 'string',
                nullable: true,
                example: 'Ho Chi Minh City',
            },
            phone: {
                type: 'string',
                nullable: true,
                example: '0900000999',
            },
            email: {
                type: 'string',
                nullable: true,
                example: 'garage@example.com',
            },
            latitude: {
                type: 'number',
                nullable: true,
                example: 10.7769,
            },
            longitude: {
                type: 'number',
                nullable: true,
                example: 106.7009,
            },
            opening_time: {
                type: 'string',
                example: '07:00',
            },
            closing_time: {
                type: 'string',
                example: '18:00',
            },
            slot_interval_minutes: {
                type: 'integer',
                example: 30,
            },
            late_grace_minutes: {
                type: 'integer',
                example: 15,
            },
            description: {
                type: 'string',
                nullable: true,
                example: 'Main garage branch',
            },
            is_active: {
                type: 'boolean',
                example: true,
            },
        },
    },
    GarageUpdateRequest: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                example: 'AutoWash Pro District 1',
            },
            garage_code: {
                type: 'string',
                example: 'GAR001',
            },
            address: {
                type: 'string',
                example: '123 Nguyen Hue Street',
            },
            ward: {
                type: 'string',
                nullable: true,
                example: 'Ben Nghe',
            },
            district: {
                type: 'string',
                nullable: true,
                example: 'District 1',
            },
            city: {
                type: 'string',
                nullable: true,
                example: 'Ho Chi Minh City',
            },
            phone: {
                type: 'string',
                nullable: true,
                example: '0900000999',
            },
            email: {
                type: 'string',
                nullable: true,
                example: 'garage@example.com',
            },
            latitude: {
                type: 'number',
                nullable: true,
                example: 10.7769,
            },
            longitude: {
                type: 'number',
                nullable: true,
                example: 106.7009,
            },
            opening_time: {
                type: 'string',
                example: '07:00',
            },
            closing_time: {
                type: 'string',
                example: '18:00',
            },
            slot_interval_minutes: {
                type: 'integer',
                example: 30,
            },
            late_grace_minutes: {
                type: 'integer',
                example: 15,
            },
            description: {
                type: 'string',
                nullable: true,
                example: 'Main garage branch',
            },
            is_active: {
                type: 'boolean',
                example: true,
            },
        },
    },
    GarageStatusUpdateRequest: {
        type: 'object',
        required: ['is_active'],
        properties: {
            is_active: {
                type: 'boolean',
                example: false,
            },
        },
    },
    GaragePublic: {
        type: 'object',
        properties: {
            id: {
                type: 'string',
                example: '665f1b7b2a5f9d0012a11111',
            },
            name: {
                type: 'string',
                example: 'AutoWash Pro District 1',
            },
            garage_code: {
                type: 'string',
                example: 'GAR001',
            },
            address: {
                type: 'string',
                example: '123 Nguyen Hue Street',
            },
            ward: {
                type: 'string',
                nullable: true,
                example: 'Ben Nghe',
            },
            district: {
                type: 'string',
                nullable: true,
                example: 'District 1',
            },
            city: {
                type: 'string',
                nullable: true,
                example: 'Ho Chi Minh City',
            },
            phone: {
                type: 'string',
                nullable: true,
                example: '0900000999',
            },
            email: {
                type: 'string',
                nullable: true,
                example: 'garage@example.com',
            },
            latitude: {
                type: 'number',
                nullable: true,
                example: 10.7769,
            },
            longitude: {
                type: 'number',
                nullable: true,
                example: 106.7009,
            },
            opening_time: {
                type: 'string',
                example: '07:00',
            },
            closing_time: {
                type: 'string',
                example: '18:00',
            },
            slot_interval_minutes: {
                type: 'integer',
                example: 30,
            },
            late_grace_minutes: {
                type: 'integer',
                example: 15,
            },
            description: {
                type: 'string',
                nullable: true,
                example: 'Main garage branch',
            },
            is_active: {
                type: 'boolean',
                example: true,
            },
            created_at: {
                type: 'string',
                format: 'date-time',
                example: '2026-06-03T00:00:00.000Z',
            },
            updated_at: {
                type: 'string',
                format: 'date-time',
                example: '2026-06-03T00:00:00.000Z',
            },
        },
    },
    GarageResponse: {
        type: 'object',
        properties: {
            success: {
                type: 'boolean',
                example: true,
            },
            message: {
                type: 'string',
                example: 'Get garage successfully',
            },
            data: {
                $ref: '#/components/schemas/GaragePublic',
            },
        },
    },
    GarageListResponse: {
        type: 'object',
        properties: {
            success: {
                type: 'boolean',
                example: true,
            },
            message: {
                type: 'string',
                example: 'Get garages successfully',
            },
            data: {
                type: 'array',
                items: {
                    $ref: '#/components/schemas/GaragePublic',
                },
            },
            meta: {
                type: 'object',
                properties: {
                    page: {
                        type: 'integer',
                        example: 1,
                    },
                    limit: {
                        type: 'integer',
                        example: 20,
                    },
                    total: {
                        type: 'integer',
                        example: 10,
                    },
                    total_pages: {
                        type: 'integer',
                        example: 1,
                    },
                },
            },
        },
    },
};

const unauthorizedResponse = {
    description: 'Unauthorized',
    content: {
        'application/json': {
            schema: {
                $ref: '#/components/schemas/ErrorResponse',
            },
        },
    },
};

const forbiddenResponse = {
    description: 'Forbidden',
    content: {
        'application/json': {
            schema: {
                $ref: '#/components/schemas/ErrorResponse',
            },
        },
    },
};

const validationErrorResponse = {
    description: 'Validation failed',
    content: {
        'application/json': {
            schema: {
                $ref: '#/components/schemas/ErrorResponse',
            },
        },
    },
};

const notFoundResponse = {
    description: 'Garage not found',
    content: {
        'application/json': {
            schema: {
                $ref: '#/components/schemas/ErrorResponse',
            },
        },
    },
};

const conflictResponse = {
    description: 'Garage code already exists',
    content: {
        'application/json': {
            schema: {
                $ref: '#/components/schemas/ErrorResponse',
            },
        },
    },
};

const garageIdParameter = {
    in: 'path',
    name: 'id',
    required: true,
    schema: {
        type: 'string',
    },
    example: '665f1b7b2a5f9d0012a11111',
};

const paginationParameters = [
    {
        in: 'query',
        name: 'page',
        schema: {
            type: 'integer',
            example: 1,
        },
    },
    {
        in: 'query',
        name: 'limit',
        schema: {
            type: 'integer',
            example: 20,
        },
    },
    {
        in: 'query',
        name: 'search',
        schema: {
            type: 'string',
            example: 'District 1',
        },
    },
    {
        in: 'query',
        name: 'city',
        schema: {
            type: 'string',
            example: 'Ho Chi Minh City',
        },
    },
    {
        in: 'query',
        name: 'district',
        schema: {
            type: 'string',
            example: 'District 1',
        },
    },
];

const paths = {
    '/garages': {
        get: {
            tags: ['Garages'],
            summary: 'Get active garages',
            parameters: paginationParameters,
            responses: {
                200: {
                    description: 'Get garages successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/GarageListResponse',
                            },
                        },
                    },
                },
                400: validationErrorResponse,
            },
        },
    },
    '/garages/{id}': {
        get: {
            tags: ['Garages'],
            summary: 'Get active garage by id',
            parameters: [garageIdParameter],
            responses: {
                200: {
                    description: 'Get garage successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/GarageResponse',
                            },
                        },
                    },
                },
                400: validationErrorResponse,
                404: notFoundResponse,
            },
        },
    },
    '/admin/garages': {
        get: {
            tags: ['Garages'],
            summary: 'Get all garages',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            parameters: [
                ...paginationParameters,
                {
                    in: 'query',
                    name: 'is_active',
                    schema: {
                        type: 'boolean',
                        example: true,
                    },
                },
            ],
            responses: {
                200: {
                    description: 'Get garages successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/GarageListResponse',
                            },
                        },
                    },
                },
                400: validationErrorResponse,
                401: unauthorizedResponse,
                403: forbiddenResponse,
            },
        },
        post: {
            tags: ['Garages'],
            summary: 'Create garage',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/GarageCreateRequest',
                        },
                    },
                },
            },
            responses: {
                201: {
                    description: 'Create garage successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/GarageResponse',
                            },
                        },
                    },
                },
                400: validationErrorResponse,
                401: unauthorizedResponse,
                403: forbiddenResponse,
                409: conflictResponse,
            },
        },
    },
    '/admin/garages/{id}': {
        get: {
            tags: ['Garages'],
            summary: 'Get garage by id',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            parameters: [garageIdParameter],
            responses: {
                200: {
                    description: 'Get garage successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/GarageResponse',
                            },
                        },
                    },
                },
                400: validationErrorResponse,
                401: unauthorizedResponse,
                403: forbiddenResponse,
                404: notFoundResponse,
            },
        },
        patch: {
            tags: ['Garages'],
            summary: 'Update garage',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            parameters: [garageIdParameter],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/GarageUpdateRequest',
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: 'Update garage successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/GarageResponse',
                            },
                        },
                    },
                },
                400: validationErrorResponse,
                401: unauthorizedResponse,
                403: forbiddenResponse,
                404: notFoundResponse,
                409: conflictResponse,
            },
        },
        delete: {
            tags: ['Garages'],
            summary: 'Deactivate garage',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            parameters: [garageIdParameter],
            responses: {
                200: {
                    description: 'Deactivate garage successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/GarageResponse',
                            },
                        },
                    },
                },
                400: validationErrorResponse,
                401: unauthorizedResponse,
                403: forbiddenResponse,
                404: notFoundResponse,
            },
        },
    },
    '/admin/garages/{id}/status': {
        patch: {
            tags: ['Garages'],
            summary: 'Update garage status',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            parameters: [garageIdParameter],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/GarageStatusUpdateRequest',
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: 'Update garage status successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/GarageResponse',
                            },
                        },
                    },
                },
                400: validationErrorResponse,
                401: unauthorizedResponse,
                403: forbiddenResponse,
                404: notFoundResponse,
            },
        },
    },
};

module.exports = {
    tags,
    schemas,
    paths,
};
