require('dotenv').config();

const mongoose = require('mongoose');

const Booking = require('../modules/bookings/booking.model');
const BookingHandover = require('../modules/booking-handovers/bookingHandover.model');
const CustomerLoyalty = require('../modules/loyalty/customerLoyalty.model');
const PaymentTransaction = require('../modules/payments/paymentTransaction.model');
const PointTransaction = require('../modules/loyalty/pointTransaction.model');
const User = require('../modules/users/user.model');
const VehicleInspection = require('../modules/vehicle-inspections/vehicleInspection.model');
const WashHistory = require('../modules/wash-histories/washHistory.model');
const { connectDB, disconnectDB } = require('../config/db');
const {
    BOOKING_PAYMENT_STATUS,
    BOOKING_STATUS,
} = require('../shared/constants/booking.constant');
const {
    BOOKING_HANDOVER_RESPONSES,
    BOOKING_HANDOVER_RESPONSE_SOURCES,
    BOOKING_HANDOVER_STATES,
} = require('../shared/constants/customerCase.constant');
const {
    LOYALTY_TIERS,
    POINT_EXPIRY_MONTHS,
    POINT_TRANSACTION_TYPES,
} = require('../shared/constants/loyalty.constant');
const {
    STAFF_EMPLOYMENT_STATUS,
    STAFF_TYPES,
} = require('../shared/constants/staff.constant');
const {
    VEHICLE_INSPECTION_TYPES,
} = require('../shared/constants/vehicleInspection.constant');
const { USER_ROLES } = require('../shared/constants/roles.constant');
const { normalizePhone } = require('../shared/utils/phone');
const {
    buildBookingScenarios,
    stableHexId,
} = require('./seedBookingCatalog');
const { buildCustomerSeedUsers } = require('./seedCatalog');
const {
    buildCustomerTierTimeline,
    buildSeedPlan: buildPaymentPromotionPlan,
    buildStablePromotionPlan,
    getHighestEligibleTier,
    verifyPaymentsPromotionUsages,
} = require('./seedPaymentsPromotionUsages');
const {
    CUSTOMER_LOYALTY_TARGETS,
    HANDOVER_TARGETS,
    POINT_TRANSACTION_TARGETS,
    POINT_TRANSACTION_TOTAL,
    REDEEM_TARGETS,
    WASH_HISTORY_TARGETS,
} = require('./seedLoyaltyHistoriesHandoversCatalog');
const { getSeedReferenceDate } = require('./seedTime');

const POINT_VALUE_AMOUNT = 100;
const REDEEM_STEP = 10;
const MIN_REDEEM_POINTS = 50;
const MAX_REDEEM_PERCENT = 30;

const toId = (value) => String(value?._id || value || '');

const addMinutes = (value, minutes) => new Date(
    new Date(value).getTime() + minutes * 60000
);

const addMonths = (value, months) => {
    const result = new Date(value);

    result.setUTCMonth(result.getUTCMonth() + months);

    return result;
};

const maxDate = (...values) => new Date(Math.max(
    ...values.filter(Boolean).map((value) => new Date(value).getTime())
));

const countBy = (values, selector) => values.reduce((counts, value) => {
    const key = selector(value);

    counts[key] = (counts[key] || 0) + 1;

    return counts;
}, {});

const countsMatch = (actual, expected) => (
    Object.entries(expected).every(
        ([key, count]) => actual[key] === count
    )
    && Object.entries(actual).every(
        ([key, count]) => expected[key] === count
    )
);

const rankValue = (namespace, key) => Number.parseInt(
    stableHexId(namespace, key).slice(0, 12),
    16
);

const applySession = (query, session) => {
    if (session) {
        query.session(session);
    }

    return query;
};

const getRedeemKind = (booking) => {
    if (
        booking.status === BOOKING_STATUS.COMPLETED
        && booking.payment_status === BOOKING_PAYMENT_STATUS.PAID
    ) {
        return 'COMPLETED_PAID';
    }

    return booking.status;
};

const getPackageBasePoints = (booking, servicePackageById) => [
    booking.service_package_id,
    ...(booking.add_on_service_ids || []),
].reduce((total, packageId) => (
    total + (
        Number(
            servicePackageById.get(toId(packageId))?.points_earned
        ) || 0
    )
), 0);

const getPromotionAssignmentSignature = (assignments) => assignments
    .map((assignment) => [
        assignment.promotion.code,
        assignment.status,
        toId(assignment.booking._id),
    ].join(':'))
    .sort()
    .join('|');

const stripSeedPointEffects = (bookings) => bookings.map((booking) => {
    const promotionDiscount = booking.promotion_discount_amount || 0;
    const voucherDiscount = booking.voucher_discount_amount || 0;
    const discountAmount = Math.min(
        booking.original_price,
        promotionDiscount + voucherDiscount
    );

    return {
        ...booking,
        used_points: 0,
        points_discount_amount: 0,
        discount_amount: discountAmount,
        final_price: Math.max(
            booking.original_price - discountAmount,
            0
        ),
        earned_points: 0,
        reward_processed: false,
        reward_processed_at: null,
    };
});

const getRedeemPointTarget = (tier) => ({
    [LOYALTY_TIERS.BRONZE]: 50,
    [LOYALTY_TIERS.SILVER]: 70,
    [LOYALTY_TIERS.GOLD]: 120,
    [LOYALTY_TIERS.PLATINUM]: 200,
}[tier] || MIN_REDEEM_POINTS);

const getRedeemPointLimit = ({ booking, tierContext }) => {
    const priceAfterPromotion = Math.max(
        booking.original_price
        - (booking.promotion_discount_amount || 0)
        - (booking.voucher_discount_amount || 0),
        0
    );
    const maxDiscountAmount = Math.floor(
        priceAfterPromotion * MAX_REDEEM_PERCENT / 100
    );
    const maxByPrice = Math.floor(
        maxDiscountAmount / POINT_VALUE_AMOUNT / REDEEM_STEP
    ) * REDEEM_STEP;
    const maxByBalance = Math.floor(
        tierContext.total_points / REDEEM_STEP
    ) * REDEEM_STEP;

    return Math.min(maxByPrice, maxByBalance);
};

const buildRedeemCandidates = ({
    bookings,
    timeline,
}) => bookings.flatMap((booking) => {
    const kind = getRedeemKind(booking);

    if (!Object.prototype.hasOwnProperty.call(REDEEM_TARGETS, kind)) {
        return [];
    }

    if (!booking.customer_id) {
        return [];
    }

    const tierContext = timeline.tierContextByBookingId.get(
        toId(booking._id)
    );

    if (!tierContext) {
        return [];
    }

    const pointLimit = getRedeemPointLimit({
        booking,
        tierContext,
    });
    const points = Math.min(
        getRedeemPointTarget(tierContext.current_tier),
        pointLimit
    );

    if (points < MIN_REDEEM_POINTS) {
        return [];
    }

    return [{
        booking,
        kind,
        customer_id: booking.customer_id,
        customer_id_string: toId(booking.customer_id),
        tier: tierContext.current_tier,
        points,
        point_limit: pointLimit,
    }];
});

