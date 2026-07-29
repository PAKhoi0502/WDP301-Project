const { z } = require('zod');

const objectIdField = z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid resource id');

const emptyToNull = (value) => {
    if (value === '' || value === undefined) {
        return null;
    }

    return value;
};

const customerStatusSchema = z.object({
    query: z.object({
        booking_id: objectIdField,
    }).strict(),
});

const updateRuleSchema = z.object({
    body: z.object({
        survey_points: z.coerce.number().int().min(0).max(100).optional(),
        review_points: z.coerce.number().int().min(0).max(100).optional(),
        review_window_days: z.coerce.number().int().min(1).max(365).optional(),
        reminder_after_hours: z.coerce.number().int().min(1).max(720).optional(),
        count_toward_tier: z.boolean().optional(),
        is_active: z.boolean().optional(),
        starts_at: z.preprocess(emptyToNull, z.coerce.date().nullable().optional()),
        ends_at: z.preprocess(emptyToNull, z.coerce.date().nullable().optional()),
    }).strict().refine((body) => Object.keys(body).length > 0, {
        message: 'At least one field is required',
    }).refine(
        (body) => !body.starts_at || !body.ends_at || body.starts_at < body.ends_at,
        {
            path: ['ends_at'],
            message: 'End time must be after start time',
        }
    ),
});

const analyticsSchema = z.object({
    query: z.object({
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
    }).strict().refine(
        (query) => !query.from || !query.to || query.from <= query.to,
        {
            path: ['to'],
            message: 'To date must be after from date',
        }
    ),
});

module.exports = {
    customerStatusSchema,
    updateRuleSchema,
    analyticsSchema,
};
