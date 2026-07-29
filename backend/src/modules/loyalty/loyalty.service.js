const mongoose = require('mongoose');

const User = require('../users/user.model');
const CustomerLoyalty = require('./customerLoyalty.model');
const PointTransaction = require('./pointTransaction.model');
const TierRule = require('./tierRule.model');
const LoyaltyRedeemRule = require('./loyaltyRedeemRule.model');
const ServicePackage = require('../service-packages/servicePackage.model');
const Promotion = require('../promotions/promotion.model');
const PromotionUsage = require('../promotion-usages/promotionUsage.model');
const servicePriceRuleService = require('../service-price-rules/servicePriceRule.service');
const customerVoucherService = require('../customer-vouchers/customerVoucher.service');
const LoyaltyMapper = require('./loyalty.mapper');
const { AppError } = require('../../shared/utils/appError');
const { USER_ROLES } = require('../../shared/constants/roles.constant');
const {
    LOYALTY_TIERS,
    POINT_TRANSACTION_TYPES,
    POINT_EXPIRY_MONTHS,
    TIER_INACTIVITY_DOWNGRADE_DAYS,
} = require('../../shared/constants/loyalty.constant');
const { PROMOTION_DISCOUNT_TYPES } = require('../../shared/constants/promotion.constant');

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const addMonths = (date, months) => {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);

    return result;
};

const escapeRegExp = (value) => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const normalizePromotionCode = (value) => {
    if (typeof value !== 'string') {
        return value;
    }

    return value.trim().toUpperCase();
};

const isSameObjectId = (left, right) => {
    if (!left || !right) {
        return false;
    }

    return left.toString() === right.toString();
};

const getQualifyingPoints = (loyalty) => {
    if (Number.isFinite(loyalty?.qualifying_points)) {
        return loyalty.qualifying_points;
    }

    return Math.max(
        0,
        (Number(loyalty?.total_points) || 0) - (Number(loyalty?.bonus_points) || 0)
    );
};

const getActiveRedeemRule = async (session = null) => {
    const query = LoyaltyRedeemRule.findOne({ is_active: true }).sort({ created_at: -1 });

    if (session) {
        query.session(session);
    }

    const redeemRule = await query;

    if (!redeemRule) {
        throw new AppError('Active loyalty redeem rule not found', 404, 'LOYALTY_REDEEM_RULE_NOT_FOUND');
    }

    return redeemRule;
};

const getActiveServicePackageById = async (servicePackageId) => {
    const servicePackage = await ServicePackage.findById(servicePackageId);

    if (!servicePackage) {
        throw new AppError('Service package not found', 404, 'SERVICE_PACKAGE_NOT_FOUND');
    }

    if (!servicePackage.is_active) {
        throw new AppError('Service package is inactive', 400, 'SERVICE_PACKAGE_INACTIVE');
    }

    return servicePackage;
};

const getPromotionForRedeemPreview = async ({ promotion_id, promotion_code } = {}) => {
    if (!promotion_id && !promotion_code) {
        return null;
    }

    const normalizedCode = normalizePromotionCode(promotion_code);
    let promotion = null;

    if (promotion_id) {
        promotion = await Promotion.findById(promotion_id);

        if (!promotion) {
            throw new AppError('Promotion not found', 404, 'PROMOTION_NOT_FOUND');
        }

        if (normalizedCode && promotion.code !== normalizedCode) {
            throw new AppError('Promotion id and code do not match', 400, 'PROMOTION_ID_CODE_MISMATCH');
        }

        return promotion;
    }

    promotion = await Promotion.findOne({ code: normalizedCode });

    if (!promotion) {
        throw new AppError('Promotion not found', 404, 'PROMOTION_NOT_FOUND');
    }

    return promotion;
};

const calculatePromotionDiscountAmount = (promotion, orderAmount) => {
    let discountAmount = 0;

    if (promotion.discount_type === PROMOTION_DISCOUNT_TYPES.PERCENTAGE) {
        discountAmount = Math.floor((orderAmount * promotion.discount_value) / 100);

        if (promotion.max_discount_amount !== null && promotion.max_discount_amount !== undefined) {
            discountAmount = Math.min(discountAmount, promotion.max_discount_amount);
        }
    }

    if (promotion.discount_type === PROMOTION_DISCOUNT_TYPES.FIXED_AMOUNT) {
        discountAmount = promotion.discount_value;
    }

    return Math.min(Math.max(discountAmount, 0), orderAmount);
};

