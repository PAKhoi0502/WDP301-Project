const express = require('express');

const researchController = require('./research.controller');
const {
    idParamSchema,
    createResearchReportSchema,
    updateResearchReportSchema,
    getResearchReportsSchema,
} = require('./research.validator');
const { validate } = require('../../shared/middlewares/validate.middleware');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');
const { USER_ROLES } = require('../../shared/constants/roles.constant');

const adminRouter = express.Router();

adminRouter.use(authenticate, authorize(USER_ROLES.ADMIN));

adminRouter.get('/', validate(getResearchReportsSchema), researchController.getResearchReports);
adminRouter.post('/', validate(createResearchReportSchema), researchController.createResearchReport);
adminRouter.get('/:id', validate(idParamSchema), researchController.getResearchReportById);
adminRouter.patch('/:id', validate(updateResearchReportSchema), researchController.updateResearchReport);
adminRouter.delete('/:id', validate(idParamSchema), researchController.deleteResearchReport);
adminRouter.post('/:id/run', validate(idParamSchema), researchController.runResearchReport);
adminRouter.post('/:id/retry', validate(idParamSchema), researchController.retryResearchReport);

module.exports = {
    adminRouter,
};
