const Upload = require('./upload.model');
const UploadMapper = require('./upload.mapper');
const { configureCloudinary } = require('../../config/cloudinary');
const { AppError } = require('../../shared/utils/appError');
const { USER_ROLES } = require('../../shared/constants/roles.constant');
const { UPLOAD_PURPOSES, UPLOAD_RELATED_TYPES } = require('../../shared/constants/upload.constant');
const { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } = require('../../shared/constants/audit.constant');
const auditLogService = require('../audit-logs/auditLog.service');

const normalizeText = (value) => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value !== 'string') {
        return value;
    }

    const trimmedValue = value.trim();

    return trimmedValue || null;
};

const buildDateRangeFilter = ({ from, to } = {}) => {
    if (!from && !to) {
        return null;
    }

    const range = {};

    if (from) {
        range.$gte = from;
    }

    if (to) {
        range.$lte = to;
    }

    return range;
};

const getUploadFolder = (purpose = UPLOAD_PURPOSES.GENERAL) => {
    const baseFolder = normalizeText(process.env.CLOUDINARY_UPLOAD_FOLDER) || 'autowash-pro/uploads';

    return [
        baseFolder.replace(/\/+$/, ''),
        purpose.toLowerCase().replace(/_/g, '-'),
    ].join('/');
};

const getResourceTypeByMimeType = (mimeType = '') => {
    if (mimeType.startsWith('image/')) {
        return 'image';
    }

    if (mimeType.startsWith('video/')) {
        return 'video';
    }

    return 'raw';
};

const uploadBufferToCloudinary = async (file, purpose) => {
    const cloudinary = configureCloudinary();

    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: getUploadFolder(purpose),
                resource_type: 'auto',
                use_filename: true,
                unique_filename: true,
            },
            (error, result) => {
                if (error) {
                    return reject(error);
                }

                return resolve(result);
            }
        );

        stream.end(file.buffer);
    });
};

const deleteCloudinaryAsset = async (upload) => {
    const cloudinary = configureCloudinary();

    return cloudinary.uploader.destroy(upload.public_id, {
        resource_type: getResourceTypeByMimeType(upload.mime_type),
        invalidate: true,
    });
};

const populateUploadQuery = (query) => {
    return query.populate('owner_id', 'full_name email phone role is_active');
};

const buildUploadPayload = ({ file, body, user, cloudinaryResult }) => {
    const url = cloudinaryResult?.secure_url || cloudinaryResult?.url;
    const publicId = cloudinaryResult?.public_id;

    if (!url || !publicId) {
        throw new AppError('Cloudinary upload result is invalid', 502, 'CLOUDINARY_UPLOAD_RESULT_INVALID');
    }

    return {
        url,
        public_id: publicId,
        mime_type: file.mimetype,
        size: file.size,
        width: cloudinaryResult?.width || null,
        height: cloudinaryResult?.height || null,
        purpose: body.purpose || UPLOAD_PURPOSES.GENERAL,
        owner_id: user._id,
        related_type: normalizeText(body.related_type),
        related_id: normalizeText(body.related_id),
    };
};

const createUpload = async (user, file, body = {}, auditContext = {}) => {
    if (!file) {
        throw new AppError('File is required', 400, 'UPLOAD_FILE_REQUIRED');
    }

    let cloudinaryResult;

    try {
        cloudinaryResult = await uploadBufferToCloudinary(file, body.purpose);
    } catch (error) {
        if (error.isOperational) {
            throw error;
        }

        throw new AppError('Failed to upload file to Cloudinary', 502, 'CLOUDINARY_UPLOAD_FAILED', [
            {
                path: 'file',
                message: error.message || 'Cloudinary upload failed',
            },
        ]);
    }

    let upload;

    try {
        upload = await Upload.create(buildUploadPayload({
            file,
            body,
            user,
            cloudinaryResult,
        }));
    } catch (error) {
        await deleteCloudinaryAsset({
            public_id: cloudinaryResult.public_id,
            mime_type: file.mimetype,
        }).catch(() => null);

        throw error;
    }

    const populatedUpload = await populateUploadQuery(Upload.findById(upload._id));
    const result = UploadMapper.toUploadDto(populatedUpload);

    await auditLogService.recordAuditEvent({
        actorId: user._id,
        action: AUDIT_ACTIONS.UPLOAD_CREATED,
        resourceType: AUDIT_RESOURCE_TYPES.UPLOAD,
        resourceId: upload._id,
        after: result,
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
        metadata: {
            purpose: result.purpose,
            related_type: result.related_type,
            related_id: result.related_id,
        },
    });

    return result;
};

