const { z } = require('zod');

const { CUSTOMER_VOUCHER_TYPE_VALUES } = require('../../shared/constants/customerVoucher.constant');

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

const nameField = z.string().trim().min(2).max(150);
const descriptionField = z.preprocess(emptyToUndefined, z.string().trim().max(2000).nullable().optional());
const voucherTypeField = z.enum(CUSTOMER_VOUCHER_TYPE_VALUES);
const loyaltyTierField = z.string().trim().min(1, 'Tier name cannot be empty').max(100)
    .transform((value) => value.toUpperCase());

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

const getCustomerVoucherTemplatesSchema = z.object({
    query: z
        .object({
            ...paginationQueryFields,
            search: optionalTextField(100),
            voucher_type: voucherTypeField.optional(),
        })
        .strict(),
});

const getAdminVoucherTemplatesSchema = z.object({
    query: z
        .object({
            ...paginationQueryFields,
            search: optionalTextField(100),
            voucher_type: voucherTypeField.optional(),
            tier: loyaltyTierField.optional(),
            is_active: stringBooleanField.optional(),
            valid_only: stringBooleanField.optional(),
        })
        .strict(),
});

const voucherTemplateBodyFields = {
    name: nameField,
    description: descriptionField,
    voucher_type: voucherTypeField,
    value: z.coerce.number().min(0),
    max_discount_amount: optionalNumberField(z.coerce.number().min(0)),
    min_order_amount: z.coerce.number().min(0).default(0),
    service_package_id: z.preprocess(emptyToUndefined, objectIdField.nullable().optional()),
    points_cost: z.coerce.number().int().min(1),
    voucher_validity_days: z.coerce.number().int().min(1),
    total_quantity: optionalNumberField(z.coerce.number().int().min(1)),
    per_customer_limit: optionalNumberField(z.coerce.number().int().min(1)),
    applicable_tiers: z.array(loyaltyTierField).default([]),
    start_at: isoDateTimeField,
    end_at: isoDateTimeField,
    is_active: z.boolean().optional(),
};

const validateVoucherTemplateDefinition = (data, context) => {
    if (data.voucher_type !== 'FREE_SERVICE' && data.value <= 0) {
        context.addIssue({
            code: 'custom',
            path: ['value'],
            message: 'value must be greater than 0',
        });
    }

    if (data.voucher_type === 'PERCENTAGE' && data.value > 100) {
        context.addIssue({
            code: 'custom',
            path: ['value'],
            message: 'percentage value must not exceed 100',
        });
    }

    if (data.voucher_type === 'FREE_SERVICE' && !data.service_package_id) {
        context.addIssue({
            code: 'custom',
            path: ['service_package_id'],
            message: 'service_package_id is required for free service voucher template',
        });
    }

    if (data.voucher_type === 'FREE_SERVICE' && data.value !== 0) {
        context.addIssue({
            code: 'custom',
            path: ['value'],
            message: 'free service voucher template value must be 0',
        });
    }
};

const createVoucherTemplateSchema = z.object({
    body: z
        .object(voucherTemplateBodyFields)
        .strict()
        .refine((data) => new Date(data.start_at) < new Date(data.end_at), {
            message: 'Voucher template end time must be after start time',
        })
        .superRefine(validateVoucherTemplateDefinition),
});

const updateVoucherTemplateSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
    body: z
        .object({
            name: z.preprocess(emptyToUndefined, nameField.optional()),
            description: descriptionField,
            voucher_type: voucherTypeField.optional(),
            value: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional()),
            max_discount_amount: optionalNumberField(z.coerce.number().min(0)),
            min_order_amount: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional()),
            service_package_id: z.preprocess(emptyToUndefined, objectIdField.nullable().optional()),
            points_cost: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).optional()),
            voucher_validity_days: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).optional()),
            total_quantity: optionalNumberField(z.coerce.number().int().min(1)),
            per_customer_limit: optionalNumberField(z.coerce.number().int().min(1)),
            applicable_tiers: z.array(loyaltyTierField).optional(),
            start_at: z.preprocess(emptyToUndefined, isoDateTimeField.optional()),
            end_at: z.preprocess(emptyToUndefined, isoDateTimeField.optional()),
            is_active: z.boolean().optional(),
        })
        .strict()
        .refine((data) => Object.values(data).some((value) => value !== undefined), {
            message: 'At least one field is required',
        })
        .refine(
            (data) => data.voucher_type !== 'PERCENTAGE' || data.value === undefined || data.value <= 100,
            { message: 'Percentage value must not exceed 100' }
        ),
});

const updateVoucherTemplateStatusSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
});

const redeemVoucherTemplateSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
    body: z
        .object({
            garage_id: objectIdField.optional(),
        })
        .strict(),
});

module.exports = {
    idParamSchema,
    getCustomerVoucherTemplatesSchema,
    getAdminVoucherTemplatesSchema,
    createVoucherTemplateSchema,
    updateVoucherTemplateSchema,
    updateVoucherTemplateStatusSchema,
    redeemVoucherTemplateSchema,
};
