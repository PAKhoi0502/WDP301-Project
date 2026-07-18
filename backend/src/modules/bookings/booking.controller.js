const bookingService = require('./booking.service');
const bookingWaitlistService = require('../booking-waitlists/bookingWaitlist.service');
const { getAuditRequestContext } = require('../audit-logs/auditLog.service');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../../shared/utils/apiResponse');

const offerNextWaitlistForReleasedBooking = async (booking) => {
    try {
        return await bookingWaitlistService.offerNextForReleasedBooking(booking);
    } catch (error) {
        console.warn('[bookings] waitlist auto-offer failed', {
            booking_id: booking?.id || booking?._id || null,
            error: error.message,
        });

        return null;
    }
};

const getAvailableSlots = asyncHandler(async (req, res) => {
    const { query } = req.validated;

    const result = await bookingService.getAvailableSlots({
        ...query,
        customer_id: req.user?._id,
    });

    return sendSuccess(res, {
        message: 'Get available booking slots successfully',
        data: result,
    });
});

const getMyBookings = asyncHandler(async (req, res) => {
    const { query } = req.validated;

    const result = await bookingService.getMyBookings(req.user._id, query);

    return sendSuccess(res, {
        message: 'Get bookings successfully',
        data: result.data,
        meta: result.meta,
    });
});

const getMyBookingById = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await bookingService.getMyBookingById(req.user._id, id);

    return sendSuccess(res, {
        message: 'Get booking successfully',
        data: result,
    });
});

const createCustomerBooking = asyncHandler(async (req, res) => {
    const { body } = req.validated;

    const result = await bookingService.createCustomerBooking(req.user._id, body);

    return sendCreated(res, {
        message: 'Create booking successfully',
        data: result,
    });
});

const cancelMyBooking = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { body } = req.validated;

    const result = await bookingService.cancelMyBooking(req.user._id, id, body || {});

    await offerNextWaitlistForReleasedBooking(result);

    return sendSuccess(res, {
        message: 'Cancel booking successfully',
        data: result,
    });
});

const cancelBooking = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { body } = req.validated;

    const result = await bookingService.cancelBooking(req.user, id, body || {});

    await offerNextWaitlistForReleasedBooking(result);

    return sendSuccess(res, {
        message: 'Cancel booking successfully',
        data: result,
    });
});

const markNoShow = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { body } = req.validated;

    const result = await bookingService.markNoShow(req.user, id, body || {});

    return sendSuccess(res, {
        message: 'Mark booking no-show successfully',
        data: result,
    });
});

const getAllBookings = asyncHandler(async (req, res) => {
    const { query } = req.validated;

    const result = await bookingService.getAllBookings(req.user, query);

    return sendSuccess(res, {
        message: 'Get bookings successfully',
        data: result.data,
        meta: result.meta,
    });
});

const getBookingById = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await bookingService.getBookingById(req.user, id);

    return sendSuccess(res, {
        message: 'Get booking successfully',
        data: result,
    });
});

const createWalkInBooking = asyncHandler(async (req, res) => {
    const { body } = req.validated;

    const result = await bookingService.createWalkInBooking(req.user, body);

    return sendCreated(res, {
        message: 'Create walk-in booking successfully',
        data: result,
    });
});

const checkInBooking = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { body } = req.validated;

    const result = await bookingService.checkInBooking(
        req.user,
        id,
        body || {},
        getAuditRequestContext(req)
    );

    return sendSuccess(res, {
        message: result.late_resolution_required
            ? 'Record late arrival successfully. Late resolution is required.'
            : 'Check in booking successfully',
        data: result,
    });
});

const getLateArrivalOptions = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { query } = req.validated;

    const result = await bookingService.getLateArrivalOptions(req.user, id, query);

    return sendSuccess(res, {
        message: 'Get late arrival options successfully',
        data: result,
    });
});

const resolveLateArrival = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { body } = req.validated;

    const result = await bookingService.resolveLateArrival(
        req.user,
        id,
        body,
        getAuditRequestContext(req)
    );

    return sendSuccess(res, {
        message: 'Resolve late arrival successfully',
        data: result,
    });
});

const assignWashBay = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { body } = req.validated;

    const result = await bookingService.assignWashBay(req.user, id, body || {});

    return sendSuccess(res, {
        message: 'Assign wash bay successfully',
        data: result,
    });
});

const assignInspectionStaff = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { staff_profile_id: staffProfileId } = req.validated.body;
    const result = await bookingService.assignInspectionStaff(
        req.user,
        id,
        staffProfileId
    );

    return sendSuccess(res, {
        message: 'Assign inspection staff successfully',
        data: result,
    });
});

const assignServiceItemStaff = asyncHandler(async (req, res) => {
    const { id, itemKey } = req.validated.params;
    const { staff_profile_id: staffProfileId } = req.validated.body;
    const result = await bookingService.assignServiceItemStaff(
        req.user,
        id,
        itemKey,
        staffProfileId
    );

    return sendSuccess(res, {
        message: 'Assign service item staff successfully',
        data: result,
    });
});

const startService = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { body } = req.validated;

    const result = await bookingService.startService(
        req.user,
        id,
        body || {},
        getAuditRequestContext(req)
    );

    return sendSuccess(res, {
        message: 'Start service successfully',
        data: result,
    });
});


const markPaid = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { body } = req.validated;

    const result = await bookingService.markPaid(req.user, id, body || {});

    return sendSuccess(res, {
        message: 'Mark booking paid successfully',
        data: result,
    });
});

const completeService = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { body } = req.validated;

    const result = await bookingService.completeService(req.user, id, body || {});

    return sendSuccess(res, {
        message: 'Complete service successfully',
        data: result,
    });
});

