const staffProfileService = require('./staffProfile.service');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../../shared/utils/apiResponse');
const { getAuditRequestContext } = require('../audit-logs/auditLog.service');

const getMyStaffProfile = asyncHandler(async (req, res) => {
    const result = await staffProfileService.getMyStaffProfile(req.user._id);

    return sendSuccess(res, {
        message: 'Get my staff profile successfully',
        data: result,
    });
});

const getMyCapabilities = asyncHandler(async (req, res) => {
    return sendSuccess(res, {
        message: 'Get my staff capabilities successfully',
        data: req.staffContext,
    });
});

const getAllStaffProfiles = asyncHandler(async (req, res) => {
    const { query } = req.validated;

    const result = await staffProfileService.getAllStaffProfiles(query);

    return sendSuccess(res, {
        message: 'Get staff profiles successfully',
        data: result.data,
        meta: result.meta,
    });
});

const getStaffProfileById = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await staffProfileService.getStaffProfileById(id);

    return sendSuccess(res, {
        message: 'Get staff profile successfully',
        data: result,
    });
});

const createStaffProfile = asyncHandler(async (req, res) => {
    const { body } = req.validated;

    const result = await staffProfileService.createStaffProfile(body);

    return sendCreated(res, {
        message: 'Create staff profile successfully',
        data: result,
    });
});

const inviteStaff = asyncHandler(async (req, res) => {
    const { body } = req.validated;

    const result = await staffProfileService.inviteStaff(body);

    return sendCreated(res, {
        message: 'Invite staff successfully',
        data: result,
    });
});

const resendStaffInvitation = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await staffProfileService.resendStaffInvitation(id);

    return sendSuccess(res, {
        message: 'Resend staff invitation successfully',
        data: result,
    });
});

const updateStaffProfile = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { body } = req.validated;

    const result = await staffProfileService.updateStaffProfile(id, body);

    return sendSuccess(res, {
        message: 'Update staff profile successfully',
        data: result,
    });
});

const updateStaffProfileStatus = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { is_active, reason } = req.validated.body;

    const result = await staffProfileService.updateStaffProfileStatus(id, is_active, {
        reason,
        actorId: req.user._id,
        auditContext: getAuditRequestContext(req),
    });

    return sendSuccess(res, {
        message: 'Update staff profile status successfully',
        data: result,
    });
});

const updateStaffEmploymentStatus = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { status, reason } = req.validated.body;

    const result = await staffProfileService.updateStaffEmploymentStatus(id, status, {
        reason,
        actorId: req.user._id,
        auditContext: getAuditRequestContext(req),
    });

    return sendSuccess(res, {
        message: 'Update staff employment status successfully',
        data: result,
    });
});

const deactivateStaffProfile = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await staffProfileService.terminateStaffProfile(id, {
        reason: 'Staff profile deleted by admin',
        actorId: req.user._id,
        auditContext: getAuditRequestContext(req),
    });

    return sendSuccess(res, {
        message: 'Terminate staff profile successfully',
        data: result,
    });
});

module.exports = {
    getMyStaffProfile,
    getMyCapabilities,
    getAllStaffProfiles,
    getStaffProfileById,
    createStaffProfile,
    inviteStaff,
    resendStaffInvitation,
    updateStaffProfile,
    updateStaffProfileStatus,
    updateStaffEmploymentStatus,
    deactivateStaffProfile,
};
