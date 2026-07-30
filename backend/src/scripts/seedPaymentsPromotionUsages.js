require('dotenv').config();

const mongoose = require('mongoose');

const Booking = require('../modules/bookings/booking.model');
const PaymentTransaction = require('../modules/payments/paymentTransaction.model');
const PromotionUsage = require('../modules/promotion-usages/promotionUsage.model');
const Promotion = require('../modules/promotions/promotion.model');
const ServicePackage = require('../modules/service-packages/servicePackage.model');
const StaffProfile = require('../modules/staff-profiles/staffProfile.model');
const TierRule = require('../modules/loyalty/tierRule.model');
const { connectDB, disconnectDB } = require('../config/db');
const {
    BOOKING_PAYMENT_METHOD,
    BOOKING_PAYMENT_STATUS,
    BOOKING_STATUS,
} = require('../shared/constants/booking.constant');
const {
    PAYMENT_CURRENCY,
    PAYMENT_INITIATED_CHANNEL,
    PAYMENT_METHOD,
    PAYMENT_PROVIDER,
    PAYMENT_TRANSACTION_STATUS,
} = require('../shared/constants/payment.constant');
const {
    PROMOTION_AUDIENCES,
    PROMOTION_DISCOUNT_TYPES,
    PROMOTION_USAGE_STATUS,
} = require('../shared/constants/promotion.constant');
const {
    STAFF_EMPLOYMENT_STATUS,
    STAFF_TYPES,
} = require('../shared/constants/staff.constant');
const { USER_ROLES } = require('../shared/constants/roles.constant');
const {
    buildBookingScenarios,
    stableHexId,
} = require('./seedBookingCatalog');
const {
    NO_USAGE_PROMOTION_CODES,
    PAYMENT_STATUS_TARGETS,
    PAYMENT_TRANSACTION_TOTAL,
    PROMOTION_USAGE_TARGETS,
    PROMOTION_USAGE_TOTAL,
    PROMOTION_USAGE_TOTALS,
} = require('./seedPaymentsPromotionUsagesCatalog');
const { getSeedReferenceDate } = require('./seedTime');

const SEED_PAYMENT_SOURCE = 'AUTOWASH_PAYMENT_SEED_V1';
const HISTORICAL_PROMOTION_CODES = new Set(['GRANDOPENING15']);
const PAYMENT_ORDER_CODE_BASE = 700000000000000;
const PAYMENT_LINK_BASE_URL = 'https://seed.invalid/payos';

const toId = (value) => String(value?._id || value || '');

const addMinutes = (value, minutes) => new Date(
    new Date(value).getTime() + minutes * 60000
);

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

const sortByRank = (values, namespace, selector) => [...values].sort(
    (left, right) => (
        rankValue(namespace, selector(left))
        - rankValue(namespace, selector(right))
    )
);

const calculatePromotionDiscount = (promotion, orderAmount) => {
    let discountAmount = 0;

    if (
        promotion.discount_type
        === PROMOTION_DISCOUNT_TYPES.PERCENTAGE
    ) {
        discountAmount = Math.floor(
            orderAmount * promotion.discount_value / 100
        );

        if (promotion.max_discount_amount !== null) {
            discountAmount = Math.min(
                discountAmount,
                promotion.max_discount_amount
            );
        }
    }

    if (
        promotion.discount_type
        === PROMOTION_DISCOUNT_TYPES.FIXED_AMOUNT
    ) {
        discountAmount = promotion.discount_value;
    }

    return Math.min(Math.max(discountAmount, 0), orderAmount);
};

const getHighestEligibleTier = (metrics, tierRules) => {
    const eligibleRule = [...tierRules]
        .sort((left, right) => (
            right.priority_level - left.priority_level
        ))
        .find((tierRule) => (
            metrics.total_spent >= tierRule.min_total_spent
            && metrics.total_visits >= tierRule.min_total_visits
            && metrics.total_points >= tierRule.min_total_points
        ));

    return eligibleRule?.tier_name || 'BRONZE';
};

const getPackageBasePoints = (booking, servicePackageById) => {
    const packageIds = [
        booking.service_package_id,
        ...(booking.add_on_service_ids || []),
    ];

    return packageIds.reduce((total, packageId) => (
        total + (
            Number(
                servicePackageById.get(toId(packageId))?.points_earned
            ) || 0
        )
    ), 0);
};

const buildCustomerTierTimeline = ({
    bookings,
    servicePackageById,
    tierRules,
    finalPriceByBookingId = new Map(),
}) => {
    const events = [];

    for (const booking of bookings) {
        if (!booking.customer_id) {
            continue;
        }

        events.push({
            type: 'CREATED',
            at: booking.created_at,
            booking,
        });

        if (
            booking.status === BOOKING_STATUS.COMPLETED
            && booking.payment_status === BOOKING_PAYMENT_STATUS.PAID
            && booking.paid_at
        ) {
            events.push({
                type: 'PAID',
                at: booking.paid_at,
                booking,
            });
        }
    }

    events.sort((left, right) => (
        left.at - right.at
        || (left.type === 'PAID' ? -1 : 1)
        || toId(left.booking._id).localeCompare(toId(right.booking._id))
    ));

    const metricsByCustomerId = new Map();
    const tierContextByBookingId = new Map();
    const earnedPointsByBookingId = new Map();
    const tierRuleByName = new Map(
        tierRules.map((tierRule) => [
            tierRule.tier_name,
            tierRule,
        ])
    );

    for (const event of events) {
        const booking = event.booking;
        const customerId = toId(booking.customer_id);
        const metrics = metricsByCustomerId.get(customerId) || {
            current_tier: 'BRONZE',
            total_spent: 0,
            total_visits: 0,
            total_points: 0,
        };

        if (event.type === 'CREATED') {
            tierContextByBookingId.set(toId(booking._id), {
                current_tier: metrics.current_tier,
                total_spent: metrics.total_spent,
                total_visits: metrics.total_visits,
                total_points: metrics.total_points,
            });
            continue;
        }

        const finalPrice = finalPriceByBookingId.get(
            toId(booking._id)
        ) ?? booking.original_price;
        const multiplier = tierRuleByName.get(
            metrics.current_tier
        )?.point_multiplier || 1;
        const paymentRatio = booking.original_price > 0
            ? finalPrice / booking.original_price
            : 0;
        const earnedPoints = Math.floor(
            getPackageBasePoints(booking, servicePackageById)
            * multiplier
            * paymentRatio
        );

        metrics.total_spent += finalPrice;
        metrics.total_visits += 1;
        metrics.total_points += earnedPoints;
        metrics.current_tier = getHighestEligibleTier(
            metrics,
            tierRules
        );
        metricsByCustomerId.set(customerId, metrics);
        earnedPointsByBookingId.set(toId(booking._id), earnedPoints);
    }

    return {
        tierContextByBookingId,
        earnedPointsByBookingId,
        metricsByCustomerId,
    };
};

