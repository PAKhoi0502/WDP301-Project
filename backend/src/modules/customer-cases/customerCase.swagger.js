const tags = [{
    name: 'Customer Cases',
    description: 'Vehicle handover and customer after-service issue case management',
}];

const bookingIdParameter = {
    name: 'id',
    in: 'path',
    required: true,
    schema: { type: 'string' },
};

const caseIdParameter = {
    name: 'id',
    in: 'path',
    required: true,
    schema: { type: 'string' },
};

const handoverOperationRequest = {
    type: 'object',
    properties: { note: { type: 'string', maxLength: 1000 } },
};

const evidenceIds = {
    type: 'array',
    maxItems: 10,
    uniqueItems: true,
    items: { type: 'string' },
};

const createCaseRequest = {
    type: 'object',
    required: ['category', 'description'],
    properties: {
        category: {
            type: 'string',
            enum: [
                'VEHICLE_DAMAGE', 'MISSING_PROPERTY', 'SERVICE_QUALITY',
                'SERVICE_INCOMPLETE', 'BILLING_PAYMENT', 'STAFF_CONDUCT',
                'SAFETY_CONCERN', 'OTHER',
            ],
        },
        description: { type: 'string', minLength: 10, maxLength: 2000 },
        damage_location: { type: 'string', maxLength: 500 },
        desired_resolution: { type: 'string', maxLength: 1000 },
        discovered_at: { type: 'string', format: 'date-time' },
        vehicle_received: { type: 'boolean', default: false },
        upload_ids: evidenceIds,
    },
};

const bookingHandoverSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        booking_id: { type: 'string' },
        garage_id: { type: 'string' },
        customer_id: { type: 'string', nullable: true },
        vehicle_id: { type: 'string', nullable: true },
        guest_name: { type: 'string', nullable: true },
        guest_phone: { type: 'string', nullable: true },
        state: { type: 'string', enum: ['PENDING', 'READY_FOR_CUSTOMER', 'ON_HOLD', 'RELEASED'] },
        customer_response: { type: 'string', enum: ['PENDING', 'ACCEPTED', 'ISSUE_REPORTED'] },
        customer_response_source: {
            type: 'string',
            enum: ['CUSTOMER_SELF_SERVICE', 'STAFF_ASSISTED'],
            nullable: true,
        },
        customer_response_recorded_by_id: { type: 'string', nullable: true },
        customer_response_note: { type: 'string', nullable: true },
        ready_at: { type: 'string', format: 'date-time', nullable: true },
        ready_by_id: { type: 'string', nullable: true },
        ready_note: { type: 'string', nullable: true },
        customer_responded_at: { type: 'string', format: 'date-time', nullable: true },
        accepted_at: { type: 'string', format: 'date-time', nullable: true },
        released_at: { type: 'string', format: 'date-time', nullable: true },
        released_by_id: { type: 'string', nullable: true },
        release_note: { type: 'string', nullable: true },
        issue_case_ids: { type: 'array', items: { type: 'string' } },
        inspection_snapshot: { type: 'object' },
    },
};

const customerCaseSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        case_code: { type: 'string', example: 'CC-20260718-A1B2C3D4' },
        booking_id: { type: 'string' },
        handover_id: { type: 'string' },
        garage_id: { type: 'string' },
        customer_id: { type: 'string', nullable: true },
        vehicle_id: { type: 'string', nullable: true },
        is_walk_in_case: { type: 'boolean' },
        reporter_name: { type: 'string', nullable: true },
        reporter_phone: { type: 'string', nullable: true },
        created_by_staff_id: { type: 'string', nullable: true },
        category: { type: 'string' },
        priority: { type: 'string', enum: ['NORMAL', 'HIGH', 'CRITICAL'] },
        source: { type: 'string', enum: ['HANDOVER', 'AFTER_HANDOVER'] },
        status: { type: 'string', enum: ['SUBMITTED', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'CLOSED'] },
        description: { type: 'string' },
        damage_location: { type: 'string', nullable: true },
        desired_resolution: { type: 'string', nullable: true },
        evidence: { type: 'array', items: { type: 'object' } },
        booking_snapshot: { type: 'object' },
        inspection_snapshot: { type: 'object' },
        assigned_to_id: { type: 'string', nullable: true },
        first_response_due_at: { type: 'string', format: 'date-time' },
        resolution_due_at: { type: 'string', format: 'date-time' },
        first_response_breached_at: { type: 'string', format: 'date-time', nullable: true },
        resolution_breached_at: { type: 'string', format: 'date-time', nullable: true },
        escalation_level: { type: 'integer' },
        reopen_count: { type: 'integer' },
        liability_status: {
            type: 'string',
            enum: ['UNDETERMINED', 'GARAGE_RESPONSIBLE', 'PRE_EXISTING_DAMAGE', 'CUSTOMER_OR_THIRD_PARTY', 'INCONCLUSIVE'],
        },
        conclusion: { type: 'string', nullable: true },
        resolution_summary: { type: 'string', nullable: true },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
    },
};

const technicalAssessmentSchema = {
    type: 'object',
    nullable: true,
    properties: {
        id: { type: 'string' },
        case_id: { type: 'string' },
        inspector_staff_profile_id: { type: 'string' },
        inspector_user_id: { type: 'string' },
        status: { type: 'string', enum: ['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED'] },
        findings: { type: 'string', nullable: true },
        root_cause: { type: 'string', nullable: true },
        severity: { type: 'string', enum: ['MINOR', 'MODERATE', 'MAJOR', 'SAFETY_CRITICAL'], nullable: true },
        recommended_resolution: { type: 'string', nullable: true },
        evidence: { type: 'array', items: { type: 'object' } },
    },
};

const resolutionActionSchema = {
    type: 'object',
    required: ['action_type'],
    properties: {
        action_type: {
            type: 'string',
            enum: ['REFUND', 'VOUCHER', 'REWORK', 'WAIVE_CHARGE', 'NO_COMPENSATION'],
        },
        amount: { type: 'number', exclusiveMinimum: 0 },
        refund_method: {
            type: 'string',
            enum: ['ORIGINAL_PAYMENT', 'CASH', 'BANK_TRANSFER'],
        },
        voucher_type: { type: 'string' },
        value: { type: 'number', minimum: 0 },
        max_discount_amount: { type: 'number', exclusiveMinimum: 0 },
        min_order_amount: { type: 'number', minimum: 0 },
        service_package_id: { type: 'string' },
        expires_at: { type: 'string', format: 'date-time' },
        rework_start_time: { type: 'string', format: 'date-time' },
        note: { type: 'string', maxLength: 1000 },
    },
};

const resolutionSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        case_id: { type: 'string' },
        version: { type: 'integer' },
        status: { type: 'string', enum: ['PROPOSED', 'CUSTOMER_ACCEPTED', 'CUSTOMER_REJECTED', 'APPLIED', 'FAILED', 'SUPERSEDED'] },
        summary: { type: 'string' },
        actions: { type: 'array', items: resolutionActionSchema },
        refund_ids: { type: 'array', items: { type: 'string' } },
        voucher_ids: { type: 'array', items: { type: 'string' } },
        rework_booking_ids: { type: 'array', items: { type: 'string' } },
    },
};

const refundSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        case_id: { type: 'string' },
        resolution_id: { type: 'string' },
        booking_id: { type: 'string' },
        amount: { type: 'number' },
        method: { type: 'string', enum: ['ORIGINAL_PAYMENT', 'CASH', 'BANK_TRANSFER'] },
        status: { type: 'string', enum: ['APPROVED', 'PROCESSING', 'COMPLETED', 'FAILED'] },
        transaction_reference: { type: 'string', nullable: true },
    },
};

