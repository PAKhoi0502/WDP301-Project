const Booking = require('../bookings/booking.model');
const VehicleInspection = require('../vehicle-inspections/vehicleInspection.model');
const BookingHandover = require('./bookingHandover.model');
const CustomerCase = require('../customer-cases/customerCase.model');
const BookingHandoverMapper = require('./bookingHandover.mapper');
const customerCaseNotificationService = require('../customer-cases/customerCaseNotification.service');
const auditLogService = require('../audit-logs/auditLog.service');
const { AppError } = require('../../shared/utils/appError');
const {
    BOOKING_STATUS,
    BOOKING_PAYMENT_STATUS,
} = require('../../shared/constants/booking.constant');
const { VEHICLE_INSPECTION_TYPES } = require('../../shared/constants/vehicleInspection.constant');
const {
    BOOKING_HANDOVER_STATES,
    BOOKING_HANDOVER_RESPONSES,
    BOOKING_HANDOVER_RESPONSE_SOURCES,
    CUSTOMER_CASE_STATUSES,
} = require('../../shared/constants/customerCase.constant');
const { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } = require('../../shared/constants/audit.constant');

const normalizeText = (value) => typeof value === 'string' ? value.trim() || null : value || null;
const toId = (value) => value?._id?.toString?.() || value?.toString?.() || null;

const populateHandoverQuery = (query) => query
    .populate('ready_by_id', 'full_name email phone role')
    .populate('customer_response_recorded_by_id', 'full_name email phone role')
    .populate('released_by_id', 'full_name email phone role');

