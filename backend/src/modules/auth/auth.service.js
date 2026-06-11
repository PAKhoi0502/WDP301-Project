const coreService = require('./services/auth.core.service');
const sessionService = require('./services/auth.session.service');
const User = require('../users/user.model');
const AuthMapper = require('./auth.mapper');
const { AppError } = require('../../shared/utils/appError');

const register = (...args) => coreService.register(...args);

const requestPhoneVerification = (...args) => coreService.requestPhoneVerification(...args);

const verifyPhoneOtp = (...args) => coreService.verifyPhoneOtp(...args);

const login = (...args) => coreService.login(...args);

const refresh = (...args) => sessionService.refresh(...args);

const logout = (...args) => sessionService.logout(...args);

const logoutAllDevices = (...args) => sessionService.logoutAllDevices(...args);

const changePassword = (...args) => coreService.changePassword(...args);

const forgotPassword = (...args) => coreService.forgotPassword(...args);

const resetPassword = (...args) => coreService.resetPassword(...args);

const getCurrentUser = async (userId) => {
    const user = await User.findById(userId);

    if (!user) {
        throw new AppError(
            'User not found',
            404,
            'USER_NOT_FOUND'
        );
    }

    if (!user.is_active) {
        throw new AppError(
            'User account is inactive',
            403,
            'USER_INACTIVE'
        );
    }

    return AuthMapper.toUserDto(user);
};

module.exports = {
    register,
    requestPhoneVerification,
    verifyPhoneOtp,
    login,
    refresh,
    logout,
    logoutAllDevices,
    changePassword,
    forgotPassword,
    resetPassword,
    getCurrentUser,
};
