const notificationService = require('./notification.service');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess } = require('../../shared/utils/apiResponse');

const getMyNotifications = asyncHandler(async (req, res) => {
    const { query } = req.validated;

    const result = await notificationService.getMyNotifications(req.user._id, query);

    return sendSuccess(res, {
        message: 'Get notifications successfully',
        data: result.data,
        meta: result.meta,
    });
});

const getUnreadCount = asyncHandler(async (req, res) => {
    const result = await notificationService.getUnreadCount(req.user._id);

    return sendSuccess(res, {
        message: 'Get unread notification count successfully',
        data: result,
    });
});

const markAsRead = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await notificationService.markAsRead(req.user._id, id);

    return sendSuccess(res, {
        message: 'Mark notification as read successfully',
        data: result,
    });
});

const markAllAsRead = asyncHandler(async (req, res) => {
    const result = await notificationService.markAllAsRead(req.user._id);

    return sendSuccess(res, {
        message: 'Mark all notifications as read successfully',
        data: result,
    });
});

const deleteNotification = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await notificationService.deleteNotification(req.user._id, id);

    return sendSuccess(res, {
        message: 'Delete notification successfully',
        data: result,
    });
});

const deleteAllNotifications = asyncHandler(async (req, res) => {
    const result = await notificationService.deleteAllNotifications(req.user._id);

    return sendSuccess(res, {
        message: 'Delete all notifications successfully',
        data: result,
    });
});

module.exports = {
    getMyNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
};
