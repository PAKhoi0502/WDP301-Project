const userService = require('./user.service');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess } = require('../../shared/utils/apiResponse');

const getMe = asyncHandler(async (req, res) => {
    const result = await userService.getMe(req.user._id);

    return sendSuccess(res, {
        message: 'Get profile successfully',
        data: result,
    });
});

const updateMe = asyncHandler(async (req, res) => {
    const { body } = req.validated;

    const result = await userService.updateMe(req.user._id, body);

    return sendSuccess(res, {
        message: 'Update profile successfully',
        data: result,
    });
});

const getAllUsers = asyncHandler(async (req, res) => {
    const { query } = req.validated;

    const result = await userService.getAllUsers(query);

    return sendSuccess(res, {
        message: 'Get users successfully',
        data: result.data,
        meta: result.meta,
    });
});

const getUserById = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await userService.getUserById(id);

    return sendSuccess(res, {
        message: 'Get user successfully',
        data: result,
    });
});

const updateUser = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { body } = req.validated;

    const result = await userService.updateUser(id, body);

    return sendSuccess(res, {
        message: 'Update user successfully',
        data: result,
    });
});

const updateUserStatus = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { is_active } = req.validated.body;

    const result = await userService.updateUserStatus(id, is_active);

    return sendSuccess(res, {
        message: 'Update user status successfully',
        data: result,
    });
});

const updateUserRole = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { role } = req.validated.body;

    const result = await userService.updateUserRole(id, role);

    return sendSuccess(res, {
        message: 'Update user role successfully',
        data: result,
    });
});

const deactivateUser = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await userService.updateUserStatus(id, false);

    return sendSuccess(res, {
        message: 'Deactivate user successfully',
        data: result,
    });
});

module.exports = {
    getMe,
    updateMe,
    getAllUsers,
    getUserById,
    updateUser,
    updateUserStatus,
    updateUserRole,
    deactivateUser,
};