const customerCaseService = require('./customerCase.service');
const customerCaseStage2Service = require('./customerCaseStage2.service');
const auditLogService = require('../audit-logs/auditLog.service');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../../shared/utils/apiResponse');

const createFromHandover = asyncHandler(async (req, res) => {
    const result = await customerCaseService.createFromHandover(
        req.user,
        req.validated.params.id,
        req.validated.body,
        auditLogService.getAuditRequestContext(req)
    );
    return sendCreated(res, { message: 'Submit customer case successfully', data: result });
});

const getMyCases = asyncHandler(async (req, res) => {
    const result = await customerCaseService.getMyCases(req.user, req.validated.query);
    return sendSuccess(res, { message: 'Get customer cases successfully', data: result.data, meta: result.meta });
});

const getMyCaseById = asyncHandler(async (req, res) => {
    const result = await customerCaseService.getMyCaseById(req.user, req.validated.params.id);
    return sendSuccess(res, { message: 'Get customer case successfully', data: result });
});

const getStaffCases = asyncHandler(async (req, res) => {
    const result = await customerCaseService.getStaffCases(req.staffContext, req.validated.query);
    return sendSuccess(res, { message: 'Get customer cases successfully', data: result.data, meta: result.meta });
});

const getStaffCaseById = asyncHandler(async (req, res) => {
    const result = await customerCaseService.getStaffCaseById(req.staffContext, req.validated.params.id);
    return sendSuccess(res, { message: 'Get customer case successfully', data: result });
});

const addMyEvidence = asyncHandler(async (req, res) => {
    const result = await customerCaseService.addEvidence(
        req.user,
        null,
        req.validated.params.id,
        req.validated.body,
        auditLogService.getAuditRequestContext(req)
    );
    return sendSuccess(res, { message: 'Add customer case evidence successfully', data: result });
});

const addStaffEvidence = asyncHandler(async (req, res) => {
    const result = await customerCaseService.addEvidence(
        req.user,
        req.staffContext,
        req.validated.params.id,
        req.validated.body,
        auditLogService.getAuditRequestContext(req)
    );
    return sendSuccess(res, { message: 'Add customer case evidence successfully', data: result });
});

const postMyMessage = asyncHandler(async (req, res) => {
    const result = await customerCaseService.postMessage(
        req.user,
        null,
        req.validated.params.id,
        req.validated.body,
        auditLogService.getAuditRequestContext(req)
    );
    return sendCreated(res, { message: 'Send customer case message successfully', data: result });
});

const postStaffMessage = asyncHandler(async (req, res) => {
    const result = await customerCaseService.postMessage(
        req.user,
        req.staffContext,
        req.validated.params.id,
        req.validated.body,
        auditLogService.getAuditRequestContext(req)
    );
    return sendCreated(res, { message: 'Send customer case message successfully', data: result });
});

const assignCase = asyncHandler(async (req, res) => {
    const result = await customerCaseService.assignCase(
        req.user,
        req.staffContext,
        req.validated.params.id,
        req.validated.body,
        auditLogService.getAuditRequestContext(req)
    );
    return sendSuccess(res, { message: 'Assign customer case successfully', data: result });
});

const acknowledgeCase = asyncHandler(async (req, res) => {
    const result = await customerCaseService.acknowledgeCase(
        req.user,
        req.staffContext,
        req.validated.params.id,
        req.validated.body,
        auditLogService.getAuditRequestContext(req)
    );
    return sendSuccess(res, { message: 'Acknowledge customer case successfully', data: result });
});

const concludeCase = asyncHandler(async (req, res) => {
    const result = await customerCaseService.concludeCase(
        req.user,
        req.validated.params.id,
        req.validated.body,
        auditLogService.getAuditRequestContext(req)
    );
    return sendSuccess(res, { message: 'Conclude customer case successfully', data: result });
});

const closeCase = asyncHandler(async (req, res) => {
    const result = await customerCaseService.closeCase(
        req.user,
        req.validated.params.id,
        req.validated.body,
        auditLogService.getAuditRequestContext(req)
    );
    return sendSuccess(res, { message: 'Close customer case successfully', data: result });
});

const assignTechnicalAssessment = asyncHandler(async (req, res) => {
    const result = await customerCaseStage2Service.assignTechnicalAssessment(
        req.user, req.staffContext, req.validated.params.id, req.validated.body,
        auditLogService.getAuditRequestContext(req)
    );
    return sendSuccess(res, { message: 'Assign technical assessment successfully', data: result });
});

const getAssignedTechnicalAssessment = asyncHandler(async (req, res) => {
    const result = await customerCaseStage2Service.getAssignedTechnicalAssessment(
        req.user, req.staffContext, req.validated.params.id
    );
    return sendSuccess(res, { message: 'Get assigned technical assessment successfully', data: result });
});

