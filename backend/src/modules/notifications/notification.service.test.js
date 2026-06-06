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
    updateMany: jest.fn(),
    deleteOne: jest.fn(),
    deleteMany: jest.fn(),
}));

const Notification = require('./notification.model');
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
});
