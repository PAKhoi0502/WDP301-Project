const express = require('express');

const customerVoucherController = require('./customerVoucher.controller');
const {
    idParamSchema,
    getVouchersSchema,
    validateVoucherSchema,
} = require('./customerVoucher.validator');
const { validate } = require('../../shared/middlewares/validate.middleware');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');
const { USER_ROLES } = require('../../shared/constants/roles.constant');

const customerRouter = express.Router();
const adminRouter = express.Router();

customerRouter.use(authenticate, authorize(USER_ROLES.CUSTOMER));

customerRouter.get(
    '/',
    validate(getVouchersSchema),
    customerVoucherController.getMyVouchers
);

customerRouter.post(
    '/validate',
    validate(validateVoucherSchema),
    customerVoucherController.validateMyVoucher
);

adminRouter.use(authenticate, authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN));

adminRouter.get(
    '/',
    validate(getVouchersSchema),
    customerVoucherController.getAdminVouchers
);

adminRouter.patch(
    '/:id/approve',
    authorize(USER_ROLES.ADMIN),
    validate(idParamSchema),
    customerVoucherController.approveVoucher
);

adminRouter.patch(
    '/:id/revoke',
    authorize(USER_ROLES.ADMIN),
    validate(idParamSchema),
    customerVoucherController.revokeVoucher
);

module.exports = {
    customerRouter,
    adminRouter,
};
