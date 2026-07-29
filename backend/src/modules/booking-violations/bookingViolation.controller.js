const bookingViolationService = require('./bookingViolation.service');
const auditLogService = require('../audit-logs/auditLog.service');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../../shared/utils/apiResponse');

const getMyStatus = asyncHandler(async (req, res) => {
    const result = await bookingViolationService.getMyStatus(req.user._id);

    return sendSuccess(res, {
        message: 'Get booking violation status successfully',
        data: result,
    });
});

const getMyHistory = asyncHandler(async (req, res) => {
    const result = await bookingViolationService.getHistory(
        req.user._id,
        req.validated.query
    );

    return sendSuccess(res, {
        message: 'Get booking violation history successfully',
        data: result.data,
        meta: result.meta,
    });
});

const getMyAppeals = asyncHandler(async (req, res) => {
    const result = await bookingViolationService.getAppeals({
        customerId: req.user._id,
        ...req.validated.query,
    });

    return sendSuccess(res, {
        message: 'Get booking violation appeals successfully',
        data: result.data,
        meta: result.meta,
    });
});

const createMyAppeal = asyncHandler(async (req, res) => {
    const result = await bookingViolationService.createAppeal({
        customerId: req.user._id,
        eventId: req.validated.body.event_id,
        reason: req.validated.body.reason,
    });

    return sendCreated(res, {
        message: 'Create booking violation appeal successfully',
        data: result,
    });
});

const listAdminCustomers = asyncHandler(async (req, res) => {
    const result = await bookingViolationService.listAdminCustomers(req.validated.query);

    return sendSuccess(res, {
        message: 'Get booking violation customers successfully',
        data: result.data,
        meta: result.meta,
    });
});

const getAdminCustomerDetail = asyncHandler(async (req, res) => {
    const result = await bookingViolationService.getAdminCustomerDetail(
        req.validated.params.customerId,
        req.validated.query
    );

    return sendSuccess(res, {
        message: 'Get customer booking violation detail successfully',
        data: result,
    });
});

const adjustCustomerScore = asyncHandler(async (req, res) => {
    const result = await bookingViolationService.adjustCustomerScore({
        customerId: req.validated.params.customerId,
        scoreChange: req.validated.body.score_change,
        reason: req.validated.body.reason,
        adminId: req.user._id,
        auditContext: auditLogService.getAuditRequestContext(req),
    });

    return sendCreated(res, {
        message: 'Adjust booking violation score successfully',
        data: result,
    });
});

const getAdminAppeals = asyncHandler(async (req, res) => {
    const result = await bookingViolationService.getAppeals(req.validated.query);

    return sendSuccess(res, {
        message: 'Get booking violation appeals successfully',
        data: result.data,
        meta: result.meta,
    });
});

const reviewAppeal = asyncHandler(async (req, res) => {
    const result = await bookingViolationService.reviewAppeal({
        appealId: req.validated.params.appealId,
        status: req.validated.body.status,
        adminNote: req.validated.body.admin_note,
        adminId: req.user._id,
        auditContext: auditLogService.getAuditRequestContext(req),
    });

    return sendSuccess(res, {
        message: 'Review booking violation appeal successfully',
        data: result,
    });
});

module.exports = {
    getMyStatus,
    getMyHistory,
    getMyAppeals,
    createMyAppeal,
    listAdminCustomers,
    getAdminCustomerDetail,
    adjustCustomerScore,
    getAdminAppeals,
    reviewAppeal,
};
