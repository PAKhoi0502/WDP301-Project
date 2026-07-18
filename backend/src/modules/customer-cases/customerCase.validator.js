const { z } = require('zod');

const {
    CUSTOMER_CASE_CATEGORY_VALUES,
    CUSTOMER_CASE_STATUS_VALUES,
    CUSTOMER_CASE_LIABILITY_STATUS_VALUES,
    CUSTOMER_CASE_LIABILITY_STATUSES,
    CUSTOMER_CASE_RESOLUTION_ACTION_TYPE_VALUES,
    CUSTOMER_CASE_REFUND_METHOD_VALUES,
    CUSTOMER_CASE_REFUND_STATUSES,
} = require('../../shared/constants/customerCase.constant');
const { CUSTOMER_VOUCHER_TYPE_VALUES } = require('../../shared/constants/customerVoucher.constant');

const objectIdField = z.string().trim().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const uniqueObjectIds = z.array(objectIdField).max(10).default([]).refine(
    (items) => new Set(items).size === items.length,
    'Upload ids must be unique'
);
const optionalText = (max) => z.preprocess(
    (value) => value === '' || value === null ? undefined : value,
    z.string().trim().max(max).optional()
);

const bookingParamSchema = z.object({
    params: z.object({ id: objectIdField }).strict(),
});

const handoverOperationSchema = z.object({
    params: z.object({ id: objectIdField }).strict(),
    body: z.object({ note: optionalText(1000) }).strict().default({}),
});

const createCustomerCaseSchema = z.object({
    params: z.object({ id: objectIdField }).strict(),
    body: z.object({
        category: z.enum(CUSTOMER_CASE_CATEGORY_VALUES),
        description: z.string().trim().min(10).max(2000),
        desired_resolution: optionalText(1000),
        discovered_at: z.string().datetime({ offset: true }).optional(),
        vehicle_received: z.boolean().default(false),
        upload_ids: uniqueObjectIds,
    }).strict().refine(
        (data) => !data.discovered_at || new Date(data.discovered_at).getTime() <= Date.now() + 5 * 60 * 1000,
        { path: ['discovered_at'], message: 'Discovered time cannot be in the future' }
    ),
});

const idParamSchema = z.object({
    params: z.object({ id: objectIdField }).strict(),
});

const listCustomerCasesSchema = z.object({
    query: z.object({
        status: z.enum(CUSTOMER_CASE_STATUS_VALUES).optional(),
        category: z.enum(CUSTOMER_CASE_CATEGORY_VALUES).optional(),
        booking_id: objectIdField.optional(),
        case_code: z.string().trim().regex(/^CC-\d{8}-[A-F0-9]{8}$/i, 'Invalid case code').transform((value) => value.toUpperCase()).optional(),
        assigned_to_id: objectIdField.optional(),
        garage_id: objectIdField.optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
    }).strict(),
});

const addEvidenceSchema = z.object({
    params: z.object({ id: objectIdField }).strict(),
    body: z.object({ upload_ids: uniqueObjectIds.refine((items) => items.length > 0, 'Upload ids are required') }).strict(),
});

const postMessageSchema = z.object({
    params: z.object({ id: objectIdField }).strict(),
    body: z.object({
        message: z.string().trim().min(1).max(2000),
        upload_ids: uniqueObjectIds,
    }).strict(),
});

const assignCustomerCaseSchema = z.object({
    params: z.object({ id: objectIdField }).strict(),
    body: z.object({ staff_profile_id: objectIdField }).strict(),
});

const acknowledgeCustomerCaseSchema = z.object({
    params: z.object({ id: objectIdField }).strict(),
    body: z.object({ note: optionalText(1000) }).strict().default({}),
});

const concludeCustomerCaseSchema = z.object({
    params: z.object({ id: objectIdField }).strict(),
    body: z.object({
        liability_status: z.enum(CUSTOMER_CASE_LIABILITY_STATUS_VALUES).refine(
            (value) => value !== CUSTOMER_CASE_LIABILITY_STATUSES.UNDETERMINED,
            'A final liability status is required'
        ),
        conclusion: z.string().trim().min(10).max(3000),
        resolution_summary: optionalText(3000),
    }).strict(),
});

const closeCustomerCaseSchema = z.object({
    params: z.object({ id: objectIdField }).strict(),
    body: z.object({ note: optionalText(1000) }).strict().default({}),
});

const assignTechnicalAssessmentSchema = z.object({
    params: z.object({ id: objectIdField }).strict(),
    body: z.object({ staff_profile_id: objectIdField }).strict(),
});

const submitTechnicalAssessmentSchema = z.object({
    params: z.object({ id: objectIdField }).strict(),
    body: z.object({
        findings: z.string().trim().min(10).max(5000),
        root_cause: z.string().trim().min(5).max(3000),
        severity: z.enum(['MINOR', 'MODERATE', 'MAJOR', 'SAFETY_CRITICAL']),
        recommended_resolution: z.string().trim().min(5).max(3000),
        upload_ids: uniqueObjectIds,
    }).strict(),
});

