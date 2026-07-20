const paymentService = require('./payment.service');
const { getAuditRequestContext } = require('../audit-logs/auditLog.service');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../../shared/utils/apiResponse');

const createPayosPayment = asyncHandler(async (req, res) => {
    const { bookingId } = req.validated.params;
    const { body } = req.validated;

    const result = await paymentService.createPayosPayment(
        req.user,
        bookingId,
        body || {},
        getAuditRequestContext(req)
    );

    if (result.reused) {
        return sendSuccess(res, {
            message: 'Get existing PayOS payment successfully',
            data: result,
        });
    }

    return sendCreated(res, {
        message: 'Create PayOS payment successfully',
        data: result,
    });
});

const getPayosPaymentForBooking = asyncHandler(async (req, res) => {
    const { bookingId } = req.validated.params;
    const result = await paymentService.getPayosPaymentForBooking(req.user, bookingId);

    return sendSuccess(res, {
        message: 'Get booking PayOS payment successfully',
        data: result,
    });
});

const getPaymentById = asyncHandler(async (req, res) => {
    const { paymentId } = req.validated.params;

    const result = await paymentService.getPaymentById(req.user, paymentId);

    return sendSuccess(res, {
        message: 'Get payment successfully',
        data: result,
    });
});

const cancelPayosPayment = asyncHandler(async (req, res) => {
    const { paymentId } = req.validated.params;
    const { body } = req.validated;

    const result = await paymentService.cancelPayosPayment(
        req.user,
        paymentId,
        body || {},
        getAuditRequestContext(req)
    );

    return sendSuccess(res, {
        message: 'Cancel PayOS payment successfully',
        data: result,
    });
});

const expirePayosPayment = asyncHandler(async (req, res) => {
    const { paymentId } = req.validated.params;

    const result = await paymentService.expirePayosPayment(
        req.user,
        paymentId,
        getAuditRequestContext(req)
    );

    return sendSuccess(res, {
        message: 'Expire PayOS payment successfully',
        data: result,
    });
});

const handlePayosWebhook = asyncHandler(async (req, res) => {
    const { body } = req.validated;

    const result = await paymentService.handlePayosWebhook(body);

    return sendSuccess(res, {
        message: 'Process PayOS webhook successfully',
        data: result,
    });
});

module.exports = {
    createPayosPayment,
    getPayosPaymentForBooking,
    getPaymentById,
    cancelPayosPayment,
    expirePayosPayment,
    handlePayosWebhook,
};