const getLatestCandidatePerCustomer = (candidates) => {
    const latest = new Map();

    for (const candidate of [...candidates].sort((left, right) => (
        right.booking.created_at - left.booking.created_at
        || toId(left.booking._id).localeCompare(toId(right.booking._id))
    ))) {
        if (!latest.has(candidate.customer_id_string)) {
            latest.set(candidate.customer_id_string, candidate);
        }
    }

    return [...latest.values()];
};

const selectRedeemAssignments = ({
    bookings,
    timeline,
}) => {
    const candidates = buildRedeemCandidates({
        bookings,
        timeline,
    });
    const selected = [];
    const selectedCustomerIds = new Set();
    const selectKind = (kind, count, sorter) => {
        const available = getLatestCandidatePerCustomer(
            candidates.filter((candidate) => (
                candidate.kind === kind
                && !selectedCustomerIds.has(
                    candidate.customer_id_string
                )
            ))
        ).sort(sorter);

        if (available.length < count) {
            throw new Error(
                `Redeem candidates are incomplete: ${kind}:${available.length}/${count}`
            );
        }

        for (const candidate of available.slice(0, count)) {
            selected.push(candidate);
            selectedCustomerIds.add(candidate.customer_id_string);
        }
    };

    selectKind(
        'CANCELED',
        REDEEM_TARGETS.CANCELED,
        (left, right) => (
            rankValue('LOYALTY_REDEEM_CANCELED', toId(left.booking._id))
            - rankValue('LOYALTY_REDEEM_CANCELED', toId(right.booking._id))
        )
    );
    selectKind(
        'CONFIRMED',
        REDEEM_TARGETS.CONFIRMED,
        (left, right) => (
            rankValue('LOYALTY_REDEEM_CONFIRMED', toId(left.booking._id))
            - rankValue('LOYALTY_REDEEM_CONFIRMED', toId(right.booking._id))
        )
    );
    selectKind(
        'COMPLETED_PAID',
        REDEEM_TARGETS.COMPLETED_PAID,
        (left, right) => (
            right.booking.created_at - left.booking.created_at
            || right.points - left.points
            || rankValue(
                'LOYALTY_REDEEM_COMPLETED',
                toId(left.booking._id)
            ) - rankValue(
                'LOYALTY_REDEEM_COMPLETED',
                toId(right.booking._id)
            )
        )
    );

    return selected;
};

const applyRedeemAssignments = ({
    bookings,
    assignments,
}) => {
    const assignmentByBookingId = new Map(assignments.map((assignment) => [
        toId(assignment.booking._id),
        assignment,
    ]));

    return bookings.map((booking) => {
        const assignment = assignmentByBookingId.get(toId(booking._id));
        const usedPoints = assignment?.points || 0;
        const pointsDiscountAmount = usedPoints * POINT_VALUE_AMOUNT;
        const discountAmount = Math.min(
            booking.original_price,
            (booking.promotion_discount_amount || 0)
            + (booking.voucher_discount_amount || 0)
            + pointsDiscountAmount
        );

        return {
            ...booking,
            used_points: usedPoints,
            points_discount_amount: pointsDiscountAmount,
            discount_amount: discountAmount,
            final_price: Math.max(
                booking.original_price - discountAmount,
                0
            ),
        };
    });
};

const stabilizePointAdjustedBookings = ({
    baselineBookings,
    assignments,
    promotionByCode,
    servicePackageById,
    tierRules,
}) => {
    const baselinePromotionPlan = buildStablePromotionPlan({
        bookings: baselineBookings,
        promotionByCode,
        servicePackageById,
        tierRules,
    });
    const adjustedBookings = applyRedeemAssignments({
        bookings: baselineBookings,
        assignments,
    });
    const adjustedPromotionPlan = buildStablePromotionPlan({
        bookings: adjustedBookings,
        promotionByCode,
        servicePackageById,
        tierRules,
    });
    const baselineSignature = getPromotionAssignmentSignature(
        baselinePromotionPlan.assignments
    );
    const adjustedSignature = getPromotionAssignmentSignature(
        adjustedPromotionPlan.assignments
    );

    if (baselineSignature !== adjustedSignature) {
        throw new Error(
            'Point redemption changed seeded promotion assignments'
        );
    }

    const assignmentByBookingId = new Map(assignments.map((assignment) => [
        toId(assignment.booking._id),
        assignment,
    ]));
    const promotionAssignmentByBookingId = new Map(
        adjustedPromotionPlan.assignments.map((assignment) => [
            toId(assignment.booking._id),
            assignment,
        ])
    );

    return {
        baselinePromotionPlan,
        adjustedPromotionPlan,
        bookings: adjustedBookings.map((booking) => {
            const pricePlan =
                adjustedPromotionPlan.pricePlan.bookingPriceById.get(
                    toId(booking._id)
                );
            const redeemAssignment = assignmentByBookingId.get(
                toId(booking._id)
            );
            const promotionAssignment =
                promotionAssignmentByBookingId.get(toId(booking._id));

            return {
                ...booking,
                ...pricePlan,
                used_points: redeemAssignment?.points || 0,
                promotion_code:
                    promotionAssignment?.promotion.code || null,
            };
        }),
    };
};

const buildPointTransactionId = ({ bookingId, type }) => stableHexId(
    'AUTOWASH_POINT_TRANSACTION_V1',
    `${bookingId}:${type}`
);

const createCustomerLedgerState = (customer) => ({
    customer,
    current_tier: LOYALTY_TIERS.BRONZE,
    total_points: 0,
    available_points: 0,
    redeemed_points: 0,
    expired_points: 0,
    total_spent: 0,
    total_visits: 0,
    last_visit_at: null,
    last_tier_review_at: null,
    sources: [],
});

const createLedgerTransaction = ({
    booking,
    type,
    points,
    remainingPoints,
    balanceBefore,
    balanceAfter,
    description,
    earnedAt,
    expiresAt,
    expiredAt = null,
    sourceTransactionIds = [],
    createdBy = null,
    createdAt,
}) => ({
    transaction_id_hex: buildPointTransactionId({
        bookingId: toId(booking._id),
        type,
    }),
    customer_id: booking.customer_id,
    booking_id: booking._id,
    type,
    points,
    remaining_points: remainingPoints,
    balance_before: balanceBefore,
    balance_after: balanceAfter,
    description,
    earned_at: earnedAt,
    expires_at: expiresAt,
    expired_at: expiredAt,
    source_transaction_ids: sourceTransactionIds,
    created_by: createdBy,
    created_at: createdAt,
    updated_at: createdAt,
});

