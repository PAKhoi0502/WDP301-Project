const mongoose = require('mongoose');

const Review = require('./review.model');

const createReview = (overrides = {}) => new Review({
    booking_id: new mongoose.Types.ObjectId(),
    wash_history_id: new mongoose.Types.ObjectId(),
    customer_id: new mongoose.Types.ObjectId(),
    garage_id: new mongoose.Types.ObjectId(),
    service_package_id: new mongoose.Types.ObjectId(),
    garage_snapshot: {
        name: 'Garage A',
        garage_code: 'GAR_A',
    },
    service_package_snapshot: {
        name: 'Premium wash',
        service_code: 'PREMIUM_WASH',
    },
    garage_rating: 5,
    service_rating: 4,
    ...overrides,
});

describe('review model', () => {
    it('accepts a verified booking review with separate garage and service ratings', async () => {
        const review = createReview();

        await expect(review.validate()).resolves.toBeUndefined();
        expect(review.moderation_status).toBe('PUBLISHED');
        expect(review.is_anonymous).toBe(false);
    });

    it('rejects a hidden review without a moderation reason', async () => {
        const review = createReview({
            moderation_status: 'HIDDEN',
            moderation_reason: null,
        });

        await expect(review.validate()).rejects.toMatchObject({
            errors: {
                moderation_reason: expect.anything(),
            },
        });
    });

    it('rejects duplicate upload ids', async () => {
        const uploadId = new mongoose.Types.ObjectId();
        const review = createReview({
            upload_ids: [uploadId, uploadId],
        });

        await expect(review.validate()).rejects.toMatchObject({
            errors: {
                upload_ids: expect.anything(),
            },
        });
    });

    it('requires a deleting actor for soft deletion', async () => {
        const review = createReview({
            deleted_at: new Date(),
            deleted_by: null,
        });

        await expect(review.validate()).rejects.toMatchObject({
            errors: {
                deleted_by: expect.anything(),
            },
        });
    });
});
