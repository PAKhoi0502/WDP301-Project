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

const bookingSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        customer_id: { type: 'string', nullable: true },
        vehicle_id: { type: 'string', nullable: true },
        is_walk_in: { type: 'boolean' },
        guest_name: { type: 'string', nullable: true },
        guest_phone: { type: 'string', nullable: true },
        guest_email: { type: 'string', nullable: true },
        license_plate: { type: 'string', nullable: true },
        normalized_license_plate: { type: 'string', nullable: true },
        vehicle_type: { type: 'string', enum: ['MOTORBIKE', 'CAR'] },
        created_by_staff_id: { type: 'string', nullable: true },
        garage_id: { type: 'string' },
        wash_bay_id: { type: 'string', nullable: true },
        service_package_id: { type: 'string' },
        booking_date: { type: 'string', format: 'date-time' },
        start_time: { type: 'string', format: 'date-time' },
        end_time: { type: 'string', format: 'date-time' },
        wash_bay_start_time: { type: 'string', format: 'date-time', nullable: true },
        wash_bay_end_time: { type: 'string', format: 'date-time', nullable: true },
        original_price: { type: 'number' },
        promotion_discount_amount: { type: 'number' },
        points_discount_amount: { type: 'number' },
        discount_amount: { type: 'number' },
        final_price: { type: 'number' },
        payment_method: { type: 'string', enum: ['CASH'] },
        payment_status: { type: 'string', enum: ['UNPAID', 'PAID'] },
        used_points: { type: 'number' },
        earned_points: { type: 'number' },
        promotion_id: { type: 'string', nullable: true },
        requires_wash_bay: { type: 'boolean' },
        status: {
            type: 'string',
            enum: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELED', 'NO_SHOW'],
        },
        checked_in_at: { type: 'string', format: 'date-time', nullable: true },
        started_at: { type: 'string', format: 'date-time', nullable: true },
        completed_at: { type: 'string', format: 'date-time', nullable: true },
        paid_at: { type: 'string', format: 'date-time', nullable: true },
        canceled_at: { type: 'string', format: 'date-time', nullable: true },
        canceled_by_id: { type: 'string', nullable: true },
        cancel_reason: { type: 'string', nullable: true },
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
        is_available: { type: 'boolean' },
        available_capacity: { type: 'number', nullable: true },
    },
};

const createCustomerBookingRequest = {
    type: 'object',
    required: ['garage_id', 'vehicle_id', 'service_package_id', 'start_time'],
    properties: {
        garage_id: { type: 'string', example: '665f0d3d8b4f5d0012a00001' },
        vehicle_id: { type: 'string', example: '665f0d3d8b4f5d0012a00002' },
        service_package_id: { type: 'string', example: '665f0d3d8b4f5d0012a00003' },
        start_time: { type: 'string', format: 'date-time', example: '2026-06-10T09:00:00+07:00' },
        note: { type: 'string', example: 'Please prepare before arrival' },
    },
};

const createWalkInBookingRequest = {
    type: 'object',
    required: ['garage_id', 'service_package_id', 'start_time', 'guest_name', 'guest_phone', 'license_plate', 'vehicle_type'],
    properties: {
        garage_id: { type: 'string', example: '665f0d3d8b4f5d0012a00001' },
        service_package_id: { type: 'string', example: '665f0d3d8b4f5d0012a00003' },
        start_time: { type: 'string', format: 'date-time', example: '2026-06-10T09:00:00+07:00' },
        guest_name: { type: 'string', example: 'Guest Customer' },
        guest_phone: { type: 'string', example: '0901234567' },
        guest_email: { type: 'string', example: 'guest@example.com' },
        license_plate: { type: 'string', example: '59A-123.45' },
        vehicle_type: { type: 'string', enum: ['MOTORBIKE', 'CAR'], example: 'CAR' },
        note: { type: 'string', example: 'Walk-in customer' },
    },
};

const cancelBookingRequest = {
    type: 'object',
    properties: {
        reason: { type: 'string', example: 'Customer changed schedule' },
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

const assignWashBayRequest = {
    type: 'object',
    properties: {
        wash_bay_id: { type: 'string', nullable: true },
    },
};

const serviceStepDoneRequest = {
    type: 'object',
    properties: {
        note: { type: 'string' },
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
            summary: 'Get available booking slots',
            parameters: [
                { name: 'garage_id', in: 'query', required: true, schema: { type: 'string' } },
                { name: 'service_package_id', in: 'query', required: true, schema: { type: 'string' } },
                { name: 'date', in: 'query', required: true, schema: { type: 'string', example: '2026-06-10' } },
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
                                            service_package_id: { type: 'string' },
                                            date: { type: 'string' },
                                            vehicle_type: { type: 'string' },
                                            requires_wash_bay: { type: 'boolean' },
                                            slot_interval_minutes: { type: 'number' },
                                            active_wash_bay_count: { type: 'number', nullable: true },
                                            slots: {
                                                type: 'array',
                                                items: availableSlotSchema,
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
    '/admin/bookings/walk-in': {
        post: {
            tags: ['Admin Bookings'],
            summary: 'Create walk-in booking',
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
    '/admin/bookings/{id}/check-in': {
        patch: {
            tags: ['Admin Bookings'],
            summary: 'Check in booking',
            security: [{ bearerAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            requestBody: {
                required: false,
                content: { 'application/json': { schema: bookingOperationRequest } },
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

    '/admin/bookings/{id}/mark-paid': {
        patch: {
            tags: ['Admin Bookings'],
            summary: 'Mark completed booking as paid and process reward',
            security: [{ bearerAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            requestBody: {
                required: false,
                content: { 'application/json': { schema: bookingOperationRequest } },
            },
            responses: {
                200: {
                    description: 'Booking marked as paid',
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
    BookingOperationRequest: bookingOperationRequest,
    AssignWashBayRequest: assignWashBayRequest,
    ServiceStepDoneRequest: serviceStepDoneRequest,
};

module.exports = {
    tags,
    paths,
    schemas,
};
