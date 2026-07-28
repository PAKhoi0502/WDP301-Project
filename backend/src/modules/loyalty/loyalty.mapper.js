const toId = (value) => {
    if (!value) {
        return null;
    }

    if (value._id) {
        return value._id.toString();
    }

    if (value.toString) {
        return value.toString();
    }

    return value;
};

const toUserSummaryDto = (user) => {
    if (!user || !user._id) {
        return null;
    }

    const plainUser = user.toObject ? user.toObject() : user;

    return {
        id: plainUser._id?.toString() || plainUser.id || null,
        full_name: plainUser.full_name || '',
        email: plainUser.email || null,
        phone: plainUser.phone || null,
        role: plainUser.role,
        is_active: plainUser.is_active,
    };
};

const toCustomerLoyaltyDto = (loyalty) => {
    if (!loyalty) {
        return null;
    }

    const plainLoyalty = loyalty.toObject ? loyalty.toObject() : loyalty;
    const customer = toUserSummaryDto(plainLoyalty.customer_id);

    return {
        id: plainLoyalty._id?.toString() || plainLoyalty.id || null,
        customer_id: toId(plainLoyalty.customer_id),
        customer,
        current_tier: plainLoyalty.current_tier,
        total_points: plainLoyalty.total_points,
        available_points: plainLoyalty.available_points,
        redeemed_points: plainLoyalty.redeemed_points,
        expired_points: plainLoyalty.expired_points,
        total_spent: plainLoyalty.total_spent,
        total_visits: plainLoyalty.total_visits,
        last_visit_at: plainLoyalty.last_visit_at,
        last_tier_review_at: plainLoyalty.last_tier_review_at,
        last_tier_downgrade_at: plainLoyalty.last_tier_downgrade_at,
        tier_recovery_started_at: plainLoyalty.tier_recovery_started_at,
        last_point_expiry_check_at: plainLoyalty.last_point_expiry_check_at,
        created_at: plainLoyalty.created_at,
        updated_at: plainLoyalty.updated_at,
    };
};

const toCustomerLoyaltyDtoList = (loyalties = []) => {
    return loyalties.map((loyalty) => toCustomerLoyaltyDto(loyalty));
};

const toPointTransactionDto = (transaction) => {
    if (!transaction) {
        return null;
    }

    const plainTransaction = transaction.toObject ? transaction.toObject() : transaction;
    const customer = toUserSummaryDto(plainTransaction.customer_id);

    return {
        id: plainTransaction._id?.toString() || plainTransaction.id || null,
        customer_id: toId(plainTransaction.customer_id),
        customer,
        booking_id: toId(plainTransaction.booking_id),
        type: plainTransaction.type,
        points: plainTransaction.points,
        remaining_points: plainTransaction.remaining_points,
        balance_before: plainTransaction.balance_before,
        balance_after: plainTransaction.balance_after,
        description: plainTransaction.description,
        earned_at: plainTransaction.earned_at,
        expires_at: plainTransaction.expires_at,
        expired_at: plainTransaction.expired_at,
        source_transaction_ids: (plainTransaction.source_transaction_ids || []).map((item) => toId(item)),
        created_by: toId(plainTransaction.created_by),
        created_at: plainTransaction.created_at,
        updated_at: plainTransaction.updated_at,
    };
};

const toPointTransactionDtoList = (transactions = []) => {
    return transactions.map((transaction) => toPointTransactionDto(transaction));
};

const toTierRuleDto = (tierRule) => {
    if (!tierRule) {
        return null;
    }

    const plainTierRule = tierRule.toObject ? tierRule.toObject() : tierRule;

    return {
        id: plainTierRule._id?.toString() || plainTierRule.id || null,
        tier_name: plainTierRule.tier_name,
        booking_window_days: plainTierRule.booking_window_days,
        max_upcoming_bookings: plainTierRule.max_upcoming_bookings,
        point_multiplier: plainTierRule.point_multiplier,
        priority_level: plainTierRule.priority_level,
        min_total_spent: plainTierRule.min_total_spent,
        min_total_visits: plainTierRule.min_total_visits,
        min_total_points: plainTierRule.min_total_points,
        is_active: plainTierRule.is_active,
        created_at: plainTierRule.created_at,
        updated_at: plainTierRule.updated_at,
    };
};

const toTierRuleDtoList = (tierRules = []) => {
    return tierRules.map((tierRule) => toTierRuleDto(tierRule));
};


const toLoyaltyRedeemRuleDto = (redeemRule) => {
    if (!redeemRule) {
        return null;
    }

    const plainRedeemRule = redeemRule.toObject ? redeemRule.toObject() : redeemRule;

    return {
        id: plainRedeemRule._id?.toString() || plainRedeemRule.id || null,
        rule_code: plainRedeemRule.rule_code || null,
        point_value_amount: plainRedeemRule.point_value_amount,
        min_redeem_points: plainRedeemRule.min_redeem_points,
        redeem_step: plainRedeemRule.redeem_step,
        max_redeem_percent: plainRedeemRule.max_redeem_percent,
        is_active: plainRedeemRule.is_active,
        created_at: plainRedeemRule.created_at,
        updated_at: plainRedeemRule.updated_at,
    };
};

const toRedeemPreviewDto = (preview) => {
    if (!preview) {
        return null;
    }

    return {
        service_package_id: toId(preview.service_package_id),
        promotion_id: toId(preview.promotion_id),
        promotion_code: preview.promotion_code || null,
        original_price: preview.original_price,
        promotion_discount_amount: preview.promotion_discount_amount,
        price_after_promotion: preview.price_after_promotion,
        available_points: preview.available_points,
        used_points: preview.used_points,
        point_value_amount: preview.point_value_amount,
        points_discount_amount: preview.points_discount_amount,
        discount_amount: preview.discount_amount,
        final_price: preview.final_price,
        redeem_rule: toLoyaltyRedeemRuleDto(preview.redeem_rule),
    };
};

const toLoyaltyOverviewDto = ({ loyalty, currentTierRule, nextTierRule }) => {
    return {
        loyalty: toCustomerLoyaltyDto(loyalty),
        current_tier_rule: toTierRuleDto(currentTierRule),
        next_tier_rule: toTierRuleDto(nextTierRule),
    };
};

module.exports = {
    toCustomerLoyaltyDto,
    toCustomerLoyaltyDtoList,
    toPointTransactionDto,
    toPointTransactionDtoList,
    toTierRuleDto,
    toTierRuleDtoList,
    toLoyaltyRedeemRuleDto,
    toRedeemPreviewDto,
    toLoyaltyOverviewDto,
};
