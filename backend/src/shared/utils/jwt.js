const jwt = require('jsonwebtoken');
const { AppError } = require('./appError');

const getRequiredEnv = (name) => {
    const value = process.env[name];

    if (!value) {
        throw new AppError(
            `${name} is not configured`,
            500,
            `${name}_MISSING`
        );
    }

    return value;
};

const signAccessToken = (payload) => {
    return jwt.sign(
        payload,
        getRequiredEnv('JWT_ACCESS_SECRET'),
        {
            expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '1h',
        }
    );
};

const signRefreshToken = (payload) => {
    return jwt.sign(
        payload,
        getRequiredEnv('JWT_REFRESH_SECRET'),
        {
            expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        }
    );
};

const verifyAccessToken = (token) => {
    return jwt.verify(token, getRequiredEnv('JWT_ACCESS_SECRET'));
};

const verifyRefreshToken = (token) => {
    return jwt.verify(token, getRequiredEnv('JWT_REFRESH_SECRET'));
};

module.exports = {
    signAccessToken,
    signRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
};
