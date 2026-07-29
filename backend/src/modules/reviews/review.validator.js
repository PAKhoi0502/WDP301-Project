const { z } = require('zod');

const {
    REVIEW_MODERATION_STATUSES,
    REVIEW_MODERATION_STATUS_VALUES,
    REVIEW_MODERATION_REASONS,
    REVIEW_MODERATION_REASON_VALUES,
    REVIEW_SORT_VALUES,
} = require('../../shared/constants/review.constant');

const emptyToUndefined = (value) => {
    if (typeof value === 'string' && value.trim() === '') {
        return undefined;
    }

    return value;
};

const emptyToNull = (value) => {
    if (typeof value === 'string' && value.trim() === '') {
        return null;
    }

    return value;
};

const objectIdField = z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid resource id');

const optionalObjectIdField = z.preprocess(emptyToUndefined, objectIdField.optional());
const ratingField = z.coerce.number().int().min(1).max(5);
const optionalRatingField = z.preprocess(emptyToUndefined, ratingField.optional());
const optionalBooleanQuery = z.preprocess(
    emptyToUndefined,
    z.enum(['true', 'false']).transform((value) => value === 'true').optional()
);
const dateRangeRule = (data) => !data.from || !data.to || data.from <= data.to;
const atLeastOneField = (data) => Object.values(data).some((value) => value !== undefined);

const idParamSchema = z.object({
    params: z.object({
        id: objectIdField,
    }).strict(),
});

const garageReviewListSchema = z.object({
    params: z.object({
        garageId: objectIdField,
    }).strict(),
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        rating: optionalRatingField,
        has_comment: optionalBooleanQuery,
        sort: z.enum(REVIEW_SORT_VALUES).default('NEWEST'),
    }).strict(),
});

const garageReviewSummarySchema = z.object({
    params: z.object({
        garageId: objectIdField,
    }).strict(),
});

const servicePackageReviewListSchema = z.object({
    params: z.object({
        servicePackageId: objectIdField,
    }).strict(),
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        rating: optionalRatingField,
        has_comment: optionalBooleanQuery,
        sort: z.enum(REVIEW_SORT_VALUES).default('NEWEST'),
    }).strict(),
});

const servicePackageReviewSummarySchema = z.object({
    params: z.object({
        servicePackageId: objectIdField,
    }).strict(),
});

const reviewEligibilitySchema = z.object({
    query: z.object({
        booking_id: objectIdField,
    }).strict(),
});

const createReviewSchema = z.object({
    body: z.object({
        booking_id: objectIdField,
        garage_rating: ratingField,
        service_rating: ratingField,
        comment: z.preprocess(
            emptyToNull,
            z.string().trim().max(2000).nullable().optional()
        ),
        upload_ids: z.array(objectIdField).max(5).default([]),
        is_anonymous: z.boolean().default(false),
    }).strict(),
});

const createGarageReviewSchema = z.object({
    params: z.object({
        garageId: objectIdField,
    }).strict(),
    body: z.object({
        booking_id: objectIdField,
        rating: optionalRatingField,
        garage_rating: optionalRatingField,
        service_rating: optionalRatingField,
        comment: z.preprocess(
            emptyToNull,
            z.string().trim().max(2000).nullable().optional()
        ),
        upload_ids: z.array(objectIdField).max(5).default([]),
        is_anonymous: z.boolean().default(false),
    }).strict().superRefine((data, context) => {
        if (data.garage_rating === undefined && data.rating === undefined) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['garage_rating'],
                message: 'garage_rating or rating is required',
            });
        }

        if (data.service_rating === undefined && data.rating === undefined) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['service_rating'],
                message: 'service_rating or rating is required',
            });
        }
    }).transform((data) => ({
        ...data,
        garage_rating: data.garage_rating ?? data.rating,
        service_rating: data.service_rating ?? data.rating,
    })),
});

