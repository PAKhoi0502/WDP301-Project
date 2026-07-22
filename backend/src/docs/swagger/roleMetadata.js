const {
    STAFF_CAPABILITIES,
    STAFF_CAPABILITY_VALUES,
} = require('../../shared/constants/staff.constant');

const HTTP_METHODS = Object.freeze(['get', 'post', 'put', 'patch', 'delete']);

const ROLE_DETAILS = Object.freeze({
    PUBLIC: {
        label: 'PUBLIC',
        auth: 'No access token required.',
    },
    OPTIONAL_AUTH: {
        label: 'OPTIONAL AUTH',
        auth: 'Bearer JWT is optional. The endpoint also accepts anonymous requests.',
    },
    AUTHENTICATED: {
        label: 'AUTHENTICATED',
        auth: 'Bearer JWT required. Any active user role can call this endpoint.',
    },
    CUSTOMER: {
        label: 'CUSTOMER',
        auth: 'Bearer JWT required. User role must be CUSTOMER.',
    },
    STAFF: {
        label: 'STAFF',
        auth: 'Bearer JWT required. User role must be STAFF.',
    },
    ADMIN: {
        label: 'ADMIN',
        auth: 'Bearer JWT required. User role must be ADMIN.',
    },
    CAMERA_DEVICE: {
        label: 'CAMERA DEVICE',
        auth: 'X-Camera-Device-Code and X-Camera-Device-Key headers are required.',
    },
});

const STAFF_GARAGE_SCOPE = 'STAFF access is limited by assigned garage where the service enforces garage scope. ADMIN access is system-wide unless a request filter is provided.';

const STAFF_OPERATION_POLICIES = new Map();

const addStaffOperationPolicies = ({
    operations,
    capabilities,
    match = 'all',
    resourceScope,
    selector,
}) => {
    const invalidCapabilities = capabilities.filter(
        (capability) => !STAFF_CAPABILITY_VALUES.includes(capability)
    );

    if (invalidCapabilities.length > 0) {
        throw new Error(`Invalid OpenAPI staff capabilities: ${invalidCapabilities.join(', ')}`);
    }

    operations.forEach((operation) => {
        if (STAFF_OPERATION_POLICIES.has(operation)) {
            throw new Error(`Duplicate OpenAPI staff capability policy for ${operation}`);
        }

        STAFF_OPERATION_POLICIES.set(operation, Object.freeze({
            capabilities: Object.freeze([...capabilities]),
            match,
            resourceScope,
            ...(selector ? { selector } : {}),
        }));
    });
};

addStaffOperationPolicies({
    operations: ['GET /admin/customers'],
    capabilities: [STAFF_CAPABILITIES.CUSTOMER_READ_GARAGE],
    resourceScope: 'garage',
});

addStaffOperationPolicies({
    operations: [
        'GET /staff/workspace/bookings',
        'GET /staff/workspace/bookings/{bookingId}/workflow',
    ],
    capabilities: [STAFF_CAPABILITIES.BOOKING_WORKFLOW_READ_GARAGE],
    resourceScope: 'garage',
});

addStaffOperationPolicies({
    operations: ['PATCH /staff/workspace/bookings/{bookingId}/claim-inspection'],
    capabilities: [STAFF_CAPABILITIES.INSPECTION_CLAIM_GARAGE],
    resourceScope: 'garage-unassigned',
});

addStaffOperationPolicies({
    operations: [
        'GET /admin/bookings',
        'GET /admin/bookings/{id}',
    ],
    capabilities: [
        STAFF_CAPABILITIES.BOOKING_READ_GARAGE,
        STAFF_CAPABILITIES.BOOKING_READ_ASSIGNED,
    ],
    match: 'any',
    resourceScope: 'garage-or-assigned',
});

[
    [['POST /admin/bookings/walk-in'], STAFF_CAPABILITIES.BOOKING_WALK_IN_CREATE],
    [['PATCH /admin/bookings/{id}/cancel'], STAFF_CAPABILITIES.BOOKING_CANCEL_CUSTOMER_REQUEST],
    [['PATCH /admin/bookings/{id}/mark-no-show'], STAFF_CAPABILITIES.BOOKING_ARRIVAL_MANAGE],
    [['PATCH /admin/bookings/{id}/check-in'], STAFF_CAPABILITIES.BOOKING_CHECK_IN],
    [
        [
            'GET /admin/bookings/{id}/late-arrival-options',
            'PATCH /admin/bookings/{id}/resolve-late-arrival',
        ],
        STAFF_CAPABILITIES.BOOKING_LATE_ARRIVAL_MANAGE,
    ],
    [['PATCH /admin/bookings/{id}/assign-wash-bay'], STAFF_CAPABILITIES.BOOKING_WASH_BAY_ASSIGN],
    [['PATCH /admin/bookings/{id}/start-service'], STAFF_CAPABILITIES.BOOKING_SERVICE_START],
    [['PATCH /admin/bookings/{id}/complete-service'], STAFF_CAPABILITIES.BOOKING_SERVICE_COMPLETE],
    [['PATCH /admin/bookings/{id}/mark-paid'], STAFF_CAPABILITIES.BOOKING_PAYMENT_COLLECT_CASH],
    [
        ['GET /admin/bookings/{id}/incidents/{incidentId}/resolution-options'],
        STAFF_CAPABILITIES.INCIDENT_READ_GARAGE,
    ],
    [
        ['PATCH /admin/bookings/{id}/incidents/{incidentId}/record-customer-decision'],
        STAFF_CAPABILITIES.INCIDENT_RECORD_CUSTOMER_DECISION,
    ],
    [
        ['POST /admin/bookings/{id}/incidents/{incidentId}/compensation-vouchers'],
        STAFF_CAPABILITIES.INCIDENT_COMPENSATION_ISSUE,
    ],
].forEach(([operations, capability]) => {
    addStaffOperationPolicies({
        operations,
        capabilities: [capability],
        resourceScope: 'garage',
    });
});

