const servicePriceRuleService = require('./servicePriceRule.service');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../../shared/utils/apiResponse');
const { getAuditRequestContext } = require('../audit-logs/auditLog.service');

const listRules = asyncHandler(async (req, res) => {
    const result = await servicePriceRuleService.listRules(req.validated.query);
    return sendSuccess(res, {
        message: 'Get service price rules successfully',
        data: result.data,
        meta: result.meta,
    });
});

const createRule = asyncHandler(async (req, res) => {
    const result = await servicePriceRuleService.createRule(
        req.user,
        req.validated.body,
        getAuditRequestContext(req)
    );
    return sendCreated(res, {
        message: 'Create service price rule successfully',
        data: result,
    });
});

const updateRule = asyncHandler(async (req, res) => {
    const result = await servicePriceRuleService.updateRule(
        req.user,
        req.validated.params.id,
        req.validated.body,
        getAuditRequestContext(req)
    );
    return sendSuccess(res, {
        message: 'Update service price rule successfully',
        data: result,
    });
});

const deactivateRule = asyncHandler(async (req, res) => {
    const result = await servicePriceRuleService.deactivateRule(
        req.user,
        req.validated.params.id,
        getAuditRequestContext(req)
    );
    return sendSuccess(res, {
        message: 'Deactivate service price rule successfully',
        data: result,
    });
});

const createCustomerQuote = asyncHandler(async (req, res) => {
    const body = req.validated.body;
    const result = await servicePriceRuleService.createQuote({
        customerId: req.user._id,
        garageId: body.garage_id,
        vehicleId: body.vehicle_id,
        servicePackageId: body.service_package_id,
        addOnServiceIds: body.add_on_service_ids,
        effectiveAt: body.effective_at,
    });
    return sendCreated(res, {
        message: 'Create price quote successfully',
        data: result,
    });
});

const createWalkInQuote = asyncHandler(async (req, res) => {
    const body = req.validated.body;
    const result = await servicePriceRuleService.createQuote({
        staffUser: req.user,
        garageId: body.garage_id,
        vehicleSnapshot: body.vehicle_snapshot,
        servicePackageId: body.service_package_id,
        addOnServiceIds: body.add_on_service_ids,
        effectiveAt: body.effective_at,
    });
    return sendCreated(res, {
        message: 'Create walk-in price quote successfully',
        data: result,
    });
});

module.exports = {
    listRules,
    createRule,
    updateRule,
    deactivateRule,
    createCustomerQuote,
    createWalkInQuote,
};