const assertPromotionApplicableForRedeemPreview = async ({ promotion, customerId, customerTier, servicePackage, orderAmount }) => {
    const now = new Date();

    if (!promotion.is_active) {
        throw new AppError('Promotion is inactive', 400, 'PROMOTION_INACTIVE');
    }

    if (now < promotion.start_at || now > promotion.end_at) {
        throw new AppError('Promotion is not valid at this time', 400, 'PROMOTION_NOT_IN_VALID_PERIOD');
    }

    if (orderAmount < promotion.min_order_amount) {
        throw new AppError('Order amount does not meet promotion minimum amount', 400, 'PROMOTION_MIN_ORDER_NOT_MET');
    }

    if (promotion.applicable_tiers?.length && !promotion.applicable_tiers.includes(customerTier)) {
        throw new AppError('Promotion is not available for customer tier', 400, 'PROMOTION_TIER_NOT_ELIGIBLE');
    }

    if (promotion.applicable_vehicle_types?.length && !promotion.applicable_vehicle_types.includes(servicePackage.vehicle_type)) {
        throw new AppError('Promotion is not available for this vehicle type', 400, 'PROMOTION_VEHICLE_TYPE_NOT_ELIGIBLE');
    }

    if (promotion.applicable_service_package_ids?.length) {
        const isApplicableService = promotion.applicable_service_package_ids.some((servicePackageId) => {
            return isSameObjectId(servicePackageId, servicePackage._id);
        });

        if (!isApplicableService) {
            throw new AppError('Promotion is not available for this service package', 400, 'PROMOTION_SERVICE_PACKAGE_NOT_ELIGIBLE');
        }
    }

    if (promotion.usage_limit) {
        const totalUsageCount = await PromotionUsage.countDocuments({ promotion_id: promotion._id });
        const effectiveUsageCount = Math.max(totalUsageCount, promotion.used_count || 0);

        if (effectiveUsageCount >= promotion.usage_limit) {
            throw new AppError('Promotion usage limit has been reached', 409, 'PROMOTION_USAGE_LIMIT_REACHED');
        }
    }

    if (promotion.per_customer_limit) {
        const customerUsageCount = await PromotionUsage.countDocuments({
            promotion_id: promotion._id,
            customer_id: customerId,
        });

        if (customerUsageCount >= promotion.per_customer_limit) {
            throw new AppError('Customer promotion usage limit has been reached', 409, 'PROMOTION_CUSTOMER_USAGE_LIMIT_REACHED');
        }
    }
};

const calculatePointsDiscountAmount = ({ usedPoints, availablePoints, priceAfterPromotion, redeemRule }) => {
    if (usedPoints <= 0) {
        return 0;
    }

    if (usedPoints > availablePoints) {
        throw new AppError('Used points exceed available points', 400, 'LOYALTY_POINTS_NOT_ENOUGH');
    }

    if (usedPoints < redeemRule.min_redeem_points) {
        throw new AppError('Used points do not meet minimum redeem points', 400, 'LOYALTY_MIN_REDEEM_POINTS_NOT_MET');
    }

    if (usedPoints % redeemRule.redeem_step !== 0) {
        throw new AppError('Used points must follow redeem step', 400, 'LOYALTY_REDEEM_STEP_INVALID');
    }

    const maxDiscountByPercent = Math.floor((priceAfterPromotion * redeemRule.max_redeem_percent) / 100);
    const pointsDiscountAmount = usedPoints * redeemRule.point_value_amount;

    if (pointsDiscountAmount > maxDiscountByPercent) {
        throw new AppError('Point discount exceeds maximum redeem percent', 400, 'LOYALTY_MAX_REDEEM_PERCENT_EXCEEDED');
    }

    if (pointsDiscountAmount > priceAfterPromotion) {
        throw new AppError('Point discount exceeds payable amount', 400, 'LOYALTY_POINT_DISCOUNT_EXCEEDS_PRICE');
    }

    return pointsDiscountAmount;
};

const calculateBookingRedeemDiscount = async ({
    customerId,
    usedPoints = 0,
    priceAfterPromotion,
    session = null,
}) => {
    const normalizedUsedPoints = Number(usedPoints) || 0;

    if (normalizedUsedPoints <= 0) {
        return {
            loyalty: null,
            redeem_rule: null,
            used_points: 0,
            points_discount_amount: 0,
        };
    }

    const loyalty = await getOrCreateCustomerLoyalty(customerId, session);
    const redeemRule = await getActiveRedeemRule(session);
    const pointsDiscountAmount = calculatePointsDiscountAmount({
        usedPoints: normalizedUsedPoints,
        availablePoints: loyalty.available_points,
        priceAfterPromotion,
        redeemRule,
    });

    return {
        loyalty,
        redeem_rule: redeemRule,
        used_points: normalizedUsedPoints,
        points_discount_amount: pointsDiscountAmount,
    };
};

const getRedeemSourceTransactions = async ({ customerId, usedPoints, session = null }) => {
    const query = PointTransaction.find({
        customer_id: customerId,
        type: {
            $in: [
                POINT_TRANSACTION_TYPES.EARN,
                POINT_TRANSACTION_TYPES.SURVEY_REWARD,
                POINT_TRANSACTION_TYPES.REVIEW_REWARD,
                POINT_TRANSACTION_TYPES.REFUND,
            ],
        },
        remaining_points: { $gt: 0 },
    }).sort({ expires_at: 1, created_at: 1 });

    if (session) {
        query.session(session);
    }

    const sourceTransactions = await query;
    const availableSourcePoints = sourceTransactions.reduce(
        (sum, transaction) => sum + transaction.remaining_points,
        0
    );

    if (availableSourcePoints < usedPoints) {
        throw new AppError('Redeem source points are not enough', 409, 'LOYALTY_REDEEM_SOURCE_POINTS_NOT_ENOUGH');
    }

    return sourceTransactions;
};

const consumeRedeemSourceTransactions = async ({ sourceTransactions, usedPoints, session = null }) => {
    let remainingToConsume = usedPoints;
    const consumedSourceIds = [];

    for (const transaction of sourceTransactions) {
        if (remainingToConsume <= 0) {
            break;
        }

        const consumedPoints = Math.min(transaction.remaining_points, remainingToConsume);

        transaction.remaining_points -= consumedPoints;
        remainingToConsume -= consumedPoints;
        consumedSourceIds.push(transaction._id);

        await transaction.save(session ? { session } : undefined);
    }

    return consumedSourceIds;
};

