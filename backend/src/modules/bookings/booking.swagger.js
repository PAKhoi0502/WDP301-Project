const tags = [
    {
        name: 'Bookings',
        description: 'Customer booking APIs',
    },
    {
        name: 'Admin Bookings',
        description: 'Staff and admin booking APIs',
    },
];

const careStaffAssignmentSchema = {
    type: 'object',
    properties: {
        staff_profile_id: { type: 'string' },
        staff_profile: { type: 'object', nullable: true },
        user_id: { type: 'string' },
        user: { type: 'object', nullable: true },
        assigned_at: { type: 'string', format: 'date-time' },
        released_at: { type: 'string', format: 'date-time', nullable: true },
    },
};

const bookingSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        customer_id: { type: 'string', nullable: true },
        vehicle_id: { type: 'string', nullable: true },
        is_walk_in: { type: 'boolean' },
        guest_name: { type: 'string', nullable: true },
        guest_phone: { type: 'string', nullable: true },
        normalized_guest_phone: { type: 'string', nullable: true },
        guest_email: { type: 'string', nullable: true },
        claimed_customer_id: { type: 'string', nullable: true },
        claimed_at: { type: 'string', format: 'date-time', nullable: true },
        license_plate: { type: 'string', nullable: true },
        normalized_license_plate: { type: 'string', nullable: true },
        vehicle_type: { type: 'string', enum: ['MOTORBIKE', 'CAR'] },
        created_by_staff_id: { type: 'string', nullable: true },
        garage_id: { type: 'string' },
        wash_bay_id: { type: 'string', nullable: true },
        service_package_id: { type: 'string' },
        add_on_service_ids: {
            type: 'array',
            items: { type: 'string' },
        },
        booking_items: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    item_key: { type: 'string' },
                    service_package_id: { type: 'string' },
                    source: { type: 'string', enum: ['PRIMARY', 'COMBO_INCLUDED', 'ADD_ON'] },
                    parent_combo_id: { type: 'string', nullable: true },
                    name_snapshot: { type: 'string' },
                    price_snapshot: { type: 'number' },
                    duration_minutes: { type: 'number' },
                    countdown_duration_seconds: { type: 'integer' },
                    transition_mode: { type: 'string', enum: ['AUTO', 'REQUIRE_CONFIRMATION'] },
                    item_start_time: { type: 'string', format: 'date-time', nullable: true },
                    item_end_time: { type: 'string', format: 'date-time', nullable: true },
                    sequence: { type: 'number' },
                    requires_wash_bay: { type: 'boolean' },
                    wash_bay_start_time: { type: 'string', format: 'date-time', nullable: true },
                    wash_bay_end_time: { type: 'string', format: 'date-time', nullable: true },
                    wash_bay_work_end_time: { type: 'string', format: 'date-time', nullable: true },
                    wash_bay_reserved_until: { type: 'string', format: 'date-time', nullable: true },
                    requires_care_staff: { type: 'boolean' },
                    care_staff_type: { type: 'string', nullable: true },
                    care_staff_required_count: { type: 'number' },
                    care_staff_start_time: { type: 'string', format: 'date-time', nullable: true },
                    care_staff_end_time: { type: 'string', format: 'date-time', nullable: true },
                    care_staff_work_end_time: { type: 'string', format: 'date-time', nullable: true },
                    care_staff_reserved_until: { type: 'string', format: 'date-time', nullable: true },
                    assigned_care_staff: {
                        type: 'array',
                        items: careStaffAssignmentSchema,
                    },
                    status: {
                        type: 'string',
                        enum: ['PENDING', 'IN_PROGRESS', 'PAUSED', 'AWAITING_CONFIRMATION', 'WAITING_RESOURCE', 'DONE', 'SKIPPED'],
                    },
                    actual_started_at: { type: 'string', format: 'date-time', nullable: true },
                    countdown_ends_at: { type: 'string', format: 'date-time', nullable: true },
                    actual_completed_at: { type: 'string', format: 'date-time', nullable: true },
                    remaining_seconds_at_pause: { type: 'integer', nullable: true },
                    countdown_resume_seconds: { type: 'integer', nullable: true },
                    paused_at: { type: 'string', format: 'date-time', nullable: true },
                    paused_by_staff_id: { type: 'string', nullable: true },
                    pause_reason: { type: 'string', nullable: true },
                    total_paused_seconds: { type: 'integer' },
                    completion_source: {
                        type: 'string',
                        enum: ['TIMER', 'STAFF_EARLY', 'STAFF_CONFIRM'],
                        nullable: true,
                    },
                    completed_by_staff_id: { type: 'string', nullable: true },
                    completion_note: { type: 'string', nullable: true },
                },
            },
        },
        booking_date: { type: 'string', format: 'date-time' },
        start_time: { type: 'string', format: 'date-time' },
        end_time: { type: 'string', format: 'date-time' },
        wash_bay_start_time: { type: 'string', format: 'date-time', nullable: true },
        wash_bay_end_time: { type: 'string', format: 'date-time', nullable: true },
        wash_bay_work_end_time: { type: 'string', format: 'date-time', nullable: true },
        wash_bay_reserved_until: { type: 'string', format: 'date-time', nullable: true },
        requires_care_staff: { type: 'boolean' },
        care_staff_type: {
            type: 'string',
            enum: ['CUSTOMER_SERVICE_STAFF', 'VEHICLE_INSPECTION_STAFF', 'WASH_OPERATOR', 'VEHICLE_CARE_STAFF'],
            nullable: true,
        },
        care_staff_required_count: { type: 'number' },
        care_staff_start_time: { type: 'string', format: 'date-time', nullable: true },
        care_staff_end_time: { type: 'string', format: 'date-time', nullable: true },
        care_staff_work_end_time: { type: 'string', format: 'date-time', nullable: true },
        care_staff_reserved_until: { type: 'string', format: 'date-time', nullable: true },
        assigned_care_staff_ids: {
            type: 'array',
            items: { type: 'string' },
        },
        assigned_care_staff: {
            type: 'array',
            items: { type: 'object' },
        },
        original_price: { type: 'number' },
        promotion_discount_amount: { type: 'number' },
        points_discount_amount: { type: 'number' },
        voucher_discount_amount: { type: 'number' },
        discount_amount: { type: 'number' },
        final_price: { type: 'number' },
        payment_method: { type: 'string', enum: ['CASH', 'PAYOS'] },
        payment_status: { type: 'string', enum: ['UNPAID', 'PENDING', 'PAID'] },
        used_points: { type: 'number' },
        earned_points: { type: 'number' },
        promotion_id: { type: 'string', nullable: true },
        promotion: { $ref: '#/components/schemas/Promotion', nullable: true },
        customer_voucher_id: { type: 'string', nullable: true },
        customer_voucher: { $ref: '#/components/schemas/CustomerVoucher', nullable: true },
        requires_wash_bay: { type: 'boolean' },
        status: {
            type: 'string',
            enum: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELED', 'NO_SHOW'],
        },
        operation_status: {
            type: 'string',
            enum: ['NORMAL', 'AWAITING_CUSTOMER_DECISION'],
        },
        active_incident_id: { type: 'string', nullable: true },
        active_incident: { $ref: '#/components/schemas/BookingIncident', nullable: true },
        arrival_status: {
            type: 'string',
            enum: ['EARLY', 'ON_TIME', 'LATE'],
            nullable: true,
        },
        arrived_at: { type: 'string', format: 'date-time', nullable: true },
        arrival_reference_start_time: { type: 'string', format: 'date-time', nullable: true },
        late_minutes: { type: 'integer' },
        grace_exceeded_minutes: { type: 'integer' },
        late_resolution: {
            type: 'string',
            enum: ['ACCEPT_WITHIN_ORIGINAL_WINDOW', 'RESCHEDULED'],
            nullable: true,
        },
        late_resolution_required: { type: 'boolean' },
        late_accepted_by_id: { type: 'string', nullable: true },
        late_accepted_at: { type: 'string', format: 'date-time', nullable: true },
        late_resolution_note: { type: 'string', nullable: true },
        original_start_time: { type: 'string', format: 'date-time', nullable: true },
        original_end_time: { type: 'string', format: 'date-time', nullable: true },
        rescheduled_at: { type: 'string', format: 'date-time', nullable: true },
        rescheduled_by_id: { type: 'string', nullable: true },
        reschedule_reason: { type: 'string', nullable: true },
        reschedule_count: { type: 'integer' },
        checked_in_at: { type: 'string', format: 'date-time', nullable: true },
        started_at: { type: 'string', format: 'date-time', nullable: true },
        completed_at: { type: 'string', format: 'date-time', nullable: true },
        paid_at: { type: 'string', format: 'date-time', nullable: true },
        canceled_at: { type: 'string', format: 'date-time', nullable: true },
        canceled_by_id: { type: 'string', nullable: true },
        cancel_reason: { type: 'string', nullable: true },
        cancellation_source: {
            type: 'string',
            nullable: true,
            enum: ['CUSTOMER', 'STAFF_CUSTOMER_REQUEST', 'GARAGE_INCIDENT', 'ADMIN_CORRECTION'],
        },
        cancellation_incident_id: { type: 'string', nullable: true },
        no_show_at: { type: 'string', format: 'date-time', nullable: true },
        no_show_by_id: { type: 'string', nullable: true },
        no_show_by: { type: 'object', nullable: true },
        no_show_reason: { type: 'string', nullable: true },
        reward_processed: { type: 'boolean' },
        reward_processed_at: { type: 'string', format: 'date-time', nullable: true },
        note: { type: 'string', nullable: true },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
    },
};

