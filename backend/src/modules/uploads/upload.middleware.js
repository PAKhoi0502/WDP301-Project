const multer = require('multer');
const { AppError } = require('../../shared/utils/appError');
const { UPLOAD_ALLOWED_MIME_TYPES } = require('../../shared/constants/upload.constant');

const getUploadMaxFileSize = () => {
    const value = Number(process.env.UPLOAD_MAX_FILE_SIZE_BYTES);

    if (Number.isInteger(value) && value > 0) {
        return value;
    }

    return 5 * 1024 * 1024;
};

const fileFilter = (req, file, callback) => {
    if (!UPLOAD_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        return callback(new AppError('File type is not allowed', 400, 'UPLOAD_FILE_TYPE_NOT_ALLOWED'));
    }

    return callback(null, true);
};

const multerUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: getUploadMaxFileSize(),
    },
    fileFilter,
});

const uploadSingleFile = (req, res, next) => {
    return multerUpload.single('file')(req, res, (error) => {
        if (!error) {
            return next();
        }

        if (error instanceof multer.MulterError) {
            if (error.code === 'LIMIT_FILE_SIZE') {
                return next(new AppError('File size exceeds upload limit', 400, 'UPLOAD_FILE_TOO_LARGE'));
            }

            return next(new AppError('File upload failed', 400, 'UPLOAD_MULTIPART_ERROR'));
        }

        return next(error);
    });
};

module.exports = {
    uploadSingleFile,
};