const buildAdminUploadFilter = ({ purpose, owner_id, related_type, related_id, mime_type, from, to } = {}) => {
    const filter = {};
    const createdAtRange = buildDateRangeFilter({ from, to });

    if (purpose) {
        filter.purpose = purpose;
    }

    if (owner_id) {
        filter.owner_id = owner_id;
    }

    if (related_type) {
        filter.related_type = related_type;
    }

    if (related_id) {
        filter.related_id = related_id;
    }

    if (mime_type) {
        filter.mime_type = mime_type;
    }

    if (createdAtRange) {
        filter.created_at = createdAtRange;
    }

    return filter;
};

const getAllUploads = async ({ page = 1, limit = 20, purpose, owner_id, related_type, related_id, mime_type, from, to } = {}) => {
    const filter = buildAdminUploadFilter({
        purpose,
        owner_id,
        related_type,
        related_id,
        mime_type,
        from,
        to,
    });
    const skip = (page - 1) * limit;

    const [uploads, total] = await Promise.all([
        populateUploadQuery(
            Upload.find(filter)
                .sort({ created_at: -1 })
                .skip(skip)
                .limit(limit)
        ),
        Upload.countDocuments(filter),
    ]);

    return {
        data: UploadMapper.toUploadDtoList(uploads),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

const getUploadDocumentById = async (uploadId) => {
    const upload = await Upload.findById(uploadId);

    if (!upload) {
        throw new AppError('Upload not found', 404, 'UPLOAD_NOT_FOUND');
    }

    return upload;
};

const assertUserCanDeleteUpload = (user, upload) => {
    if (user.role === USER_ROLES.ADMIN) {
        return;
    }

    if (upload.owner_id?.toString() === user._id.toString()) {
        return;
    }

    throw new AppError('You do not have permission to delete this upload', 403, 'UPLOAD_DELETE_FORBIDDEN');
};

const deleteUpload = async (user, uploadId, auditContext = {}) => {
    const upload = await getUploadDocumentById(uploadId);

    assertUserCanDeleteUpload(user, upload);

    if (
        upload.purpose === UPLOAD_PURPOSES.CUSTOMER_CASE_EVIDENCE
        && upload.related_type === UPLOAD_RELATED_TYPES.CUSTOMER_CASE
        && upload.related_id
    ) {
        throw new AppError(
            'Evidence linked to a customer case cannot be deleted',
            409,
            'CUSTOMER_CASE_EVIDENCE_IMMUTABLE'
        );
    }

    if (
        upload.purpose === UPLOAD_PURPOSES.BOOKING_PLATE_SCAN
        && upload.related_type === UPLOAD_RELATED_TYPES.BOOKING_PLATE_SCAN
        && upload.related_id
        && (!upload.retained_until || upload.retained_until > new Date())
    ) {
        throw new AppError(
            'Plate scan image is managed by the retention policy',
            409,
            'PLATE_SCAN_IMAGE_RETENTION_MANAGED'
        );
    }

    const before = UploadMapper.toUploadDto(upload);

    try {
        await deleteCloudinaryAsset(upload);
    } catch (error) {
        if (error.isOperational) {
            throw error;
        }

        throw new AppError('Failed to delete file from Cloudinary', 502, 'CLOUDINARY_DELETE_FAILED', [
            {
                path: 'public_id',
                message: error.message || 'Cloudinary delete failed',
            },
        ]);
    }

    await Upload.deleteOne({ _id: upload._id });

    await auditLogService.recordAuditEvent({
        actorId: user._id,
        action: AUDIT_ACTIONS.UPLOAD_DELETED,
        resourceType: AUDIT_RESOURCE_TYPES.UPLOAD,
        resourceId: upload._id,
        before,
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
        metadata: {
            purpose: before.purpose,
            related_type: before.related_type,
            related_id: before.related_id,
        },
    });

    return before;
};

module.exports = {
    createUpload,
    getAllUploads,
    deleteUpload,
    deleteCloudinaryAsset,
};
