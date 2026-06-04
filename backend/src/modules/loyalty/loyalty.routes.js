const express = require('express');

const loyaltyController = require('./loyalty.controller');
const {
    customerIdParamSchema,
    customerTransactionsSchema,
    adminLoyaltyListSchema,
    adminTransactionsSchema,
    adminCustomerTransactionsSchema,
    tierRuleIdParamSchema,
    createTierRuleSchema,
    updateTierRuleSchema,
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

adminRouter.post(
    '/tier-rules',
    validate(createTierRuleSchema),
    loyaltyController.createTierRule
);

adminRouter.get(
    '/tier-rules/:tierRuleId',
    validate(tierRuleIdParamSchema),
    loyaltyController.getAdminTierRuleById
);

adminRouter.patch(
    '/tier-rules/:tierRuleId',
    validate(updateTierRuleSchema),
    loyaltyController.updateTierRule
);

adminRouter.patch(
    '/tier-rules/:tierRuleId/activate',
    validate(tierRuleIdParamSchema),
    loyaltyController.activateTierRule
);

adminRouter.patch(
    '/tier-rules/:tierRuleId/deactivate',
    validate(tierRuleIdParamSchema),
    loyaltyController.deactivateTierRule
);

adminRouter.delete(
    '/tier-rules/:tierRuleId',
    validate(tierRuleIdParamSchema),
    loyaltyController.deleteTierRule
);

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