const consumePointSources = ({
    state,
    points,
    transactionById,
}) => {
    let remainingToConsume = points;
    const sourceTransactionIds = [];
    const orderedSources = [...state.sources]
        .filter((source) => source.remaining_points > 0)
        .sort((left, right) => (
            left.expires_at - right.expires_at
            || left.created_at - right.created_at
            || left.transaction_id_hex.localeCompare(
                right.transaction_id_hex
            )
        ));

    for (const source of orderedSources) {
        if (remainingToConsume <= 0) {
            break;
        }

        const consumed = Math.min(
            source.remaining_points,
            remainingToConsume
        );

        source.remaining_points -= consumed;
        remainingToConsume -= consumed;
        sourceTransactionIds.push(
            new mongoose.Types.ObjectId(source.transaction_id_hex)
        );
        transactionById.get(
            source.transaction_id_hex
        ).remaining_points = source.remaining_points;
    }

    if (remainingToConsume > 0) {
        throw new Error(
            `Point source balance is insufficient: ${remainingToConsume}`
        );
    }

    return sourceTransactionIds;
};

const buildPointLedger = ({
    bookings,
    customers,
    assignments,
    servicePackageById,
    tierRules,
}) => {
    const stateByCustomerId = new Map(customers.map((customer) => [
        toId(customer._id),
        createCustomerLedgerState(customer),
    ]));
    const assignmentByBookingId = new Map(assignments.map((assignment) => [
        toId(assignment.booking._id),
        assignment,
    ]));
    const tierRuleByName = new Map(tierRules.map((tierRule) => [
        tierRule.tier_name,
        tierRule,
    ]));
    const events = [];

    for (const booking of bookings) {
        if (!booking.customer_id) {
            continue;
        }

        if (assignmentByBookingId.has(toId(booking._id))) {
            events.push({
                type: POINT_TRANSACTION_TYPES.REDEEM,
                at: booking.created_at,
                booking,
            });

            if (booking.status === BOOKING_STATUS.CANCELED) {
                events.push({
                    type: POINT_TRANSACTION_TYPES.REFUND,
                    at: booking.canceled_at,
                    booking,
                });
            }
        }

        if (
            booking.status === BOOKING_STATUS.COMPLETED
            && booking.payment_status === BOOKING_PAYMENT_STATUS.PAID
        ) {
            events.push({
                type: POINT_TRANSACTION_TYPES.EARN,
                at: booking.paid_at,
                booking,
            });
        }
    }

    const eventPriority = {
        [POINT_TRANSACTION_TYPES.REDEEM]: 1,
        [POINT_TRANSACTION_TYPES.REFUND]: 2,
        [POINT_TRANSACTION_TYPES.EARN]: 3,
    };

    events.sort((left, right) => (
        left.at - right.at
        || eventPriority[left.type] - eventPriority[right.type]
        || toId(left.booking._id).localeCompare(toId(right.booking._id))
    ));

    const pointTransactions = [];
    const transactionById = new Map();
    const earnedPointsByBookingId = new Map();

    for (const event of events) {
        const booking = event.booking;
        const customerId = toId(booking.customer_id);
        const state = stateByCustomerId.get(customerId);

        if (!state) {
            throw new Error(
                `Customer ledger dependency is missing: ${customerId}`
            );
        }

        if (event.type === POINT_TRANSACTION_TYPES.REDEEM) {
            const points = assignmentByBookingId.get(
                toId(booking._id)
            ).points;
            const balanceBefore = state.available_points;

            if (balanceBefore < points) {
                throw new Error(
                    `Redeem balance is insufficient: ${booking._id}`
                );
            }

            const sourceTransactionIds = consumePointSources({
                state,
                points,
                transactionById,
            });
            const transaction = createLedgerTransaction({
                booking,
                type: POINT_TRANSACTION_TYPES.REDEEM,
                points: -points,
                remainingPoints: 0,
                balanceBefore,
                balanceAfter: balanceBefore - points,
                description: 'Redeem points for booking discount',
                earnedAt: null,
                expiresAt: null,
                sourceTransactionIds,
                createdBy: booking.customer_id,
                createdAt: event.at,
            });

            state.available_points -= points;
            state.redeemed_points += points;
            pointTransactions.push(transaction);
            transactionById.set(
                transaction.transaction_id_hex,
                transaction
            );
        }

        if (event.type === POINT_TRANSACTION_TYPES.REFUND) {
            const points = assignmentByBookingId.get(
                toId(booking._id)
            ).points;
            const balanceBefore = state.available_points;
            const redeemId = buildPointTransactionId({
                bookingId: toId(booking._id),
                type: POINT_TRANSACTION_TYPES.REDEEM,
            });
            const transaction = createLedgerTransaction({
                booking,
                type: POINT_TRANSACTION_TYPES.REFUND,
                points,
                remainingPoints: points,
                balanceBefore,
                balanceAfter: balanceBefore + points,
                description: 'Refund redeemed points for canceled booking',
                earnedAt: event.at,
                expiresAt: addMonths(event.at, POINT_EXPIRY_MONTHS),
                sourceTransactionIds: [
                    new mongoose.Types.ObjectId(redeemId),
                ],
                createdBy: booking.canceled_by_id || booking.customer_id,
                createdAt: event.at,
            });

            state.available_points += points;
            state.redeemed_points = Math.max(
                0,
                state.redeemed_points - points
            );
            state.sources.push({
                transaction_id_hex: transaction.transaction_id_hex,
                remaining_points: points,
                expires_at: transaction.expires_at,
                created_at: transaction.created_at,
            });
            pointTransactions.push(transaction);
            transactionById.set(
                transaction.transaction_id_hex,
                transaction
            );
        }

        if (event.type === POINT_TRANSACTION_TYPES.EARN) {
            const multiplier = tierRuleByName.get(
                state.current_tier
            )?.point_multiplier || 1;
            const basePoints = getPackageBasePoints(
                booking,
                servicePackageById
            );
            const earnedPoints = booking.original_price > 0
                ? Math.floor(
                    basePoints
                    * multiplier
                    * booking.final_price
                    / booking.original_price
                )
                : 0;
            const balanceBefore = state.available_points;
            const transaction = createLedgerTransaction({
                booking,
                type: POINT_TRANSACTION_TYPES.EARN,
                points: earnedPoints,
                remainingPoints: earnedPoints,
                balanceBefore,
                balanceAfter: balanceBefore + earnedPoints,
                description: 'Earn points from completed paid booking',
                earnedAt: event.at,
                expiresAt: addMonths(event.at, POINT_EXPIRY_MONTHS),
                createdAt: event.at,
            });

            if (earnedPoints <= 0) {
                throw new Error(
                    `Completed customer booking earned no points: ${booking._id}`
                );
            }

            state.total_points += earnedPoints;
            state.available_points += earnedPoints;
            state.total_spent += booking.final_price;
            state.total_visits += 1;
            state.last_visit_at = event.at;
            state.last_tier_review_at = event.at;
            state.current_tier = getHighestEligibleTier({
                total_spent: state.total_spent,
                total_visits: state.total_visits,
                total_points: state.total_points,
            }, tierRules);
            state.sources.push({
                transaction_id_hex: transaction.transaction_id_hex,
                remaining_points: earnedPoints,
                expires_at: transaction.expires_at,
                created_at: transaction.created_at,
            });
            pointTransactions.push(transaction);
            transactionById.set(
                transaction.transaction_id_hex,
                transaction
            );
            earnedPointsByBookingId.set(
                toId(booking._id),
                earnedPoints
            );
        }
    }

    const customerLoyalties = [...stateByCustomerId.values()].map(
        (state) => {
            const lastEventAt = [
                state.last_visit_at,
                ...pointTransactions
                    .filter((transaction) => (
                        toId(transaction.customer_id)
                        === toId(state.customer._id)
                    ))
                    .map((transaction) => transaction.updated_at),
            ].filter(Boolean).sort(
                (left, right) => right - left
            )[0] || state.customer.created_at;

            return {
                customer_id: state.customer._id,
                current_tier: state.current_tier,
                total_points: state.total_points,
                available_points: state.available_points,
                redeemed_points: state.redeemed_points,
                expired_points: state.expired_points,
                total_spent: state.total_spent,
                total_visits: state.total_visits,
                last_visit_at: state.last_visit_at,
                last_tier_review_at: state.last_tier_review_at,
                last_tier_downgrade_at: null,
                tier_recovery_started_at: null,
                last_point_expiry_check_at: null,
                created_at: state.customer.created_at,
                updated_at: lastEventAt,
            };
        }
    );

    return {
        pointTransactions,
        customerLoyalties,
        earnedPointsByBookingId,
        stateByCustomerId,
    };
};