addStaffOperationPolicies({
    operations: ['POST /admin/bookings/{id}/incidents'],
    capabilities: [
        STAFF_CAPABILITIES.INCIDENT_REPORT_WASH_BAY_FAILURE,
        STAFF_CAPABILITIES.INCIDENT_REPORT_STAFF_UNAVAILABLE,
        STAFF_CAPABILITIES.INCIDENT_REPORT_OTHER_GARAGE,
    ],
    match: 'resolved',
    resourceScope: 'garage-or-assigned',
    selector: 'request.body.incident_type',
});

addStaffOperationPolicies({
    operations: ['GET /admin/bookings/{id}/incidents/active'],
    capabilities: [
        STAFF_CAPABILITIES.INCIDENT_READ_GARAGE,
        STAFF_CAPABILITIES.INCIDENT_READ_ASSIGNED,
    ],
    match: 'any',
    resourceScope: 'garage-or-assigned',
});

addStaffOperationPolicies({
    operations: [
        'GET /admin/bookings/{id}/service-steps',
        'GET /admin/bookings/{id}/service-workflow',
    ],
    capabilities: [
        STAFF_CAPABILITIES.BOOKING_SERVICE_READ_GARAGE,
        STAFF_CAPABILITIES.SERVICE_TASK_READ_ASSIGNED,
    ],
    match: 'any',
    resourceScope: 'garage-or-assigned',
});

addStaffOperationPolicies({
    operations: [
        'PATCH /admin/bookings/{id}/service-steps/{stepId}/done',
        'PATCH /admin/bookings/{id}/service-items/{itemKey}/complete-early',
        'PATCH /admin/bookings/{id}/service-items/{itemKey}/confirm-complete',
        'PATCH /admin/bookings/{id}/service-items/{itemKey}/pause',
        'PATCH /admin/bookings/{id}/service-items/{itemKey}/resume',
    ],
    capabilities: [
        STAFF_CAPABILITIES.SERVICE_TASK_WASH_EXECUTE_ASSIGNED,
        STAFF_CAPABILITIES.SERVICE_TASK_CARE_EXECUTE_ASSIGNED,
    ],
    match: 'any',
    resourceScope: 'assigned',
});

addStaffOperationPolicies({
    operations: ['GET /admin/bookings/{id}/inspections'],
    capabilities: [
        STAFF_CAPABILITIES.INSPECTION_READ_GARAGE,
        STAFF_CAPABILITIES.INSPECTION_READ_ASSIGNED,
    ],
    match: 'any',
    resourceScope: 'garage-or-assigned',
});

addStaffOperationPolicies({
    operations: ['POST /admin/bookings/{id}/inspections'],
    capabilities: [STAFF_CAPABILITIES.INSPECTION_CREATE_ASSIGNED],
    resourceScope: 'assigned',
});

addStaffOperationPolicies({
    operations: ['GET /staff/booking-arrivals/arrival-queue'],
    capabilities: [STAFF_CAPABILITIES.BOOKING_ARRIVAL_QUEUE],
    resourceScope: 'garage',
});

addStaffOperationPolicies({
    operations: [
        'GET /staff/booking-arrivals/plate-scans',
        'POST /staff/booking-arrivals/plate-scans',
        'GET /staff/booking-arrivals/plate-scans/{scanId}',
        'POST /staff/booking-arrivals/plate-scans/{scanId}/retry',
        'POST /staff/booking-arrivals/plate-scans/{scanId}/reject',
    ],
    capabilities: [STAFF_CAPABILITIES.BOOKING_PLATE_SCAN],
    resourceScope: 'garage',
});

addStaffOperationPolicies({
    operations: [
        'POST /staff/booking-arrivals/plate-scans/{scanId}/confirm',
        'POST /staff/booking-arrivals/plate-scans/{scanId}/alternate-vehicle',
    ],
    capabilities: [STAFF_CAPABILITIES.BOOKING_CHECK_IN],
    resourceScope: 'garage',
});

