const express = require('express');

const paymentController = require('./payment.controller');
const {
    createPayosPaymentSchema,
    customerCreatePayosPaymentSchema,
    bookingIdParamSchema,
    paymentIdParamSchema,
    cancelPaymentSchema,
    payosWebhookSchema,
} = require('./payment.validator');
const { validate } = require('../../shared/middlewares/validate.middleware');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');
const { USER_ROLES } = require('../../shared/constants/roles.constant');

const publicRouter = express.Router();
const customerRouter = express.Router();
const adminRouter = express.Router();

publicRouter.post(
    '/payos/webhook',
    validate(payosWebhookSchema),
    paymentController.handlePayosWebhook
);

customerRouter.use(authenticate, authorize(USER_ROLES.CUSTOMER));

customerRouter.post(
    '/bookings/:bookingId/payos',
    validate(customerCreatePayosPaymentSchema),
    paymentController.createPayosPayment
);

customerRouter.get(
    '/bookings/:bookingId/payos',
    validate(bookingIdParamSchema),
    paymentController.getPayosPaymentForBooking
);

adminRouter.use(authenticate, authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN));

adminRouter.post(
    '/bookings/:bookingId/payos',
    validate(createPayosPaymentSchema),
    paymentController.createPayosPayment
);

adminRouter.get(
    '/bookings/:bookingId/payos',
    validate(bookingIdParamSchema),
    paymentController.getPayosPaymentForBooking
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

adminRouter.patch(
    '/:paymentId/expire',
    validate(paymentIdParamSchema),
    paymentController.expirePayosPayment
);

module.exports = {
    publicRouter,
    customerRouter,
    adminRouter,
};