const buildBookingUpdates = ({
    bookings,
    earnedPointsByBookingId,
}) => bookings.map((booking) => {
    const completedPaid = (
        booking.status === BOOKING_STATUS.COMPLETED
        && booking.payment_status === BOOKING_PAYMENT_STATUS.PAID
    );
    const earnedPoints = earnedPointsByBookingId.get(
        toId(booking._id)
    ) || 0;
    const rewardProcessedAt = completedPaid
        ? addMinutes(booking.paid_at, 1)
        : null;

    return {
        booking_id: booking._id,
        used_points: booking.used_points,
        points_discount_amount: booking.points_discount_amount,
        discount_amount: booking.discount_amount,
        final_price: booking.final_price,
        earned_points: earnedPoints,
        reward_processed: completedPaid,
        reward_processed_at: rewardProcessedAt,
        updated_at: rewardProcessedAt
            ? maxDate(booking.updated_at, rewardProcessedAt)
            : booking.updated_at,
    };
});

const toInspectionSnapshot = (inspection) => ({
    id: toId(inspection._id),
    type: inspection.type,
    note: inspection.note,
    images: (inspection.images || []).map((image) => ({
        image_url: image.image_url,
        public_id: image.public_id || null,
        caption: image.caption || null,
    })),
    inspected_by_id: toId(inspection.inspected_by),
    inspected_at: inspection.inspected_at,
});

const buildWashHistoryDefinitions = ({
    bookings,
    earnedPointsByBookingId,
}) => bookings.filter((booking) => (
    booking.status === BOOKING_STATUS.COMPLETED
    && booking.payment_status === BOOKING_PAYMENT_STATUS.PAID
)).map((booking) => {
    const createdAt = addMinutes(booking.paid_at, 1);

    return {
        wash_history_id_hex: stableHexId(
            'AUTOWASH_WASH_HISTORY_V1',
            toId(booking._id)
        ),
        booking_id: booking._id,
        customer_id:
            booking.customer_id || booking.claimed_customer_id || null,
        vehicle_id: booking.vehicle_id || null,
        garage_id: booking.garage_id,
        wash_bay_id: booking.wash_bay_id || null,
        service_package_id: booking.service_package_id,
        vehicle_type: booking.vehicle_type,
        amount_paid: booking.final_price,
        original_price: booking.original_price,
        discount_amount: booking.discount_amount,
        points_earned: earnedPointsByBookingId.get(
            toId(booking._id)
        ) || 0,
        points_used: booking.used_points || 0,
        payment_method: booking.payment_method,
        paid_at: booking.paid_at,
        service_started_at: booking.started_at || null,
        service_completed_at: booking.completed_at,
        created_at: createdAt,
        updated_at: createdAt,
    };
});

const buildHandoverDefinitions = ({
    bookings,
    inspectionByNaturalKey,
    staffByGarageId,
}) => bookings.filter((booking) => (
    booking.status === BOOKING_STATUS.COMPLETED
)).map((booking) => {
    const bookingId = toId(booking._id);
    const before = inspectionByNaturalKey.get(
        `${bookingId}:${VEHICLE_INSPECTION_TYPES.BEFORE_WASH}`
    );
    const after = inspectionByNaturalKey.get(
        `${bookingId}:${VEHICLE_INSPECTION_TYPES.AFTER_WASH}`
    );
    const staff = staffByGarageId.get(toId(booking.garage_id));

    if (
        !before
        || !after
        || before.images.length === 0
        || after.images.length === 0
    ) {
        throw new Error(
            `Handover inspection dependency is missing: ${bookingId}`
        );
    }

    if (!staff) {
        throw new Error(
            `Handover staff dependency is missing: ${booking.garage_id}`
        );
    }

    const paid = booking.payment_status === BOOKING_PAYMENT_STATUS.PAID;
    const accepted = paid || !booking.is_walk_in;
    const readyAt = addMinutes(booking.completed_at, 1);
    const acceptedAt = accepted
        ? addMinutes(booking.completed_at, 3)
        : null;
    const releasedAt = paid
        ? maxDate(
            addMinutes(booking.paid_at, 2),
            addMinutes(acceptedAt, 2)
        )
        : null;
    const updatedAt = releasedAt || acceptedAt || readyAt;

    return {
        handover_id_hex: stableHexId(
            'AUTOWASH_BOOKING_HANDOVER_V1',
            bookingId
        ),
        booking_id: booking._id,
        garage_id: booking.garage_id,
        customer_id: booking.customer_id || null,
        guest_name: booking.guest_name || null,
        guest_phone:
            booking.normalized_guest_phone
            || booking.guest_phone
            || null,
        vehicle_id: booking.vehicle_id || null,
        state: paid
            ? BOOKING_HANDOVER_STATES.RELEASED
            : BOOKING_HANDOVER_STATES.READY_FOR_CUSTOMER,
        customer_response: accepted
            ? BOOKING_HANDOVER_RESPONSES.ACCEPTED
            : BOOKING_HANDOVER_RESPONSES.PENDING,
        ready_at: readyAt,
        ready_by_id: staff.user_id,
        ready_note: 'Xe đã được kiểm tra và sẵn sàng bàn giao.',
        customer_responded_at: acceptedAt,
        customer_response_source: accepted
            ? booking.is_walk_in
                ? BOOKING_HANDOVER_RESPONSE_SOURCES.STAFF_ASSISTED
                : BOOKING_HANDOVER_RESPONSE_SOURCES.CUSTOMER_SELF_SERVICE
            : null,
        customer_response_recorded_by_id: accepted
            ? booking.is_walk_in
                ? staff.user_id
                : booking.customer_id
            : null,
        customer_response_note: accepted
            ? 'Khách hàng xác nhận tình trạng xe sau dịch vụ.'
            : null,
        accepted_at: acceptedAt,
        released_at: releasedAt,
        released_by_id: releasedAt ? staff.user_id : null,
        release_note: releasedAt
            ? 'Đã hoàn tất thanh toán và bàn giao xe cho khách hàng.'
            : null,
        issue_case_ids: [],
        inspection_snapshot: {
            before: toInspectionSnapshot(before),
            after: toInspectionSnapshot(after),
        },
        created_at: readyAt,
        updated_at: updatedAt,
    };
});