const startTechnicalAssessment = asyncHandler(async (req, res) => {
    const result = await customerCaseStage2Service.startTechnicalAssessment(
        req.user, req.staffContext, req.validated.params.id,
        auditLogService.getAuditRequestContext(req)
    );
    return sendSuccess(res, { message: 'Start technical assessment successfully', data: result });
});

const submitTechnicalAssessment = asyncHandler(async (req, res) => {
    const result = await customerCaseStage2Service.submitTechnicalAssessment(
        req.user, req.staffContext, req.validated.params.id, req.validated.body,
        auditLogService.getAuditRequestContext(req)
    );
    return sendSuccess(res, { message: 'Submit technical assessment successfully', data: result });
});

const proposeResolution = asyncHandler(async (req, res) => {
    const result = await customerCaseStage2Service.proposeResolution(
        req.user, req.validated.params.id, req.validated.body,
        auditLogService.getAuditRequestContext(req)
    );
    return sendCreated(res, { message: 'Propose customer case resolution successfully', data: result });
});

const respondResolution = asyncHandler(async (req, res) => {
    const result = await customerCaseStage2Service.respondResolution(
        req.user, req.validated.params.id, req.validated.body,
        auditLogService.getAuditRequestContext(req)
    );
    return sendSuccess(res, { message: 'Respond to customer case resolution successfully', data: result });
});

const applyResolution = asyncHandler(async (req, res) => {
    const result = await customerCaseStage2Service.applyResolution(
        req.user, req.validated.params.id, req.validated.params.resolutionId,
        auditLogService.getAuditRequestContext(req)
    );
    return sendSuccess(res, { message: 'Apply customer case resolution successfully', data: result });
});

const recordWalkInResolutionResponse = asyncHandler(async (req, res) => {
    const result = await customerCaseStage2Service.recordWalkInResolutionResponse(
        req.user, req.staffContext, req.validated.params.id, req.validated.body,
        auditLogService.getAuditRequestContext(req)
    );
    return sendSuccess(res, { message: 'Record verified walk-in resolution response successfully', data: result });
});

const updateRefundStatus = asyncHandler(async (req, res) => {
    const result = await customerCaseStage2Service.updateRefundStatus(
        req.user, req.validated.params.id, req.validated.params.refundId, req.validated.body,
        auditLogService.getAuditRequestContext(req)
    );
    return sendSuccess(res, { message: 'Update customer case refund successfully', data: result });
});

const getSlaDashboard = asyncHandler(async (req, res) => {
    const result = await customerCaseStage2Service.getSlaDashboard(req.staffContext, req.validated.query);
    return sendSuccess(res, { message: 'Get customer case SLA dashboard successfully', data: result });
});

const reopenCase = asyncHandler(async (req, res) => {
    const result = await customerCaseStage2Service.reopenCase(
        req.user, req.staffContext, req.validated.params.id, req.validated.body,
        auditLogService.getAuditRequestContext(req)
    );
    return sendSuccess(res, { message: 'Reopen customer case successfully', data: result });
});

const requestWalkInOtp = asyncHandler(async (req, res) => {
    const result = await customerCaseStage2Service.requestWalkInOtp(
        req.user, req.staffContext, req.validated.body, auditLogService.getAuditRequestContext(req)
    );
    return sendSuccess(res, { message: 'Request walk-in case OTP successfully', data: result });
});

const verifyWalkInOtp = asyncHandler(async (req, res) => {
    const result = await customerCaseStage2Service.verifyWalkInOtp(req.user, req.validated.body);
    return sendSuccess(res, { message: 'Verify walk-in case OTP successfully', data: result });
});

const createWalkInCase = asyncHandler(async (req, res) => {
    const result = await customerCaseStage2Service.createWalkInCase(
        req.user, req.staffContext, req.validated.body, auditLogService.getAuditRequestContext(req)
    );
    return sendCreated(res, { message: 'Submit walk-in customer case successfully', data: result });
});

module.exports = {
    createFromHandover,
    getMyCases,
    getMyCaseById,
    getStaffCases,
    getStaffCaseById,
    addMyEvidence,
    addStaffEvidence,
    postMyMessage,
    postStaffMessage,
    assignCase,
    acknowledgeCase,
    concludeCase,
    closeCase,
    assignTechnicalAssessment,
    getAssignedTechnicalAssessment,
    startTechnicalAssessment,
    submitTechnicalAssessment,
    proposeResolution,
    respondResolution,
    recordWalkInResolutionResponse,
    applyResolution,
    updateRefundStatus,
    getSlaDashboard,
    reopenCase,
    requestWalkInOtp,
    verifyWalkInOtp,
    createWalkInCase,
};