const findPointTransactionByBookingAndType = async ({ bookingId, type, session = null }) => {
    const query = PointTransaction.findOne({
        booking_id: bookingId,
        type,
    });

    if (session) {
        query.session(session);
    }

    return query;
};

const redeemPointsForBooking = async ({
    booking,
    customerId,
    usedPoints = 0,
    priceAfterPromotion,
    actorId = null,
    expectedPointsDiscountAmount,
    session = null,
}) => {
    const normalizedUsedPoints = Number(usedPoints) || 0;

    if (!booking || !customerId || normalizedUsedPoints <= 0) {
        return null;
    }

    const existingRedeemTransaction = await findPointTransactionByBookingAndType({
        bookingId: booking._id,
        type: POINT_TRANSACTION_TYPES.REDEEM,
        session,
    });

    if (existingRedeemTransaction) {
        return {
            loyalty: null,
            point_transaction: LoyaltyMapper.toPointTransactionDto(existingRedeemTransaction),
            used_points: normalizedUsedPoints,
            points_discount_amount: booking.points_discount_amount || expectedPointsDiscountAmount || 0,
            already_processed: true,
        };
    }

    const redeemContext = await calculateBookingRedeemDiscount({
        customerId,
        usedPoints: normalizedUsedPoints,
        priceAfterPromotion,
        session,
    });

    if (
        expectedPointsDiscountAmount !== undefined
        && redeemContext.points_discount_amount !== expectedPointsDiscountAmount
    ) {
        throw new AppError('Redeem discount changed before booking creation', 409, 'LOYALTY_REDEEM_DISCOUNT_CHANGED');
    }

    const sourceTransactions = await getRedeemSourceTransactions({
        customerId,
        usedPoints: normalizedUsedPoints,
        session,
    });
    const sourceTransactionIds = await consumeRedeemSourceTransactions({
        sourceTransactions,
        usedPoints: normalizedUsedPoints,
        session,
    });
    const loyalty = redeemContext.loyalty;
    const balanceBefore = loyalty.available_points;
    const balanceAfter = balanceBefore - normalizedUsedPoints;

    loyalty.available_points = balanceAfter;
    loyalty.redeemed_points += normalizedUsedPoints;

    await loyalty.save(session ? { session } : undefined);

    const transactions = await PointTransaction.create(
        [
            {
                customer_id: customerId,
                booking_id: booking._id,
                type: POINT_TRANSACTION_TYPES.REDEEM,
                points: -normalizedUsedPoints,
                remaining_points: 0,
                balance_before: balanceBefore,
                balance_after: balanceAfter,
                description: 'Redeem points for booking discount',
                earned_at: null,
                expires_at: null,
                expired_at: null,
                source_transaction_ids: sourceTransactionIds,
                created_by: actorId || null,
            },
        ],
        session ? { session } : undefined
    );

    return {
        loyalty: LoyaltyMapper.toCustomerLoyaltyDto(loyalty),
        point_transaction: LoyaltyMapper.toPointTransactionDto(transactions[0]),
        used_points: normalizedUsedPoints,
        points_discount_amount: redeemContext.points_discount_amount,
        already_processed: false,
    };
};

const refundRedeemedPointsForBooking = async ({ booking, actorId = null, session = null }) => {
    const usedPoints = Number(booking?.used_points) || 0;

    if (!booking?.customer_id || !booking?._id || usedPoints <= 0) {
        return null;
    }

    const existingRefundTransaction = await findPointTransactionByBookingAndType({
        bookingId: booking._id,
        type: POINT_TRANSACTION_TYPES.REFUND,
        session,
    });

    if (existingRefundTransaction) {
        return {
            loyalty: null,
            point_transaction: LoyaltyMapper.toPointTransactionDto(existingRefundTransaction),
            refunded_points: usedPoints,
            already_processed: true,
        };
    }

    const redeemTransaction = await findPointTransactionByBookingAndType({
        bookingId: booking._id,
        type: POINT_TRANSACTION_TYPES.REDEEM,
        session,
    });

    if (!redeemTransaction) {
        throw new AppError('Redeem point transaction not found for booking', 409, 'LOYALTY_REDEEM_TRANSACTION_NOT_FOUND');
    }

    const now = new Date();
    const loyalty = await getOrCreateCustomerLoyalty(booking.customer_id, session);
    const balanceBefore = loyalty.available_points;
    const balanceAfter = balanceBefore + usedPoints;

    loyalty.available_points = balanceAfter;
    loyalty.redeemed_points = Math.max(0, loyalty.redeemed_points - usedPoints);

    await loyalty.save(session ? { session } : undefined);

    const transactions = await PointTransaction.create(
        [
            {
                customer_id: booking.customer_id,
                booking_id: booking._id,
                type: POINT_TRANSACTION_TYPES.REFUND,
                points: usedPoints,
                remaining_points: usedPoints,
                balance_before: balanceBefore,
                balance_after: balanceAfter,
                description: 'Refund redeemed points for canceled booking',
                earned_at: now,
                expires_at: addMonths(now, POINT_EXPIRY_MONTHS),
                expired_at: null,
                source_transaction_ids: redeemTransaction?._id ? [redeemTransaction._id] : [],
                created_by: actorId || null,
            },
        ],
        session ? { session } : undefined
    );

    return {
        loyalty: LoyaltyMapper.toCustomerLoyaltyDto(loyalty),
        point_transaction: LoyaltyMapper.toPointTransactionDto(transactions[0]),
        refunded_points: usedPoints,
        already_processed: false,
    };
};


