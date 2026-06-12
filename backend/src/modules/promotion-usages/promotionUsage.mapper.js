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

const toPromotionUsageDto = (usage) => {
    if (!usage) {
        return null;
    }

    const plainUsage = usage.toObject ? usage.toObject() : usage;

    return {
        id: plainUsage._id?.toString() || plainUsage.id || null,
        promotion_id: toId(plainUsage.promotion_id),
        booking_id: toId(plainUsage.booking_id),
        customer_id: toId(plainUsage.customer_id),
        guest_phone_normalized: plainUsage.guest_phone_normalized || null,
        used_by_staff_id: toId(plainUsage.used_by_staff_id),
        discount_amount: plainUsage.discount_amount,
        status: plainUsage.status,
        reserved_at: plainUsage.reserved_at || null,
        consumed_at: plainUsage.consumed_at || null,
        released_at: plainUsage.released_at || null,
        used_at: plainUsage.used_at || null,
        created_at: plainUsage.created_at,
        updated_at: plainUsage.updated_at,
    };
};

module.exports = {
    toPromotionUsageDto,
};
