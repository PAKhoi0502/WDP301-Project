const User = require('../users/user.model');
const CustomerLoyalty = require('./customerLoyalty.model');
const PointTransaction = require('./pointTransaction.model');
const TierRule = require('./tierRule.model');
const LoyaltyRedeemRule = require('./loyaltyRedeemRule.model');
const ServicePackage = require('../service-packages/servicePackage.model');
const Promotion = require('../promotions/promotion.model');
const PromotionUsage = require('../promotion-usages/promotionUsage.model');
const LoyaltyMapper = require('./loyalty.mapper');
const { AppError } = require('../../shared/utils/appError');
const { USER_ROLES } = require('../../shared/constants/roles.constant');
const {
    LOYALTY_TIERS,
    POINT_TRANSACTION_TYPES,
    POINT_EXPIRY_MONTHS,
} = require('../../shared/constants/loyalty.constant');
const { PROMOTION_DISCOUNT_TYPES } = require('../../shared/constants/promotion.constant');

const addMonths = (date, months) => {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);

    return result;
};

const escapeRegExp = (value) => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
                available_points: 0,
                redeemed_points: 0,
                expired_points: 0,
                total_spent: 0,
                total_visits: 0,
                last_visit_at: null,
                last_tier_review_at: null,
                last_point_expiry_check_at: null,
            },
        ],
        session ? { session } : undefined
    );

    return documents[0];
};

