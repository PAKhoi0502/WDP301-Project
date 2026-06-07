const express = require('express');

const paymentController = require('./payment.controller');
const {
    createPayosPaymentSchema,
    paymentIdParamSchema,
    cancelPaymentSchema,
    payosWebhookSchema,
} = require('./payment.validator');
const { validate } = require('../../shared/middlewares/validate.middleware');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');
const { USER_ROLES } = require('../../shared/constants/roles.constant');

const publicRouter = express.Router();
const adminRouter = express.Router();

publicRouter.post(
    '/payos/webhook',
    validate(payosWebhookSchema),
    paymentController.handlePayosWebhook
);

adminRouter.use(authenticate, authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN));

adminRouter.post(
    '/bookings/:bookingId/payos',
    validate(createPayosPaymentSchema),
    paymentController.createPayosPayment
);

adminRouter.get(
    '/:paymentId',
    validate(paymentIdParamSchema),
    paymentController.getPaymentById
);

adminRouter.patch(
    '/:paymentId/cancel',
    validate(cancelPaymentSchema),
    paymentController.cancelPayosPayment
);

module.exports = {
    publicRouter,
    adminRouter,
};
