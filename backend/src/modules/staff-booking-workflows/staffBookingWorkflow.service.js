const Booking = require('../bookings/booking.model');
const VehicleInspection = require('../vehicle-inspections/vehicleInspection.model');
const BookingHandover = require('../booking-handovers/bookingHandover.model');
const BookingServiceStep = require('../booking-service-steps/bookingServiceStep.model');
const { AppError } = require('../../shared/utils/appError');
const {
    BOOKING_STATUS,
    BOOKING_ITEM_STATUS,
    BOOKING_PAYMENT_STATUS,
    BOOKING_STAFF_CANCELABLE_STATUSES,
    BOOKING_STAFF_NO_SHOW_STATUSES,
} = require('../../shared/constants/booking.constant');
const { BOOKING_OPERATION_STATUS } = require('../../shared/constants/bookingIncident.constant');
const { VEHICLE_INSPECTION_TYPES } = require('../../shared/constants/vehicleInspection.constant');
const {
    BOOKING_HANDOVER_STATES,
    BOOKING_HANDOVER_RESPONSES,
} = require('../../shared/constants/customerCase.constant');
const { BOOKING_SERVICE_STEP_STATUS } = require('../../shared/constants/bookingServiceStep.constant');
const { STAFF_CAPABILITIES } = require('../../shared/constants/staff.constant');
const {
    BOOKING_WORKFLOW_PHASES,
    BOOKING_WORKFLOW_ACTIONS,
    BOOKING_WORKFLOW_BLOCKERS,
} = require('../../shared/constants/bookingWorkflow.constant');

const toPlainObject = (value) => value?.toObject ? value.toObject() : value;

const toId = (value) => {
    if (!value) {
        return null;
    }

    return value._id?.toString?.() || value.toString?.() || value;
};

const isSameId = (left, right) => toId(left) === toId(right);

const resolveLeanQuery = async (query) => (
    query && typeof query.lean === 'function' ? query.lean() : query
);

const hasCapability = (staffContext, capability) => (
    staffContext.is_admin
    || staffContext.capabilities.includes('*')
    || staffContext.capabilities.includes(capability)
);

const getInspectionByType = (inspections, type) => (
    inspections.find((inspection) => inspection.type === type) || null
);

const isIncidentHold = (booking) => (
    booking.operation_status === BOOKING_OPERATION_STATUS.AWAITING_CUSTOMER_DECISION
    || Boolean(booking.active_incident_id)
);

const areAllServiceItemsDone = (booking) => (
    (booking.booking_items || []).length > 0
    && (booking.booking_items || []).every((item) => (
        item.status === BOOKING_ITEM_STATUS.DONE
        || item.status === BOOKING_ITEM_STATUS.SKIPPED
    ))
);

const areAllRequiredStepsDone = (serviceSteps) => serviceSteps.every((step) => (
    !step.is_required
    || step.status === BOOKING_SERVICE_STEP_STATUS.DONE
    || step.status === BOOKING_SERVICE_STEP_STATUS.SKIPPED
));

const getCurrentServiceItem = (booking) => {
    const activeStatuses = [
        BOOKING_ITEM_STATUS.IN_PROGRESS,
        BOOKING_ITEM_STATUS.PAUSED,
        BOOKING_ITEM_STATUS.AWAITING_CONFIRMATION,
        BOOKING_ITEM_STATUS.WAITING_RESOURCE,
    ];

    return [...(booking.booking_items || [])]
        .sort((first, second) => first.sequence - second.sequence)
        .find((item) => activeStatuses.includes(item.status)) || null;
};

const isInspectionAssignedToCurrentStaff = (booking, staffContext) => (
    staffContext.is_admin
    || isSameId(booking.assigned_inspection_staff_id, staffContext.user_id)
);

const isServiceItemAssignedToCurrentStaff = (bookingItem, staffContext) => {
    if (staffContext.is_admin) {
        return true;
    }

    const assignments = [
        ...(bookingItem?.assigned_execution_staff || []),
        ...(bookingItem?.assigned_care_staff || []),
    ];

    return assignments.some((assignment) => (
        !assignment.released_at
        && (
            isSameId(assignment.user_id, staffContext.user_id)
            || isSameId(assignment.staff_profile_id, staffContext.staff_profile_id)
        )
    ));
};

