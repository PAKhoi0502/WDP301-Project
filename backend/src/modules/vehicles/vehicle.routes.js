const express = require('express');

const vehicleController = require('./vehicle.controller');
const {
    idParamSchema,
    getMyVehiclesSchema,
    getAdminVehiclesSchema,
    createMyVehicleSchema,
    updateMyVehicleSchema,
    createAdminVehicleSchema,
    updateAdminVehicleSchema,
} = require('./vehicle.validator');
const { validate } = require('../../shared/middlewares/validate.middleware');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');
const { USER_ROLES } = require('../../shared/constants/roles.constant');

const customerRouter = express.Router();
const adminRouter = express.Router();

customerRouter.use(authenticate, authorize(USER_ROLES.CUSTOMER));
adminRouter.use(authenticate, authorize(USER_ROLES.ADMIN));

customerRouter.get(
    '/',
    validate(getMyVehiclesSchema),
    vehicleController.getMyVehicles
);

customerRouter.post(
    '/',
    validate(createMyVehicleSchema),
    vehicleController.createMyVehicle
);

customerRouter.get(
    '/:id',
    validate(idParamSchema),
    vehicleController.getMyVehicleById
);

customerRouter.patch(
    '/:id',
    validate(updateMyVehicleSchema),
    vehicleController.updateMyVehicle
);

customerRouter.delete(
    '/:id',
    validate(idParamSchema),
    vehicleController.deactivateMyVehicle
);

adminRouter.get(
    '/',
    validate(getAdminVehiclesSchema),
    vehicleController.getAllVehicles
);

adminRouter.post(
    '/',
    validate(createAdminVehicleSchema),
    vehicleController.createVehicleByAdmin
);

adminRouter.get(
    '/:id',
    validate(idParamSchema),
    vehicleController.getVehicleById
);

adminRouter.patch(
    '/:id',
    validate(updateAdminVehicleSchema),
    vehicleController.updateVehicle
);

adminRouter.delete(
    '/:id',
    validate(idParamSchema),
    vehicleController.deactivateVehicle
);

module.exports = {
    customerRouter,
    adminRouter,
};
