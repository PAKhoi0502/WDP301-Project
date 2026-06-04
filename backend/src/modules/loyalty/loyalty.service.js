const CustomerLoyalty = require('./customerLoyalty.model');
const PointTransaction = require('./pointTransaction.model');
const TierRule = require('./tierRule.model');
const LoyaltyMapper = require('./loyalty.mapper');
const {
    LOYALTY_TIERS,
    POINT_TRANSACTION_TYPES,
    POINT_EXPIRY_MONTHS,
} = require('../../shared/constants/loyalty.constant');

const addMonths = (date, months) => {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);

    return result;
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

const processBookingLoyalty = async ({ booking, servicePackage, actorId, session = null }) => {
    if (!booking.customer_id) {
        return {
            loyalty: null,
            point_transaction: null,
            earned_points: 0,
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

    await loyalty.save(session ? { session } : undefined);

    return {
        loyalty: LoyaltyMapper.toCustomerLoyaltyDto(loyalty),
        point_transaction: LoyaltyMapper.toPointTransactionDto(pointTransaction),
        earned_points: earnedPoints,
    };
};

module.exports = {
    getOrCreateCustomerLoyalty,
    processBookingLoyalty,
};