const getWorkflowPhase = ({ booking, inspections, handover }) => {
    const beforeInspection = getInspectionByType(inspections, VEHICLE_INSPECTION_TYPES.BEFORE_WASH);
    const afterInspection = getInspectionByType(inspections, VEHICLE_INSPECTION_TYPES.AFTER_WASH);

    if (booking.status === BOOKING_STATUS.CANCELED) {
        return BOOKING_WORKFLOW_PHASES.CANCELED;
    }

    if (booking.status === BOOKING_STATUS.NO_SHOW) {
        return BOOKING_WORKFLOW_PHASES.NO_SHOW;
    }

    if (isIncidentHold(booking)) {
        return BOOKING_WORKFLOW_PHASES.INCIDENT_HOLD;
    }

    if (handover?.state === BOOKING_HANDOVER_STATES.RELEASED) {
        return BOOKING_WORKFLOW_PHASES.RELEASED;
    }

    if (handover?.state === BOOKING_HANDOVER_STATES.ON_HOLD) {
        return BOOKING_WORKFLOW_PHASES.HANDOVER_ON_HOLD;
    }

    if ([BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED].includes(booking.status)) {
        return BOOKING_WORKFLOW_PHASES.WAITING_CHECK_IN;
    }

    if (booking.status === BOOKING_STATUS.CHECKED_IN) {
        return beforeInspection
            ? BOOKING_WORKFLOW_PHASES.READY_FOR_SERVICE
            : BOOKING_WORKFLOW_PHASES.WAITING_BEFORE_WASH_INSPECTION;
    }

    if (booking.status === BOOKING_STATUS.IN_PROGRESS) {
        return BOOKING_WORKFLOW_PHASES.SERVICE_IN_PROGRESS;
    }

    if (booking.status === BOOKING_STATUS.COMPLETED && !afterInspection) {
        return BOOKING_WORKFLOW_PHASES.WAITING_AFTER_WASH_INSPECTION;
    }

    if (!handover || handover.state === BOOKING_HANDOVER_STATES.PENDING) {
        return BOOKING_WORKFLOW_PHASES.READY_FOR_HANDOVER;
    }

    if (handover.customer_response === BOOKING_HANDOVER_RESPONSES.PENDING) {
        return BOOKING_WORKFLOW_PHASES.WAITING_CUSTOMER_ACCEPTANCE;
    }

    if (booking.payment_status !== BOOKING_PAYMENT_STATUS.PAID) {
        return BOOKING_WORKFLOW_PHASES.WAITING_PAYMENT;
    }

    return BOOKING_WORKFLOW_PHASES.READY_FOR_RELEASE;
};

const getWorkflowBlockers = ({ booking, inspections, handover }) => {
    const blockers = [];
    const beforeInspection = getInspectionByType(inspections, VEHICLE_INSPECTION_TYPES.BEFORE_WASH);
    const afterInspection = getInspectionByType(inspections, VEHICLE_INSPECTION_TYPES.AFTER_WASH);

    if (isIncidentHold(booking)) {
        blockers.push(BOOKING_WORKFLOW_BLOCKERS.INCIDENT_HOLD);
    }

    if ([BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED].includes(booking.status)) {
        blockers.push(BOOKING_WORKFLOW_BLOCKERS.CHECK_IN_REQUIRED);
    }

    if (booking.status === BOOKING_STATUS.CHECKED_IN && !beforeInspection) {
        blockers.push(BOOKING_WORKFLOW_BLOCKERS.BEFORE_WASH_INSPECTION_REQUIRED);
    }

    if (booking.status === BOOKING_STATUS.IN_PROGRESS && !areAllServiceItemsDone(booking)) {
        blockers.push(BOOKING_WORKFLOW_BLOCKERS.SERVICE_ITEMS_NOT_DONE);
    }

    if (booking.status === BOOKING_STATUS.COMPLETED && !afterInspection) {
        blockers.push(BOOKING_WORKFLOW_BLOCKERS.AFTER_WASH_INSPECTION_REQUIRED);
    }

    if (
        handover?.state === BOOKING_HANDOVER_STATES.READY_FOR_CUSTOMER
        && handover.customer_response === BOOKING_HANDOVER_RESPONSES.PENDING
    ) {
        blockers.push(BOOKING_WORKFLOW_BLOCKERS.HANDOVER_CUSTOMER_RESPONSE_REQUIRED);
    }

    if (
        handover?.customer_response === BOOKING_HANDOVER_RESPONSES.ACCEPTED
        && booking.payment_status !== BOOKING_PAYMENT_STATUS.PAID
    ) {
        blockers.push(BOOKING_WORKFLOW_BLOCKERS.PAYMENT_REQUIRED);
    }

    return blockers;
};

