const { z } = require('zod');

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

const optionalTextField = z.preprocess(
    emptyToUndefined,
    z.string().trim().max(100).optional()
);

const searchAdminCustomersSchema = z.object({
    query: z
        .object({
            garage_id: objectIdField,
            search: optionalTextField,
            page: z.coerce.number().int().min(1).default(1),
            limit: z.coerce.number().int().min(1).max(100).default(20),
        })
        .strict(),
});

module.exports = {
    searchAdminCustomersSchema,
};
