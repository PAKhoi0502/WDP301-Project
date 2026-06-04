const bookingService = require('../bookings/booking.service');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess } = require('../../shared/utils/apiResponse');

const getBookingServiceSteps = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await bookingService.getBookingServiceSteps(req.user, id);

    return sendSuccess(res, {
        message: 'Get booking service steps successfully',
        data: result,
    });
});

const markBookingServiceStepDone = asyncHandler(async (req, res) => {
    const { id, stepId } = req.validated.params;
    const { body } = req.validated;

    const result = await bookingService.markBookingServiceStepDone(req.user, id, stepId, body || {});

    return sendSuccess(res, {
        message: 'Complete booking service step successfully',
        data: result,
    });
});

module.exports = {
    getBookingServiceSteps,
    markBookingServiceStepDone,
};