const hasInspectionImageEvidence = (inspection) => Boolean(inspection?.images?.length);

const getAvailableActions = ({ booking, inspections, handover, serviceSteps, staffContext }) => {
    if (isIncidentHold(booking)) {
        return [];
    }

    const actions = [];
    const beforeInspection = getInspectionByType(inspections, VEHICLE_INSPECTION_TYPES.BEFORE_WASH);
    const afterInspection = getInspectionByType(inspections, VEHICLE_INSPECTION_TYPES.AFTER_WASH);
    const inspectionAssigned = isInspectionAssignedToCurrentStaff(booking, staffContext);
    const currentServiceItem = getCurrentServiceItem(booking);
    const serviceItemAssigned = isServiceItemAssignedToCurrentStaff(currentServiceItem, staffContext);
    const canExecuteServiceItem = serviceItemAssigned && (
        hasCapability(staffContext, STAFF_CAPABILITIES.SERVICE_TASK_WASH_EXECUTE_ASSIGNED)
        || hasCapability(staffContext, STAFF_CAPABILITIES.SERVICE_TASK_CARE_EXECUTE_ASSIGNED)
    );

    if (
        hasCapability(staffContext, STAFF_CAPABILITIES.BOOKING_CANCEL_CUSTOMER_REQUEST)
        && BOOKING_STAFF_CANCELABLE_STATUSES.includes(booking.status)
    ) {
        actions.push(BOOKING_WORKFLOW_ACTIONS.BOOKING_CANCEL);
    }

    if (
        hasCapability(staffContext, STAFF_CAPABILITIES.BOOKING_ARRIVAL_MANAGE)
        && BOOKING_STAFF_NO_SHOW_STATUSES.includes(booking.status)
    ) {
        actions.push(BOOKING_WORKFLOW_ACTIONS.BOOKING_MARK_NO_SHOW);
    }

    if (
        hasCapability(staffContext, STAFF_CAPABILITIES.BOOKING_CHECK_IN)
        && [BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED].includes(booking.status)
    ) {
        actions.push(BOOKING_WORKFLOW_ACTIONS.BOOKING_CHECK_IN);
    }

    if (
        hasCapability(staffContext, STAFF_CAPABILITIES.INSPECTION_CREATE_ASSIGNED)
        && inspectionAssigned
        && !beforeInspection
        && [BOOKING_STATUS.CHECKED_IN, BOOKING_STATUS.IN_PROGRESS].includes(booking.status)
    ) {
        actions.push(BOOKING_WORKFLOW_ACTIONS.INSPECTION_BEFORE_WASH_CREATE);
    }

    if (
        hasCapability(staffContext, STAFF_CAPABILITIES.BOOKING_SERVICE_START)
        && booking.status === BOOKING_STATUS.CHECKED_IN
        && beforeInspection
    ) {
        actions.push(BOOKING_WORKFLOW_ACTIONS.BOOKING_SERVICE_START);
    }

    if (canExecuteServiceItem && currentServiceItem?.status === BOOKING_ITEM_STATUS.IN_PROGRESS) {
        actions.push(BOOKING_WORKFLOW_ACTIONS.SERVICE_ITEM_PAUSE);
        actions.push(BOOKING_WORKFLOW_ACTIONS.SERVICE_ITEM_COMPLETE_EARLY);
    }

    if (canExecuteServiceItem && currentServiceItem?.status === BOOKING_ITEM_STATUS.PAUSED) {
        actions.push(BOOKING_WORKFLOW_ACTIONS.SERVICE_ITEM_RESUME);
        actions.push(BOOKING_WORKFLOW_ACTIONS.SERVICE_ITEM_COMPLETE_EARLY);
    }

    if (canExecuteServiceItem && currentServiceItem?.status === BOOKING_ITEM_STATUS.AWAITING_CONFIRMATION) {
        actions.push(BOOKING_WORKFLOW_ACTIONS.SERVICE_ITEM_CONFIRM_COMPLETE);
    }

    if (
        hasCapability(staffContext, STAFF_CAPABILITIES.BOOKING_SERVICE_COMPLETE)
        && booking.status === BOOKING_STATUS.IN_PROGRESS
        && areAllServiceItemsDone(booking)
        && areAllRequiredStepsDone(serviceSteps)
    ) {
        actions.push(BOOKING_WORKFLOW_ACTIONS.BOOKING_SERVICE_COMPLETE);
    }

    if (
        hasCapability(staffContext, STAFF_CAPABILITIES.INSPECTION_CREATE_ASSIGNED)
        && inspectionAssigned
        && !afterInspection
        && [BOOKING_STATUS.IN_PROGRESS, BOOKING_STATUS.COMPLETED].includes(booking.status)
    ) {
        actions.push(BOOKING_WORKFLOW_ACTIONS.INSPECTION_AFTER_WASH_CREATE);
    }

    if (
        hasCapability(staffContext, STAFF_CAPABILITIES.BOOKING_PAYMENT_COLLECT_CASH)
        && booking.status === BOOKING_STATUS.COMPLETED
        && booking.payment_status === BOOKING_PAYMENT_STATUS.UNPAID
    ) {
        actions.push(BOOKING_WORKFLOW_ACTIONS.BOOKING_PAYMENT_COLLECT_CASH);
    }

    if (
        hasCapability(staffContext, STAFF_CAPABILITIES.BOOKING_HANDOVER_MANAGE_GARAGE)
        && booking.status === BOOKING_STATUS.COMPLETED
        && hasInspectionImageEvidence(beforeInspection)
        && hasInspectionImageEvidence(afterInspection)
        && (!handover || handover.state === BOOKING_HANDOVER_STATES.PENDING)
    ) {
        actions.push(BOOKING_WORKFLOW_ACTIONS.HANDOVER_PREPARE);
    }

    if (
        hasCapability(staffContext, STAFF_CAPABILITIES.BOOKING_HANDOVER_MANAGE_GARAGE)
        && handover?.state === BOOKING_HANDOVER_STATES.READY_FOR_CUSTOMER
        && handover.customer_response === BOOKING_HANDOVER_RESPONSES.ACCEPTED
        && booking.payment_status === BOOKING_PAYMENT_STATUS.PAID
    ) {
        actions.push(BOOKING_WORKFLOW_ACTIONS.HANDOVER_RELEASE);
    }

    return actions;
};