const bookingMatchesUsageStatus = (booking, status) => {
    if (status === PROMOTION_USAGE_STATUS.CONSUMED) {
        return (
            booking.status === BOOKING_STATUS.COMPLETED
            && booking.payment_status === BOOKING_PAYMENT_STATUS.PAID
        );
    }

    if (status === PROMOTION_USAGE_STATUS.RESERVED) {
        return booking.status === BOOKING_STATUS.CONFIRMED;
    }

    if (status === PROMOTION_USAGE_STATUS.RELEASED) {
        return [
            BOOKING_STATUS.CANCELED,
            BOOKING_STATUS.NO_SHOW,
        ].includes(booking.status);
    }

    return false;
};

const promotionMatchesBooking = ({
    promotion,
    booking,
    status,
    tierContext,
}) => {
    const appliedAt = booking.created_at;
    const isHistoricalPromotion = HISTORICAL_PROMOTION_CODES.has(
        promotion.code
    );

    if (
        !bookingMatchesUsageStatus(booking, status)
        || (!promotion.is_active && !isHistoricalPromotion)
        || appliedAt < promotion.start_at
        || appliedAt > promotion.end_at
        || booking.original_price < promotion.min_order_amount
    ) {
        return false;
    }

    if (
        (
            promotion.audience === PROMOTION_AUDIENCES.CUSTOMER
            && !booking.customer_id
        )
        || (
            promotion.audience === PROMOTION_AUDIENCES.WALK_IN
            && booking.customer_id
        )
    ) {
        return false;
    }

    if (
        promotion.phone_required
        && !booking.normalized_guest_phone
    ) {
        return false;
    }

    if (
        promotion.applicable_tiers?.length
        && (
            !tierContext
            || !promotion.applicable_tiers.includes(
                tierContext.current_tier
            )
        )
    ) {
        return false;
    }

    if (
        promotion.applicable_vehicle_types?.length
        && !promotion.applicable_vehicle_types.includes(
            booking.vehicle_type
        )
    ) {
        return false;
    }

    if (
        promotion.applicable_service_package_ids?.length
        && !promotion.applicable_service_package_ids.some(
            (packageId) => (
                toId(packageId) === toId(booking.service_package_id)
            )
        )
    ) {
        return false;
    }

    return true;
};

const selectPromotionAssignments = ({
    bookings,
    promotionByCode,
    tierContextByBookingId,
}) => {
    const selectedBookingIds = new Set();
    const nonreleasedCustomerCounts = new Map();
    const nonreleasedPhoneKeys = new Set();
    const assignments = [];

    for (const [promotionCode, statusTargets] of Object.entries(
        PROMOTION_USAGE_TARGETS
    )) {
        const promotion = promotionByCode.get(promotionCode);

        if (!promotion) {
            throw new Error(
                `Promotion seed dependency is missing: ${promotionCode}`
            );
        }

        for (const [status, target] of Object.entries(statusTargets)) {
            if (target === 0) {
                continue;
            }

            const candidates = sortByRank(
                bookings.filter((booking) => {
                    const bookingId = toId(booking._id);
                    const customerKey = booking.customer_id
                        ? `${promotionCode}:${booking.customer_id}`
                        : null;
                    const phoneKey = booking.normalized_guest_phone
                        ? `${promotionCode}:${booking.normalized_guest_phone}`
                        : null;

                    if (
                        selectedBookingIds.has(bookingId)
                        || !promotionMatchesBooking({
                            promotion,
                            booking,
                            status,
                            tierContext:
                                tierContextByBookingId.get(bookingId),
                        })
                    ) {
                        return false;
                    }

                    if (
                        status !== PROMOTION_USAGE_STATUS.RELEASED
                        && promotion.per_customer_limit
                        && (
                            nonreleasedCustomerCounts.get(customerKey)
                            || 0
                        ) >= promotion.per_customer_limit
                    ) {
                        return false;
                    }

                    if (
                        status !== PROMOTION_USAGE_STATUS.RELEASED
                        && promotion.per_phone_limit
                        && nonreleasedPhoneKeys.has(phoneKey)
                    ) {
                        return false;
                    }

                    return true;
                }),
                `PROMOTION_${promotionCode}_${status}`,
                (booking) => toId(booking._id)
            );

            if (candidates.length < target) {
                throw new Error(
                    `Promotion usage target is not feasible: ${promotionCode}:${status}:${candidates.length}/${target}`
                );
            }

            for (const booking of candidates.slice(0, target)) {
                const customerKey = booking.customer_id
                    ? `${promotionCode}:${booking.customer_id}`
                    : null;
                const phoneKey = booking.normalized_guest_phone
                    ? `${promotionCode}:${booking.normalized_guest_phone}`
                    : null;

                selectedBookingIds.add(toId(booking._id));
                assignments.push({
                    booking,
                    promotion,
                    status,
                });

                if (
                    status !== PROMOTION_USAGE_STATUS.RELEASED
                    && customerKey
                ) {
                    nonreleasedCustomerCounts.set(
                        customerKey,
                        (
                            nonreleasedCustomerCounts.get(customerKey)
                            || 0
                        ) + 1
                    );
                }

                if (
                    status !== PROMOTION_USAGE_STATUS.RELEASED
                    && promotion.per_phone_limit
                    && phoneKey
                ) {
                    nonreleasedPhoneKeys.add(phoneKey);
                }
            }
        }
    }

    return assignments;
};

const buildPromotionPricePlan = ({ bookings, assignments }) => {
    const assignmentByBookingId = new Map(
        assignments.map((assignment) => [
            toId(assignment.booking._id),
            assignment,
        ])
    );
    const finalPriceByBookingId = new Map();
    const bookingPriceById = new Map();

    for (const booking of bookings) {
        const assignment = assignmentByBookingId.get(toId(booking._id));
        const promotionDiscountAmount = assignment
            ? calculatePromotionDiscount(
                assignment.promotion,
                booking.original_price
            )
            : 0;
        const pointsDiscountAmount =
            booking.points_discount_amount || 0;
        const voucherDiscountAmount =
            booking.voucher_discount_amount || 0;
        const discountAmount = Math.min(
            booking.original_price,
            promotionDiscountAmount
            + pointsDiscountAmount
            + voucherDiscountAmount
        );
        const finalPrice = Math.max(
            booking.original_price - discountAmount,
            0
        );
        const pricePlan = {
            promotion_id: assignment?.promotion._id || null,
            promotion_discount_amount: promotionDiscountAmount,
            points_discount_amount: pointsDiscountAmount,
            voucher_discount_amount: voucherDiscountAmount,
            discount_amount: discountAmount,
            final_price: finalPrice,
        };

        finalPriceByBookingId.set(toId(booking._id), finalPrice);
        bookingPriceById.set(toId(booking._id), pricePlan);
    }

    return {
        assignmentByBookingId,
        finalPriceByBookingId,
        bookingPriceById,
    };
};

