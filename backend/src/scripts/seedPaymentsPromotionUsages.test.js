const mongoose = require('mongoose');

const PaymentTransaction = require('../modules/payments/paymentTransaction.model');
const PromotionUsage = require('../modules/promotion-usages/promotionUsage.model');
const {
    BOOKING_PAYMENT_METHOD,
    BOOKING_PAYMENT_STATUS,
    BOOKING_STATUS,
} = require('../shared/constants/booking.constant');
const {
    PAYMENT_TRANSACTION_STATUS,
} = require('../shared/constants/payment.constant');
const {
    PROMOTION_DISCOUNT_TYPES,
    PROMOTION_USAGE_STATUS,
} = require('../shared/constants/promotion.constant');
const {
    PAYMENT_STATUS_TARGETS,
    PAYMENT_TRANSACTION_TOTAL,
    PROMOTION_USAGE_TARGETS,
    PROMOTION_USAGE_TOTAL,
    PROMOTION_USAGE_TOTALS,
} = require('./seedPaymentsPromotionUsagesCatalog');
const {
    calculatePromotionDiscount,
    getHighestEligibleTier,
    buildCustomerTierTimeline,
    buildPromotionUsageDefinitions,
    buildPaymentDefinitions,
    validatePromotionUsageDefinitions,
    validatePaymentDefinitions,
} = require('./seedPaymentsPromotionUsages');

const objectId = () => new mongoose.Types.ObjectId();

const countBy = (values, selector) => values.reduce((counts, value) => ({
    ...counts,
    [selector(value)]: (counts[selector(value)] || 0) + 1,
}), {});

const buildPaymentBooking = ({
    sequence,
    paymentMethod,
    paymentStatus,
    isWalkIn = false,
}) => {
    const completedAt = new Date(
        Date.UTC(2026, 6, 20, 2, sequence % 30)
    );
    const paidAt = paymentStatus === BOOKING_PAYMENT_STATUS.PAID
        ? new Date(completedAt.getTime() + 5 * 60000)
        : null;

    return {
        _id: objectId(),
        customer_id: isWalkIn ? null : objectId(),
        is_walk_in: isWalkIn,
        garage_id: new mongoose.Types.ObjectId(
            '507f1f77bcf86cd799439011'
        ),
        status: BOOKING_STATUS.COMPLETED,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        original_price: 250000,
        final_price: 225000,
        completed_at: completedAt,
        paid_at: paidAt,
    };
};