const calculateEarnedPoints = async ({ booking, servicePackage, loyalty, session = null }) => {
    if (!booking.customer_id || booking.final_price <= 0 || booking.original_price <= 0) {
        return 0;
    }

    const pointMultiplier = await getPointMultiplier(loyalty.current_tier, session);
    const paymentRatio = booking.final_price / booking.original_price;

    return Math.floor(servicePackage.points_earned * pointMultiplier * paymentRatio);
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

const getEligibleTierRule = async (loyalty, session = null) => {
    const query = TierRule.find({ is_active: true }).sort({ priority_level: -1 });

    if (session) {
        query.session(session);
    }

    const tierRules = await query;

    return tierRules.find((tierRule) => {
        return loyalty.total_spent >= tierRule.min_total_spent
            && loyalty.total_visits >= tierRule.min_total_visits
            && loyalty.total_points >= tierRule.min_total_points;
    }) || tierRules.find((tierRule) => tierRule.tier_name === LOYALTY_TIERS.BRONZE) || null;
};

const reviewCustomerTier = async (loyalty, session = null) => {
    const previousTier = loyalty.current_tier;
    const eligibleTierRule = await getEligibleTierRule(loyalty, session);

    if (eligibleTierRule) {
        loyalty.current_tier = eligibleTierRule.tier_name;
    }

    loyalty.last_tier_review_at = new Date();

    return {
        previous_tier: previousTier,
        current_tier: loyalty.current_tier,
        tier_changed: previousTier !== loyalty.current_tier,
    };
};

const processBookingLoyalty = async ({ booking, servicePackage, actorId, session = null }) => {
    if (!booking.customer_id) {
        return {
            loyalty: null,
            point_transaction: null,
            earned_points: 0,
            tier_review: null,
        };
    }

    const now = new Date();
    const loyalty = await getOrCreateCustomerLoyalty(booking.customer_id, session);
    const earnedPoints = await calculateEarnedPoints({
        booking,
        servicePackage,
        loyalty,
        session,
    });
    const balanceBefore = loyalty.available_points;
    const balanceAfter = balanceBefore + earnedPoints;

    loyalty.total_spent += booking.final_price;
    loyalty.total_visits += 1;
    loyalty.last_visit_at = now;

    let pointTransaction = null;

    if (earnedPoints > 0) {
        loyalty.total_points += earnedPoints;
        loyalty.available_points = balanceAfter;

        const transactions = await PointTransaction.create(
            [
                {
                    customer_id: booking.customer_id,
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
    };
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
        filter.customer_id = customer_id;
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


const getActiveRedeemRule = async () => {
    const redeemRule = await LoyaltyRedeemRule.findOne({ is_active: true }).sort({ created_at: -1 });

    if (!redeemRule) {
        throw new AppError('Active loyalty redeem rule is not configured', 500, 'LOYALTY_REDEEM_RULE_NOT_CONFIGURED');
    }

    return redeemRule;
};

const getActiveServicePackageForRedeem = async (servicePackageId) => {
    const servicePackage = await ServicePackage.findById(servicePackageId);

    if (!servicePackage) {
        throw new AppError('Service package not found', 404, 'SERVICE_PACKAGE_NOT_FOUND');
    }

    if (!servicePackage.is_active) {
        throw new AppError('Service package is inactive', 400, 'SERVICE_PACKAGE_INACTIVE');
    }

    return servicePackage;
};

const normalizePromotionCode = (value) => {
    if (typeof value !== 'string') {
        return value;
    }

    return value.trim().toUpperCase();
};

const getPromotionForRedeemPreview = async ({ promotion_id, promotion_code } = {}) => {
    if (!promotion_id && !promotion_code) {
        return null;
    }

    const filter = promotion_id
        ? { _id: promotion_id }
        : { code: normalizePromotionCode(promotion_code) };

    const promotion = await Promotion.findOne(filter);

    if (!promotion) {
        throw new AppError('Promotion not found', 404, 'PROMOTION_NOT_FOUND');
    }

    return promotion;
};

const calculatePromotionDiscountAmount = (promotion, orderAmount) => {
    if (!promotion) {
        return 0;
    }

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

const assertPromotionCanBeUsedForRedeemPreview = async ({ promotion, customerId, loyalty, servicePackage, orderAmount }) => {
    if (!promotion) {
        return;
    }

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

    if (promotion.applicable_tiers?.length && !promotion.applicable_tiers.includes(loyalty.current_tier)) {
        throw new AppError('Promotion is not available for customer tier', 400, 'PROMOTION_TIER_NOT_ELIGIBLE');
    }

    if (promotion.applicable_vehicle_types?.length && !promotion.applicable_vehicle_types.includes(servicePackage.vehicle_type)) {
        throw new AppError('Promotion is not available for this vehicle type', 400, 'PROMOTION_VEHICLE_TYPE_NOT_ELIGIBLE');
    }

    if (promotion.applicable_service_package_ids?.length) {
        const servicePackageId = servicePackage._id.toString();
        const isApplicableService = promotion.applicable_service_package_ids.some((item) => item.toString() === servicePackageId);

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

const assertRedeemPointsValid = ({ usedPoints, loyalty, redeemRule, priceAfterPromotion }) => {
    if (usedPoints === 0) {
        return;
    }

    if (usedPoints > loyalty.available_points) {
        throw new AppError('Used points exceed available points', 400, 'LOYALTY_POINTS_NOT_ENOUGH');
    }

    if (usedPoints < redeemRule.min_redeem_points) {
        throw new AppError('Used points do not meet minimum redeem points', 400, 'LOYALTY_REDEEM_MIN_POINTS_NOT_MET');
    }

    if (usedPoints % redeemRule.redeem_step !== 0) {
        throw new AppError('Used points must follow redeem step', 400, 'LOYALTY_REDEEM_STEP_INVALID');
    }

    const maxDiscountByPercent = Math.floor((priceAfterPromotion * redeemRule.max_redeem_percent) / 100);
    const maxAllowedDiscount = Math.min(priceAfterPromotion, maxDiscountByPercent);
    const requestedDiscount = usedPoints * redeemRule.point_value_amount;

    if (requestedDiscount > maxAllowedDiscount) {
        throw new AppError('Point discount exceeds allowed redeem amount', 400, 'LOYALTY_REDEEM_AMOUNT_EXCEEDED');
    }
};

const getRedeemPreview = async (customerId, payload = {}) => {
    await assertCustomerExists(customerId);

    const [servicePackage, loyalty, redeemRule] = await Promise.all([
        getActiveServicePackageForRedeem(payload.service_package_id),
        getOrCreateCustomerLoyalty(customerId),
        getActiveRedeemRule(),
    ]);
    const promotion = await getPromotionForRedeemPreview({
        promotion_id: payload.promotion_id,
        promotion_code: payload.promotion_code,
    });

    await assertPromotionCanBeUsedForRedeemPreview({
        promotion,
        customerId,
        loyalty,
        servicePackage,
        orderAmount: servicePackage.base_price,
    });

    const originalPrice = servicePackage.base_price;
    const promotionDiscountAmount = calculatePromotionDiscountAmount(promotion, originalPrice);
    const priceAfterPromotion = Math.max(originalPrice - promotionDiscountAmount, 0);
    const usedPoints = payload.used_points || 0;

    assertRedeemPointsValid({
        usedPoints,
        loyalty,
        redeemRule,
        priceAfterPromotion,
    });

    const pointsDiscountAmount = Math.min(usedPoints * redeemRule.point_value_amount, priceAfterPromotion);
    const discountAmount = promotionDiscountAmount + pointsDiscountAmount;
    const finalPrice = Math.max(originalPrice - discountAmount, 0);

    return LoyaltyMapper.toRedeemPreviewDto({
        service_package_id: servicePackage._id,
        promotion_id: promotion?._id || null,
        promotion_code: promotion?.code || null,
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

module.exports = {
    getOrCreateCustomerLoyalty,
    calculateEarnedPoints,
    processBookingLoyalty,
    reviewCustomerTier,
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
    getRedeemPreview,
};
