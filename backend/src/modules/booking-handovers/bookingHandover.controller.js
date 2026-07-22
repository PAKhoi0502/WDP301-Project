const bookingHandoverService = require('./bookingHandover.service');
const auditLogService = require('../audit-logs/auditLog.service');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess } = require('../../shared/utils/apiResponse');

const markReady = asyncHandler(async (req, res) => {
    const result = await bookingHandoverService.markReady(
        req.user,
        req.staffContext,
        req.validated.params.id,
        req.validated.body,
        auditLogService.getAuditRequestContext(req)
    );

    return sendSuccess(res, { message: 'Prepare booking handover successfully', data: result });
});

const getMyHandover = asyncHandler(async (req, res) => {
    const result = await bookingHandoverService.getMyHandover(req.user, req.validated.params.id);
    return sendSuccess(res, { message: 'Get booking handover successfully', data: result });
});

const getStaffHandover = asyncHandler(async (req, res) => {
    const result = await bookingHandoverService.getStaffHandover(
        req.staffContext,
        req.validated.params.id
    );
    return sendSuccess(res, { message: 'Get booking handover successfully', data: result });
});

const acceptMyHandover = asyncHandler(async (req, res) => {
    const result = await bookingHandoverService.acceptMyHandover(
        req.user,
        req.validated.params.id,
        req.validated.body,
        auditLogService.getAuditRequestContext(req)
    );
    return sendSuccess(res, { message: 'Accept booking handover successfully', data: result });
});

const release = asyncHandler(async (req, res) => {
    const result = await bookingHandoverService.release(
        req.user,
        req.staffContext,
        req.validated.params.id,
        req.validated.body,
        auditLogService.getAuditRequestContext(req)
    );
    return sendSuccess(res, { message: 'Release vehicle successfully', data: result });
});

module.exports = {
    markReady,
    getMyHandover,
    getStaffHandover,
    acceptMyHandover,
    release,
};
