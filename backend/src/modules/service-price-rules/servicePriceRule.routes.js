const express = require('express');

const controller = require('./servicePriceRule.controller');
const {
    createRuleSchema,
    updateRuleSchema,
    idParamSchema,
    listRulesSchema,
    customerQuoteSchema,
    walkInQuoteSchema,
} = require('./servicePriceRule.validator');
const { validate } = require('../../shared/middlewares/validate.middleware');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');
const { USER_ROLES } = require('../../shared/constants/roles.constant');

const customerRouter = express.Router();
const adminRouter = express.Router();

customerRouter.use(authenticate, authorize(USER_ROLES.CUSTOMER));
customerRouter.post('/quotes', validate(customerQuoteSchema), controller.createCustomerQuote);

adminRouter.use(authenticate, authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN));
adminRouter.post('/quotes/walk-in', validate(walkInQuoteSchema), controller.createWalkInQuote);
adminRouter.get(
    '/rules',
    authorize(USER_ROLES.ADMIN),
    validate(listRulesSchema),
    controller.listRules
);
adminRouter.post(
    '/rules',
    authorize(USER_ROLES.ADMIN),
    validate(createRuleSchema),
    controller.createRule
);
adminRouter.patch(
    '/rules/:id',
    authorize(USER_ROLES.ADMIN),
    validate(updateRuleSchema),
    controller.updateRule
);
adminRouter.delete(
    '/rules/:id',
    authorize(USER_ROLES.ADMIN),
    validate(idParamSchema),
    controller.deactivateRule
);

module.exports = {
    customerRouter,
    adminRouter,
};
