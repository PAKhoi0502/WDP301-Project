const Notification = require('./notification.model');
const NotificationMapper = require('./notification.mapper');
const emailService = require('../emails/email.service');
const { AppError } = require('../../shared/utils/appError');
const {
    NOTIFICATION_CHANNELS,
    NOTIFICATION_TYPES,
    NOTIFICATION_RELATED_TYPES,
    IN_APP_STATUSES,
    EMAIL_STATUSES,
} = require('../../shared/constants/notification.constant');

const normalizeText = (value) => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value !== 'string') {
        return value;
    }

    const trimmedValue = value.trim();

    return trimmedValue || null;
};

const toErrorMessage = (error) => {
    return normalizeText(error?.message) || 'Email delivery failed';
};

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

const deliverEmailNotificationDocument = async (notification, { html = null, text = null, throwOnFailure = true } = {}) => {
    if (!notification) {
        return null;
    }

    if (!notification.channels?.includes(NOTIFICATION_CHANNELS.EMAIL)) {
        throw new AppError('Notification does not require email delivery', 400, 'NOTIFICATION_EMAIL_NOT_REQUIRED');
    }

    if (notification.email_status === EMAIL_STATUSES.SENT) {
        return NotificationMapper.toNotificationDto(notification);
    }

    try {
        const result = await emailService.sendEmail({
            to: notification.recipient_email,
            subject: notification.title,
            text: text || notification.message,
            html,
        });

        notification.email_status = EMAIL_STATUSES.SENT;
        notification.email_sent_at = new Date();
        notification.email_failed_reason = null;
        notification.metadata = {
            ...(notification.metadata || {}),
            email_message_id: result?.messageId || null,
        };

        await notification.save();

        return NotificationMapper.toNotificationDto(notification);
    } catch (error) {
        notification.email_status = EMAIL_STATUSES.FAILED;
        notification.email_failed_reason = toErrorMessage(error).slice(0, 500);

        await notification.save();

        if (throwOnFailure) {
            throw error;
        }

        return NotificationMapper.toNotificationDto(notification);
    }
};

const createEmailNotification = async ({
    userId = null,
    recipientEmail,
    type,
    title,
    message,
    relatedType,
    relatedId,
    metadata = {},
    html = null,
    text = null,
    session = null,
    sendImmediately = true,
    throwOnFailure = false,
}) => {
    const normalizedRecipientEmail = normalizeText(recipientEmail)?.toLowerCase();

    if (!normalizedRecipientEmail) {
        return null;
    }

    const documents = await Notification.create(
        [
            {
                user_id: userId,
                recipient_email: normalizedRecipientEmail,
                type,
                title,
                message,
                channels: [NOTIFICATION_CHANNELS.EMAIL],
                related_type: relatedType,
                related_id: relatedId,
                email_status: EMAIL_STATUSES.PENDING,
                metadata,
            },
        ],
        session ? { session } : undefined
    );
    const notification = documents[0];

    if (sendImmediately && !session) {
        return deliverEmailNotificationDocument(notification, {
            html,
            text,
            throwOnFailure,
        });
    }

    return NotificationMapper.toNotificationDto(notification);
};

const sendPendingEmailNotifications = async ({ limit = 50 } = {}) => {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 100));
    const notifications = await Notification.find({
        channels: NOTIFICATION_CHANNELS.EMAIL,
        email_status: EMAIL_STATUSES.PENDING,
    })
        .sort({ created_at: 1 })
        .limit(safeLimit);
    const results = [];

    for (const notification of notifications) {
        const result = await deliverEmailNotificationDocument(notification, {
            throwOnFailure: false,
        });

        results.push(result);
    }

    return {
        attempted: results.length,
        sent: results.filter((item) => item.email_status === EMAIL_STATUSES.SENT).length,
        failed: results.filter((item) => item.email_status === EMAIL_STATUSES.FAILED).length,
        data: results,
    };
};

const buildCustomerFilter = (userId, { type, related_type, in_app_status } = {}) => {
    const filter = {
        user_id: userId,
        channels: NOTIFICATION_CHANNELS.IN_APP,
    };

    if (type) {
        filter.type = type;
    }

    if (related_type) {
        filter.related_type = related_type;
    }

    if (in_app_status) {
        filter.in_app_status = in_app_status;
    }

    return filter;
};

const getMyNotifications = async (userId, { page = 1, limit = 20, type, related_type, in_app_status } = {}) => {
    const filter = buildCustomerFilter(userId, { type, related_type, in_app_status });
    const unreadFilter = buildCustomerFilter(userId, { in_app_status: IN_APP_STATUSES.UNREAD });
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
        Notification.find(filter)
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit),
        Notification.countDocuments(filter),
        Notification.countDocuments(unreadFilter),
    ]);

    return {
        data: NotificationMapper.toNotificationDtoList(notifications),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
            unread_count: unreadCount,
        },
    };
};

const getUnreadCount = async (userId) => {
    const count = await Notification.countDocuments(
        buildCustomerFilter(userId, { in_app_status: IN_APP_STATUSES.UNREAD })
    );

    return {
        unread_count: count,
    };
};

const getCustomerNotificationDocument = async (userId, notificationId) => {
    const notification = await Notification.findOne({
        _id: notificationId,
        user_id: userId,
        channels: NOTIFICATION_CHANNELS.IN_APP,
    });

    if (!notification) {
        throw new AppError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
    }

    return notification;
};

const markAsRead = async (userId, notificationId) => {
    const notification = await getCustomerNotificationDocument(userId, notificationId);

    if (notification.in_app_status === IN_APP_STATUSES.READ) {
        return NotificationMapper.toNotificationDto(notification);
    }

    notification.in_app_status = IN_APP_STATUSES.READ;
    notification.read_at = new Date();

    await notification.save();

    return NotificationMapper.toNotificationDto(notification);
};

const markAllAsRead = async (userId) => {
    const now = new Date();
    const result = await Notification.updateMany(
        buildCustomerFilter(userId, { in_app_status: IN_APP_STATUSES.UNREAD }),
        {
            $set: {
                in_app_status: IN_APP_STATUSES.READ,
                read_at: now,
            },
        }
    );

    return {
        modified_count: result.modifiedCount || 0,
    };
};

const deleteNotification = async (userId, notificationId) => {
    const notification = await getCustomerNotificationDocument(userId, notificationId);

    await Notification.deleteOne({ _id: notification._id });

    return NotificationMapper.toNotificationDto(notification);
};

const deleteAllNotifications = async (userId) => {
    const result = await Notification.deleteMany({
        user_id: userId,
        channels: NOTIFICATION_CHANNELS.IN_APP,
    });

    return {
        deleted_count: result.deletedCount || 0,
    };
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
    createEmailNotification,
    sendPendingEmailNotifications,
    deliverEmailNotificationDocument,
    getMyNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    emitPaymentConfirmed,
    emitRewardEarned,
};
