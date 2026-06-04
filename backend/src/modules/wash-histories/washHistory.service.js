const WashHistory = require('./washHistory.model');
const WashHistoryMapper = require('./washHistory.mapper');

const createWashHistoryFromBooking = async ({ booking, earnedPoints = 0, session = null }) => {
    const existingQuery = WashHistory.findOne({ booking_id: booking._id });

    if (session) {
        existingQuery.session(session);
    }

    const existingWashHistory = await existingQuery;

    if (existingWashHistory) {
        return WashHistoryMapper.toWashHistoryDto(existingWashHistory);
    }

    const documents = await WashHistory.create(
        [
            {
                booking_id: booking._id,
                customer_id: booking.customer_id || null,
                vehicle_id: booking.vehicle_id || null,
                garage_id: booking.garage_id,
                wash_bay_id: booking.wash_bay_id || null,
                service_package_id: booking.service_package_id,
                vehicle_type: booking.vehicle_type,
                amount_paid: booking.final_price,
                original_price: booking.original_price,
                discount_amount: booking.discount_amount,
                points_earned: earnedPoints,
                points_used: booking.used_points || 0,
                payment_method: booking.payment_method,
                paid_at: booking.paid_at || new Date(),
                service_started_at: booking.started_at || null,
                service_completed_at: booking.completed_at,
            },
        ],
        session ? { session } : undefined
    );

    return WashHistoryMapper.toWashHistoryDto(documents[0]);
};

module.exports = {
    createWashHistoryFromBooking,
};
