const auditLogService = require('./auditLog.service');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess } = require('../../shared/utils/apiResponse');

const getAuditLogs = asyncHandler(async (req, res) => {
    const { query } = req.validated;

    const result = await auditLogService.getAuditLogs(query);

    return sendSuccess(res, {
        message: 'Get audit logs successfully',
        data: result.data,
        meta: result.meta,
    });
});

module.exports = {
    getAuditLogs,
};
