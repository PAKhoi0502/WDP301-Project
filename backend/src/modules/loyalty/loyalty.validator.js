const { z } = require('zod');

const {
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
const loyaltyTierField = z.preprocess(
    emptyToUndefined,
    z.string().trim().min(1, 'Tier name cannot be empty').max(100).transform((value) => value.toUpperCase())
);
const pointTransactionTypeField = z.enum(POINT_TRANSACTION_TYPE_VALUES);
const promotionCodeField = z.preprocess(
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

const tierRuleFields = {
    tier_name: loyaltyTierField,
    booking_window_days: z.coerce.number().int().min(1),
    max_upcoming_bookings: z.coerce.number().int().min(1),
    point_multiplier: z.coerce.number().min(0),
    priority_level: z.coerce.number().int().min(1),
    min_total_spent: z.coerce.number().min(0).default(0),
    min_total_visits: z.coerce.number().int().min(0).default(0),
    min_total_points: z.coerce.number().int().min(0).default(0),
    is_active: z.boolean().optional(),
};

const updatableTierRuleFields = {
    tier_name: tierRuleFields.tier_name.optional(),
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


const redeemPreviewSchema = z.object({
    body: z
        .object({
            service_package_id: objectIdField,
            quote_id: optionalObjectIdField,
            promotion_id: optionalObjectIdField,
            promotion_code: promotionCodeField,
            voucher_code: z.preprocess(
                emptyToUndefined,
                z.string().trim().min(6).max(40).optional()
            ),
            used_points: z.coerce.number().int().min(0),
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


const expiringPointsSchema = z.object({
    query: z
        .object({
            ...paginationQueryFields,
            customer_id: optionalObjectIdField,
            days: z.coerce.number().int().min(0).max(365).default(30),
        })
        .strict(),
});

const expirePointsSchema = z.object({
    body: z
        .object({
            customer_id: optionalObjectIdField,
        })
        .strict()
        .default({}),
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
    redeemPreviewSchema,
    adminLoyaltyListSchema,
    adminTransactionsSchema,
    adminCustomerTransactionsSchema,
    tierRuleIdParamSchema,
    createTierRuleSchema,
    updateTierRuleSchema,
    expiringPointsSchema,
    expirePointsSchema,
};
