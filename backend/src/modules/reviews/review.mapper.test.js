const mongoose = require('mongoose');

const ReviewMapper = require('./review.mapper');

describe('review mapper', () => {
    it('does not expose customer or upload ownership ids in public reviews', () => {
        const customerId = new mongoose.Types.ObjectId();
        const staffId = new mongoose.Types.ObjectId();
        const uploadId = new mongoose.Types.ObjectId();
        const result = ReviewMapper.toReviewDto(
            {
                _id: new mongoose.Types.ObjectId(),
                booking_id: new mongoose.Types.ObjectId(),
                wash_history_id: new mongoose.Types.ObjectId(),
                customer_id: {
                    _id: customerId,
                    full_name: 'Customer A',
                    avatar_url: 'https://example.com/avatar.jpg',
                },
                garage_id: new mongoose.Types.ObjectId(),
                service_package_id: new mongoose.Types.ObjectId(),
                garage_rating: 5,
                service_rating: 4,
                upload_ids: [
                    {
                        _id: uploadId,
                        url: 'https://example.com/review.jpg',
                        public_id: 'private-cloudinary-id',
                        mime_type: 'image/jpeg',
                        owner_id: customerId,
                    },
                ],
                garage_reply: {
                    content: 'Thank you',
                    replied_by: {
                        _id: staffId,
                        full_name: 'Staff A',
                        role: 'STAFF',
                    },
                    replied_at: new Date(),
                    updated_at: new Date(),
                },
                is_anonymous: false,
                moderation_status: 'PUBLISHED',
            },
            { access: 'public' }
        );

        expect(result.booking_id).toBeUndefined();
        expect(result.customer_id).toBeUndefined();
        expect(result.customer.id).toBeNull();
        expect(result.upload_ids).toBeUndefined();
        expect(result.uploads[0]).toEqual({
            id: uploadId.toString(),
            url: 'https://example.com/review.jpg',
            mime_type: 'image/jpeg',
            width: undefined,
            height: undefined,
        });
        expect(result.garage_reply.replied_by_id).toBeUndefined();
        expect(result.garage_reply.replied_by.id).toBeUndefined();
    });

    it('hides customer identity for anonymous reviews', () => {
        const result = ReviewMapper.toReviewDto(
            {
                _id: new mongoose.Types.ObjectId(),
                customer_id: {
                    _id: new mongoose.Types.ObjectId(),
                    full_name: 'Customer A',
                },
                garage_id: new mongoose.Types.ObjectId(),
                service_package_id: new mongoose.Types.ObjectId(),
                garage_rating: 5,
                service_rating: 5,
                upload_ids: [],
                is_anonymous: true,
            },
            { access: 'public' }
        );

        expect(result.customer).toEqual({
            id: null,
            full_name: 'Anonymous customer',
            avatar_url: null,
        });
    });

    it('maps the legacy rating field to service rating for service lists', () => {
        const result = ReviewMapper.toReviewDto(
            {
                _id: new mongoose.Types.ObjectId(),
                customer_id: null,
                garage_id: new mongoose.Types.ObjectId(),
                service_package_id: new mongoose.Types.ObjectId(),
                garage_rating: 3,
                service_rating: 5,
                upload_ids: [],
                is_anonymous: false,
            },
            {
                access: 'public',
                legacyRatingField: 'service_rating',
            }
        );

        expect(result.rating).toBe(5);
    });
});
