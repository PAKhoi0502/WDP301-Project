const express = require('express');

const userController = require('./user.controller');
const {
    getUsersSchema,
    idParamSchema,
    updateMeSchema,
    updateUserSchema,
    updateUserStatusSchema,
    updateUserRoleSchema,
} = require('./user.validator');
const { validate } = require('../../shared/middlewares/validate.middleware');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');
const { USER_ROLES } = require('../../shared/constants/roles.constant');

const router = express.Router();

router.get(
    '/me',
    authenticate,
    userController.getMe
);

router.patch(
    '/me',
    authenticate,
    validate(updateMeSchema),
    userController.updateMe
);

router.get(
    '/',
    authenticate,
    authorize(USER_ROLES.ADMIN),
    validate(getUsersSchema),
    userController.getAllUsers
);

router.get(
    '/:id',
    authenticate,
    authorize(USER_ROLES.ADMIN),
    validate(idParamSchema),
    userController.getUserById
);

router.patch(
    '/:id/status',
    authenticate,
    authorize(USER_ROLES.ADMIN),
    validate(updateUserStatusSchema),
    userController.updateUserStatus
);

router.patch(
    '/:id/role',
    authenticate,
    authorize(USER_ROLES.ADMIN),
    validate(updateUserRoleSchema),
    userController.updateUserRole
);

router.patch(
    '/:id',
    authenticate,
    authorize(USER_ROLES.ADMIN),
    validate(updateUserSchema),
    userController.updateUser
);

router.delete(
    '/:id',
    authenticate,
    authorize(USER_ROLES.ADMIN),
    validate(idParamSchema),
    userController.deactivateUser
);

module.exports = router;