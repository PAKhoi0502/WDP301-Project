const { z } = require('zod');

const { VEHICLE_TYPE_VALUES } = require('../../shared/constants/vehicle.constant');
const {
    PROMOTION_DISCOUNT_TYPE_VALUES,
    PROMOTION_AUDIENCE_VALUES,
} = require('../../shared/constants/promotion.constant');

const emptyToUndefined = (value) => {
    if (typeof value === 'string' && value.trim() === '') {
        return undefined;
    }

    return value;
};

const stringBooleanField = z.preprocess((value) => {
    if (value === 'true') {
        return true;
    }

    if (value === 'false') {
        return false;
    }

    return value;
}, z.boolean());

const objectIdField = z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid resource id');

const isoDateTimeField = z
    .string()
    .trim()
    .datetime({ offset: true, message: 'Datetime must be ISO 8601 with timezone offset' });

const optionalTextField = (max = 100) => z.preprocess(
    emptyToUndefined,
    z.string().trim().max(max).optional()
);

const optionalNumberField = (schema) => z.preprocess(
    emptyToUndefined,
    schema.nullable().optional()
);

const codeField = z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Za-z0-9_]+$/, 'Promotion code is invalid')
    .transform((value) => value.toUpperCase());

const nameField = z.string().trim().min(2).max(150);
const descriptionField = z.preprocess(emptyToUndefined, z.string().trim().max(2000).nullable().optional());
const discountTypeField = z.enum(PROMOTION_DISCOUNT_TYPE_VALUES);
const vehicleTypeField = z.enum(VEHICLE_TYPE_VALUES);
const loyaltyTierField = z.string().trim().min(1, 'Tier name cannot be empty').max(100)
    .transform((value) => value.toUpperCase());
const promotionAudienceField = z.enum(PROMOTION_AUDIENCE_VALUES);

const paginationQueryFields = {
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
};

const idParamSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
});

const getPublicPromotionsSchema = z.object({
    query: z
        .object({
            ...paginationQueryFields,
            search: optionalTextField(100),
            vehicle_type: vehicleTypeField.optional(),
            audience: promotionAudienceField.optional(),
            service_package_id: z.preprocess(emptyToUndefined, objectIdField.optional()),
        })
        .strict(),
});

const getAdminPromotionsSchema = z.object({
    query: z
        .object({
            ...paginationQueryFields,
            search: optionalTextField(100),
            vehicle_type: vehicleTypeField.optional(),
            tier: loyaltyTierField.optional(),
            audience: promotionAudienceField.optional(),
            is_active: stringBooleanField.optional(),
            valid_only: stringBooleanField.optional(),
        })
        .strict(),
});

const validatePromotionSchema = z.object({
    body: z
        .object({
            promotion_code: codeField,
            service_package_id: objectIdField,
            quote_id: objectIdField.optional(),
        })
        .strict(),
});

const createPromotionSchema = z.object({
    body: z
        .object({
            code: codeField,
            name: nameField,
            description: descriptionField,
            discount_type: discountTypeField,
            discount_value: z.coerce.number().min(0.01),
            max_discount_amount: optionalNumberField(z.coerce.number().min(0)),
            min_order_amount: z.coerce.number().min(0).default(0),
            audience: promotionAudienceField.default('ALL'),
            phone_required: z.boolean().default(false),
            per_phone_limit: optionalNumberField(z.coerce.number().int().min(1).max(1)),
            applicable_tiers: z.array(loyaltyTierField).default([]),
            applicable_vehicle_types: z.array(vehicleTypeField).default([]),
            applicable_service_package_ids: z.array(objectIdField).default([]),
            start_at: isoDateTimeField,
            end_at: isoDateTimeField,
            usage_limit: optionalNumberField(z.coerce.number().int().min(1)),
            per_customer_limit: optionalNumberField(z.coerce.number().int().min(1)),
            is_active: z.boolean().optional(),
        })
        .strict()
        .refine((data) => new Date(data.start_at) < new Date(data.end_at), {
            message: 'Promotion end time must be after start time',
        })
        .refine((data) => data.discount_type !== 'PERCENTAGE' || data.discount_value <= 100, {
            message: 'Percentage discount must not exceed 100',
        }),
});

const updatePromotionSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
    body: z
        .object({
            code: z.preprocess(emptyToUndefined, codeField.optional()),
            name: z.preprocess(emptyToUndefined, nameField.optional()),
            description: descriptionField,
            discount_type: discountTypeField.optional(),
            discount_value: z.preprocess(emptyToUndefined, z.coerce.number().min(0.01).optional()),
            max_discount_amount: optionalNumberField(z.coerce.number().min(0)),
            min_order_amount: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional()),
            audience: promotionAudienceField.optional(),
            phone_required: z.boolean().optional(),
            per_phone_limit: optionalNumberField(z.coerce.number().int().min(1).max(1)),
            applicable_tiers: z.array(loyaltyTierField).optional(),
            applicable_vehicle_types: z.array(vehicleTypeField).optional(),
            applicable_service_package_ids: z.array(objectIdField).optional(),
            start_at: z.preprocess(emptyToUndefined, isoDateTimeField.optional()),
            end_at: z.preprocess(emptyToUndefined, isoDateTimeField.optional()),
            usage_limit: optionalNumberField(z.coerce.number().int().min(1)),
            per_customer_limit: optionalNumberField(z.coerce.number().int().min(1)),
            is_active: z.boolean().optional(),
        })
        .strict()
        .refine((data) => Object.values(data).some((value) => value !== undefined), {
            message: 'At least one field is required',
        })
        .refine((data) => data.discount_type !== 'PERCENTAGE' || data.discount_value === undefined || data.discount_value <= 100, {
            message: 'Percentage discount must not exceed 100',
        }),
});

const updatePromotionStatusSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
});

module.exports = {
    idParamSchema,
    getPublicPromotionsSchema,
    getAdminPromotionsSchema,
    validatePromotionSchema,
    createPromotionSchema,
    updatePromotionSchema,
    updatePromotionStatusSchema,
};
