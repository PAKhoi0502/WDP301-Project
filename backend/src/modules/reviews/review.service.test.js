const mongoose = require('mongoose');

jest.mock('./review.model', () => ({
    findOne: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    exists: jest.fn(),
    create: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
}));

jest.mock('../bookings/booking.model', () => ({
    findOne: jest.fn(),
}));

jest.mock('../wash-histories/washHistory.model', () => ({
    findOne: jest.fn(),
}));

jest.mock('../garages/garage.model', () => ({
    findById: jest.fn(),
    exists: jest.fn(),
}));

jest.mock('../service-packages/servicePackage.model', () => ({
    findById: jest.fn(),
    exists: jest.fn(),
}));

jest.mock('../uploads/upload.model', () => ({
    find: jest.fn(),
    updateMany: jest.fn(),
}));

jest.mock('../audit-logs/auditLog.service', () => ({
    recordAuditEvent: jest.fn(),
}));

jest.mock('../notifications/notification.service', () => ({
    createInAppNotification: jest.fn(),
}));

jest.mock('./reviewSummary.service', () => ({
    getGarageSummary: jest.fn(),
    getServicePackageSummary: jest.fn(),
}));

jest.mock('../feedback-rewards/feedbackReward.service', () => ({
    assertReviewWindowOpen: jest.fn(),
    awardFeedbackReward: jest.fn(),
}));

const Review = require('./review.model');
const Booking = require('../bookings/booking.model');
const WashHistory = require('../wash-histories/washHistory.model');
const Garage = require('../garages/garage.model');
const ServicePackage = require('../service-packages/servicePackage.model');
const Upload = require('../uploads/upload.model');
const auditLogService = require('../audit-logs/auditLog.service');
const feedbackRewardService = require('../feedback-rewards/feedbackReward.service');
const reviewService = require('./review.service');

const createQuery = (value) => {
    const query = {
        populate: jest.fn(() => query),
        session: jest.fn(() => query),
        sort: jest.fn(() => query),
        skip: jest.fn(() => query),
        limit: jest.fn(() => query),
        then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
        catch: (reject) => Promise.resolve(value).catch(reject),
    };

    return query;
};