addStaffOperationPolicies({
    operations: [
        'GET /admin/bookings/{id}/handover',
        'PATCH /admin/bookings/{id}/handover/ready',
        'PATCH /admin/bookings/{id}/handover/release',
    ],
    capabilities: [STAFF_CAPABILITIES.BOOKING_HANDOVER_MANAGE_GARAGE],
    resourceScope: 'garage',
});

[
    [
        ['GET /admin/customer-cases', 'GET /admin/customer-cases/{id}'],
        STAFF_CAPABILITIES.CUSTOMER_CASE_READ_GARAGE,
        'garage',
    ],
    [
        [
            'PATCH /admin/customer-cases/{id}/assign',
            'PATCH /staff/customer-cases/{id}/technical-assessment/assign',
        ],
        STAFF_CAPABILITIES.CUSTOMER_CASE_ASSIGN_GARAGE,
        'garage',
    ],
    [
        ['PATCH /admin/customer-cases/{id}/acknowledge'],
        STAFF_CAPABILITIES.CUSTOMER_CASE_ACKNOWLEDGE,
        'assigned',
    ],
    [
        [
            'POST /admin/customer-cases/{id}/evidence',
            'POST /admin/customer-cases/{id}/messages',
            'PATCH /staff/customer-cases/{id}/walk-in-resolution-response',
        ],
        STAFF_CAPABILITIES.CUSTOMER_CASE_COMMUNICATE_ASSIGNED,
        'assigned',
    ],
    [
        ['GET /staff/customer-cases/sla-dashboard'],
        STAFF_CAPABILITIES.CUSTOMER_CASE_SLA_READ_GARAGE,
        'garage',
    ],
    [
        [
            'POST /staff/customer-cases/walk-in/otp/request',
            'POST /staff/customer-cases/walk-in/otp/verify',
            'POST /staff/customer-cases/walk-in',
        ],
        STAFF_CAPABILITIES.CUSTOMER_CASE_CREATE_WALK_IN,
        'garage',
    ],
    [
        [
            'GET /staff/customer-cases/{id}/technical-assessment',
            'PATCH /staff/customer-cases/{id}/technical-assessment/start',
            'POST /staff/customer-cases/{id}/technical-assessment/submit',
        ],
        STAFF_CAPABILITIES.CUSTOMER_CASE_TECHNICAL_ASSESS_ASSIGNED,
        'assigned',
    ],
    [
        [
            'GET /admin/waitlists',
            'PATCH /admin/waitlists/{id}/cancel',
            'PATCH /admin/waitlists/{id}/offer',
            'PATCH /admin/waitlists/{id}/expire',
        ],
        STAFF_CAPABILITIES.WAITLIST_MANAGE_GARAGE,
        'garage',
    ],
    [
        ['GET /admin/customer-vouchers'],
        STAFF_CAPABILITIES.VOUCHER_READ_GARAGE,
        'garage',
    ],
    [
        ['GET /admin/wash-histories', 'GET /admin/wash-histories/{id}'],
        STAFF_CAPABILITIES.WASH_HISTORY_READ_GARAGE,
        'garage',
    ],
    [
        [
            'POST /admin/payments/bookings/{bookingId}/payos',
            'GET /admin/payments/bookings/{bookingId}/payos',
            'GET /admin/payments/{paymentId}',
            'PATCH /admin/payments/{paymentId}/cancel',
            'PATCH /admin/payments/{paymentId}/expire',
        ],
        STAFF_CAPABILITIES.PAYMENT_MANAGE_GARAGE,
        'garage',
    ],
].forEach(([operations, capability, resourceScope]) => {
    addStaffOperationPolicies({
        operations,
        capabilities: [capability],
        resourceScope,
    });
});

