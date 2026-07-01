const staffProfileService = require('./staffProfile.service');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../../shared/utils/apiResponse');

const getMyStaffProfile = asyncHandler(async (req, res) => {
    const result = await staffProfileService.getMyStaffProfile(req.user._id);

    return sendSuccess(res, {
        message: 'Get my staff profile successfully',
        data: result,
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
    const { is_active } = req.validated.body;

    const result = await staffProfileService.updateStaffProfileStatus(id, is_active);

    return sendSuccess(res, {
        message: 'Update staff profile status successfully',
        data: result,
    });
});

const deactivateStaffProfile = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await staffProfileService.updateStaffProfileStatus(id, false);

    return sendSuccess(res, {
        message: 'Deactivate staff profile successfully',
        data: result,
    });
});

module.exports = {
    getMyStaffProfile,
    getAllStaffProfiles,
    getStaffProfileById,
    createStaffProfile,
    inviteStaff,
    resendStaffInvitation,
    updateStaffProfile,
    updateStaffProfileStatus,
    deactivateStaffProfile,
};
