const handleCastError = (err) => {
    return {
        statusCode: 400,
        message: 'Invalid resource id',
        errorCode: 'INVALID_RESOURCE_ID',
    };
};

const handleDuplicateKeyError = (err) => {
    const field = Object.keys(err.keyValue || {})[0];

    return {
        statusCode: 409,
        message: field ? `${field} already exists` : 'Duplicate field value',
        errorCode: 'DUPLICATE_FIELD_VALUE',
    };
};

const handleValidationError = (err) => {
    const errors = Object.values(err.errors || {}).map((item) => ({
        field: item.path,
        message: item.message,
    }));

    return {
        statusCode: 400,
        message: 'Validation failed',
        errorCode: 'VALIDATION_ERROR',
        errors,
    };
};

const handleJwtError = () => {
    return {
        statusCode: 401,
        message: 'Invalid token',
        errorCode: 'INVALID_TOKEN',
    };
};

const handleJwtExpiredError = () => {
    return {
        statusCode: 401,
        message: 'Token expired',
        errorCode: 'TOKEN_EXPIRED',
    };
};

const normalizeError = (err) => {
    if (err.name === 'CastError') {
        return handleCastError(err);
    }

    if (err.code === 11000) {
        return handleDuplicateKeyError(err);
    }

    if (err.name === 'ValidationError') {
        return handleValidationError(err);
    }

    if (err.name === 'JsonWebTokenError') {
        return handleJwtError();
    }

    if (err.name === 'TokenExpiredError') {
        return handleJwtExpiredError();
    }

    return {
        statusCode: err.statusCode || 500,
        message: err.message || 'Internal server error',
        errorCode: err.errorCode || 'INTERNAL_SERVER_ERROR',
        errors: err.errors,
    };
};

const errorHandler = (err, req, res, next) => {
    const normalizedError = normalizeError(err);

    const response = {
        success: false,
        message: normalizedError.message,
        error_code: normalizedError.errorCode,
    };

    if (normalizedError.errors) {
        response.errors = normalizedError.errors;
    }

    if (process.env.NODE_ENV === 'development') {
        response.stack = err.stack;
    }

    return res.status(normalizedError.statusCode).json(response);
};

module.exports = {
    errorHandler,
};