const validateDefinitions = ({
    pointTransactions,
    customerLoyalties,
    washHistories,
    handovers,
}) => {
    const pointNaturalKeys = new Set();

    for (const definition of pointTransactions) {
        const naturalKey = `${definition.booking_id}:${definition.type}`;

        if (pointNaturalKeys.has(naturalKey)) {
            throw new Error(
                `Duplicate point transaction key: ${naturalKey}`
            );
        }

        pointNaturalKeys.add(naturalKey);

        const validationError = new PointTransaction({
            _id: new mongoose.Types.ObjectId(
                definition.transaction_id_hex
            ),
            ...definition,
        }).validateSync();

        if (validationError) {
            throw validationError;
        }
    }

    for (const definition of customerLoyalties) {
        const validationError = new CustomerLoyalty(
            definition
        ).validateSync();

        if (validationError) {
            throw validationError;
        }
    }

    for (const definition of washHistories) {
        const validationError = new WashHistory({
            _id: new mongoose.Types.ObjectId(
                definition.wash_history_id_hex
            ),
            ...definition,
        }).validateSync();

        if (validationError) {
            throw validationError;
        }
    }

    for (const definition of handovers) {
        const validationError = new BookingHandover({
            _id: new mongoose.Types.ObjectId(
                definition.handover_id_hex
            ),
            ...definition,
        }).validateSync();

        if (validationError) {
            throw validationError;
        }
    }
};

const summarizePlan = ({
    pointTransactions,
    customerLoyalties,
    washHistories,
    handovers,
    redeemAssignments,
}) => ({
    point_transactions: {
        total: pointTransactions.length,
        by_type: countBy(
            pointTransactions,
            (transaction) => transaction.type
        ),
        redeemed_bookings: countBy(
            redeemAssignments,
            (assignment) => assignment.kind
        ),
        total_earned: pointTransactions
            .filter((transaction) => (
                transaction.type === POINT_TRANSACTION_TYPES.EARN
            ))
            .reduce(
                (total, transaction) => total + transaction.points,
                0
            ),
        total_redeemed: -pointTransactions
            .filter((transaction) => (
                transaction.type === POINT_TRANSACTION_TYPES.REDEEM
            ))
            .reduce(
                (total, transaction) => total + transaction.points,
                0
            ),
    },
    customer_loyalties: {
        total: customerLoyalties.length,
        active: customerLoyalties.filter(
            (loyalty) => loyalty.total_visits > 0
        ).length,
        inactive: customerLoyalties.filter(
            (loyalty) => loyalty.total_visits === 0
        ).length,
        by_tier: countBy(
            customerLoyalties,
            (loyalty) => loyalty.current_tier
        ),
    },
    wash_histories: {
        total: washHistories.length,
        customer: washHistories.filter(
            (history) => history.customer_id
        ).length,
        walk_in: washHistories.filter(
            (history) => !history.customer_id
        ).length,
    },
    handovers: {
        total: handovers.length,
        by_state: countBy(
            handovers,
            (handover) => handover.state
        ),
        by_response: countBy(
            handovers,
            (handover) => handover.customer_response
        ),
    },
});

const assertPlanTargets = (summary) => {
    if (
        summary.point_transactions.total !== POINT_TRANSACTION_TOTAL
        || !countsMatch(
            summary.point_transactions.by_type,
            Object.fromEntries(
                Object.entries(POINT_TRANSACTION_TARGETS)
                    .filter(([, count]) => count > 0)
            )
        )
        || !countsMatch(
            summary.point_transactions.redeemed_bookings,
            REDEEM_TARGETS
        )
    ) {
        throw new Error(
            `Point transaction targets mismatch: ${JSON.stringify(summary.point_transactions)}`
        );
    }

    if (
        summary.customer_loyalties.total
            !== CUSTOMER_LOYALTY_TARGETS.total
        || summary.customer_loyalties.active
            !== CUSTOMER_LOYALTY_TARGETS.active
        || summary.customer_loyalties.inactive
            !== CUSTOMER_LOYALTY_TARGETS.inactive
        || !countsMatch(
            summary.customer_loyalties.by_tier,
            CUSTOMER_LOYALTY_TARGETS.tier_distribution
        )
    ) {
        throw new Error(
            `Customer loyalty targets mismatch: ${JSON.stringify(summary.customer_loyalties)}`
        );
    }

    if (
        summary.wash_histories.total !== WASH_HISTORY_TARGETS.total
        || summary.wash_histories.customer
            !== WASH_HISTORY_TARGETS.customer
        || summary.wash_histories.walk_in
            !== WASH_HISTORY_TARGETS.walk_in
    ) {
        throw new Error(
            `Wash history targets mismatch: ${JSON.stringify(summary.wash_histories)}`
        );
    }

    if (
        summary.handovers.total !== HANDOVER_TARGETS.total
        || !countsMatch(
            summary.handovers.by_state,
            HANDOVER_TARGETS.by_state
        )
        || !countsMatch(
            summary.handovers.by_response,
            HANDOVER_TARGETS.by_response
        )
    ) {
        throw new Error(
            `Handover targets mismatch: ${JSON.stringify(summary.handovers)}`
        );
    }
};

const loadSeedDependencies = async ({
    referenceDate,
    session = null,
}) => {
    const paymentPromotionPlan = await buildPaymentPromotionPlan({
        referenceDate,
        session,
    });
    const customerPhones = buildCustomerSeedUsers(referenceDate).map(
        (customer) => normalizePhone(customer.phone)
    );
    const completedBookingIds = paymentPromotionPlan.plannedBookings
        .filter((booking) => booking.status === BOOKING_STATUS.COMPLETED)
        .map((booking) => booking._id);
    const queries = [
        User.find({
            phone: { $in: customerPhones },
            role: USER_ROLES.CUSTOMER,
        }),
        VehicleInspection.find({
            booking_id: { $in: completedBookingIds },
            type: {
                $in: [
                    VEHICLE_INSPECTION_TYPES.BEFORE_WASH,
                    VEHICLE_INSPECTION_TYPES.AFTER_WASH,
                ],
            },
        }),
    ];
    const [customers, inspections] = await Promise.all(
        queries.map((query) => applySession(query, session).lean())
    );

    if (customers.length !== CUSTOMER_LOYALTY_TARGETS.total) {
        throw new Error(
            `Seed customer dependencies are incomplete: ${customers.length}/${CUSTOMER_LOYALTY_TARGETS.total}`
        );
    }

    if (inspections.length !== HANDOVER_TARGETS.total * 2) {
        throw new Error(
            `Handover inspection dependencies are incomplete: ${inspections.length}/${HANDOVER_TARGETS.total * 2}`
        );
    }

    const inspectionByNaturalKey = new Map(inspections.map(
        (inspection) => [
            `${inspection.booking_id}:${inspection.type}`,
            inspection,
        ]
    ));

    return {
        paymentPromotionPlan,
        customers,
        inspections,
        inspectionByNaturalKey,
    };
};

