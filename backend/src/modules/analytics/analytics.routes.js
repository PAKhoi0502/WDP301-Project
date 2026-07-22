const express = require('express');

const analyticsController = require('./analytics.controller');
const {
    analyticsQuerySchema,
    surveyAnalyticsSchema,
} = require('./analytics.validator');
const { validate } = require('../../shared/middlewares/validate.middleware');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');
const { USER_ROLES } = require('../../shared/constants/roles.constant');

const adminRouter = express.Router();

adminRouter.use(authenticate, authorize(USER_ROLES.ADMIN));

adminRouter.get('/overview', validate(analyticsQuerySchema), analyticsController.getOverview);
adminRouter.get('/bookings', validate(analyticsQuerySchema), analyticsController.getBookingAnalytics);
adminRouter.get('/revenue', validate(analyticsQuerySchema), analyticsController.getRevenueAnalytics);
adminRouter.get('/garages', validate(analyticsQuerySchema), analyticsController.getGarageAnalytics);
adminRouter.get('/services', validate(analyticsQuerySchema), analyticsController.getServiceAnalytics);
adminRouter.get('/promotions', validate(analyticsQuerySchema), analyticsController.getPromotionAnalytics);
adminRouter.get('/wash-bays', validate(analyticsQuerySchema), analyticsController.getWashBayAnalytics);
adminRouter.get('/payments', validate(analyticsQuerySchema), analyticsController.getPaymentAnalytics);
adminRouter.get('/surveys/:surveyId', validate(surveyAnalyticsSchema), analyticsController.getSurveyAnalytics);

module.exports = {
    adminRouter,
};
