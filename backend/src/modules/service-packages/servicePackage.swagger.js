const tags = [
    {
        name: 'Service Packages',
        description: 'Public service package APIs',
    },
    {
        name: 'Admin Service Packages',
        description: 'Admin service package management APIs',
    },
];

const stepTemplateSchema = {
    type: 'object',
    properties: {
        step_code: {
            type: 'string',
            example: 'MAIN_WASH_PROCESS',
        },
        step_name: {
            type: 'string',
            example: 'Main wash process',
        },
        order: {
            type: 'integer',
            example: 1,
        },
        step_type: {
            type: 'string',
            enum: ['AUTOMATED_WASH_STEP', 'MANUAL_SERVICE_STEP'],
            example: 'AUTOMATED_WASH_STEP',
        },
        is_required: {
            type: 'boolean',
            example: true,
        },
        display_staff_type: {
            type: 'string',
            nullable: true,
            enum: ['CUSTOMER_SERVICE_STAFF', 'VEHICLE_INSPECTION_STAFF', 'WASH_OPERATOR', 'VEHICLE_CARE_STAFF'],
            example: 'WASH_OPERATOR',
        },
        instructions: {
            type: 'array',
            items: {
                type: 'string',
            },
            example: ['Check vehicle information', 'Run the main wash process'],
        },
    },
};

