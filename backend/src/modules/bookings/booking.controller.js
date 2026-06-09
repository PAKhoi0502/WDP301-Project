const bookingService = require('./booking.service');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../../shared/utils/apiResponse');

const getAvailableSlots = asyncHandler(async (req, res) => {
    const { query } = req.validated;

    const result = await bookingService.getAvailableSlots(query);

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

    return sendSuccess(res, {
        message: 'Cancel booking successfully',
        data: result,
    });
});

const cancelBooking = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { body } = req.validated;

    const result = await bookingService.cancelBooking(req.user, id, body || {});

    return sendSuccess(res, {
        message: 'Cancel booking successfully',
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

    const result = await bookingService.checkInBooking(req.user, id, body || {});

    return sendSuccess(res, {
        message: 'Check in booking successfully',
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
    getAllBookings,
    createWalkInBooking,
    checkInBooking,
    assignWashBay,
    startService,
    completeService,
    markPaid,
};
