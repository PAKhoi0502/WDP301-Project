jest.mock('mongoose', () => {
    const actualMongoose = jest.requireActual('mongoose');

    return {
        ...actualMongoose,
        startSession: jest.fn(),
    };
});

jest.mock('../bookings/booking.model', () => ({
    find: jest.fn(),
    updateOne: jest.fn(),
}));

jest.mock('./washHistory.model', () => ({
    updateOne: jest.fn(),
    findOne: jest.fn(),
}));

jest.mock('../promotion-usages/promotionUsage.model', () => ({
    updateMany: jest.fn(),
}));

jest.mock('../customer-vouchers/customerVoucher.model', () => ({
    updateMany: jest.fn(),
}));

jest.mock('../service-packages/servicePackage.model', () => ({
    find: jest.fn(),
}));

jest.mock('../loyalty/loyalty.service', () => ({
    processBookingLoyalty: jest.fn(),
}));

jest.mock('./washHistory.service', () => ({
    createWashHistoryFromBooking: jest.fn(),
}));

jest.mock('../notifications/notification.service', () => ({
    emitRewardEarned: jest.fn(),
    emitReviewRequest: jest.fn(),
}));

const mongoose = require('mongoose');
const Booking = require('../bookings/booking.model');
const WashHistory = require('./washHistory.model');
const PromotionUsage = require('../promotion-usages/promotionUsage.model');
const CustomerVoucher = require('../customer-vouchers/customerVoucher.model');
const ServicePackage = require('../service-packages/servicePackage.model');
const loyaltyService = require('../loyalty/loyalty.service');
const washHistoryService = require('./washHistory.service');
const notificationService = require('../notifications/notification.service');
const walkInClaimService = require('./walkInClaim.service');

const createBookingQuery = (result) => {
    return {
        session: jest.fn().mockResolvedValue(result),
    };
};

const createServicePackageQuery = (result) => ({
    session: jest.fn().mockResolvedValue(result),
});

const createWashHistoryQuery = (result) => ({
    session: jest.fn().mockResolvedValue(result),
});