const ROUTE_GROUPS = Object.freeze([
    {
        roles: ['OPTIONAL_AUTH'],
        feature: 'Auth phone verification',
        operations: [
            'POST /auth/phone-verifications/request',
            'POST /auth/phone-verifications/verify',
        ],
    },
    {
        roles: ['PUBLIC'],
        feature: 'Auth and session',
        operations: [
            'POST /auth/register',
            'POST /auth/login',
            'POST /auth/refresh',
            'POST /auth/logout',
            'POST /auth/forgot-password',
            'POST /auth/reset-password',
            'POST /auth/staff-invitations/accept',
        ],
    },
    {
        roles: ['AUTHENTICATED'],
        feature: 'Auth and session',
        operations: [
            'POST /auth/logout-all',
            'GET /auth/me',
            'POST /auth/change-password',
        ],
    },
    {
        roles: ['AUTHENTICATED'],
        feature: 'User profile',
        operations: [
            'GET /users/me',
            'PATCH /users/me',
        ],
    },
    {
        roles: ['ADMIN'],
        feature: 'User management',
        operations: [
            'GET /users',
            'GET /users/{id}',
            'PATCH /users/{id}',
            'DELETE /users/{id}',
            'PATCH /users/{id}/status',
            'PATCH /users/{id}/role',
        ],
    },
    {
        roles: ['STAFF'],
        feature: 'Staff profile',
        operations: [
            'GET /staff-profiles/me',
            'GET /staff-profiles/me/capabilities',
            'GET /staff-profiles/me/type-change-requests',
            'POST /staff-profiles/me/type-change-requests',
        ],
    },
    {
        roles: ['STAFF', 'ADMIN'],
        feature: 'Staff position change',
        operations: [
            'PATCH /staff-profiles/type-change-requests/{requestId}/cancel',
        ],
    },
    {
        roles: ['ADMIN'],
        feature: 'Staff profile management',
        operations: [
            'GET /staff-profiles',
            'POST /staff-profiles',
            'POST /staff-profiles/invitations',
            'POST /staff-profiles/{id}/invitations/resend',
            'GET /staff-profiles/{id}',
            'PATCH /staff-profiles/{id}',
            'DELETE /staff-profiles/{id}',
            'PATCH /staff-profiles/{id}/status',
            'PATCH /staff-profiles/{id}/employment-status',
            'GET /staff-profiles/type-change-requests',
            'PATCH /staff-profiles/type-change-requests/{requestId}/approve',
            'PATCH /staff-profiles/type-change-requests/{requestId}/reject',
            'GET /staff-profiles/{id}/type-change-impact',
            'GET /staff-profiles/{id}/type-change-history',
        ],
    },
    {
        roles: ['PUBLIC'],
        feature: 'Garage browsing',
        operations: [
            'GET /garages',
            'GET /garages/{id}',
        ],
    },
    {
        roles: ['ADMIN'],
        feature: 'Garage management',
        operations: [
            'GET /admin/garages',
            'POST /admin/garages',
            'GET /admin/garages/{id}',
            'PATCH /admin/garages/{id}',
            'DELETE /admin/garages/{id}',
            'PATCH /admin/garages/{id}/status',
        ],
    },
    {
        roles: ['ADMIN'],
        feature: 'Wash bay management',
        operations: [
            'GET /admin/wash-bays',
            'POST /admin/wash-bays',
            'GET /admin/wash-bays/{id}',
            'PATCH /admin/wash-bays/{id}',
            'DELETE /admin/wash-bays/{id}',
            'PATCH /admin/wash-bays/{id}/status',
            'GET /admin/garages/{garageId}/wash-bays',
            'GET /admin/garages/{garageId}/available-wash-bays',
        ],
    },
    {
        roles: ['CUSTOMER'],
        feature: 'My vehicles',
        operations: [
            'GET /vehicles',
            'POST /vehicles',
            'GET /vehicles/{id}',
            'PATCH /vehicles/{id}',
            'DELETE /vehicles/{id}',
        ],
    },
    {
        roles: ['ADMIN'],
        feature: 'Vehicle management',
        operations: [
            'GET /admin/vehicles',
            'POST /admin/vehicles',
            'GET /admin/vehicles/{id}',
            'PATCH /admin/vehicles/{id}',
            'DELETE /admin/vehicles/{id}',
        ],
    },
    {
        roles: ['STAFF', 'ADMIN'],
        feature: 'Customer search',
        scope: STAFF_GARAGE_SCOPE,
        operations: [
            'GET /admin/customers',
        ],
    },
    {
        roles: ['PUBLIC'],
        feature: 'Service package browsing',
        operations: [
            'GET /service-packages',
            'GET /service-packages/{id}',
        ],
    },
    {
        roles: ['ADMIN'],
        feature: 'Service package management',
        operations: [
            'GET /admin/service-packages',
            'POST /admin/service-packages',
            'GET /admin/service-packages/{id}',
            'PATCH /admin/service-packages/{id}',
            'DELETE /admin/service-packages/{id}',
            'PATCH /admin/service-packages/{id}/activate',
            'PATCH /admin/service-packages/{id}/deactivate',
            'PATCH /admin/service-packages/{id}/steps-template',
            'PATCH /admin/service-packages/{id}/included-services',
        ],
    },
    {
        roles: ['OPTIONAL_AUTH'],
        feature: 'Booking availability',
        operations: [
            'GET /bookings/available-slots',
        ],
    },
    {
        roles: ['CUSTOMER'],
        feature: 'My bookings',
        operations: [
            'GET /bookings',
            'POST /bookings',
            'GET /bookings/{id}',
            'PATCH /bookings/{id}/cancel',
            'GET /bookings/{id}/incidents/active',
            'PATCH /bookings/{id}/incidents/{incidentId}/decision',
        ],
    },
    {
        roles: ['CUSTOMER'],
        feature: 'My booking inspections',
        operations: [
            'GET /bookings/{id}/inspections',
        ],
    },
    {
        roles: ['CUSTOMER'],
        feature: 'Vehicle handover and issue reporting',
        operations: [
            'GET /bookings/{id}/handover',
            'POST /bookings/{id}/handover/accept',
            'POST /bookings/{id}/handover/report',
            'GET /customer-cases',
            'GET /customer-cases/{id}',
            'POST /customer-cases/{id}/evidence',
            'POST /customer-cases/{id}/messages',
            'PATCH /customer-cases/{id}/resolution-response',
            'POST /customer-cases/{id}/reopen',
        ],
    },
    {
        roles: ['STAFF', 'ADMIN'],
        feature: 'Shared booking workflow',
        scope: STAFF_GARAGE_SCOPE,
        operations: [
            'GET /staff/workspace/bookings',
            'GET /staff/workspace/bookings/{bookingId}/workflow',
        ],
    },
    {
        roles: ['STAFF'],
        feature: 'Inspection self-claim',
        scope: STAFF_GARAGE_SCOPE,
        operations: [
            'PATCH /staff/workspace/bookings/{bookingId}/claim-inspection',
        ],
    },
    {
        roles: ['STAFF', 'ADMIN'],
        feature: 'Booking operations',
        scope: STAFF_GARAGE_SCOPE,
        operations: [
            'GET /admin/bookings',
            'GET /admin/bookings/{id}',
            'POST /admin/bookings/walk-in',
            'PATCH /admin/bookings/{id}/cancel',
            'PATCH /admin/bookings/{id}/mark-no-show',
            'PATCH /admin/bookings/{id}/check-in',
            'GET /admin/bookings/{id}/late-arrival-options',
            'PATCH /admin/bookings/{id}/resolve-late-arrival',
            'PATCH /admin/bookings/{id}/assign-wash-bay',
            'PATCH /admin/bookings/{id}/start-service',
            'PATCH /admin/bookings/{id}/complete-service',
            'PATCH /admin/bookings/{id}/mark-paid',
            'POST /admin/bookings/{id}/incidents',
            'GET /admin/bookings/{id}/incidents/active',
            'GET /admin/bookings/{id}/incidents/{incidentId}/resolution-options',
            'PATCH /admin/bookings/{id}/incidents/{incidentId}/record-customer-decision',
            'POST /admin/bookings/{id}/incidents/{incidentId}/compensation-vouchers',
        ],
    },
    {
        roles: ['STAFF', 'ADMIN'],
        feature: 'Booking service steps',
        scope: STAFF_GARAGE_SCOPE,
        operations: [
            'GET /admin/bookings/{id}/service-steps',
            'GET /admin/bookings/{id}/service-workflow',
            'PATCH /admin/bookings/{id}/service-steps/{stepId}/done',
            'PATCH /admin/bookings/{id}/service-items/{itemKey}/complete-early',
            'PATCH /admin/bookings/{id}/service-items/{itemKey}/confirm-complete',
            'PATCH /admin/bookings/{id}/service-items/{itemKey}/pause',
            'PATCH /admin/bookings/{id}/service-items/{itemKey}/resume',
        ],
    },
    {
        roles: ['ADMIN'],
        feature: 'Booking operations',
        operations: [
            'PATCH /admin/bookings/{id}/reopen-service',
            'PATCH /admin/bookings/{id}/assign-inspection-staff',
            'PATCH /admin/bookings/{id}/service-items/{itemKey}/assign-staff',
        ],
    },
    {
        roles: ['STAFF', 'ADMIN'],
        feature: 'Booking inspections',
        scope: STAFF_GARAGE_SCOPE,
        operations: [
            'GET /admin/bookings/{id}/inspections',
            'POST /admin/bookings/{id}/inspections',
        ],
    },
    {
        roles: ['STAFF', 'ADMIN'],
        feature: 'License plate arrival verification',
        scope: STAFF_GARAGE_SCOPE,
        operations: [
            'GET /staff/booking-arrivals/arrival-queue',
            'GET /staff/booking-arrivals/plate-scans',
            'POST /staff/booking-arrivals/plate-scans',
            'GET /staff/booking-arrivals/plate-scans/{scanId}',
            'POST /staff/booking-arrivals/plate-scans/{scanId}/retry',
            'POST /staff/booking-arrivals/plate-scans/{scanId}/confirm',
            'POST /staff/booking-arrivals/plate-scans/{scanId}/reject',
            'POST /staff/booking-arrivals/plate-scans/{scanId}/alternate-vehicle',
        ],
    },
    {
        roles: ['ADMIN'],
        feature: 'License plate arrival administration',
        operations: [
            'GET /admin/booking-arrivals/plate-scans',
            'GET /admin/booking-arrivals/metrics',
            'PATCH /admin/booking-arrivals/plate-scans/{scanId}/alternate-vehicle',
            'GET /admin/booking-arrivals/camera-devices',
            'POST /admin/booking-arrivals/camera-devices',
            'PATCH /admin/booking-arrivals/camera-devices/{id}',
            'POST /admin/booking-arrivals/camera-devices/{id}/rotate-key',
        ],
    },
    {
        roles: ['CAMERA_DEVICE'],
        feature: 'Gate camera ingestion',
        operations: [
            'POST /camera-devices/heartbeat',
            'POST /camera-devices/uploads',
            'POST /camera-devices/events/batch',
        ],
    },
    {
        roles: ['STAFF', 'ADMIN'],
        feature: 'Vehicle handover operations',
        scope: STAFF_GARAGE_SCOPE,
        operations: [
            'GET /admin/bookings/{id}/handover',
            'PATCH /admin/bookings/{id}/handover/ready',
            'PATCH /admin/bookings/{id}/handover/release',
        ],
    },
    {
        roles: ['STAFF', 'ADMIN'],
        feature: 'Customer case operations',
        scope: STAFF_GARAGE_SCOPE,
        operations: [
            'GET /admin/customer-cases',
            'GET /admin/customer-cases/{id}',
            'PATCH /admin/customer-cases/{id}/assign',
            'PATCH /admin/customer-cases/{id}/acknowledge',
            'POST /admin/customer-cases/{id}/evidence',
            'POST /admin/customer-cases/{id}/messages',
            'GET /staff/customer-cases/sla-dashboard',
            'POST /staff/customer-cases/walk-in/otp/request',
            'POST /staff/customer-cases/walk-in/otp/verify',
            'POST /staff/customer-cases/walk-in',
            'PATCH /staff/customer-cases/{id}/technical-assessment/assign',
            'GET /staff/customer-cases/{id}/technical-assessment',
            'PATCH /staff/customer-cases/{id}/technical-assessment/start',
            'POST /staff/customer-cases/{id}/technical-assessment/submit',
            'PATCH /staff/customer-cases/{id}/walk-in-resolution-response',
        ],
    },
    {
        roles: ['ADMIN'],
        feature: 'Customer case resolution',
        operations: [
            'PATCH /admin/customer-cases/{id}/conclude',
            'PATCH /admin/customer-cases/{id}/close',
            'POST /admin/customer-cases/{id}/resolutions',
            'POST /admin/customer-cases/{id}/resolutions/{resolutionId}/apply',
            'PATCH /admin/customer-cases/{id}/refunds/{refundId}',
            'POST /admin/customer-cases/{id}/reopen',
        ],
    },
    {
        roles: ['CUSTOMER'],
        feature: 'My waitlists',
        operations: [
            'GET /waitlists',
            'POST /waitlists',
            'GET /waitlists/{id}',
            'PATCH /waitlists/{id}/cancel',
            'PATCH /waitlists/{id}/accept',
        ],
    },
    {
        roles: ['STAFF', 'ADMIN'],
        feature: 'Waitlist operations',
        scope: STAFF_GARAGE_SCOPE,
        operations: [
            'GET /admin/waitlists',
            'PATCH /admin/waitlists/{id}/cancel',
            'PATCH /admin/waitlists/{id}/offer',
            'PATCH /admin/waitlists/{id}/expire',
        ],
    },
    {
        roles: ['PUBLIC'],
        feature: 'Promotion browsing',
        operations: [
            'GET /promotions',
            'GET /promotions/{id}',
        ],
    },
    {
        roles: ['CUSTOMER'],
        feature: 'Promotion validation',
        operations: [
            'POST /promotions/validate',
        ],
    },
    {
        roles: ['ADMIN'],
        feature: 'Promotion management',
        operations: [
            'GET /admin/promotions',
            'POST /admin/promotions',
            'GET /admin/promotions/{id}',
            'PATCH /admin/promotions/{id}',
            'DELETE /admin/promotions/{id}',
            'PATCH /admin/promotions/{id}/activate',
            'PATCH /admin/promotions/{id}/deactivate',
        ],
    },
    {
        roles: ['CUSTOMER'],
        feature: 'My loyalty',
        operations: [
            'GET /loyalty/me',
            'GET /loyalty/me/transactions',
            'POST /loyalty/redeem-preview',
            'GET /loyalty/tier-rules',
        ],
    },
    {
        roles: ['ADMIN'],
        feature: 'Loyalty expiry',
        operations: [
            'GET /admin/loyalty/expiring-points',
            'POST /admin/loyalty/expire-points',
        ],
    },
    {
        roles: ['ADMIN'],
        feature: 'Customer loyalty management',
        operations: [
            'GET /admin/loyalty/customers',
            'GET /admin/loyalty/customers/{customerId}',
            'GET /admin/loyalty/customers/{customerId}/transactions',
            'GET /admin/loyalty/transactions',
        ],
    },
    {
        roles: ['ADMIN'],
        feature: 'Tier rule management',
        operations: [
            'GET /admin/loyalty/tier-rules',
            'POST /admin/loyalty/tier-rules',
            'GET /admin/loyalty/tier-rules/{tierRuleId}',
            'PATCH /admin/loyalty/tier-rules/{tierRuleId}',
            'DELETE /admin/loyalty/tier-rules/{tierRuleId}',
            'PATCH /admin/loyalty/tier-rules/{tierRuleId}/activate',
            'PATCH /admin/loyalty/tier-rules/{tierRuleId}/deactivate',
        ],
    },
    {
        roles: ['AUTHENTICATED'],
        feature: 'My notifications',
        operations: [
            'GET /notifications',
            'DELETE /notifications',
            'GET /notifications/unread-count',
            'PATCH /notifications/mark-all-read',
            'PATCH /notifications/{id}/read',
            'DELETE /notifications/{id}',
        ],
    },
    {
        roles: ['CUSTOMER'],
        feature: 'My compensation vouchers',
        operations: [
            'GET /customer-vouchers',
            'POST /customer-vouchers/validate',
        ],
    },
    {
        roles: ['STAFF', 'ADMIN'],
        feature: 'Compensation voucher operations',
        scope: STAFF_GARAGE_SCOPE,
        operations: [
            'GET /admin/customer-vouchers',
        ],
    },
    {
        roles: ['ADMIN'],
        feature: 'Compensation voucher operations',
        operations: [
            'PATCH /admin/customer-vouchers/{id}/approve',
            'PATCH /admin/customer-vouchers/{id}/revoke',
        ],
    },
    {
        roles: ['CUSTOMER'],
        feature: 'My wash histories',
        operations: [
            'GET /wash-histories',
            'GET /wash-histories/{id}',
            'POST /wash-histories/claim',
        ],
    },
    {
        roles: ['STAFF', 'ADMIN'],
        feature: 'Wash history operations',
        scope: STAFF_GARAGE_SCOPE,
        operations: [
            'GET /admin/wash-histories',
            'GET /admin/wash-histories/{id}',
        ],
    },
    {
        roles: ['PUBLIC'],
        feature: 'PayOS webhook',
        operations: [
            'POST /payments/payos/webhook',
        ],
    },
    {
        roles: ['CUSTOMER'],
        feature: 'My PayOS payments',
        operations: [
            'POST /payments/bookings/{bookingId}/payos',
            'GET /payments/bookings/{bookingId}/payos',
        ],
    },
    {
        roles: ['STAFF', 'ADMIN'],
        feature: 'PayOS payment operations',
        scope: STAFF_GARAGE_SCOPE,
        operations: [
            'POST /admin/payments/bookings/{bookingId}/payos',
            'GET /admin/payments/bookings/{bookingId}/payos',
            'GET /admin/payments/{paymentId}',
            'PATCH /admin/payments/{paymentId}/cancel',
            'PATCH /admin/payments/{paymentId}/expire',
        ],
    },
    {
        roles: ['AUTHENTICATED'],
        feature: 'Owned uploads',
        operations: [
            'POST /uploads',
            'DELETE /uploads/{id}',
        ],
    },
    {
        roles: ['ADMIN'],
        feature: 'Upload management',
        operations: [
            'GET /admin/uploads',
        ],
    },
    {
        roles: ['CUSTOMER'],
        feature: 'Customer surveys',
        operations: [
            'GET /surveys/available',
            'POST /surveys/{id}/responses',
        ],
    },
    {
        roles: ['ADMIN'],
        feature: 'Survey management',
        operations: [
            'GET /admin/surveys',
            'POST /admin/surveys',
            'GET /admin/surveys/{id}',
            'PATCH /admin/surveys/{id}',
            'DELETE /admin/surveys/{id}',
            'PATCH /admin/surveys/{id}/publish',
            'PATCH /admin/surveys/{id}/close',
        ],
    },
    {
        roles: ['ADMIN'],
        feature: 'Survey responses',
        operations: [
            'GET /admin/surveys/{id}/responses',
        ],
    },
    {
        roles: ['ADMIN'],
        feature: 'Analytics',
        operations: [
            'GET /admin/analytics/overview',
            'GET /admin/analytics/bookings',
            'GET /admin/analytics/revenue',
            'GET /admin/analytics/garages',
            'GET /admin/analytics/services',
            'GET /admin/analytics/promotions',
            'GET /admin/analytics/wash-bays',
            'GET /admin/analytics/payments',
            'GET /admin/analytics/surveys/{surveyId}',
        ],
    },
    {
        roles: ['ADMIN'],
        feature: 'Research reports',
        operations: [
            'GET /admin/research',
            'POST /admin/research',
            'GET /admin/research/{id}',
            'PATCH /admin/research/{id}',
            'DELETE /admin/research/{id}',
            'POST /admin/research/{id}/run',
            'POST /admin/research/{id}/retry',
        ],
    },
    {
        roles: ['ADMIN'],
        feature: 'Audit logs',
        operations: [
            'GET /admin/audit-logs',
        ],
    },
]);

