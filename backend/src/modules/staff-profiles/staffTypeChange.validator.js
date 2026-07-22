const { z } = require('zod');

const { STAFF_TYPE_VALUES } = require('../../shared/constants/staff.constant');
const {
    STAFF_TYPE_CHANGE_STATUS_VALUES,
    STAFF_TYPE_CHANGE_REQUEST_SOURCE_VALUES,
} = require('../../shared/constants/staffTypeChange.constant');

const objectIdField = z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid resource id');

const emptyToUndefined = (value) => (
    typeof value === 'string' && value.trim() === '' ? undefined : value
);

const optionalDateField = z.preprocess(
    emptyToUndefined,
    z.coerce.date().optional()
);

const reasonField = z.string().trim().min(5).max(1000);
const optionalReasonField = z.preprocess(
    emptyToUndefined,
    z.string().trim().min(5).max(1000).optional()
);
const optionalHandoverNoteField = z.preprocess(
    emptyToUndefined,
    z.string().trim().max(2000).optional()
);

const requestIdParam = z.object({
    requestId: objectIdField,
}).strict();

const staffProfileIdParam = z.object({
    id: objectIdField,
}).strict();

const paginationQuery = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(STAFF_TYPE_CHANGE_STATUS_VALUES).optional(),
}).strict();

const createStaffTypeChangeRequestBody = z.object({
    to_staff_type: z.enum(STAFF_TYPE_VALUES),
    reason: reasonField,
    effective_at: optionalDateField,
    handover_note: optionalHandoverNoteField,
}).strict();

const createMyStaffTypeChangeRequestSchema = z.object({
    body: createStaffTypeChangeRequestBody,
});

const createAdminStaffTypeChangeRequestSchema = z.object({
    params: staffProfileIdParam,
    body: createStaffTypeChangeRequestBody,
});

const getMyStaffTypeChangeRequestsSchema = z.object({
    query: paginationQuery,
});

const getAdminStaffTypeChangeRequestsSchema = z.object({
    query: paginationQuery.extend({
        staff_profile_id: objectIdField.optional(),
        request_source: z.enum(STAFF_TYPE_CHANGE_REQUEST_SOURCE_VALUES).optional(),
    }).strict(),
});

const getStaffTypeChangeImpactSchema = z.object({
    params: staffProfileIdParam,
    query: z.object({
        to_staff_type: z.enum(STAFF_TYPE_VALUES),
        effective_at: optionalDateField,
    }).strict(),
});

const staffTypeChangeRequestParamSchema = z.object({
    params: requestIdParam,
});

const approveStaffTypeChangeRequestSchema = z.object({
    params: requestIdParam,
    body: z.object({
        effective_at: optionalDateField,
        handover_note: optionalHandoverNoteField,
        emergency_override: z.boolean().default(false),
        override_reason: optionalReasonField,
    }).strict().superRefine((data, ctx) => {
        if (data.emergency_override && !data.override_reason) {
            ctx.addIssue({
                code: 'custom',
                path: ['override_reason'],
                message: 'Override reason is required for emergency override',
            });
        }
    }),
});

const rejectStaffTypeChangeRequestSchema = z.object({
    params: requestIdParam,
    body: z.object({
        reason: reasonField,
    }).strict(),
});

const cancelStaffTypeChangeRequestSchema = z.object({
    params: requestIdParam,
    body: z.object({
        reason: optionalReasonField,
    }).strict(),
});

const getStaffTypeChangeHistorySchema = z.object({
    params: staffProfileIdParam,
    query: paginationQuery.omit({ status: true }).strict(),
});

module.exports = {
    createMyStaffTypeChangeRequestSchema,
    createAdminStaffTypeChangeRequestSchema,
    getMyStaffTypeChangeRequestsSchema,
    getAdminStaffTypeChangeRequestsSchema,
    getStaffTypeChangeImpactSchema,
    staffTypeChangeRequestParamSchema,
    approveStaffTypeChangeRequestSchema,
    rejectStaffTypeChangeRequestSchema,
    cancelStaffTypeChangeRequestSchema,
    getStaffTypeChangeHistorySchema,
};