const caseDetailSchema = {
    type: 'object',
    properties: {
        case: { $ref: '#/components/schemas/CustomerCase' },
        messages: { type: 'array', items: { type: 'object' } },
        timeline: { type: 'array', items: { type: 'object' } },
        technical_assessment: { $ref: '#/components/schemas/CustomerCaseTechnicalAssessment' },
        resolutions: { type: 'array', items: { $ref: '#/components/schemas/CustomerCaseResolution' } },
        refunds: { type: 'array', items: { $ref: '#/components/schemas/CustomerCaseRefund' } },
    },
};

const successResponse = (description, schema) => ({
    description,
    content: {
        'application/json': {
            schema: {
                type: 'object',
                properties: {
                    success: { type: 'boolean' },
                    message: { type: 'string' },
                    data: schema,
                },
            },
        },
    },
});

const requestBody = (schema) => ({
    required: true,
    content: { 'application/json': { schema } },
});

const listParameters = [
    { name: 'status', in: 'query', schema: { type: 'string' } },
    { name: 'category', in: 'query', schema: { type: 'string' } },
    { name: 'priority', in: 'query', schema: { type: 'string', enum: ['NORMAL', 'HIGH', 'CRITICAL'] } },
    { name: 'booking_id', in: 'query', schema: { type: 'string' } },
    { name: 'case_code', in: 'query', schema: { type: 'string', example: 'CC-20260718-A1B2C3D4' } },
    { name: 'assigned_to_id', in: 'query', schema: { type: 'string' } },
    { name: 'garage_id', in: 'query', schema: { type: 'string' } },
    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
    { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
];

const paths = {
    '/bookings/{id}/handover': {
        get: {
            tags: ['Customer Cases'],
            summary: 'Get my booking handover and inspection snapshot',
            parameters: [bookingIdParameter],
            responses: { 200: successResponse('Handover returned', { $ref: '#/components/schemas/BookingHandover' }) },
        },
    },
    '/bookings/{id}/handover/accept': {
        post: {
            tags: ['Customer Cases'],
            summary: 'Accept vehicle condition before payment',
            description: 'Records ACCEPTED and keeps the handover READY_FOR_CUSTOMER. It does not release the vehicle.',
            parameters: [bookingIdParameter],
            requestBody: requestBody(handoverOperationRequest),
            responses: { 200: successResponse('Handover accepted', { $ref: '#/components/schemas/BookingHandover' }) },
        },
    },
    '/bookings/{id}/handover/report': {
        post: {
            tags: ['Customer Cases'],
            summary: 'Report an issue during or after vehicle handover',
            description: 'Upload evidence first with purpose CUSTOMER_CASE_EVIDENCE, then provide the returned upload ids.',
            parameters: [bookingIdParameter],
            requestBody: requestBody(createCaseRequest),
            responses: { 201: successResponse('Customer case created', caseDetailSchema) },
        },
    },
    '/admin/bookings/{id}/handover/ready': {
        patch: {
            tags: ['Customer Cases'],
            summary: 'Prepare a completed booking for customer handover',
            description: 'Requires both BEFORE_WASH and AFTER_WASH inspections.',
            parameters: [bookingIdParameter],
            requestBody: requestBody(handoverOperationRequest),
            responses: { 200: successResponse('Handover prepared', { $ref: '#/components/schemas/BookingHandover' }) },
        },
    },
    '/admin/bookings/{id}/handover': {
        get: {
            tags: ['Customer Cases'],
            summary: 'Get a garage booking handover',
            parameters: [bookingIdParameter],
            responses: { 200: successResponse('Handover returned', { $ref: '#/components/schemas/BookingHandover' }) },
        },
    },
    '/admin/bookings/{id}/handover/release': {
        patch: {
            tags: ['Customer Cases'],
            summary: 'Confirm the vehicle was physically handed over',
            description: 'Requires customer response ACCEPTED and payment status PAID or WAIVED.',
            parameters: [bookingIdParameter],
            requestBody: requestBody(handoverOperationRequest),
            responses: { 200: successResponse('Vehicle released', { $ref: '#/components/schemas/BookingHandover' }) },
        },
    },
    '/admin/bookings/{id}/handover/walk-in-accept': {
        patch: {
            tags: ['Customer Cases'],
            summary: 'Record walk-in customer acceptance before payment',
            description: 'Staff-assisted recording without OTP or signature. The staff actor and timestamp are audited.',
            parameters: [bookingIdParameter],
            requestBody: requestBody(handoverOperationRequest),
            responses: { 200: successResponse('Walk-in acceptance recorded', { $ref: '#/components/schemas/BookingHandover' }) },
        },
    },
    '/customer-cases': {
        get: {
            tags: ['Customer Cases'],
            summary: 'List my customer cases',
            parameters: listParameters,
            responses: { 200: successResponse('Cases returned', { type: 'array', items: { $ref: '#/components/schemas/CustomerCase' } }) },
        },
    },
    '/customer-cases/{id}': {
        get: {
            tags: ['Customer Cases'],
            summary: 'Get my customer case with messages and timeline',
            parameters: [caseIdParameter],
            responses: { 200: successResponse('Case returned', caseDetailSchema) },
        },
    },
    '/customer-cases/{id}/evidence': {
        post: {
            tags: ['Customer Cases'],
            summary: 'Add image evidence to my open case',
            parameters: [caseIdParameter],
            requestBody: requestBody({ type: 'object', required: ['upload_ids'], properties: { upload_ids: evidenceIds } }),
            responses: { 200: successResponse('Evidence added', caseDetailSchema) },
        },
    },
    '/customer-cases/{id}/messages': {
        post: {
            tags: ['Customer Cases'],
            summary: 'Send a message on my case',
            parameters: [caseIdParameter],
            requestBody: requestBody({
                type: 'object', required: ['message'],
                properties: { message: { type: 'string', maxLength: 2000 }, upload_ids: evidenceIds },
            }),
            responses: { 201: successResponse('Message sent', caseDetailSchema) },
        },
    },
    '/customer-cases/{id}/resolution-response': {
        patch: {
            tags: ['Customer Cases'], summary: 'Accept or reject the latest resolution proposal', parameters: [caseIdParameter],
            requestBody: requestBody({ type: 'object', required: ['resolution_id', 'accepted'], properties: { resolution_id: { type: 'string' }, accepted: { type: 'boolean' }, note: { type: 'string' } } }),
            responses: { 200: successResponse('Resolution response recorded', caseDetailSchema) },
        },
    },
    '/customer-cases/{id}/reopen': {
        post: {
            tags: ['Customer Cases'], summary: 'Reopen my resolved or closed case within the configured window', parameters: [caseIdParameter],
            requestBody: requestBody({ type: 'object', required: ['reason'], properties: { reason: { type: 'string', minLength: 10 } } }),
            responses: { 200: successResponse('Case reopened', caseDetailSchema) },
        },
    },
    '/staff/customer-cases/sla-dashboard': {
        get: {
            tags: ['Customer Cases'], summary: 'Get garage-scoped customer case SLA dashboard',
            parameters: [{ name: 'garage_id', in: 'query', schema: { type: 'string' } }, { name: 'limit', in: 'query', schema: { type: 'integer', default: 100, maximum: 500 } }],
            responses: { 200: successResponse('SLA dashboard returned', { type: 'object' }) },
        },
    },
    '/staff/customer-cases/walk-in': {
        post: {
            tags: ['Customer Cases'], summary: 'Staff records a handover issue for a walk-in customer',
            description: 'No OTP or signature is required. The staff actor and timestamp are audited.',
            requestBody: requestBody({ ...createCaseRequest, required: ['booking_id', 'category', 'description'], properties: { booking_id: { type: 'string' }, ...createCaseRequest.properties } }),
            responses: { 201: successResponse('Walk-in case created', caseDetailSchema) },
        },
    },
    '/staff/customer-cases/{id}/technical-assessment': {
        get: {
            tags: ['Customer Cases'], summary: 'Get my assigned technical assessment', parameters: [caseIdParameter],
            responses: { 200: successResponse('Assessment returned', caseDetailSchema) },
        },
    },
    '/staff/customer-cases/{id}/technical-assessment/assign': {
        patch: {
            tags: ['Customer Cases'], summary: 'Assign same-garage inspection staff', parameters: [caseIdParameter],
            requestBody: requestBody({ type: 'object', required: ['staff_profile_id'], properties: { staff_profile_id: { type: 'string' } } }),
            responses: { 200: successResponse('Assessment assigned', caseDetailSchema) },
        },
    },
    '/staff/customer-cases/{id}/technical-assessment/start': {
        patch: {
            tags: ['Customer Cases'], summary: 'Start my assigned technical assessment', parameters: [caseIdParameter],
            responses: { 200: successResponse('Assessment started', caseDetailSchema) },
        },
    },
    '/staff/customer-cases/{id}/technical-assessment/submit': {
        post: {
            tags: ['Customer Cases'], summary: 'Submit technical findings and evidence', parameters: [caseIdParameter],
            requestBody: requestBody({ type: 'object', required: ['findings', 'root_cause', 'severity', 'recommended_resolution'], properties: { findings: { type: 'string' }, root_cause: { type: 'string' }, severity: { type: 'string', enum: ['MINOR', 'MODERATE', 'MAJOR', 'SAFETY_CRITICAL'] }, recommended_resolution: { type: 'string' }, upload_ids: evidenceIds } }),
            responses: { 200: successResponse('Assessment submitted', caseDetailSchema) },
        },
    },
    '/staff/customer-cases/{id}/walk-in-resolution-response': {
        patch: {
            tags: ['Customer Cases'], summary: 'Staff records a walk-in customer resolution response', parameters: [caseIdParameter],
            requestBody: requestBody({ type: 'object', required: ['resolution_id', 'accepted'], properties: { resolution_id: { type: 'string' }, accepted: { type: 'boolean' }, note: { type: 'string' } } }),
            responses: { 200: successResponse('Walk-in response recorded', caseDetailSchema) },
        },
    },
    '/admin/customer-cases': {
        get: {
            tags: ['Customer Cases'],
            summary: 'List garage customer cases',
            parameters: listParameters,
            responses: { 200: successResponse('Cases returned', { type: 'array', items: { $ref: '#/components/schemas/CustomerCase' } }) },
        },
    },
    '/admin/customer-cases/{id}': {
        get: {
            tags: ['Customer Cases'],
            summary: 'Get a garage customer case with full timeline',
            parameters: [caseIdParameter],
            responses: { 200: successResponse('Case returned', caseDetailSchema) },
        },
    },
    '/admin/customer-cases/{id}/assign': {
        patch: {
            tags: ['Customer Cases'],
            summary: 'Assign a case to customer service staff',
            parameters: [caseIdParameter],
            requestBody: requestBody({ type: 'object', required: ['staff_profile_id'], properties: { staff_profile_id: { type: 'string' } } }),
            responses: { 200: successResponse('Case assigned', caseDetailSchema) },
        },
    },
    '/admin/customer-cases/{id}/acknowledge': {
        patch: {
            tags: ['Customer Cases'],
            summary: 'Acknowledge and optionally self-assign a case',
            parameters: [caseIdParameter],
            requestBody: requestBody(handoverOperationRequest),
            responses: { 200: successResponse('Case acknowledged', caseDetailSchema) },
        },
    },
    '/admin/customer-cases/{id}/evidence': {
        post: {
            tags: ['Customer Cases'],
            summary: 'Add evidence to an assigned case',
            parameters: [caseIdParameter],
            requestBody: requestBody({ type: 'object', required: ['upload_ids'], properties: { upload_ids: evidenceIds } }),
            responses: { 200: successResponse('Evidence added', caseDetailSchema) },
        },
    },
    '/admin/customer-cases/{id}/messages': {
        post: {
            tags: ['Customer Cases'],
            summary: 'Send a customer-visible message on an assigned case',
            parameters: [caseIdParameter],
            requestBody: requestBody({ type: 'object', required: ['message'], properties: { message: { type: 'string' }, upload_ids: evidenceIds } }),
            responses: { 201: successResponse('Message sent', caseDetailSchema) },
        },
    },
    '/admin/customer-cases/{id}/conclude': {
        patch: {
            tags: ['Customer Cases'],
            summary: 'Record the admin conclusion for a case',
            parameters: [caseIdParameter],
            requestBody: requestBody({
                type: 'object', required: ['liability_status', 'conclusion'],
                properties: {
                    liability_status: { type: 'string', enum: ['GARAGE_RESPONSIBLE', 'PRE_EXISTING_DAMAGE', 'CUSTOMER_OR_THIRD_PARTY', 'INCONCLUSIVE'] },
                    conclusion: { type: 'string' },
                    resolution_summary: { type: 'string' },
                },
            }),
            responses: { 200: successResponse('Case concluded', caseDetailSchema) },
        },
    },
    '/admin/customer-cases/{id}/close': {
        patch: {
            tags: ['Customer Cases'],
            summary: 'Close a concluded customer case',
            parameters: [caseIdParameter],
            requestBody: requestBody(handoverOperationRequest),
            responses: { 200: successResponse('Case closed', caseDetailSchema) },
        },
    },
    '/admin/customer-cases/{id}/resolutions': {
        post: {
            tags: ['Customer Cases'], summary: 'Propose a versioned resolution (admin)', parameters: [caseIdParameter],
            requestBody: requestBody({ type: 'object', required: ['summary', 'actions'], properties: { summary: { type: 'string' }, actions: { type: 'array', minItems: 1, maxItems: 3, items: resolutionActionSchema } } }),
            responses: { 201: successResponse('Resolution proposed', caseDetailSchema) },
        },
    },
    '/admin/customer-cases/{id}/resolutions/{resolutionId}/apply': {
        post: {
            tags: ['Customer Cases'], summary: 'Apply accepted refund, voucher, rework or charge-waiver actions (admin)',
            parameters: [caseIdParameter, { name: 'resolutionId', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { 200: successResponse('Resolution applied', caseDetailSchema) },
        },
    },
    '/admin/customer-cases/{id}/refunds/{refundId}': {
        patch: {
            tags: ['Customer Cases'], summary: 'Record manual/provider refund processing status (admin)',
            parameters: [caseIdParameter, { name: 'refundId', in: 'path', required: true, schema: { type: 'string' } }],
            requestBody: requestBody({ type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['PROCESSING', 'COMPLETED', 'FAILED'] }, transaction_reference: { type: 'string' }, failure_reason: { type: 'string' }, note: { type: 'string' } } }),
            responses: { 200: successResponse('Refund updated', caseDetailSchema) },
        },
    },
    '/admin/customer-cases/{id}/reopen': {
        post: {
            tags: ['Customer Cases'], summary: 'Emergency reopen with audit (admin)', parameters: [caseIdParameter],
            requestBody: requestBody({ type: 'object', required: ['reason'], properties: { reason: { type: 'string', minLength: 10 } } }),
            responses: { 200: successResponse('Case reopened', caseDetailSchema) },
        },
    },
};

module.exports = {
    tags,
    paths,
    schemas: {
        BookingHandover: bookingHandoverSchema,
        CustomerCase: customerCaseSchema,
        CustomerCaseDetail: caseDetailSchema,
        CreateCustomerCaseRequest: createCaseRequest,
        CustomerCaseTechnicalAssessment: technicalAssessmentSchema,
        CustomerCaseResolution: resolutionSchema,
        CustomerCaseRefund: refundSchema,
    },
};
