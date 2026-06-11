const User = require('../../modules/users/user.model');
const { AppError } = require('../utils/appError');
const { verifyAccessToken } = require('../utils/jwt');
const { USER_ROLE_VALUES } = require('../constants/roles.constant');

const extractBearerToken = (req) => {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith('Bearer ')) {
        return null;
    }

    return authorization.split(' ')[1];
};

const resolveAuthenticatedUser = async (req, required) => {
    const token = extractBearerToken(req);

    if (!token) {
        if (!required) {
            return null;
        }

        throw new AppError(
            'Access token is required',
            401,
            'ACCESS_TOKEN_REQUIRED'
        );
    }

    const decoded = verifyAccessToken(token);

    if (!decoded.user_id) {
        throw new AppError(
            'Invalid access token',
            401,
            'INVALID_ACCESS_TOKEN'
        );
    }

    const user = await User.findById(decoded.user_id);

    if (!user) {
        throw new AppError(
            'User not found',
            401,
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

    return user;
};

const createAuthenticateMiddleware = (required) => async (req, res, next) => {
    try {
        const user = await resolveAuthenticatedUser(req, required);

        if (user) {
            req.user = user;
        }

        return next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return next(
                new AppError(
                    'Invalid access token',
                    401,
                    'INVALID_ACCESS_TOKEN'
                )
            );
        }

        if (error.name === 'TokenExpiredError') {
            return next(
                new AppError(
                    'Access token expired',
                    401,
                    'ACCESS_TOKEN_EXPIRED'
                )
            );
        }

        return next(error);
    }
};

const authenticate = createAuthenticateMiddleware(true);
const optionalAuthenticate = createAuthenticateMiddleware(false);

const authorize = (...roles) => {
    return (req, res, next) => {
        const invalidRoles = roles.filter((role) => !USER_ROLE_VALUES.includes(role));

        if (invalidRoles.length > 0) {
            return next(
                new AppError(
                    'Invalid authorization role configuration',
                    500,
                    'INVALID_AUTHORIZATION_ROLE_CONFIG'
                )
            );
        }

        if (!req.user) {
            return next(
                new AppError(
                    'Authentication required',
                    401,
                    'AUTHENTICATION_REQUIRED'
                )
            );
        }

        if (!roles.includes(req.user.role)) {
            return next(
                new AppError(
                    'You do not have permission to access this resource',
                    403,
                    'FORBIDDEN'
                )
            );
        }

        return next();
    };
};

module.exports = {
    authenticate,
    optionalAuthenticate,
    authorize,
};