const reopenCompletedBooking = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { body } = req.validated;

    const result = await bookingService.reopenCompletedBooking(req.user, id, body || {});

    return sendSuccess(res, {
        message: 'Reopen completed booking successfully',
        data: result,
    });
});

const getMyActiveBookingIncident = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const result = await bookingService.getMyActiveBookingIncident(req.user._id, id);

    return sendSuccess(res, {
        message: 'Get active booking incident successfully',
        data: result,
    });
});

const resolveMyBookingIncident = asyncHandler(async (req, res) => {
    const { id, incidentId } = req.validated.params;
    const { body } = req.validated;
    const result = await bookingService.resolveMyBookingIncident(
        req.user,
        id,
        incidentId,
        body,
        getAuditRequestContext(req)
    );

    if (result.released_booking_snapshot) {
        await offerNextWaitlistForReleasedBooking(result.released_booking_snapshot);
    }

    return sendSuccess(res, {
        message: 'Resolve booking incident successfully',
        data: result.data,
    });
});

const reportBookingIncident = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { body } = req.validated;
    const result = await bookingService.reportBookingIncident(
        req.user,
        id,
        body,
        getAuditRequestContext(req)
    );

    return sendCreated(res, {
        message: 'Report booking incident successfully',
        data: result,
    });
});

const getAdminActiveBookingIncident = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const result = await bookingService.getAdminActiveBookingIncident(req.user, id);

    return sendSuccess(res, {
        message: 'Get active booking incident successfully',
        data: result,
    });
});

const getAdminBookingIncidentOptions = asyncHandler(async (req, res) => {
    const { id, incidentId } = req.validated.params;
    const result = await bookingService.getAdminBookingIncidentOptions(
        req.user,
        id,
        incidentId,
        req.validated.query
    );

    return sendSuccess(res, {
        message: 'Get booking incident resolution options successfully',
        data: result,
    });
});

const recordBookingIncidentCustomerDecision = asyncHandler(async (req, res) => {
    const { id, incidentId } = req.validated.params;
    const { body } = req.validated;
    const result = await bookingService.recordBookingIncidentCustomerDecision(
        req.user,
        id,
        incidentId,
        body,
        getAuditRequestContext(req)
    );

    if (result.released_booking_snapshot) {
        await offerNextWaitlistForReleasedBooking(result.released_booking_snapshot);
    }

    return sendSuccess(res, {
        message: 'Record customer booking incident decision successfully',
        data: result.data,
    });
});

const createIncidentCompensationVoucher = asyncHandler(async (req, res) => {
    const { id, incidentId } = req.validated.params;
    const { body } = req.validated;
    const result = await bookingService.createIncidentCompensationVoucher(
        req.user,
        id,
        incidentId,
        body,
        getAuditRequestContext(req)
    );

    return sendCreated(res, {
        message: 'Create incident compensation voucher successfully',
        data: result,
    });
});

const getServiceWorkflow = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const result = await bookingService.getServiceWorkflow(req.user, id);

    return sendSuccess(res, {
        message: 'Get booking service workflow successfully',
        data: result,
    });
});

const completeServiceItemEarly = asyncHandler(async (req, res) => {
    const { id, itemKey } = req.validated.params;
    const { body } = req.validated;
    const result = await bookingService.completeServiceItemEarly(
        req.user,
        id,
        itemKey,
        body || {},
        getAuditRequestContext(req)
    );

    return sendSuccess(res, {
        message: 'Complete booking service item early successfully',
        data: result,
    });
});

const confirmServiceItemComplete = asyncHandler(async (req, res) => {
    const { id, itemKey } = req.validated.params;
    const { body } = req.validated;
    const result = await bookingService.confirmServiceItemComplete(
        req.user,
        id,
        itemKey,
        body || {},
        getAuditRequestContext(req)
    );

    return sendSuccess(res, {
        message: 'Confirm booking service item successfully',
        data: result,
    });
});

const pauseServiceItem = asyncHandler(async (req, res) => {
    const { id, itemKey } = req.validated.params;
    const { body } = req.validated;
    const result = await bookingService.pauseServiceItem(
        req.user,
        id,
        itemKey,
        body || {},
        getAuditRequestContext(req)
    );

    return sendSuccess(res, {
        message: 'Pause booking service item successfully',
        data: result,
    });
});

const resumeServiceItem = asyncHandler(async (req, res) => {
    const { id, itemKey } = req.validated.params;
    const result = await bookingService.resumeServiceItem(
        req.user,
        id,
        itemKey,
        getAuditRequestContext(req)
    );

    return sendSuccess(res, {
        message: 'Resume booking service item successfully',
        data: result,
    });
});

module.exports = {
    getAvailableSlots,
    getMyBookings,
    getMyBookingById,
    createCustomerBooking,
    cancelMyBooking,
    cancelBooking,
    getMyActiveBookingIncident,
    resolveMyBookingIncident,
    reportBookingIncident,
    getAdminActiveBookingIncident,
    getAdminBookingIncidentOptions,
    recordBookingIncidentCustomerDecision,
    createIncidentCompensationVoucher,
    markNoShow,
    getAllBookings,
    getBookingById,
    createWalkInBooking,
    checkInBooking,
    getLateArrivalOptions,
    resolveLateArrival,
    assignWashBay,
    assignInspectionStaff,
    assignServiceItemStaff,
    startService,
    getServiceWorkflow,
    completeServiceItemEarly,
    confirmServiceItemComplete,
    pauseServiceItem,
    resumeServiceItem,
    completeService,
    reopenCompletedBooking,
    markPaid,
};
