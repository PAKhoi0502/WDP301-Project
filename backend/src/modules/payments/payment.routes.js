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
const { STAFF_CAPABILITIES } = require('../../shared/constants/staff.constant');
const { requireStaffCapabilities } = require('../../shared/middlewares/staffCapability.middleware');

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

customerRouter.patch(
    '/:paymentId/cancel',
    validate(cancelPaymentSchema),
    paymentController.cancelPayosPayment
);

adminRouter.use(authenticate, authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN));
adminRouter.use(requireStaffCapabilities(STAFF_CAPABILITIES.PAYMENT_MANAGE_GARAGE));

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