const toOperationKey = (operation) => operation.trim().replace(/\s+/, ' ');

const getRoleLabels = (roles) => roles.map((role) => ROLE_DETAILS[role].label);

const getAuthText = (roles) => {
    if (roles.length === 1) {
        return ROLE_DETAILS[roles[0]].auth;
    }

    return 'Bearer JWT required. User role must be one of: ' + getRoleLabels(roles).join(', ') + '.';
};

const createMetadataByOperation = () => {
    const metadata = new Map();

    ROUTE_GROUPS.forEach((group) => {
        group.operations.forEach((operation) => {
            const key = toOperationKey(operation);

            if (metadata.has(key)) {
                throw new Error(`Duplicate OpenAPI role metadata for ${key}`);
            }

            const staffPolicy = STAFF_OPERATION_POLICIES.get(key);

            metadata.set(key, {
                roles: group.roles,
                feature: group.feature,
                scope: group.scope,
                auth: getAuthText(group.roles),
                ...(staffPolicy ? {
                    requiredCapabilities: staffPolicy.capabilities,
                    capabilityMatch: staffPolicy.match,
                    resourceScope: staffPolicy.resourceScope,
                    capabilitySelector: staffPolicy.selector,
                } : {}),
            });
        });
    });

    return metadata;
};

const metadataByOperation = createMetadataByOperation();

