const PromotionUsage = require('./promotionUsage.model');
const Promotion = require('../promotions/promotion.model');
const PromotionUsageMapper = require('./promotionUsage.mapper');
const { AppError } = require('../../shared/utils/appError');
const {
    PROMOTION_USAGE_STATUS,
} = require('../../shared/constants/promotion.constant');

const buildPhoneUsageKey = (promotionId, guestPhoneNormalized) => {
    return `${promotionId.toString()}:${guestPhoneNormalized}`;
};

const incrementReservedCount = async (promotion, session = null) => {
    if (promotion.usage_limit) {
        const updatedPromotion = await Promotion.findOneAndUpdate(
            {
                _id: promotion._id,
                $expr: {
                    $lt: [
                        {
                            $add: [
                                { $ifNull: ['$used_count', 0] },
                                { $ifNull: ['$reserved_count', 0] },
                            ],
                        },
                        '$usage_limit',
                    ],
                },
            },
            { $inc: { reserved_count: 1 } },
            {
                new: true,
                session: session || undefined,
            }
        );

        if (!updatedPromotion) {
            throw new AppError('Promotion usage limit has been reached', 409, 'PROMOTION_USAGE_LIMIT_REACHED');
        }

        return;
    }

    await Promotion.updateOne(
        { _id: promotion._id },
        { $inc: { reserved_count: 1 } },
        session ? { session } : undefined
    );
};

const reservePromotionUsageForBooking = async ({
    booking,
    promotion,
    guestPhoneNormalized,
    actorId,
    session = null,
}) => {
    if (!promotion || !booking?.promotion_id) {
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

    await incrementReservedCount(promotion, session);

    const reservedAt = new Date();
    const phoneUsageKey = promotion.per_phone_limit && guestPhoneNormalized
        ? buildPhoneUsageKey(promotion._id, guestPhoneNormalized)
        : null;

    try {
        const documents = await PromotionUsage.create(
            [
                {
                    promotion_id: booking.promotion_id,
                    booking_id: booking._id,
                    customer_id: booking.customer_id || null,
                    guest_phone_normalized: guestPhoneNormalized || null,
                    phone_usage_key: phoneUsageKey,
                    used_by_staff_id: actorId || null,
                    discount_amount: booking.promotion_discount_amount || 0,
                    status: PROMOTION_USAGE_STATUS.RESERVED,
                    reserved_at: reservedAt,
                    used_at: null,
                },
            ],
            session ? { session } : undefined
        );

        return PromotionUsageMapper.toPromotionUsageDto(documents[0]);
    } catch (error) {
        if (!session) {
            await Promotion.updateOne(
                { _id: promotion._id, reserved_count: { $gt: 0 } },
                { $inc: { reserved_count: -1 } }
            );
        }

        if (error?.code === 11000 && phoneUsageKey) {
            throw new AppError('Phone promotion usage limit has been reached', 409, 'PROMOTION_PHONE_USAGE_LIMIT_REACHED');
        }

        throw error;
    }
};

const createPromotionUsageFromBooking = async ({ booking, actorId, session = null }) => {
    if (!booking.promotion_id) {
        return null;
    }

    const consumedAt = booking.paid_at || new Date();
    const reservedUsage = await PromotionUsage.findOneAndUpdate(
        {
            booking_id: booking._id,
            status: PROMOTION_USAGE_STATUS.RESERVED,
        },
        {
            $set: {
                status: PROMOTION_USAGE_STATUS.CONSUMED,
                consumed_at: consumedAt,
                used_at: consumedAt,
                used_by_staff_id: actorId || null,
            },
        },
        {
            new: true,
            session: session || undefined,
        }
    );

    if (reservedUsage) {
        await Promotion.updateOne(
            { _id: booking.promotion_id },
            {
                $inc: {
                    reserved_count: -1,
                    used_count: 1,
                },
            },
            session ? { session } : undefined
        );

        return PromotionUsageMapper.toPromotionUsageDto(reservedUsage);
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
                customer_id: booking.customer_id || booking.claimed_customer_id || null,
                guest_phone_normalized: booking.normalized_guest_phone || null,
                used_by_staff_id: actorId || null,
                discount_amount: booking.promotion_discount_amount || 0,
                status: PROMOTION_USAGE_STATUS.CONSUMED,
                consumed_at: consumedAt,
                used_at: consumedAt,
            },
        ],
        session ? { session } : undefined
    );

    await Promotion.updateOne(
        { _id: booking.promotion_id },
        { $inc: { used_count: 1 } },
        session ? { session } : undefined
    );

    return PromotionUsageMapper.toPromotionUsageDto(documents[0]);
};

const releaseReservedPromotionForBooking = async ({ bookingId, session = null }) => {
    const releasedAt = new Date();
    const usage = await PromotionUsage.findOneAndUpdate(
        {
            booking_id: bookingId,
            status: PROMOTION_USAGE_STATUS.RESERVED,
        },
        {
            $set: {
                status: PROMOTION_USAGE_STATUS.RELEASED,
                released_at: releasedAt,
                phone_usage_key: null,
            },
        },
        {
            new: true,
            session: session || undefined,
        }
    );

    if (!usage) {
        return null;
    }

    await Promotion.updateOne(
        {
            _id: usage.promotion_id,
            reserved_count: { $gt: 0 },
        },
        { $inc: { reserved_count: -1 } },
        session ? { session } : undefined
    );

    return PromotionUsageMapper.toPromotionUsageDto(usage);
};

module.exports = {
    reservePromotionUsageForBooking,
    createPromotionUsageFromBooking,
    releaseReservedPromotionForBooking,
};
