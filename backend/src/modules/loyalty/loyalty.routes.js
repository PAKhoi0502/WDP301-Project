const express = require('express');

const loyaltyController = require('./loyalty.controller');
const {
    customerIdParamSchema,
    customerTransactionsSchema,
    adminLoyaltyListSchema,
    adminTransactionsSchema,
    adminCustomerTransactionsSchema,
} = require('./loyalty.validator');
const { validate } = require('../../shared/middlewares/validate.middleware');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');
const { USER_ROLES } = require('../../shared/constants/roles.constant');

const customerRouter = express.Router();
const adminRouter = express.Router();

customerRouter.use(authenticate, authorize(USER_ROLES.CUSTOMER));

customerRouter.get('/me', loyaltyController.getMyLoyalty);

customerRouter.get(
    '/me/transactions',
    validate(customerTransactionsSchema),
    loyaltyController.getMyPointTransactions
);

customerRouter.get('/tier-rules', loyaltyController.getCustomerTierRules);

adminRouter.use(authenticate, authorize(USER_ROLES.ADMIN));

adminRouter.get(
    '/customers',
    validate(adminLoyaltyListSchema),
    loyaltyController.getAllCustomerLoyalties
);

adminRouter.get(
    '/transactions',
    validate(adminTransactionsSchema),
    loyaltyController.getAllPointTransactions
);

adminRouter.get('/tier-rules', loyaltyController.getAdminTierRules);

adminRouter.get(
    '/customers/:customerId',
    validate(customerIdParamSchema),
    loyaltyController.getCustomerLoyaltyByCustomerId
);

adminRouter.get(
    '/customers/:customerId/transactions',
    validate(adminCustomerTransactionsSchema),
    loyaltyController.getCustomerPointTransactionsByCustomerId
);

module.exports = {
    customerRouter,
    adminRouter,
};
