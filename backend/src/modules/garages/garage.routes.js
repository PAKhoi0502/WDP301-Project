const express = require('express');

const garageController = require('./garage.controller');
const {
    idParamSchema,
    getGaragesSchema,
    getAdminGaragesSchema,
    createGarageSchema,
    updateGarageSchema,
    updateGarageStatusSchema,
} = require('./garage.validator');
const { validate } = require('../../shared/middlewares/validate.middleware');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');
const { USER_ROLES } = require('../../shared/constants/roles.constant');

const publicRouter = express.Router();
const adminRouter = express.Router();

publicRouter.get(
    '/',
    validate(getGaragesSchema),
    garageController.getPublicGarages
);

publicRouter.get(
    '/:id',
    validate(idParamSchema),
    garageController.getPublicGarageById
);

adminRouter.use(authenticate, authorize(USER_ROLES.ADMIN));

adminRouter.get(
    '/',
    validate(getAdminGaragesSchema),
    garageController.getAllGarages
);

adminRouter.post(
    '/',
    validate(createGarageSchema),
    garageController.createGarage
);

adminRouter.get(
    '/:id',
    validate(idParamSchema),
    garageController.getGarageById
);

adminRouter.patch(
    '/:id/status',
    validate(updateGarageStatusSchema),
    garageController.updateGarageStatus
);

adminRouter.patch(
    '/:id',
    validate(updateGarageSchema),
    garageController.updateGarage
);

adminRouter.delete(
    '/:id',
    validate(idParamSchema),
    garageController.deleteGarage
);

module.exports = {
    publicRouter,
    adminRouter,
};
