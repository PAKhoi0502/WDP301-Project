const PromotionUsage = require('./promotionUsage.model');
const PromotionUsageMapper = require('./promotionUsage.mapper');

const createPromotionUsageFromBooking = async ({ booking, actorId, session = null }) => {
    if (!booking.promotion_id) {
        return null;
    }

    const existingQuery = PromotionUsage.findOne({ booking_id: booking._id });

    if (session) {
        existingQuery.session(session);
    }

    const existingUsage = await existingQuery;

    if (existingUsage) {
        return PromotionUsageMapper.toPromotionUsageDto(existingUsage);
    }

    const documents = await PromotionUsage.create(
        [
            {
                promotion_id: booking.promotion_id,
                booking_id: booking._id,
                customer_id: booking.customer_id || null,
                used_by_staff_id: actorId || null,
                discount_amount: booking.promotion_discount_amount || 0,
                used_at: booking.paid_at || new Date(),
            },
        ],
        session ? { session } : undefined
    );

    return PromotionUsageMapper.toPromotionUsageDto(documents[0]);
};

module.exports = {
    createPromotionUsageFromBooking,
};