const createRoleTagName = (role, feature) => `${ROLE_DETAILS[role].label} / ${feature}`;

const createRoleTags = () => {
    const tags = new Map();

    ROUTE_GROUPS.forEach((group) => {
        group.roles.forEach((role) => {
            const name = createRoleTagName(role, group.feature);

            if (!tags.has(name)) {
                tags.set(name, {
                    name,
                    description: `${ROLE_DETAILS[role].label} role APIs for ${group.feature}. ${getAuthText([role])}`,
                });
            }
        });
    });

    return Array.from(tags.values());
};

const buildDescription = (baseDescription, metadata) => {
    const lines = [
        `**Roles:** ${getRoleLabels(metadata.roles).join(', ')}`,
        `**Function:** ${metadata.feature}`,
        `**Auth:** ${metadata.auth}`,
    ];

    if (metadata.scope) {
        lines.push(`**Scope:** ${metadata.scope}`);
    }

    if (metadata.requiredCapabilities) {
        lines.push(`**Capabilities:** ${metadata.requiredCapabilities.join(', ')}`);
        lines.push(`**Capability match:** ${metadata.capabilityMatch}`);
        lines.push(`**Resource scope:** ${metadata.resourceScope}`);

        if (metadata.capabilitySelector) {
            lines.push(`**Capability selector:** ${metadata.capabilitySelector}`);
        }
    }

    if (baseDescription) {
        lines.push(baseDescription);
    }

    return lines.join('\n\n');
};

