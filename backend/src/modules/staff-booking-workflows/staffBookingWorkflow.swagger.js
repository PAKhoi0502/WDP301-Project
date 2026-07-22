const { BOOKING_STATUS_VALUES } = require('../../shared/constants/booking.constant');
const {
    BOOKING_WORKFLOW_PHASE_VALUES,
    BOOKING_WORKFLOW_ACTION_VALUES,
    BOOKING_WORKFLOW_BLOCKER_VALUES,
} = require('../../shared/constants/bookingWorkflow.constant');

const tags = [{
    name: 'Staff Booking Workspace',
    description: 'Redacted same-garage booking workflow visibility for staff and admin',
}];

const workflowSummaryProperties = {
    booking_id: { type: 'string' },
    garage_id: { type: 'string' },
    license_plate: { type: 'string', nullable: true },
    normalized_license_plate: { type: 'string', nullable: true },
    vehicle_type: { type: 'string', enum: ['CAR', 'MOTORBIKE'] },
    start_time: { type: 'string', format: 'date-time' },
    end_time: { type: 'string', format: 'date-time' },
    wash_bay_id: { type: 'string', nullable: true },
    assigned_inspection_staff_id: { type: 'string', nullable: true },
    booking_status: { type: 'string', enum: BOOKING_STATUS_VALUES },
    arrival_status: { type: 'string', enum: ['EARLY', 'ON_TIME', 'LATE'], nullable: true },
    workflow_phase: { type: 'string', enum: BOOKING_WORKFLOW_PHASE_VALUES },
    current_service_item_key: { type: 'string', nullable: true },
    payment_status: { type: 'string', enum: ['UNPAID', 'PENDING', 'PAID'] },
    blocked_by_incident: { type: 'boolean' },
};

const schemas = {
    StaffBookingWorkflowSummary: {
        type: 'object',
        required: [
            'booking_id',
            'garage_id',
            'booking_status',
            'workflow_phase',
            'blocked_by_incident',
        ],
        properties: workflowSummaryProperties,
    },
    StaffBookingWorkflowInspectionMilestone: {
        type: 'object',
        properties: {
            status: { type: 'string', enum: ['DONE', 'PENDING', 'NOT_READY'] },
            inspected_at: { type: 'string', format: 'date-time', nullable: true },
            inspected_by_id: { type: 'string', nullable: true },
            image_count: { type: 'integer', minimum: 0 },
        },
    },
    StaffBookingWorkflowServiceItem: {
        type: 'object',
        properties: {
            item_key: { type: 'string' },
            name: { type: 'string' },
            sequence: { type: 'integer' },
            status: {
                type: 'string',
                enum: ['PENDING', 'IN_PROGRESS', 'PAUSED', 'AWAITING_CONFIRMATION', 'WAITING_RESOURCE', 'DONE', 'SKIPPED'],
            },
            duration_minutes: { type: 'integer' },
            transition_mode: { type: 'string', enum: ['AUTO', 'REQUIRE_CONFIRMATION'] },
            actual_started_at: { type: 'string', format: 'date-time', nullable: true },
            countdown_ends_at: { type: 'string', format: 'date-time', nullable: true },
            actual_completed_at: { type: 'string', format: 'date-time', nullable: true },
            remaining_seconds_at_pause: { type: 'integer', nullable: true },
            requires_wash_bay: { type: 'boolean' },
            requires_care_staff: { type: 'boolean' },
            assigned_to_current_user: { type: 'boolean' },
        },
    },
    StaffBookingWorkflowDetail: {
        type: 'object',
        required: [
            'booking_id',
            'garage_id',
            'booking_status',
            'workflow_phase',
            'milestones',
            'service_items',
            'service_steps',
            'blockers',
            'available_actions',
        ],
        properties: {
            ...workflowSummaryProperties,
            server_time: { type: 'string', format: 'date-time' },
            operation_status: { type: 'string', enum: ['NORMAL', 'AWAITING_CUSTOMER_DECISION'] },
            payment: {
                type: 'object',
                properties: {
                    method: { type: 'string', enum: ['CASH', 'PAYOS'] },
                    status: { type: 'string', enum: ['UNPAID', 'PENDING', 'PAID'] },
                },
            },
            milestones: {
                type: 'object',
                properties: {
                    check_in: { type: 'object', additionalProperties: true },
                    before_wash_inspection: { $ref: '#/components/schemas/StaffBookingWorkflowInspectionMilestone' },
                    service: { type: 'object', additionalProperties: true },
                    after_wash_inspection: { $ref: '#/components/schemas/StaffBookingWorkflowInspectionMilestone' },
                    handover: { type: 'object', additionalProperties: true },
                },
            },
            service_items: {
                type: 'array',
                items: { $ref: '#/components/schemas/StaffBookingWorkflowServiceItem' },
            },
            service_steps: {
                type: 'array',
                items: { type: 'object', additionalProperties: true },
            },
            blockers: {
                type: 'array',
                uniqueItems: true,
                items: { type: 'string', enum: BOOKING_WORKFLOW_BLOCKER_VALUES },
            },
            available_actions: {
                type: 'array',
                uniqueItems: true,
                items: { type: 'string', enum: BOOKING_WORKFLOW_ACTION_VALUES },
            },
        },
    },
};

const errorResponses = {
    401: { description: 'Unauthorized' },
    403: { description: 'Capability or garage access forbidden' },
    404: { description: 'Booking not found' },
};

const paths = {
    '/staff/workspace/bookings': {
        get: {
            tags: ['Staff Booking Workspace'],
            summary: 'List redacted booking workflows in the staff garage',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                { name: 'garage_id', in: 'query', schema: { type: 'string' } },
                { name: 'status', in: 'query', schema: { type: 'string', enum: BOOKING_STATUS_VALUES } },
                { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
                { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
            ],
            responses: {
                200: {
                    description: 'Staff booking workflow list',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: { type: 'boolean' },
                                    message: { type: 'string' },
                                    data: {
                                        type: 'array',
                                        items: { $ref: '#/components/schemas/StaffBookingWorkflowSummary' },
                                    },
                                    meta: { type: 'object', additionalProperties: true },
                                },
                            },
                        },
                    },
                },
                ...errorResponses,
            },
        },
    },
    '/staff/workspace/bookings/{bookingId}/workflow': {
        get: {
            tags: ['Staff Booking Workspace'],
            summary: 'Get redacted workflow and caller-specific available actions',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'bookingId', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Staff booking workflow detail',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: { type: 'boolean' },
                                    message: { type: 'string' },
                                    data: { $ref: '#/components/schemas/StaffBookingWorkflowDetail' },
                                },
                            },
                        },
                    },
                },
                ...errorResponses,
            },
        },
    },
};

module.exports = {
    tags,
    schemas,
    paths,
};