describe('walk-in account claim', () => {
    const customerId = '507f1f77bcf86cd799439011';
    const bookingId = '507f1f77bcf86cd799439012';
    const servicePackageId = '507f1f77bcf86cd799439013';
    const addOnId = '507f1f77bcf86cd799439014';
    const paidAt = new Date('2026-07-01T08:00:00.000Z');
    const session = {
        withTransaction: jest.fn(async (callback) => callback()),
        endSession: jest.fn(),
    };
    const booking = {
        _id: bookingId,
        garage_id: '507f1f77bcf86cd799439015',
        service_package_id: servicePackageId,
        add_on_service_ids: [addOnId],
        customer_id: null,
        claimed_customer_id: null,
        claimed_at: null,
        is_walk_in: true,
        status: 'COMPLETED',
        payment_status: 'PAID',
        paid_at: paidAt,
        completed_at: paidAt,
        original_price: 200000,
        final_price: 150000,
        toObject: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        booking.toObject.mockReturnValue({
            ...booking,
            toObject: undefined,
        });
        mongoose.startSession.mockResolvedValue(session);
        session.withTransaction.mockImplementation(async (callback) => callback());
        Booking.find.mockReturnValue(createBookingQuery([booking]));
        Booking.updateOne.mockResolvedValue({ modifiedCount: 1 });
        ServicePackage.find.mockReturnValue(createServicePackageQuery([
            { _id: servicePackageId, points_earned: 20 },
            { _id: addOnId, points_earned: 10 },
        ]));
        WashHistory.updateOne.mockResolvedValue({
            matchedCount: 1,
            modifiedCount: 1,
        });
        WashHistory.findOne.mockReturnValue(createWashHistoryQuery(null));
        PromotionUsage.updateMany.mockResolvedValue({ modifiedCount: 1 });
        CustomerVoucher.updateMany.mockResolvedValue({ modifiedCount: 1 });
        loyaltyService.processBookingLoyalty.mockResolvedValue({
            loyalty: { current_tier: 'SILVER' },
            earned_points: 25,
            total_spent_added: 150000,
            total_visits_added: 1,
            already_processed: false,
        });
        washHistoryService.createWashHistoryFromBooking.mockResolvedValue({});
        notificationService.emitRewardEarned.mockResolvedValue(null);
        notificationService.emitReviewRequest.mockResolvedValue(null);
    });

    it('claims settled history and awards loyalty exactly once', async () => {
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
            loyalty_claimed_at: null,
            $and: expect.arrayContaining([
                {
                    $or: [
                        { claimed_customer_id: null },
                        { claimed_customer_id: customerId },
                    ],
                },
                {
                    $or: [
                        { paid_at: { $gte: expect.any(Date) } },
                        {
                            payment_status: 'WAIVED',
                            payment_waived_at: { $gte: expect.any(Date) },
                        },
                    ],
                },
            ]),
        }));
        expect(loyaltyService.processBookingLoyalty).toHaveBeenCalledWith({
            booking,
            servicePackage: expect.objectContaining({ _id: servicePackageId }),
            addOnServices: [
                expect.objectContaining({ _id: addOnId }),
            ],
            actorId: customerId,
            customerId,
            visitAt: paidAt,
            session,
        });
        expect(Booking.updateOne).toHaveBeenCalledWith(
            expect.objectContaining({
                _id: bookingId,
                normalized_guest_phone: '+84901234567',
                loyalty_claimed_at: null,
            }),
            {
                $set: {
                    claimed_customer_id: customerId,
                    claimed_at: expect.any(Date),
                    loyalty_claimed_at: expect.any(Date),
                    earned_points: 25,
                },
            },
            { session }
        );
        expect(WashHistory.updateOne).toHaveBeenCalledWith(
            expect.objectContaining({ booking_id: bookingId }),
            {
                $set: {
                    customer_id: customerId,
                    points_earned: 25,
                },
            },
            { session }
        );
        expect(notificationService.emitRewardEarned).toHaveBeenCalledWith(
            expect.objectContaining({
                earnedPoints: 25,
                session,
            })
        );
        expect(result).toEqual({
            claimed_bookings: 1,
            claimed_wash_histories: 1,
            linked_promotion_usages: 1,
            claimed_customer_vouchers: 1,
            loyalty_bookings_processed: 1,
            awarded_points: 25,
            total_spent_added: 150000,
            total_visits_added: 1,
            current_tier: 'SILVER',
        });
    });

    it('claims phone-bound vouchers even when there is no eligible wash history', async () => {
        Booking.find.mockReturnValue(createBookingQuery([]));
        CustomerVoucher.updateMany.mockResolvedValue({ modifiedCount: 2 });

        const result = await walkInClaimService.claimWalkInHistoryForCustomer({
            customerId,
            phone: '0901 234 567',
            phoneVerifiedAt: new Date(),
        });

        expect(CustomerVoucher.updateMany).toHaveBeenCalledWith(
            {
                customer_id: null,
                normalized_guest_phone: '+84901234567',
            },
            {
                $set: {
                    customer_id: customerId,
                },
                $unset: {
                    guest_phone: '',
                    normalized_guest_phone: '',
                },
            },
            { session }
        );
        expect(result.claimed_bookings).toBe(0);
        expect(result.claimed_customer_vouchers).toBe(2);
    });

    it('creates a missing wash history for an eligible legacy booking', async () => {
        WashHistory.updateOne.mockResolvedValue({
            matchedCount: 0,
            modifiedCount: 0,
        });

        const result = await walkInClaimService.claimWalkInHistoryForCustomer({
            customerId,
            phone: '+84901234567',
            phoneVerifiedAt: new Date(),
        });

        expect(washHistoryService.createWashHistoryFromBooking).toHaveBeenCalledWith({
            booking: expect.objectContaining({
                _id: bookingId,
                claimed_customer_id: customerId,
                earned_points: 25,
            }),
            earnedPoints: 25,
            session,
        });
        expect(result.claimed_wash_histories).toBe(1);
    });

    it('rejects a wash history already linked to another customer', async () => {
        WashHistory.updateOne.mockResolvedValue({
            matchedCount: 0,
            modifiedCount: 0,
        });
        WashHistory.findOne.mockReturnValue(createWashHistoryQuery({
            _id: '507f1f77bcf86cd799439099',
            customer_id: '507f1f77bcf86cd799439098',
        }));

        await expect(
            walkInClaimService.claimWalkInHistoryForCustomer({
                customerId,
                phone: '+84901234567',
                phoneVerifiedAt: new Date(),
            })
        ).rejects.toMatchObject({
            errorCode: 'WALK_IN_WASH_HISTORY_CUSTOMER_CONFLICT',
        });

        expect(washHistoryService.createWashHistoryFromBooking).not.toHaveBeenCalled();
    });

    it('does not award points again when an earn transaction already exists', async () => {
        loyaltyService.processBookingLoyalty.mockResolvedValue({
            loyalty: { current_tier: 'BRONZE' },
            earned_points: 25,
            total_spent_added: 0,
            total_visits_added: 0,
            already_processed: true,
        });

        const result = await walkInClaimService.claimWalkInHistoryForCustomer({
            customerId,
            phone: '+84901234567',
            phoneVerifiedAt: new Date(),
        });

        expect(result.awarded_points).toBe(0);
        expect(result.total_spent_added).toBe(0);
        expect(result.total_visits_added).toBe(0);
        expect(notificationService.emitRewardEarned).toHaveBeenCalledWith(
            expect.objectContaining({ earnedPoints: 0 })
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