const availableSlotSchema = {
    type: 'object',
    properties: {
        start_time: { type: 'string', format: 'date-time' },
        end_time: { type: 'string', format: 'date-time' },
        wash_bay_start_time: { type: 'string', format: 'date-time', nullable: true },
        wash_bay_end_time: { type: 'string', format: 'date-time', nullable: true },
        wash_bay_work_end_time: { type: 'string', format: 'date-time', nullable: true },
        wash_bay_reserved_until: { type: 'string', format: 'date-time', nullable: true },
        care_staff_start_time: { type: 'string', format: 'date-time', nullable: true },
        care_staff_end_time: { type: 'string', format: 'date-time', nullable: true },
        care_staff_work_end_time: { type: 'string', format: 'date-time', nullable: true },
        care_staff_reserved_until: { type: 'string', format: 'date-time', nullable: true },
        is_available: { type: 'boolean' },
        unavailable_reasons: {
            type: 'array',
            items: {
                type: 'string',
                enum: ['VEHICLE_BOOKING_OVERLAP', 'WASH_BAY_CAPACITY_FULL', 'CARE_STAFF_CAPACITY_FULL'],
            },
        },
        available_capacity: { type: 'number', nullable: true },
        available_wash_bay_capacity: { type: 'number', nullable: true },
        available_care_staff_capacity: { type: 'number', nullable: true },
        booking_items: {
            type: 'array',
            items: { type: 'object' },
        },
    },
};

