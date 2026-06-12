const mongoose = require('mongoose');

jest.mock('./promotion.model', () => ({
    findOne: jest.fn(),
}));

jest.mock('../service-packages/servicePackage.model', () => ({
    countDocuments: jest.fn(),
    findById: jest.fn(),
}));

jest.mock('../promotion-usages/promotionUsage.model', () => ({
    countDocuments: jest.fn(),
}));

jest.mock('../loyalty/loyalty.service', () => ({
    getOrCreateCustomerLoyalty: jest.fn(),
}));

const Promotion = require('./promotion.model');
const PromotionUsage = require('../promotion-usages/promotionUsage.model');
const loyaltyService = require('../loyalty/loyalty.service');
const promotionService = require('./promotion.service');

const createValidPromotion = (overrides = {}) => ({
    _id: new mongoose.Types.ObjectId(),
    code: 'GOLD20',
    name: 'Gold discount',
    discount_type: 'PERCENTAGE',
    discount_value: 20,
    max_discount_amount: 30000,
    min_order_amount: 100000,
    applicable_tiers: ['GOLD'],
    applicable_vehicle_types: ['CAR'],
    applicable_service_package_ids: [],
    start_at: new Date('2026-01-01T00:00:00.000Z'),
    end_at: new Date('2099-01-01T00:00:00.000Z'),
    usage_limit: 10,
    per_customer_limit: 1,
    used_count: 0,
    reserved_count: 0,
    audience: 'ALL',
    is_active: true,
    ...overrides,
});

describe('promotion service business rules', () => {
    const customerId = new mongoose.Types.ObjectId();
    const servicePackageId = new mongoose.Types.ObjectId();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('calculates capped percentage discount for eligible customer and package', async () => {
        const promotion = createValidPromotion({
            applicable_service_package_ids: [servicePackageId],
        });
        const servicePackage = {
            _id: servicePackageId,
            vehicle_type: 'CAR',
            base_price: 200000,
        };

        Promotion.findOne.mockResolvedValue(promotion);
        loyaltyService.getOrCreateCustomerLoyalty.mockResolvedValue({
            customer_id: customerId,
            current_tier: 'GOLD',
        });
        PromotionUsage.countDocuments
            .mockResolvedValueOnce(2)
            .mockResolvedValueOnce(0);

        const result = await promotionService.validatePromotionForBooking({
            promotion_code: ' gold20 ',
            customer_id: customerId,
            servicePackage,
            vehicleType: 'CAR',
            orderAmount: 200000,
        });

        expect(Promotion.findOne).toHaveBeenCalledWith({ code: 'GOLD20' });
        expect(PromotionUsage.countDocuments).toHaveBeenNthCalledWith(1, {
            promotion_id: promotion._id,
            status: { $ne: 'RELEASED' },
        });
        expect(PromotionUsage.countDocuments).toHaveBeenNthCalledWith(2, {
            promotion_id: promotion._id,
            customer_id: customerId,
            status: { $ne: 'RELEASED' },
        });
        expect(result).toMatchObject({
            promotion,
            discount_amount: 30000,
            final_price: 170000,
        });
    });

    it('rejects customer when tier is not eligible', async () => {
        const servicePackage = {
            _id: servicePackageId,
            vehicle_type: 'CAR',
            base_price: 200000,
        };

        Promotion.findOne.mockResolvedValue(createValidPromotion());
        loyaltyService.getOrCreateCustomerLoyalty.mockResolvedValue({
            customer_id: customerId,
            current_tier: 'BRONZE',
        });

        await expect(
            promotionService.validatePromotionForBooking({
                promotion_code: 'GOLD20',
                customer_id: customerId,
                servicePackage,
                vehicleType: 'CAR',
                orderAmount: 200000,
            })
        ).rejects.toMatchObject({
            statusCode: 400,
            errorCode: 'PROMOTION_TIER_NOT_ELIGIBLE',
        });
    });

    it('rejects customer promotion usage limit', async () => {
        const promotion = createValidPromotion();
        const servicePackage = {
            _id: servicePackageId,
            vehicle_type: 'CAR',
            base_price: 200000,
        };

        Promotion.findOne.mockResolvedValue(promotion);
        loyaltyService.getOrCreateCustomerLoyalty.mockResolvedValue({
            customer_id: customerId,
            current_tier: 'GOLD',
        });
        PromotionUsage.countDocuments
            .mockResolvedValueOnce(0)
            .mockResolvedValueOnce(1);

        await expect(
            promotionService.validatePromotionForBooking({
                promotion_code: 'GOLD20',
                customer_id: customerId,
                servicePackage,
                vehicleType: 'CAR',
                orderAmount: 200000,
            })
        ).rejects.toMatchObject({
            statusCode: 409,
            errorCode: 'PROMOTION_CUSTOMER_USAGE_LIMIT_REACHED',
        });
    });

    it('requires phone for a walk-in phone promotion', async () => {
        const promotion = createValidPromotion({
            audience: 'WALK_IN',
            phone_required: true,
            per_phone_limit: 1,
            applicable_tiers: [],
            per_customer_limit: null,
            usage_limit: null,
        });

        Promotion.findOne.mockResolvedValue(promotion);

        await expect(
            promotionService.validatePromotionForBooking({
                promotion_code: 'GOLD20',
                customer_id: null,
                servicePackage: {
                    _id: servicePackageId,
                    vehicle_type: 'CAR',
                    base_price: 200000,
                },
                vehicleType: 'CAR',
                orderAmount: 200000,
            })
        ).rejects.toMatchObject({
            statusCode: 400,
            errorCode: 'PROMOTION_PHONE_REQUIRED',
        });
    });

    it('rejects a repeated walk-in phone promotion', async () => {
        const promotion = createValidPromotion({
            audience: 'WALK_IN',
            phone_required: true,
            per_phone_limit: 1,
            applicable_tiers: [],
            per_customer_limit: null,
            usage_limit: null,
        });

        Promotion.findOne.mockResolvedValue(promotion);
        PromotionUsage.countDocuments.mockResolvedValue(1);

        await expect(
            promotionService.validatePromotionForBooking({
                promotion_code: 'GOLD20',
                customer_id: null,
                guest_phone_normalized: '+84901234567',
                servicePackage: {
                    _id: servicePackageId,
                    vehicle_type: 'CAR',
                    base_price: 200000,
                },
                vehicleType: 'CAR',
                orderAmount: 200000,
            })
        ).rejects.toMatchObject({
            statusCode: 409,
            errorCode: 'PROMOTION_PHONE_USAGE_LIMIT_REACHED',
        });
    });
});
