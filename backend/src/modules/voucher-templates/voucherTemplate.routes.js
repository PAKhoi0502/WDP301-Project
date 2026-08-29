const express = require('express');

const voucherTemplateController = require('./voucherTemplate.controller');
const {
    idParamSchema,
    getCustomerVoucherTemplatesSchema,
    getAdminVoucherTemplatesSchema,
    createVoucherTemplateSchema,
    updateVoucherTemplateSchema,
    updateVoucherTemplateStatusSchema,
    redeemVoucherTemplateSchema,
} = require('./voucherTemplate.validator');
const { validate } = require('../../shared/middlewares/validate.middleware');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');
const { USER_ROLES } = require('../../shared/constants/roles.constant');

const customerRouter = express.Router();
const adminRouter = express.Router();

customerRouter.use(authenticate, authorize(USER_ROLES.CUSTOMER));

customerRouter.get(
    '/',
    validate(getCustomerVoucherTemplatesSchema),
    voucherTemplateController.getCustomerVoucherTemplates
);

customerRouter.post(
    '/:id/redeem',
    validate(redeemVoucherTemplateSchema),
    voucherTemplateController.redeemVoucherTemplate
);

adminRouter.use(authenticate, authorize(USER_ROLES.ADMIN));

adminRouter.get(
    '/',
    validate(getAdminVoucherTemplatesSchema),
    voucherTemplateController.getAllVoucherTemplates
);

adminRouter.post(
    '/',
    validate(createVoucherTemplateSchema),
    voucherTemplateController.createVoucherTemplate
);

adminRouter.get(
    '/:id',
    validate(idParamSchema),
    voucherTemplateController.getVoucherTemplateById
);

adminRouter.patch(
    '/:id',
    validate(updateVoucherTemplateSchema),
    voucherTemplateController.updateVoucherTemplate
);

adminRouter.patch(
    '/:id/activate',
    validate(updateVoucherTemplateStatusSchema),
    voucherTemplateController.activateVoucherTemplate
);

adminRouter.patch(
    '/:id/deactivate',
    validate(updateVoucherTemplateStatusSchema),
    voucherTemplateController.deactivateVoucherTemplate
);

adminRouter.delete(
    '/:id',
    validate(idParamSchema),
    voucherTemplateController.deleteVoucherTemplate
);

module.exports = {
    customerRouter,
    adminRouter,
};
