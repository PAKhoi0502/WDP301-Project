const { z } = require('zod');
const { BOOKING_STATUS_VALUES } = require('../../shared/constants/booking.constant');

const objectId = z.string().trim().regex(/^[0-9a-fA-F]{24}$/, 'Invalid resource id');
const optionalDate = z.preprocess(
    (value) => value === '' ? undefined : value,
    z.coerce.date().optional()
);

const listBookingWorkflowsSchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        garage_id: objectId.optional(),
        status: z.enum(BOOKING_STATUS_VALUES).optional(),
        from: optionalDate,
        to: optionalDate,
    }).strict(),
});

const getBookingWorkflowSchema = z.object({
    params: z.object({
        bookingId: objectId,
    }).strict(),
});

const claimInspectionBookingSchema = z.object({
    params: z.object({
        bookingId: objectId,
    }).strict(),
});

module.exports = {
    listBookingWorkflowsSchema,
    getBookingWorkflowSchema,
    claimInspectionBookingSchema,
};