const getPointMultiplier = async (tierName, session = null) => {
    const query = TierRule.findOne({
        tier_name: tierName,
        is_active: true,
    });

    if (session) {
        query.session(session);
    }

    const tierRule = await query;

    return tierRule?.point_multiplier || 1;
};

const getOrCreateCustomerLoyalty = async (customerId, session = null) => {
    const query = CustomerLoyalty.findOne({ customer_id: customerId });

    if (session) {
        query.session(session);
    }

    let loyalty = await query;

    if (loyalty) {
        return loyalty;
    }

    const documents = await CustomerLoyalty.create(
        [
            {
                customer_id: customerId,
                current_tier: LOYALTY_TIERS.BRONZE,
                total_points: 0,
                qualifying_points: 0,
                bonus_points: 0,
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
            },
        ],
        session ? { session } : undefined
    );

    return documents[0];
};

const calculateEarnedPoints = async ({
    booking,
    servicePackage,
    addOnServices = [],
    loyalty,
    customerId = null,
    session = null,
}) => {
    const effectiveCustomerId = customerId || booking.customer_id;

    if (!effectiveCustomerId || booking.final_price <= 0 || booking.original_price <= 0) {
        return 0;
    }

    const pointMultiplier = await getPointMultiplier(loyalty.current_tier, session);
    const paymentRatio = booking.final_price / booking.original_price;
    const basePoints = [servicePackage, ...addOnServices].reduce(
        (total, currentServicePackage) => total + (Number(currentServicePackage?.points_earned) || 0),
        0
    );

    return Math.floor(basePoints * pointMultiplier * paymentRatio);
};

const getActiveTierRules = async (session = null) => {
    const query = TierRule.find({ is_active: true }).sort({ priority_level: 1 });

    if (session) {
        query.session(session);
    }

    return query;
};

const getCurrentTierRule = async (tierName, session = null) => {
    const query = TierRule.findOne({ tier_name: tierName, is_active: true });

    if (session) {
        query.session(session);
    }

    return query;
};

const getTierRuleContext = async (loyalty, session = null) => {
    const tierRules = await getActiveTierRules(session);
    const currentTierRule = tierRules.find((rule) => rule.tier_name === loyalty.current_tier) || null;
    const nextTierRule = tierRules.find((rule) => rule.priority_level > (currentTierRule?.priority_level || 0)) || null;

    return {
        currentTierRule,
        nextTierRule,
    };
};

const getHighestEligibleTierRule = (loyalty, tierRules = []) => {
    const orderedTierRules = [...tierRules].sort((left, right) => right.priority_level - left.priority_level);
    const qualifyingPoints = getQualifyingPoints(loyalty);

    return orderedTierRules.find((tierRule) => {
        return loyalty.total_spent >= tierRule.min_total_spent
            && loyalty.total_visits >= tierRule.min_total_visits
            && qualifyingPoints >= tierRule.min_total_points;
    }) || orderedTierRules.find((tierRule) => tierRule.tier_name === LOYALTY_TIERS.BRONZE) || null;
};

const getEligibleTierRule = async (loyalty, session = null) => {
    const tierRules = await getActiveTierRules(session);

    return getHighestEligibleTierRule(loyalty, tierRules);
};

const getNextHigherTierRule = (tierRules, tierName) => {
    const orderedTierRules = [...tierRules].sort((left, right) => left.priority_level - right.priority_level);
    const currentTierRule = orderedTierRules.find((tierRule) => tierRule.tier_name === tierName);

    if (!currentTierRule) {
        return null;
    }

    return orderedTierRules.find((tierRule) => tierRule.priority_level > currentTierRule.priority_level) || null;
};

const getRecoveringTierRule = ({ tierRules, currentTierName, eligibleTierRule }) => {
    if (!eligibleTierRule) {
        return null;
    }

    const currentTierRule = tierRules.find((tierRule) => tierRule.tier_name === currentTierName);

    if (!currentTierRule || currentTierRule.priority_level >= eligibleTierRule.priority_level) {
        return eligibleTierRule;
    }

    const nextHigherTierRule = getNextHigherTierRule(tierRules, currentTierName);

    if (!nextHigherTierRule || nextHigherTierRule.priority_level >= eligibleTierRule.priority_level) {
        return eligibleTierRule;
    }

    return nextHigherTierRule;
};

const reviewCustomerTier = async (loyalty, session = null) => {
    const previousTier = loyalty.current_tier;
    const tierRules = await getActiveTierRules(session);
    const eligibleTierRule = getHighestEligibleTierRule(loyalty, tierRules);
    const recoveryStartedAt = loyalty.tier_recovery_started_at || null;
    const selectedTierRule = recoveryStartedAt
        ? getRecoveringTierRule({
            tierRules,
            currentTierName: loyalty.current_tier,
            eligibleTierRule,
        })
        : eligibleTierRule;

    if (selectedTierRule) {
        loyalty.current_tier = selectedTierRule.tier_name;
    }

    if (recoveryStartedAt && eligibleTierRule && loyalty.current_tier === eligibleTierRule.tier_name) {
        loyalty.tier_recovery_started_at = null;
    }

    loyalty.last_tier_review_at = new Date();

    return {
        previous_tier: previousTier,
        current_tier: loyalty.current_tier,
        tier_changed: previousTier !== loyalty.current_tier,
    };
};