const buildSeedPlan = async ({
    referenceDate = getSeedReferenceDate(),
    session = null,
} = {}) => {
    const dependencies = await loadSeedDependencies({
        referenceDate,
        session,
    });
    const paymentPromotionPlan = dependencies.paymentPromotionPlan;
    const baselineBookings = stripSeedPointEffects(
        paymentPromotionPlan.plannedBookings
    );
    const baselineTimeline = buildCustomerTierTimeline({
        bookings: baselineBookings,
        servicePackageById:
            paymentPromotionPlan.servicePackageById,
        tierRules: paymentPromotionPlan.tierRules,
        finalPriceByBookingId: new Map(baselineBookings.map(
            (booking) => [toId(booking._id), booking.final_price]
        )),
    });
    const redeemAssignments = selectRedeemAssignments({
        bookings: baselineBookings,
        timeline: baselineTimeline,
    });
    const stabilized = stabilizePointAdjustedBookings({
        baselineBookings,
        assignments: redeemAssignments,
        promotionByCode: paymentPromotionPlan.promotionByCode,
        servicePackageById:
            paymentPromotionPlan.servicePackageById,
        tierRules: paymentPromotionPlan.tierRules,
    });
    const ledger = buildPointLedger({
        bookings: stabilized.bookings,
        customers: dependencies.customers,
        assignments: redeemAssignments,
        servicePackageById:
            paymentPromotionPlan.servicePackageById,
        tierRules: paymentPromotionPlan.tierRules,
    });
    const bookingUpdates = buildBookingUpdates({
        bookings: stabilized.bookings,
        earnedPointsByBookingId: ledger.earnedPointsByBookingId,
    });
    const washHistories = buildWashHistoryDefinitions({
        bookings: stabilized.bookings,
        earnedPointsByBookingId: ledger.earnedPointsByBookingId,
    });
    const handovers = buildHandoverDefinitions({
        bookings: stabilized.bookings,
        inspectionByNaturalKey: dependencies.inspectionByNaturalKey,
        staffByGarageId: paymentPromotionPlan.staffByGarageId,
    });

    validateDefinitions({
        pointTransactions: ledger.pointTransactions,
        customerLoyalties: ledger.customerLoyalties,
        washHistories,
        handovers,
    });

    const summary = summarizePlan({
        pointTransactions: ledger.pointTransactions,
        customerLoyalties: ledger.customerLoyalties,
        washHistories,
        handovers,
        redeemAssignments,
    });

    assertPlanTargets(summary);

    return {
        ...dependencies,
        ...stabilized,
        ...ledger,
        bookingIds: paymentPromotionPlan.bookingIds,
        bookingUpdates,
        redeemAssignments,
        washHistories,
        handovers,
        summary,
    };
};

const writeBookingUpdates = async ({
    bookingUpdates,
    session,
}) => {
    const result = await Booking.bulkWrite(
        bookingUpdates.map((definition) => {
            const {
                booking_id: bookingId,
                ...values
            } = definition;

            return {
                updateOne: {
                    filter: { _id: bookingId },
                    update: { $set: values },
                },
            };
        }),
        {
            ordered: true,
            session,
            timestamps: false,
        }
    );

    return {
        planned: bookingUpdates.length,
        matched: result.matchedCount,
        modified: result.modifiedCount,
    };
};

const writePaymentAmounts = async ({
    bookings,
    bookingIds,
    session,
}) => {
    const bookingById = new Map(bookings.map((booking) => [
        toId(booking._id),
        booking,
    ]));
    const payments = await applySession(
        PaymentTransaction.find({
            booking_id: { $in: bookingIds },
        }),
        session
    ).lean();
    const operations = payments.map((payment) => {
        const booking = bookingById.get(toId(payment.booking_id));

        if (!booking) {
            throw new Error(
                `Payment booking dependency is missing: ${payment._id}`
            );
        }

        return {
            updateOne: {
                filter: { _id: payment._id },
                update: {
                    $set: {
                        amount: booking.final_price,
                        'raw_webhook.amount': booking.final_price,
                    },
                },
            },
        };
    });
    const result = operations.length > 0
        ? await PaymentTransaction.bulkWrite(operations, {
            ordered: true,
            session,
            timestamps: false,
        })
        : { matchedCount: 0, modifiedCount: 0 };

    return {
        planned: operations.length,
        matched: result.matchedCount,
        modified: result.modifiedCount,
    };
};

const writePointTransactions = async ({
    definitions,
    customerIds,
    session,
}) => {
    const expectedIds = new Set(definitions.map(
        (definition) => definition.transaction_id_hex
    ));
    const existing = await applySession(
        PointTransaction.find({
            customer_id: { $in: customerIds },
        }).select('_id'),
        session
    ).lean();
    const staleIds = existing
        .filter((transaction) => !expectedIds.has(toId(transaction._id)))
        .map((transaction) => transaction._id);

    if (staleIds.length > 0) {
        await PointTransaction.deleteMany({
            _id: { $in: staleIds },
        }).session(session || null);
    }

    const result = await PointTransaction.bulkWrite(
        definitions.map((definition) => {
            const {
                transaction_id_hex: transactionIdHex,
                ...values
            } = definition;

            return {
                replaceOne: {
                    filter: {
                        _id: new mongoose.Types.ObjectId(
                            transactionIdHex
                        ),
                    },
                    replacement: {
                        _id: new mongoose.Types.ObjectId(
                            transactionIdHex
                        ),
                        ...values,
                    },
                    upsert: true,
                },
            };
        }),
        {
            ordered: true,
            session,
            timestamps: false,
        }
    );

    return {
        planned: definitions.length,
        inserted: result.upsertedCount,
        matched: result.matchedCount,
        modified: result.modifiedCount,
        deleted: staleIds.length,
    };
};

const writeCustomerLoyalties = async ({
    definitions,
    session,
}) => {
    const result = await CustomerLoyalty.bulkWrite(
        definitions.map((definition) => ({
            replaceOne: {
                filter: { customer_id: definition.customer_id },
                replacement: definition,
                upsert: true,
            },
        })),
        {
            ordered: true,
            session,
            timestamps: false,
        }
    );

    return {
        planned: definitions.length,
        inserted: result.upsertedCount,
        matched: result.matchedCount,
        modified: result.modifiedCount,
    };
};

