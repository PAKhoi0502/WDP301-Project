const express = require('express');

const feedbackRewardController = require('./feedbackReward.controller');
const {
    customerStatusSchema,
    updateRuleSchema,
    analyticsSchema,
} = require('./feedbackReward.validator');
const { validate } = require('../../shared/middlewares/validate.middleware');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');
const { USER_ROLES } = require('../../shared/constants/roles.constant');

const customerRouter = express.Router();
const adminRouter = express.Router();

customerRouter.use(authenticate, authorize(USER_ROLES.CUSTOMER));
customerRouter.get(
    '/status',
    validate(customerStatusSchema),
    feedbackRewardController.getMyStatus
);

adminRouter.use(authenticate, authorize(USER_ROLES.ADMIN));
adminRouter.get('/rule', feedbackRewardController.getRule);
adminRouter.patch(
    '/rule',
    validate(updateRuleSchema),
    feedbackRewardController.updateRule
);
adminRouter.get(
    '/analytics',
    validate(analyticsSchema),
    feedbackRewardController.getAnalytics
);

module.exports = {
    customerRouter,
    adminRouter,
};