const toInspectionMilestone = (inspection, pendingStatus) => ({
    status: inspection ? 'DONE' : pendingStatus,
    inspected_at: inspection?.inspected_at || null,
    inspected_by_id: toId(inspection?.inspected_by),
    image_count: inspection?.images?.length || 0,
});

const toServiceItemDto = (item, staffContext) => ({
    item_key: item.item_key,
    name: item.name_snapshot,
    sequence: item.sequence,
    status: item.status,
    duration_minutes: item.duration_minutes,
    transition_mode: item.transition_mode,
    actual_started_at: item.actual_started_at || null,
    countdown_ends_at: item.countdown_ends_at || null,
    actual_completed_at: item.actual_completed_at || null,
    remaining_seconds_at_pause: item.remaining_seconds_at_pause ?? null,
    requires_wash_bay: Boolean(item.requires_wash_bay),
    requires_care_staff: Boolean(item.requires_care_staff),
    assigned_to_current_user: isServiceItemAssignedToCurrentStaff(item, staffContext),
});

const toServiceStepDto = (step) => ({
    id: toId(step._id),
    booking_item_key: step.booking_item_key || null,
    step_code: step.step_code,
    step_name: step.step_name,
    order: step.order,
    workflow_type: step.workflow_type,
    display_staff_type: step.display_staff_type || null,
    status: step.status,
    started_at: step.started_at || null,
    completed_at: step.completed_at || null,
});

