const mongoose = require('mongoose');

const Booking = require('../bookings/booking.model');
const WashHistory = require('./washHistory.model');
const PromotionUsage = require('../promotion-usages/promotionUsage.model');
const notificationService = require('../notifications/notification.service');
const { AppError } = require('../../shared/utils/appError');
const { normalizePhone, isValidPhone } = require('../../shared/utils/phone');
const {
    BOOKING_STATUS,
    BOOKING_PAYMENT_STATUS,
} = require('../../shared/constants/booking.constant');
const {
    NOTIFICATION_TYPES,
    NOTIFICATION_RELATED_TYPES,
} = require('../../shared/constants/notification.constant');

const DEFAULT_CLAIM_LOOKBACK_MONTHS = 12;

const getClaimCutoff = () => {
    const configuredMonths = Number(process.env.WALK_IN_CLAIM_LOOKBACK_MONTHS);
    const months = Number.isInteger(configuredMonths) && configuredMonths > 0
        ? configuredMonths
        : DEFAULT_CLAIM_LOOKBACK_MONTHS;
    const cutoff = new Date();

    cutoff.setMonth(cutoff.getMonth() - months);

    return cutoff;
};

const claimWalkInHistoryForCustomer = async ({
    customerId,
    phone,
    phoneVerifiedAt,
} = {}) => {
    const normalizedPhone = normalizePhone(phone);

    if (!phoneVerifiedAt) {
        throw new AppError('Verified phone is required to claim walk-in history', 400, 'VERIFIED_PHONE_REQUIRED');
    }

    if (!isValidPhone(normalizedPhone)) {
        throw new AppError('Phone number is invalid', 400, 'INVALID_PHONE');
    }

    const session = await mongoose.startSession();
    let result = {
        claimed_bookings: 0,
        claimed_wash_histories: 0,
        linked_promotion_usages: 0,
    };

    try {
        await session.withTransaction(async () => {
            const bookings = await Booking.find({
                is_walk_in: true,
                normalized_guest_phone: normalizedPhone,
                status: BOOKING_STATUS.COMPLETED,
                payment_status: {
                    $in: [
                        BOOKING_PAYMENT_STATUS.PAID,
                        BOOKING_PAYMENT_STATUS.WAIVED,
                    ],
                },
                paid_at: { $gte: getClaimCutoff() },
                claimed_customer_id: null,
            })
                .select('_id garage_id service_package_id')
                .session(session)
                .lean();
            const bookingIds = bookings.map((booking) => booking._id);

            if (!bookingIds.length) {
                return;
            }

            const claimedAt = new Date();
            const bookingUpdate = await Booking.updateMany(
                {
                    _id: { $in: bookingIds },
                    claimed_customer_id: null,
                },
                {
                    $set: {
                        claimed_customer_id: customerId,
                        claimed_at: claimedAt,
                    },
                },
                { session }
            );
            const washHistoryUpdate = await WashHistory.updateMany(
                {
                    booking_id: { $in: bookingIds },
                    customer_id: null,
                },
                {
                    $set: {
                        customer_id: customerId,
                    },
                },
                { session }
            );
            const promotionUsageUpdate = await PromotionUsage.updateMany(
                {
                    booking_id: { $in: bookingIds },
                    customer_id: null,
                },
                {
                    $set: {
                        customer_id: customerId,
                    },
                },
                { session }
            );

            for (const booking of bookings) {
                await notificationService.createInAppNotification({
                    userId: customerId,
                    type: NOTIFICATION_TYPES.REVIEW_REQUEST,
                    title: 'Share your experience',
                    message: 'Your claimed walk-in booking can now be reviewed.',
                    relatedType: NOTIFICATION_RELATED_TYPES.BOOKING,
                    relatedId: booking._id,
                    metadata: {
                        booking_id: booking._id.toString(),
                        garage_id: booking.garage_id?.toString?.() || null,
                        service_package_id:
                            booking.service_package_id?.toString?.() || null,
                    },
                    session,
                });
            }

            result = {
                claimed_bookings: bookingUpdate.modifiedCount || 0,
                claimed_wash_histories: washHistoryUpdate.modifiedCount || 0,
                linked_promotion_usages: promotionUsageUpdate.modifiedCount || 0,
            };
        });
    } finally {
        await session.endSession();
    }

    return result;
};

module.exports = {
    claimWalkInHistoryForCustomer,
};