const buildStablePromotionPlan = ({
    bookings,
    promotionByCode,
    servicePackageById,
    tierRules,
}) => {
    let finalPriceByBookingId = new Map(
        bookings.map((booking) => [
            toId(booking._id),
            Math.max(
                booking.original_price
                - (booking.points_discount_amount || 0)
                - (booking.voucher_discount_amount || 0),
                0
            ),
        ])
    );
    let lastSignature = null;

    for (let attempt = 0; attempt < 6; attempt += 1) {
        const timeline = buildCustomerTierTimeline({
            bookings,
            servicePackageById,
            tierRules,
            finalPriceByBookingId,
        });
        const assignments = selectPromotionAssignments({
            bookings,
            promotionByCode,
            tierContextByBookingId: timeline.tierContextByBookingId,
        });
        const pricePlan = buildPromotionPricePlan({
            bookings,
            assignments,
        });
        const finalTimeline = buildCustomerTierTimeline({
            bookings,
            servicePackageById,
            tierRules,
            finalPriceByBookingId: pricePlan.finalPriceByBookingId,
        });
        const invalidAssignment = assignments.find((assignment) => (
            !promotionMatchesBooking({
                promotion: assignment.promotion,
                booking: assignment.booking,
                status: assignment.status,
                tierContext: finalTimeline.tierContextByBookingId.get(
                    toId(assignment.booking._id)
                ),
            })
        ));
        const signature = assignments
            .map((assignment) => [
                assignment.promotion.code,
                assignment.status,
                toId(assignment.booking._id),
            ].join(':'))
            .sort()
            .join('|');

        if (!invalidAssignment && signature === lastSignature) {
            return {
                assignments,
                pricePlan,
                timeline: finalTimeline,
            };
        }

        if (!invalidAssignment && attempt === 5) {
            return {
                assignments,
                pricePlan,
                timeline: finalTimeline,
            };
        }

        finalPriceByBookingId = pricePlan.finalPriceByBookingId;
        lastSignature = signature;
    }

    throw new Error('Promotion timeline did not converge');
};

const buildPromotionUsageDefinitions = ({ assignments }) => (
    assignments.map((assignment) => {
        const { booking, promotion, status } = assignment;
        const bookingId = toId(booking._id);
        const reservedAt = booking.created_at;
        const consumedAt = status === PROMOTION_USAGE_STATUS.CONSUMED
            ? booking.paid_at
            : null;
        const releasedAt = status === PROMOTION_USAGE_STATUS.RELEASED
            ? booking.canceled_at || booking.no_show_at
            : null;
        const phoneUsageKey = (
            status !== PROMOTION_USAGE_STATUS.RELEASED
            && promotion.per_phone_limit
            && booking.normalized_guest_phone
        )
            ? `${promotion._id}:${booking.normalized_guest_phone}`
            : null;
        const updatedAt = consumedAt || releasedAt || reservedAt;

        if (
            status === PROMOTION_USAGE_STATUS.CONSUMED
            && !consumedAt
        ) {
            throw new Error(
                `Consumed promotion usage has no paid time: ${bookingId}`
            );
        }

        if (
            status === PROMOTION_USAGE_STATUS.RELEASED
            && !releasedAt
        ) {
            throw new Error(
                `Released promotion usage has no release time: ${bookingId}`
            );
        }

        return {
            usage_id_hex: stableHexId(
                'AUTOWASH_PROMOTION_USAGE_V1',
                bookingId
            ),
            promotion_id: promotion._id,
            booking_id: booking._id,
            customer_id: booking.customer_id || null,
            guest_phone_normalized:
                booking.normalized_guest_phone || null,
            phone_usage_key: phoneUsageKey,
            used_by_staff_id: booking.is_walk_in
                ? booking.created_by_staff_id
                : null,
            discount_amount: calculatePromotionDiscount(
                promotion,
                booking.original_price
            ),
            used_at: consumedAt,
            status,
            reserved_at: reservedAt,
            consumed_at: consumedAt,
            released_at: releasedAt,
            created_at: reservedAt,
            updated_at: updatedAt,
        };
    })
);

const getStaffActorForBooking = (booking, staffByGarageId) => {
    const staff = staffByGarageId.get(toId(booking.garage_id));

    if (!staff) {
        throw new Error(
            `Payment staff dependency is missing: ${booking.garage_id}`
        );
    }

    return {
        created_by_staff_id: staff.user_id,
        initiated_by_user_id: staff.user_id,
        initiated_by_role: USER_ROLES.STAFF,
        initiated_channel:
            PAYMENT_INITIATED_CHANNEL.STAFF_ASSISTED,
    };
};

const getCustomerActorForBooking = (booking) => {
    if (!booking.customer_id) {
        throw new Error(
            `Customer payment actor is missing: ${booking._id}`
        );
    }

    return {
        created_by_staff_id: null,
        initiated_by_user_id: booking.customer_id,
        initiated_by_role: USER_ROLES.CUSTOMER,
        initiated_channel:
            PAYMENT_INITIATED_CHANNEL.CUSTOMER_SELF_SERVICE,
    };
};

const buildPaymentPayload = ({
    booking,
    status,
    attemptKey,
    actor,
}) => {
    const paymentIdHex = stableHexId(
        'AUTOWASH_PAYMENT_TRANSACTION_V1',
        `${booking._id}:${attemptKey}`
    );
    const createdAt = addMinutes(booking.completed_at, 1);
    const expiresAt = addMinutes(createdAt, 15);
    const paidAt = status === PAYMENT_TRANSACTION_STATUS.PAID
        ? booking.paid_at
        : null;
    const canceledAt = status === PAYMENT_TRANSACTION_STATUS.CANCELED
        ? addMinutes(createdAt, 2)
        : null;
    const expiredAt = status === PAYMENT_TRANSACTION_STATUS.EXPIRED
        ? expiresAt
        : null;
    const failedAt = status === PAYMENT_TRANSACTION_STATUS.FAILED
        ? addMinutes(createdAt, 1)
        : null;
    const paymentLinkId = `seed_${paymentIdHex}`;
    const updatedAt = paidAt
        || canceledAt
        || expiredAt
        || failedAt
        || createdAt;

    return {
        payment_id_hex: paymentIdHex,
        natural_key: `${booking._id}:${attemptKey}`,
        booking_id: booking._id,
        provider: PAYMENT_PROVIDER.PAYOS,
        method: PAYMENT_METHOD.QR,
        payment_link_id: paymentLinkId,
        checkout_url: `${PAYMENT_LINK_BASE_URL}/${paymentLinkId}`,
        qr_code: `seed-payos:${paymentLinkId}`,
        amount: booking.final_price,
        currency: PAYMENT_CURRENCY.VND,
        status,
        paid_at: paidAt,
        expires_at: expiresAt,
        canceled_at: canceledAt,
        expired_at: expiredAt,
        ...actor,
        active_payment_key: null,
        raw_webhook: {
            source: SEED_PAYMENT_SOURCE,
            attempt: attemptKey,
            status,
            success: status === PAYMENT_TRANSACTION_STATUS.PAID,
            code: status === PAYMENT_TRANSACTION_STATUS.PAID
                ? '00'
                : null,
            amount: booking.final_price,
            paid_at: paidAt,
            failed_at: failedAt,
        },
        created_at: createdAt,
        updated_at: updatedAt,
    };
};