const buildWorkflowDto = ({ booking, inspections, handover, serviceSteps, staffContext }) => {
    const beforeInspection = getInspectionByType(inspections, VEHICLE_INSPECTION_TYPES.BEFORE_WASH);
    const afterInspection = getInspectionByType(inspections, VEHICLE_INSPECTION_TYPES.AFTER_WASH);
    const workflowPhase = getWorkflowPhase({ booking, inspections, handover });
    const currentServiceItem = getCurrentServiceItem(booking);

    return {
        server_time: new Date(),
        booking_id: toId(booking._id),
        garage_id: toId(booking.garage_id),
        license_plate: booking.license_plate || null,
        normalized_license_plate: booking.normalized_license_plate || null,
        vehicle_type: booking.vehicle_type,
        start_time: booking.start_time,
        end_time: booking.end_time,
        wash_bay_id: toId(booking.wash_bay_id),
        assigned_inspection_staff_id: toId(booking.assigned_inspection_staff_id),
        booking_status: booking.status,
        arrival_status: booking.arrival_status || null,
        operation_status: booking.operation_status || BOOKING_OPERATION_STATUS.NORMAL,
        workflow_phase: workflowPhase,
        payment: {
            method: booking.payment_method,
            status: booking.payment_status,
        },
        milestones: {
            check_in: {
                status: booking.checked_in_at || [
                    BOOKING_STATUS.CHECKED_IN,
                    BOOKING_STATUS.IN_PROGRESS,
                    BOOKING_STATUS.COMPLETED,
                ].includes(booking.status) ? 'DONE' : 'PENDING',
                completed_at: booking.checked_in_at || null,
            },
            before_wash_inspection: toInspectionMilestone(
                beforeInspection,
                booking.status === BOOKING_STATUS.CHECKED_IN ? 'PENDING' : 'NOT_READY'
            ),
            service: {
                status: booking.status === BOOKING_STATUS.COMPLETED
                    ? 'DONE'
                    : booking.status === BOOKING_STATUS.IN_PROGRESS
                        ? 'IN_PROGRESS'
                        : workflowPhase === BOOKING_WORKFLOW_PHASES.READY_FOR_SERVICE
                            ? 'READY'
                            : 'BLOCKED',
                started_at: booking.started_at || null,
                completed_at: booking.completed_at || null,
            },
            after_wash_inspection: toInspectionMilestone(
                afterInspection,
                [BOOKING_STATUS.IN_PROGRESS, BOOKING_STATUS.COMPLETED].includes(booking.status)
                    ? 'PENDING'
                    : 'NOT_READY'
            ),
            handover: {
                status: handover?.state || 'NOT_READY',
                customer_response: handover?.customer_response || null,
                ready_at: handover?.ready_at || null,
                released_at: handover?.released_at || null,
            },
        },
        current_service_item_key: currentServiceItem?.item_key || null,
        service_items: (booking.booking_items || [])
            .sort((first, second) => first.sequence - second.sequence)
            .map((item) => toServiceItemDto(item, staffContext)),
        service_steps: serviceSteps.map(toServiceStepDto),
        blockers: getWorkflowBlockers({ booking, inspections, handover }),
        available_actions: getAvailableActions({
            booking,
            inspections,
            handover,
            serviceSteps,
            staffContext,
        }),
    };
};

const assertWorkspaceGarageAccess = (staffContext, bookingGarageId) => {
    if (staffContext.is_admin) {
        return;
    }

    if (!staffContext.garage_id) {
        throw new AppError('Staff is not assigned to any garage', 403, 'STAFF_GARAGE_NOT_ASSIGNED');
    }

    if (!isSameId(staffContext.garage_id, bookingGarageId)) {
        throw new AppError(
            'Staff cannot view workflows outside assigned garage',
            403,
            'STAFF_GARAGE_ACCESS_DENIED'
        );
    }
};

const buildListFilter = (staffContext, query) => {
    const filter = {};

    if (staffContext.is_admin) {
        if (query.garage_id) {
            filter.garage_id = query.garage_id;
        }
    } else {
        if (!staffContext.garage_id) {
            throw new AppError(
                'Staff is not assigned to any garage',
                403,
                'STAFF_GARAGE_NOT_ASSIGNED'
            );
        }

        if (query.garage_id && !isSameId(query.garage_id, staffContext.garage_id)) {
            throw new AppError(
                'Staff cannot view workflows outside assigned garage',
                403,
                'STAFF_GARAGE_ACCESS_DENIED'
            );
        }

        filter.garage_id = staffContext.garage_id;
    }

    if (query.status) {
        filter.status = query.status;
    }

    if (query.from || query.to) {
        filter.start_time = {};

        if (query.from) {
            filter.start_time.$gte = query.from;
        }

        if (query.to) {
            filter.start_time.$lte = query.to;
        }
    }

    return filter;
};

