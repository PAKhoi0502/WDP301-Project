const { z } = require('zod');

const {
    NOTIFICATION_TYPE_VALUES,
    NOTIFICATION_RELATED_TYPE_VALUES,
    IN_APP_STATUS_VALUES,
} = require('../../shared/constants/notification.constant');

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

const idParamSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
});

const getNotificationsSchema = z.object({
    query: z
        .object({
            page: z.coerce.number().int().min(1).default(1),
            limit: z.coerce.number().int().min(1).max(100).default(20),
            type: z.preprocess(emptyToUndefined, z.enum(NOTIFICATION_TYPE_VALUES).optional()),
            related_type: z.preprocess(emptyToUndefined, z.enum(NOTIFICATION_RELATED_TYPE_VALUES).optional()),
            in_app_status: z.preprocess(emptyToUndefined, z.enum(IN_APP_STATUS_VALUES).optional()),
        })
        .strict(),
});

const emptySchema = z.object({
    query: z.object({}).strict().optional(),
});

module.exports = {
    idParamSchema,
    getNotificationsSchema,
    emptySchema,
};
