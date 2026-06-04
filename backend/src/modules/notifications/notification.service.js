const Notification = require('./notification.model');
const NotificationMapper = require('./notification.mapper');
const {
    NOTIFICATION_CHANNELS,
    NOTIFICATION_TYPES,
    NOTIFICATION_RELATED_TYPES,
    EMAIL_STATUSES,
} = require('../../shared/constants/notification.constant');

const createInAppNotification = async ({ userId, type, title, message, relatedType, relatedId, metadata = {}, session = null }) => {
    if (!userId) {
        return null;
    }

    const documents = await Notification.create(
        [
            {
                user_id: userId,
                recipient_email: null,
                type,
                title,
                message,
                channels: [NOTIFICATION_CHANNELS.IN_APP],
                related_type: relatedType,
                related_id: relatedId,
                email_status: EMAIL_STATUSES.NOT_REQUIRED,
                metadata,
            },
        ],
        session ? { session } : undefined
    );

    return NotificationMapper.toNotificationDto(documents[0]);
};

const emitPaymentConfirmed = async ({ booking, session = null }) => {
    return createInAppNotification({
        userId: booking.customer_id,
        type: NOTIFICATION_TYPES.PAYMENT_CONFIRMED,
        title: 'Payment confirmed',
        message: 'Your cash payment has been confirmed at the garage.',
        relatedType: NOTIFICATION_RELATED_TYPES.BOOKING,
        relatedId: booking._id,
        metadata: {
            booking_id: booking._id.toString(),
            final_price: booking.final_price,
            paid_at: booking.paid_at,
        },
        session,
    });
};

const emitRewardEarned = async ({ booking, earnedPoints, session = null }) => {
    if (!earnedPoints || earnedPoints <= 0) {
        return null;
    }

    return createInAppNotification({
        userId: booking.customer_id,
        type: NOTIFICATION_TYPES.REWARD_EARNED,
        title: 'Reward points earned',
        message: `You earned ${earnedPoints} reward points from your completed booking.`,
        relatedType: NOTIFICATION_RELATED_TYPES.LOYALTY,
        relatedId: booking._id,
        metadata: {
            booking_id: booking._id.toString(),
            earned_points: earnedPoints,
        },
        session,
    });
};

module.exports = {
    createInAppNotification,
    emitPaymentConfirmed,
    emitRewardEarned,
};
