const promotionService = require('./promotion.service');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../../shared/utils/apiResponse');

const getPublicPromotions = asyncHandler(async (req, res) => {
    const { query } = req.validated;

    const result = await promotionService.getPublicPromotions(query);

    return sendSuccess(res, {
        message: 'Get promotions successfully',
        data: result.data,
        meta: result.meta,
    });
});

const getPublicPromotionById = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await promotionService.getPublicPromotionById(id);

    return sendSuccess(res, {
        message: 'Get promotion successfully',
        data: result,
    });
});

const validatePromotion = asyncHandler(async (req, res) => {
    const { body } = req.validated;

    const result = await promotionService.validatePromotion(req.user._id, body);

    return sendSuccess(res, {
        message: 'Validate promotion successfully',
        data: result,
    });
});

const getAllPromotions = asyncHandler(async (req, res) => {
    const { query } = req.validated;

    const result = await promotionService.getAllPromotions(query);

    return sendSuccess(res, {
        message: 'Get promotions successfully',
        data: result.data,
        meta: result.meta,
    });
});

const getPromotionById = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await promotionService.getPromotionById(id);

    return sendSuccess(res, {
        message: 'Get promotion successfully',
        data: result,
    });
});

const createPromotion = asyncHandler(async (req, res) => {
    const { body } = req.validated;

    const result = await promotionService.createPromotion(req.user._id, body);

    return sendCreated(res, {
        message: 'Create promotion successfully',
        data: result,
    });
});

const updatePromotion = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { body } = req.validated;

    const result = await promotionService.updatePromotion(req.user._id, id, body);

    return sendSuccess(res, {
        message: 'Update promotion successfully',
        data: result,
    });
});

const activatePromotion = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await promotionService.updatePromotionStatus(req.user._id, id, true);

    return sendSuccess(res, {
        message: 'Activate promotion successfully',
        data: result,
    });
});

const deactivatePromotion = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await promotionService.updatePromotionStatus(req.user._id, id, false);

    return sendSuccess(res, {
        message: 'Deactivate promotion successfully',
        data: result,
    });
});

const deletePromotion = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await promotionService.deletePromotion(id);

    return sendSuccess(res, {
        message: 'Delete promotion successfully',
        data: result,
    });
});

module.exports = {
    getPublicPromotions,
    getPublicPromotionById,
    validatePromotion,
    getAllPromotions,
    getPromotionById,
    createPromotion,
    updatePromotion,
    activatePromotion,
    deactivatePromotion,
    deletePromotion,
};
