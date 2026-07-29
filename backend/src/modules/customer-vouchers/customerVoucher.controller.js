const customerVoucherService = require('./customerVoucher.service');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../../shared/utils/apiResponse');
const auditLogService = require('../audit-logs/auditLog.service');

const getMyVouchers = asyncHandler(async (req, res) => {
    const result = await customerVoucherService.getMyVouchers(req.user._id, req.validated.query);

    return sendSuccess(res, {
        message: 'Get customer vouchers successfully',
        data: result.data,
        meta: result.meta,
    });
});

const validateMyVoucher = asyncHandler(async (req, res) => {
    const result = await customerVoucherService.validateMyVoucher(req.user._id, req.validated.body);

    return sendSuccess(res, {
        message: 'Validate customer voucher successfully',
        data: result,
    });
});

const getAdminVouchers = asyncHandler(async (req, res) => {
    const result = await customerVoucherService.getAdminVouchers(req.user, req.validated.query);

    return sendSuccess(res, {
        message: 'Get customer vouchers successfully',
        data: result.data,
        meta: result.meta,
    });
});

const createAdminGiftVoucher = asyncHandler(async (req, res) => {
    const result = await customerVoucherService.issueAdminGiftVoucher({
        adminId: req.user._id,
        payload: req.validated.body,
        auditContext: auditLogService.getAuditRequestContext(req),
    });

    return sendCreated(res, {
        message: 'Gift customer voucher successfully',
        data: result,
    });
});

const approveVoucher = asyncHandler(async (req, res) => {
    const result = await customerVoucherService.approveVoucher(req.user._id, req.validated.params.id);

    return sendSuccess(res, {
        message: 'Approve customer voucher successfully',
        data: result,
    });
});

const revokeVoucher = asyncHandler(async (req, res) => {
    const result = await customerVoucherService.revokeVoucher(req.user._id, req.validated.params.id);

    return sendSuccess(res, {
        message: 'Revoke customer voucher successfully',
        data: result,
    });
});

module.exports = {
    getMyVouchers,
    validateMyVoucher,
    getAdminVouchers,
    createAdminGiftVoucher,
    approveVoucher,
    revokeVoucher,
};
