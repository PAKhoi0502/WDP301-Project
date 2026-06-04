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

const toCustomerLoyaltyDto = (loyalty) => {
    if (!loyalty) {
        return null;
    }

    const plainLoyalty = loyalty.toObject ? loyalty.toObject() : loyalty;

    return {
        id: plainLoyalty._id?.toString() || plainLoyalty.id || null,
        customer_id: toId(plainLoyalty.customer_id),
        current_tier: plainLoyalty.current_tier,
        total_points: plainLoyalty.total_points,
        available_points: plainLoyalty.available_points,
        redeemed_points: plainLoyalty.redeemed_points,
        expired_points: plainLoyalty.expired_points,
        total_spent: plainLoyalty.total_spent,
        total_visits: plainLoyalty.total_visits,
        last_visit_at: plainLoyalty.last_visit_at,
        last_tier_review_at: plainLoyalty.last_tier_review_at,
        last_point_expiry_check_at: plainLoyalty.last_point_expiry_check_at,
        created_at: plainLoyalty.created_at,
        updated_at: plainLoyalty.updated_at,
    };
};

const toPointTransactionDto = (transaction) => {
    if (!transaction) {
        return null;
    }

    const plainTransaction = transaction.toObject ? transaction.toObject() : transaction;

    return {
        id: plainTransaction._id?.toString() || plainTransaction.id || null,
        customer_id: toId(plainTransaction.customer_id),
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

module.exports = {
    toCustomerLoyaltyDto,
    toPointTransactionDto,
};
