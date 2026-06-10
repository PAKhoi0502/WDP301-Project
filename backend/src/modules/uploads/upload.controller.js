const uploadService = require('./upload.service');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../../shared/utils/apiResponse');

const createUpload = asyncHandler(async (req, res) => {
    const { body } = req.validated;

    const result = await uploadService.createUpload(req.user, req.file, body);

    return sendCreated(res, {
        message: 'Upload file successfully',
        data: result,
    });
});

const getAllUploads = asyncHandler(async (req, res) => {
    const { query } = req.validated;

    const result = await uploadService.getAllUploads(query);

    return sendSuccess(res, {
        message: 'Get uploads successfully',
        data: result.data,
        meta: result.meta,
    });
});

const deleteUpload = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await uploadService.deleteUpload(req.user, id);

    return sendSuccess(res, {
        message: 'Delete upload successfully',
        data: result,
    });
});

module.exports = {
    createUpload,
    getAllUploads,
    deleteUpload,
};
