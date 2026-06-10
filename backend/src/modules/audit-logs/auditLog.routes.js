const express = require('express');

const auditLogController = require('./auditLog.controller');
const { getAuditLogsSchema } = require('./auditLog.validator');
const { validate } = require('../../shared/middlewares/validate.middleware');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');
const { USER_ROLES } = require('../../shared/constants/roles.constant');

const adminRouter = express.Router();

adminRouter.use(authenticate, authorize(USER_ROLES.ADMIN));

adminRouter.get(
    '/',
    validate(getAuditLogsSchema),
    auditLogController.getAuditLogs
);

module.exports = {
    adminRouter,
};
