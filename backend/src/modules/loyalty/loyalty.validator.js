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


const optionalPromotionCodeField = z.preprocess(
    emptyToUndefined,
    z
        .string()
        .trim()
        .min(2)
        .max(40)
        .regex(/^[A-Za-z0-9_]+$/, 'Promotion code is invalid')
        .transform((value) => value.toUpperCase())
        .optional()
);

const redeemPreviewSchema = z.object({
    body: z
        .object({
            service_package_id: objectIdField,
            promotion_id: optionalObjectIdField,
            promotion_code: optionalPromotionCodeField,
            used_points: z.coerce.number().int().min(0),
        })
        .strict()
        .refine(
            (value) => !(value.promotion_id && value.promotion_code),
            {
                message: 'Use either promotion_id or promotion_code',
                path: ['promotion_code'],
            }
        ),
});

const tierRuleFields = {
    tier_name: loyaltyTierField,
    booking_window_days: z.coerce.number().int().min(1).max(60),
    max_upcoming_bookings: z.coerce.number().int().min(1).max(20),
    point_multiplier: z.coerce.number().min(0).max(10),
    priority_level: z.coerce.number().int().min(1).max(100),
    min_total_spent: z.coerce.number().min(0).default(0),
    min_total_visits: z.coerce.number().int().min(0).default(0),
    min_total_points: z.coerce.number().int().min(0).default(0),
    is_active: z.boolean().optional(),
};

const updatableTierRuleFields = {
    booking_window_days: tierRuleFields.booking_window_days.optional(),
    max_upcoming_bookings: tierRuleFields.max_upcoming_bookings.optional(),
    point_multiplier: tierRuleFields.point_multiplier.optional(),
    priority_level: tierRuleFields.priority_level.optional(),
    min_total_spent: z.coerce.number().min(0).optional(),
    min_total_visits: z.coerce.number().int().min(0).optional(),
    min_total_points: z.coerce.number().int().min(0).optional(),
    is_active: z.boolean().optional(),
};

const tierRuleIdParamSchema = z.object({
    params: z
        .object({
            tierRuleId: objectIdField,
        })
        .strict(),
});

const createTierRuleSchema = z.object({
    body: z
        .object(tierRuleFields)
        .strict(),
});

const updateTierRuleSchema = z.object({
    params: z
        .object({
            tierRuleId: objectIdField,
        })
        .strict(),
    body: z
        .object(updatableTierRuleFields)
        .strict()
        .refine((body) => Object.keys(body).length > 0, {
            message: 'At least one field is required',
        }),
});

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
    redeemPreviewSchema,
    customerIdParamSchema,
    customerTransactionsSchema,
    adminLoyaltyListSchema,
    adminTransactionsSchema,
    adminCustomerTransactionsSchema,
    tierRuleIdParamSchema,
    createTierRuleSchema,
    updateTierRuleSchema,
};
