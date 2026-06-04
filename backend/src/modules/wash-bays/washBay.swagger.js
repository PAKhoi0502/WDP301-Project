const tags = [
    {
        name: 'WashBays',
        description: 'Wash bay admin management APIs',
    },
];

const schemas = {
    WashBayCreateRequest: {
        type: 'object',
        required: ['garage_id', 'name', 'bay_code', 'vehicle_type'],
        properties: {
            garage_id: {
                type: 'string',
                example: '665f1b7b2a5f9d0012a11111',
            },
            name: {
                type: 'string',
                example: 'Motorbike Bay 01',
            },
            bay_code: {
                type: 'string',
                example: 'MB-01',
            },
            vehicle_type: {
                type: 'string',
                enum: ['MOTORBIKE', 'CAR'],
                example: 'MOTORBIKE',
            },
            status: {
                type: 'string',
                enum: ['AVAILABLE', 'MAINTENANCE', 'INACTIVE'],
                example: 'AVAILABLE',
            },
            is_active: {
                type: 'boolean',
                example: true,
            },
        },
    },
    WashBayUpdateRequest: {
        type: 'object',
        properties: {
            garage_id: {
                type: 'string',
                example: '665f1b7b2a5f9d0012a11111',
            },
            name: {
                type: 'string',
                example: 'Motorbike Bay 01',
            },
            bay_code: {
                type: 'string',
                example: 'MB-01',
            },
            vehicle_type: {
                type: 'string',
                enum: ['MOTORBIKE', 'CAR'],
                example: 'MOTORBIKE',
            },
            is_active: {
                type: 'boolean',
                example: true,
            },
        },
    },
    WashBayStatusUpdateRequest: {
        type: 'object',
        required: ['status'],
        properties: {
            status: {
                type: 'string',
                enum: ['AVAILABLE', 'MAINTENANCE', 'INACTIVE'],
                example: 'MAINTENANCE',
            },
        },
    },
    WashBayGarageSummary: {
        type: 'object',
        nullable: true,
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
            city: {
                type: 'string',
                nullable: true,
                example: 'Ho Chi Minh City',
            },
            is_active: {
                type: 'boolean',
                example: true,
            },
        },
    },
    WashBay: {
        type: 'object',
        properties: {
            id: {
                type: 'string',
                example: '665f1b7b2a5f9d0012a22222',
            },
            garage_id: {
                type: 'string',
                example: '665f1b7b2a5f9d0012a11111',
            },
            garage: {
                $ref: '#/components/schemas/WashBayGarageSummary',
            },
            name: {
                type: 'string',
                example: 'Motorbike Bay 01',
            },
            bay_code: {
                type: 'string',
                example: 'MB-01',
            },
            vehicle_type: {
                type: 'string',
                enum: ['MOTORBIKE', 'CAR'],
                example: 'MOTORBIKE',
            },
            status: {
                type: 'string',
                enum: ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'INACTIVE'],
                example: 'AVAILABLE',
            },
            current_booking_id: {
                type: 'string',
                nullable: true,
                example: null,
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
    WashBayResponse: {
        type: 'object',
        properties: {
            success: {
                type: 'boolean',
                example: true,
            },
            message: {
                type: 'string',
                example: 'Get wash bay successfully',
            },
            data: {
                $ref: '#/components/schemas/WashBay',
            },
        },
    },
    WashBayListResponse: {
        type: 'object',
        properties: {
            success: {
                type: 'boolean',
                example: true,
            },
            message: {
                type: 'string',
                example: 'Get wash bays successfully',
            },
            data: {
                type: 'array',
                items: {
                    $ref: '#/components/schemas/WashBay',
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
    AvailableWashBayListResponse: {
        type: 'object',
        properties: {
            success: {
                type: 'boolean',
                example: true,
            },
            message: {
                type: 'string',
                example: 'Get available wash bays successfully',
            },
            data: {
                type: 'array',
                items: {
                    $ref: '#/components/schemas/WashBay',
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
    description: 'Wash bay not found',
    content: {
        'application/json': {
            schema: {
                $ref: '#/components/schemas/ErrorResponse',
            },
        },
    },
};

const conflictResponse = {
    description: 'Wash bay code already exists in this garage',
    content: {
        'application/json': {
            schema: {
                $ref: '#/components/schemas/ErrorResponse',
            },
        },
    },
};

const washBayIdParameter = {
    in: 'path',
    name: 'id',
    required: true,
    schema: {
        type: 'string',
    },
    example: '665f1b7b2a5f9d0012a22222',
};

const garageIdParameter = {
    in: 'path',
    name: 'garageId',
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
            example: 'MB-01',
        },
    },
    {
        in: 'query',
        name: 'vehicle_type',
        schema: {
            type: 'string',
            enum: ['MOTORBIKE', 'CAR'],
            example: 'MOTORBIKE',
        },
    },
    {
        in: 'query',
        name: 'status',
        schema: {
            type: 'string',
            enum: ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'INACTIVE'],
            example: 'AVAILABLE',
        },
    },
    {
        in: 'query',
        name: 'is_active',
        schema: {
            type: 'boolean',
            example: true,
        },
    },
];

const paths = {
    '/admin/wash-bays': {
        get: {
            tags: ['WashBays'],
            summary: 'Get all wash bays',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            parameters: [
                ...paginationParameters,
                {
                    in: 'query',
                    name: 'garage_id',
                    schema: {
                        type: 'string',
                        example: '665f1b7b2a5f9d0012a11111',
                    },
                },
            ],
            responses: {
                200: {
                    description: 'Get wash bays successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/WashBayListResponse',
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
            tags: ['WashBays'],
            summary: 'Create wash bay',
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
                            $ref: '#/components/schemas/WashBayCreateRequest',
                        },
                    },
                },
            },
            responses: {
                201: {
                    description: 'Create wash bay successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/WashBayResponse',
                            },
                        },
                    },
                },
                400: validationErrorResponse,
                401: unauthorizedResponse,
                403: forbiddenResponse,
                404: {
                    description: 'Garage not found',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/ErrorResponse',
                            },
                        },
                    },
                },
                409: conflictResponse,
            },
        },
    },
    '/admin/wash-bays/{id}': {
        get: {
            tags: ['WashBays'],
            summary: 'Get wash bay by id',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            parameters: [washBayIdParameter],
            responses: {
                200: {
                    description: 'Get wash bay successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/WashBayResponse',
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
            tags: ['WashBays'],
            summary: 'Update wash bay',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            parameters: [washBayIdParameter],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/WashBayUpdateRequest',
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: 'Update wash bay successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/WashBayResponse',
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
            tags: ['WashBays'],
            summary: 'Deactivate wash bay',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            parameters: [washBayIdParameter],
            responses: {
                200: {
                    description: 'Deactivate wash bay successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/WashBayResponse',
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
    '/admin/wash-bays/{id}/status': {
        patch: {
            tags: ['WashBays'],
            summary: 'Update wash bay status',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            parameters: [washBayIdParameter],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/WashBayStatusUpdateRequest',
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: 'Update wash bay status successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/WashBayResponse',
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
    '/admin/garages/{garageId}/wash-bays': {
        get: {
            tags: ['WashBays'],
            summary: 'Get wash bays by garage',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            parameters: [garageIdParameter, ...paginationParameters],
            responses: {
                200: {
                    description: 'Get wash bays successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/WashBayListResponse',
                            },
                        },
                    },
                },
                400: validationErrorResponse,
                401: unauthorizedResponse,
                403: forbiddenResponse,
                404: {
                    description: 'Garage not found',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/ErrorResponse',
                            },
                        },
                    },
                },
            },
        },
    },
    '/admin/garages/{garageId}/available-wash-bays': {
        get: {
            tags: ['WashBays'],
            summary: 'Get available wash bays by garage',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            parameters: [
                garageIdParameter,
                {
                    in: 'query',
                    name: 'vehicle_type',
                    schema: {
                        type: 'string',
                        enum: ['MOTORBIKE', 'CAR'],
                        example: 'CAR',
                    },
                },
            ],
            responses: {
                200: {
                    description: 'Get available wash bays successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/AvailableWashBayListResponse',
                            },
                        },
                    },
                },
                400: validationErrorResponse,
                401: unauthorizedResponse,
                403: forbiddenResponse,
                404: {
                    description: 'Garage not found',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/ErrorResponse',
                            },
                        },
                    },
                },
            },
        },
    },
};

module.exports = {
    tags,
    schemas,
    paths,
};