const updateReviewSchema = z.object({
    params: z.object({
        id: objectIdField,
    }).strict(),
    body: z.object({
        garage_rating: optionalRatingField,
        service_rating: optionalRatingField,
        comment: z.preprocess(
            emptyToNull,
            z.string().trim().max(2000).nullable().optional()
        ),
        upload_ids: z.array(objectIdField).max(5).optional(),
        is_anonymous: z.boolean().optional(),
    }).strict().refine(atLeastOneField, {
        message: 'At least one field is required',
    }),
});

const getMyReviewsSchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        garage_id: optionalObjectIdField,
        service_package_id: optionalObjectIdField,
        moderation_status: z.enum(REVIEW_MODERATION_STATUS_VALUES).optional(),
    }).strict(),
});

const reviewByBookingSchema = z.object({
    params: z.object({
        bookingId: objectIdField,
    }).strict(),
});

const staffReviewListSchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        service_package_id: optionalObjectIdField,
        garage_rating: optionalRatingField,
        service_rating: optionalRatingField,
        moderation_status: z.enum(REVIEW_MODERATION_STATUS_VALUES).optional(),
        has_reply: optionalBooleanQuery,
        from: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
        to: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    }).strict().refine(dateRangeRule, {
        message: 'from must be before or equal to to',
    }),
});

const replyReviewSchema = z.object({
    params: z.object({
        id: objectIdField,
    }).strict(),
    body: z.object({
        content: z.string().trim().min(2).max(1000),
    }).strict(),
});

const adminReviewListSchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        search: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
        customer_id: optionalObjectIdField,
        booking_id: optionalObjectIdField,
        garage_id: optionalObjectIdField,
        service_package_id: optionalObjectIdField,
        garage_rating: optionalRatingField,
        service_rating: optionalRatingField,
        moderation_status: z.enum(REVIEW_MODERATION_STATUS_VALUES).optional(),
        has_reply: optionalBooleanQuery,
        is_anonymous: optionalBooleanQuery,
        from: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
        to: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    }).strict().refine(dateRangeRule, {
        message: 'from must be before or equal to to',
    }),
});

const moderateReviewSchema = z.object({
    params: z.object({
        id: objectIdField,
    }).strict(),
    body: z.object({
        status: z.enum(REVIEW_MODERATION_STATUS_VALUES),
        reason: z.enum(REVIEW_MODERATION_REASON_VALUES).nullable().optional(),
        note: z.preprocess(
            emptyToNull,
            z.string().trim().max(1000).nullable().optional()
        ),
    }).strict().superRefine((data, context) => {
        if (data.status === REVIEW_MODERATION_STATUSES.HIDDEN && !data.reason) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['reason'],
                message: 'Moderation reason is required when hiding a review',
            });
        }

        if (
            data.status === REVIEW_MODERATION_STATUSES.HIDDEN
            && data.reason === REVIEW_MODERATION_REASONS.OTHER
            && !data.note
        ) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['note'],
                message: 'Moderation note is required for OTHER reason',
            });
        }
    }),
});

const reviewAnalyticsSchema = z.object({
    query: z.object({
        garage_id: optionalObjectIdField,
        service_package_id: optionalObjectIdField,
        moderation_status: z.enum(REVIEW_MODERATION_STATUS_VALUES)
            .default(REVIEW_MODERATION_STATUSES.PUBLISHED),
        from: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
        to: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    }).strict().refine(dateRangeRule, {
        message: 'from must be before or equal to to',
    }),
});

module.exports = {
    idParamSchema,
    garageReviewListSchema,
    garageReviewSummarySchema,
    servicePackageReviewListSchema,
    servicePackageReviewSummarySchema,
    reviewEligibilitySchema,
    createReviewSchema,
    createGarageReviewSchema,
    updateReviewSchema,
    getMyReviewsSchema,
    reviewByBookingSchema,
    staffReviewListSchema,
    replyReviewSchema,
    adminReviewListSchema,
    moderateReviewSchema,
    reviewAnalyticsSchema,
};
