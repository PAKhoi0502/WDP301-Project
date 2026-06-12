const researchService = require('./research.service');
const { getAuditRequestContext } = require('../audit-logs/auditLog.service');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../../shared/utils/apiResponse');

const getResearchReports = asyncHandler(async (req, res) => {
    const result = await researchService.getResearchReports(req.validated.query);

    return sendSuccess(res, {
        message: 'Get research reports successfully',
        data: result.data,
        meta: result.meta,
    });
});

const getResearchReportById = asyncHandler(async (req, res) => {
    const result = await researchService.getResearchReportById(req.validated.params.id);

    return sendSuccess(res, {
        message: 'Get research report successfully',
        data: result,
    });
});

const createResearchReport = asyncHandler(async (req, res) => {
    const result = await researchService.createResearchReport(
        req.user,
        req.validated.body,
        getAuditRequestContext(req)
    );

    return sendCreated(res, {
        message: 'Create research report successfully',
        data: result,
    });
});

const updateResearchReport = asyncHandler(async (req, res) => {
    const result = await researchService.updateResearchReport(
        req.user,
        req.validated.params.id,
        req.validated.body,
        getAuditRequestContext(req)
    );

    return sendSuccess(res, {
        message: 'Update research report successfully',
        data: result,
    });
});

const deleteResearchReport = asyncHandler(async (req, res) => {
    const result = await researchService.deleteResearchReport(
        req.user,
        req.validated.params.id,
        getAuditRequestContext(req)
    );

    return sendSuccess(res, {
        message: 'Delete research report successfully',
        data: result,
    });
});

const runResearchReport = asyncHandler(async (req, res) => {
    const result = await researchService.runResearchReport(
        req.user,
        req.validated.params.id,
        getAuditRequestContext(req)
    );

    return sendSuccess(res, {
        message: 'Run research report successfully',
        data: result,
    });
});

const retryResearchReport = asyncHandler(async (req, res) => {
    const result = await researchService.retryResearchReport(
        req.user,
        req.validated.params.id,
        getAuditRequestContext(req)
    );

    return sendSuccess(res, {
        message: 'Retry research report successfully',
        data: result,
    });
});

module.exports = {
    getResearchReports,
    getResearchReportById,
    createResearchReport,
    updateResearchReport,
    deleteResearchReport,
    runResearchReport,
    retryResearchReport,
};
