const mongoose = require('mongoose');

const createQueryMock = (value) => {
    const query = {
        sort: jest.fn(() => query),
        skip: jest.fn(() => query),
        limit: jest.fn(() => query),
        populate: jest.fn(() => query),
        select: jest.fn(() => query),
        session: jest.fn(() => query),
        then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
        catch: (reject) => Promise.resolve(value).catch(reject),
    };

    return query;
};

jest.mock('../users/user.model', () => ({
    findOne: jest.fn(),
    find: jest.fn(),
}));

jest.mock('./customerLoyalty.model', () => ({
    findOne: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    findOneAndUpdate: jest.fn(),
}));

jest.mock('./pointTransaction.model', () => ({
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
    updateMany: jest.fn(),
}));

jest.mock('./tierRule.model', () => ({
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
}));

jest.mock('./loyaltyRedeemRule.model', () => ({
    findOne: jest.fn(),
}));

jest.mock('../service-packages/servicePackage.model', () => ({
    findById: jest.fn(),
}));

jest.mock('../promotions/promotion.model', () => ({
    findById: jest.fn(),
    findOne: jest.fn(),
}));

jest.mock('../promotion-usages/promotionUsage.model', () => ({
    countDocuments: jest.fn(),
}));

const CustomerLoyalty = require('./customerLoyalty.model');
const PointTransaction = require('./pointTransaction.model');
const TierRule = require('./tierRule.model');
const LoyaltyRedeemRule = require('./loyaltyRedeemRule.model');
const ServicePackage = require('../service-packages/servicePackage.model');
const Promotion = require('../promotions/promotion.model');
const PromotionUsage = require('../promotion-usages/promotionUsage.model');
const loyaltyService = require('./loyalty.service');

const createLoyaltyDocument = (overrides = {}) => ({
    _id: new mongoose.Types.ObjectId(),
    customer_id: new mongoose.Types.ObjectId(),
    current_tier: 'BRONZE',
    total_points: 0,
    available_points: 0,
    redeemed_points: 0,
    expired_points: 0,
    total_spent: 0,
    total_visits: 0,
    last_visit_at: null,
    last_tier_review_at: null,
    last_tier_downgrade_at: null,
    tier_recovery_started_at: null,
    last_point_expiry_check_at: null,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
    save: jest.fn().mockResolvedValue(null),
    ...overrides,
});

