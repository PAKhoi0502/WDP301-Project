const loyaltyService = require('./loyalty.service');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess } = require('../../shared/utils/apiResponse');

const getMyLoyalty = asyncHandler(async (req, res) => {
    const result = await loyaltyService.getCustomerLoyaltyOverview(req.user._id);

    return sendSuccess(res, {
        message: 'Get loyalty successfully',
        data: result,
    });
});

const getMyPointTransactions = asyncHandler(async (req, res) => {
    const { query } = req.validated;

    const result = await loyaltyService.getCustomerPointTransactions(req.user._id, query);

    return sendSuccess(res, {
        message: 'Get point transactions successfully',
        data: result.data,
        meta: result.meta,
    });
});

const getCustomerTierRules = asyncHandler(async (req, res) => {
    const result = await loyaltyService.getTierRules({ active_only: true });

    return sendSuccess(res, {
        message: 'Get tier rules successfully',
        data: result,
    });
});

const getAllCustomerLoyalties = asyncHandler(async (req, res) => {
    const { query } = req.validated;

    const result = await loyaltyService.getAllCustomerLoyalties(query);

    return sendSuccess(res, {
        message: 'Get customer loyalties successfully',
        data: result.data,
        meta: result.meta,
    });
});

const getCustomerLoyaltyByCustomerId = asyncHandler(async (req, res) => {
    const { customerId } = req.validated.params;

    const result = await loyaltyService.getCustomerLoyaltyForAdmin(customerId);

    return sendSuccess(res, {
        message: 'Get customer loyalty successfully',
        data: result,
    });
});

const getAllPointTransactions = asyncHandler(async (req, res) => {
    const { query } = req.validated;

    const result = await loyaltyService.getAllPointTransactions(query);

    return sendSuccess(res, {
        message: 'Get point transactions successfully',
        data: result.data,
        meta: result.meta,
    });
});

const getCustomerPointTransactionsByCustomerId = asyncHandler(async (req, res) => {
    const { customerId } = req.validated.params;
    const { query } = req.validated;

    const result = await loyaltyService.getCustomerPointTransactions(customerId, query);

    return sendSuccess(res, {
        message: 'Get customer point transactions successfully',
        data: result.data,
        meta: result.meta,
    });
});

const getAdminTierRules = asyncHandler(async (req, res) => {
    const result = await loyaltyService.getTierRules({ active_only: false });

    return sendSuccess(res, {
        message: 'Get tier rules successfully',
        data: result,
    });
});

module.exports = {
    getMyLoyalty,
    getMyPointTransactions,
    getCustomerTierRules,
    getAllCustomerLoyalties,
    getCustomerLoyaltyByCustomerId,
    getAllPointTransactions,
    getCustomerPointTransactionsByCustomerId,
    getAdminTierRules,
};
