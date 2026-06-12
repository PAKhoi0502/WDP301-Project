jest.mock('./promotionUsage.model', () => ({
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    create: jest.fn(),
}));

jest.mock('../promotions/promotion.model', () => ({
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
}));

const PromotionUsage = require('./promotionUsage.model');
const Promotion = require('../promotions/promotion.model');
const promotionUsageService = require('./promotionUsage.service');

const createSessionQuery = (result) => ({
    session: jest.fn().mockReturnValue(Promise.resolve(result)),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
});

describe('promotion usage lifecycle', () => {
    const promotionId = '507f1f77bcf86cd799439011';
    const bookingId = '507f1f77bcf86cd799439012';
    const staffId = '507f1f77bcf86cd799439013';
    const session = {};

    beforeEach(() => {
        jest.clearAllMocks();
        PromotionUsage.findOne.mockReturnValue(createSessionQuery(null));
        Promotion.findOneAndUpdate.mockResolvedValue({ _id: promotionId });
        Promotion.updateOne.mockResolvedValue({ modifiedCount: 1 });
    });

    it('reserves a one-time phone promotion', async () => {
        PromotionUsage.create.mockResolvedValue([
            {
                _id: '507f1f77bcf86cd799439014',
                promotion_id: promotionId,
                booking_id: bookingId,
                guest_phone_normalized: '+84901234567',
                status: 'RESERVED',
            },
        ]);

        const result = await promotionUsageService.reservePromotionUsageForBooking({
            booking: {
                _id: bookingId,
                promotion_id: promotionId,
                promotion_discount_amount: 10000,
            },
            promotion: {
                _id: promotionId,
                usage_limit: 100,
                per_phone_limit: 1,
            },
            guestPhoneNormalized: '+84901234567',
            actorId: staffId,
            session,
        });

        expect(Promotion.findOneAndUpdate).toHaveBeenCalled();
        expect(PromotionUsage.create).toHaveBeenCalledWith(
            [
                expect.objectContaining({
                    phone_usage_key: `${promotionId}:+84901234567`,
                    status: 'RESERVED',
                }),
            ],
            { session }
        );
        expect(result.status).toBe('RESERVED');
    });

    it('consumes an existing reservation once', async () => {
        PromotionUsage.findOneAndUpdate.mockResolvedValue({
            _id: '507f1f77bcf86cd799439014',
            promotion_id: promotionId,
            booking_id: bookingId,
            status: 'CONSUMED',
        });

        const result = await promotionUsageService.createPromotionUsageFromBooking({
            booking: {
                _id: bookingId,
                promotion_id: promotionId,
                paid_at: new Date(),
            },
            actorId: staffId,
            session,
        });

        expect(Promotion.updateOne).toHaveBeenCalledWith(
            { _id: promotionId },
            {
                $inc: {
                    reserved_count: -1,
                    used_count: 1,
                },
            },
            { session }
        );
        expect(result.status).toBe('CONSUMED');
    });

    it('releases a reservation and phone key', async () => {
        PromotionUsage.findOneAndUpdate.mockResolvedValue({
            _id: '507f1f77bcf86cd799439014',
            promotion_id: promotionId,
            booking_id: bookingId,
            status: 'RELEASED',
        });

        const result = await promotionUsageService.releaseReservedPromotionForBooking({
            bookingId,
            session,
        });

        expect(PromotionUsage.findOneAndUpdate).toHaveBeenCalledWith(
            {
                booking_id: bookingId,
                status: 'RESERVED',
            },
            {
                $set: {
                    status: 'RELEASED',
                    released_at: expect.any(Date),
                    phone_usage_key: null,
                },
            },
            {
                new: true,
                session,
            }
        );
        expect(result.status).toBe('RELEASED');
    });
});
