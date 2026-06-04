const mongoose = require('mongoose');

const {
    NOTIFICATION_CHANNELS,
    NOTIFICATION_CHANNEL_VALUES,
    NOTIFICATION_TYPE_VALUES,
    NOTIFICATION_RELATED_TYPE_VALUES,
    IN_APP_STATUSES,
    IN_APP_STATUS_VALUES,
    EMAIL_STATUSES,
    EMAIL_STATUS_VALUES,
} = require('../../shared/constants/notification.constant');

const notificationSchema = new mongoose.Schema(
    {
        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

        recipient_email: {
            type: String,
            trim: true,
            lowercase: true,
            maxlength: [120, 'Recipient email must not exceed 120 characters'],
            default: null,
        },

        type: {
            type: String,
            enum: NOTIFICATION_TYPE_VALUES,
            required: [true, 'Notification type is required'],
        },

        title: {
            type: String,
            required: [true, 'Title is required'],
            trim: true,
            maxlength: [150, 'Title must not exceed 150 characters'],
        },

        message: {
            type: String,
            required: [true, 'Message is required'],
            trim: true,
            maxlength: [1000, 'Message must not exceed 1000 characters'],
        },

        channels: {
            type: [String],
            enum: NOTIFICATION_CHANNEL_VALUES,
            default: [NOTIFICATION_CHANNELS.IN_APP],
        },

        related_type: {
            type: String,
            enum: NOTIFICATION_RELATED_TYPE_VALUES,
            required: [true, 'Related type is required'],
        },

        related_id: {
            type: mongoose.Schema.Types.ObjectId,
            required: [true, 'Related id is required'],
        },

        in_app_status: {
            type: String,
            enum: IN_APP_STATUS_VALUES,
            default: IN_APP_STATUSES.UNREAD,
        },

        read_at: {
            type: Date,
            default: null,
        },

        email_status: {
            type: String,
            enum: EMAIL_STATUS_VALUES,
            default: EMAIL_STATUSES.NOT_REQUIRED,
        },

        email_sent_at: {
            type: Date,
            default: null,
        },

        email_failed_reason: {
            type: String,
            trim: true,
            maxlength: [500, 'Email failed reason must not exceed 500 characters'],
            default: null,
        },

        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
        collection: 'notifications',
    }
);

notificationSchema.index({ user_id: 1, created_at: -1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ related_type: 1, related_id: 1 });
notificationSchema.index({ in_app_status: 1 });
notificationSchema.index({ email_status: 1 });
notificationSchema.index({ created_at: -1 });

notificationSchema.pre('validate', function (next) {
    if (!this.channels || this.channels.length === 0) {
        this.channels = [NOTIFICATION_CHANNELS.IN_APP];
    }

    if (!this.channels.includes(NOTIFICATION_CHANNELS.EMAIL)) {
        this.email_status = EMAIL_STATUSES.NOT_REQUIRED;
        this.recipient_email = null;
    }

    next();
});

notificationSchema.methods.toJSON = function () {
    const notification = this.toObject();

    delete notification.__v;

    return notification;
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
