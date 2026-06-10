const express = require('express');

const surveyController = require('./survey.controller');
const {
    idParamSchema,
    getAdminSurveysSchema,
    createSurveySchema,
    updateSurveySchema,
    emptyOperationSchema,
    availableSurveysSchema,
    submitSurveyResponseSchema,
    getSurveyResponsesSchema,
} = require('./survey.validator');
const { validate } = require('../../shared/middlewares/validate.middleware');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');
const { USER_ROLES } = require('../../shared/constants/roles.constant');

const customerRouter = express.Router();
const adminRouter = express.Router();

customerRouter.use(authenticate, authorize(USER_ROLES.CUSTOMER));

customerRouter.get(
    '/available',
    validate(availableSurveysSchema),
    surveyController.getAvailableSurveys
);

customerRouter.post(
    '/:id/responses',
    validate(submitSurveyResponseSchema),
    surveyController.submitSurveyResponse
);

adminRouter.use(authenticate, authorize(USER_ROLES.ADMIN));

adminRouter.get(
    '/',
    validate(getAdminSurveysSchema),
    surveyController.getAllSurveys
);

adminRouter.post(
    '/',
    validate(createSurveySchema),
    surveyController.createSurvey
);

adminRouter.get(
    '/:id/responses',
    validate(getSurveyResponsesSchema),
    surveyController.getSurveyResponses
);

adminRouter.patch(
    '/:id/publish',
    validate(emptyOperationSchema),
    surveyController.publishSurvey
);

adminRouter.patch(
    '/:id/close',
    validate(emptyOperationSchema),
    surveyController.closeSurvey
);

adminRouter.get(
    '/:id',
    validate(idParamSchema),
    surveyController.getSurveyById
);

adminRouter.patch(
    '/:id',
    validate(updateSurveySchema),
    surveyController.updateSurvey
);

adminRouter.delete(
    '/:id',
    validate(idParamSchema),
    surveyController.deleteSurvey
);

module.exports = {
    customerRouter,
    adminRouter,
};
