const { z } = require('zod');

const {
    CUSTOMER_VOUCHER_TYPE_VALUES,
    CUSTOMER_VOUCHER_STATUS_VALUES,
} = require('../../shared/constants/customerVoucher.constant');

const objectIdField = z.string().trim().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const optionalTextField = (max) => z.preprocess(
    (value) => value === '' || value === null ? undefined : value,
    z.string().trim().max(max).optional()
);

const idParamSchema = z.object({
    params: z.object({ id: objectIdField }).strict(),
});

const getVouchersSchema = z.object({
    query: z.object({
        status: z.enum(CUSTOMER_VOUCHER_STATUS_VALUES).optional(),
        garage_id: objectIdField.optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
    }).strict(),
});

const validateVoucherSchema = z.object({
    body: z.object({
        code: z.string().trim().min(6).max(40),
        service_package_id: objectIdField,
        order_amount: z.coerce.number().int().min(0).optional(),
        quote_id: objectIdField.optional(),
    }).strict().refine(
        (data) => data.order_amount !== undefined || data.quote_id,
        {
            message: 'order_amount or quote_id is required',
        }
    ),
});

const createCompensationVoucherBodySchema = z.object({
    voucher_type: z.enum(CUSTOMER_VOUCHER_TYPE_VALUES),
    value: z.coerce.number().int().min(0),
    max_discount_amount: z.coerce.number().int().min(0).nullable().optional(),
    min_order_amount: z.coerce.number().int().min(0).default(0),
    service_package_id: objectIdField.nullable().optional(),
    expires_at: z.string().datetime({ offset: true }),
    note: optionalTextField(1000),
}).strict().superRefine((data, context) => {
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

    if (
        data.voucher_type === 'PERCENTAGE'
        && data.max_discount_amount !== null
        && data.max_discount_amount !== undefined
        && data.max_discount_amount <= 0
    ) {
        context.addIssue({
            code: 'custom',
            path: ['max_discount_amount'],
            message: 'percentage max discount amount must be greater than 0',
        });
    }

    if (data.voucher_type === 'FREE_SERVICE' && !data.service_package_id) {
        context.addIssue({
            code: 'custom',
            path: ['service_package_id'],
            message: 'service_package_id is required for free service voucher',
        });
    }

    if (data.voucher_type === 'FREE_SERVICE' && data.value !== 0) {
        context.addIssue({
            code: 'custom',
            path: ['value'],
            message: 'free service voucher value must be 0',
        });
    }
});

module.exports = {
    idParamSchema,
    getVouchersSchema,
    validateVoucherSchema,
    createCompensationVoucherBodySchema,
};
