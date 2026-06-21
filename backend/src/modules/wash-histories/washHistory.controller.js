const washHistoryService = require('./washHistory.service');
const walkInClaimService = require('./walkInClaim.service');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess } = require('../../shared/utils/apiResponse');

const getMyWashHistories = asyncHandler(async (req, res) => {
    const { query } = req.validated;

    const result = await washHistoryService.getMyWashHistories(req.user._id, query);

    return sendSuccess(res, {
        message: 'Get wash histories successfully',
        data: result.data,
        meta: result.meta,
    });
});

const getMyWashHistoryById = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await washHistoryService.getMyWashHistoryById(req.user._id, id);

    return sendSuccess(res, {
        message: 'Get wash history successfully',
        data: result,
    });
});

const claimMyWalkInHistories = asyncHandler(async (req, res) => {
    const result = await walkInClaimService.claimWalkInHistoryForCustomer({
        customerId: req.user._id,
        phone: req.user.phone,
        phoneVerifiedAt: req.user.phone_verified_at,
    });

    return sendSuccess(res, {
        message: 'Claim walk-in histories successfully',
        data: result,
    });
});

const getAllWashHistories = asyncHandler(async (req, res) => {
    const { query } = req.validated;

    const result = await washHistoryService.getAllWashHistories(req.user, query);

    return sendSuccess(res, {
        message: 'Get wash histories successfully',
        data: result.data,
        meta: result.meta,
    });
});

const getWashHistoryById = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await washHistoryService.getWashHistoryById(req.user, id);

    return sendSuccess(res, {
        message: 'Get wash history successfully',
        data: result,
    });
});

module.exports = {
    getMyWashHistories,
    getMyWashHistoryById,
    claimMyWalkInHistories,
    getAllWashHistories,
    getWashHistoryById,
};
