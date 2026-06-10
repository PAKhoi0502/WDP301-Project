const { z } = require('zod');

const {
    UPLOAD_PURPOSE_VALUES,
    UPLOAD_RELATED_TYPE_VALUES,
    UPLOAD_ALLOWED_MIME_TYPES,
} = require('../../shared/constants/upload.constant');

const emptyToUndefined = (value) => {
    if (typeof value === 'string' && value.trim() === '') {
        return undefined;
    }

    return value;
};

const objectIdField = z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid resource id');

const optionalObjectIdField = z.preprocess(emptyToUndefined, objectIdField.optional());
const optionalTextField = z.preprocess(emptyToUndefined, z.string().trim().max(120).optional());

const relatedPairRule = (data) => {
    return (!!data.related_type && !!data.related_id) || (!data.related_type && !data.related_id);
};

const relatedQueryRule = (data) => {
    return !data.related_id || !!data.related_type;
};

const idParamSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
});

const createUploadSchema = z.object({
    body: z
        .object({
            purpose: z.enum(UPLOAD_PURPOSE_VALUES).optional(),
            related_type: z.preprocess(emptyToUndefined, z.enum(UPLOAD_RELATED_TYPE_VALUES).optional()),
            related_id: optionalObjectIdField,
        })
        .strict()
        .refine(relatedPairRule, {
            message: 'related_type and related_id must be provided together',
        }),
});

const getAdminUploadsSchema = z.object({
    query: z
        .object({
            page: z.coerce.number().int().min(1).default(1),
            limit: z.coerce.number().int().min(1).max(100).default(20),
            purpose: z.enum(UPLOAD_PURPOSE_VALUES).optional(),
            owner_id: optionalObjectIdField,
            related_type: z.preprocess(emptyToUndefined, z.enum(UPLOAD_RELATED_TYPE_VALUES).optional()),
            related_id: optionalObjectIdField,
            mime_type: z.preprocess(emptyToUndefined, z.enum(UPLOAD_ALLOWED_MIME_TYPES).optional()),
            from: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
            to: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
        })
        .strict()
        .refine(relatedQueryRule, {
            message: 'related_type is required when related_id is provided',
        }),
});

module.exports = {
    idParamSchema,
    createUploadSchema,
    getAdminUploadsSchema,
};
