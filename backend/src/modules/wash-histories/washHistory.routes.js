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

const customerRouter = express.Router();
const adminRouter = express.Router();

customerRouter.use(authenticate, authorize(USER_ROLES.CUSTOMER));
adminRouter.use(authenticate, authorize(USER_ROLES.ADMIN));

customerRouter.get(
    '/',
    validate(getMyWashHistoriesSchema),
    washHistoryController.getMyWashHistories
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
