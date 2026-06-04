const { z } = require('zod');

const {
    LOYALTY_TIER_VALUES,
    POINT_TRANSACTION_TYPE_VALUES,
} = require('../../shared/constants/loyalty.constant');

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

const paginationQueryFields = {
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
};

const optionalTextField = (max = 100) => z.preprocess(
    emptyToUndefined,
    z.string().trim().max(max).optional()
);

const optionalObjectIdField = z.preprocess(emptyToUndefined, objectIdField.optional());
const loyaltyTierField = z.enum(LOYALTY_TIER_VALUES);
const pointTransactionTypeField = z.enum(POINT_TRANSACTION_TYPE_VALUES);

const customerIdParamSchema = z.object({
    params: z
        .object({
            customerId: objectIdField,
        })
        .strict(),
});

const customerTransactionsSchema = z.object({
    query: z
        .object({
            ...paginationQueryFields,
            type: pointTransactionTypeField.optional(),
            booking_id: optionalObjectIdField,
        })
        .strict(),
});

const adminLoyaltyListSchema = z.object({
    query: z
        .object({
            ...paginationQueryFields,
            search: optionalTextField(100),
            tier: loyaltyTierField.optional(),
        })
        .strict(),
});

const adminTransactionsSchema = z.object({
    query: z
        .object({
            ...paginationQueryFields,
            customer_id: optionalObjectIdField,
            booking_id: optionalObjectIdField,
            type: pointTransactionTypeField.optional(),
        })
        .strict(),
});

const adminCustomerTransactionsSchema = z.object({
    params: z
        .object({
            customerId: objectIdField,
        })
        .strict(),
    query: z
        .object({
            ...paginationQueryFields,
            type: pointTransactionTypeField.optional(),
            booking_id: optionalObjectIdField,
        })
        .strict(),
});

module.exports = {
    customerIdParamSchema,
    customerTransactionsSchema,
    adminLoyaltyListSchema,
    adminTransactionsSchema,
    adminCustomerTransactionsSchema,
};
