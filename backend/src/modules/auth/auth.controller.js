const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../../shared/utils/apiResponse');
const { AppError } = require('../../shared/utils/appError');

const authService = require('./auth.service');

const REFRESH_COOKIE_NAME = 'refreshToken';

const getRefreshCookieOptions = () => {
    const days = Number(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS) || 7;

    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        maxAge: days * 24 * 60 * 60 * 1000,
    };
};

const getClientIp = (req) => {
    return (
        (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
        || req.socket?.remoteAddress
        || ''
    );
};

const getRequestMeta = (req) => {
    return {
        user_agent: req.headers['user-agent'] || '',
        ip_address: getClientIp(req),
    };
};

const setRefreshCookie = (res, refreshToken) => {
    res.cookie(
        REFRESH_COOKIE_NAME,
        refreshToken,
        getRefreshCookieOptions()
    );
};

const clearRefreshCookie = (res) => {
    res.clearCookie(
        REFRESH_COOKIE_NAME,
        getRefreshCookieOptions()
    );
};

const register = asyncHandler(async (req, res) => {
    const result = await authService.register(req.validated.body);

    return sendCreated(res, {
        message: 'Register successfully',
        data: result,
    });
});

const requestPhoneVerification = asyncHandler(async (req, res) => {
    const result = await authService.requestPhoneVerification({
        ...req.validated.body,
        user_id: req.user?._id || null,
        ...getRequestMeta(req),
    });

    return sendSuccess(res, {
        message: 'Phone verification OTP sent successfully',
        data: result,
    });
});

const verifyPhoneOtp = asyncHandler(async (req, res) => {
    const result = await authService.verifyPhoneOtp({
        ...req.validated.body,
        user_id: req.user?._id || null,
    });

    return sendSuccess(res, {
        message: 'Phone verified successfully',
        data: result,
    });
});

const login = asyncHandler(async (req, res) => {
    const result = await authService.login(
        req.validated.body,
        getRequestMeta(req)
    );

    setRefreshCookie(res, result.tokens.refresh_token);

    return sendSuccess(res, {
        message: 'Login successfully',
        data: {
            access_token: result.tokens.access_token,
            user: result.user,
        },
    });
});

const refresh = asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

    if (!refreshToken) {
        throw new AppError(
            'Refresh token is required',
            401,
            'REFRESH_TOKEN_REQUIRED'
        );
    }

    const result = await authService.refresh(
        refreshToken,
        getRequestMeta(req)
    );

    setRefreshCookie(res, result.tokens.refresh_token);

    return sendSuccess(res, {
        message: 'Refresh token successfully',
        data: {
            access_token: result.tokens.access_token,
            user: result.user,
        },
    });
});

const logout = asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

    await authService.logout(refreshToken);

    clearRefreshCookie(res);

    return sendSuccess(res, {
        message: 'Logout successfully',
        data: null,
    });
});

const logoutAllDevices = asyncHandler(async (req, res) => {
    const result = await authService.logoutAllDevices(req.user._id);

    clearRefreshCookie(res);

    return sendSuccess(res, {
        message: result.message,
        data: null,
    });
});

const getMe = asyncHandler(async (req, res) => {
    const result = await authService.getCurrentUser(req.user._id);

    return sendSuccess(res, {
        message: 'Get current user successfully',
        data: result,
    });
});

const changePassword = asyncHandler(async (req, res) => {
    const result = await authService.changePassword(
        req.user._id,
        req.validated.body
    );

    clearRefreshCookie(res);

    return sendSuccess(res, {
        message: result.message,
        data: null,
    });
});

const forgotPassword = asyncHandler(async (req, res) => {
    const result = await authService.forgotPassword(req.validated.body);

    return sendSuccess(res, {
        message: result.message,
        data: process.env.NODE_ENV !== 'production'
            ? { reset_token: result.reset_token || null }
            : null,
    });
});

const resetPassword = asyncHandler(async (req, res) => {
    const result = await authService.resetPassword(req.validated.body);

    return sendSuccess(res, {
        message: result.message,
        data: null,
    });
});

module.exports = {
    register,
    requestPhoneVerification,
    verifyPhoneOtp,
    login,
    refresh,
    logout,
    logoutAllDevices,
    getMe,
    changePassword,
    forgotPassword,
    resetPassword,
};