const enrichOperation = (operation, metadata) => {
    const originalSummary = operation['x-original-summary'] || operation.summary || '';
    const originalDescription = operation['x-original-description'] || operation.description || '';
    const originalTags = operation['x-original-tags'] || operation.tags || [];

    operation['x-original-summary'] = originalSummary;
    operation['x-original-description'] = originalDescription;
    operation['x-original-tags'] = originalTags;
    operation['x-roles'] = metadata.roles;
    operation['x-feature'] = metadata.feature;
    operation['x-auth'] = metadata.auth;

    if (metadata.requiredCapabilities) {
        operation['x-required-capabilities'] = metadata.requiredCapabilities;
        operation['x-capability-match'] = metadata.capabilityMatch;
        operation['x-resource-scope'] = metadata.resourceScope;

        if (metadata.capabilitySelector) {
            operation['x-capability-selector'] = metadata.capabilitySelector;
        }
    }

    operation.tags = metadata.roles.map((role) => createRoleTagName(role, metadata.feature));
    operation.summary = `[${getRoleLabels(metadata.roles).join(', ')}] ${metadata.feature} - ${originalSummary}`;
    operation.description = buildDescription(originalDescription, metadata);
};

const enrichOpenApiRoles = (openApiSpec) => {
    Object.entries(openApiSpec.paths || {}).forEach(([path, pathItem]) => {
        HTTP_METHODS.forEach((method) => {
            const operation = pathItem[method];

            if (!operation) {
                return;
            }

            const key = `${method.toUpperCase()} ${path}`;
            const metadata = metadataByOperation.get(key);

            if (!metadata) {
                return;
            }

            enrichOperation(operation, metadata);
        });
    });

    openApiSpec.tags = createRoleTags();

    return openApiSpec;
};

module.exports = {
    HTTP_METHODS,
    ROLE_DETAILS,
    ROUTE_GROUPS,
    STAFF_OPERATION_POLICIES,
    enrichOpenApiRoles,
    metadataByOperation,
};
