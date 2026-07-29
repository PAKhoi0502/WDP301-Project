const express = require('express');
const bookingViolationController = require('./bookingViolation.controller');
const {
    historySchema,
    createAppealSchema,
    getAppealsSchema,
    listAdminCustomersSchema,
    customerDetailSchema,
    adjustScoreSchema,
    reviewAppealSchema,
} = require('./bookingViolation.validator');
const { validate } = require('../../shared/middlewares/validate.middleware');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');
const { USER_ROLES } = require('../../shared/constants/roles.constant');

const customerRouter = express.Router();
const adminRouter = express.Router();

customerRouter.use(authenticate, authorize(USER_ROLES.CUSTOMER));
customerRouter.get('/me', bookingViolationController.getMyStatus);
customerRouter.get(
    '/me/history',
    validate(historySchema),
    bookingViolationController.getMyHistory
);
customerRouter.get(
    '/me/appeals',
    validate(getAppealsSchema),
    bookingViolationController.getMyAppeals
);
customerRouter.post(
    '/me/appeals',
    validate(createAppealSchema),
    bookingViolationController.createMyAppeal
);

adminRouter.use(authenticate, authorize(USER_ROLES.ADMIN));
adminRouter.get(
    '/',
    validate(listAdminCustomersSchema),
    bookingViolationController.listAdminCustomers
);
adminRouter.get(
    '/appeals',
    validate(getAppealsSchema),
    bookingViolationController.getAdminAppeals
);
adminRouter.patch(
    '/appeals/:appealId',
    validate(reviewAppealSchema),
    bookingViolationController.reviewAppeal
);
adminRouter.get(
    '/:customerId',
    validate(customerDetailSchema),
    bookingViolationController.getAdminCustomerDetail
);
adminRouter.post(
    '/:customerId/adjustments',
    validate(adjustScoreSchema),
    bookingViolationController.adjustCustomerScore
);

module.exports = {
    customerRouter,
    adminRouter,
};
