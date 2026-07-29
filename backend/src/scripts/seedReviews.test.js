const mongoose = require('mongoose');

const Review = require('../modules/reviews/review.model');
const { buildReviewDefinitions } = require('./seedReviews');

describe('review seed definitions', () => {
    it('builds valid deterministic reviews from completed booking history', async () => {
        const bookingId = new mongoose.Types.ObjectId();
        const historyId = new mongoose.Types.ObjectId();
        const customerId = new mongoose.Types.ObjectId();
        const garageId = new mongoose.Types.ObjectId();
        const servicePackageId = new mongoose.Types.ObjectId();
        const adminId = new mongoose.Types.ObjectId();
        const staffUserId = new mongoose.Types.ObjectId();
        const completedAt = new Date('2026-07-01T08:00:00.000Z');
        const input = {
            bookings: [
                {
                    _id: bookingId,
                    completed_at: completedAt,
                },
            ],
            washHistories: [
                {
                    _id: historyId,
                    booking_id: bookingId,
                    customer_id: customerId,
                    garage_id: garageId,
                    service_package_id: servicePackageId,
                    service_completed_at: completedAt,
                },
            ],
            garages: [
                {
                    _id: garageId,
                    name: 'Garage A',
                    garage_code: 'GAR_A',
                },
            ],
            servicePackages: [
                {
                    _id: servicePackageId,
                    name: 'Premium wash',
                    service_code: 'PREMIUM_WASH',
                },
            ],
            admin: {
                _id: adminId,
            },
            customerServiceStaff: [
                {
                    user_id: staffUserId,
                    garage_id: garageId,
                },
            ],
        };

        const first = buildReviewDefinitions(input);
        const second = buildReviewDefinitions(input);

        expect(first).toHaveLength(1);
        expect(first[0]._id.toString()).toBe(second[0]._id.toString());
        expect(first[0]).toMatchObject({
            booking_id: bookingId,
            wash_history_id: historyId,
            customer_id: customerId,
            garage_id: garageId,
            service_package_id: servicePackageId,
            garage_rating: 5,
            service_rating: 5,
            moderation_status: 'PUBLISHED',
            garage_reply: {
                replied_by: staffUserId,
            },
        });

        await expect(new Review(first[0]).validate()).resolves.toBeUndefined();
    });
});
