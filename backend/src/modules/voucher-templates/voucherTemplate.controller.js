const voucherTemplateService = require('./voucherTemplate.service');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../../shared/utils/apiResponse');

const getCustomerVoucherTemplates = asyncHandler(async (req, res) => {
    const { query } = req.validated;

    const result = await voucherTemplateService.getCustomerVoucherTemplates(req.user._id, query);

    return sendSuccess(res, {
        message: 'Get voucher templates successfully',
        data: result.data,
        meta: result.meta,
    });
});

const redeemVoucherTemplate = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { garage_id } = req.validated.body;

    const result = await voucherTemplateService.redeemVoucherTemplate({
        customerId: req.user._id,
        voucherTemplateId: id,
        garageId: garage_id,
    });

    return sendCreated(res, {
        message: 'Redeem voucher template successfully',
        data: result,
    });
});

const getAllVoucherTemplates = asyncHandler(async (req, res) => {
    const { query } = req.validated;

    const result = await voucherTemplateService.getAllVoucherTemplates(query);

    return sendSuccess(res, {
        message: 'Get voucher templates successfully',
        data: result.data,
        meta: result.meta,
    });
});

const getVoucherTemplateById = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await voucherTemplateService.getVoucherTemplateById(id);

    return sendSuccess(res, {
        message: 'Get voucher template successfully',
        data: result,
    });
});

const createVoucherTemplate = asyncHandler(async (req, res) => {
    const { body } = req.validated;

    const result = await voucherTemplateService.createVoucherTemplate(req.user._id, body);

    return sendCreated(res, {
        message: 'Create voucher template successfully',
        data: result,
    });
});

const updateVoucherTemplate = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { body } = req.validated;

    const result = await voucherTemplateService.updateVoucherTemplate(req.user._id, id, body);

    return sendSuccess(res, {
        message: 'Update voucher template successfully',
        data: result,
    });
});

const activateVoucherTemplate = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await voucherTemplateService.updateVoucherTemplateStatus(req.user._id, id, true);

    return sendSuccess(res, {
        message: 'Activate voucher template successfully',
        data: result,
    });
});

const deactivateVoucherTemplate = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await voucherTemplateService.updateVoucherTemplateStatus(req.user._id, id, false);

    return sendSuccess(res, {
        message: 'Deactivate voucher template successfully',
        data: result,
    });
});

const deleteVoucherTemplate = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await voucherTemplateService.deleteVoucherTemplate(id);

    return sendSuccess(res, {
        message: 'Delete voucher template successfully',
        data: result,
    });
});

module.exports = {
    getCustomerVoucherTemplates,
    redeemVoucherTemplate,
    getAllVoucherTemplates,
    getVoucherTemplateById,
    createVoucherTemplate,
    updateVoucherTemplate,
    activateVoucherTemplate,
    deactivateVoucherTemplate,
    deleteVoucherTemplate,
};
