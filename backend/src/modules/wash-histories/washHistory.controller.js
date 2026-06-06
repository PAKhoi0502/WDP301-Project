const washHistoryService = require('./washHistory.service');
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

const getAllWashHistories = asyncHandler(async (req, res) => {
    const { query } = req.validated;

    const result = await washHistoryService.getAllWashHistories(query);

    return sendSuccess(res, {
        message: 'Get wash histories successfully',
        data: result.data,
        meta: result.meta,
    });
});

const getWashHistoryById = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await washHistoryService.getWashHistoryById(id);

    return sendSuccess(res, {
        message: 'Get wash history successfully',
        data: result,
    });
});

module.exports = {
    getMyWashHistories,
    getMyWashHistoryById,
    getAllWashHistories,
    getWashHistoryById,
};
