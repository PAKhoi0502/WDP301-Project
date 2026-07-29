const { z } = require('zod');
const {
    BOOKING_VIOLATION_RISK_STATUS_VALUES,
    BOOKING_VIOLATION_APPEAL_STATUSES,
    BOOKING_VIOLATION_APPEAL_STATUS_VALUES,
} = require('./bookingViolation.constant');

const objectId = z.string().trim().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const pagination = {
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
};

const historySchema = z.object({
    query: z.object(pagination).strict(),
});

const createAppealSchema = z.object({
    body: z.object({
        event_id: objectId,
        reason: z.string().trim().min(10).max(1000),
    }).strict(),
});

const getAppealsSchema = z.object({
    query: z.object({
        ...pagination,
        status: z.enum(BOOKING_VIOLATION_APPEAL_STATUS_VALUES).optional(),
    }).strict(),
});

const listAdminCustomersSchema = z.object({
    query: z.object({
        ...pagination,
        risk_status: z.enum(BOOKING_VIOLATION_RISK_STATUS_VALUES).optional(),
        search: z.string().trim().min(1).max(100).optional(),
    }).strict(),
});

const customerDetailSchema = z.object({
    params: z.object({
        customerId: objectId,
    }).strict(),
    query: z.object(pagination).strict(),
});

const adjustScoreSchema = z.object({
    params: z.object({
        customerId: objectId,
    }).strict(),
    body: z.object({
        score_change: z.coerce.number().int().min(-20).max(20).refine(
            (value) => value !== 0,
            'score_change must not be 0'
        ),
        reason: z.string().trim().min(5).max(1000),
    }).strict(),
});

const reviewAppealSchema = z.object({
    params: z.object({
        appealId: objectId,
    }).strict(),
    body: z.object({
        status: z.enum([
            BOOKING_VIOLATION_APPEAL_STATUSES.APPROVED,
            BOOKING_VIOLATION_APPEAL_STATUSES.REJECTED,
        ]),
        admin_note: z.string().trim().min(5).max(1000),
    }).strict(),
});

module.exports = {
    historySchema,
    createAppealSchema,
    getAppealsSchema,
    listAdminCustomersSchema,
    customerDetailSchema,
    adjustScoreSchema,
    reviewAppealSchema,
};
