const express = require('express');

const staffProfileController = require('./staffProfile.controller');
const {
    idParamSchema,
    getStaffProfilesSchema,
    createStaffProfileSchema,
    inviteStaffSchema,
    updateStaffProfileSchema,
    updateStaffProfileStatusSchema,
} = require('./staffProfile.validator');
const { validate } = require('../../shared/middlewares/validate.middleware');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');
const { USER_ROLES } = require('../../shared/constants/roles.constant');

const router = express.Router();

router.get(
    '/me',
    authenticate,
    authorize(USER_ROLES.STAFF),
    staffProfileController.getMyStaffProfile
);

router.get(
    '/',
    authenticate,
    authorize(USER_ROLES.ADMIN),
    validate(getStaffProfilesSchema),
    staffProfileController.getAllStaffProfiles
);

router.post(
    '/',
    authenticate,
    authorize(USER_ROLES.ADMIN),
    validate(createStaffProfileSchema),
    staffProfileController.createStaffProfile
);

router.post(
    '/invitations',
    authenticate,
    authorize(USER_ROLES.ADMIN),
    validate(inviteStaffSchema),
    staffProfileController.inviteStaff
);

router.post(
    '/:id/invitations/resend',
    authenticate,
    authorize(USER_ROLES.ADMIN),
    validate(idParamSchema),
    staffProfileController.resendStaffInvitation
);

router.get(
    '/:id',
    authenticate,
    authorize(USER_ROLES.ADMIN),
    validate(idParamSchema),
    staffProfileController.getStaffProfileById
);

router.patch(
    '/:id/status',
    authenticate,
    authorize(USER_ROLES.ADMIN),
    validate(updateStaffProfileStatusSchema),
    staffProfileController.updateStaffProfileStatus
);

router.patch(
    '/:id',
    authenticate,
    authorize(USER_ROLES.ADMIN),
    validate(updateStaffProfileSchema),
    staffProfileController.updateStaffProfile
);

router.delete(
    '/:id',
    authenticate,
    authorize(USER_ROLES.ADMIN),
    validate(idParamSchema),
    staffProfileController.deactivateStaffProfile
);

module.exports = router;
