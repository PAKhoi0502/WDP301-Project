const bookingService = require('./booking.service');
const bookingWaitlistService = require('../booking-waitlists/bookingWaitlist.service');
const { getAuditRequestContext } = require('../audit-logs/auditLog.service');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../../shared/utils/apiResponse');

const offerNextWaitlistForReleasedBooking = async (booking) => {
    try {
        return await bookingWaitlistService.offerNextForReleasedBooking(booking);
    } catch (error) {
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

    await offerNextWaitlistForReleasedBooking(result);

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

const startService = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { body } = req.validated;

    const result = await bookingService.startService(req.user, id, body || {});

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

module.exports = {
    getAvailableSlots,
    getMyBookings,
    getMyBookingById,
    createCustomerBooking,
    cancelMyBooking,
    cancelBooking,
    markNoShow,
    getAllBookings,
    createWalkInBooking,
    checkInBooking,
    getLateArrivalOptions,
    resolveLateArrival,
    assignWashBay,
    startService,
    completeService,
    markPaid,
};
