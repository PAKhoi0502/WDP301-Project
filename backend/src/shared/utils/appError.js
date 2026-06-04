class AppError extends Error {
    constructor(
        message,
        statusCode = 500,
        errorCode = 'INTERNAL_SERVER_ERROR',
        errors = null
    ) {
        super(message);

        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.errors = errors;
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = {
    AppError,
};