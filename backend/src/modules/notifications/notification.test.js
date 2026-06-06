const mongoose = require('mongoose');

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
const NotificationService = require('./notification.service');
const NotificationMapper = require('./notification.mapper');
const {
    idParamSchema,
    getNotificationsSchema,
    emptySchema,
} = require('./notification.validator');
const {
    NOTIFICATION_CHANNELS,
    NOTIFICATION_TYPES,
    NOTIFICATION_RELATED_TYPES,
    IN_APP_STATUSES,
    EMAIL_STATUSES,
} = require('../../shared/constants/notification.constant');

describe('notification module', () => {
    const userId = new mongoose.Types.ObjectId();
    const notificationId = new mongoose.Types.ObjectId();
    const bookingId = new mongoose.Types.ObjectId();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('validates notification filters and ids', () => {
        const queryResult = getNotificationsSchema.safeParse({
            query: {
                page: '2',
                limit: '10',
                type: NOTIFICATION_TYPES.PAYMENT_CONFIRMED,
                related_type: NOTIFICATION_RELATED_TYPES.BOOKING,
                in_app_status: IN_APP_STATUSES.UNREAD,
            },
        });
        const idResult = idParamSchema.safeParse({
            params: {
                id: notificationId.toString(),
            },
        });
        const emptyResult = emptySchema.safeParse({
            query: {},
        });

        expect(queryResult.success).toBe(true);
        expect(queryResult.data.query).toMatchObject({
            page: 2,
            limit: 10,
        });
        expect(idResult.success).toBe(true);
        expect(emptyResult.success).toBe(true);
    });

    it('creates in-app notifications with expected payload', async () => {
        Notification.create.mockResolvedValue([
            {
                _id: notificationId,
                user_id: userId,
                recipient_email: null,
                type: NOTIFICATION_TYPES.PAYMENT_CONFIRMED,
                title: 'Payment confirmed',
                message: 'Paid',
                channels: [NOTIFICATION_CHANNELS.IN_APP],
                related_type: NOTIFICATION_RELATED_TYPES.BOOKING,
                related_id: bookingId,
                in_app_status: IN_APP_STATUSES.UNREAD,
                email_status: EMAIL_STATUSES.NOT_REQUIRED,
                metadata: { final_price: 100000 },
            },
        ]);

        const result = await NotificationService.createInAppNotification({
            userId,
            type: NOTIFICATION_TYPES.PAYMENT_CONFIRMED,
            title: 'Payment confirmed',
            message: 'Paid',
            relatedType: NOTIFICATION_RELATED_TYPES.BOOKING,
            relatedId: bookingId,
            metadata: { final_price: 100000 },
        });

        expect(Notification.create).toHaveBeenCalledWith(
            [
                expect.objectContaining({
                    user_id: userId,
                    recipient_email: null,
                    type: NOTIFICATION_TYPES.PAYMENT_CONFIRMED,
                    channels: [NOTIFICATION_CHANNELS.IN_APP],
                    related_type: NOTIFICATION_RELATED_TYPES.BOOKING,
                    related_id: bookingId,
                    email_status: EMAIL_STATUSES.NOT_REQUIRED,
                }),
            ],
            undefined
        );
        expect(result).toMatchObject({
            id: notificationId.toString(),
            user_id: userId.toString(),
            related_id: bookingId.toString(),
            metadata: { final_price: 100000 },
        });
    });

    it('returns null when creating notification without user id', async () => {
        const result = await NotificationService.createInAppNotification({
            userId: null,
            type: NOTIFICATION_TYPES.PAYMENT_CONFIRMED,
            title: 'Payment confirmed',
            message: 'Paid',
            relatedType: NOTIFICATION_RELATED_TYPES.BOOKING,
            relatedId: bookingId,
        });

        expect(result).toBeNull();
        expect(Notification.create).not.toHaveBeenCalled();
    });

    it('marks unread notification as read', async () => {
        const save = jest.fn();
        Notification.findOne.mockResolvedValue({
            _id: notificationId,
            user_id: userId,
            type: NOTIFICATION_TYPES.REWARD_EARNED,
            title: 'Reward points earned',
            message: 'You earned points',
            channels: [NOTIFICATION_CHANNELS.IN_APP],
            related_type: NOTIFICATION_RELATED_TYPES.LOYALTY,
            related_id: bookingId,
            in_app_status: IN_APP_STATUSES.UNREAD,
            email_status: EMAIL_STATUSES.NOT_REQUIRED,
            metadata: {},
            save,
        });

        const result = await NotificationService.markAsRead(userId, notificationId);

        expect(Notification.findOne).toHaveBeenCalledWith({
            _id: notificationId,
            user_id: userId,
            channels: NOTIFICATION_CHANNELS.IN_APP,
        });
        expect(save).toHaveBeenCalledTimes(1);
        expect(result).toMatchObject({
            id: notificationId.toString(),
            in_app_status: IN_APP_STATUSES.READ,
        });
        expect(result.read_at).toBeInstanceOf(Date);
    });

    it('maps notification documents safely', () => {
        const dto = NotificationMapper.toNotificationDto({
            _id: notificationId,
            user_id: userId,
            recipient_email: null,
            type: NOTIFICATION_TYPES.REWARD_EARNED,
            title: 'Reward points earned',
            message: 'You earned points',
            channels: [NOTIFICATION_CHANNELS.IN_APP],
            related_type: NOTIFICATION_RELATED_TYPES.LOYALTY,
            related_id: bookingId,
            in_app_status: IN_APP_STATUSES.UNREAD,
            read_at: null,
            email_status: EMAIL_STATUSES.NOT_REQUIRED,
            metadata: { earned_points: 10 },
        });

        expect(dto).toMatchObject({
            id: notificationId.toString(),
            user_id: userId.toString(),
            channels: [NOTIFICATION_CHANNELS.IN_APP],
            metadata: { earned_points: 10 },
        });
    });
});
