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

const toWashHistoryDto = (washHistory) => {
    if (!washHistory) {
        return null;
    }

    const plainWashHistory = washHistory.toObject ? washHistory.toObject() : washHistory;

    return {
        id: plainWashHistory._id?.toString() || plainWashHistory.id || null,
        booking_id: toId(plainWashHistory.booking_id),
        customer_id: toId(plainWashHistory.customer_id),
        vehicle_id: toId(plainWashHistory.vehicle_id),
        garage_id: toId(plainWashHistory.garage_id),
        wash_bay_id: toId(plainWashHistory.wash_bay_id),
        service_package_id: toId(plainWashHistory.service_package_id),
        vehicle_type: plainWashHistory.vehicle_type,
        amount_paid: plainWashHistory.amount_paid,
        original_price: plainWashHistory.original_price,
        discount_amount: plainWashHistory.discount_amount,
        points_earned: plainWashHistory.points_earned,
        points_used: plainWashHistory.points_used,
        payment_method: plainWashHistory.payment_method,
        paid_at: plainWashHistory.paid_at,
        service_started_at: plainWashHistory.service_started_at,
        service_completed_at: plainWashHistory.service_completed_at,
        created_at: plainWashHistory.created_at,
        updated_at: plainWashHistory.updated_at,
    };
};

module.exports = {
    toWashHistoryDto,
};