const processBookingLoyalty = async ({
    booking,
    servicePackage,
    addOnServices = [],
    actorId,
    customerId = null,
    visitAt = null,
    session = null,
}) => {
    const effectiveCustomerId = customerId || booking.customer_id;

    if (!effectiveCustomerId) {
        return {
            loyalty: null,
            point_transaction: null,
            earned_points: 0,
            tier_review: null,
            total_spent_added: 0,
            total_visits_added: 0,
            already_processed: false,
        };
    }

    const existingEarnTransaction =
        await findPointTransactionByBookingAndType({
            bookingId: booking._id,
            type: POINT_TRANSACTION_TYPES.EARN,
            session,
        });

    if (existingEarnTransaction) {
        if (!isSameObjectId(existingEarnTransaction.customer_id, effectiveCustomerId)) {
            throw new AppError(
                'Booking loyalty belongs to another customer',
                409,
                'LOYALTY_BOOKING_CUSTOMER_CONFLICT'
            );
        }

        const existingLoyalty = await getOrCreateCustomerLoyalty(
            effectiveCustomerId,
            session
        );

        return {
            loyalty:
                LoyaltyMapper.toCustomerLoyaltyDto(existingLoyalty),
            point_transaction:
                LoyaltyMapper.toPointTransactionDto(
                    existingEarnTransaction
                ),
            earned_points: existingEarnTransaction.points,
            tier_review: null,
            total_spent_added: 0,
            total_visits_added: 0,
            already_processed: true,
        };
    }

    const now = new Date();
    const parsedVisitAt = visitAt ? new Date(visitAt) : now;
    const effectiveVisitAt = Number.isNaN(parsedVisitAt.getTime()) ? now : parsedVisitAt;
    const loyalty = await getOrCreateCustomerLoyalty(effectiveCustomerId, session);
    const earnedPoints = await calculateEarnedPoints({
        booking,
        servicePackage,
        addOnServices,
        loyalty,
        customerId: effectiveCustomerId,
        session,
    });
    const balanceBefore = loyalty.available_points;
    const balanceAfter = balanceBefore + earnedPoints;

    loyalty.total_spent += booking.final_price;
    loyalty.total_visits += 1;
    if (!loyalty.last_visit_at || loyalty.last_visit_at < effectiveVisitAt) {
        loyalty.last_visit_at = effectiveVisitAt;
    }
    loyalty.last_tier_downgrade_at = null;

    let pointTransaction = null;

    if (earnedPoints > 0) {
        const qualifyingPointsBefore = getQualifyingPoints(loyalty);

        loyalty.total_points += earnedPoints;
        loyalty.qualifying_points = qualifyingPointsBefore + earnedPoints;
        loyalty.available_points = balanceAfter;

        const transactions = await PointTransaction.create(
            [
                {
                    customer_id: effectiveCustomerId,
                    booking_id: booking._id,
                    type: POINT_TRANSACTION_TYPES.EARN,
                    points: earnedPoints,
                    remaining_points: earnedPoints,
                    balance_before: balanceBefore,
                    balance_after: balanceAfter,
                    description: 'Earn points from completed paid booking',
                    earned_at: now,
                    expires_at: addMonths(now, POINT_EXPIRY_MONTHS),
                    expired_at: null,
                    source_transaction_ids: [],
                    created_by: actorId || null,
                },
            ],
            session ? { session } : undefined
        );

        pointTransaction = transactions[0];
    }

    const tierReview = await reviewCustomerTier(loyalty, session);

    await loyalty.save(session ? { session } : undefined);

    return {
        loyalty: LoyaltyMapper.toCustomerLoyaltyDto(loyalty),
        point_transaction: LoyaltyMapper.toPointTransactionDto(pointTransaction),
        earned_points: earnedPoints,
        tier_review: tierReview,
        total_spent_added: booking.final_price,
        total_visits_added: 1,
        already_processed: false,
    };
};

const getTierInactivityCutoff = (now) => {
    return new Date(now.getTime() - TIER_INACTIVITY_DOWNGRADE_DAYS * MILLISECONDS_PER_DAY);
};

const normalizeDowngradeLimit = (limit) => {
    const value = Number(limit);

    if (!Number.isInteger(value) || value < 1) {
        return 50;
    }

    return Math.min(value, 200);
};

const buildInactiveTierFilter = (cutoff) => {
    return {
        current_tier: { $ne: LOYALTY_TIERS.BRONZE },
        $or: [
            {
                last_tier_downgrade_at: { $ne: null, $lte: cutoff },
            },
            {
                last_tier_downgrade_at: null,
                last_visit_at: { $ne: null, $lte: cutoff },
            },
            {
                last_tier_downgrade_at: null,
                last_visit_at: null,
                created_at: { $lte: cutoff },
            },
        ],
    };
};

const getLowerTierRule = (tierRules, tierName) => {
    const orderedTierRules = [...tierRules].sort((left, right) => left.priority_level - right.priority_level);
    const currentIndex = orderedTierRules.findIndex((tierRule) => tierRule.tier_name === tierName);

    if (currentIndex <= 0) {
        return null;
    }

    return orderedTierRules[currentIndex - 1];
};

