const tags = [
    {
        name: 'Users',
        description: 'User profile and admin user management APIs',
    },
];

const schemas = {
    UserUpdateMeRequest: {
        type: 'object',
        properties: {
            full_name: {
                type: 'string',
                example: 'Nguyen Van A',
            },
            email: {
                type: 'string',
                nullable: true,
                example: 'customer@example.com',
            },
            phone: {
                type: 'string',
                example: '0901234567',
            },
            avatar_url: {
                type: 'string',
                nullable: true,
                example: 'https://res.cloudinary.com/demo/avatar.jpg',
            },
        },
    },
    UserAdminUpdateRequest: {
        type: 'object',
        properties: {
            full_name: {
                type: 'string',
                example: 'Nguyen Van A',
            },
            email: {
                type: 'string',
                nullable: true,
                example: 'customer@example.com',
            },
            phone: {
                type: 'string',
                example: '0901234567',
            },
            avatar_url: {
                type: 'string',
                nullable: true,
                example: 'https://res.cloudinary.com/demo/avatar.jpg',
            },
            role: {
                type: 'string',
                enum: ['CUSTOMER', 'STAFF', 'ADMIN'],
                example: 'CUSTOMER',
            },
            is_active: {
                type: 'boolean',
                example: true,
            },
        },
    },
    UserStatusUpdateRequest: {
        type: 'object',
        required: ['is_active'],
        properties: {
            is_active: {
                type: 'boolean',
                example: false,
            },
        },
    },
    UserRoleUpdateRequest: {
        type: 'object',
        required: ['role'],
        properties: {
            role: {
                type: 'string',
                enum: ['CUSTOMER', 'STAFF', 'ADMIN'],
                example: 'STAFF',
            },
        },
    },
    UserResponse: {
        type: 'object',
        properties: {
            success: {
                type: 'boolean',
                example: true,
            },
            message: {
                type: 'string',
                example: 'Get user successfully',
            },
            data: {
                $ref: '#/components/schemas/UserPublic',
            },
        },
    },
    UserListResponse: {
        type: 'object',
        properties: {
            success: {
                type: 'boolean',
                example: true,
            },
            message: {
                type: 'string',
                example: 'Get users successfully',
            },
            data: {
                type: 'array',
                items: {
                    $ref: '#/components/schemas/UserPublic',
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
                        example: 100,
                    },
                    total_pages: {
                        type: 'integer',
                        example: 5,
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
    description: 'User not found',
    content: {
        'application/json': {
            schema: {
                $ref: '#/components/schemas/ErrorResponse',
            },
        },
    },
};

const conflictResponse = {
    description: 'Email or phone already exists',
    content: {
        'application/json': {
            schema: {
                $ref: '#/components/schemas/ErrorResponse',
            },
        },
    },
};

const paths = {
    '/users/me': {
        get: {
            tags: ['Users'],
            summary: 'Get current user profile',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            responses: {
                200: {
                    description: 'Get profile successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/UserResponse',
                            },
                        },
                    },
                },
                401: unauthorizedResponse,
            },
        },
        patch: {
            tags: ['Users'],
            summary: 'Update current user profile',
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
                            $ref: '#/components/schemas/UserUpdateMeRequest',
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: 'Update profile successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/UserResponse',
                            },
                        },
                    },
                },
                400: validationErrorResponse,
                401: unauthorizedResponse,
                409: conflictResponse,
            },
        },
    },
    '/users': {
        get: {
            tags: ['Users'],
            summary: 'Get all users',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            parameters: [
                {
                    in: 'query',
                    name: 'page',
                    schema: {
                        type: 'integer',
                        minimum: 1,
                        default: 1,
                    },
                },
                {
                    in: 'query',
                    name: 'limit',
                    schema: {
                        type: 'integer',
                        minimum: 1,
                        maximum: 100,
                        default: 20,
                    },
                },
                {
                    in: 'query',
                    name: 'search',
                    schema: {
                        type: 'string',
                    },
                },
                {
                    in: 'query',
                    name: 'role',
                    schema: {
                        type: 'string',
                        enum: ['CUSTOMER', 'STAFF', 'ADMIN'],
                    },
                },
                {
                    in: 'query',
                    name: 'is_active',
                    schema: {
                        type: 'boolean',
                    },
                },
            ],
            responses: {
                200: {
                    description: 'Get users successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/UserListResponse',
                            },
                        },
                    },
                },
                401: unauthorizedResponse,
                403: forbiddenResponse,
            },
        },
    },
    '/users/{id}': {
        get: {
            tags: ['Users'],
            summary: 'Get user by id',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            parameters: [
                {
                    in: 'path',
                    name: 'id',
                    required: true,
                    schema: {
                        type: 'string',
                    },
                    example: '665f1b7b2a5f9d0012a12345',
                },
            ],
            responses: {
                200: {
                    description: 'Get user successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/UserResponse',
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
            tags: ['Users'],
            summary: 'Update user by admin',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            parameters: [
                {
                    in: 'path',
                    name: 'id',
                    required: true,
                    schema: {
                        type: 'string',
                    },
                    example: '665f1b7b2a5f9d0012a12345',
                },
            ],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/UserAdminUpdateRequest',
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: 'Update user successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/UserResponse',
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
            tags: ['Users'],
            summary: 'Deactivate user by admin',
            description: 'This endpoint does not hard delete the user. It sets is_active to false.',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            parameters: [
                {
                    in: 'path',
                    name: 'id',
                    required: true,
                    schema: {
                        type: 'string',
                    },
                    example: '665f1b7b2a5f9d0012a12345',
                },
            ],
            responses: {
                200: {
                    description: 'Deactivate user successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/UserResponse',
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
    '/users/{id}/status': {
        patch: {
            tags: ['Users'],
            summary: 'Update user active status',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            parameters: [
                {
                    in: 'path',
                    name: 'id',
                    required: true,
                    schema: {
                        type: 'string',
                    },
                    example: '665f1b7b2a5f9d0012a12345',
                },
            ],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/UserStatusUpdateRequest',
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: 'Update user status successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/UserResponse',
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
    '/users/{id}/role': {
        patch: {
            tags: ['Users'],
            summary: 'Update user role',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            parameters: [
                {
                    in: 'path',
                    name: 'id',
                    required: true,
                    schema: {
                        type: 'string',
                    },
                    example: '665f1b7b2a5f9d0012a12345',
                },
            ],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/UserRoleUpdateRequest',
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: 'Update user role successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/UserResponse',
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