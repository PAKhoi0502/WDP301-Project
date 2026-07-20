const mongoose = require('mongoose');

const createQueryMock = (value) => {
    const query = {
        sort: jest.fn(() => query),
        skip: jest.fn(() => query),
        limit: jest.fn(() => query),
        then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
        catch: (reject) => Promise.resolve(value).catch(reject),
    };

    return query;
};

jest.mock('./notification.model', () => ({
    create: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateMany: jest.fn(),
    deleteOne: jest.fn(),
    deleteMany: jest.fn(),
}));

jest.mock('../emails/email.service', () => ({
    sendEmail: jest.fn(),
}));

const Notification = require('./notification.model');
const emailService = require('../emails/email.service');
const notificationService = require('./notification.service');
const {
    NOTIFICATION_CHANNELS,
    NOTIFICATION_TYPES,
    NOTIFICATION_RELATED_TYPES,
    IN_APP_STATUSES,
    EMAIL_STATUSES,
} = require('../../shared/constants/notification.constant');

describe('notification service customer operations', () => {
    const userId = new mongoose.Types.ObjectId();
    const notificationId = new mongoose.Types.ObjectId();
    const bookingId = new mongoose.Types.ObjectId();

    beforeEach(() => {
        jest.clearAllMocks();
        emailService.sendEmail.mockResolvedValue({ messageId: 'message-1' });
    });

    it('lists customer notifications with unread count metadata', async () => {
        Notification.find.mockReturnValue(createQueryMock([
            {
                _id: notificationId,
                user_id: userId,
                recipient_email: null,
                type: NOTIFICATION_TYPES.PAYMENT_CONFIRMED,
                title: 'Payment confirmed',
                message: 'Your cash payment has been confirmed at the garage.',
                channels: [NOTIFICATION_CHANNELS.IN_APP],
                related_type: NOTIFICATION_RELATED_TYPES.BOOKING,
                related_id: bookingId,
                in_app_status: IN_APP_STATUSES.UNREAD,
                read_at: null,
                email_status: EMAIL_STATUSES.NOT_REQUIRED,
                metadata: { final_price: 150000 },
            },
        ]));
        Notification.countDocuments
            .mockResolvedValueOnce(1)
            .mockResolvedValueOnce(1);

        const result = await notificationService.getMyNotifications(userId, {
            page: 1,
            limit: 10,
            type: NOTIFICATION_TYPES.PAYMENT_CONFIRMED,
            related_type: NOTIFICATION_RELATED_TYPES.BOOKING,
            in_app_status: IN_APP_STATUSES.UNREAD,
        });

        expect(Notification.find).toHaveBeenCalledWith({
            user_id: userId,
            channels: NOTIFICATION_CHANNELS.IN_APP,
            type: NOTIFICATION_TYPES.PAYMENT_CONFIRMED,
            related_type: NOTIFICATION_RELATED_TYPES.BOOKING,
            in_app_status: IN_APP_STATUSES.UNREAD,
        });
        expect(result.meta).toMatchObject({
            page: 1,
            limit: 10,
            total: 1,
            total_pages: 1,
            unread_count: 1,
        });
        expect(result.data[0]).toMatchObject({
            id: notificationId.toString(),
            user_id: userId.toString(),
            type: NOTIFICATION_TYPES.PAYMENT_CONFIRMED,
            metadata: { final_price: 150000 },
        });
    });

    it('upserts a payment ready notification for a registered booking', async () => {
        const completedAt = new Date('2026-07-21T08:00:00.000Z');

        Notification.findOneAndUpdate.mockResolvedValue({
            _id: notificationId,
            user_id: userId,
            type: NOTIFICATION_TYPES.PAYMENT_READY,
            title: 'Payment ready',
            message: 'Your service is complete. You can now pay by PayOS or at the garage counter.',
            channels: [NOTIFICATION_CHANNELS.IN_APP],
            related_type: NOTIFICATION_RELATED_TYPES.BOOKING,
            related_id: bookingId,
            in_app_status: IN_APP_STATUSES.UNREAD,
            read_at: null,
            email_status: EMAIL_STATUSES.NOT_REQUIRED,
            metadata: {
                booking_id: bookingId.toString(),
                final_price: 150000,
                completed_at: completedAt,
            },
        });

        const result = await notificationService.emitPaymentReady({
            booking: {
                _id: bookingId,
                customer_id: userId,
                is_walk_in: false,
                final_price: 150000,
                completed_at: completedAt,
            },
        });

        expect(Notification.findOneAndUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                user_id: userId,
                type: NOTIFICATION_TYPES.PAYMENT_READY,
                related_id: bookingId,
            }),
            expect.objectContaining({
                $set: expect.objectContaining({
                    in_app_status: IN_APP_STATUSES.UNREAD,
                }),
            }),
            expect.objectContaining({
                upsert: true,
                new: true,
            })
        );
        expect(result.type).toBe(NOTIFICATION_TYPES.PAYMENT_READY);
    });

    it('marks all unread notifications as read for current customer', async () => {
        Notification.updateMany.mockResolvedValue({ modifiedCount: 3 });

        const result = await notificationService.markAllAsRead(userId);

        expect(Notification.updateMany).toHaveBeenCalledWith(
            {
                user_id: userId,
                channels: NOTIFICATION_CHANNELS.IN_APP,
                in_app_status: IN_APP_STATUSES.UNREAD,
            },
            {
                $set: {
                    in_app_status: IN_APP_STATUSES.READ,
                    read_at: expect.any(Date),
                },
            }
        );
        expect(result).toEqual({ modified_count: 3 });
    });

    it('deletes only current customer notification', async () => {
        const notification = {
            _id: notificationId,
            user_id: userId,
            type: NOTIFICATION_TYPES.REWARD_EARNED,
            title: 'Reward points earned',
            message: 'You earned points',
            channels: [NOTIFICATION_CHANNELS.IN_APP],
            related_type: NOTIFICATION_RELATED_TYPES.LOYALTY,
            related_id: bookingId,
            in_app_status: IN_APP_STATUSES.READ,
            email_status: EMAIL_STATUSES.NOT_REQUIRED,
            metadata: { earned_points: 20 },
        };

        Notification.findOne.mockResolvedValue(notification);
        Notification.deleteOne.mockResolvedValue({ deletedCount: 1 });

        const result = await notificationService.deleteNotification(userId, notificationId);

        expect(Notification.findOne).toHaveBeenCalledWith({
            _id: notificationId,
            user_id: userId,
            channels: NOTIFICATION_CHANNELS.IN_APP,
        });
        expect(Notification.deleteOne).toHaveBeenCalledWith({ _id: notificationId });
        expect(result).toMatchObject({
            id: notificationId.toString(),
            user_id: userId.toString(),
            metadata: { earned_points: 20 },
        });
    });

    it('throws when customer tries to read missing notification', async () => {
        Notification.findOne.mockResolvedValue(null);

        await expect(
            notificationService.markAsRead(userId, notificationId)
        ).rejects.toMatchObject({
            statusCode: 404,
            errorCode: 'NOTIFICATION_NOT_FOUND',
        });
    });

    it('creates and sends email notification', async () => {
        const save = jest.fn();
        const notification = {
            _id: notificationId,
            user_id: userId,
            recipient_email: 'customer@example.com',
            type: NOTIFICATION_TYPES.AUTH_PASSWORD_RESET_REQUESTED,
            title: 'Reset your AutoWash Pro password',
            message: 'Use this reset token.',
            channels: [NOTIFICATION_CHANNELS.EMAIL],
            related_type: NOTIFICATION_RELATED_TYPES.AUTH,
            related_id: userId,
            in_app_status: IN_APP_STATUSES.UNREAD,
            email_status: EMAIL_STATUSES.PENDING,
            metadata: {},
            save,
        };

        Notification.create.mockResolvedValue([notification]);

        const result = await notificationService.createEmailNotification({
            userId,
            recipientEmail: ' Customer@Example.com ',
            type: NOTIFICATION_TYPES.AUTH_PASSWORD_RESET_REQUESTED,
            title: 'Reset your AutoWash Pro password',
            message: 'Use this reset token.',
            relatedType: NOTIFICATION_RELATED_TYPES.AUTH,
            relatedId: userId,
            html: '<p>Use this reset token.</p>',
        });

        expect(Notification.create).toHaveBeenCalledWith(
            [
                expect.objectContaining({
                    user_id: userId,
                    recipient_email: 'customer@example.com',
                    channels: [NOTIFICATION_CHANNELS.EMAIL],
                    email_status: EMAIL_STATUSES.PENDING,
                }),
            ],
            undefined
        );
        expect(emailService.sendEmail).toHaveBeenCalledWith({
            to: 'customer@example.com',
            subject: 'Reset your AutoWash Pro password',
            text: 'Use this reset token.',
            html: '<p>Use this reset token.</p>',
        });
        expect(save).toHaveBeenCalledTimes(1);
        expect(result).toMatchObject({
            id: notificationId.toString(),
            email_status: EMAIL_STATUSES.SENT,
            metadata: { email_message_id: 'message-1' },
        });
    });

    it('marks email notification failed when delivery fails without throwing', async () => {
        const save = jest.fn();
        const notification = {
            _id: notificationId,
            user_id: userId,
            recipient_email: 'customer@example.com',
            type: NOTIFICATION_TYPES.AUTH_PASSWORD_RESET_REQUESTED,
            title: 'Reset your AutoWash Pro password',
            message: 'Use this reset token.',
            channels: [NOTIFICATION_CHANNELS.EMAIL],
            related_type: NOTIFICATION_RELATED_TYPES.AUTH,
            related_id: userId,
            in_app_status: IN_APP_STATUSES.UNREAD,
            email_status: EMAIL_STATUSES.PENDING,
            metadata: {},
            save,
        };

        Notification.create.mockResolvedValue([notification]);
        emailService.sendEmail.mockRejectedValue(new Error('SMTP unavailable'));

        const result = await notificationService.createEmailNotification({
            userId,
            recipientEmail: 'customer@example.com',
            type: NOTIFICATION_TYPES.AUTH_PASSWORD_RESET_REQUESTED,
            title: 'Reset your AutoWash Pro password',
            message: 'Use this reset token.',
            relatedType: NOTIFICATION_RELATED_TYPES.AUTH,
            relatedId: userId,
        });

        expect(save).toHaveBeenCalledTimes(1);
        expect(result).toMatchObject({
            email_status: EMAIL_STATUSES.FAILED,
            email_failed_reason: 'SMTP unavailable',
        });
    });

    it('sends pending email notifications in batches', async () => {
        const sentNotification = {
            _id: notificationId,
            user_id: userId,
            recipient_email: 'customer@example.com',
            type: NOTIFICATION_TYPES.AUTH_PASSWORD_RESET_REQUESTED,
            title: 'Reset your AutoWash Pro password',
            message: 'Use this reset token.',
            channels: [NOTIFICATION_CHANNELS.EMAIL],
            related_type: NOTIFICATION_RELATED_TYPES.AUTH,
            related_id: userId,
            in_app_status: IN_APP_STATUSES.UNREAD,
            email_status: EMAIL_STATUSES.PENDING,
            metadata: {},
            save: jest.fn(),
        };

        Notification.find.mockReturnValue(createQueryMock([sentNotification]));

        const result = await notificationService.sendPendingEmailNotifications({ limit: 10 });

        expect(Notification.find).toHaveBeenCalledWith({
            channels: NOTIFICATION_CHANNELS.EMAIL,
            email_status: EMAIL_STATUSES.PENDING,
        });
        expect(result).toMatchObject({
            attempted: 1,
            sent: 1,
            failed: 0,
        });
    });

    it('retries failed email notifications in batches', async () => {
        const failedNotification = {
            _id: notificationId,
            user_id: userId,
            recipient_email: 'customer@example.com',
            type: NOTIFICATION_TYPES.AUTH_PASSWORD_RESET_REQUESTED,
            title: 'Reset your AutoWash Pro password',
            message: 'Use this reset token.',
            channels: [NOTIFICATION_CHANNELS.EMAIL],
            related_type: NOTIFICATION_RELATED_TYPES.AUTH,
            related_id: userId,
            in_app_status: IN_APP_STATUSES.UNREAD,
            email_status: EMAIL_STATUSES.FAILED,
            email_failed_reason: 'SMTP unavailable',
            metadata: {},
            save: jest.fn(),
        };

        Notification.find.mockReturnValue(createQueryMock([failedNotification]));

        const result = await notificationService.retryEmailNotifications({ limit: 10 });

        expect(Notification.find).toHaveBeenCalledWith({
            channels: NOTIFICATION_CHANNELS.EMAIL,
            email_status: {
                $in: [EMAIL_STATUSES.PENDING, EMAIL_STATUSES.FAILED],
            },
        });
        expect(result).toMatchObject({
            attempted: 1,
            sent: 1,
            failed: 0,
        });
    });
});