const downgradeInactiveCustomerTiers = async ({ limit = 50 } = {}) => {
    const session = await mongoose.startSession();

    try {
        let result = {
            downgraded_customers: 0,
            checked_customers: 0,
            skipped_customers: 0,
            downgrade_days: TIER_INACTIVITY_DOWNGRADE_DAYS,
            downgrades: [],
        };

        await session.withTransaction(async () => {
            const now = new Date();
            const cutoff = getTierInactivityCutoff(now);
            const tierRules = await getActiveTierRules(session);
            const query = CustomerLoyalty.find(buildInactiveTierFilter(cutoff))
                .sort({ last_tier_downgrade_at: 1, last_visit_at: 1, created_at: 1 })
                .limit(normalizeDowngradeLimit(limit))
                .session(session);
            const loyalties = await query;
            const downgrades = [];

            for (const loyalty of loyalties) {
                const previousTier = loyalty.current_tier;
                const lowerTierRule = getLowerTierRule(tierRules, previousTier);

                if (!lowerTierRule) {
                    continue;
                }

                loyalty.current_tier = lowerTierRule.tier_name;
                loyalty.last_tier_downgrade_at = now;
                loyalty.last_tier_review_at = now;
                loyalty.tier_recovery_started_at = loyalty.tier_recovery_started_at || now;

                await loyalty.save({ session });

                downgrades.push({
                    customer_id: loyalty.customer_id?.toString() || null,
                    previous_tier: previousTier,
                    current_tier: loyalty.current_tier,
                    last_tier_downgrade_at: now,
                    tier_recovery_started_at: loyalty.tier_recovery_started_at,
                });
            }

            result = {
                downgraded_customers: downgrades.length,
                checked_customers: loyalties.length,
                skipped_customers: loyalties.length - downgrades.length,
                downgrade_days: TIER_INACTIVITY_DOWNGRADE_DAYS,
                cutoff,
                checked_at: now,
                downgrades,
            };
        });

        return result;
    } finally {
        await session.endSession();
    }
};


const calculateRedeemPreview = async (customerId, payload = {}) => {
    const servicePackage = await getActiveServicePackageById(payload.service_package_id);
    const quote = payload.quote_id
        ? await servicePriceRuleService.getActiveQuote({
            quoteId: payload.quote_id,
            customerId,
        })
        : null;
    if (quote && quote.service_package_id.toString() !== servicePackage._id.toString()) {
        throw new AppError('Price quote does not match service package', 409, 'PRICE_QUOTE_CHANGED');
    }
    const loyalty = await getOrCreateCustomerLoyalty(customerId);
    const redeemRule = await getActiveRedeemRule();
    const promotion = await getPromotionForRedeemPreview({
        promotion_id: payload.promotion_id,
        promotion_code: payload.promotion_code,
    });

    const originalPrice = quote?.subtotal ?? servicePackage.base_price;
    let promotionDiscountAmount = 0;

    if (promotion) {
        await assertPromotionApplicableForRedeemPreview({
            promotion,
            customerId,
            customerTier: loyalty.current_tier,
            servicePackage,
            orderAmount: originalPrice,
        });

        promotionDiscountAmount = calculatePromotionDiscountAmount(promotion, originalPrice);
    }

    const priceAfterPromotion = Math.max(originalPrice - promotionDiscountAmount, 0);
    const voucherResult = await customerVoucherService.previewVoucherForBooking({
        customerId,
        code: payload.voucher_code,
        servicePackage,
        orderAmount: priceAfterPromotion,
    });
    const voucherDiscountAmount = voucherResult?.discount_amount || 0;
    const priceAfterVoucher = Math.max(priceAfterPromotion - voucherDiscountAmount, 0);
    const usedPoints = payload.used_points || 0;
    const pointsDiscountAmount = calculatePointsDiscountAmount({
        usedPoints,
        availablePoints: loyalty.available_points,
        priceAfterPromotion: priceAfterVoucher,
        redeemRule,
    });
    const discountAmount = promotionDiscountAmount + voucherDiscountAmount + pointsDiscountAmount;
    const finalPrice = Math.max(originalPrice - discountAmount, 0);

    return LoyaltyMapper.toRedeemPreviewDto({
        service_package_id: servicePackage._id,
        promotion_id: promotion?._id || null,
        promotion_code: promotion?.code || normalizePromotionCode(payload.promotion_code) || null,
        original_price: originalPrice,
        promotion_discount_amount: promotionDiscountAmount,
        price_after_promotion: priceAfterPromotion,
        available_points: loyalty.available_points,
        used_points: usedPoints,
        point_value_amount: redeemRule.point_value_amount,
        points_discount_amount: pointsDiscountAmount,
        discount_amount: discountAmount,
        final_price: finalPrice,
        redeem_rule: redeemRule,
    });
};

const assertCustomerExists = async (customerId) => {
    const customer = await User.findOne({
        _id: customerId,
        role: USER_ROLES.CUSTOMER,
    });

    if (!customer) {
        throw new AppError('Customer not found', 404, 'CUSTOMER_NOT_FOUND');
    }

    if (!customer.is_active) {
        throw new AppError('Customer account is inactive', 400, 'CUSTOMER_INACTIVE');
    }

    return customer;
};

const buildPointTransactionFilter = ({ customer_id, booking_id, type } = {}) => {
    const filter = {};

    if (customer_id) {
        filter.customer_id = new mongoose.Types.ObjectId(customer_id);
    }

    if (booking_id) {
        filter.booking_id = booking_id;
    }

    if (type) {
        filter.type = type;
    }

    return filter;
};

