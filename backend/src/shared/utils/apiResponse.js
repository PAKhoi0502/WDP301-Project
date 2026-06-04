const sendSuccess = (
    res,
    {
        statusCode = 200,
        message = 'Success',
        data = null,
        meta = null,
    } = {}
) => {
    const response = {
        success: true,
        message,
        data,
    };

    if (meta) {
        response.meta = meta;
    }

    return res.status(statusCode).json(response);
};

const sendCreated = (
    res,
    {
        message = 'Created successfully',
        data = null,
        meta = null,
    } = {}
) => {
    return sendSuccess(res, {
        statusCode: 201,
        message,
        data,
        meta,
    });
};

const sendNoContent = (res) => {
    return res.status(204).send();
};

module.exports = {
    sendSuccess,
    sendCreated,
    sendNoContent,
};