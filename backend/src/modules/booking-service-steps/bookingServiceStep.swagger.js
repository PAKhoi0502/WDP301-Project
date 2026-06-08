const tags = [
    {
        name: 'Booking Service Steps',
        description: 'Booking service step APIs',
    },
];

const bookingServiceStepSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        booking_id: { type: 'string' },
        service_package_id: { type: 'string' },
        booking_item_key: { type: 'string', nullable: true },
        step_code: { type: 'string' },
        step_name: { type: 'string' },
        order: { type: 'number' },
        step_type: { type: 'string', enum: ['AUTOMATED_WASH_STEP', 'MANUAL_SERVICE_STEP'] },
        workflow_type: { type: 'string', enum: ['PRE_SERVICE', 'SERVICE', 'POST_SERVICE'] },
        group_name: { type: 'string', nullable: true },
        sequence: { type: 'number', nullable: true },
        is_required: { type: 'boolean' },
        requires_wash_bay: { type: 'boolean' },
        requires_care_staff: { type: 'boolean' },
        display_staff_type: { type: 'string', nullable: true },
        assigned_staff_id: { type: 'string', nullable: true },
        confirmed_by_staff_id: { type: 'string', nullable: true },
        status: { type: 'string', enum: ['PENDING', 'IN_PROGRESS', 'DONE', 'SKIPPED'] },
        instructions: { type: 'array', items: { type: 'string' } },
        started_at: { type: 'string', format: 'date-time', nullable: true },
        completed_at: { type: 'string', format: 'date-time', nullable: true },
        resource_released_at: { type: 'string', format: 'date-time', nullable: true },
        note: { type: 'string', nullable: true },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
    },
};

module.exports = {
    tags,
    paths: {},
    schemas: {
        BookingServiceStep: bookingServiceStepSchema,
    },
};
