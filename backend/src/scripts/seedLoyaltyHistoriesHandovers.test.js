const mongoose = require('mongoose');

const PointTransaction = require('../modules/loyalty/pointTransaction.model');
const {
    BOOKING_PAYMENT_METHOD,
    BOOKING_PAYMENT_STATUS,
    BOOKING_STATUS,
} = require('../shared/constants/booking.constant');
const {
    BOOKING_HANDOVER_RESPONSES,
    BOOKING_HANDOVER_STATES,
} = require('../shared/constants/customerCase.constant');
const {
    POINT_TRANSACTION_TYPES,
} = require('../shared/constants/loyalty.constant');
const {
    STAFF_EMPLOYMENT_STATUS,
    STAFF_TYPES,
} = require('../shared/constants/staff.constant');
const {
    VEHICLE_INSPECTION_TYPES,
} = require('../shared/constants/vehicleInspection.constant');
const {
    CUSTOMER_LOYALTY_TARGETS,
    HANDOVER_TARGETS,
    POINT_TRANSACTION_TARGETS,
    POINT_TRANSACTION_TOTAL,
    REDEEM_TARGETS,
    WASH_HISTORY_TARGETS,
} = require('./seedLoyaltyHistoriesHandoversCatalog');
const {
    getRedeemPointLimit,
    buildPointLedger,
    buildWashHistoryDefinitions,
    buildHandoverDefinitions,
    validateDefinitions,
} = require('./seedLoyaltyHistoriesHandovers');

const objectId = () => new mongoose.Types.ObjectId();

const buildPaidBooking = ({
    customerId,
    packageId,
    garageId,
    sequence = 0,
}) => {
    const startedAt = new Date(
        Date.UTC(2026, 6, 1 + sequence, 2, 0)
    );
    const completedAt = new Date(
        startedAt.getTime() + 30 * 60000
    );
    const paidAt = new Date(
        completedAt.getTime() + 5 * 60000
    );

    return {
        _id: objectId(),
        customer_id: customerId,
        vehicle_id: objectId(),
        is_walk_in: false,
        garage_id: garageId,
        wash_bay_id: objectId(),
        service_package_id: packageId,
        add_on_service_ids: [],
        vehicle_type: 'CAR',
        status: BOOKING_STATUS.COMPLETED,
        payment_status: BOOKING_PAYMENT_STATUS.PAID,
        payment_method: BOOKING_PAYMENT_METHOD.CASH,
        original_price: 100000,
        promotion_discount_amount: 0,
        voucher_discount_amount: 0,
        points_discount_amount: 0,
        discount_amount: 0,
        final_price: 100000,
        used_points: 0,
        created_at: new Date(
            startedAt.getTime() - 24 * 60 * 60000
        ),
        updated_at: paidAt,
        started_at: startedAt,
        completed_at: completedAt,
        paid_at: paidAt,
    };
};

const buildInspection = ({ booking, type, staffId }) => ({
    _id: objectId(),
    booking_id: booking._id,
    type,
    note: type === VEHICLE_INSPECTION_TYPES.BEFORE_WASH
        ? 'Tình trạng xe trước dịch vụ.'
        : 'Tình trạng xe sau dịch vụ.',
    images: [{
        image_url: `https://example.test/${type}.png`,
        public_id: null,
        caption: type,
    }],
    inspected_by: staffId,
    inspected_at: type === VEHICLE_INSPECTION_TYPES.BEFORE_WASH
        ? new Date(booking.started_at.getTime() - 2 * 60000)
        : new Date(booking.completed_at.getTime() - 2 * 60000),
});