const getBooking = async (bookingId) => {
    const booking = await Booking.findById(bookingId);

    if (!booking) {
        throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    return booking;
};

const assertCustomerOwnsBooking = (user, booking) => {
    if (!booking.customer_id || toId(booking.customer_id) !== toId(user._id)) {
        throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }
};

const assertStaffGarageAccess = (staffContext, booking) => {
    if (staffContext?.is_admin) {
        return;
    }

    if (!staffContext?.garage_id || staffContext.garage_id !== toId(booking.garage_id)) {
        throw new AppError('Booking does not belong to your garage', 403, 'BOOKING_GARAGE_ACCESS_REQUIRED');
    }
};

const toInspectionSnapshot = (inspection) => {
    if (!inspection) {
        return null;
    }

    const item = inspection.toObject ? inspection.toObject() : inspection;

    return {
        id: toId(item._id),
        type: item.type,
        note: item.note,
        images: item.images || [],
        inspected_by_id: toId(item.inspected_by),
        inspected_at: item.inspected_at,
    };
};

const getRequiredInspectionSnapshot = async (bookingId) => {
    const inspections = await VehicleInspection.find({ booking_id: bookingId });
    const before = inspections.find((item) => item.type === VEHICLE_INSPECTION_TYPES.BEFORE_WASH);
    const after = inspections.find((item) => item.type === VEHICLE_INSPECTION_TYPES.AFTER_WASH);

    if (!before || !after) {
        throw new AppError(
            'Before and after vehicle inspections are required before handover',
            409,
            'HANDOVER_INSPECTIONS_REQUIRED'
        );
    }

    if (!(before.images || []).length || !(after.images || []).length) {
        throw new AppError(
            'Before and after inspections must include image evidence before handover',
            409,
            'HANDOVER_INSPECTION_IMAGES_REQUIRED'
        );
    }

    return {
        before: toInspectionSnapshot(before),
        after: toInspectionSnapshot(after),
    };
};

const getPopulatedHandover = (handoverId) => populateHandoverQuery(BookingHandover.findById(handoverId));

const assertReportedIssuesResolved = async (handover) => {
    if (handover.customer_response !== BOOKING_HANDOVER_RESPONSES.ISSUE_REPORTED) {
        return;
    }

    const unresolvedCase = await CustomerCase.exists({
        _id: { $in: handover.issue_case_ids || [] },
        status: {
            $nin: [
                CUSTOMER_CASE_STATUSES.RESOLVED,
                CUSTOMER_CASE_STATUSES.CLOSED,
            ],
        },
    });

    if (unresolvedCase) {
        throw new AppError(
            'Reported handover issues must be resolved before customer acceptance',
            409,
            'HANDOVER_ISSUE_RESOLUTION_REQUIRED'
        );
    }
};

const recordAcceptance = async ({
    user,
    booking,
    handover,
    payload,
    source,
    auditContext,
}) => {
    if (handover.state === BOOKING_HANDOVER_STATES.RELEASED) {
        if (handover.customer_response === BOOKING_HANDOVER_RESPONSES.ACCEPTED) {
            return BookingHandoverMapper.toBookingHandoverDto(
                await getPopulatedHandover(handover._id)
            );
        }

        throw new AppError(
            'Released handover response cannot be changed',
            409,
            'HANDOVER_ALREADY_RELEASED'
        );
    }

    if (handover.customer_response === BOOKING_HANDOVER_RESPONSES.ACCEPTED) {
        return BookingHandoverMapper.toBookingHandoverDto(
            await getPopulatedHandover(handover._id)
        );
    }

    if (![
        BOOKING_HANDOVER_STATES.READY_FOR_CUSTOMER,
        BOOKING_HANDOVER_STATES.ON_HOLD,
    ].includes(handover.state)) {
        throw new AppError(
            'Handover is not available for acceptance',
            409,
            'HANDOVER_ACCEPT_NOT_ALLOWED'
        );
    }

    await assertReportedIssuesResolved(handover);

    const before = BookingHandoverMapper.toBookingHandoverDto(handover);
    const now = new Date();
    handover.customer_response = BOOKING_HANDOVER_RESPONSES.ACCEPTED;
    handover.customer_response_source = source;
    handover.customer_response_recorded_by_id = user._id;
    handover.customer_response_note = normalizeText(payload.note);
    handover.customer_responded_at = now;
    handover.accepted_at = now;
    handover.state = BOOKING_HANDOVER_STATES.READY_FOR_CUSTOMER;
    await handover.save();

    const result = BookingHandoverMapper.toBookingHandoverDto(
        await getPopulatedHandover(handover._id)
    );
    await auditLogService.recordAuditEvent({
        actorId: user._id,
        action: AUDIT_ACTIONS.BOOKING_HANDOVER_ACCEPTED,
        resourceType: AUDIT_RESOURCE_TYPES.BOOKING_HANDOVER,
        resourceId: handover._id,
        before,
        after: result,
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
        metadata: {
            booking_id: toId(booking._id),
            response_source: source,
        },
    });
    await customerCaseNotificationService.notifyHandoverAccepted(handover, user._id);

    return result;
};

const markReady = async (user, staffContext, bookingId, payload = {}, auditContext = {}) => {
    const booking = await getBooking(bookingId);
    assertStaffGarageAccess(staffContext, booking);

    if (booking.status !== BOOKING_STATUS.COMPLETED) {
        throw new AppError('Only completed bookings can be prepared for handover', 409, 'HANDOVER_BOOKING_NOT_COMPLETED');
    }

    const inspectionSnapshot = await getRequiredInspectionSnapshot(booking._id);
    let handover = await BookingHandover.findOne({ booking_id: booking._id });

    if (handover?.state === BOOKING_HANDOVER_STATES.RELEASED) {
        throw new AppError('Released handover cannot be prepared again', 409, 'HANDOVER_ALREADY_RELEASED');
    }

    if (handover?.state === BOOKING_HANDOVER_STATES.ON_HOLD) {
        throw new AppError(
            'Held handover issues must be resolved before preparation can continue',
            409,
            'HANDOVER_ON_HOLD'
        );
    }

    if (handover?.state === BOOKING_HANDOVER_STATES.READY_FOR_CUSTOMER) {
        return BookingHandoverMapper.toBookingHandoverDto(await getPopulatedHandover(handover._id));
    }

    const before = handover ? BookingHandoverMapper.toBookingHandoverDto(handover) : null;
    const now = new Date();

    if (!handover) {
        handover = await BookingHandover.create({
            booking_id: booking._id,
            garage_id: booking.garage_id,
            customer_id: booking.customer_id,
            vehicle_id: booking.vehicle_id,
            guest_name: booking.guest_name,
            guest_phone: booking.normalized_guest_phone || booking.guest_phone,
            state: BOOKING_HANDOVER_STATES.READY_FOR_CUSTOMER,
            ready_at: now,
            ready_by_id: user._id,
            ready_note: normalizeText(payload.note),
            inspection_snapshot: inspectionSnapshot,
        });
    } else {
        handover.state = BOOKING_HANDOVER_STATES.READY_FOR_CUSTOMER;
        handover.ready_at = handover.ready_at || now;
        handover.ready_by_id = user._id;
        handover.ready_note = normalizeText(payload.note);
        handover.inspection_snapshot = inspectionSnapshot;
        await handover.save();
    }

    const populated = await getPopulatedHandover(handover._id);
    const result = BookingHandoverMapper.toBookingHandoverDto(populated);

    await auditLogService.recordAuditEvent({
        actorId: user._id,
        action: AUDIT_ACTIONS.BOOKING_HANDOVER_READY,
        resourceType: AUDIT_RESOURCE_TYPES.BOOKING_HANDOVER,
        resourceId: handover._id,
        before,
        after: result,
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
        metadata: { booking_id: toId(booking._id), garage_id: toId(booking.garage_id) },
    });
    if (handover.customer_id) {
        await customerCaseNotificationService.notifyHandoverReady(handover);
    }

    return result;
};

const getMyHandover = async (user, bookingId) => {
    const booking = await getBooking(bookingId);
    assertCustomerOwnsBooking(user, booking);
    const handover = await populateHandoverQuery(BookingHandover.findOne({ booking_id: booking._id }));

    if (!handover) {
        throw new AppError('Booking handover is not ready', 404, 'BOOKING_HANDOVER_NOT_FOUND');
    }

    return BookingHandoverMapper.toBookingHandoverDto(handover);
};

const getStaffHandover = async (staffContext, bookingId) => {
    const booking = await getBooking(bookingId);
    assertStaffGarageAccess(staffContext, booking);
    const handover = await populateHandoverQuery(BookingHandover.findOne({ booking_id: booking._id }));

    if (!handover) {
        throw new AppError('Booking handover not found', 404, 'BOOKING_HANDOVER_NOT_FOUND');
    }

    return BookingHandoverMapper.toBookingHandoverDto(handover);
};

const acceptMyHandover = async (user, bookingId, payload = {}, auditContext = {}) => {
    const booking = await getBooking(bookingId);
    assertCustomerOwnsBooking(user, booking);
    const handover = await BookingHandover.findOne({ booking_id: booking._id });

    if (!handover) {
        throw new AppError('Booking handover is not ready', 404, 'BOOKING_HANDOVER_NOT_FOUND');
    }

    return recordAcceptance({
        user,
        booking,
        handover,
        payload,
        source: BOOKING_HANDOVER_RESPONSE_SOURCES.CUSTOMER_SELF_SERVICE,
        auditContext,
    });
};

const acceptWalkInHandover = async (
    user,
    staffContext,
    bookingId,
    payload = {},
    auditContext = {}
) => {
    const booking = await getBooking(bookingId);
    assertStaffGarageAccess(staffContext, booking);

    if (!booking.is_walk_in) {
        throw new AppError(
            'Staff-assisted acceptance is only available for walk-in bookings',
            409,
            'HANDOVER_WALK_IN_REQUIRED'
        );
    }

    const handover = await BookingHandover.findOne({ booking_id: booking._id });

    if (!handover) {
        throw new AppError(
            'Booking handover is not ready',
            404,
            'BOOKING_HANDOVER_NOT_FOUND'
        );
    }

    return recordAcceptance({
        user,
        booking,
        handover,
        payload,
        source: BOOKING_HANDOVER_RESPONSE_SOURCES.STAFF_ASSISTED,
        auditContext,
    });
};

const release = async (user, staffContext, bookingId, payload = {}, auditContext = {}) => {
    const booking = await getBooking(bookingId);
    assertStaffGarageAccess(staffContext, booking);
    const handover = await BookingHandover.findOne({ booking_id: booking._id });

    if (!handover) {
        throw new AppError('Booking handover not found', 404, 'BOOKING_HANDOVER_NOT_FOUND');
    }

    if (handover.state === BOOKING_HANDOVER_STATES.RELEASED) {
        return BookingHandoverMapper.toBookingHandoverDto(await getPopulatedHandover(handover._id));
    }

    if (handover.customer_response !== BOOKING_HANDOVER_RESPONSES.ACCEPTED) {
        throw new AppError(
            'Customer acceptance is required before vehicle release',
            409,
            'HANDOVER_CUSTOMER_ACCEPTANCE_REQUIRED'
        );
    }

    if (handover.state !== BOOKING_HANDOVER_STATES.READY_FOR_CUSTOMER) {
        throw new AppError(
            'Handover is not ready for vehicle release',
            409,
            'HANDOVER_RELEASE_NOT_ALLOWED'
        );
    }

    if (![
        BOOKING_PAYMENT_STATUS.PAID,
        BOOKING_PAYMENT_STATUS.WAIVED,
    ].includes(booking.payment_status)) {
        throw new AppError(
            'Booking payment or full payment waiver is required before vehicle release',
            409,
            'HANDOVER_PAYMENT_REQUIRED'
        );
    }

    const before = BookingHandoverMapper.toBookingHandoverDto(handover);
    handover.state = BOOKING_HANDOVER_STATES.RELEASED;
    handover.released_at = new Date();
    handover.released_by_id = user._id;
    handover.release_note = normalizeText(payload.note);
    await handover.save();

    const result = BookingHandoverMapper.toBookingHandoverDto(await getPopulatedHandover(handover._id));
    await auditLogService.recordAuditEvent({
        actorId: user._id,
        action: AUDIT_ACTIONS.BOOKING_HANDOVER_RELEASED,
        resourceType: AUDIT_RESOURCE_TYPES.BOOKING_HANDOVER,
        resourceId: handover._id,
        before,
        after: result,
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
        metadata: { booking_id: toId(booking._id) },
    });
    await customerCaseNotificationService.notifyHandoverReleased(handover, user._id);

    return result;
};

module.exports = {
    markReady,
    getMyHandover,
    getStaffHandover,
    acceptMyHandover,
    acceptWalkInHandover,
    release,
};
