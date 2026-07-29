jest.mock('mongoose', () => {
    const actualMongoose = jest.requireActual('mongoose');

    return {
        ...actualMongoose,
        startSession: jest.fn(),
    };
});

jest.mock('../bookings/booking.model', () => ({
    find: jest.fn(),
    updateMany: jest.fn(),
}));

jest.mock('./washHistory.model', () => ({
    updateMany: jest.fn(),
}));

jest.mock('../promotion-usages/promotionUsage.model', () => ({
    updateMany: jest.fn(),
}));

jest.mock('../notifications/notification.service', () => ({
    createInAppNotification: jest.fn(),
}));

const mongoose = require('mongoose');
const Booking = require('../bookings/booking.model');
const WashHistory = require('./washHistory.model');
const PromotionUsage = require('../promotion-usages/promotionUsage.model');
const notificationService = require('../notifications/notification.service');
const walkInClaimService = require('./walkInClaim.service');

const createBookingQuery = (result) => {
    const query = {
        select: jest.fn(() => query),
        session: jest.fn(() => query),
        lean: jest.fn().mockResolvedValue(result),
    };

    return query;
};

describe('walk-in history claim', () => {
    const customerId = '507f1f77bcf86cd799439011';
    const bookingId = '507f1f77bcf86cd799439012';
    const session = {
        withTransaction: jest.fn(async (callback) => callback()),
        endSession: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mongoose.startSession.mockResolvedValue(session);
        session.withTransaction.mockImplementation(async (callback) => callback());
        Booking.find.mockReturnValue(createBookingQuery([{
            _id: bookingId,
            garage_id: '507f1f77bcf86cd799439013',
            service_package_id: '507f1f77bcf86cd799439014',
        }]));
        Booking.updateMany.mockResolvedValue({ modifiedCount: 1 });
        WashHistory.updateMany.mockResolvedValue({ modifiedCount: 1 });
        PromotionUsage.updateMany.mockResolvedValue({ modifiedCount: 1 });
        notificationService.createInAppNotification.mockResolvedValue(null);
    });

    it('claims paid completed histories without touching loyalty', async () => {
        const result = await walkInClaimService.claimWalkInHistoryForCustomer({
            customerId,
            phone: '0901 234 567',
            phoneVerifiedAt: new Date(),
        });

        expect(Booking.find).toHaveBeenCalledWith(expect.objectContaining({
            is_walk_in: true,
            normalized_guest_phone: '+84901234567',
            status: 'COMPLETED',
            payment_status: {
                $in: ['PAID', 'WAIVED'],
            },
            claimed_customer_id: null,
        }));
        expect(Booking.updateMany).toHaveBeenCalledWith(
            {
                _id: { $in: [bookingId] },
                claimed_customer_id: null,
            },
            {
                $set: {
                    claimed_customer_id: customerId,
                    claimed_at: expect.any(Date),
                },
            },
            { session }
        );
        expect(result).toEqual({
            claimed_bookings: 1,
            claimed_wash_histories: 1,
            linked_promotion_usages: 1,
        });
        expect(notificationService.createInAppNotification).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: customerId,
                type: 'REVIEW_REQUEST',
                relatedType: 'BOOKING',
                relatedId: bookingId,
                session,
            })
        );
    });

    it('requires a verified phone', async () => {
        await expect(
            walkInClaimService.claimWalkInHistoryForCustomer({
                customerId,
                phone: '+84901234567',
                phoneVerifiedAt: null,
            })
        ).rejects.toMatchObject({
            errorCode: 'VERIFIED_PHONE_REQUIRED',
        });

        expect(mongoose.startSession).not.toHaveBeenCalled();
    });
});