describe('payments and promotion usages seed', () => {
    test('locks the agreed payment and promotion lifecycle totals', () => {
        expect(PAYMENT_TRANSACTION_TOTAL).toBe(137);
        expect(PAYMENT_STATUS_TARGETS).toEqual({
            PAID: 125,
            EXPIRED: 6,
            FAILED: 2,
            CANCELED: 4,
        });
        expect(PROMOTION_USAGE_TOTAL).toBe(80);
        expect(PROMOTION_USAGE_TOTALS).toEqual({
            CONSUMED: 60,
            RESERVED: 12,
            RELEASED: 8,
        });

        const byStatus = Object.values(
            PROMOTION_USAGE_TARGETS
        ).reduce((totals, target) => {
            for (const [status, count] of Object.entries(target)) {
                totals[status] = (totals[status] || 0) + count;
            }

            return totals;
        }, {});

        expect(byStatus).toEqual(PROMOTION_USAGE_TOTALS);
    });

    test('calculates capped percentage and fixed promotion discounts', () => {
        expect(calculatePromotionDiscount({
            discount_type: PROMOTION_DISCOUNT_TYPES.PERCENTAGE,
            discount_value: 20,
            max_discount_amount: 30000,
        }, 250000)).toBe(30000);
        expect(calculatePromotionDiscount({
            discount_type: PROMOTION_DISCOUNT_TYPES.FIXED_AMOUNT,
            discount_value: 100000,
            max_discount_amount: null,
        }, 80000)).toBe(80000);
    });

    test('derives tier at booking creation from earlier paid history', () => {
        const customerId = objectId();
        const packageId = objectId();
        const firstBooking = {
            _id: objectId(),
            customer_id: customerId,
            service_package_id: packageId,
            add_on_service_ids: [],
            status: BOOKING_STATUS.COMPLETED,
            payment_status: BOOKING_PAYMENT_STATUS.PAID,
            original_price: 300000,
            created_at: new Date('2026-07-01T01:00:00.000Z'),
            paid_at: new Date('2026-07-01T03:00:00.000Z'),
        };
        const laterBooking = {
            ...firstBooking,
            _id: objectId(),
            created_at: new Date('2026-07-02T01:00:00.000Z'),
            paid_at: new Date('2026-07-02T03:00:00.000Z'),
        };
        const tierRules = [
            {
                tier_name: 'BRONZE',
                priority_level: 1,
                min_total_spent: 0,
                min_total_visits: 0,
                min_total_points: 0,
                point_multiplier: 1,
            },
            {
                tier_name: 'SILVER',
                priority_level: 2,
                min_total_spent: 250000,
                min_total_visits: 1,
                min_total_points: 10,
                point_multiplier: 1.2,
            },
        ];
        const timeline = buildCustomerTierTimeline({
            bookings: [firstBooking, laterBooking],
            servicePackageById: new Map([
                [packageId.toString(), { points_earned: 20 }],
            ]),
            tierRules,
            finalPriceByBookingId: new Map([
                [firstBooking._id.toString(), 300000],
                [laterBooking._id.toString(), 300000],
            ]),
        });

        expect(timeline.tierContextByBookingId.get(
            firstBooking._id.toString()
        ).current_tier).toBe('BRONZE');
        expect(timeline.tierContextByBookingId.get(
            laterBooking._id.toString()
        ).current_tier).toBe('SILVER');
        expect(getHighestEligibleTier({
            total_spent: 300000,
            total_visits: 1,
            total_points: 20,
        }, tierRules)).toBe('SILVER');
    });

    test('builds schema-valid usage documents for all lifecycle statuses', () => {
        const promotion = {
            _id: objectId(),
            per_phone_limit: null,
            discount_type: PROMOTION_DISCOUNT_TYPES.PERCENTAGE,
            discount_value: 10,
            max_discount_amount: 50000,
        };
        const baseBooking = {
            _id: objectId(),
            customer_id: objectId(),
            is_walk_in: false,
            created_by_staff_id: null,
            normalized_guest_phone: null,
            original_price: 200000,
            created_at: new Date('2026-07-01T01:00:00.000Z'),
            paid_at: new Date('2026-07-01T03:00:00.000Z'),
            canceled_at: null,
            no_show_at: null,
        };
        const definitions = buildPromotionUsageDefinitions({
            assignments: [
                {
                    promotion,
                    booking: baseBooking,
                    status: PROMOTION_USAGE_STATUS.CONSUMED,
                },
                {
                    promotion,
                    booking: {
                        ...baseBooking,
                        _id: objectId(),
                        paid_at: null,
                    },
                    status: PROMOTION_USAGE_STATUS.RESERVED,
                },
                {
                    promotion,
                    booking: {
                        ...baseBooking,
                        _id: objectId(),
                        paid_at: null,
                        canceled_at:
                            new Date('2026-07-01T02:00:00.000Z'),
                    },
                    status: PROMOTION_USAGE_STATUS.RELEASED,
                },
            ],
        });

        expect(definitions).toHaveLength(3);
        expect(() => validatePromotionUsageDefinitions(definitions))
            .not.toThrow();

        for (const definition of definitions) {
            expect(new PromotionUsage({
                _id: new mongoose.Types.ObjectId(
                    definition.usage_id_hex
                ),
                ...definition,
            }).validateSync()).toBeUndefined();
        }
    });

    test('builds 137 terminal PayOS records without active keys', () => {
        const paidPayos = Array.from({ length: 125 }, (_, index) => (
            buildPaymentBooking({
                sequence: index,
                paymentMethod: BOOKING_PAYMENT_METHOD.PAYOS,
                paymentStatus: BOOKING_PAYMENT_STATUS.PAID,
                isWalkIn: index < 10,
            })
        ));
        const unpaid = Array.from({ length: 10 }, (_, index) => (
            buildPaymentBooking({
                sequence: index + 125,
                paymentMethod: BOOKING_PAYMENT_METHOD.CASH,
                paymentStatus: BOOKING_PAYMENT_STATUS.UNPAID,
                isWalkIn: index < 5,
            })
        ));
        const paidCash = Array.from({ length: 4 }, (_, index) => (
            buildPaymentBooking({
                sequence: index + 135,
                paymentMethod: BOOKING_PAYMENT_METHOD.CASH,
                paymentStatus: BOOKING_PAYMENT_STATUS.PAID,
            })
        ));
        const garageId = paidPayos[0].garage_id.toString();
        const definitions = buildPaymentDefinitions({
            bookings: [...paidPayos, ...unpaid, ...paidCash],
            staffByGarageId: new Map([
                [garageId, { user_id: objectId() }],
            ]),
        });

        expect(definitions).toHaveLength(137);
        expect(countBy(
            definitions,
            (definition) => definition.status
        )).toEqual({
            [PAYMENT_TRANSACTION_STATUS.PAID]: 125,
            [PAYMENT_TRANSACTION_STATUS.EXPIRED]: 6,
            [PAYMENT_TRANSACTION_STATUS.CANCELED]: 4,
            [PAYMENT_TRANSACTION_STATUS.FAILED]: 2,
        });
        expect(definitions.every(
            (definition) => definition.active_payment_key === null
        )).toBe(true);
        expect(() => validatePaymentDefinitions(definitions))
            .not.toThrow();

        for (const definition of definitions) {
            expect(new PaymentTransaction({
                _id: new mongoose.Types.ObjectId(
                    definition.payment_id_hex
                ),
                ...definition,
            }).validateSync()).toBeUndefined();
        }
    });
});
