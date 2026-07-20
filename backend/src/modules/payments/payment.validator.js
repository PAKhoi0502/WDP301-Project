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

const optionalUrlField = z.preprocess(
    emptyToUndefined,
    z.string().trim().url().optional()
);

const emptySchema = z.object({
    body: z.object({}).optional(),
    params: z.object({}).optional(),
    query: z.object({}).optional(),
});

const createPayosPaymentSchema = z.object({
    params: z
        .object({
            bookingId: objectIdField,
        })
        .strict(),
    body: z
        .object({
            return_url: optionalUrlField,
            cancel_url: optionalUrlField,
        })
        .strict()
        .default({}),
});

const customerCreatePayosPaymentSchema = z.object({
    params: z
        .object({
            bookingId: objectIdField,
        })
        .strict(),
    body: z.object({}).strict().default({}),
});

const bookingIdParamSchema = z.object({
    params: z
        .object({
            bookingId: objectIdField,
        })
        .strict(),
});

const paymentIdParamSchema = z.object({
    params: z
        .object({
            paymentId: objectIdField,
        })
        .strict(),
});

const cancelPaymentSchema = z.object({
    params: z
        .object({
            paymentId: objectIdField,
        })
        .strict(),
    body: z
        .object({
            reason: z.preprocess(
                emptyToUndefined,
                z.string().trim().max(255).optional()
            ),
        })
        .strict()
        .default({}),
});

const payosWebhookSchema = z.object({
    body: z
        .object({
            data: z.unknown(),
            signature: z.string().trim().min(1),
        })
        .passthrough(),
});

module.exports = {
    emptySchema,
    createPayosPaymentSchema,
    customerCreatePayosPaymentSchema,
    bookingIdParamSchema,
    paymentIdParamSchema,
    cancelPaymentSchema,
    payosWebhookSchema,
};