const buildPaymentDefinitions = ({
    bookings,
    staffByGarageId,
}) => {
    const paidPayosBookings = bookings.filter((booking) => (
        booking.status === BOOKING_STATUS.COMPLETED
        && booking.payment_status === BOOKING_PAYMENT_STATUS.PAID
        && booking.payment_method === BOOKING_PAYMENT_METHOD.PAYOS
    ));
    const customerPaidPayosBookings = paidPayosBookings.filter(
        (booking) => !booking.is_walk_in
    );
    const customerSelfServiceIds = new Set(
        sortByRank(
            customerPaidPayosBookings,
            'PAYMENT_CUSTOMER_SELF_SERVICE',
            (booking) => toId(booking._id)
        ).slice(0, 80).map((booking) => toId(booking._id))
    );
    const definitions = paidPayosBookings.map((booking) => {
        const actor = customerSelfServiceIds.has(toId(booking._id))
            ? getCustomerActorForBooking(booking)
            : getStaffActorForBooking(booking, staffByGarageId);

        return buildPaymentPayload({
            booking,
            status: PAYMENT_TRANSACTION_STATUS.PAID,
            attemptKey: 'PAID_FINAL',
            actor,
        });
    });
    const unpaidBookings = sortByRank(
        bookings.filter((booking) => (
            booking.status === BOOKING_STATUS.COMPLETED
            && booking.payment_status === BOOKING_PAYMENT_STATUS.UNPAID
        )),
        'PAYMENT_UNPAID_ATTEMPTS',
        (booking) => toId(booking._id)
    );
    const expiredBookings = unpaidBookings.slice(0, 6);
    const failedBookings = unpaidBookings.slice(6, 8);
    const canceledBookings = sortByRank(
        bookings.filter((booking) => (
            booking.status === BOOKING_STATUS.COMPLETED
            && booking.payment_status === BOOKING_PAYMENT_STATUS.PAID
            && booking.payment_method === BOOKING_PAYMENT_METHOD.CASH
            && !booking.is_walk_in
        )),
        'PAYMENT_CANCELED_BEFORE_CASH',
        (booking) => toId(booking._id)
    ).slice(0, 4);

    for (const booking of expiredBookings) {
        definitions.push(buildPaymentPayload({
            booking,
            status: PAYMENT_TRANSACTION_STATUS.EXPIRED,
            attemptKey: 'EXPIRED_ATTEMPT',
            actor: booking.is_walk_in
                ? getStaffActorForBooking(booking, staffByGarageId)
                : getCustomerActorForBooking(booking),
        }));
    }

    for (const booking of failedBookings) {
        definitions.push(buildPaymentPayload({
            booking,
            status: PAYMENT_TRANSACTION_STATUS.FAILED,
            attemptKey: 'FAILED_ATTEMPT',
            actor: booking.is_walk_in
                ? getStaffActorForBooking(booking, staffByGarageId)
                : getCustomerActorForBooking(booking),
        }));
    }

    for (const booking of canceledBookings) {
        definitions.push(buildPaymentPayload({
            booking,
            status: PAYMENT_TRANSACTION_STATUS.CANCELED,
            attemptKey: 'CANCELED_BEFORE_CASH',
            actor: getCustomerActorForBooking(booking),
        }));
    }

    const orderedDefinitions = [...definitions].sort((left, right) => (
        left.natural_key.localeCompare(right.natural_key)
    ));

    return orderedDefinitions.map((definition, index) => {
        const orderCode = PAYMENT_ORDER_CODE_BASE + index + 1;

        return {
            ...definition,
            order_code: orderCode,
            description: `AWP ${orderCode}`,
        };
    });
};

const buildBookingUpdates = ({
    bookings,
    bookingPriceById,
    paymentDefinitions,
}) => {
    const latestPaymentTimeByBookingId = new Map();

    for (const payment of paymentDefinitions) {
        const bookingId = toId(payment.booking_id);
        const current = latestPaymentTimeByBookingId.get(bookingId);

        if (!current || payment.updated_at > current) {
            latestPaymentTimeByBookingId.set(
                bookingId,
                payment.updated_at
            );
        }
    }

    return bookings.map((booking) => {
        const bookingId = toId(booking._id);
        const pricePlan = bookingPriceById.get(bookingId);
        const completedNonpaid = (
            booking.status === BOOKING_STATUS.COMPLETED
            && booking.payment_status !== BOOKING_PAYMENT_STATUS.PAID
        );
        const paymentMethod = completedNonpaid
            ? BOOKING_PAYMENT_METHOD.CASH
            : booking.payment_method;
        const paymentStatus = completedNonpaid
            ? BOOKING_PAYMENT_STATUS.UNPAID
            : booking.payment_status;
        const paidAt = completedNonpaid ? null : booking.paid_at;
        const updatedAt = new Date(Math.max(
            booking.updated_at.getTime(),
            paidAt?.getTime() || 0,
            latestPaymentTimeByBookingId.get(bookingId)?.getTime() || 0
        ));

        return {
            booking_id: booking._id,
            ...pricePlan,
            payment_method: paymentMethod,
            payment_status: paymentStatus,
            paid_at: paidAt,
            updated_at: updatedAt,
        };
    });
};

const applyBookingUpdatesInMemory = (bookings, bookingUpdates) => {
    const updateByBookingId = new Map(
        bookingUpdates.map((update) => [
            toId(update.booking_id),
            update,
        ])
    );

    return bookings.map((booking) => ({
        ...booking,
        ...updateByBookingId.get(toId(booking._id)),
        _id: booking._id,
    }));
};

const validatePromotionUsageDefinitions = (definitions) => {
    const bookingIds = new Set();

    for (const definition of definitions) {
        const bookingId = toId(definition.booking_id);

        if (bookingIds.has(bookingId)) {
            throw new Error(
                `Duplicate promotion usage booking: ${bookingId}`
            );
        }

        bookingIds.add(bookingId);

        const validationError = new PromotionUsage({
            _id: new mongoose.Types.ObjectId(
                definition.usage_id_hex
            ),
            ...definition,
        }).validateSync();

        if (validationError) {
            throw validationError;
        }
    }
};

const validatePaymentDefinitions = (definitions) => {
    const ids = new Set();
    const orderCodes = new Set();
    const paymentLinkIds = new Set();

    for (const definition of definitions) {
        if (ids.has(definition.payment_id_hex)) {
            throw new Error(
                `Duplicate payment seed id: ${definition.payment_id_hex}`
            );
        }

        if (orderCodes.has(definition.order_code)) {
            throw new Error(
                `Duplicate payment order code: ${definition.order_code}`
            );
        }

        if (
            definition.payment_link_id
            && paymentLinkIds.has(definition.payment_link_id)
        ) {
            throw new Error(
                `Duplicate payment link id: ${definition.payment_link_id}`
            );
        }

        ids.add(definition.payment_id_hex);
        orderCodes.add(definition.order_code);

        if (definition.payment_link_id) {
            paymentLinkIds.add(definition.payment_link_id);
        }

        const validationError = new PaymentTransaction({
            _id: new mongoose.Types.ObjectId(
                definition.payment_id_hex
            ),
            ...definition,
        }).validateSync();

        if (validationError) {
            throw validationError;
        }
    }
};