const findCustomerIdsBySearch = async (search) => {
    if (!search) {
        return null;
    }

    const keyword = escapeRegExp(search.trim());
    const users = await User.find({
        role: USER_ROLES.CUSTOMER,
        $or: [
            { full_name: { $regex: keyword, $options: 'i' } },
            { email: { $regex: keyword, $options: 'i' } },
            { phone: { $regex: keyword, $options: 'i' } },
        ],
    }).select('_id');

    return users.map((user) => user._id);
};


const buildExpiringPointFilter = ({ customer_id, expires_before } = {}) => {
    const filter = {
        type: {
            $in: [
                POINT_TRANSACTION_TYPES.EARN,
                POINT_TRANSACTION_TYPES.SURVEY_REWARD,
                POINT_TRANSACTION_TYPES.REVIEW_REWARD,
                POINT_TRANSACTION_TYPES.REFUND,
            ],
        },
        remaining_points: { $gt: 0 },
        expires_at: {
            $ne: null,
            $lte: expires_before,
        },
    };

    if (customer_id) {
        filter.customer_id = new mongoose.Types.ObjectId(customer_id);
    }

    return filter;
};

const getExpiringPointTransactions = async ({ page = 1, limit = 20, customer_id, days = 30 } = {}) => {
    const now = new Date();
    const expiresBefore = new Date(now);
    expiresBefore.setDate(expiresBefore.getDate() + days);

    const filter = buildExpiringPointFilter({
        customer_id,
        expires_before: expiresBefore,
    });
    const skip = (page - 1) * limit;

    const [transactions, total, summary] = await Promise.all([
        PointTransaction.find(filter)
            .populate('customer_id', 'full_name email phone role is_active')
            .sort({ expires_at: 1, created_at: 1 })
            .skip(skip)
            .limit(limit),
        PointTransaction.countDocuments(filter),
        PointTransaction.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    total_expiring_points: { $sum: '$remaining_points' },
                },
            },
        ]),
    ]);

    return {
        data: LoyaltyMapper.toPointTransactionDtoList(transactions),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
            days,
            expires_before: expiresBefore,
            total_expiring_points: summary[0]?.total_expiring_points || 0,
        },
    };
};

const groupPointTransactionsByCustomer = (transactions = []) => {
    const grouped = new Map();

    transactions.forEach((transaction) => {
        const customerId = transaction.customer_id.toString();

        if (!grouped.has(customerId)) {
            grouped.set(customerId, []);
        }

        grouped.get(customerId).push(transaction);
    });

    return grouped;
};

const expireDuePoints = async ({ customer_id, actorId } = {}) => {
    const session = await mongoose.startSession();

    try {
        let result = {
            expired_points: 0,
            customers_processed: 0,
            source_transactions_processed: 0,
            expire_transactions: [],
        };

        await session.withTransaction(async () => {
            const now = new Date();
            const filter = buildExpiringPointFilter({
                customer_id,
                expires_before: now,
            });

            const dueTransactions = await PointTransaction.find(filter)
                .sort({ customer_id: 1, expires_at: 1, created_at: 1 })
                .session(session);

            if (!dueTransactions.length) {
                if (customer_id) {
                    await CustomerLoyalty.findOneAndUpdate(
                        { customer_id },
                        { last_point_expiry_check_at: now },
                        { session }
                    );
                }

                result = {
                    ...result,
                    checked_at: now,
                };

                return;
            }

            const groupedTransactions = groupPointTransactionsByCustomer(dueTransactions);
            const expireTransactions = [];
            let totalExpiredPoints = 0;
            let totalSourceTransactions = 0;

            for (const [customerId, transactions] of groupedTransactions.entries()) {
                const loyalty = await getOrCreateCustomerLoyalty(customerId, session);
                const expiredPoints = transactions.reduce(
                    (sum, transaction) => sum + transaction.remaining_points,
                    0
                );
                const balanceBefore = loyalty.available_points;
                const balanceAfter = Math.max(0, balanceBefore - expiredPoints);
                const sourceTransactionIds = transactions.map((transaction) => transaction._id);

                loyalty.available_points = balanceAfter;
                loyalty.expired_points += expiredPoints;
                loyalty.last_point_expiry_check_at = now;

                await loyalty.save({ session });

                await PointTransaction.updateMany(
                    { _id: { $in: sourceTransactionIds } },
                    {
                        $set: {
                            remaining_points: 0,
                            expired_at: now,
                        },
                    },
                    { session }
                );

                const createdTransactions = await PointTransaction.create(
                    [
                        {
                            customer_id: customerId,
                            booking_id: null,
                            type: POINT_TRANSACTION_TYPES.EXPIRE,
                            points: -expiredPoints,
                            remaining_points: 0,
                            balance_before: balanceBefore,
                            balance_after: balanceAfter,
                            description: 'Expire unused loyalty points',
                            earned_at: null,
                            expires_at: null,
                            expired_at: now,
                            source_transaction_ids: sourceTransactionIds,
                            created_by: actorId || null,
                        },
                    ],
                    { session }
                );

                expireTransactions.push(createdTransactions[0]);
                totalExpiredPoints += expiredPoints;
                totalSourceTransactions += transactions.length;
            }

            result = {
                expired_points: totalExpiredPoints,
                customers_processed: groupedTransactions.size,
                source_transactions_processed: totalSourceTransactions,
                checked_at: now,
                expire_transactions: LoyaltyMapper.toPointTransactionDtoList(expireTransactions),
            };
        });

        return result;
    } finally {
        await session.endSession();
    }
};

