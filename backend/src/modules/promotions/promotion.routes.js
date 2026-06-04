const express = require('express');

const promotionController = require('./promotion.controller');
const {
    idParamSchema,
    getPublicPromotionsSchema,
    getAdminPromotionsSchema,
    validatePromotionSchema,
    createPromotionSchema,
    updatePromotionSchema,
    updatePromotionStatusSchema,
} = require('./promotion.validator');
const { validate } = require('../../shared/middlewares/validate.middleware');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');
const { USER_ROLES } = require('../../shared/constants/roles.constant');

const publicRouter = express.Router();
const customerRouter = express.Router();
const adminRouter = express.Router();

publicRouter.get(
    '/',
    validate(getPublicPromotionsSchema),
    promotionController.getPublicPromotions
);

publicRouter.get(
    '/:id',
    validate(idParamSchema),
    promotionController.getPublicPromotionById
);

customerRouter.use(authenticate, authorize(USER_ROLES.CUSTOMER));

customerRouter.post(
    '/validate',
    validate(validatePromotionSchema),
    promotionController.validatePromotion
);

adminRouter.use(authenticate, authorize(USER_ROLES.ADMIN));

adminRouter.get(
    '/',
    validate(getAdminPromotionsSchema),
    promotionController.getAllPromotions
);

adminRouter.post(
    '/',
    validate(createPromotionSchema),
    promotionController.createPromotion
);

adminRouter.get(
    '/:id',
    validate(idParamSchema),
    promotionController.getPromotionById
);

adminRouter.patch(
    '/:id',
    validate(updatePromotionSchema),
    promotionController.updatePromotion
);

adminRouter.patch(
    '/:id/activate',
    validate(updatePromotionStatusSchema),
    promotionController.activatePromotion
);

adminRouter.patch(
    '/:id/deactivate',
    validate(updatePromotionStatusSchema),
    promotionController.deactivatePromotion
);

adminRouter.delete(
    '/:id',
    validate(idParamSchema),
    promotionController.deletePromotion
);

module.exports = {
    publicRouter,
    customerRouter,
    adminRouter,
};
