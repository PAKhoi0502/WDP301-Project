const tags = [
    {
        name: 'Auth',
        description: 'Authentication and account session APIs',
    },
];

const schemas = {
    UserPublic: {
        type: 'object',
        properties: {
            id: {
                type: 'string',
                example: '665f1b7b2a5f9d0012a12345',
            },
            full_name: {
                type: 'string',
                nullable: true,
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
            role: {
                type: 'string',
                enum: ['CUSTOMER', 'STAFF', 'ADMIN'],
                example: 'CUSTOMER',
            },
            avatar_url: {
                type: 'string',
                nullable: true,
                example: null,
            },
            is_active: {
                type: 'boolean',
                example: true,
            },
            last_login_at: {
                type: 'string',
                format: 'date-time',
                nullable: true,
                example: '2026-06-02T12:00:00.000Z',
            },
            created_at: {
                type: 'string',
                format: 'date-time',
                example: '2026-06-02T12:00:00.000Z',
            },
            updated_at: {
                type: 'string',
                format: 'date-time',
                example: '2026-06-02T12:00:00.000Z',
            },
        },
    },
    AuthRegisterRequest: {
        type: 'object',
        required: ['phone', 'password'],
        properties: {
            phone: {
                type: 'string',
                example: '0901234567',
            },
            password: {
                type: 'string',
                example: '123456',
            },
            email: {
                type: 'string',
                example: 'customer@example.com',
            },
            full_name: {
                type: 'string',
                example: 'Nguyen Van A',
            },
        },
    },
    AuthLoginRequest: {
        type: 'object',
        required: ['phone', 'password'],
        properties: {
            phone: {
                type: 'string',
                example: '0901234567',
            },
            password: {
                type: 'string',
                example: '123456',
            },
        },
    },
    ChangePasswordRequest: {
        type: 'object',
        required: ['current_password', 'new_password'],
        properties: {
            current_password: {
                type: 'string',
                example: '123456',
            },
            new_password: {
                type: 'string',
                example: '654321',
            },
        },
    },
    ForgotPasswordRequest: {
        type: 'object',
        required: ['phone'],
        properties: {
            phone: {
                type: 'string',
                example: '0901234567',
            },
        },
    },
    ResetPasswordRequest: {
        type: 'object',
        required: ['phone', 'reset_token', 'new_password'],
        properties: {
            phone: {
                type: 'string',
                example: '0901234567',
            },
            reset_token: {
                type: 'string',
                example: 'a3f9d7e6c5b4a3210f9e8d7c6b5a4321',
            },
            new_password: {
                type: 'string',
                example: '654321',
            },
        },
    },
    AuthTokenResponse: {
        type: 'object',
        properties: {
            success: {
                type: 'boolean',
                example: true,
            },
            message: {
                type: 'string',
                example: 'Login successfully',
            },
            data: {
                type: 'object',
                properties: {
                    access_token: {
                        type: 'string',
                        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                    },
                    user: {
                        $ref: '#/components/schemas/UserPublic',
                    },
                },
            },
        },
    },
    AuthUserResponse: {
        type: 'object',
        properties: {
            success: {
                type: 'boolean',
                example: true,
            },
            message: {
                type: 'string',
                example: 'Get current user successfully',
            },
            data: {
                $ref: '#/components/schemas/UserPublic',
            },
        },
    },
    AuthMessageResponse: {
        type: 'object',
        properties: {
            success: {
                type: 'boolean',
                example: true,
            },
            message: {
                type: 'string',
                example: 'Logout successfully',
            },
            data: {
                nullable: true,
                example: null,
            },
        },
    },
};

const paths = {
    '/auth/register': {
        post: {
            tags: ['Auth'],
            summary: 'Register customer account',
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/AuthRegisterRequest',
                        },
                    },
                },
            },
            responses: {
                201: {
                    description: 'Register successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/AuthUserResponse',
                            },
                        },
                    },
                },
                400: {
                    description: 'Validation failed',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/ErrorResponse',
                            },
                        },
                    },
                },
                409: {
                    description: 'Phone or email already exists',
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
    '/auth/login': {
        post: {
            tags: ['Auth'],
            summary: 'Login by phone and password',
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/AuthLoginRequest',
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: 'Login successfully',
                    headers: {
                        'Set-Cookie': {
                            schema: {
                                type: 'string',
                                example: 'refreshToken=token; HttpOnly; Path=/; SameSite=Lax',
                            },
                        },
                    },
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/AuthTokenResponse',
                            },
                        },
                    },
                },
                400: {
                    description: 'Validation failed',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/ErrorResponse',
                            },
                        },
                    },
                },
                401: {
                    description: 'Invalid credentials',
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
    '/auth/refresh': {
        post: {
            tags: ['Auth'],
            summary: 'Refresh access token',
            security: [
                {
                    refreshTokenCookie: [],
                },
            ],
            responses: {
                200: {
                    description: 'Refresh token successfully',
                    headers: {
                        'Set-Cookie': {
                            schema: {
                                type: 'string',
                                example: 'refreshToken=token; HttpOnly; Path=/; SameSite=Lax',
                            },
                        },
                    },
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/AuthTokenResponse',
                            },
                        },
                    },
                },
                401: {
                    description: 'Refresh token is missing or invalid',
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
    '/auth/logout': {
        post: {
            tags: ['Auth'],
            summary: 'Logout current session',
            security: [
                {
                    refreshTokenCookie: [],
                },
            ],
            responses: {
                200: {
                    description: 'Logout successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/AuthMessageResponse',
                            },
                        },
                    },
                },
            },
        },
    },
    '/auth/logout-all': {
        post: {
            tags: ['Auth'],
            summary: 'Logout all devices',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            responses: {
                200: {
                    description: 'Logout all devices successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/AuthMessageResponse',
                            },
                        },
                    },
                },
                401: {
                    description: 'Unauthorized',
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
    '/auth/me': {
        get: {
            tags: ['Auth'],
            summary: 'Get current user',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            responses: {
                200: {
                    description: 'Get current user successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/AuthUserResponse',
                            },
                        },
                    },
                },
                401: {
                    description: 'Unauthorized',
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
    '/auth/change-password': {
        post: {
            tags: ['Auth'],
            summary: 'Change current user password',
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
                            $ref: '#/components/schemas/ChangePasswordRequest',
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: 'Change password successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/AuthMessageResponse',
                            },
                        },
                    },
                },
                400: {
                    description: 'Validation failed',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/ErrorResponse',
                            },
                        },
                    },
                },
                401: {
                    description: 'Unauthorized',
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
    '/auth/forgot-password': {
        post: {
            tags: ['Auth'],
            summary: 'Request password reset token',
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/ForgotPasswordRequest',
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: 'Password reset request processed',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/SuccessResponse',
                            },
                        },
                    },
                },
                400: {
                    description: 'Validation failed',
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
    '/auth/reset-password': {
        post: {
            tags: ['Auth'],
            summary: 'Reset password by reset token',
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/ResetPasswordRequest',
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: 'Reset password successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/AuthMessageResponse',
                            },
                        },
                    },
                },
                400: {
                    description: 'Validation failed or invalid reset token',
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