const createCustomerBookingRequest = {
    type: 'object',
    required: ['garage_id', 'vehicle_id', 'service_package_id', 'start_time'],
    properties: {
        garage_id: { type: 'string', example: '665f0d3d8b4f5d0012a00001' },
        vehicle_id: { type: 'string', example: '665f0d3d8b4f5d0012a00002' },
        service_package_id: { type: 'string', example: '665f0d3d8b4f5d0012a00003' },
        add_on_service_ids: {
            type: 'array',
            items: { type: 'string' },
            example: ['665f0d3d8b4f5d0012a00004'],
        },
        start_time: { type: 'string', format: 'date-time', example: '2026-06-10T09:00:00+07:00' },
        promotion_code: { type: 'string', example: 'WELCOME10' },
        voucher_code: { type: 'string', example: 'CARE_A1B2C3D4E5F6' },
        used_points: { type: 'number', example: 50 },
        note: { type: 'string', example: 'Please prepare before arrival' },
    },
};

const createWalkInBookingRequest = {
    type: 'object',
    required: ['garage_id', 'service_package_id', 'license_plate', 'vehicle_type'],
    description: 'Provide start_time for a scheduled walk-in, or serve_now=true without start_time for immediate service.',
    properties: {
        garage_id: { type: 'string', example: '665f0d3d8b4f5d0012a00001' },
        service_package_id: { type: 'string', example: '665f0d3d8b4f5d0012a00003' },
        add_on_service_ids: {
            type: 'array',
            items: { type: 'string' },
            example: ['665f0d3d8b4f5d0012a00004'],
        },
        start_time: { type: 'string', format: 'date-time', example: '2026-06-10T09:00:00+07:00' },
        serve_now: {
            type: 'boolean',
            default: false,
            description: 'Use the current time, bypass the slot grid, and create the booking already checked in.',
        },
        suggestion_days: {
            type: 'integer',
            minimum: 1,
            maximum: 7,
            default: 1,
            description: 'Number of days searched for suggested slots when resources are unavailable.',
        },
        guest_name: { type: 'string', nullable: true, example: 'Guest Customer' },
        guest_phone: {
            type: 'string',
            nullable: true,
            example: '0901234567',
            description: 'Required when the selected promotion requires guest phone identification',
        },
        guest_email: { type: 'string', example: 'guest@example.com' },
        license_plate: { type: 'string', example: '59A-123.45' },
        vehicle_type: { type: 'string', enum: ['MOTORBIKE', 'CAR'], example: 'CAR' },
        promotion_code: { type: 'string', example: 'WELCOME10' },
        note: { type: 'string', example: 'Walk-in customer' },
    },
};

const cancelBookingRequest = {
    type: 'object',
    properties: {
        reason: { type: 'string', example: 'Customer changed schedule' },
    },
};

