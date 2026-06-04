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

const toNotificationDto = (notification) => {
    if (!notification) {
        return null;
    }

    const plainNotification = notification.toObject ? notification.toObject() : notification;

    return {
        id: plainNotification._id?.toString() || plainNotification.id || null,
        user_id: toId(plainNotification.user_id),
        recipient_email: plainNotification.recipient_email,
        type: plainNotification.type,
        title: plainNotification.title,
        message: plainNotification.message,
        channels: plainNotification.channels || [],
        related_type: plainNotification.related_type,
        related_id: toId(plainNotification.related_id),
        in_app_status: plainNotification.in_app_status,
        read_at: plainNotification.read_at,
        email_status: plainNotification.email_status,
        email_sent_at: plainNotification.email_sent_at,
        email_failed_reason: plainNotification.email_failed_reason,
        metadata: plainNotification.metadata || {},
        created_at: plainNotification.created_at,
        updated_at: plainNotification.updated_at,
    };
};

const toNotificationDtoList = (notifications = []) => {
    return notifications.map((notification) => toNotificationDto(notification));
};

module.exports = {
    toNotificationDto,
    toNotificationDtoList,
};