const writeBookingLinkedDefinitions = async ({
    model,
    bookingIds,
    definitions,
    idField,
    session,
}) => {
    const expectedIds = new Set(definitions.map(
        (definition) => definition[idField]
    ));
    const existing = await applySession(
        model.find({
            booking_id: { $in: bookingIds },
        }).select('_id'),
        session
    ).lean();
    const staleIds = existing
        .filter((document) => !expectedIds.has(toId(document._id)))
        .map((document) => document._id);

    if (staleIds.length > 0) {
        await model.deleteMany({
            _id: { $in: staleIds },
        }).session(session || null);
    }

    const result = await model.bulkWrite(
        definitions.map((definition) => {
            const idHex = definition[idField];
            const values = { ...definition };

            delete values[idField];

            return {
                replaceOne: {
                    filter: {
                        _id: new mongoose.Types.ObjectId(idHex),
                    },
                    replacement: {
                        _id: new mongoose.Types.ObjectId(idHex),
                        ...values,
                    },
                    upsert: true,
                },
            };
        }),
        {
            ordered: true,
            session,
            timestamps: false,
        }
    );

    return {
        planned: definitions.length,
        inserted: result.upsertedCount,
        matched: result.matchedCount,
        modified: result.modifiedCount,
        deleted: staleIds.length,
    };
};

const seedLoyaltyHistoriesHandoversData = async ({
    session = null,
    referenceDate = getSeedReferenceDate(),
    dryRun = false,
} = {}) => {
    console.log(
        '== Seeding loyalty, wash histories and handovers =='
    );

    const plan = await buildSeedPlan({
        referenceDate,
        session,
    });

    if (dryRun) {
        return {
            dry_run: true,
            ...plan.summary,
        };
    }

    const bookingWrite = await writeBookingUpdates({
        bookingUpdates: plan.bookingUpdates,
        session,
    });
    const paymentWrite = await writePaymentAmounts({
        bookings: plan.bookings,
        bookingIds: plan.bookingIds,
        session,
    });
    const pointWrite = await writePointTransactions({
        definitions: plan.pointTransactions,
        customerIds: plan.customers.map((customer) => customer._id),
        session,
    });
    const loyaltyWrite = await writeCustomerLoyalties({
        definitions: plan.customerLoyalties,
        session,
    });
    const washHistoryWrite = await writeBookingLinkedDefinitions({
        model: WashHistory,
        bookingIds: plan.bookingIds,
        definitions: plan.washHistories,
        idField: 'wash_history_id_hex',
        session,
    });
    const handoverWrite = await writeBookingLinkedDefinitions({
        model: BookingHandover,
        bookingIds: plan.bookingIds,
        definitions: plan.handovers,
        idField: 'handover_id_hex',
        session,
    });

    console.table([{
        point_transactions: plan.pointTransactions.length,
        point_inserted: pointWrite.inserted,
        point_matched: pointWrite.matched,
        customer_loyalties: plan.customerLoyalties.length,
        wash_histories: plan.washHistories.length,
        handovers: plan.handovers.length,
    }]);
    console.log(
        'Loyalty, wash histories and handovers seeding completed'
    );

    return {
        dry_run: false,
        ...plan.summary,
        writes: {
            bookings: bookingWrite,
            payments: paymentWrite,
            point_transactions: pointWrite,
            customer_loyalties: loyaltyWrite,
            wash_histories: washHistoryWrite,
            handovers: handoverWrite,
        },
    };
};

const sameDate = (left, right) => (
    (left ? new Date(left).getTime() : null)
    === (right ? new Date(right).getTime() : null)
);

const sameId = (left, right) => (
    (left ? toId(left) : null) === (right ? toId(right) : null)
);

