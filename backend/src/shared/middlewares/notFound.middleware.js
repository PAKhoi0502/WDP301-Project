const { AppError } = require('../utils/appError');

const notFoundHandler = (req, res, next) => {
    return next(
        new AppError(
            `Route not found: ${req.method} ${req.originalUrl}`,
            404,
            'NOT_FOUND'
        )
    );
};

module.exports = {
    notFoundHandler,
};