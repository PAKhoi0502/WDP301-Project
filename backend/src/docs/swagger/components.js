const components = {
    securitySchemes: {
        bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
        },
        refreshTokenCookie: {
            type: 'apiKey',
            in: 'cookie',
            name: 'refreshToken',
        },
        cameraDeviceCode: {
            type: 'apiKey',
            in: 'header',
            name: 'X-Camera-Device-Code',
        },
        cameraDeviceKey: {
            type: 'apiKey',
            in: 'header',
            name: 'X-Camera-Device-Key',
        },
    },
    schemas: {
        ErrorResponse: {
            type: 'object',
            properties: {
                success: {
                    type: 'boolean',
                    example: false,
                },
                message: {
                    type: 'string',
                    example: 'Validation failed',
                },
                error_code: {
                    type: 'string',
                    example: 'VALIDATION_ERROR',
                },
                errors: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            path: {
                                type: 'string',
                                example: 'phone',
                            },
                            message: {
                                type: 'string',
                                example: 'Phone is invalid',
                            },
                        },
                    },
                },
            },
        },
        SuccessResponse: {
            type: 'object',
            properties: {
                success: {
                    type: 'boolean',
                    example: true,
                },
                message: {
                    type: 'string',
                    example: 'Success',
                },
                data: {
                    nullable: true,
                },
            },
        },
    },
};

module.exports = components;