const getCustomerLoyaltyOverview = async (customerId) => {
    const loyalty = await getOrCreateCustomerLoyalty(customerId);
    const populatedLoyalty = await CustomerLoyalty.findById(loyalty._id)
        .populate('customer_id', 'full_name email phone role is_active');
    const { currentTierRule, nextTierRule } = await getTierRuleContext(populatedLoyalty);

    return LoyaltyMapper.toLoyaltyOverviewDto({
        loyalty: populatedLoyalty,
        currentTierRule,
        nextTierRule,
    });
};

const getCustomerPointTransactions = async (customerId, { page = 1, limit = 20, type, booking_id } = {}) => {
    const filter = buildPointTransactionFilter({
        customer_id: customerId,
        booking_id,
        type,
    });
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
        PointTransaction.find(filter)
            .populate('customer_id', 'full_name email phone role is_active')
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit),
        PointTransaction.countDocuments(filter),
    ]);

    return {
        data: LoyaltyMapper.toPointTransactionDtoList(transactions),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

const getTierRules = async ({ active_only = true } = {}) => {
    const filter = active_only ? { is_active: true } : {};
    const tierRules = await TierRule.find(filter).sort({ priority_level: 1 });

    return LoyaltyMapper.toTierRuleDtoList(tierRules);
};


const getTierRuleById = async (tierRuleId) => {
    const tierRule = await TierRule.findById(tierRuleId);

    if (!tierRule) {
        throw new AppError('Tier rule not found', 404, 'TIER_RULE_NOT_FOUND');
    }

    return LoyaltyMapper.toTierRuleDto(tierRule);
};

const createTierRule = async (payload) => {
    const existingTierRule = await TierRule.findOne({
        tier_name: payload.tier_name,
    });

    if (existingTierRule) {
        throw new AppError('Tier rule already exists', 409, 'TIER_RULE_ALREADY_EXISTS');
    }

    const tierRule = await TierRule.create(payload);

    return LoyaltyMapper.toTierRuleDto(tierRule);
};

const updateTierRule = async (tierRuleId, payload) => {
    const tierRule = await TierRule.findById(tierRuleId);

    if (!tierRule) {
        throw new AppError('Tier rule not found', 404, 'TIER_RULE_NOT_FOUND');
    }

    Object.assign(tierRule, payload);

    await tierRule.save();

    return LoyaltyMapper.toTierRuleDto(tierRule);
};

const setTierRuleActiveStatus = async (tierRuleId, isActive) => {
    const tierRule = await TierRule.findByIdAndUpdate(
        tierRuleId,
        { is_active: isActive },
        { new: true, runValidators: true }
    );

    if (!tierRule) {
        throw new AppError('Tier rule not found', 404, 'TIER_RULE_NOT_FOUND');
    }

    return LoyaltyMapper.toTierRuleDto(tierRule);
};

const deleteTierRule = async (tierRuleId) => {
    const tierRule = await TierRule.findByIdAndDelete(tierRuleId);

    if (!tierRule) {
        throw new AppError('Tier rule not found', 404, 'TIER_RULE_NOT_FOUND');
    }

    return LoyaltyMapper.toTierRuleDto(tierRule);
};

const getAllCustomerLoyalties = async ({ page = 1, limit = 20, search, tier } = {}) => {
    const filter = {};

    if (tier) {
        filter.current_tier = tier;
    }

    const customerIds = await findCustomerIdsBySearch(search);

    if (customerIds) {
        filter.customer_id = { $in: customerIds };
    }

    const skip = (page - 1) * limit;

    const [loyalties, total] = await Promise.all([
        CustomerLoyalty.find(filter)
            .populate('customer_id', 'full_name email phone role is_active')
            .sort({ total_spent: -1, total_visits: -1, available_points: -1, created_at: -1 })
            .skip(skip)
            .limit(limit),
        CustomerLoyalty.countDocuments(filter),
    ]);

    return {
        data: LoyaltyMapper.toCustomerLoyaltyDtoList(loyalties),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

const getCustomerLoyaltyForAdmin = async (customerId) => {
    await assertCustomerExists(customerId);

    return getCustomerLoyaltyOverview(customerId);
};

const getAllPointTransactions = async ({ page = 1, limit = 20, customer_id, booking_id, type } = {}) => {
    const filter = buildPointTransactionFilter({
        customer_id,
        booking_id,
        type,
    });
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
        PointTransaction.find(filter)
            .populate('customer_id', 'full_name email phone role is_active')
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit),
        PointTransaction.countDocuments(filter),
    ]);

    return {
        data: LoyaltyMapper.toPointTransactionDtoList(transactions),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

module.exports = {
    getOrCreateCustomerLoyalty,
    calculateEarnedPoints,
    processBookingLoyalty,
    calculateBookingRedeemDiscount,
    redeemPointsForBooking,
    refundRedeemedPointsForBooking,
    calculateRedeemPreview,
    reviewCustomerTier,
    downgradeInactiveCustomerTiers,
    getCustomerLoyaltyOverview,
    getCustomerPointTransactions,
    getTierRules,
    getTierRuleById,
    createTierRule,
    updateTierRule,
    setTierRuleActiveStatus,
    deleteTierRule,
    getAllCustomerLoyalties,
    getCustomerLoyaltyForAdmin,
    getAllPointTransactions,
    getExpiringPointTransactions,
    expireDuePoints,
};