const bookingAvailabilityDaySchema = {
    type: 'object',
    properties: {
        date: { type: 'string', format: 'date' },
        opening_time: { type: 'string', example: '07:00' },
        closing_time: { type: 'string', example: '19:00' },
        latest_start_time: { type: 'string', format: 'date-time', nullable: true },
        has_available_slots: { type: 'boolean' },
        reason: {
            type: 'string',
            enum: [
                'DATE_IN_PAST',
                'NO_FUTURE_SLOT_TODAY',
                'BOOKING_WINDOW_EXCEEDED',
                'NO_CONTINUOUS_SLOT_AVAILABLE',
            ],
            nullable: true,
        },
        available_slots: {
            type: 'array',
            items: availableSlotSchema,
        },
        slots: {
            type: 'array',
            items: availableSlotSchema,
        },
    },
};

const markNoShowRequest = {
    type: 'object',
    properties: {
        reason: { type: 'string', example: 'Customer did not arrive for the scheduled appointment' },
    },
};

const resolveLateArrivalRequest = {
    type: 'object',
    required: ['resolution'],
    properties: {
        resolution: {
            type: 'string',
            enum: ['ACCEPT_WITHIN_ORIGINAL_WINDOW', 'RESCHEDULED'],
        },
        new_start_time: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            example: '2026-06-11T12:30:00+07:00',
        },
        reason: {
            type: 'string',
            example: 'CUSTOMER_LATE',
        },
        note: {
            type: 'string',
        },
    },
};

const lateArrivalOptionsResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
            type: 'object',
            properties: {
                booking_id: { type: 'string' },
                arrival_status: { type: 'string', enum: ['LATE'] },
                arrived_at: { type: 'string', format: 'date-time' },
                arrival_reference_start_time: { type: 'string', format: 'date-time' },
                late_minutes: { type: 'integer' },
                grace_exceeded_minutes: { type: 'integer' },
                search_start_time: { type: 'string', format: 'date-time' },
                suggested_slots: {
                    type: 'array',
                    items: availableSlotSchema,
                },
                days: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            date: { type: 'string', format: 'date' },
                            opening_time: { type: 'string' },
                            closing_time: { type: 'string' },
                            has_available_slots: { type: 'boolean' },
                            reason: {
                                type: 'string',
                                enum: ['NO_CONTINUOUS_SLOT_AVAILABLE'],
                                nullable: true,
                            },
                            suggested_slots: {
                                type: 'array',
                                items: availableSlotSchema,
                            },
                        },
                    },
                },
            },
        },
    },
};

const successBookingResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: bookingSchema,
    },
};

const bookingListResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
            type: 'array',
            items: bookingSchema,
        },
        meta: {
            type: 'object',
            properties: {
                page: { type: 'number' },
                limit: { type: 'number' },
                total: { type: 'number' },
                total_pages: { type: 'number' },
            },
        },
    },
};

const commonErrorResponses = {
    400: { description: 'Bad request' },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden' },
    404: { description: 'Not found' },
    409: { description: 'Conflict' },
};

const bookingOperationRequest = {
    type: 'object',
    properties: {
        note: { type: 'string' },
    },
};

const startServiceRequest = {
    type: 'object',
    properties: {
        note: { type: 'string' },
        allow_early_start: {
            type: 'boolean',
            default: false,
            description: 'Allow a checked-in early arrival to shift the booking timeline to the current time before starting service.',
        },
    },
    description: 'A late start automatically shifts the booking timeline to the actual start time, rechecks capacity, and records STAFF_DELAY. Resource conflicts return BOOKING_LATE_START_RESOURCE_CONFLICT with reassignment/reschedule options.',
};

const assignWashBayRequest = {
    type: 'object',
    properties: {
        wash_bay_id: { type: 'string', nullable: true },
    },
};

const assignStaffRequest = {
    type: 'object',
    required: ['staff_profile_id'],
    properties: {
        staff_profile_id: { type: 'string' },
    },
};

const serviceStepDoneRequest = {
    type: 'object',
    properties: {
        note: { type: 'string' },
    },
};

const pauseServiceItemRequest = {
    type: 'object',
    required: ['reason'],
    properties: {
        reason: { type: 'string', minLength: 2, maxLength: 500 },
    },
};

const createVehicleInspectionRequest = {
    type: 'object',
    required: ['type'],
    properties: {
        type: { type: 'string', enum: ['BEFORE_WASH', 'AFTER_WASH'] },
        note: { type: 'string' },
        images: {
            type: 'array',
            items: {
                type: 'object',
                required: ['image_url'],
                properties: {
                    image_url: { type: 'string' },
                    public_id: { type: 'string' },
                    caption: { type: 'string' },
                },
            },
        },
    },
};

const bookingServiceStepSchema = {
    $ref: '#/components/schemas/BookingServiceStep',
};