const schemas = {
    ServicePackageStepTemplate: stepTemplateSchema,
    ServicePackageCreateRequest: {
        type: 'object',
        required: ['name', 'vehicle_type', 'service_type', 'base_price'],
        properties: {
            name: {
                type: 'string',
                example: 'Premium car wash',
            },
            vehicle_type: {
                type: 'string',
                enum: ['MOTORBIKE', 'CAR'],
                example: 'CAR',
            },
            service_type: {
                type: 'string',
                enum: ['WASH', 'ADDON', 'COMBO'],
                example: 'WASH',
            },
            description: {
                type: 'string',
                nullable: true,
                example: 'Premium exterior wash service for cars',
            },
            base_price: {
                type: 'number',
                example: 150000,
            },
            duration_minutes: {
                type: 'integer',
                description: 'Required for non-combo services. Combo duration is calculated from included services.',
                example: 45,
            },
            wash_bay_duration_minutes: {
                type: 'integer',
                example: 30,
            },
            wash_bay_start_offset_minutes: {
                type: 'integer',
                example: 0,
            },
            points_earned: {
                type: 'integer',
                example: 30,
            },
            requires_wash_bay: {
                type: 'boolean',
                example: true,
            },
            requires_care_staff: {
                type: 'boolean',
                example: true,
            },
            care_staff_type: {
                type: 'string',
                nullable: true,
                enum: ['CUSTOMER_SERVICE_STAFF', 'VEHICLE_INSPECTION_STAFF', 'WASH_OPERATOR', 'VEHICLE_CARE_STAFF'],
                example: 'VEHICLE_CARE_STAFF',
            },
            care_staff_required_count: {
                type: 'integer',
                example: 1,
            },
            care_staff_duration_minutes: {
                type: 'integer',
                example: 90,
            },
            care_staff_start_offset_minutes: {
                type: 'integer',
                example: 30,
            },
            allow_duplicate_in_booking: {
                type: 'boolean',
                description: 'Deprecated for booking creation. Duplicate service items are rejected by booking flow.',
                example: false,
            },
            included_service_ids: {
                type: 'array',
                items: {
                    type: 'string',
                },
                example: [],
            },
            steps_template: {
                type: 'array',
                description: 'Operational steps for non-combo services. Combo packages use included_service_ids instead.',
                items: stepTemplateSchema,
            },
            is_active: {
                type: 'boolean',
                example: true,
            },
        },
    },
    ServicePackageUpdateRequest: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                example: 'Premium car wash',
            },
            vehicle_type: {
                type: 'string',
                enum: ['MOTORBIKE', 'CAR'],
                example: 'CAR',
            },
            service_type: {
                type: 'string',
                enum: ['WASH', 'ADDON', 'COMBO'],
                example: 'WASH',
            },
            description: {
                type: 'string',
                nullable: true,
                example: 'Updated description',
            },
            base_price: {
                type: 'number',
                example: 170000,
            },
            duration_minutes: {
                type: 'integer',
                example: 50,
            },
            wash_bay_duration_minutes: {
                type: 'integer',
                example: 30,
            },
            wash_bay_start_offset_minutes: {
                type: 'integer',
                example: 0,
            },
            points_earned: {
                type: 'integer',
                example: 35,
            },
            requires_wash_bay: {
                type: 'boolean',
                example: true,
            },
            requires_care_staff: {
                type: 'boolean',
                example: true,
            },
            care_staff_type: {
                type: 'string',
                nullable: true,
                enum: ['CUSTOMER_SERVICE_STAFF', 'VEHICLE_INSPECTION_STAFF', 'WASH_OPERATOR', 'VEHICLE_CARE_STAFF'],
                example: 'VEHICLE_CARE_STAFF',
            },
            care_staff_required_count: {
                type: 'integer',
                example: 1,
            },
            care_staff_duration_minutes: {
                type: 'integer',
                example: 90,
            },
            care_staff_start_offset_minutes: {
                type: 'integer',
                example: 30,
            },
            allow_duplicate_in_booking: {
                type: 'boolean',
                description: 'Deprecated for booking creation. Duplicate service items are rejected by booking flow.',
                example: false,
            },
            included_service_ids: {
                type: 'array',
                items: {
                    type: 'string',
                },
            },
            steps_template: {
                type: 'array',
                description: 'Operational steps for non-combo services. Combo packages use included_service_ids instead.',
                items: stepTemplateSchema,
            },
            is_active: {
                type: 'boolean',
                example: true,
            },
        },
    },
    ServicePackageStepsTemplateUpdateRequest: {
        type: 'object',
        required: ['steps_template'],
        properties: {
            steps_template: {
                type: 'array',
                description: 'Operational steps for non-combo services. Combo packages use included_service_ids instead.',
                items: stepTemplateSchema,
            },
        },
    },
    ServicePackageIncludedServicesUpdateRequest: {
        type: 'object',
        required: ['included_service_ids'],
        properties: {
            included_service_ids: {
                type: 'array',
                items: {
                    type: 'string',
                },
                example: ['665f1b7b2a5f9d0012a11111'],
            },
        },
    },
    ServicePackage: {
        type: 'object',
        properties: {
            id: {
                type: 'string',
                example: '665f1b7b2a5f9d0012a11111',
            },
            name: {
                type: 'string',
                example: 'Premium car wash',
            },
            vehicle_type: {
                type: 'string',
                example: 'CAR',
            },
            service_type: {
                type: 'string',
                example: 'WASH',
            },
            description: {
                type: 'string',
                nullable: true,
                example: 'Premium exterior wash service for cars',
            },
            base_price: {
                type: 'number',
                example: 150000,
            },
            duration_minutes: {
                type: 'integer',
                example: 45,
            },
            wash_bay_duration_minutes: {
                type: 'integer',
                example: 30,
            },
            wash_bay_start_offset_minutes: {
                type: 'integer',
                example: 0,
            },
            points_earned: {
                type: 'integer',
                example: 30,
            },
            requires_wash_bay: {
                type: 'boolean',
                example: true,
            },
            requires_care_staff: {
                type: 'boolean',
                example: true,
            },
            care_staff_type: {
                type: 'string',
                nullable: true,
                enum: ['CUSTOMER_SERVICE_STAFF', 'VEHICLE_INSPECTION_STAFF', 'WASH_OPERATOR', 'VEHICLE_CARE_STAFF'],
                example: 'VEHICLE_CARE_STAFF',
            },
            care_staff_required_count: {
                type: 'integer',
                example: 1,
            },
            care_staff_duration_minutes: {
                type: 'integer',
                example: 90,
            },
            care_staff_start_offset_minutes: {
                type: 'integer',
                example: 30,
            },
            allow_duplicate_in_booking: {
                type: 'boolean',
                description: 'Deprecated for booking creation. Duplicate service items are rejected by booking flow.',
                example: false,
            },
            included_service_ids: {
                type: 'array',
                items: {},
            },
            steps_template: {
                type: 'array',
                description: 'Operational steps for non-combo services. Combo packages use included_service_ids instead.',
                items: stepTemplateSchema,
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
    ServicePackageResponse: {
        type: 'object',
        properties: {
            success: {
                type: 'boolean',
                example: true,
            },
            message: {
                type: 'string',
                example: 'Get service package successfully',
            },
            data: {
                $ref: '#/components/schemas/ServicePackage',
            },
        },
    },
    ServicePackageListResponse: {
        type: 'object',
        properties: {
            success: {
                type: 'boolean',
                example: true,
            },
            message: {
                type: 'string',
                example: 'Get service packages successfully',
            },
            data: {
                type: 'array',
                items: {
                    $ref: '#/components/schemas/ServicePackage',
                },
            },
            meta: {
                type: 'object',
            },
        },
    },
};

const listParameters = [
    {
        in: 'query',
        name: 'page',
        schema: {
            type: 'integer',
            default: 1,
        },
    },
    {
        in: 'query',
        name: 'limit',
        schema: {
            type: 'integer',
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
        name: 'vehicle_type',
        schema: {
            type: 'string',
            enum: ['MOTORBIKE', 'CAR'],
        },
    },
    {
        in: 'query',
        name: 'service_type',
        schema: {
            type: 'string',
            enum: ['WASH', 'ADDON', 'COMBO'],
        },
    },
    {
        in: 'query',
        name: 'requires_wash_bay',
        schema: {
            type: 'boolean',
        },
    },
    {
        in: 'query',
        name: 'requires_care_staff',
        schema: {
            type: 'boolean',
        },
    },
];

const idParameter = {
    in: 'path',
    name: 'id',
    required: true,
    schema: {
        type: 'string',
    },
};

const paths = {
    '/service-packages': {
        get: {
            tags: ['Service Packages'],
            summary: 'Get active service packages',
            parameters: listParameters,
            responses: {
                200: {
                    description: 'OK',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/ServicePackageListResponse',
                            },
                        },
                    },
                },
            },
        },
    },
    '/service-packages/{id}': {
        get: {
            tags: ['Service Packages'],
            summary: 'Get active service package by id',
            parameters: [idParameter],
            responses: {
                200: {
                    description: 'OK',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/ServicePackageResponse',
                            },
                        },
                    },
                },
            },
        },
    },
    '/admin/service-packages': {
        get: {
            tags: ['Admin Service Packages'],
            summary: 'Get all service packages',
            security: [{ bearerAuth: [] }],
            parameters: [
                ...listParameters,
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
                    description: 'OK',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/ServicePackageListResponse',
                            },
                        },
                    },
                },
            },
        },
        post: {
            tags: ['Admin Service Packages'],
            summary: 'Create service package',
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/ServicePackageCreateRequest',
                        },
                    },
                },
            },
            responses: {
                201: {
                    description: 'Created',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/ServicePackageResponse',
                            },
                        },
                    },
                },
            },
        },
    },
    '/admin/service-packages/{id}': {
        get: {
            tags: ['Admin Service Packages'],
            summary: 'Get service package by id',
            security: [{ bearerAuth: [] }],
            parameters: [idParameter],
            responses: {
                200: {
                    description: 'OK',
                },
            },
        },
        patch: {
            tags: ['Admin Service Packages'],
            summary: 'Update service package',
            security: [{ bearerAuth: [] }],
            parameters: [idParameter],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/ServicePackageUpdateRequest',
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: 'OK',
                },
            },
        },
        delete: {
            tags: ['Admin Service Packages'],
            summary: 'Deactivate service package',
            security: [{ bearerAuth: [] }],
            parameters: [idParameter],
            responses: {
                200: {
                    description: 'OK',
                },
            },
        },
    },
    '/admin/service-packages/{id}/activate': {
        patch: {
            tags: ['Admin Service Packages'],
            summary: 'Activate service package',
            security: [{ bearerAuth: [] }],
            parameters: [idParameter],
            responses: {
                200: {
                    description: 'OK',
                },
            },
        },
    },
    '/admin/service-packages/{id}/deactivate': {
        patch: {
            tags: ['Admin Service Packages'],
            summary: 'Deactivate service package',
            security: [{ bearerAuth: [] }],
            parameters: [idParameter],
            responses: {
                200: {
                    description: 'OK',
                },
            },
        },
    },
    '/admin/service-packages/{id}/steps-template': {
        patch: {
            tags: ['Admin Service Packages'],
            summary: 'Update service package steps template',
            security: [{ bearerAuth: [] }],
            parameters: [idParameter],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/ServicePackageStepsTemplateUpdateRequest',
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: 'OK',
                },
            },
        },
    },
    '/admin/service-packages/{id}/included-services': {
        patch: {
            tags: ['Admin Service Packages'],
            summary: 'Update combo included services',
            security: [{ bearerAuth: [] }],
            parameters: [idParameter],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/ServicePackageIncludedServicesUpdateRequest',
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: 'OK',
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