const applySession = (query, session) => {
    if (session) {
        query.session(session);
    }

    return query;
};

const loadSeedDependencies = async ({ referenceDate, session = null }) => {
    const scenarios = buildBookingScenarios(referenceDate);
    const bookingIds = scenarios.map(
        (scenario) => scenario.booking_id_hex
    );
    const queries = [
        Booking.find({ _id: { $in: bookingIds } }),
        Promotion.find({}),
        ServicePackage.find({}),
        TierRule.find({ is_active: true }),
        StaffProfile.find({
            staff_type: STAFF_TYPES.CUSTOMER_SERVICE_STAFF,
            is_active: true,
            employment_status: STAFF_EMPLOYMENT_STATUS.ACTIVE,
        }),
    ];

    const [
        rawBookings,
        promotions,
        servicePackages,
        tierRules,
        paymentStaff,
    ] = await Promise.all(
        queries.map((query) => applySession(query, session).lean())
    );

    if (rawBookings.length !== scenarios.length) {
        throw new Error(
            `Seeded bookings are incomplete: ${rawBookings.length}/${scenarios.length}`
        );
    }

    if (promotions.length !== 10) {
        throw new Error(
            `Seeded promotions are incomplete: ${promotions.length}/10`
        );
    }

    if (tierRules.length !== 4) {
        throw new Error(
            `Seeded tier rules are incomplete: ${tierRules.length}/4`
        );
    }

    const staffByGarageId = new Map();

    for (const profile of paymentStaff) {
        const garageId = toId(profile.garage_id);

        if (staffByGarageId.has(garageId)) {
            throw new Error(
                `Multiple payment staff candidates found: ${garageId}`
            );
        }

        staffByGarageId.set(garageId, profile);
    }

    if (staffByGarageId.size !== 5) {
        throw new Error(
            `Payment staff garage coverage mismatch: ${staffByGarageId.size}/5`
        );
    }

    const bookings = rawBookings.map((booking) => {
        if (
            booking.status === BOOKING_STATUS.COMPLETED
            && booking.payment_status !== BOOKING_PAYMENT_STATUS.PAID
        ) {
            return {
                ...booking,
                payment_method: BOOKING_PAYMENT_METHOD.CASH,
                payment_status: BOOKING_PAYMENT_STATUS.UNPAID,
                paid_at: null,
            };
        }

        return booking;
    });

    return {
        bookingIds,
        bookings,
        promotions,
        promotionByCode: new Map(
            promotions.map((promotion) => [
                promotion.code,
                promotion,
            ])
        ),
        servicePackageById: new Map(
            servicePackages.map((servicePackage) => [
                toId(servicePackage._id),
                servicePackage,
            ])
        ),
        tierRules,
        staffByGarageId,
    };
};

const summarizePlan = ({
    bookings,
    promotionUsageDefinitions,
    paymentDefinitions,
}) => ({
    payments: {
        total: paymentDefinitions.length,
        by_status: countBy(
            paymentDefinitions,
            (payment) => payment.status
        ),
        by_channel: countBy(
            paymentDefinitions,
            (payment) => payment.initiated_channel
        ),
        active: paymentDefinitions.filter(
            (payment) => payment.active_payment_key
        ).length,
    },
    promotion_usages: {
        total: promotionUsageDefinitions.length,
        by_status: countBy(
            promotionUsageDefinitions,
            (usage) => usage.status
        ),
        by_code: countBy(
            promotionUsageDefinitions,
            (usage) => {
                const assignment = bookings.find(
                    (booking) => (
                        toId(booking._id)
                        === toId(usage.booking_id)
                    )
                );

                return assignment?.promotion_code || 'UNKNOWN';
            }
        ),
    },
    completed_payments: {
        paid_payos: bookings.filter((booking) => (
            booking.status === BOOKING_STATUS.COMPLETED
            && booking.payment_status === BOOKING_PAYMENT_STATUS.PAID
            && booking.payment_method === BOOKING_PAYMENT_METHOD.PAYOS
        )).length,
        paid_cash: bookings.filter((booking) => (
            booking.status === BOOKING_STATUS.COMPLETED
            && booking.payment_status === BOOKING_PAYMENT_STATUS.PAID
            && booking.payment_method === BOOKING_PAYMENT_METHOD.CASH
        )).length,
        unpaid: bookings.filter((booking) => (
            booking.status === BOOKING_STATUS.COMPLETED
            && booking.payment_status === BOOKING_PAYMENT_STATUS.UNPAID
        )).length,
        pending: bookings.filter((booking) => (
            booking.status === BOOKING_STATUS.COMPLETED
            && booking.payment_status === BOOKING_PAYMENT_STATUS.PENDING
        )).length,
    },
});

const assertPlanTargets = ({
    summary,
    promotionUsageDefinitions,
    promotionById,
}) => {
    if (
        summary.payments.total !== PAYMENT_TRANSACTION_TOTAL
        || !countsMatch(
            summary.payments.by_status,
            PAYMENT_STATUS_TARGETS
        )
        || summary.payments.active !== 0
        || summary.completed_payments.paid_payos !== 125
        || summary.completed_payments.paid_cash !== 230
        || summary.completed_payments.unpaid !== 10
        || summary.completed_payments.pending !== 0
    ) {
        throw new Error(
            `Payment seed target mismatch: ${JSON.stringify(summary)}`
        );
    }

    if (
        summary.promotion_usages.total !== PROMOTION_USAGE_TOTAL
        || !countsMatch(
            summary.promotion_usages.by_status,
            PROMOTION_USAGE_TOTALS
        )
    ) {
        throw new Error(
            `Promotion usage seed target mismatch: ${JSON.stringify(summary.promotion_usages)}`
        );
    }

    const actualByCodeAndStatus = {};

    for (const usage of promotionUsageDefinitions) {
        const promotionCode = promotionById.get(
            toId(usage.promotion_id)
        )?.code;
        const codeCounts = actualByCodeAndStatus[promotionCode] || {};

        codeCounts[usage.status] = (
            codeCounts[usage.status] || 0
        ) + 1;
        actualByCodeAndStatus[promotionCode] = codeCounts;
    }

    for (const [promotionCode, expected] of Object.entries(
        PROMOTION_USAGE_TARGETS
    )) {
        if (!countsMatch(
            actualByCodeAndStatus[promotionCode] || {},
            Object.fromEntries(
                Object.entries(expected).filter(([, count]) => count > 0)
            )
        )) {
            throw new Error(
                `Promotion code target mismatch: ${promotionCode}:${JSON.stringify(actualByCodeAndStatus[promotionCode])}`
            );
        }
    }

    for (const promotionCode of NO_USAGE_PROMOTION_CODES) {
        if (actualByCodeAndStatus[promotionCode]) {
            throw new Error(
                `Promotion should not have seeded usage: ${promotionCode}`
            );
        }
    }
};