describe('loyalty service business rules', () => {
    const customerId = new mongoose.Types.ObjectId();
    const bookingId = new mongoose.Types.ObjectId();
    const servicePackageId = new mongoose.Types.ObjectId();

    beforeEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
        PointTransaction.findOne.mockReturnValue(
            createQueryMock(null)
        );
    });

    it('earns points from the main package and add-ons, updates totals, and reviews tier', async () => {
        const loyalty = createLoyaltyDocument({
            customer_id: customerId,
            current_tier: 'SILVER',
            total_points: 90,
            available_points: 10,
            total_spent: 900000,
            total_visits: 4,
            last_tier_downgrade_at: new Date('2026-01-01T00:00:00.000Z'),
        });
        const pointTransaction = {
            _id: new mongoose.Types.ObjectId(),
            customer_id: customerId,
            booking_id: bookingId,
            type: 'EARN',
            points: 45,
            remaining_points: 45,
            balance_before: 10,
            balance_after: 55,
        };

        CustomerLoyalty.findOne.mockReturnValue(createQueryMock(loyalty));
        TierRule.findOne.mockReturnValue(createQueryMock({
            tier_name: 'SILVER',
            point_multiplier: 1.5,
        }));
        TierRule.find.mockReturnValue(createQueryMock([
            {
                tier_name: 'PLATINUM',
                priority_level: 4,
                min_total_spent: 5000000,
                min_total_visits: 20,
                min_total_points: 1000,
            },
            {
                tier_name: 'GOLD',
                priority_level: 3,
                min_total_spent: 1000000,
                min_total_visits: 5,
                min_total_points: 100,
            },
            {
                tier_name: 'BRONZE',
                priority_level: 1,
                min_total_spent: 0,
                min_total_visits: 0,
                min_total_points: 0,
            },
        ]));
        PointTransaction.create.mockResolvedValue([pointTransaction]);

        const result = await loyaltyService.processBookingLoyalty({
            booking: {
                _id: bookingId,
                customer_id: customerId,
                original_price: 200000,
                final_price: 100000,
            },
            servicePackage: {
                points_earned: 40,
            },
            addOnServices: [
                { points_earned: 8 },
                { points_earned: 12 },
            ],
            actorId: new mongoose.Types.ObjectId(),
        });

        expect(PointTransaction.create).toHaveBeenCalledWith(
            [
                expect.objectContaining({
                    customer_id: customerId,
                    booking_id: bookingId,
                    type: 'EARN',
                    points: 45,
                    remaining_points: 45,
                    balance_before: 10,
                    balance_after: 55,
                }),
            ],
            undefined
        );
        expect(loyalty.total_spent).toBe(1000000);
        expect(loyalty.total_visits).toBe(5);
        expect(loyalty.total_points).toBe(135);
        expect(loyalty.available_points).toBe(55);
        expect(loyalty.last_tier_downgrade_at).toBeNull();
        expect(loyalty.current_tier).toBe('GOLD');
        expect(loyalty.save).toHaveBeenCalledTimes(1);
        expect(result).toMatchObject({
            earned_points: 45,
            tier_review: {
                previous_tier: 'SILVER',
                current_tier: 'GOLD',
                tier_changed: true,
            },
        });
    });

    it('awards loyalty to the verified claimant of a walk-in booking', async () => {
        const loyalty = createLoyaltyDocument({
            customer_id: customerId,
            current_tier: 'BRONZE',
            total_points: 0,
            available_points: 0,
            total_spent: 0,
            total_visits: 0,
            last_visit_at: null,
        });
        const visitAt = new Date('2026-06-10T08:00:00.000Z');

        CustomerLoyalty.findOne.mockReturnValue(createQueryMock(loyalty));
        TierRule.findOne.mockReturnValue(createQueryMock({
            tier_name: 'BRONZE',
            point_multiplier: 1,
        }));
        TierRule.find.mockReturnValue(createQueryMock([
            {
                tier_name: 'BRONZE',
                priority_level: 1,
                min_total_spent: 0,
                min_total_visits: 0,
                min_total_points: 0,
            },
        ]));
        PointTransaction.create.mockResolvedValue([{
            _id: new mongoose.Types.ObjectId(),
            customer_id: customerId,
            booking_id: bookingId,
            type: 'EARN',
            points: 20,
            remaining_points: 20,
            balance_before: 0,
            balance_after: 20,
        }]);

        const result = await loyaltyService.processBookingLoyalty({
            booking: {
                _id: bookingId,
                customer_id: null,
                claimed_customer_id: customerId,
                original_price: 100000,
                final_price: 100000,
            },
            servicePackage: {
                points_earned: 20,
            },
            customerId,
            visitAt,
        });

        expect(PointTransaction.create).toHaveBeenCalledWith(
            [
                expect.objectContaining({
                    customer_id: customerId,
                    booking_id: bookingId,
                    type: 'EARN',
                    points: 20,
                }),
            ],
            undefined
        );
        expect(loyalty.total_points).toBe(20);
        expect(loyalty.available_points).toBe(20);
        expect(loyalty.total_spent).toBe(100000);
        expect(loyalty.total_visits).toBe(1);
        expect(loyalty.last_visit_at).toEqual(visitAt);
        expect(result).toMatchObject({
            earned_points: 20,
            total_spent_added: 100000,
            total_visits_added: 1,
            already_processed: false,
        });
    });

    it('reuses an existing earn transaction without updating loyalty twice', async () => {
        const loyalty = createLoyaltyDocument({
            customer_id: customerId,
            total_points: 45,
            available_points: 45,
            total_spent: 100000,
            total_visits: 1,
        });
        const pointTransaction = {
            _id: new mongoose.Types.ObjectId(),
            customer_id: customerId,
            booking_id: bookingId,
            type: 'EARN',
            points: 45,
            remaining_points: 45,
            balance_before: 0,
            balance_after: 45,
        };

        PointTransaction.findOne.mockReturnValue(
            createQueryMock(pointTransaction)
        );
        CustomerLoyalty.findOne.mockReturnValue(
            createQueryMock(loyalty)
        );

        const result = await loyaltyService.processBookingLoyalty({
            booking: {
                _id: bookingId,
                customer_id: customerId,
                original_price: 100000,
                final_price: 100000,
            },
            servicePackage: {
                points_earned: 45,
            },
        });

        expect(PointTransaction.create).not.toHaveBeenCalled();
        expect(loyalty.save).not.toHaveBeenCalled();
        expect(result).toMatchObject({
            earned_points: 45,
            already_processed: true,
            tier_review: null,
        });
    });

    it('calculates redeem preview with promotion and redeem rule', async () => {
        const promotionId = new mongoose.Types.ObjectId();
        const loyalty = createLoyaltyDocument({
            customer_id: customerId,
            current_tier: 'GOLD',
            available_points: 100,
        });

        ServicePackage.findById.mockResolvedValue({
            _id: servicePackageId,
            vehicle_type: 'CAR',
            base_price: 200000,
            is_active: true,
        });
        CustomerLoyalty.findOne.mockReturnValue(createQueryMock(loyalty));
        LoyaltyRedeemRule.findOne.mockReturnValue(createQueryMock({
            _id: new mongoose.Types.ObjectId(),
            point_value_amount: 1000,
            min_redeem_points: 1,
            redeem_step: 1,
            max_redeem_percent: 50,
            is_active: true,
        }));
        Promotion.findOne.mockResolvedValue({
            _id: promotionId,
            code: 'GOLD10',
            discount_type: 'PERCENTAGE',
            discount_value: 10,
            max_discount_amount: null,
            min_order_amount: 100000,
            applicable_tiers: ['GOLD'],
            applicable_vehicle_types: ['CAR'],
            applicable_service_package_ids: [servicePackageId],
            start_at: new Date('2026-01-01T00:00:00.000Z'),
            end_at: new Date('2099-01-01T00:00:00.000Z'),
            usage_limit: null,
            per_customer_limit: null,
            used_count: 0,
            is_active: true,
        });
        PromotionUsage.countDocuments.mockResolvedValue(0);

        const result = await loyaltyService.calculateRedeemPreview(customerId, {
            service_package_id: servicePackageId,
            promotion_code: ' gold10 ',
            used_points: 50,
        });

        expect(result).toMatchObject({
            service_package_id: servicePackageId.toString(),
            promotion_id: promotionId.toString(),
            promotion_code: 'GOLD10',
            original_price: 200000,
            promotion_discount_amount: 20000,
            price_after_promotion: 180000,
            available_points: 100,
            used_points: 50,
            points_discount_amount: 50000,
            discount_amount: 70000,
            final_price: 130000,
        });
    });

    it('allows redeeming a single point with the active rule', async () => {
        const loyalty = createLoyaltyDocument({
            customer_id: customerId,
            available_points: 1,
        });

        CustomerLoyalty.findOne.mockReturnValue(createQueryMock(loyalty));
        LoyaltyRedeemRule.findOne.mockReturnValue(createQueryMock({
            _id: new mongoose.Types.ObjectId(),
            point_value_amount: 1000,
            min_redeem_points: 1,
            redeem_step: 1,
            max_redeem_percent: 50,
            is_active: true,
        }));

        const result = await loyaltyService.calculateBookingRedeemDiscount({
            customerId,
            usedPoints: 1,
            priceAfterPromotion: 10000,
        });

        expect(result).toMatchObject({
            used_points: 1,
            points_discount_amount: 1000,
        });
    });

    it('limits point discount to fifty percent of the remaining booking amount', async () => {
        const loyalty = createLoyaltyDocument({
            customer_id: customerId,
            available_points: 100,
        });

        CustomerLoyalty.findOne.mockReturnValue(createQueryMock(loyalty));
        LoyaltyRedeemRule.findOne.mockReturnValue(createQueryMock({
            _id: new mongoose.Types.ObjectId(),
            point_value_amount: 1000,
            min_redeem_points: 1,
            redeem_step: 1,
            max_redeem_percent: 50,
            is_active: true,
        }));

        const allowedResult = await loyaltyService.calculateBookingRedeemDiscount({
            customerId,
            usedPoints: 75,
            priceAfterPromotion: 150000,
        });

        expect(allowedResult).toMatchObject({
            used_points: 75,
            points_discount_amount: 75000,
        });

        await expect(loyaltyService.calculateBookingRedeemDiscount({
            customerId,
            usedPoints: 76,
            priceAfterPromotion: 150000,
        })).rejects.toMatchObject({
            statusCode: 400,
            errorCode: 'LOYALTY_MAX_REDEEM_PERCENT_EXCEEDED',
        });
    });

    it('limits inactive tier recovery to one tier per completed paid booking', async () => {
        const recoveryStartedAt = new Date('2026-01-01T00:00:00.000Z');
        const loyalty = createLoyaltyDocument({
            customer_id: customerId,
            current_tier: 'SILVER',
            total_points: 680,
            available_points: 20,
            total_spent: 2900000,
            total_visits: 24,
            tier_recovery_started_at: recoveryStartedAt,
        });
        const pointTransaction = {
            _id: new mongoose.Types.ObjectId(),
            customer_id: customerId,
            booking_id: bookingId,
            type: 'EARN',
            points: 20,
            remaining_points: 20,
            balance_before: 20,
            balance_after: 40,
        };

        CustomerLoyalty.findOne.mockReturnValue(createQueryMock(loyalty));
        TierRule.findOne.mockReturnValue(createQueryMock({
            tier_name: 'SILVER',
            point_multiplier: 1,
        }));
        TierRule.find.mockReturnValue(createQueryMock([
            {
                tier_name: 'BRONZE',
                priority_level: 1,
                min_total_spent: 0,
                min_total_visits: 0,
                min_total_points: 0,
            },
            {
                tier_name: 'SILVER',
                priority_level: 2,
                min_total_spent: 500000,
                min_total_visits: 5,
                min_total_points: 100,
            },
            {
                tier_name: 'GOLD',
                priority_level: 3,
                min_total_spent: 1500000,
                min_total_visits: 12,
                min_total_points: 300,
            },
            {
                tier_name: 'PLATINUM',
                priority_level: 4,
                min_total_spent: 3000000,
                min_total_visits: 25,
                min_total_points: 700,
            },
        ]));
        PointTransaction.create.mockResolvedValue([pointTransaction]);

        const result = await loyaltyService.processBookingLoyalty({
            booking: {
                _id: bookingId,
                customer_id: customerId,
                original_price: 100000,
                final_price: 100000,
            },
            servicePackage: {
                points_earned: 20,
            },
            actorId: new mongoose.Types.ObjectId(),
        });

        expect(loyalty.total_spent).toBe(3000000);
        expect(loyalty.total_visits).toBe(25);
        expect(loyalty.total_points).toBe(700);
        expect(loyalty.current_tier).toBe('GOLD');
        expect(loyalty.tier_recovery_started_at).toBe(recoveryStartedAt);
        expect(result).toMatchObject({
            earned_points: 20,
            tier_review: {
                previous_tier: 'SILVER',
                current_tier: 'GOLD',
                tier_changed: true,
            },
        });
    });

    it('clears tier recovery once the customer reaches the highest eligible tier', async () => {
        const loyalty = createLoyaltyDocument({
            customer_id: customerId,
            current_tier: 'GOLD',
            total_points: 700,
            total_spent: 3000000,
            total_visits: 25,
            tier_recovery_started_at: new Date('2026-01-01T00:00:00.000Z'),
        });

        TierRule.find.mockReturnValue(createQueryMock([
            {
                tier_name: 'BRONZE',
                priority_level: 1,
                min_total_spent: 0,
                min_total_visits: 0,
                min_total_points: 0,
            },
            {
                tier_name: 'SILVER',
                priority_level: 2,
                min_total_spent: 500000,
                min_total_visits: 5,
                min_total_points: 100,
            },
            {
                tier_name: 'GOLD',
                priority_level: 3,
                min_total_spent: 1500000,
                min_total_visits: 12,
                min_total_points: 300,
            },
            {
                tier_name: 'PLATINUM',
                priority_level: 4,
                min_total_spent: 3000000,
                min_total_visits: 25,
                min_total_points: 700,
            },
        ]));

        const result = await loyaltyService.reviewCustomerTier(loyalty);

        expect(loyalty.current_tier).toBe('PLATINUM');
        expect(loyalty.tier_recovery_started_at).toBeNull();
        expect(result).toMatchObject({
            previous_tier: 'GOLD',
            current_tier: 'PLATINUM',
            tier_changed: true,
        });
    });

    it('redeems points for booking and consumes source transaction balances', async () => {
        const sourceAId = new mongoose.Types.ObjectId();
        const sourceBId = new mongoose.Types.ObjectId();
        const redeemTransactionId = new mongoose.Types.ObjectId();
        const loyalty = createLoyaltyDocument({
            customer_id: customerId,
            available_points: 100,
            redeemed_points: 10,
        });
        const sourceA = {
            _id: sourceAId,
            remaining_points: 40,
            save: jest.fn().mockResolvedValue(undefined),
        };
        const sourceB = {
            _id: sourceBId,
            remaining_points: 50,
            save: jest.fn().mockResolvedValue(undefined),
        };

        CustomerLoyalty.findOne.mockReturnValue(createQueryMock(loyalty));
        LoyaltyRedeemRule.findOne.mockReturnValue(createQueryMock({
            _id: new mongoose.Types.ObjectId(),
            point_value_amount: 1000,
            min_redeem_points: 1,
            redeem_step: 1,
            max_redeem_percent: 50,
            is_active: true,
        }));
        PointTransaction.findOne.mockReturnValue(createQueryMock(null));
        PointTransaction.find.mockReturnValue(createQueryMock([sourceA, sourceB]));
        PointTransaction.create.mockResolvedValue([
            {
                _id: redeemTransactionId,
                customer_id: customerId,
                booking_id: bookingId,
                type: 'REDEEM',
                points: -70,
                remaining_points: 0,
                balance_before: 100,
                balance_after: 30,
            },
        ]);

        const result = await loyaltyService.redeemPointsForBooking({
            booking: {
                _id: bookingId,
                points_discount_amount: 70000,
            },
            customerId,
            usedPoints: 70,
            priceAfterPromotion: 200000,
            actorId: customerId,
            expectedPointsDiscountAmount: 70000,
        });

        expect(sourceA.remaining_points).toBe(0);
        expect(sourceB.remaining_points).toBe(20);
        expect(sourceA.save).toHaveBeenCalledTimes(1);
        expect(sourceB.save).toHaveBeenCalledTimes(1);
        expect(loyalty.available_points).toBe(30);
        expect(loyalty.redeemed_points).toBe(80);
        expect(PointTransaction.create).toHaveBeenCalledWith(
            [
                expect.objectContaining({
                    customer_id: customerId,
                    booking_id: bookingId,
                    type: 'REDEEM',
                    points: -70,
                    remaining_points: 0,
                    balance_before: 100,
                    balance_after: 30,
                    source_transaction_ids: [sourceAId, sourceBId],
                    created_by: customerId,
                }),
            ],
            undefined
        );
        expect(result).toMatchObject({
            used_points: 70,
            points_discount_amount: 70000,
            already_processed: false,
        });
    });

    it('refunds redeemed points for canceled booking', async () => {
        const redeemTransactionId = new mongoose.Types.ObjectId();
        const refundTransactionId = new mongoose.Types.ObjectId();
        const loyalty = createLoyaltyDocument({
            customer_id: customerId,
            available_points: 30,
            redeemed_points: 70,
        });

        PointTransaction.findOne
            .mockReturnValueOnce(createQueryMock(null))
            .mockReturnValueOnce(createQueryMock({
                _id: redeemTransactionId,
                type: 'REDEEM',
            }));
        CustomerLoyalty.findOne.mockReturnValue(createQueryMock(loyalty));
        PointTransaction.create.mockResolvedValue([
            {
                _id: refundTransactionId,
                customer_id: customerId,
                booking_id: bookingId,
                type: 'REFUND',
                points: 70,
                remaining_points: 70,
                balance_before: 30,
                balance_after: 100,
            },
        ]);

        const result = await loyaltyService.refundRedeemedPointsForBooking({
            booking: {
                _id: bookingId,
                customer_id: customerId,
                used_points: 70,
            },
            actorId: customerId,
        });

        expect(loyalty.available_points).toBe(100);
        expect(loyalty.redeemed_points).toBe(0);
        expect(loyalty.save).toHaveBeenCalledTimes(1);
        expect(PointTransaction.create).toHaveBeenCalledWith(
            [
                expect.objectContaining({
                    customer_id: customerId,
                    booking_id: bookingId,
                    type: 'REFUND',
                    points: 70,
                    remaining_points: 70,
                    balance_before: 30,
                    balance_after: 100,
                    source_transaction_ids: [redeemTransactionId],
                    created_by: customerId,
                }),
            ],
            undefined
        );
        expect(result).toMatchObject({
            refunded_points: 70,
            already_processed: false,
        });
    });

    it('expires due point transactions and creates EXPIRE transaction', async () => {
        const sourceTransactionId = new mongoose.Types.ObjectId();
        const expireTransactionId = new mongoose.Types.ObjectId();
        const loyalty = createLoyaltyDocument({
            customer_id: customerId,
            available_points: 80,
            expired_points: 10,
        });
        const session = {
            withTransaction: jest.fn(async (callback) => callback()),
            endSession: jest.fn().mockResolvedValue(null),
        };

        jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
        PointTransaction.find.mockReturnValue(createQueryMock([
            {
                _id: sourceTransactionId,
                customer_id: customerId,
                remaining_points: 30,
                expires_at: new Date('2026-01-01T00:00:00.000Z'),
            },
        ]));
        CustomerLoyalty.findOne.mockReturnValue(createQueryMock(loyalty));
        PointTransaction.updateMany.mockResolvedValue({ modifiedCount: 1 });
        PointTransaction.create.mockResolvedValue([
            {
                _id: expireTransactionId,
                customer_id: customerId,
                booking_id: null,
                type: 'EXPIRE',
                points: -30,
                remaining_points: 0,
                balance_before: 80,
                balance_after: 50,
                description: 'Expire unused loyalty points',
                source_transaction_ids: [sourceTransactionId],
            },
        ]);

        const result = await loyaltyService.expireDuePoints({
            actorId: new mongoose.Types.ObjectId(),
        });

        expect(session.withTransaction).toHaveBeenCalledTimes(1);
        expect(PointTransaction.updateMany).toHaveBeenCalledWith(
            { _id: { $in: [sourceTransactionId] } },
            {
                $set: expect.objectContaining({
                    remaining_points: 0,
                    expired_at: expect.any(Date),
                }),
            },
            { session }
        );
        expect(PointTransaction.create).toHaveBeenCalledWith(
            [
                expect.objectContaining({
                    customer_id: customerId.toString(),
                    type: 'EXPIRE',
                    points: -30,
                    remaining_points: 0,
                    balance_before: 80,
                    balance_after: 50,
                    source_transaction_ids: [sourceTransactionId],
                }),
            ],
            { session }
        );
        expect(loyalty.available_points).toBe(50);
        expect(loyalty.expired_points).toBe(40);
        expect(result).toMatchObject({
            expired_points: 30,
            customers_processed: 1,
            source_transactions_processed: 1,
        });
        expect(session.endSession).toHaveBeenCalledTimes(1);
    });

    it('downgrades inactive customer tiers by one level after 90 days', async () => {
        const loyalty = createLoyaltyDocument({
            customer_id: customerId,
            current_tier: 'GOLD',
            last_visit_at: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000),
            last_tier_downgrade_at: null,
        });
        const session = {
            withTransaction: jest.fn(async (callback) => callback()),
            endSession: jest.fn().mockResolvedValue(null),
        };

        jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
        TierRule.find.mockReturnValue(createQueryMock([
            {
                tier_name: 'BRONZE',
                priority_level: 1,
            },
            {
                tier_name: 'SILVER',
                priority_level: 2,
            },
            {
                tier_name: 'GOLD',
                priority_level: 3,
            },
            {
                tier_name: 'PLATINUM',
                priority_level: 4,
            },
        ]));
        CustomerLoyalty.find.mockReturnValue(createQueryMock([loyalty]));

        const result = await loyaltyService.downgradeInactiveCustomerTiers();

        expect(session.withTransaction).toHaveBeenCalledTimes(1);
        expect(CustomerLoyalty.find).toHaveBeenCalledWith(expect.objectContaining({
            current_tier: { $ne: 'BRONZE' },
        }));
        expect(loyalty.current_tier).toBe('SILVER');
        expect(loyalty.last_tier_downgrade_at).toBeInstanceOf(Date);
        expect(loyalty.last_tier_review_at).toBeInstanceOf(Date);
        expect(loyalty.tier_recovery_started_at).toBeInstanceOf(Date);
        expect(loyalty.save).toHaveBeenCalledWith({ session });
        expect(result).toMatchObject({
            downgraded_customers: 1,
            checked_customers: 1,
            skipped_customers: 0,
            downgrade_days: 90,
            downgrades: [
                expect.objectContaining({
                    customer_id: customerId.toString(),
                    previous_tier: 'GOLD',
                    current_tier: 'SILVER',
                    tier_recovery_started_at: expect.any(Date),
                }),
            ],
        });
        expect(session.endSession).toHaveBeenCalledTimes(1);
    });
});
