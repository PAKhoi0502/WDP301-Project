const {
    createReviewSchema,
    createGarageReviewSchema,
    updateReviewSchema,
    garageReviewListSchema,
    moderateReviewSchema,
} = require('./review.validator');

const objectId = '507f1f77bcf86cd799439011';

describe('review validators', () => {
    it('accepts separate garage and service ratings', () => {
        const result = createReviewSchema.parse({
            body: {
                booking_id: objectId,
                garage_rating: 5,
                service_rating: 4,
                comment: 'Good service',
            },
        });

        expect(result.body).toMatchObject({
            garage_rating: 5,
            service_rating: 4,
            upload_ids: [],
            is_anonymous: false,
        });
    });

    it('rejects an out-of-range rating', () => {
        const result = createReviewSchema.safeParse({
            body: {
                booking_id: objectId,
                garage_rating: 6,
                service_rating: 4,
            },
        });

        expect(result.success).toBe(false);
    });

    it('maps the legacy nested garage rating to both review dimensions', () => {
        const result = createGarageReviewSchema.parse({
            params: {
                garageId: objectId,
            },
            body: {
                booking_id: objectId,
                rating: 5,
            },
        });

        expect(result.body).toMatchObject({
            garage_rating: 5,
            service_rating: 5,
        });
    });

    it('requires at least one update field', () => {
        const result = updateReviewSchema.safeParse({
            params: { id: objectId },
            body: {},
        });

        expect(result.success).toBe(false);
    });

    it('parses public boolean filters without treating false as true', () => {
        const result = garageReviewListSchema.parse({
            params: { garageId: objectId },
            query: {
                has_comment: 'false',
            },
        });

        expect(result.query.has_comment).toBe(false);
    });

    it('requires a note when OTHER is the hiding reason', () => {
        const result = moderateReviewSchema.safeParse({
            params: { id: objectId },
            body: {
                status: 'HIDDEN',
                reason: 'OTHER',
            },
        });

        expect(result.success).toBe(false);
    });
});