const buildSeedPlan = async ({
    referenceDate = getSeedReferenceDate(),
    session = null,
} = {}) => {
    const dependencies = await loadSeedDependencies({
        referenceDate,
        session,
    });
    const stablePromotionPlan = buildStablePromotionPlan({
        bookings: dependencies.bookings,
        promotionByCode: dependencies.promotionByCode,
        servicePackageById: dependencies.servicePackageById,
        tierRules: dependencies.tierRules,
    });
    const promotionUsageDefinitions =
        buildPromotionUsageDefinitions({
            assignments: stablePromotionPlan.assignments,
        });
    const initialBookingUpdates = buildBookingUpdates({
        bookings: dependencies.bookings,
        bookingPriceById:
            stablePromotionPlan.pricePlan.bookingPriceById,
        paymentDefinitions: [],
    });
    const initiallyPlannedBookings = applyBookingUpdatesInMemory(
        dependencies.bookings,
        initialBookingUpdates
    );
    const paymentDefinitions = buildPaymentDefinitions({
        bookings: initiallyPlannedBookings,
        staffByGarageId: dependencies.staffByGarageId,
    });
    const bookingUpdates = buildBookingUpdates({
        bookings: initiallyPlannedBookings,
        bookingPriceById:
            stablePromotionPlan.pricePlan.bookingPriceById,
        paymentDefinitions,
    });
    const plannedBookings = applyBookingUpdatesInMemory(
        initiallyPlannedBookings,
        bookingUpdates
    ).map((booking) => {
        const assignment =
            stablePromotionPlan.pricePlan.assignmentByBookingId.get(
                toId(booking._id)
            );

        return {
            ...booking,
            promotion_code: assignment?.promotion.code || null,
        };
    });

    validatePromotionUsageDefinitions(promotionUsageDefinitions);
    validatePaymentDefinitions(paymentDefinitions);

    for (const booking of plannedBookings) {
        const validationError = new Booking(booking).validateSync();

        if (validationError) {
            throw validationError;
        }
    }

    const summary = summarizePlan({
        bookings: plannedBookings,
        promotionUsageDefinitions,
        paymentDefinitions,
    });
    const promotionById = new Map(
        dependencies.promotions.map((promotion) => [
            toId(promotion._id),
            promotion,
        ])
    );

    assertPlanTargets({
        summary,
        promotionUsageDefinitions,
        promotionById,
    });

    return {
        ...dependencies,
        stablePromotionPlan,
        promotionUsageDefinitions,
        paymentDefinitions,
        bookingUpdates,
        plannedBookings,
        promotionById,
        summary,
    };
};