const listBookingWorkflows = async (staffContext, query = {}) => {
    const { page = 1, limit = 20 } = query;
    const filter = buildListFilter(staffContext, query);
    const skip = (page - 1) * limit;
    const bookingQuery = Booking.find(filter)
        .sort({ start_time: 1 })
        .skip(skip)
        .limit(limit);

    const [bookingDocuments, total] = await Promise.all([
        resolveLeanQuery(bookingQuery),
        Booking.countDocuments(filter),
    ]);
    const bookings = bookingDocuments.map(toPlainObject);
    const bookingIds = bookings.map((booking) => booking._id);

    if (bookingIds.length === 0) {
        return {
            data: [],
            meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
        };
    }

    const inspectionQuery = VehicleInspection.find({ booking_id: { $in: bookingIds } })
        .sort({ inspected_at: 1 });
    const handoverQuery = BookingHandover.find({ booking_id: { $in: bookingIds } });
    const [inspectionDocuments, handoverDocuments] = await Promise.all([
        resolveLeanQuery(inspectionQuery),
        resolveLeanQuery(handoverQuery),
    ]);
    const inspectionsByBooking = new Map();
    const handoverByBooking = new Map();

    inspectionDocuments.map(toPlainObject).forEach((inspection) => {
        const bookingId = toId(inspection.booking_id);
        const current = inspectionsByBooking.get(bookingId) || [];
        current.push(inspection);
        inspectionsByBooking.set(bookingId, current);
    });
    handoverDocuments.map(toPlainObject).forEach((handover) => {
        handoverByBooking.set(toId(handover.booking_id), handover);
    });

    return {
        data: bookings.map((booking) => {
            const bookingId = toId(booking._id);
            const inspections = inspectionsByBooking.get(bookingId) || [];
            const handover = handoverByBooking.get(bookingId) || null;

            return {
                booking_id: bookingId,
                garage_id: toId(booking.garage_id),
                license_plate: booking.license_plate || null,
                normalized_license_plate: booking.normalized_license_plate || null,
                vehicle_type: booking.vehicle_type,
                start_time: booking.start_time,
                end_time: booking.end_time,
                wash_bay_id: toId(booking.wash_bay_id),
                assigned_inspection_staff_id: toId(booking.assigned_inspection_staff_id),
                booking_status: booking.status,
                arrival_status: booking.arrival_status || null,
                workflow_phase: getWorkflowPhase({ booking, inspections, handover }),
                current_service_item_key: getCurrentServiceItem(booking)?.item_key || null,
                payment_status: booking.payment_status,
                blocked_by_incident: isIncidentHold(booking),
            };
        }),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

const getBookingWorkflow = async (staffContext, bookingId) => {
    const bookingDocument = await resolveLeanQuery(Booking.findById(bookingId));

    if (!bookingDocument) {
        throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    const booking = toPlainObject(bookingDocument);
    assertWorkspaceGarageAccess(staffContext, booking.garage_id);

    const inspectionQuery = VehicleInspection.find({ booking_id: booking._id })
        .sort({ inspected_at: 1 });
    const handoverQuery = BookingHandover.findOne({ booking_id: booking._id });
    const serviceStepQuery = BookingServiceStep.find({ booking_id: booking._id })
        .sort({ order: 1 });
    const [inspectionDocuments, handoverDocument, serviceStepDocuments] = await Promise.all([
        resolveLeanQuery(inspectionQuery),
        resolveLeanQuery(handoverQuery),
        resolveLeanQuery(serviceStepQuery),
    ]);

    return buildWorkflowDto({
        booking,
        inspections: inspectionDocuments.map(toPlainObject),
        handover: toPlainObject(handoverDocument),
        serviceSteps: serviceStepDocuments.map(toPlainObject),
        staffContext,
    });
};

module.exports = {
    listBookingWorkflows,
    getBookingWorkflow,
};