describe('loyalty, wash histories and handovers seed', () => {
    test('locks the agreed lifecycle totals', () => {
        expect(POINT_TRANSACTION_TOTAL).toBe(344);
        expect(POINT_TRANSACTION_TARGETS).toEqual({
            EARN: 327,
            REDEEM: 16,
            REFUND: 1,
            EXPIRE: 0,
            ADJUST: 0,
        });
        expect(REDEEM_TARGETS).toEqual({
            COMPLETED_PAID: 10,
            CONFIRMED: 5,
            CANCELED: 1,
        });
        expect(CUSTOMER_LOYALTY_TARGETS).toEqual({
            total: 125,
            active: 93,
            inactive: 32,
            tier_distribution: {
                BRONZE: 100,
                SILVER: 12,
                GOLD: 10,
                PLATINUM: 3,
            },
        });
        expect(WASH_HISTORY_TARGETS).toEqual({
            total: 355,
            customer: 327,
            walk_in: 28,
        });
        expect(HANDOVER_TARGETS.by_state).toEqual({
            RELEASED: 355,
            READY_FOR_CUSTOMER: 10,
        });
    });

    test('defines a unique booking and transaction type ledger index', () => {
        const uniqueIndex = PointTransaction.schema.indexes().find(
            ([fields, options]) => (
                fields.booking_id === 1
                && fields.type === 1
                && options.unique
            )
        );

        expect(uniqueIndex).toBeDefined();
        expect(uniqueIndex[1].partialFilterExpression).toEqual({
            booking_id: { $type: 'objectId' },
        });
    });

    test('caps redeem points by balance, step and payable amount', () => {
        expect(getRedeemPointLimit({
            booking: {
                original_price: 200000,
                promotion_discount_amount: 50000,
                voucher_discount_amount: 0,
            },
            tierContext: { total_points: 1000 },
        })).toBe(450);
        expect(getRedeemPointLimit({
            booking: {
                original_price: 30000,
                promotion_discount_amount: 0,
                voucher_discount_amount: 0,
            },
            tierContext: { total_points: 84 },
        })).toBe(80);
    });

    test('derives FIFO point balances and loyalty aggregates', () => {
        const customerId = objectId();
        const packageId = objectId();
        const garageId = objectId();
        const customer = {
            _id: customerId,
            created_at: new Date('2026-06-01T02:00:00.000Z'),
        };
        const earnedBooking = buildPaidBooking({
            customerId,
            packageId,
            garageId,
        });
        const confirmedBooking = {
            ...earnedBooking,
            _id: objectId(),
            status: BOOKING_STATUS.CONFIRMED,
            payment_status: BOOKING_PAYMENT_STATUS.UNPAID,
            started_at: null,
            completed_at: null,
            paid_at: null,
            created_at: new Date('2026-07-02T02:00:00.000Z'),
            used_points: 70,
            points_discount_amount: 7000,
            discount_amount: 7000,
            final_price: 93000,
        };
        const ledger = buildPointLedger({
            bookings: [earnedBooking, confirmedBooking],
            customers: [customer],
            assignments: [{
                booking: confirmedBooking,
                points: 70,
                kind: 'CONFIRMED',
            }],
            servicePackageById: new Map([[
                packageId.toString(),
                { points_earned: 100 },
            ]]),
            tierRules: [{
                tier_name: 'BRONZE',
                point_multiplier: 1,
                priority_level: 1,
                min_total_spent: 0,
                min_total_visits: 0,
                min_total_points: 0,
            }],
        });
        const earn = ledger.pointTransactions.find(
            (transaction) => (
                transaction.type === POINT_TRANSACTION_TYPES.EARN
            )
        );
        const redeem = ledger.pointTransactions.find(
            (transaction) => (
                transaction.type === POINT_TRANSACTION_TYPES.REDEEM
            )
        );
        const loyalty = ledger.customerLoyalties[0];

        expect(earn.points).toBe(100);
        expect(earn.remaining_points).toBe(30);
        expect(redeem.points).toBe(-70);
        expect(redeem.balance_before).toBe(100);
        expect(redeem.balance_after).toBe(30);
        expect(redeem.source_transaction_ids).toEqual([
            new mongoose.Types.ObjectId(earn.transaction_id_hex),
        ]);
        expect(loyalty).toEqual(expect.objectContaining({
            total_points: 100,
            available_points: 30,
            redeemed_points: 70,
            total_spent: 100000,
            total_visits: 1,
        }));
    });

    test('builds schema-valid paid histories and payment-gated handovers', () => {
        const garageId = objectId();
        const staffId = objectId();
        const customerId = objectId();
        const packageId = objectId();
        const paid = buildPaidBooking({
            customerId,
            packageId,
            garageId,
        });
        const unpaidWalkIn = {
            ...buildPaidBooking({
                customerId: null,
                packageId,
                garageId,
                sequence: 1,
            }),
            customer_id: null,
            vehicle_id: null,
            is_walk_in: true,
            guest_name: 'Khách vãng lai',
            guest_phone: '0901234567',
            normalized_guest_phone: '+84901234567',
            payment_status: BOOKING_PAYMENT_STATUS.UNPAID,
            paid_at: null,
        };
        const inspections = [
            buildInspection({
                booking: paid,
                type: VEHICLE_INSPECTION_TYPES.BEFORE_WASH,
                staffId,
            }),
            buildInspection({
                booking: paid,
                type: VEHICLE_INSPECTION_TYPES.AFTER_WASH,
                staffId,
            }),
            buildInspection({
                booking: unpaidWalkIn,
                type: VEHICLE_INSPECTION_TYPES.BEFORE_WASH,
                staffId,
            }),
            buildInspection({
                booking: unpaidWalkIn,
                type: VEHICLE_INSPECTION_TYPES.AFTER_WASH,
                staffId,
            }),
        ];
        const inspectionByNaturalKey = new Map(inspections.map(
            (inspection) => [
                `${inspection.booking_id}:${inspection.type}`,
                inspection,
            ]
        ));
        const washHistories = buildWashHistoryDefinitions({
            bookings: [paid, unpaidWalkIn],
            earnedPointsByBookingId: new Map([
                [paid._id.toString(), 25],
            ]),
        });
        const handovers = buildHandoverDefinitions({
            bookings: [paid, unpaidWalkIn],
            inspectionByNaturalKey,
            staffByGarageId: new Map([[
                garageId.toString(),
                {
                    user_id: staffId,
                    staff_type: STAFF_TYPES.CUSTOMER_SERVICE_STAFF,
                    employment_status: STAFF_EMPLOYMENT_STATUS.ACTIVE,
                },
            ]]),
        });

        expect(washHistories).toHaveLength(1);
        expect(washHistories[0]).toEqual(expect.objectContaining({
            booking_id: paid._id,
            amount_paid: paid.final_price,
            points_earned: 25,
        }));
        expect(handovers).toHaveLength(2);
        expect(handovers[0]).toEqual(expect.objectContaining({
            state: BOOKING_HANDOVER_STATES.RELEASED,
            customer_response: BOOKING_HANDOVER_RESPONSES.ACCEPTED,
        }));
        expect(handovers[1]).toEqual(expect.objectContaining({
            state: BOOKING_HANDOVER_STATES.READY_FOR_CUSTOMER,
            customer_response: BOOKING_HANDOVER_RESPONSES.PENDING,
            released_at: null,
        }));
        expect(() => validateDefinitions({
            pointTransactions: [],
            customerLoyalties: [],
            washHistories,
            handovers,
        })).not.toThrow();
    });
});