const resolutionActionSchema = z.object({
    action_type: z.enum(CUSTOMER_CASE_RESOLUTION_ACTION_TYPE_VALUES),
    amount: z.coerce.number().positive().optional(),
    refund_method: z.enum(CUSTOMER_CASE_REFUND_METHOD_VALUES).optional(),
    voucher_type: z.enum(CUSTOMER_VOUCHER_TYPE_VALUES).optional(),
    value: z.coerce.number().min(0).optional(),
    max_discount_amount: z.coerce.number().positive().optional(),
    min_order_amount: z.coerce.number().min(0).optional(),
    service_package_id: objectIdField.optional(),
    expires_at: z.string().datetime({ offset: true }).transform((value) => new Date(value)).optional(),
    rework_start_time: z.string().datetime({ offset: true }).transform((value) => new Date(value)).optional(),
    note: optionalText(1000),
}).strict();

const proposeResolutionSchema = z.object({
    params: z.object({ id: objectIdField }).strict(),
    body: z.object({
        summary: z.string().trim().min(10).max(3000),
        actions: z.array(resolutionActionSchema).min(1).max(3),
    }).strict(),
});

const respondResolutionSchema = z.object({
    params: z.object({ id: objectIdField }).strict(),
    body: z.object({
        resolution_id: objectIdField,
        accepted: z.boolean(),
        note: optionalText(2000),
    }).strict(),
});

const recordWalkInResolutionResponseSchema = z.object({
    params: z.object({ id: objectIdField }).strict(),
    body: z.object({
        resolution_id: objectIdField,
        verification_token: z.string().min(32).max(200),
        accepted: z.boolean(),
        note: optionalText(2000),
    }).strict(),
});

const applyResolutionSchema = z.object({
    params: z.object({ id: objectIdField, resolutionId: objectIdField }).strict(),
});

const updateRefundSchema = z.object({
    params: z.object({ id: objectIdField, refundId: objectIdField }).strict(),
    body: z.object({
        status: z.enum([
            CUSTOMER_CASE_REFUND_STATUSES.PROCESSING,
            CUSTOMER_CASE_REFUND_STATUSES.COMPLETED,
            CUSTOMER_CASE_REFUND_STATUSES.FAILED,
        ]),
        transaction_reference: optionalText(200),
        note: optionalText(2000),
        failure_reason: optionalText(2000),
    }).strict(),
});

const reopenCustomerCaseSchema = z.object({
    params: z.object({ id: objectIdField }).strict(),
    body: z.object({ reason: z.string().trim().min(10).max(2000) }).strict(),
});

const slaDashboardSchema = z.object({
    query: z.object({
        garage_id: objectIdField.optional(),
        limit: z.coerce.number().int().min(1).max(500).default(100),
    }).strict(),
});

const walkInOtpRequestSchema = z.object({
    body: z.object({ booking_id: objectIdField }).strict(),
});

const walkInOtpVerifySchema = z.object({
    body: z.object({
        challenge_id: objectIdField,
        otp: z.string().regex(/^\d{6}$/),
    }).strict(),
});

const createWalkInCustomerCaseSchema = z.object({
    body: z.object({
        booking_id: objectIdField,
        verification_token: z.string().min(32).max(200),
        category: z.enum(CUSTOMER_CASE_CATEGORY_VALUES),
        description: z.string().trim().min(10).max(2000),
        desired_resolution: optionalText(1000),
        discovered_at: z.string().datetime({ offset: true }).optional(),
        vehicle_received: z.boolean().default(false),
        upload_ids: uniqueObjectIds,
    }).strict().refine(
        (data) => !data.discovered_at || new Date(data.discovered_at).getTime() <= Date.now() + 5 * 60 * 1000,
        { path: ['discovered_at'], message: 'Discovered time cannot be in the future' }
    ),
});

module.exports = {
    bookingParamSchema,
    handoverOperationSchema,
    createCustomerCaseSchema,
    idParamSchema,
    listCustomerCasesSchema,
    addEvidenceSchema,
    postMessageSchema,
    assignCustomerCaseSchema,
    acknowledgeCustomerCaseSchema,
    concludeCustomerCaseSchema,
    closeCustomerCaseSchema,
    assignTechnicalAssessmentSchema,
    submitTechnicalAssessmentSchema,
    proposeResolutionSchema,
    respondResolutionSchema,
    recordWalkInResolutionResponseSchema,
    applyResolutionSchema,
    updateRefundSchema,
    reopenCustomerCaseSchema,
    slaDashboardSchema,
    walkInOtpRequestSchema,
    walkInOtpVerifySchema,
    createWalkInCustomerCaseSchema,
};
