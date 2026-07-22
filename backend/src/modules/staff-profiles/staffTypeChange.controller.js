const staffTypeChangeService = require('./staffTypeChange.service');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../../shared/utils/apiResponse');
const { getAuditRequestContext } = require('../audit-logs/auditLog.service');

const createMyRequest = asyncHandler(async (req, res) => {
    const result = await staffTypeChangeService.createMyStaffTypeChangeRequest(
        req.user._id,
        req.validated.body,
        getAuditRequestContext(req)
    );

    return sendCreated(res, {
        message: 'Create staff type change request successfully',
        data: result,
    });
});

const getMyRequests = asyncHandler(async (req, res) => {
    const result = await staffTypeChangeService.getMyStaffTypeChangeRequests(
        req.user._id,
        req.validated.query
    );

    return sendSuccess(res, {
        message: 'Get my staff type change requests successfully',
        data: result.data,
        meta: result.meta,
    });
});

const createAdminRequest = asyncHandler(async (req, res) => {
    const result = await staffTypeChangeService.createAdminStaffTypeChangeRequest(
        req.validated.params.id,
        req.user._id,
        req.validated.body,
        getAuditRequestContext(req)
    );

    return sendCreated(res, {
        message: 'Create admin-directed staff type change request successfully',
        data: result,
    });
});

const getAdminRequests = asyncHandler(async (req, res) => {
    const result = await staffTypeChangeService.getAdminStaffTypeChangeRequests(
        req.validated.query
    );

    return sendSuccess(res, {
        message: 'Get staff type change requests successfully',
        data: result.data,
        meta: result.meta,
    });
});

const getImpact = asyncHandler(async (req, res) => {
    const result = await staffTypeChangeService.getStaffTypeChangeImpact(
        req.validated.params.id,
        req.validated.query
    );

    return sendSuccess(res, {
        message: 'Get staff type change impact successfully',
        data: result,
    });
});

const approveRequest = asyncHandler(async (req, res) => {
    const result = await staffTypeChangeService.approveStaffTypeChangeRequest(
        req.validated.params.requestId,
        req.user._id,
        req.validated.body,
        getAuditRequestContext(req)
    );

    return sendSuccess(res, {
        message: 'Approve staff type change request successfully',
        data: result,
    });
});

const rejectRequest = asyncHandler(async (req, res) => {
    const result = await staffTypeChangeService.rejectStaffTypeChangeRequest(
        req.validated.params.requestId,
        req.user._id,
        req.validated.body.reason,
        getAuditRequestContext(req)
    );

    return sendSuccess(res, {
        message: 'Reject staff type change request successfully',
        data: result,
    });
});

const cancelRequest = asyncHandler(async (req, res) => {
    const result = await staffTypeChangeService.cancelStaffTypeChangeRequest(
        req.validated.params.requestId,
        req.user,
        req.validated.body.reason,
        getAuditRequestContext(req)
    );

    return sendSuccess(res, {
        message: 'Cancel staff type change request successfully',
        data: result,
    });
});

const getHistory = asyncHandler(async (req, res) => {
    const result = await staffTypeChangeService.getStaffTypeChangeHistory(
        req.validated.params.id,
        req.validated.query
    );

    return sendSuccess(res, {
        message: 'Get staff type change history successfully',
        data: result.data,
        meta: result.meta,
    });
});

module.exports = {
    createMyRequest,
    createAdminRequest,
    getMyRequests,
    getAdminRequests,
    getImpact,
    approveRequest,
    rejectRequest,
    cancelRequest,
    getHistory,
};