describe('review service', () => {
    const customerId = new mongoose.Types.ObjectId();
    const bookingId = new mongoose.Types.ObjectId();
    const washHistoryId = new mongoose.Types.ObjectId();
    const garageId = new mongoose.Types.ObjectId();
    const servicePackageId = new mongoose.Types.ObjectId();
    const reviewId = new mongoose.Types.ObjectId();
    const session = {
        withTransaction: jest.fn(async (callback) => callback()),
        endSession: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        session.withTransaction.mockImplementation(async (callback) => callback());
        mongoose.startSession = jest.fn().mockResolvedValue(session);
        auditLogService.recordAuditEvent.mockResolvedValue(null);
        Upload.find.mockReturnValue(createQuery([]));
        Upload.updateMany.mockResolvedValue({ modifiedCount: 0 });
        feedbackRewardService.assertReviewWindowOpen.mockResolvedValue({
            deadline: new Date('2999-01-01T00:00:00.000Z'),
            reward_points: 50,
        });
        feedbackRewardService.awardFeedbackReward.mockResolvedValue({
            awarded: false,
            points: 0,
            point_transaction: null,
            rule: null,
        });
    });

    it('allows a completed waived booking with wash history to be reviewed', async () => {
        Booking.findOne.mockReturnValue(createQuery({
            _id: bookingId,
            status: 'COMPLETED',
            payment_status: 'WAIVED',
        }));
        Review.findOne.mockReturnValue(createQuery(null));
        WashHistory.findOne.mockReturnValue(createQuery({
            _id: washHistoryId,
            garage_id: garageId,
            service_package_id: servicePackageId,
        }));

        const result = await reviewService.getReviewEligibility(
            customerId,
            bookingId
        );

        expect(result).toMatchObject({
            eligible: true,
            reason_code: null,
            context: {
                booking_id: bookingId.toString(),
                wash_history_id: washHistoryId.toString(),
                garage_id: garageId.toString(),
                service_package_id: servicePackageId.toString(),
            },
        });
    });

    it('reports an existing review instead of allowing a duplicate', async () => {
        Booking.findOne.mockReturnValue(createQuery({
            _id: bookingId,
            status: 'COMPLETED',
            payment_status: 'PAID',
        }));
        Review.findOne.mockReturnValue(createQuery({
            _id: reviewId,
            booking_id: bookingId,
            customer_id: customerId,
            garage_id: garageId,
            service_package_id: servicePackageId,
            garage_rating: 5,
            service_rating: 5,
            upload_ids: [],
            moderation_status: 'PUBLISHED',
            is_anonymous: false,
        }));

        const result = await reviewService.getReviewEligibility(
            customerId,
            bookingId
        );

        expect(result).toMatchObject({
            eligible: false,
            reason_code: 'REVIEW_ALREADY_EXISTS',
        });
        expect(WashHistory.findOne).not.toHaveBeenCalled();
    });

    it('derives garage and service package ids from wash history on creation', async () => {
        const booking = {
            _id: bookingId,
            status: 'COMPLETED',
            payment_status: 'PAID',
        };
        const washHistory = {
            _id: washHistoryId,
            garage_id: garageId,
            service_package_id: servicePackageId,
        };
        const review = {
            _id: reviewId,
            booking_id: bookingId,
            wash_history_id: washHistoryId,
            customer_id: customerId,
            garage_id: garageId,
            service_package_id: servicePackageId,
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
            comment: 'Good',
            upload_ids: [],
            is_anonymous: false,
            moderation_status: 'PUBLISHED',
        };

        Booking.findOne.mockReturnValue(createQuery(booking));
        WashHistory.findOne.mockReturnValue(createQuery(washHistory));
        Garage.findById.mockReturnValue(createQuery({
            _id: garageId,
            name: 'Garage A',
            garage_code: 'GAR_A',
        }));
        ServicePackage.findById.mockReturnValue(createQuery({
            _id: servicePackageId,
            name: 'Premium wash',
            service_code: 'PREMIUM_WASH',
        }));
        Review.exists.mockReturnValue(createQuery(null));
        Review.create.mockResolvedValue([review]);
        Review.findById.mockReturnValue(createQuery(review));

        const result = await reviewService.createReview(
            { _id: customerId },
            {
                booking_id: bookingId.toString(),
                garage_rating: 5,
                service_rating: 4,
                comment: 'Good',
                upload_ids: [],
            }
        );

        expect(Review.create).toHaveBeenCalledWith(
            [
                expect.objectContaining({
                    booking_id: bookingId,
                    wash_history_id: washHistoryId,
                    garage_id: garageId,
                    service_package_id: servicePackageId,
                    garage_rating: 5,
                    service_rating: 4,
                }),
            ],
            { session }
        );
        expect(result).toMatchObject({
            garage_id: garageId.toString(),
            service_package_id: servicePackageId.toString(),
            garage_rating: 5,
            service_rating: 4,
        });
        expect(auditLogService.recordAuditEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'REVIEW_CREATED',
                resourceType: 'REVIEW',
                session,
            })
        );
    });

    it('rejects a nested garage endpoint when the booking belongs to another garage', async () => {
        Booking.findOne.mockReturnValue(createQuery({
            _id: bookingId,
            status: 'COMPLETED',
            payment_status: 'PAID',
        }));
        WashHistory.findOne.mockReturnValue(createQuery({
            _id: washHistoryId,
            garage_id: garageId,
            service_package_id: servicePackageId,
        }));
        Garage.findById.mockReturnValue(createQuery({
            _id: garageId,
            name: 'Garage A',
        }));
        ServicePackage.findById.mockReturnValue(createQuery({
            _id: servicePackageId,
            name: 'Premium wash',
        }));

        await expect(reviewService.createReview(
            { _id: customerId },
            {
                booking_id: bookingId.toString(),
                garage_rating: 5,
                service_rating: 5,
                upload_ids: [],
            },
            {},
            new mongoose.Types.ObjectId().toString()
        )).rejects.toMatchObject({
            errorCode: 'REVIEW_GARAGE_MISMATCH',
        });
        expect(Review.exists).not.toHaveBeenCalled();
    });

    it('always scopes staff review lists to the assigned garage', async () => {
        Review.find.mockReturnValue(createQuery([]));
        Review.countDocuments.mockResolvedValue(0);

        await reviewService.getStaffReviews(
            {
                garage_id: garageId.toString(),
            },
            {
                page: 1,
                limit: 20,
            }
        );

        expect(Review.find).toHaveBeenCalledWith(
            expect.objectContaining({
                garage_id: garageId.toString(),
                deleted_at: null,
            })
        );
    });
});
