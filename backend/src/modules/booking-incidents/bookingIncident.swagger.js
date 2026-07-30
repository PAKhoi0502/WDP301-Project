const tags = [{
    name: 'Booking Incidents',
    description: 'Garage operational incident and customer decision workflow',
}];

const bookingIncidentSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        booking_id: { type: 'string' },
        garage_id: { type: 'string' },
        customer_id: { type: 'string', nullable: true },
        incident_type: {
            type: 'string',
            enum: ['WASH_BAY_FAILURE', 'STAFF_UNAVAILABLE', 'OTHER_GARAGE_INCIDENT'],
        },
        description: { type: 'string', nullable: true },
        status: {
            type: 'string',
            enum: ['AWAITING_CUSTOMER_DECISION', 'RESOLVED', 'VOIDED'],
        },
        affected_booking_item_key: { type: 'string', nullable: true },
        affected_wash_bay_id: { type: 'string', nullable: true },
        affected_staff_profile_id: {
            type: 'string',
            nullable: true,
            description: 'Required for STAFF_UNAVAILABLE and must be actively assigned to the booking item',
        },
        reported_by_id: { type: 'string' },
        reported_booking_status: { type: 'string' },
        reported_schedule_snapshot: { type: 'object' },
        countdown_paused_automatically: { type: 'boolean' },
        decision: {
            type: 'string',
            nullable: true,
            enum: [
                'REASSIGN_AND_CONTINUE',
                'RESCHEDULE_NEAREST',
                'RESCHEDULE_CUSTOM',
                'CANCEL_BY_GARAGE',
            ],
        },
        decision_source: {
            type: 'string',
            nullable: true,
            enum: ['CUSTOMER', 'STAFF_RECORDED'],
        },
        contact_channel: {
            type: 'string',
            nullable: true,
            enum: ['APP', 'PHONE', 'IN_PERSON'],
        },
        customer_note: { type: 'string', nullable: true },
        new_start_time: { type: 'string', format: 'date-time', nullable: true },
        continuation_policy: {
            type: 'string',
            nullable: true,
            enum: ['RESUME_REMAINING', 'RESTART_CURRENT_ITEM'],
        },
        customer_confirmed_at: { type: 'string', format: 'date-time', nullable: true },
        resolved_at: { type: 'string', format: 'date-time', nullable: true },
        compensation_voucher_ids: {
            type: 'array',
            items: { type: 'string' },
        },
        compensation_vouchers: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    code: { type: 'string' },
                    status: { type: 'string' },
                    expires_at: { type: 'string', format: 'date-time' },
                    customer_id: { type: 'string', nullable: true },
                    guest_phone: { type: 'string', nullable: true },
                    normalized_guest_phone: { type: 'string', nullable: true },
                },
            },
        },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
    },
};

const reportBookingIncidentRequest = {
    type: 'object',
    required: ['incident_type'],
    properties: {
        incident_type: {
            type: 'string',
            enum: ['WASH_BAY_FAILURE', 'STAFF_UNAVAILABLE', 'OTHER_GARAGE_INCIDENT'],
        },
        description: {
            type: 'string',
            description: 'Required for OTHER_GARAGE_INCIDENT',
        },
        affected_booking_item_key: { type: 'string' },
        affected_wash_bay_id: { type: 'string', nullable: true },
        affected_staff_profile_id: { type: 'string', nullable: true },
        released_booking_item_keys: {
            type: 'array',
            items: { type: 'string' },
        },
    },
};

const bookingIncidentDecisionRequest = {
    type: 'object',
    required: ['decision'],
    properties: {
        decision: {
            type: 'string',
            enum: [
                'REASSIGN_AND_CONTINUE',
                'RESCHEDULE_NEAREST',
                'RESCHEDULE_CUSTOM',
                'CANCEL_BY_GARAGE',
            ],
        },
        new_start_time: {
            type: 'string',
            format: 'date-time',
            description: 'Required only for RESCHEDULE_CUSTOM. RESCHEDULE_NEAREST selects the first available slot on the server.',
        },
        continuation_policy: {
            type: 'string',
            enum: ['RESUME_REMAINING', 'RESTART_CURRENT_ITEM'],
            default: 'RESUME_REMAINING',
        },
        customer_note: { type: 'string' },
    },
};

const staffBookingIncidentDecisionRequest = {
    allOf: [
        bookingIncidentDecisionRequest,
        {
            type: 'object',
            required: ['contact_channel'],
            properties: {
                contact_channel: {
                    type: 'string',
                    enum: ['PHONE', 'IN_PERSON'],
                },
            },
        },
    ],
};

