const { AppError } = require('../utils/appError');

const formatZodErrors = (error) => {
    return error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
    }));
};

const validate = (schema) => {
    return (req, res, next) => {
        const result = schema.safeParse({
            body: req.body,
            params: req.params,
            query: req.query,
        });

        if (!result.success) {
            return next(
                new AppError(
                    'Validation failed',
                    400,
                    'VALIDATION_ERROR',
                    formatZodErrors(result.error)
                )
            );
        }

        req.validated = result.data;

        return next();
    };
};

module.exports = {
    validate,
};