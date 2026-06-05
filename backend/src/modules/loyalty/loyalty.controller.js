const loyaltyService = require('./loyalty.service');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../../shared/utils/apiResponse');

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


const getRedeemPreview = asyncHandler(async (req, res) => {
    const { body } = req.validated;

    const result = await loyaltyService.getRedeemPreview(req.user._id, body);

    return sendSuccess(res, {
        message: 'Get redeem preview successfully',
        data: result,
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

const getAdminTierRuleById = asyncHandler(async (req, res) => {
    const { tierRuleId } = req.validated.params;

    const result = await loyaltyService.getTierRuleById(tierRuleId);

    return sendSuccess(res, {
        message: 'Get tier rule successfully',
        data: result,
    });
});

const createTierRule = asyncHandler(async (req, res) => {
    const { body } = req.validated;

    const result = await loyaltyService.createTierRule(body);

    return sendCreated(res, {
        message: 'Create tier rule successfully',
        data: result,
    });
});

const updateTierRule = asyncHandler(async (req, res) => {
    const { tierRuleId } = req.validated.params;
    const { body } = req.validated;

    const result = await loyaltyService.updateTierRule(tierRuleId, body);

    return sendSuccess(res, {
        message: 'Update tier rule successfully',
        data: result,
    });
});

const activateTierRule = asyncHandler(async (req, res) => {
    const { tierRuleId } = req.validated.params;

    const result = await loyaltyService.setTierRuleActiveStatus(tierRuleId, true);

    return sendSuccess(res, {
        message: 'Activate tier rule successfully',
        data: result,
    });
});

const deactivateTierRule = asyncHandler(async (req, res) => {
    const { tierRuleId } = req.validated.params;

    const result = await loyaltyService.setTierRuleActiveStatus(tierRuleId, false);

    return sendSuccess(res, {
        message: 'Deactivate tier rule successfully',
        data: result,
    });
});

const deleteTierRule = asyncHandler(async (req, res) => {
    const { tierRuleId } = req.validated.params;

    const result = await loyaltyService.deleteTierRule(tierRuleId);

    return sendSuccess(res, {
        message: 'Delete tier rule successfully',
        data: result,
    });
});

module.exports = {
    getMyLoyalty,
    getMyPointTransactions,
    getRedeemPreview,
    getCustomerTierRules,
    getAllCustomerLoyalties,
    getCustomerLoyaltyByCustomerId,
    getAllPointTransactions,
    getCustomerPointTransactionsByCustomerId,
    getAdminTierRules,
    getAdminTierRuleById,
    createTierRule,
    updateTierRule,
    activateTierRule,
    deactivateTierRule,
    deleteTierRule,
};