const verifyLoyaltyHistoriesHandovers = async ({
    referenceDate = getSeedReferenceDate(),
} = {}) => {
    const plan = await buildSeedPlan({ referenceDate });
    const customerIds = plan.customers.map((customer) => customer._id);
    const [
        bookings,
        payments,
        pointTransactions,
        customerLoyalties,
        washHistories,
        handovers,
        staffProfiles,
    ] = await Promise.all([
        Booking.find({ _id: { $in: plan.bookingIds } }).lean(),
        PaymentTransaction.find({
            booking_id: { $in: plan.bookingIds },
        }).lean(),
        PointTransaction.find({
            customer_id: { $in: customerIds },
        }).lean(),
        CustomerLoyalty.find({
            customer_id: { $in: customerIds },
        }).lean(),
        WashHistory.find({
            booking_id: { $in: plan.bookingIds },
        }).lean(),
        BookingHandover.find({
            booking_id: { $in: plan.bookingIds },
        }).lean(),
        User.find({
            _id: {
                $in: plan.handovers.flatMap((handover) => [
                    handover.ready_by_id,
                    handover.released_by_id,
                ]).filter(Boolean),
            },
        }).select('_id role').lean(),
    ]);
    const expectedBookingById = new Map(plan.bookings.map((booking) => [
        toId(booking._id),
        booking,
    ]));
    const expectedPointById = new Map(
        plan.pointTransactions.map((transaction) => [
            transaction.transaction_id_hex,
            transaction,
        ])
    );
    const expectedLoyaltyByCustomerId = new Map(
        plan.customerLoyalties.map((loyalty) => [
            toId(loyalty.customer_id),
            loyalty,
        ])
    );
    const expectedWashById = new Map(
        plan.washHistories.map((history) => [
            history.wash_history_id_hex,
            history,
        ])
    );
    const expectedHandoverById = new Map(
        plan.handovers.map((handover) => [
            handover.handover_id_hex,
            handover,
        ])
    );
    const staffUserIds = new Set(
        staffProfiles
            .filter((user) => user.role === USER_ROLES.STAFF)
            .map((user) => toId(user._id))
    );

    if (
        bookings.length !== 420
        || payments.length !== 137
        || pointTransactions.length !== POINT_TRANSACTION_TOTAL
        || customerLoyalties.length
            !== CUSTOMER_LOYALTY_TARGETS.total
        || washHistories.length !== WASH_HISTORY_TARGETS.total
        || handovers.length !== HANDOVER_TARGETS.total
    ) {
        throw new Error(
            `Persisted loyalty lifecycle totals mismatch: ${bookings.length}/${payments.length}/${pointTransactions.length}/${customerLoyalties.length}/${washHistories.length}/${handovers.length}`
        );
    }

    for (const booking of bookings) {
        const expected = expectedBookingById.get(toId(booking._id));

        if (
            !expected
            || booking.used_points !== expected.used_points
            || booking.points_discount_amount
                !== expected.points_discount_amount
            || booking.discount_amount !== expected.discount_amount
            || booking.final_price !== expected.final_price
            || booking.earned_points
                !== (
                    plan.earnedPointsByBookingId.get(
                        toId(booking._id)
                    ) || 0
                )
            || booking.reward_processed
                !== (
                    booking.status === BOOKING_STATUS.COMPLETED
                    && booking.payment_status
                        === BOOKING_PAYMENT_STATUS.PAID
                )
            || (
                booking.reward_processed
                && !sameDate(
                    booking.reward_processed_at,
                    addMinutes(booking.paid_at, 1)
                )
            )
            || booking.updated_at < booking.created_at
        ) {
            throw new Error(
                `Persisted booking reward mismatch: ${booking._id}`
            );
        }
    }

    const bookingById = new Map(bookings.map((booking) => [
        toId(booking._id),
        booking,
    ]));

    for (const payment of payments) {
        const booking = bookingById.get(toId(payment.booking_id));

        if (
            !booking
            || payment.amount !== booking.final_price
            || payment.raw_webhook?.amount !== booking.final_price
        ) {
            throw new Error(
                `Persisted payment reward amount mismatch: ${payment._id}`
            );
        }
    }

    const pointNaturalKeys = new Set();

    for (const transaction of pointTransactions) {
        const expected = expectedPointById.get(toId(transaction._id));
        const naturalKey = `${transaction.booking_id}:${transaction.type}`;

        if (
            !expected
            || pointNaturalKeys.has(naturalKey)
            || !sameId(transaction.customer_id, expected.customer_id)
            || !sameId(transaction.booking_id, expected.booking_id)
            || transaction.type !== expected.type
            || transaction.points !== expected.points
            || transaction.remaining_points
                !== expected.remaining_points
            || transaction.balance_before !== expected.balance_before
            || transaction.balance_after !== expected.balance_after
            || !sameDate(transaction.earned_at, expected.earned_at)
            || !sameDate(transaction.expires_at, expected.expires_at)
            || transaction.source_transaction_ids.map(toId).join(',')
                !== expected.source_transaction_ids.map(toId).join(',')
            || transaction.updated_at < transaction.created_at
        ) {
            throw new Error(
                `Invalid persisted point transaction: ${transaction._id}`
            );
        }

        pointNaturalKeys.add(naturalKey);
    }

    for (const loyalty of customerLoyalties) {
        const expected = expectedLoyaltyByCustomerId.get(
            toId(loyalty.customer_id)
        );

        if (
            !expected
            || loyalty.current_tier !== expected.current_tier
            || loyalty.total_points !== expected.total_points
            || loyalty.available_points !== expected.available_points
            || loyalty.redeemed_points !== expected.redeemed_points
            || loyalty.expired_points !== expected.expired_points
            || loyalty.total_spent !== expected.total_spent
            || loyalty.total_visits !== expected.total_visits
            || !sameDate(loyalty.last_visit_at, expected.last_visit_at)
            || !sameDate(
                loyalty.last_tier_review_at,
                expected.last_tier_review_at
            )
            || loyalty.updated_at < loyalty.created_at
        ) {
            throw new Error(
                `Invalid persisted customer loyalty: ${loyalty._id}`
            );
        }
    }

    for (const history of washHistories) {
        const expected = expectedWashById.get(toId(history._id));
        const booking = bookingById.get(toId(history.booking_id));

        if (
            !expected
            || !booking
            || booking.status !== BOOKING_STATUS.COMPLETED
            || booking.payment_status !== BOOKING_PAYMENT_STATUS.PAID
            || history.amount_paid !== booking.final_price
            || history.points_earned !== booking.earned_points
            || history.points_used !== booking.used_points
            || history.discount_amount !== booking.discount_amount
            || !sameDate(history.paid_at, booking.paid_at)
            || !sameDate(
                history.service_completed_at,
                booking.completed_at
            )
            || history.created_at < history.paid_at
            || !sameId(history.customer_id, expected.customer_id)
        ) {
            throw new Error(
                `Invalid persisted wash history: ${history._id}`
            );
        }
    }

    for (const handover of handovers) {
        const expected = expectedHandoverById.get(toId(handover._id));
        const booking = bookingById.get(toId(handover.booking_id));

        if (
            !expected
            || !booking
            || booking.status !== BOOKING_STATUS.COMPLETED
            || handover.state !== expected.state
            || handover.customer_response
                !== expected.customer_response
            || !sameDate(handover.ready_at, expected.ready_at)
            || !sameDate(handover.accepted_at, expected.accepted_at)
            || !sameDate(handover.released_at, expected.released_at)
            || handover.ready_at <= booking.completed_at
            || (
                handover.state === BOOKING_HANDOVER_STATES.RELEASED
                && (
                    booking.payment_status
                        !== BOOKING_PAYMENT_STATUS.PAID
                    || !handover.released_at
                    || handover.released_at <= handover.accepted_at
                    || !staffUserIds.has(toId(handover.released_by_id))
                )
            )
            || !staffUserIds.has(toId(handover.ready_by_id))
            || !handover.inspection_snapshot?.before?.images?.length
            || !handover.inspection_snapshot?.after?.images?.length
            || handover.updated_at < handover.created_at
        ) {
            throw new Error(
                `Invalid persisted booking handover: ${handover._id}`
            );
        }
    }

    const summary = summarizePlan({
        pointTransactions,
        customerLoyalties,
        washHistories,
        handovers,
        redeemAssignments: plan.redeemAssignments,
    });

    assertPlanTargets(summary);

    return summary;
};

const seedLoyaltyHistoriesHandovers = async ({
    dryRun = process.argv.includes('--dry-run'),
} = {}) => {
    const referenceDate = getSeedReferenceDate();

    await connectDB();

    if (dryRun) {
        try {
            return await seedLoyaltyHistoriesHandoversData({
                referenceDate,
                dryRun: true,
            });
        } finally {
            await disconnectDB();
        }
    }

    const session = await Booking.startSession();
    const result = {
        dry_run: false,
        reference_date: referenceDate,
    };

    try {
        await session.withTransaction(async () => {
            result.seed = await seedLoyaltyHistoriesHandoversData({
                session,
                referenceDate,
            });
        });

        result.payment_promotion_verification =
            await verifyPaymentsPromotionUsages({ referenceDate });
        result.verification =
            await verifyLoyaltyHistoriesHandovers({ referenceDate });

        return result;
    } finally {
        await session.endSession();
        await disconnectDB();
    }
};

const run = async () => {
    try {
        const result = await seedLoyaltyHistoriesHandovers();

        console.log(
            'Loyalty, wash histories and handovers seed completed'
        );
        console.dir(result.verification || result, { depth: null });
    } catch (error) {
        console.error(
            'Loyalty, wash histories and handovers seed failed:',
            error
        );
        process.exitCode = 1;

        await disconnectDB().catch(() => {});
    }
};

if (require.main === module) {
    run();
}

module.exports = {
    stripSeedPointEffects,
    getRedeemPointLimit,
    buildRedeemCandidates,
    selectRedeemAssignments,
    applyRedeemAssignments,
    stabilizePointAdjustedBookings,
    buildPointLedger,
    buildBookingUpdates,
    buildWashHistoryDefinitions,
    buildHandoverDefinitions,
    validateDefinitions,
    summarizePlan,
    assertPlanTargets,
    buildSeedPlan,
    seedLoyaltyHistoriesHandoversData,
    verifyLoyaltyHistoriesHandovers,
    seedLoyaltyHistoriesHandovers,
};