const writeBookingUpdates = async ({
    bookingUpdates,
    session,
}) => {
    const result = await Booking.bulkWrite(
        bookingUpdates.map((update) => {
            const {
                booking_id: bookingId,
                ...values
            } = update;

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

const writePromotionUsages = async ({
    bookingIds,
    definitions,
    session,
}) => {
    const expectedBookingIds = new Set(
        definitions.map((definition) => toId(definition.booking_id))
    );
    const existingQuery = PromotionUsage.find({
        booking_id: { $in: bookingIds },
    }).select('_id booking_id');
    const existing = await applySession(existingQuery, session).lean();
    const staleIds = existing
        .filter((usage) => (
            !expectedBookingIds.has(toId(usage.booking_id))
        ))
        .map((usage) => usage._id);

    if (staleIds.length > 0) {
        await PromotionUsage.deleteMany({
            _id: { $in: staleIds },
        }).session(session || null);
    }

    const result = await PromotionUsage.collection.bulkWrite(
        definitions.map((definition) => {
            const {
                usage_id_hex: usageIdHex,
                created_at: createdAt,
                ...values
            } = definition;

            return {
                updateOne: {
                    filter: { booking_id: definition.booking_id },
                    update: {
                        $set: {
                            ...values,
                            created_at: createdAt,
                        },
                        $setOnInsert: {
                            _id: new mongoose.Types.ObjectId(
                                usageIdHex
                            ),
                        },
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

const writePaymentTransactions = async ({
    bookingIds,
    definitions,
    session,
}) => {
    const expectedIds = new Set(
        definitions.map((definition) => definition.payment_id_hex)
    );
    const existingQuery = PaymentTransaction.find({
        booking_id: { $in: bookingIds },
    }).select('_id');
    const existing = await applySession(existingQuery, session).lean();
    const staleIds = existing
        .filter((payment) => !expectedIds.has(toId(payment._id)))
        .map((payment) => payment._id);

    if (staleIds.length > 0) {
        await PaymentTransaction.deleteMany({
            _id: { $in: staleIds },
        }).session(session || null);
    }

    const result = await PaymentTransaction.bulkWrite(
        definitions.map((definition) => {
            const {
                payment_id_hex: paymentIdHex,
                natural_key: naturalKey,
                ...payload
            } = definition;

            return {
                replaceOne: {
                    filter: {
                        _id: new mongoose.Types.ObjectId(paymentIdHex),
                    },
                    replacement: {
                        _id: new mongoose.Types.ObjectId(paymentIdHex),
                        ...payload,
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

const syncPromotionCounters = async ({
    promotions,
    session,
}) => {
    const promotionIds = promotions.map(
        (promotion) => promotion._id
    );
    const aggregate = PromotionUsage.aggregate([
        {
            $match: {
                promotion_id: { $in: promotionIds },
            },
        },
        {
            $group: {
                _id: {
                    promotion_id: '$promotion_id',
                    status: '$status',
                },
                count: { $sum: 1 },
            },
        },
    ]);

    if (session) {
        aggregate.session(session);
    }

    const rows = await aggregate;
    const counts = new Map(rows.map((row) => [
        `${row._id.promotion_id}:${row._id.status}`,
        row.count,
    ]));
    const result = await Promotion.bulkWrite(
        promotions.map((promotion) => ({
            updateOne: {
                filter: { _id: promotion._id },
                update: {
                    $set: {
                        used_count: counts.get(
                            `${promotion._id}:${PROMOTION_USAGE_STATUS.CONSUMED}`
                        ) || 0,
                        reserved_count: counts.get(
                            `${promotion._id}:${PROMOTION_USAGE_STATUS.RESERVED}`
                        ) || 0,
                    },
                },
            },
        })),
        {
            ordered: true,
            session,
            timestamps: false,
        }
    );

    return {
        matched: result.matchedCount,
        modified: result.modifiedCount,
    };
};

const seedPaymentsPromotionUsagesData = async ({
    session = null,
    referenceDate = getSeedReferenceDate(),
    dryRun = false,
} = {}) => {
    console.log('== Seeding payments and promotion usages ==');

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
    const promotionUsageWrite = await writePromotionUsages({
        bookingIds: plan.bookingIds,
        definitions: plan.promotionUsageDefinitions,
        session,
    });
    const paymentWrite = await writePaymentTransactions({
        bookingIds: plan.bookingIds,
        definitions: plan.paymentDefinitions,
        session,
    });
    const promotionCounterWrite = await syncPromotionCounters({
        promotions: plan.promotions,
        session,
    });

    console.table([{
        payments: plan.paymentDefinitions.length,
        payment_inserted: paymentWrite.inserted,
        payment_matched: paymentWrite.matched,
        promotion_usages: plan.promotionUsageDefinitions.length,
        usage_inserted: promotionUsageWrite.inserted,
        usage_matched: promotionUsageWrite.matched,
    }]);
    console.log('Payments and promotion usages seeding completed');

    return {
        dry_run: false,
        ...plan.summary,
        writes: {
            bookings: bookingWrite,
            payments: paymentWrite,
            promotion_usages: promotionUsageWrite,
            promotion_counters: promotionCounterWrite,
        },
    };
};

const sameNullableId = (left, right) => (
    (left ? toId(left) : null) === (right ? toId(right) : null)
);

const verifyPaymentsPromotionUsages = async ({
    referenceDate = getSeedReferenceDate(),
} = {}) => {
    const plan = await buildSeedPlan({ referenceDate });
    const [
        bookings,
        payments,
        usages,
        promotions,
        paymentStaff,
        promotionUsageCountRows,
    ] =
        await Promise.all([
            Booking.find({
                _id: { $in: plan.bookingIds },
            }).lean(),
            PaymentTransaction.find({
                booking_id: { $in: plan.bookingIds },
            }).lean(),
            PromotionUsage.find({
                booking_id: { $in: plan.bookingIds },
            }).lean(),
            Promotion.find({
                _id: {
                    $in: plan.promotions.map(
                        (promotion) => promotion._id
                    ),
                },
            }).lean(),
            StaffProfile.find({
                user_id: {
                    $in: plan.paymentDefinitions
                        .map((payment) => payment.created_by_staff_id)
                        .filter(Boolean),
                },
            }).lean(),
            PromotionUsage.aggregate([
                {
                    $match: {
                        promotion_id: {
                            $in: plan.promotions.map(
                                (promotion) => promotion._id
                            ),
                        },
                    },
                },
                {
                    $group: {
                        _id: {
                            promotion_id: '$promotion_id',
                            status: '$status',
                        },
                        count: { $sum: 1 },
                    },
                },
            ]),
        ]);
    const bookingById = new Map(
        bookings.map((booking) => [
            toId(booking._id),
            booking,
        ])
    );
    const expectedPaymentById = new Map(
        plan.paymentDefinitions.map((payment) => [
            payment.payment_id_hex,
            payment,
        ])
    );
    const expectedUsageByBookingId = new Map(
        plan.promotionUsageDefinitions.map((usage) => [
            toId(usage.booking_id),
            usage,
        ])
    );
    const staffByUserId = new Map(
        paymentStaff.map((staff) => [
            toId(staff.user_id),
            staff,
        ])
    );

    if (
        bookings.length !== 420
        || payments.length !== PAYMENT_TRANSACTION_TOTAL
        || usages.length !== PROMOTION_USAGE_TOTAL
    ) {
        throw new Error(
            `Persisted payment and promotion totals mismatch: ${bookings.length}/${payments.length}/${usages.length}`
        );
    }

    for (const booking of bookings) {
        const expected = plan.plannedBookings.find(
            (plannedBooking) => (
                toId(plannedBooking._id) === toId(booking._id)
            )
        );

        if (
            !expected
            || !sameNullableId(
                booking.promotion_id,
                expected.promotion_id
            )
            || booking.promotion_discount_amount
                !== expected.promotion_discount_amount
            || booking.discount_amount !== expected.discount_amount
            || booking.final_price !== expected.final_price
            || booking.payment_method !== expected.payment_method
            || booking.payment_status !== expected.payment_status
            || (
                booking.paid_at?.getTime?.() || null
            ) !== (
                expected.paid_at?.getTime?.() || null
            )
            || booking.updated_at < booking.created_at
        ) {
            throw new Error(
                `Persisted booking payment snapshot mismatch: ${booking._id}`
            );
        }
    }

    const orderCodes = new Set();
    const paymentLinkIds = new Set();

    for (const payment of payments) {
        const expected = expectedPaymentById.get(toId(payment._id));
        const booking = bookingById.get(toId(payment.booking_id));

        if (
            !expected
            || !booking
            || payment.provider !== PAYMENT_PROVIDER.PAYOS
            || payment.method !== PAYMENT_METHOD.QR
            || payment.amount !== booking.final_price
            || payment.status !== expected.status
            || payment.order_code !== expected.order_code
            || payment.active_payment_key !== null
            || payment.raw_webhook?.source !== SEED_PAYMENT_SOURCE
            || payment.created_at < booking.completed_at
            || payment.updated_at < payment.created_at
            || orderCodes.has(payment.order_code)
            || (
                payment.payment_link_id
                && paymentLinkIds.has(payment.payment_link_id)
            )
        ) {
            throw new Error(
                `Invalid persisted payment transaction: ${payment._id}`
            );
        }

        orderCodes.add(payment.order_code);

        if (payment.payment_link_id) {
            paymentLinkIds.add(payment.payment_link_id);
        }

        if (
            payment.status === PAYMENT_TRANSACTION_STATUS.PAID
            && (
                booking.payment_status
                    !== BOOKING_PAYMENT_STATUS.PAID
                || booking.payment_method
                    !== BOOKING_PAYMENT_METHOD.PAYOS
                || payment.paid_at.getTime()
                    !== booking.paid_at.getTime()
            )
        ) {
            throw new Error(
                `Paid transaction does not match booking: ${payment._id}`
            );
        }

        if (
            payment.initiated_channel
            === PAYMENT_INITIATED_CHANNEL.CUSTOMER_SELF_SERVICE
            && (
                booking.is_walk_in
                || toId(payment.initiated_by_user_id)
                    !== toId(booking.customer_id)
                || payment.created_by_staff_id
            )
        ) {
            throw new Error(
                `Invalid customer payment initiator: ${payment._id}`
            );
        }

        if (
            payment.initiated_channel
            === PAYMENT_INITIATED_CHANNEL.STAFF_ASSISTED
        ) {
            const staff = staffByUserId.get(
                toId(payment.initiated_by_user_id)
            );

            if (
                !staff
                || toId(staff.garage_id) !== toId(booking.garage_id)
                || toId(payment.created_by_staff_id)
                    !== toId(staff.user_id)
                || staff.staff_type
                    !== STAFF_TYPES.CUSTOMER_SERVICE_STAFF
                || !staff.is_active
                || staff.employment_status
                    !== STAFF_EMPLOYMENT_STATUS.ACTIVE
            ) {
                throw new Error(
                    `Invalid staff payment initiator: ${payment._id}`
                );
            }
        }
    }

    const actualPaymentStatusCounts = countBy(
        payments,
        (payment) => payment.status
    );

    if (!countsMatch(
        actualPaymentStatusCounts,
        PAYMENT_STATUS_TARGETS
    )) {
        throw new Error(
            `Persisted payment status mismatch: ${JSON.stringify(actualPaymentStatusCounts)}`
        );
    }

    for (const usage of usages) {
        const booking = bookingById.get(toId(usage.booking_id));
        const expected = expectedUsageByBookingId.get(
            toId(usage.booking_id)
        );

        if (
            !booking
            || !expected
            || !sameNullableId(
                usage.promotion_id,
                booking.promotion_id
            )
            || usage.status !== expected.status
            || usage.discount_amount
                !== booking.promotion_discount_amount
            || usage.reserved_at.getTime()
                !== booking.created_at.getTime()
            || usage.updated_at < usage.created_at
        ) {
            throw new Error(
                `Invalid persisted promotion usage: ${usage._id}`
            );
        }

        if (
            usage.status === PROMOTION_USAGE_STATUS.CONSUMED
            && (
                booking.status !== BOOKING_STATUS.COMPLETED
                || booking.payment_status
                    !== BOOKING_PAYMENT_STATUS.PAID
                || usage.consumed_at.getTime()
                    !== booking.paid_at.getTime()
                || usage.used_at.getTime()
                    !== booking.paid_at.getTime()
            )
        ) {
            throw new Error(
                `Consumed promotion usage mismatch: ${usage._id}`
            );
        }

        if (
            usage.status === PROMOTION_USAGE_STATUS.RESERVED
            && (
                booking.status !== BOOKING_STATUS.CONFIRMED
                || usage.consumed_at
                || usage.released_at
                || usage.used_at
            )
        ) {
            throw new Error(
                `Reserved promotion usage mismatch: ${usage._id}`
            );
        }

        if (
            usage.status === PROMOTION_USAGE_STATUS.RELEASED
            && (
                ![
                    BOOKING_STATUS.CANCELED,
                    BOOKING_STATUS.NO_SHOW,
                ].includes(booking.status)
                || !usage.released_at
                || usage.phone_usage_key
            )
        ) {
            throw new Error(
                `Released promotion usage mismatch: ${usage._id}`
            );
        }
    }

    const actualUsageStatusCounts = countBy(
        usages,
        (usage) => usage.status
    );

    if (!countsMatch(
        actualUsageStatusCounts,
        PROMOTION_USAGE_TOTALS
    )) {
        throw new Error(
            `Persisted promotion usage status mismatch: ${JSON.stringify(actualUsageStatusCounts)}`
        );
    }

    const usageCountsByPromotionId = new Map();

    for (const row of promotionUsageCountRows) {
        const promotionId = toId(row._id.promotion_id);
        const counts = usageCountsByPromotionId.get(promotionId) || {
            used: 0,
            reserved: 0,
        };

        if (row._id.status === PROMOTION_USAGE_STATUS.CONSUMED) {
            counts.used = row.count;
        }

        if (row._id.status === PROMOTION_USAGE_STATUS.RESERVED) {
            counts.reserved = row.count;
        }

        usageCountsByPromotionId.set(promotionId, counts);
    }

    for (const promotion of promotions) {
        const counts = usageCountsByPromotionId.get(
            toId(promotion._id)
        ) || { used: 0, reserved: 0 };

        if (
            promotion.used_count !== counts.used
            || promotion.reserved_count !== counts.reserved
        ) {
            throw new Error(
                `Promotion counter mismatch: ${promotion.code}`
            );
        }
    }

    const cleanUnpaidBookings = bookings.filter((booking) => (
        booking.status === BOOKING_STATUS.COMPLETED
        && booking.payment_status === BOOKING_PAYMENT_STATUS.UNPAID
        && !payments.some(
            (payment) => toId(payment.booking_id) === toId(booking._id)
        )
    ));
    const usageByCode = {};

    for (const usage of usages) {
        const promotionCode = plan.promotionById.get(
            toId(usage.promotion_id)
        ).code;
        const counts = usageByCode[promotionCode] || {};

        counts[usage.status] = (counts[usage.status] || 0) + 1;
        usageByCode[promotionCode] = counts;
    }

    return {
        payments: {
            total: payments.length,
            by_status: actualPaymentStatusCounts,
            by_channel: countBy(
                payments,
                (payment) => payment.initiated_channel
            ),
            active: payments.filter(
                (payment) => payment.active_payment_key
            ).length,
            clean_unpaid_bookings: cleanUnpaidBookings.length,
        },
        promotion_usages: {
            total: usages.length,
            by_status: actualUsageStatusCounts,
            by_code: usageByCode,
        },
        completed_bookings: {
            paid_payos: bookings.filter((booking) => (
                booking.status === BOOKING_STATUS.COMPLETED
                && booking.payment_status
                    === BOOKING_PAYMENT_STATUS.PAID
                && booking.payment_method
                    === BOOKING_PAYMENT_METHOD.PAYOS
            )).length,
            paid_cash: bookings.filter((booking) => (
                booking.status === BOOKING_STATUS.COMPLETED
                && booking.payment_status
                    === BOOKING_PAYMENT_STATUS.PAID
                && booking.payment_method
                    === BOOKING_PAYMENT_METHOD.CASH
            )).length,
            unpaid: bookings.filter((booking) => (
                booking.status === BOOKING_STATUS.COMPLETED
                && booking.payment_status
                    === BOOKING_PAYMENT_STATUS.UNPAID
            )).length,
            pending: bookings.filter((booking) => (
                booking.status === BOOKING_STATUS.COMPLETED
                && booking.payment_status
                    === BOOKING_PAYMENT_STATUS.PENDING
            )).length,
        },
    };
};

const seedPaymentsPromotionUsages = async ({
    dryRun = process.argv.includes('--dry-run'),
} = {}) => {
    const referenceDate = getSeedReferenceDate();

    await connectDB();

    if (dryRun) {
        try {
            return await seedPaymentsPromotionUsagesData({
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
            result.seed = await seedPaymentsPromotionUsagesData({
                session,
                referenceDate,
            });
        });

        result.verification =
            await verifyPaymentsPromotionUsages({
                referenceDate,
            });

        return result;
    } finally {
        await session.endSession();
        await disconnectDB();
    }
};

const run = async () => {
    try {
        const result = await seedPaymentsPromotionUsages();

        console.log('Payments and promotion usages seed completed');
        console.dir(result.verification || result, { depth: null });
    } catch (error) {
        console.error(
            'Payments and promotion usages seed failed:',
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
    SEED_PAYMENT_SOURCE,
    calculatePromotionDiscount,
    getHighestEligibleTier,
    buildCustomerTierTimeline,
    promotionMatchesBooking,
    selectPromotionAssignments,
    buildPromotionPricePlan,
    buildStablePromotionPlan,
    buildPromotionUsageDefinitions,
    buildPaymentDefinitions,
    validatePromotionUsageDefinitions,
    validatePaymentDefinitions,
    summarizePlan,
    assertPlanTargets,
    buildSeedPlan,
    seedPaymentsPromotionUsagesData,
    verifyPaymentsPromotionUsages,
    seedPaymentsPromotionUsages,
};
