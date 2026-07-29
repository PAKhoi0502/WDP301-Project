const {
    STAFF_TYPE_VALUES,
    STAFF_GROUPS,
    STAFF_CAPABILITY_VALUES,
} = require('../../shared/constants/staff.constant');

const tags = [
    {
        name: 'Staff Profiles',
        description: 'Staff profile management APIs',
    },
];

const staffTypeValues = STAFF_TYPE_VALUES;
const staffGroupValues = Object.values(STAFF_GROUPS);

const employmentStatusValues = ['ACTIVE', 'SUSPENDED', 'TERMINATED'];

const schemas = {
    StaffCapabilityKey: {
        type: 'string',
        enum: STAFF_CAPABILITY_VALUES,
        example: 'booking.read_garage',
    },
    StaffCapabilityContext: {
        type: 'object',
        required: [
            'is_admin',
            'user_id',
            'staff_profile_id',
            'staff_type',
            'staff_group',
            'garage_id',
            'capabilities',
        ],
        properties: {
            is_admin: {
                type: 'boolean',
                example: false,
            },
            user_id: {
                type: 'string',
                example: '665f1b7b2a5f9d0012a12345',
            },
            staff_profile_id: {
                type: 'string',
                example: '665f1b7b2a5f9d0012a11111',
            },
            staff_type: {
                type: 'string',
                enum: staffTypeValues,
                example: 'CUSTOMER_SERVICE_STAFF',
            },
            staff_group: {
                type: 'string',
                enum: staffGroupValues,
                example: 'BOOKING_OPERATIONS',
            },
            garage_id: {
                type: 'string',
                nullable: true,
                example: '665f1b7b2a5f9d0012a54321',
            },
            capabilities: {
                type: 'array',
                uniqueItems: true,
                items: {
                    $ref: '#/components/schemas/StaffCapabilityKey',
                },
            },
        },
    },
    StaffCapabilitiesResponse: {
        type: 'object',
        required: ['success', 'message', 'data'],
        properties: {
            success: {
                type: 'boolean',
                example: true,
            },
            message: {
                type: 'string',
                example: 'Get my staff capabilities successfully',
            },
            data: {
                $ref: '#/components/schemas/StaffCapabilityContext',
            },
        },
    },
    StaffProfileCreateRequest: {
        type: 'object',
        required: ['user_id', 'staff_code', 'staff_type'],
        properties: {
            user_id: {
                type: 'string',
                example: '665f1b7b2a5f9d0012a12345',
            },
            staff_code: {
                type: 'string',
                example: 'STF001',
            },
            staff_type: {
                type: 'string',
                enum: staffTypeValues,
                example: 'CUSTOMER_SERVICE_STAFF',
            },
            garage_id: {
                type: 'string',
                nullable: true,
                example: '665f1b7b2a5f9d0012a54321',
            },
        },
    },
    StaffProfileUpdateRequest: {
        type: 'object',
        properties: {
            staff_code: {
                type: 'string',
                example: 'STF001',
            },
            garage_id: {
                type: 'string',
                nullable: true,
                example: '665f1b7b2a5f9d0012a54321',
            },
        },
    },
    StaffProfileStatusUpdateRequest: {
        type: 'object',
        required: ['is_active'],
        properties: {
            is_active: {
                type: 'boolean',
                example: false,
            },
            reason: {
                type: 'string',
                maxLength: 500,
                example: 'Nhan vien bi dinh chi',
            },
        },
    },
    StaffEmploymentStatusUpdateRequest: {
        type: 'object',
        required: ['status'],
        properties: {
            status: {
                type: 'string',
                enum: employmentStatusValues,
                example: 'TERMINATED',
            },
            reason: {
                type: 'string',
                maxLength: 500,
                example: 'Nhan vien nghi viec',
            },
        },
    },
    StaffInvitationCreateRequest: {
        type: 'object',
        required: ['full_name', 'email', 'phone', 'staff_code', 'staff_type', 'garage_id'],
        properties: {
            full_name: {
                type: 'string',
                example: 'Nguyen Van Staff',
            },
            email: {
                type: 'string',
                example: 'staff@example.com',
            },
            phone: {
                type: 'string',
                example: '0901234567',
            },
            staff_code: {
                type: 'string',
                example: 'STF100',
            },
            staff_type: {
                type: 'string',
                enum: staffTypeValues,
                example: 'CUSTOMER_SERVICE_STAFF',
            },
            staff_group: {
                type: 'string',
                enum: staffGroupValues,
                example: 'BOOKING_OPERATIONS',
            },
            capabilities: {
                type: 'array',
                items: {
                    $ref: '#/components/schemas/StaffCapabilityKey',
                },
                example: ['booking.read_garage', 'booking.check_in'],
            },
            garage_id: {
                type: 'string',
                example: '665f1b7b2a5f9d0012a54321',
            },
        },
    },
    StaffProfilePublic: {
        type: 'object',
        properties: {
            id: {
                type: 'string',
                example: '665f1b7b2a5f9d0012a11111',
            },
            user_id: {
                type: 'string',
                example: '665f1b7b2a5f9d0012a12345',
            },
            user: {
                nullable: true,
                allOf: [
                    {
                        $ref: '#/components/schemas/UserPublic',
                    },
                ],
            },
            staff_code: {
                type: 'string',
                example: 'STF001',
            },
            staff_type: {
                type: 'string',
                enum: staffTypeValues,
                example: 'CUSTOMER_SERVICE_STAFF',
            },
            garage_id: {
                type: 'string',
                nullable: true,
                example: '665f1b7b2a5f9d0012a54321',
            },
            is_active: {
                type: 'boolean',
                example: true,
            },
            employment_status: {
                type: 'string',
                enum: employmentStatusValues,
                example: 'ACTIVE',
            },
            status_reason: {
                type: 'string',
                nullable: true,
                example: 'Nhan vien bi dinh chi',
            },
            suspended_at: {
                type: 'string',
                format: 'date-time',
                nullable: true,
            },
            terminated_at: {
                type: 'string',
                format: 'date-time',
                nullable: true,
            },
            status_changed_at: {
                type: 'string',
                format: 'date-time',
                nullable: true,
            },
            status_changed_by: {
                type: 'string',
                nullable: true,
                example: '665f1b7b2a5f9d0012a99999',
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
    StaffProfileResponse: {
        type: 'object',
        properties: {
            success: {
                type: 'boolean',
                example: true,
            },
            message: {
                type: 'string',
                example: 'Get staff profile successfully',
            },
            data: {
                $ref: '#/components/schemas/StaffProfilePublic',
            },
        },
    },
    StaffProfileListResponse: {
        type: 'object',
        properties: {
            success: {
                type: 'boolean',
                example: true,
            },
            message: {
                type: 'string',
                example: 'Get staff profiles successfully',
            },
            data: {
                type: 'array',
                items: {
                    $ref: '#/components/schemas/StaffProfilePublic',
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
    StaffInvitationResponse: {
        type: 'object',
        properties: {
            success: {
                type: 'boolean',
                example: true,
            },
            message: {
                type: 'string',
                example: 'Invite staff successfully',
            },
            data: {
                type: 'object',
                properties: {
                    staff_profile: {
                        $ref: '#/components/schemas/StaffProfilePublic',
                    },
                    invite: {
                        type: 'object',
                        properties: {
                            expires_at: {
                                type: 'string',
                                format: 'date-time',
                            },
                            email_status: {
                                type: 'string',
                                nullable: true,
                                example: 'SENT',
                            },
                            invite_token: {
                                type: 'string',
                                nullable: true,
                                description: 'Only returned outside production',
                                example: 'staff-invitation-token',
                            },
                        },
                    },
                },
            },
        },
    },
    StaffTypeChangeCreateRequest: {
        type: 'object',
        required: ['to_staff_type', 'reason'],
        properties: {
            to_staff_type: { type: 'string', enum: staffTypeValues },
            reason: { type: 'string', minLength: 5, maxLength: 1000 },
            effective_at: { type: 'string', format: 'date-time' },
            handover_note: { type: 'string', maxLength: 2000 },
        },
    },
    StaffTypeChangeRequest: {
        type: 'object',
        properties: {
            id: { type: 'string' },
            staff_profile_id: { type: 'string' },
            from_staff_type: { type: 'string', enum: staffTypeValues },
            to_staff_type: { type: 'string', enum: staffTypeValues },
            reason: { type: 'string' },
            effective_at: { type: 'string', format: 'date-time' },
            status: {
                type: 'string',
                enum: ['REQUESTED', 'APPROVED', 'SCHEDULED', 'APPLIED', 'REJECTED', 'CANCELLED', 'FAILED'],
            },
            request_source: {
                type: 'string',
                enum: ['STAFF_SELF_REQUEST', 'ADMIN_DIRECTED'],
            },
            requested_by: { type: 'string' },
            requested_by_role: { type: 'string', enum: ['STAFF', 'ADMIN'] },
            approved_at: { type: 'string', format: 'date-time', nullable: true },
            applied_at: { type: 'string', format: 'date-time', nullable: true },
            handover_note: { type: 'string', nullable: true },
            impact_snapshot: { type: 'object', nullable: true, additionalProperties: true },
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
    description: 'Staff profile not found',
    content: {
        'application/json': {
            schema: {
                $ref: '#/components/schemas/ErrorResponse',
            },
        },
    },
};

const conflictResponse = {
    description: 'Staff profile user or staff code already exists',
    content: {
        'application/json': {
            schema: {
                $ref: '#/components/schemas/ErrorResponse',
            },
        },
    },
};

const staffProfileIdParameter = {
    in: 'path',
    name: 'id',
    required: true,
    schema: {
        type: 'string',
    },
    example: '665f1b7b2a5f9d0012a11111',
};

const staffTypeChangeRequestIdParameter = {
    in: 'path',
    name: 'requestId',
    required: true,
    schema: { type: 'string' },
};

const staffTypeChangeResponse = {
    description: 'Staff type change request',
    content: {
        'application/json': {
            schema: {
                type: 'object',
                properties: {
                    success: { type: 'boolean' },
                    message: { type: 'string' },
                    data: { $ref: '#/components/schemas/StaffTypeChangeRequest' },
                },
            },
        },
    },
};

const paths = {
    '/staff-profiles/me/capabilities': {
        get: {
            tags: ['Staff Profiles'],
            summary: 'Get current staff workspace and capabilities',
            security: [{ bearerAuth: [] }],
            responses: {
                200: {
                    description: 'Get staff capabilities successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/StaffCapabilitiesResponse',
                            },
                        },
                    },
                },
                401: unauthorizedResponse,
                403: forbiddenResponse,
            },
        },
    },
    '/staff-profiles/me/type-change-requests': {
        get: {
            tags: ['Staff Profiles'],
            summary: 'Get current staff type change requests',
            security: [{ bearerAuth: [] }],
            responses: { 200: { description: 'Request list' }, 401: unauthorizedResponse, 403: forbiddenResponse },
        },
        post: {
            tags: ['Staff Profiles'],
            summary: 'Request a staff position change',
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/StaffTypeChangeCreateRequest' },
                    },
                },
            },
            responses: { 201: staffTypeChangeResponse, 400: validationErrorResponse, 409: conflictResponse },
        },
    },
    '/staff-profiles/type-change-requests': {
        get: {
            tags: ['Staff Profiles'],
            summary: 'List staff type change requests (admin)',
            security: [{ bearerAuth: [] }],
            parameters: [
                { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
                { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } },
                { in: 'query', name: 'staff_profile_id', schema: { type: 'string' } },
                { in: 'query', name: 'status', schema: { type: 'string', enum: ['REQUESTED', 'APPROVED', 'SCHEDULED', 'APPLIED', 'REJECTED', 'CANCELLED', 'FAILED'] } },
                { in: 'query', name: 'request_source', schema: { type: 'string', enum: ['STAFF_SELF_REQUEST', 'ADMIN_DIRECTED'] } },
            ],
            responses: { 200: { description: 'Request list' }, 401: unauthorizedResponse, 403: forbiddenResponse },
        },
    },
    '/staff-profiles/type-change-requests/{requestId}/approve': {
        patch: {
            tags: ['Staff Profiles'],
            summary: 'Approve or schedule a staff type change (admin)',
            security: [{ bearerAuth: [] }],
            parameters: [staffTypeChangeRequestIdParameter],
            responses: { 200: staffTypeChangeResponse, 409: conflictResponse },
        },
    },
    '/staff-profiles/type-change-requests/{requestId}/reject': {
        patch: {
            tags: ['Staff Profiles'],
            summary: 'Reject a staff type change (admin)',
            security: [{ bearerAuth: [] }],
            parameters: [staffTypeChangeRequestIdParameter],
            responses: { 200: staffTypeChangeResponse, 409: conflictResponse },
        },
    },
    '/staff-profiles/type-change-requests/{requestId}/cancel': {
        patch: {
            tags: ['Staff Profiles'],
            summary: 'Cancel a staff type change',
            security: [{ bearerAuth: [] }],
            parameters: [staffTypeChangeRequestIdParameter],
            responses: { 200: staffTypeChangeResponse, 403: forbiddenResponse, 409: conflictResponse },
        },
    },
    '/staff-profiles/{id}/type-change-impact': {
        get: {
            tags: ['Staff Profiles'],
            summary: 'Preview staff type change impact (admin)',
            security: [{ bearerAuth: [] }],
            parameters: [
                staffProfileIdParameter,
                { in: 'query', name: 'to_staff_type', required: true, schema: { type: 'string', enum: staffTypeValues } },
                { in: 'query', name: 'effective_at', schema: { type: 'string', format: 'date-time' } },
            ],
            responses: { 200: { description: 'Impact preview' }, 404: notFoundResponse },
        },
    },
    '/staff-profiles/{id}/type-change-requests': {
        post: {
            tags: ['Staff Profiles'],
            summary: 'Initiate a staff position change (admin)',
            description: 'Creates an ADMIN_DIRECTED request in REQUESTED state and stores an initial impact snapshot. handover_note is required when active or future assignments exist. The request must still pass the existing approve or schedule workflow; this endpoint never updates staff_type directly.',
            security: [{ bearerAuth: [] }],
            parameters: [staffProfileIdParameter],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/StaffTypeChangeCreateRequest' },
                    },
                },
            },
            responses: {
                201: staffTypeChangeResponse,
                400: validationErrorResponse,
                401: unauthorizedResponse,
                403: forbiddenResponse,
                404: notFoundResponse,
                409: conflictResponse,
            },
        },
    },
    '/staff-profiles/{id}/type-change-history': {
        get: {
            tags: ['Staff Profiles'],
            summary: 'Get applied staff type change history (admin)',
            security: [{ bearerAuth: [] }],
            parameters: [staffProfileIdParameter],
            responses: { 200: { description: 'Applied change history' }, 404: notFoundResponse },
        },
    },
    '/staff-profiles/me': {
        get: {
            tags: ['Staff Profiles'],
            summary: 'Get current staff profile',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            responses: {
                200: {
                    description: 'Get my staff profile successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/StaffProfileResponse',
                            },
                        },
                    },
                },
                401: unauthorizedResponse,
                403: forbiddenResponse,
                404: notFoundResponse,
            },
        },
    },
    '/staff-profiles': {
        get: {
            tags: ['Staff Profiles'],
            summary: 'Get staff profiles',
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
                    description: 'Search by staff code, full name, email, or phone',
                },
                {
                    in: 'query',
                    name: 'staff_type',
                    schema: {
                        type: 'string',
                        enum: staffTypeValues,
                    },
                },
                {
                    in: 'query',
                    name: 'garage_id',
                    schema: {
                        type: 'string',
                    },
                },
                {
                    in: 'query',
                    name: 'user_id',
                    schema: {
                        type: 'string',
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
                    description: 'Get staff profiles successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/StaffProfileListResponse',
                            },
                        },
                    },
                },
                401: unauthorizedResponse,
                403: forbiddenResponse,
            },
        },
        post: {
            tags: ['Staff Profiles'],
            summary: 'Create staff profile',
            description: 'Legacy endpoint for an existing STAFF user who has already completed onboarding and phone verification. New staff accounts must use POST /staff-profiles/invitations.',
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
                            $ref: '#/components/schemas/StaffProfileCreateRequest',
                        },
                    },
                },
            },
            responses: {
                201: {
                    description: 'Create staff profile successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/StaffProfileResponse',
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
    '/staff-profiles/invitations': {
        post: {
            tags: ['Staff Profiles'],
            summary: 'Invite a new staff account',
            description: 'Creates a STAFF user with pending onboarding, creates an inactive staff profile, and emails a 24-hour password setup invitation.',
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
                            $ref: '#/components/schemas/StaffInvitationCreateRequest',
                        },
                    },
                },
            },
            responses: {
                201: {
                    description: 'Invite staff successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/StaffInvitationResponse',
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
    '/staff-profiles/{id}/invitations/resend': {
        post: {
            tags: ['Staff Profiles'],
            summary: 'Resend staff invitation',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            parameters: [staffProfileIdParameter],
            responses: {
                200: {
                    description: 'Resend staff invitation successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/StaffInvitationResponse',
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
    '/staff-profiles/{id}': {
        get: {
            tags: ['Staff Profiles'],
            summary: 'Get staff profile by id',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            parameters: [staffProfileIdParameter],
            responses: {
                200: {
                    description: 'Get staff profile successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/StaffProfileResponse',
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
            tags: ['Staff Profiles'],
            summary: 'Update staff profile',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            parameters: [staffProfileIdParameter],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/StaffProfileUpdateRequest',
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: 'Update staff profile successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/StaffProfileResponse',
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
            tags: ['Staff Profiles'],
            summary: 'Terminate staff profile',
            description: 'This endpoint does not hard delete the staff profile. It marks employment_status as TERMINATED, disables the linked user and revokes refresh tokens.',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            parameters: [staffProfileIdParameter],
            responses: {
                200: {
                    description: 'Terminate staff profile successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/StaffProfileResponse',
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
    },
    '/staff-profiles/{id}/employment-status': {
        patch: {
            tags: ['Staff Profiles'],
            summary: 'Update staff employment status',
            description: 'Use ACTIVE to reactivate a suspended staff profile, SUSPENDED to temporarily block work access, and TERMINATED when the staff member leaves. TERMINATED cannot be activated by the legacy status API.',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            parameters: [staffProfileIdParameter],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/StaffEmploymentStatusUpdateRequest',
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: 'Update staff employment status successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/StaffProfileResponse',
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
    },
    '/staff-profiles/{id}/status': {
        patch: {
            tags: ['Staff Profiles'],
            summary: 'Update staff profile active status',
            description: 'Compatibility endpoint. false maps to SUSPENDED, true maps to ACTIVE. Activation requires onboarding_status ACTIVE and a verified phone, and cannot reactivate TERMINATED staff.',
            security: [
                {
                    bearerAuth: [],
                },
            ],
            parameters: [staffProfileIdParameter],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/StaffProfileStatusUpdateRequest',
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: 'Update staff profile status successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/StaffProfileResponse',
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
    },
};

module.exports = {
    tags,
    schemas,
    paths,
};