const vehicleInspectionSchema = {
    $ref: '#/components/schemas/VehicleInspection',
};

const serviceStepListResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
            type: 'array',
            items: bookingServiceStepSchema,
        },
    },
};

const serviceWorkflowResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
            type: 'object',
            properties: {
                server_time: { type: 'string', format: 'date-time' },
                booking_id: { type: 'string' },
                booking_status: { type: 'string' },
                operation_status: { type: 'string', enum: ['NORMAL', 'AWAITING_CUSTOMER_DECISION'] },
                blocked_by_incident: { type: 'boolean' },
                active_incident_id: { type: 'string', nullable: true },
                workflow_phase: { type: 'string', enum: ['NOT_STARTED', 'READY', 'SERVICE', 'INCIDENT_HOLD', 'POST_SERVICE', 'COMPLETED'] },
                current_item: { type: 'object', nullable: true },
                next_item: { type: 'object', nullable: true },
                remaining_seconds: { type: 'integer', nullable: true },
                all_service_items_done: { type: 'boolean' },
                can_pause: { type: 'boolean' },
                can_resume: { type: 'boolean' },
                can_complete_early: { type: 'boolean' },
                requires_confirmation: { type: 'boolean' },
                service_steps: {
                    type: 'array',
                    items: bookingServiceStepSchema,
                },
            },
        },
    },
};

const vehicleInspectionListResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
            type: 'array',
            items: vehicleInspectionSchema,
        },
    },
};


const markPaidResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
            type: 'object',
            properties: {
                booking: bookingSchema,
                wash_history: { type: 'object', nullable: true },
                loyalty: { type: 'object', nullable: true },
                point_transaction: { type: 'object', nullable: true },
                promotion_usage: { type: 'object', nullable: true },
                notifications: {
                    type: 'array',
                    items: { type: 'object' },
                },
                already_processed: { type: 'boolean' },
            },
        },
    },
};

const startServiceResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
            type: 'object',
            properties: {
                booking: bookingSchema,
                service_steps: {
                    type: 'array',
                    items: bookingServiceStepSchema,
                },
            },
        },
    },
};

