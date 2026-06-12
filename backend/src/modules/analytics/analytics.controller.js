const analyticsService = require('./analytics.service');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess } = require('../../shared/utils/apiResponse');

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

const getBookingAnalytics = createAnalyticsHandler(
    analyticsService.getBookingAnalytics,
    'Get booking analytics successfully'
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
    getBookingAnalytics,
    getRevenueAnalytics,
    getGarageAnalytics,
    getServiceAnalytics,
    getPromotionAnalytics,
    getWashBayAnalytics,
    getSurveyAnalytics,
};
