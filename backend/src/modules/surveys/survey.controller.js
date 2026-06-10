const surveyService = require('./survey.service');
const { getAuditRequestContext } = require('../audit-logs/auditLog.service');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../../shared/utils/apiResponse');

const getAllSurveys = asyncHandler(async (req, res) => {
    const { query } = req.validated;
    const result = await surveyService.getAllSurveys(query);

    return sendSuccess(res, {
        message: 'Get surveys successfully',
        data: result.data,
        meta: result.meta,
    });
});

const getSurveyById = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const result = await surveyService.getSurveyById(id);

    return sendSuccess(res, {
        message: 'Get survey successfully',
        data: result,
    });
});

const createSurvey = asyncHandler(async (req, res) => {
    const { body } = req.validated;
    const result = await surveyService.createSurvey(
        req.user,
        body,
        getAuditRequestContext(req)
    );

    return sendCreated(res, {
        message: 'Create survey successfully',
        data: result,
    });
});

const updateSurvey = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { body } = req.validated;
    const result = await surveyService.updateSurvey(
        req.user,
        id,
        body,
        getAuditRequestContext(req)
    );

    return sendSuccess(res, {
        message: 'Update survey successfully',
        data: result,
    });
});

const deleteSurvey = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const result = await surveyService.deleteSurvey(
        req.user,
        id,
        getAuditRequestContext(req)
    );

    return sendSuccess(res, {
        message: 'Delete survey successfully',
        data: result,
    });
});

const publishSurvey = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const result = await surveyService.publishSurvey(
        req.user,
        id,
        getAuditRequestContext(req)
    );

    return sendSuccess(res, {
        message: 'Publish survey successfully',
        data: result,
    });
});

const closeSurvey = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const result = await surveyService.closeSurvey(
        req.user,
        id,
        getAuditRequestContext(req)
    );

    return sendSuccess(res, {
        message: 'Close survey successfully',
        data: result,
    });
});

const getAvailableSurveys = asyncHandler(async (req, res) => {
    const { booking_id } = req.validated.query;
    const result = await surveyService.getAvailableSurveys(req.user._id, booking_id);

    return sendSuccess(res, {
        message: 'Get available surveys successfully',
        data: result,
    });
});

const submitSurveyResponse = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { body } = req.validated;
    const result = await surveyService.submitSurveyResponse(
        req.user,
        id,
        body,
        getAuditRequestContext(req)
    );

    return sendCreated(res, {
        message: 'Submit survey response successfully',
        data: result,
    });
});

const getSurveyResponses = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { query } = req.validated;
    const result = await surveyService.getSurveyResponses(id, query);

    return sendSuccess(res, {
        message: 'Get survey responses successfully',
        data: result.data,
        meta: result.meta,
    });
});

module.exports = {
    getAllSurveys,
    getSurveyById,
    createSurvey,
    updateSurvey,
    deleteSurvey,
    publishSurvey,
    closeSurvey,
    getAvailableSurveys,
    submitSurveyResponse,
    getSurveyResponses,
};