const createCompensationVoucherRequest = {
    type: 'object',
    required: ['voucher_type', 'value', 'expires_at'],
    properties: {
        voucher_type: {
            type: 'string',
            enum: ['FIXED_AMOUNT', 'PERCENTAGE', 'FREE_SERVICE'],
        },
        value: { type: 'integer', minimum: 0 },
        max_discount_amount: { type: 'integer', minimum: 0, nullable: true },
        min_order_amount: { type: 'integer', minimum: 0, default: 0 },
        service_package_id: { type: 'string', nullable: true },
        expires_at: { type: 'string', format: 'date-time' },
        note: { type: 'string' },
    },
};

const bookingIdParameter = {
    name: 'id',
    in: 'path',
    required: true,
    schema: { type: 'string' },
};

const incidentIdParameter = {
    name: 'incidentId',
    in: 'path',
    required: true,
    schema: { type: 'string' },
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

const paths = {
    '/bookings/{id}/incidents': {
        get: {
            tags: ['Booking Incidents'],
            summary: 'Get my booking incident history',
            parameters: [bookingIdParameter],
            responses: {
                200: successResponse('Incident history returned', {
                    type: 'array',
                    items: { $ref: '#/components/schemas/BookingIncident' },
                }),
            },
        },
    },
    '/bookings/{id}/incidents/active': {
        get: {
            tags: ['Booking Incidents'],
            summary: 'Get my active booking incident and resolution options',
            parameters: [bookingIdParameter],
            responses: {
                200: successResponse('Active incident returned', {
                    type: 'object',
                    nullable: true,
                    properties: {
                        incident: { $ref: '#/components/schemas/BookingIncident' },
                        resolution_options: { type: 'object' },
                    },
                }),
            },
        },
    },
    '/bookings/{id}/incidents/{incidentId}/decision': {
        patch: {
            tags: ['Booking Incidents'],
            summary: 'Submit my garage incident decision',
            parameters: [bookingIdParameter, incidentIdParameter],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: bookingIncidentDecisionRequest,
                    },
                },
            },
            responses: {
                200: successResponse('Incident resolved', { type: 'object' }),
            },
        },
    },
    '/admin/bookings/{id}/incidents': {
        get: {
            tags: ['Booking Incidents'],
            summary: 'Get booking incident history',
            parameters: [bookingIdParameter],
            responses: {
                200: successResponse('Incident history returned', {
                    type: 'array',
                    items: { $ref: '#/components/schemas/BookingIncident' },
                }),
            },
        },
        post: {
            tags: ['Booking Incidents'],
            summary: 'Report a garage operational incident',
            description: 'Creates an incident, pauses the active countdown, blocks service operations, and notifies staff and customer.',
            parameters: [bookingIdParameter],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: reportBookingIncidentRequest,
                    },
                },
            },
            responses: {
                201: successResponse('Incident reported', { type: 'object' }),
            },
        },
    },
    '/admin/bookings/{id}/incidents/active': {
        get: {
            tags: ['Booking Incidents'],
            summary: 'Get active booking incident and resolution options',
            parameters: [bookingIdParameter],
            responses: {
                200: successResponse('Active incident returned', { type: 'object', nullable: true }),
            },
        },
    },
    '/admin/bookings/{id}/incidents/{incidentId}/resolution-options': {
        get: {
            tags: ['Booking Incidents'],
            summary: 'Get resource reassignment and reschedule options',
            parameters: [
                bookingIdParameter,
                incidentIdParameter,
                {
                    name: 'days',
                    in: 'query',
                    schema: { type: 'integer', minimum: 1, maximum: 7, default: 3 },
                },
            ],
            responses: {
                200: successResponse('Resolution options returned', { type: 'object' }),
            },
        },
    },
    '/admin/bookings/{id}/incidents/{incidentId}/record-customer-decision': {
        patch: {
            tags: ['Booking Incidents'],
            summary: 'Record customer decision received by phone or in person',
            parameters: [bookingIdParameter, incidentIdParameter],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: staffBookingIncidentDecisionRequest,
                    },
                },
            },
            responses: {
                200: successResponse('Customer decision recorded', { type: 'object' }),
            },
        },
    },
    '/admin/bookings/{id}/incidents/{incidentId}/compensation-vouchers': {
        post: {
            tags: ['Booking Incidents'],
            summary: 'Issue or request approval for a compensation voucher',
            parameters: [bookingIdParameter, incidentIdParameter],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: createCompensationVoucherRequest,
                    },
                },
            },
            responses: {
                201: successResponse('Compensation voucher created', {
                    type: 'object',
                    properties: {
                        voucher: { $ref: '#/components/schemas/CustomerVoucher' },
                        requires_approval: { type: 'boolean' },
                    },
                }),
            },
        },
    },
};

const schemas = {
    BookingIncident: bookingIncidentSchema,
    ReportBookingIncidentRequest: reportBookingIncidentRequest,
    BookingIncidentDecisionRequest: bookingIncidentDecisionRequest,
    StaffBookingIncidentDecisionRequest: staffBookingIncidentDecisionRequest,
    CreateCompensationVoucherRequest: createCompensationVoucherRequest,
};

module.exports = {
    tags,
    paths,
    schemas,
};
