const express = require('express');

const washBayController = require('./washBay.controller');
const {
    idParamSchema,
    garageIdParamSchema,
    availableWashBaysByGarageSchema,
    getWashBaysSchema,
    getStaffWashBaysSchema,
    createWashBaySchema,
    updateWashBaySchema,
    updateWashBayStatusSchema,
} = require('./washBay.validator');
const { validate } = require('../../shared/middlewares/validate.middleware');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');
const { USER_ROLES } = require('../../shared/constants/roles.constant');
const { STAFF_CAPABILITIES } = require('../../shared/constants/staff.constant');
const {
    requireStaffCapabilities,
} = require('../../shared/middlewares/staffCapability.middleware');

const adminRouter = express.Router();
const garageRouter = express.Router({ mergeParams: true });
const availableRouter = express.Router({ mergeParams: true });
const staffRouter = express.Router();

adminRouter.use(authenticate, authorize(USER_ROLES.ADMIN));
garageRouter.use(authenticate, authorize(USER_ROLES.ADMIN));
availableRouter.use(authenticate, authorize(USER_ROLES.ADMIN));
staffRouter.use(
    authenticate,
    authorize(USER_ROLES.STAFF),
    requireStaffCapabilities(STAFF_CAPABILITIES.BOOKING_WORKFLOW_READ_GARAGE)
);

staffRouter.get(
    '/',
    validate(getStaffWashBaysSchema),
    washBayController.getStaffWorkspaceWashBays
);

adminRouter.get(
    '/',
    validate(getWashBaysSchema),
    washBayController.getAllWashBays
);

adminRouter.post(
    '/',
    validate(createWashBaySchema),
    washBayController.createWashBay
);

adminRouter.get(
    '/:id',
    validate(idParamSchema),
    washBayController.getWashBayById
);

adminRouter.patch(
    '/:id/status',
    validate(updateWashBayStatusSchema),
    washBayController.updateWashBayStatus
);

adminRouter.patch(
    '/:id',
    validate(updateWashBaySchema),
    washBayController.updateWashBay
);

adminRouter.delete(
    '/:id',
    validate(idParamSchema),
    washBayController.deactivateWashBay
);

garageRouter.get(
    '/',
    validate(garageIdParamSchema),
    washBayController.getWashBaysByGarage
);

availableRouter.get(
    '/',
    validate(availableWashBaysByGarageSchema),
    washBayController.getAvailableWashBaysByGarage
);

module.exports = {
    adminRouter,
    garageRouter,
    availableRouter,
    staffRouter,
};
