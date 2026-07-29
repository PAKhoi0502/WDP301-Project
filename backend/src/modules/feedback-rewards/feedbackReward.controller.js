const feedbackRewardService = require('./feedbackReward.service');
const { getAuditRequestContext } = require('../audit-logs/auditLog.service');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess } = require('../../shared/utils/apiResponse');

const getMyStatus = asyncHandler(async (req, res) => {
    const result = await feedbackRewardService.getCustomerFeedbackStatus(
        req.user._id,
        req.validated.query.booking_id
    );

    return sendSuccess(res, {
        message: 'Get feedback reward status successfully',
        data: result,
    });
});

const getRule = asyncHandler(async (req, res) => {
    const result = await feedbackRewardService.getRule();

    return sendSuccess(res, {
        message: 'Get feedback reward rule successfully',
        data: result,
    });
});

const updateRule = asyncHandler(async (req, res) => {
    const result = await feedbackRewardService.updateRule(
        req.user,
        req.validated.body,
        getAuditRequestContext(req)
    );

    return sendSuccess(res, {
        message: 'Update feedback reward rule successfully',
        data: result,
    });
});

const getAnalytics = asyncHandler(async (req, res) => {
    const result = await feedbackRewardService.getAnalytics(req.validated.query);

    return sendSuccess(res, {
        message: 'Get feedback reward analytics successfully',
        data: result,
    });
});

module.exports = {
    getMyStatus,
    getRule,
    updateRule,
    getAnalytics,
};
