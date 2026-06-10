const { z } = require('zod');

const emptyToUndefined = (value) => {
    if (typeof value === 'string' && value.trim() === '') {
        return undefined;
    }

    return value;
};

const uppercaseTextField = (max) => z.preprocess(
    (value) => {
        const normalizedValue = emptyToUndefined(value);

        if (typeof normalizedValue === 'string') {
            return normalizedValue.trim().toUpperCase();
        }

        return normalizedValue;
    },
    z.string()
        .max(max)
        .regex(/^[A-Z][A-Z0-9_]*$/, 'Value format is invalid')
        .optional()
);

const objectIdField = z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid resource id');

const optionalObjectIdField = z.preprocess(emptyToUndefined, objectIdField.optional());

const getAuditLogsSchema = z.object({
    query: z
        .object({
            page: z.coerce.number().int().min(1).default(1),
            limit: z.coerce.number().int().min(1).max(100).default(20),
            actor_id: optionalObjectIdField,
            action: uppercaseTextField(100),
            resource_type: uppercaseTextField(100),
            resource_id: optionalObjectIdField,
            ip: z.preprocess(emptyToUndefined, z.string().trim().max(64).optional()),
            from: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
            to: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
        })
        .strict()
        .refine((data) => !data.from || !data.to || data.from <= data.to, {
            message: 'from must be before or equal to to',
        }),
});

module.exports = {
    getAuditLogsSchema,
};
