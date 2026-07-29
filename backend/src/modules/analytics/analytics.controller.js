const analyticsService = require('./analytics.service');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess } = require('../../shared/utils/apiResponse');
const { STAFF_CAPABILITIES } = require('../../shared/constants/staff.constant');

const createAnalyticsHandler = (serviceMethod, message) => asyncHandler(async (req, res) => {
    const result = await serviceMethod(req.validated.query);

    return sendSuccess(res, {
        message,
        data: result,
    });
});

const getOverview = createAnalyticsHandler(
    analyticsService.getOverview,
    'Get analytics overview successfully'
);

const getStaffOverview = asyncHandler(async (req, res) => {
    const includeRevenue = req.staffContext.capabilities.includes(
        STAFF_CAPABILITIES.PAYMENT_MANAGE_GARAGE
    );
    const result = await analyticsService.getStaffOverview(
        req.validated.query,
        {
            garageId: req.staffContext.garage_id,
            includeRevenue,
        }
    );

    return sendSuccess(res, {
        message: 'Get staff dashboard overview successfully',
        data: result,
    });
});

const getBookingAnalytics = createAnalyticsHandler(
    analyticsService.getBookingAnalytics,
    'Get booking analytics successfully'
);

const getCustomerAnalytics = createAnalyticsHandler(
    analyticsService.getCustomerAnalytics,
    'Get customer analytics successfully'
);

const getRevenueAnalytics = createAnalyticsHandler(
    analyticsService.getRevenueAnalytics,
    'Get revenue analytics successfully'
);

const getGarageAnalytics = createAnalyticsHandler(
    analyticsService.getGarageAnalytics,
    'Get garage analytics successfully'
);

const getServiceAnalytics = createAnalyticsHandler(
    analyticsService.getServiceAnalytics,
    'Get service analytics successfully'
);

const getPromotionAnalytics = createAnalyticsHandler(
    analyticsService.getPromotionAnalytics,
    'Get promotion analytics successfully'
);

const getWashBayAnalytics = createAnalyticsHandler(
    analyticsService.getWashBayAnalytics,
    'Get wash bay analytics successfully'
);

const getPaymentAnalytics = createAnalyticsHandler(
    analyticsService.getPaymentAnalytics,
    'Get payment analytics successfully'
);

const getSurveyAnalytics = asyncHandler(async (req, res) => {
    const result = await analyticsService.getSurveyAnalytics(
        req.validated.params.surveyId,
        req.validated.query
    );

    return sendSuccess(res, {
        message: 'Get survey analytics successfully',
        data: result,
    });
});

module.exports = {
    getOverview,
    getStaffOverview,
    getBookingAnalytics,
    getCustomerAnalytics,
    getRevenueAnalytics,
    getGarageAnalytics,
    getServiceAnalytics,
    getPromotionAnalytics,
    getWashBayAnalytics,
    getPaymentAnalytics,
    getSurveyAnalytics,
};
