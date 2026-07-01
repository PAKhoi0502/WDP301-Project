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
                description: 'Stored in E.164 format',
                example: '+84901234567',
            },
            phone_verified_at: {
                type: 'string',
                format: 'date-time',
                nullable: true,
                example: '2026-06-11T12:00:00.000Z',
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
            onboarding_status: {
                type: 'string',
                enum: ['ACTIVE', 'PENDING_PASSWORD_SETUP', 'PENDING_PHONE_VERIFICATION'],
                example: 'ACTIVE',
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
        required: ['phone', 'password', 'phone_verification_token'],
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
            phone_verification_token: {
                type: 'string',
                example: '96-character-verification-token',
            },
        },
    },
    PhoneVerificationRequest: {
        type: 'object',
        required: ['phone', 'purpose'],
        properties: {
            phone: {
                type: 'string',
                example: '0901234567',
            },
            purpose: {
                type: 'string',
                enum: ['REGISTER', 'CHANGE_PHONE', 'STAFF_ACTIVATION'],
                example: 'REGISTER',
            },
        },
    },
    PhoneVerificationVerifyRequest: {
        type: 'object',
        required: ['challenge_id', 'otp'],
        properties: {
            challenge_id: {
                type: 'string',
                example: '665f1b7b2a5f9d0012a12345',
            },
            otp: {
                type: 'string',
                example: '123456',
            },
        },
    },
    PhoneVerificationChallengeResponse: {
        type: 'object',
        properties: {
            success: {
                type: 'boolean',
                example: true,
            },
            message: {
                type: 'string',
                example: 'Phone verification OTP sent successfully',
            },
            data: {
                type: 'object',
                properties: {
                    challenge_id: {
                        type: 'string',
                        example: '665f1b7b2a5f9d0012a12345',
                    },
                    phone: {
                        type: 'string',
                        example: '0901234567',
                    },
                    purpose: {
                        type: 'string',
                        enum: ['REGISTER', 'CHANGE_PHONE', 'STAFF_ACTIVATION'],
                    },
                    expires_at: {
                        type: 'string',
                        format: 'date-time',
                    },
                    retry_after_seconds: {
                        type: 'integer',
                        example: 60,
                    },
                    debug_otp: {
                        type: 'string',
                        nullable: true,
                        description: 'Returned by the mock provider outside production, or in production when SHOW_DEBUG_OTP=true',
                        example: '123456',
                    },
                },
            },
        },
    },
    PhoneVerificationTokenResponse: {
        type: 'object',
        properties: {
            success: {
                type: 'boolean',
                example: true,
            },
            message: {
                type: 'string',
                example: 'Phone verified successfully',
            },
            data: {
                type: 'object',
                properties: {
                    verification_token: {
                        type: 'string',
                        example: '96-character-verification-token',
                    },
                    phone: {
                        type: 'string',
                        example: '0901234567',
                    },
                    purpose: {
                        type: 'string',
                        enum: ['REGISTER', 'CHANGE_PHONE', 'STAFF_ACTIVATION'],
                    },
                    expires_at: {
                        type: 'string',
                        format: 'date-time',
                    },
                },
            },
        },
    },
    AuthRegisterResponse: {
        type: 'object',
        properties: {
            success: {
                type: 'boolean',
                example: true,
            },
            message: {
                type: 'string',
                example: 'Register successfully',
            },
            data: {
                type: 'object',
                properties: {
                    user: {
                        $ref: '#/components/schemas/UserPublic',
                    },
                },
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
    '/auth/phone-verifications/request': {
        post: {
            tags: ['Auth'],
            summary: 'Request phone verification OTP',
            description: 'CHANGE_PHONE and STAFF_ACTIVATION require a bearer access token. REGISTER is public.',
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/PhoneVerificationRequest',
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: 'OTP sent successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/PhoneVerificationChallengeResponse',
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
                    description: 'Authentication is required for CHANGE_PHONE or STAFF_ACTIVATION',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/ErrorResponse',
                            },
                        },
                    },
                },
                409: {
                    description: 'Phone already exists',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/ErrorResponse',
                            },
                        },
                    },
                },
                429: {
                    description: 'OTP request rate limited',
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
    StaffInvitationAcceptRequest: {
        type: 'object',
        required: ['phone', 'invite_token', 'new_password'],
        properties: {
            phone: {
                type: 'string',
                example: '0901234567',
            },
            invite_token: {
                type: 'string',
                example: 'staff-invitation-token',
            },
            new_password: {
                type: 'string',
                example: 'Staff@123',
            },
        },
    },
    StaffInvitationAcceptResponse: {
        type: 'object',
        properties: {
            success: {
                type: 'boolean',
                example: true,
            },
            message: {
                type: 'string',
                example: 'Staff password setup successfully',
            },
            data: {
                type: 'object',
                properties: {
                    user: {
                        $ref: '#/components/schemas/UserPublic',
                    },
                },
            },
        },
    },
    '/auth/phone-verifications/verify': {
        post: {
            tags: ['Auth'],
            summary: 'Verify phone OTP',
            description: 'CHANGE_PHONE and STAFF_ACTIVATION require the same authenticated user that requested the OTP.',
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/PhoneVerificationVerifyRequest',
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: 'Phone verified successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/PhoneVerificationTokenResponse',
                            },
                        },
                    },
                },
                400: {
                    description: 'OTP is invalid or expired',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/ErrorResponse',
                            },
                        },
                    },
                },
                403: {
                    description: 'Verification belongs to another user',
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
                                $ref: '#/components/schemas/AuthRegisterResponse',
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
    '/auth/staff-invitations/accept': {
        post: {
            tags: ['Auth'],
            summary: 'Accept staff invitation and set initial password',
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/StaffInvitationAcceptRequest',
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: 'Staff password setup successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/StaffInvitationAcceptResponse',
                            },
                        },
                    },
                },
                400: {
                    description: 'Validation failed or invalid invitation',
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
