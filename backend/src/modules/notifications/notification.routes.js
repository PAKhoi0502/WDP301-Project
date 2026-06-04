const express = require('express');

const notificationController = require('./notification.controller');
const {
    idParamSchema,
    getNotificationsSchema,
    emptySchema,
} = require('./notification.validator');
const { validate } = require('../../shared/middlewares/validate.middleware');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');
const { USER_ROLES } = require('../../shared/constants/roles.constant');

const router = express.Router();

router.use(authenticate, authorize(USER_ROLES.CUSTOMER));

router.get(
    '/',
    validate(getNotificationsSchema),
    notificationController.getMyNotifications
);

router.get(
    '/unread-count',
    validate(emptySchema),
    notificationController.getUnreadCount
);

router.patch(
    '/mark-all-read',
    validate(emptySchema),
    notificationController.markAllAsRead
);

router.patch(
    '/:id/read',
    validate(idParamSchema),
    notificationController.markAsRead
);

router.delete(
    '/',
    validate(emptySchema),
    notificationController.deleteAllNotifications
);

router.delete(
    '/:id',
    validate(idParamSchema),
    notificationController.deleteNotification
);

module.exports = router;
