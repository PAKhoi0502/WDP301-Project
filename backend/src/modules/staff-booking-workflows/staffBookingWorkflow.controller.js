const staffBookingWorkflowService = require('./staffBookingWorkflow.service');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess } = require('../../shared/utils/apiResponse');

const listBookingWorkflows = asyncHandler(async (req, res) => {
    const result = await staffBookingWorkflowService.listBookingWorkflows(
        req.staffContext,
        req.validated.query
    );

    return sendSuccess(res, {
        message: 'Get staff booking workflows successfully',
        data: result.data,
        meta: result.meta,
    });
});

const getBookingWorkflow = asyncHandler(async (req, res) => {
    const result = await staffBookingWorkflowService.getBookingWorkflow(
        req.staffContext,
        req.validated.params.bookingId
    );

    return sendSuccess(res, {
        message: 'Get staff booking workflow successfully',
        data: result,
    });
});

const claimInspectionBooking = asyncHandler(async (req, res) => {
    const result = await staffBookingWorkflowService.claimInspectionBooking(
        req.staffContext,
        req.validated.params.bookingId
    );

    return sendSuccess(res, {
        message: 'Claim inspection booking successfully',
        data: result,
    });
});

module.exports = {
    listBookingWorkflows,
    getBookingWorkflow,
    claimInspectionBooking,
};
