const mongoose = require('mongoose');

const PointTransaction = require('./pointTransaction.model');
const TierRule = require('./tierRule.model');
const LoyaltyRedeemRule = require('./loyaltyRedeemRule.model');
const LoyaltyMapper = require('./loyalty.mapper');
const {
    createTierRuleSchema,
    updateTierRuleSchema,
    redeemPreviewSchema,
    expirePointsSchema,
} = require('./loyalty.validator');

describe('loyalty module', () => {
    const customerId = new mongoose.Types.ObjectId().toString();
    const servicePackageId = new mongoose.Types.ObjectId().toString();
    const bookingId = new mongoose.Types.ObjectId().toString();

    it.each(['DIAMOND', 'VIP_PLUS', 'KIM_CUONG'])('accepts dynamic tier name %s', (tierName) => {
        const result = createTierRuleSchema.safeParse({
            body: {
                tier_name: tierName,
                booking_window_days: '12',
                max_upcoming_bookings: '2',
                point_multiplier: '1.35',
                priority_level: '3',
                min_total_spent: '3000000',
                min_total_visits: '20',
                min_total_points: '500',
            },
        });

        expect(result.success).toBe(true);
        expect(result.data.body.tier_name).toBe(tierName);
    });

    it('rejects empty tier rule update payload', () => {
        const result = updateTierRuleSchema.safeParse({
            params: { tierRuleId: new mongoose.Types.ObjectId().toString() },
            body: {},
        });

        expect(result.success).toBe(false);
        expect(result.error.issues[0].message).toBe('At least one field is required');
    });

    it('validates redeem preview payload and normalizes promotion code', () => {
        const result = redeemPreviewSchema.safeParse({
            body: {
                service_package_id: servicePackageId,
                promotion_code: ' gold20 ',
                used_points: '50',
            },
        });

        expect(result.success).toBe(true);
        expect(result.data.body).toMatchObject({
            service_package_id: servicePackageId,
            promotion_code: 'GOLD20',
            used_points: 50,
        });
    });

    it('allows expire points payload without customer filter', () => {
        const result = expirePointsSchema.safeParse({
            body: {},
        });

        expect(result.success).toBe(true);
        expect(result.data.body).toEqual({});
    });

    it('allows dynamic tier names in the Mongoose model', async () => {
        const tierRule = new TierRule({
            tier_name: 'HẠNG SẮT',
            booking_window_days: 7,
            max_upcoming_bookings: 1,
            point_multiplier: 1,
            priority_level: 1,
        });

        await expect(tierRule.validate()).resolves.toBeUndefined();
        expect(tierRule.tier_name).toBe('HẠNG SẮT');
    });

    it('applies point transaction model rules', async () => {
        const redeemTransaction = new PointTransaction({
            customer_id: customerId,
            booking_id: bookingId,
            type: 'REDEEM',
            points: 10,
            remaining_points: 0,
            balance_before: 100,
            balance_after: 90,
        });
        const earnTransaction = new PointTransaction({
            customer_id: customerId,
            booking_id: bookingId,
            type: 'EARN',
            points: 20,
            remaining_points: 30,
            balance_before: 0,
            balance_after: 20,
        });

        await expect(redeemTransaction.validate()).rejects.toMatchObject({
            errors: {
                points: {
                    message: 'Redeem and expire points must be negative',
                },
            },
        });
        await expect(earnTransaction.validate()).rejects.toMatchObject({
            errors: {
                remaining_points: {
                    message: 'Remaining points must not exceed points',
                },
            },
        });
    });

    it('validates tier rule and redeem rule model limits', () => {
        const tierRule = new TierRule({
            tier_name: 'PLATINUM',
            booking_window_days: 14,
            max_upcoming_bookings: 3,
            point_multiplier: 1.5,
            priority_level: 4,
            min_total_spent: 0,
            min_total_visits: 0,
            min_total_points: 0,
        });
        const redeemRule = new LoyaltyRedeemRule({
            point_value_amount: 1000,
            min_redeem_points: 1,
            redeem_step: 1,
            max_redeem_percent: 101,
        });

        expect(tierRule.validateSync()).toBeUndefined();
        expect(redeemRule.validateSync().errors.max_redeem_percent.message).toBe('Max redeem percent must not exceed 100');
    });

    it('maps redeem preview response with redeem rule details', () => {
        const dto = LoyaltyMapper.toRedeemPreviewDto({
            service_package_id: servicePackageId,
            promotion_id: null,
            promotion_code: 'GOLD20',
            original_price: 200000,
            promotion_discount_amount: 20000,
            price_after_promotion: 180000,
            available_points: 100,
            used_points: 50,
            point_value_amount: 1000,
            points_discount_amount: 50000,
            discount_amount: 70000,
            final_price: 130000,
            redeem_rule: {
                _id: new mongoose.Types.ObjectId(),
                point_value_amount: 1000,
                min_redeem_points: 1,
                redeem_step: 1,
                max_redeem_percent: 50,
                is_active: true,
            },
        });

        expect(dto).toMatchObject({
            service_package_id: servicePackageId,
            promotion_code: 'GOLD20',
            used_points: 50,
            final_price: 130000,
            redeem_rule: {
                point_value_amount: 1000,
                redeem_step: 1,
            },
        });
    });
});
