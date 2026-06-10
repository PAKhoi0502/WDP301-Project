const express = require('express');

const uploadController = require('./upload.controller');
const {
    idParamSchema,
    createUploadSchema,
    getAdminUploadsSchema,
} = require('./upload.validator');
const { uploadSingleFile } = require('./upload.middleware');
const { validate } = require('../../shared/middlewares/validate.middleware');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');
const { USER_ROLES } = require('../../shared/constants/roles.constant');

const publicRouter = express.Router();
const adminRouter = express.Router();

publicRouter.use(authenticate);

publicRouter.post(
    '/',
    uploadSingleFile,
    validate(createUploadSchema),
    uploadController.createUpload
);

publicRouter.delete(
    '/:id',
    validate(idParamSchema),
    uploadController.deleteUpload
);

adminRouter.use(authenticate, authorize(USER_ROLES.ADMIN));

adminRouter.get(
    '/',
    validate(getAdminUploadsSchema),
    uploadController.getAllUploads
);

module.exports = {
    publicRouter,
    adminRouter,
};
