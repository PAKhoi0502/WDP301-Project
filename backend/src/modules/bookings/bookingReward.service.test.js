jest.mock('../service-packages/servicePackage.model', () => ({
    findById: jest.fn(),
}));

jest.mock('../loyalty/loyalty.service', () => ({
    processBookingLoyalty: jest.fn(),
}));

jest.mock('../wash-histories/washHistory.service', () => ({
    createWashHistoryFromBooking: jest.fn(),
}));

jest.mock('../promotion-usages/promotionUsage.service', () => ({
    createPromotionUsageFromBooking: jest.fn(),
}));

jest.mock('../notifications/notification.service', () => ({
    emitPaymentConfirmed: jest.fn(),
    emitRewardEarned: jest.fn(),
}));

jest.mock('../booking-violations/bookingViolation.service', () => ({
    recordCompletedPaidBooking: jest.fn(),
}));

const ServicePackage = require('../service-packages/servicePackage.model');
const loyaltyService = require('../loyalty/loyalty.service');
const washHistoryService = require('../wash-histories/washHistory.service');
const promotionUsageService = require('../promotion-usages/promotionUsage.service');
const notificationService = require('../notifications/notification.service');
const bookingViolationService = require('../booking-violations/bookingViolation.service');
const bookingRewardService = require('./bookingReward.service');

const createQueryMock = (value) => ({
    session: jest.fn().mockReturnThis(),
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
    catch: (reject) => Promise.resolve(value).catch(reject),
});

describe('booking reward service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('records completed booking violation recovery when processing paid booking reward', async () => {
        const session = { id: 'session' };
        const booking = {
            _id: '507f1f77bcf86cd799439011',
            customer_id: '507f1f77bcf86cd799439012',
            service_package_id: '507f1f77bcf86cd799439013',
            earned_points: 0,
            reward_processed: false,
            save: jest.fn().mockResolvedValue(null),
        };
        const servicePackage = {
            _id: booking.service_package_id,
            points_earned: 20,
        };

        ServicePackage.findById.mockReturnValue(createQueryMock(servicePackage));
        loyaltyService.processBookingLoyalty.mockResolvedValue({
            loyalty: { id: 'loyalty-id' },
            point_transaction: { id: 'point-transaction-id' },
            earned_points: 20,
        });
        washHistoryService.createWashHistoryFromBooking.mockResolvedValue({ id: 'wash-history-id' });
        promotionUsageService.createPromotionUsageFromBooking.mockResolvedValue(null);
        notificationService.emitPaymentConfirmed.mockResolvedValue({ id: 'payment-notification-id' });
        notificationService.emitRewardEarned.mockResolvedValue({ id: 'reward-notification-id' });
        bookingViolationService.recordCompletedPaidBooking.mockResolvedValue({ score_change: -1 });

        const result = await bookingRewardService.processCompletedPaidBooking({
            booking,
            actorId: 'staff-id',
            session,
        });

        expect(bookingViolationService.recordCompletedPaidBooking).toHaveBeenCalledWith({
            booking,
            actorId: 'staff-id',
            session,
        });
        expect(booking.reward_processed).toBe(true);
        expect(result).toMatchObject({
            earned_points: 20,
            already_processed: false,
        });
    });

    it('does not record recovery again when reward was already processed', async () => {
        const result = await bookingRewardService.processCompletedPaidBooking({
            booking: {
                reward_processed: true,
                earned_points: 10,
            },
            actorId: 'staff-id',
        });

        expect(bookingViolationService.recordCompletedPaidBooking).not.toHaveBeenCalled();
        expect(result).toMatchObject({
            earned_points: 10,
            already_processed: true,
        });
    });
});
