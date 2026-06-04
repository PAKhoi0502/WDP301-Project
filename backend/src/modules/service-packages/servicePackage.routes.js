const express = require('express');

const servicePackageController = require('./servicePackage.controller');
const {
    idParamSchema,
    getServicePackagesSchema,
    getAdminServicePackagesSchema,
    createServicePackageSchema,
    updateServicePackageSchema,
    updateServicePackageStatusSchema,
    updateStepsTemplateSchema,
    updateIncludedServicesSchema,
} = require('./servicePackage.validator');
const { validate } = require('../../shared/middlewares/validate.middleware');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');
const { USER_ROLES } = require('../../shared/constants/roles.constant');

const publicRouter = express.Router();
const adminRouter = express.Router();

publicRouter.get(
    '/',
    validate(getServicePackagesSchema),
    servicePackageController.getPublicServicePackages
);

publicRouter.get(
    '/:id',
    validate(idParamSchema),
    servicePackageController.getPublicServicePackageById
);

adminRouter.use(authenticate, authorize(USER_ROLES.ADMIN));

adminRouter.get(
    '/',
    validate(getAdminServicePackagesSchema),
    servicePackageController.getAllServicePackages
);

adminRouter.post(
    '/',
    validate(createServicePackageSchema),
    servicePackageController.createServicePackage
);

adminRouter.get(
    '/:id',
    validate(idParamSchema),
    servicePackageController.getServicePackageById
);

adminRouter.patch(
    '/:id/activate',
    validate(updateServicePackageStatusSchema),
    servicePackageController.activateServicePackage
);

adminRouter.patch(
    '/:id/deactivate',
    validate(updateServicePackageStatusSchema),
    servicePackageController.deactivateServicePackage
);

adminRouter.patch(
    '/:id/steps-template',
    validate(updateStepsTemplateSchema),
    servicePackageController.updateStepsTemplate
);

adminRouter.patch(
    '/:id/included-services',
    validate(updateIncludedServicesSchema),
    servicePackageController.updateIncludedServices
);

adminRouter.patch(
    '/:id',
    validate(updateServicePackageSchema),
    servicePackageController.updateServicePackage
);

adminRouter.delete(
    '/:id',
    validate(idParamSchema),
    servicePackageController.deactivateServicePackage
);

module.exports = {
    publicRouter,
    adminRouter,
};