const paths = {
    '/bookings/available-slots': {
        get: {
            tags: ['Bookings'],
            summary: 'Get available booking slots for one day or a date range',
            security: [{ bearerAuth: [] }, {}],
            parameters: [
                { name: 'garage_id', in: 'query', required: true, schema: { type: 'string' } },
                { name: 'vehicle_id', in: 'query', required: false, description: 'Requires customer authentication when provided', schema: { type: 'string' } },
                { name: 'service_package_id', in: 'query', required: true, schema: { type: 'string' } },
                { name: 'add_on_service_ids', in: 'query', required: false, schema: { type: 'string', example: '665f0d3d8b4f5d0012a00004,665f0d3d8b4f5d0012a00005' } },
                { name: 'date', in: 'query', required: false, description: 'Legacy single-day query. Use either date or start_date.', schema: { type: 'string', format: 'date', example: '2026-06-10' } },
                { name: 'start_date', in: 'query', required: false, description: 'First day of the availability range. Defaults to 7 days when used.', schema: { type: 'string', format: 'date', example: '2026-06-10' } },
                { name: 'days', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 7, example: 7 } },
            ],
            responses: {
                200: {
                    description: 'Available slots',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: { type: 'boolean', example: true },
                                    message: { type: 'string' },
                                    data: {
                                        type: 'object',
                                        properties: {
                                            garage_id: { type: 'string' },
                                            vehicle_id: { type: 'string', nullable: true },
                                            service_package_id: { type: 'string' },
                                            add_on_service_ids: {
                                                type: 'array',
                                                items: { type: 'string' },
                                            },
                                            date: { type: 'string' },
                                            start_date: { type: 'string', format: 'date' },
                                            requested_days: { type: 'integer' },
                                            generated_at: { type: 'string', format: 'date-time' },
                                            booking_tier: { type: 'string' },
                                            booking_window_days: { type: 'integer' },
                                            booking_window_end: { type: 'string', format: 'date-time' },
                                            vehicle_type: { type: 'string' },
                                            service_duration_minutes: { type: 'integer' },
                                            requires_wash_bay: { type: 'boolean' },
                                            requires_care_staff: { type: 'boolean' },
                                            care_staff_type: {
                                                type: 'string',
                                                enum: ['CUSTOMER_SERVICE_STAFF', 'VEHICLE_INSPECTION_STAFF', 'WASH_OPERATOR', 'VEHICLE_CARE_STAFF'],
                                                nullable: true,
                                            },
                                            care_staff_required_count: { type: 'number' },
                                            slot_interval_minutes: { type: 'number' },
                                            active_wash_bay_count: { type: 'number', nullable: true },
                                            active_care_staff_count: { type: 'number', nullable: true },
                                            has_available_slots: { type: 'boolean' },
                                            available_slots: {
                                                type: 'array',
                                                items: availableSlotSchema,
                                            },
                                            slots: {
                                                type: 'array',
                                                items: availableSlotSchema,
                                            },
                                            days: {
                                                type: 'array',
                                                items: bookingAvailabilityDaySchema,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/bookings': {
        get: {
            tags: ['Bookings'],
            summary: 'Get my bookings',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                { name: 'status', in: 'query', schema: { type: 'string' } },
                { name: 'garage_id', in: 'query', schema: { type: 'string' } },
                { name: 'vehicle_id', in: 'query', schema: { type: 'string' } },
                { name: 'service_package_id', in: 'query', schema: { type: 'string' } },
                { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
                { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
            ],
            responses: {
                200: {
                    description: 'Bookings',
                    content: { 'application/json': { schema: bookingListResponse } },
                },
                ...commonErrorResponses,
            },
        },
        post: {
            tags: ['Bookings'],
            summary: 'Create customer booking',
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: true,
                content: { 'application/json': { schema: createCustomerBookingRequest } },
            },
            responses: {
                201: {
                    description: 'Booking created',
                    content: { 'application/json': { schema: successBookingResponse } },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/bookings/{id}': {
        get: {
            tags: ['Bookings'],
            summary: 'Get my booking by id',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Booking detail',
                    content: { 'application/json': { schema: successBookingResponse } },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/bookings/{id}/cancel': {
        patch: {
            tags: ['Bookings'],
            summary: 'Cancel my booking',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            ],
            requestBody: {
                required: false,
                content: { 'application/json': { schema: cancelBookingRequest } },
            },
            responses: {
                200: {
                    description: 'Booking canceled',
                    content: { 'application/json': { schema: successBookingResponse } },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/bookings': {
        get: {
            tags: ['Admin Bookings'],
            summary: 'Get all bookings for staff or admin',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                { name: 'search', in: 'query', schema: { type: 'string' } },
                { name: 'status', in: 'query', schema: { type: 'string' } },
                { name: 'garage_id', in: 'query', schema: { type: 'string' } },
                { name: 'customer_id', in: 'query', schema: { type: 'string' } },
                { name: 'vehicle_id', in: 'query', schema: { type: 'string' } },
                { name: 'service_package_id', in: 'query', schema: { type: 'string' } },
                { name: 'vehicle_type', in: 'query', schema: { type: 'string', enum: ['MOTORBIKE', 'CAR'] } },
                { name: 'is_walk_in', in: 'query', schema: { type: 'boolean' } },
                { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
                { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
            ],
            responses: {
                200: {
                    description: 'Bookings',
                    content: { 'application/json': { schema: bookingListResponse } },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/bookings/{id}': {
        get: {
            tags: ['Admin Bookings'],
            summary: 'Get booking detail for staff or admin',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Booking detail',
                    content: { 'application/json': { schema: successBookingResponse } },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/bookings/walk-in': {
        post: {
            tags: ['Admin Bookings'],
            summary: 'Create scheduled or immediate walk-in booking',
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: true,
                content: { 'application/json': { schema: createWalkInBookingRequest } },
            },
            responses: {
                201: {
                    description: 'Walk-in booking created',
                    content: { 'application/json': { schema: successBookingResponse } },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/bookings/{id}/cancel': {
        patch: {
            tags: ['Admin Bookings'],
            summary: 'Cancel booking as staff or admin',
            description: 'Redeemed loyalty points are refunded for normal staff cancellations. If the booking has already recorded arrival_status=LATE, the booking is canceled without refunding redeemed points.',
            security: [{ bearerAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            requestBody: {
                required: false,
                content: { 'application/json': { schema: cancelBookingRequest } },
            },
            responses: {
                200: {
                    description: 'Booking canceled',
                    content: { 'application/json': { schema: successBookingResponse } },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/bookings/{id}/mark-no-show': {
        patch: {
            tags: ['Admin Bookings'],
            summary: 'Mark booking as no-show',
            security: [{ bearerAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            requestBody: {
                required: false,
                content: { 'application/json': { schema: markNoShowRequest } },
            },
            responses: {
                200: {
                    description: 'Booking marked no-show',
                    content: { 'application/json': { schema: successBookingResponse } },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/bookings/{id}/check-in': {
        patch: {
            tags: ['Admin Bookings'],
            summary: 'Check in booking',
            security: [{ bearerAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            requestBody: {
                required: false,
                content: { 'application/json': { schema: startServiceRequest } },
            },
            responses: {
                200: {
                    description: 'Booking checked in',
                    content: { 'application/json': { schema: successBookingResponse } },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/bookings/{id}/late-arrival-options': {
        get: {
            tags: ['Admin Bookings'],
            summary: 'Get available reschedule options for a late arrival',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                { name: 'days', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 7, default: 1 } },
            ],
            responses: {
                200: {
                    description: 'Late arrival options',
                    content: { 'application/json': { schema: lateArrivalOptionsResponse } },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/bookings/{id}/resolve-late-arrival': {
        patch: {
            tags: ['Admin Bookings'],
            summary: 'Accept the original window or reschedule a late booking',
            security: [{ bearerAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            requestBody: {
                required: true,
                content: { 'application/json': { schema: resolveLateArrivalRequest } },
            },
            responses: {
                200: {
                    description: 'Late arrival resolved',
                    content: { 'application/json': { schema: successBookingResponse } },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/bookings/{id}/assign-wash-bay': {
        patch: {
            tags: ['Admin Bookings'],
            summary: 'Assign wash bay to booking',
            security: [{ bearerAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            requestBody: {
                required: false,
                content: { 'application/json': { schema: assignWashBayRequest } },
            },
            responses: {
                200: {
                    description: 'Wash bay assigned',
                    content: { 'application/json': { schema: successBookingResponse } },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/bookings/{id}/assign-inspection-staff': {
        patch: {
            tags: ['Bookings'],
            summary: 'Assign inspection staff to booking',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            ],
            requestBody: {
                required: true,
                content: { 'application/json': { schema: assignStaffRequest } },
            },
            responses: {
                200: { description: 'Inspection staff assigned', content: { 'application/json': { schema: successBookingResponse } } },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/bookings/{id}/start-service': {
        patch: {
            tags: ['Admin Bookings'],
            summary: 'Start booking service',
            security: [{ bearerAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            requestBody: {
                required: false,
                content: { 'application/json': { schema: bookingOperationRequest } },
            },
            responses: {
                200: {
                    description: 'Service started',
                    content: { 'application/json': { schema: startServiceResponse } },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/bookings/{id}/service-steps': {
        get: {
            tags: ['Booking Service Steps'],
            summary: 'Get booking service steps',
            security: [{ bearerAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            responses: {
                200: {
                    description: 'Booking service steps',
                    content: { 'application/json': { schema: serviceStepListResponse } },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/bookings/{id}/service-workflow': {
        get: {
            tags: ['Booking Service Steps'],
            summary: 'Get current service item, countdown and workflow controls',
            security: [{ bearerAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            responses: {
                200: {
                    description: 'Booking service workflow',
                    content: { 'application/json': { schema: serviceWorkflowResponse } },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/bookings/{id}/service-steps/{stepId}/done': {
        patch: {
            tags: ['Booking Service Steps'],
            summary: 'Complete booking service step',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                { name: 'stepId', in: 'path', required: true, schema: { type: 'string' } },
            ],
            requestBody: {
                required: false,
                content: { 'application/json': { schema: serviceStepDoneRequest } },
            },
            responses: {
                200: {
                    description: 'Step completed',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: { type: 'boolean', example: true },
                                    message: { type: 'string' },
                                    data: bookingServiceStepSchema,
                                },
                            },
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/bookings/{id}/service-items/{itemKey}/complete-early': {
        patch: {
            tags: ['Booking Service Steps'],
            summary: 'Complete the current service item before its countdown ends and start the next item',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                { name: 'itemKey', in: 'path', required: true, schema: { type: 'string' } },
            ],
            requestBody: {
                required: false,
                content: { 'application/json': { schema: bookingOperationRequest } },
            },
            responses: {
                200: {
                    description: 'Service item completed early',
                    content: { 'application/json': { schema: serviceWorkflowResponse } },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/bookings/{id}/service-items/{itemKey}/confirm-complete': {
        patch: {
            tags: ['Booking Service Steps'],
            summary: 'Confirm a timed-out manual service item and start the next item',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                { name: 'itemKey', in: 'path', required: true, schema: { type: 'string' } },
            ],
            requestBody: {
                required: false,
                content: { 'application/json': { schema: bookingOperationRequest } },
            },
            responses: {
                200: {
                    description: 'Service item completion confirmed',
                    content: { 'application/json': { schema: serviceWorkflowResponse } },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/bookings/{id}/service-items/{itemKey}/pause': {
        patch: {
            tags: ['Booking Service Steps'],
            summary: 'Pause the current service item countdown',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                { name: 'itemKey', in: 'path', required: true, schema: { type: 'string' } },
            ],
            requestBody: {
                required: true,
                content: { 'application/json': { schema: pauseServiceItemRequest } },
            },
            responses: {
                200: {
                    description: 'Service item paused',
                    content: { 'application/json': { schema: serviceWorkflowResponse } },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/bookings/{id}/service-items/{itemKey}/resume': {
        patch: {
            tags: ['Booking Service Steps'],
            summary: 'Resume the current paused service item countdown',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                { name: 'itemKey', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
                200: {
                    description: 'Service item resumed',
                    content: { 'application/json': { schema: serviceWorkflowResponse } },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/bookings/{id}/service-items/{itemKey}/assign-staff': {
        patch: {
            tags: ['Bookings'],
            summary: 'Assign execution staff to service item',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                { name: 'itemKey', in: 'path', required: true, schema: { type: 'string' } },
            ],
            requestBody: {
                required: true,
                content: { 'application/json': { schema: assignStaffRequest } },
            },
            responses: {
                200: { description: 'Execution staff assigned', content: { 'application/json': { schema: serviceWorkflowResponse } } },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/bookings/{id}/complete-service': {
        patch: {
            tags: ['Admin Bookings'],
            summary: 'Complete booking service',
            security: [{ bearerAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            requestBody: {
                required: false,
                content: { 'application/json': { schema: bookingOperationRequest } },
            },
            responses: {
                200: {
                    description: 'Service completed',
                    content: { 'application/json': { schema: successBookingResponse } },
                },
                ...commonErrorResponses,
            },
        },
    },

    '/admin/bookings/{id}/reopen-service': {
        patch: {
            tags: ['Admin Bookings'],
            summary: 'Reopen completed unpaid booking service',
            security: [{ bearerAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            requestBody: {
                required: false,
                content: { 'application/json': { schema: bookingOperationRequest } },
            },
            responses: {
                200: {
                    description: 'Booking reopened',
                    content: { 'application/json': { schema: successBookingResponse } },
                },
                ...commonErrorResponses,
            },
        },
    },

    '/admin/bookings/{id}/mark-paid': {
        patch: {
            tags: ['Admin Bookings'],
            summary: 'Confirm cash payment for a completed booking',
            description: 'If the booking has a pending PayOS payment, the server verifies its provider status and cancels or finalizes its cancellation before confirming cash payment. A PayOS payment that completes concurrently is preserved and is not overwritten as cash.',
            security: [{ bearerAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            requestBody: {
                required: false,
                content: { 'application/json': { schema: bookingOperationRequest } },
            },
            responses: {
                200: {
                    description: 'Booking payment confirmed; any pending PayOS payment was resolved by the server',
                    content: { 'application/json': { schema: markPaidResponse } },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/admin/bookings/{id}/inspections': {
        get: {
            tags: ['Vehicle Inspections'],
            summary: 'Get booking inspections for staff or admin',
            security: [{ bearerAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            responses: {
                200: {
                    description: 'Vehicle inspections',
                    content: { 'application/json': { schema: vehicleInspectionListResponse } },
                },
                ...commonErrorResponses,
            },
        },
        post: {
            tags: ['Vehicle Inspections'],
            summary: 'Create vehicle inspection',
            security: [{ bearerAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            requestBody: {
                required: true,
                content: { 'application/json': { schema: createVehicleInspectionRequest } },
            },
            responses: {
                201: {
                    description: 'Vehicle inspection created',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    success: { type: 'boolean', example: true },
                                    message: { type: 'string' },
                                    data: vehicleInspectionSchema,
                                },
                            },
                        },
                    },
                },
                ...commonErrorResponses,
            },
        },
    },
    '/bookings/{id}/inspections': {
        get: {
            tags: ['Vehicle Inspections'],
            summary: 'Get my booking inspections',
            security: [{ bearerAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            responses: {
                200: {
                    description: 'Vehicle inspections',
                    content: { 'application/json': { schema: vehicleInspectionListResponse } },
                },
                ...commonErrorResponses,
            },
        },
    },
};

const schemas = {
    Booking: bookingSchema,
    AvailableBookingSlot: availableSlotSchema,
    CreateCustomerBookingRequest: createCustomerBookingRequest,
    CreateWalkInBookingRequest: createWalkInBookingRequest,
    CancelBookingRequest: cancelBookingRequest,
    MarkNoShowRequest: markNoShowRequest,
    ResolveLateArrivalRequest: resolveLateArrivalRequest,
    BookingOperationRequest: bookingOperationRequest,
    StartServiceRequest: startServiceRequest,
    AssignWashBayRequest: assignWashBayRequest,
    ServiceStepDoneRequest: serviceStepDoneRequest,
    PauseServiceItemRequest: pauseServiceItemRequest,
};

module.exports = {
    tags,
    paths,
    schemas,
};
