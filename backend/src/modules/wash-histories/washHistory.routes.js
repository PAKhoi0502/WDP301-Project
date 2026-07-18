const express = require('express');

const washHistoryController = require('./washHistory.controller');
const {
    idParamSchema,
    getMyWashHistoriesSchema,
    getAdminWashHistoriesSchema,
} = require('./washHistory.validator');
const { validate } = require('../../shared/middlewares/validate.middleware');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');
const { USER_ROLES } = require('../../shared/constants/roles.constant');
const { STAFF_CAPABILITIES } = require('../../shared/constants/staff.constant');
const { requireStaffCapabilities } = require('../../shared/middlewares/staffCapability.middleware');

const customerRouter = express.Router();
const adminRouter = express.Router();

customerRouter.use(authenticate, authorize(USER_ROLES.CUSTOMER));
adminRouter.use(authenticate, authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN));
adminRouter.use(requireStaffCapabilities(STAFF_CAPABILITIES.WASH_HISTORY_READ_GARAGE));

customerRouter.get(
    '/',
    validate(getMyWashHistoriesSchema),
    washHistoryController.getMyWashHistories
);

customerRouter.post(
    '/claim',
    washHistoryController.claimMyWalkInHistories
);

customerRouter.get(
    '/:id',
    validate(idParamSchema),
    washHistoryController.getMyWashHistoryById
);

adminRouter.get(
    '/',
    validate(getAdminWashHistoriesSchema),
    washHistoryController.getAllWashHistories
);

adminRouter.get(
    '/:id',
    validate(idParamSchema),
    washHistoryController.getWashHistoryById
);

module.exports = {
    customerRouter,
    adminRouter,
};
