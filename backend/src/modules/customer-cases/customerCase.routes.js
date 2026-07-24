const express = require('express');

const customerCaseController = require('./customerCase.controller');
const {
    idParamSchema,
    listCustomerCasesSchema,
    addEvidenceSchema,
    postMessageSchema,
    assignCustomerCaseSchema,
    acknowledgeCustomerCaseSchema,
    concludeCustomerCaseSchema,
    closeCustomerCaseSchema,
    assignTechnicalAssessmentSchema,
    submitTechnicalAssessmentSchema,
    proposeResolutionSchema,
    respondResolutionSchema,
    recordWalkInResolutionResponseSchema,
    applyResolutionSchema,
    updateRefundSchema,
    reopenCustomerCaseSchema,
    slaDashboardSchema,
    createWalkInCustomerCaseSchema,
} = require('./customerCase.validator');
const { validate } = require('../../shared/middlewares/validate.middleware');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');
const { USER_ROLES } = require('../../shared/constants/roles.constant');
const { STAFF_CAPABILITIES } = require('../../shared/constants/staff.constant');
const {
    requireStaffCapabilities,
} = require('../../shared/middlewares/staffCapability.middleware');

const customerRouter = express.Router();
const staffRouter = express.Router();

customerRouter.use(authenticate, authorize(USER_ROLES.CUSTOMER));

customerRouter.get('/', validate(listCustomerCasesSchema), customerCaseController.getMyCases);
customerRouter.get('/:id', validate(idParamSchema), customerCaseController.getMyCaseById);
customerRouter.post('/:id/evidence', validate(addEvidenceSchema), customerCaseController.addMyEvidence);
customerRouter.post('/:id/messages', validate(postMessageSchema), customerCaseController.postMyMessage);
customerRouter.patch('/:id/resolution-response', validate(respondResolutionSchema), customerCaseController.respondResolution);
customerRouter.post('/:id/reopen', validate(reopenCustomerCaseSchema), customerCaseController.reopenCase);

staffRouter.use(authenticate, authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN));

staffRouter.get(
    '/sla-dashboard',
    requireStaffCapabilities(STAFF_CAPABILITIES.CUSTOMER_CASE_SLA_READ_GARAGE),
    validate(slaDashboardSchema),
    customerCaseController.getSlaDashboard
);
staffRouter.post(
    '/walk-in',
    requireStaffCapabilities(STAFF_CAPABILITIES.CUSTOMER_CASE_CREATE_WALK_IN),
    validate(createWalkInCustomerCaseSchema),
    customerCaseController.createWalkInCase
);

staffRouter.get(
    '/',
    requireStaffCapabilities(STAFF_CAPABILITIES.CUSTOMER_CASE_READ_GARAGE),
    validate(listCustomerCasesSchema),
    customerCaseController.getStaffCases
);
staffRouter.get(
    '/:id',
    requireStaffCapabilities(STAFF_CAPABILITIES.CUSTOMER_CASE_READ_GARAGE),
    validate(idParamSchema),
    customerCaseController.getStaffCaseById
);
staffRouter.patch(
    '/:id/assign',
    requireStaffCapabilities(STAFF_CAPABILITIES.CUSTOMER_CASE_ASSIGN_GARAGE),
    validate(assignCustomerCaseSchema),
    customerCaseController.assignCase
);
staffRouter.patch(
    '/:id/acknowledge',
    requireStaffCapabilities(STAFF_CAPABILITIES.CUSTOMER_CASE_ACKNOWLEDGE),
    validate(acknowledgeCustomerCaseSchema),
    customerCaseController.acknowledgeCase
);
staffRouter.post(
    '/:id/evidence',
    requireStaffCapabilities(STAFF_CAPABILITIES.CUSTOMER_CASE_COMMUNICATE_ASSIGNED),
    validate(addEvidenceSchema),
    customerCaseController.addStaffEvidence
);
staffRouter.post(
    '/:id/messages',
    requireStaffCapabilities(STAFF_CAPABILITIES.CUSTOMER_CASE_COMMUNICATE_ASSIGNED),
    validate(postMessageSchema),
    customerCaseController.postStaffMessage
);
staffRouter.patch(
    '/:id/conclude',
    authorize(USER_ROLES.ADMIN),
    validate(concludeCustomerCaseSchema),
    customerCaseController.concludeCase
);
staffRouter.patch(
    '/:id/close',
    authorize(USER_ROLES.ADMIN),
    validate(closeCustomerCaseSchema),
    customerCaseController.closeCase
);
staffRouter.patch(
    '/:id/technical-assessment/assign',
    requireStaffCapabilities(STAFF_CAPABILITIES.CUSTOMER_CASE_ASSIGN_GARAGE),
    validate(assignTechnicalAssessmentSchema),
    customerCaseController.assignTechnicalAssessment
);
staffRouter.get(
    '/:id/technical-assessment',
    requireStaffCapabilities(STAFF_CAPABILITIES.CUSTOMER_CASE_TECHNICAL_ASSESS_ASSIGNED),
    validate(idParamSchema),
    customerCaseController.getAssignedTechnicalAssessment
);
staffRouter.patch(
    '/:id/technical-assessment/start',
    requireStaffCapabilities(STAFF_CAPABILITIES.CUSTOMER_CASE_TECHNICAL_ASSESS_ASSIGNED),
    validate(idParamSchema),
    customerCaseController.startTechnicalAssessment
);
staffRouter.post(
    '/:id/technical-assessment/submit',
    requireStaffCapabilities(STAFF_CAPABILITIES.CUSTOMER_CASE_TECHNICAL_ASSESS_ASSIGNED),
    validate(submitTechnicalAssessmentSchema),
    customerCaseController.submitTechnicalAssessment
);
staffRouter.post(
    '/:id/resolutions',
    authorize(USER_ROLES.ADMIN),
    validate(proposeResolutionSchema),
    customerCaseController.proposeResolution
);
staffRouter.post(
    '/:id/resolutions/:resolutionId/apply',
    authorize(USER_ROLES.ADMIN),
    validate(applyResolutionSchema),
    customerCaseController.applyResolution
);
staffRouter.patch(
    '/:id/walk-in-resolution-response',
    requireStaffCapabilities(STAFF_CAPABILITIES.CUSTOMER_CASE_COMMUNICATE_ASSIGNED),
    validate(recordWalkInResolutionResponseSchema),
    customerCaseController.recordWalkInResolutionResponse
);
staffRouter.patch(
    '/:id/refunds/:refundId',
    authorize(USER_ROLES.ADMIN),
    validate(updateRefundSchema),
    customerCaseController.updateRefundStatus
);
staffRouter.post(
    '/:id/reopen',
    authorize(USER_ROLES.ADMIN),
    validate(reopenCustomerCaseSchema),
    customerCaseController.reopenCase
);

module.exports = {
    customerRouter,
    staffRouter,
    adminRouter: staffRouter,
};
