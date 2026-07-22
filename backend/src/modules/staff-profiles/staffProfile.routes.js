const express = require('express');

const staffProfileController = require('./staffProfile.controller');
const staffTypeChangeController = require('./staffTypeChange.controller');
const {
    idParamSchema,
    getStaffProfilesSchema,
    createStaffProfileSchema,
    inviteStaffSchema,
    updateStaffProfileSchema,
    updateStaffProfileStatusSchema,
    updateStaffEmploymentStatusSchema,
} = require('./staffProfile.validator');
const {
    createMyStaffTypeChangeRequestSchema,
    getMyStaffTypeChangeRequestsSchema,
    getAdminStaffTypeChangeRequestsSchema,
    getStaffTypeChangeImpactSchema,
    approveStaffTypeChangeRequestSchema,
    rejectStaffTypeChangeRequestSchema,
    cancelStaffTypeChangeRequestSchema,
    getStaffTypeChangeHistorySchema,
} = require('./staffTypeChange.validator');
const { validate } = require('../../shared/middlewares/validate.middleware');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');
const { USER_ROLES } = require('../../shared/constants/roles.constant');
const { attachStaffContext } = require('../../shared/middlewares/staffCapability.middleware');

const router = express.Router();

router.get(
    '/me/capabilities',
    authenticate,
    authorize(USER_ROLES.STAFF),
    attachStaffContext,
    staffProfileController.getMyCapabilities
);

router.post(
    '/me/type-change-requests',
    authenticate,
    authorize(USER_ROLES.STAFF),
    validate(createMyStaffTypeChangeRequestSchema),
    staffTypeChangeController.createMyRequest
);

router.get(
    '/me/type-change-requests',
    authenticate,
    authorize(USER_ROLES.STAFF),
    validate(getMyStaffTypeChangeRequestsSchema),
    staffTypeChangeController.getMyRequests
);

router.get(
    '/type-change-requests',
    authenticate,
    authorize(USER_ROLES.ADMIN),
    validate(getAdminStaffTypeChangeRequestsSchema),
    staffTypeChangeController.getAdminRequests
);

router.patch(
    '/type-change-requests/:requestId/approve',
    authenticate,
    authorize(USER_ROLES.ADMIN),
    validate(approveStaffTypeChangeRequestSchema),
    staffTypeChangeController.approveRequest
);

router.patch(
    '/type-change-requests/:requestId/reject',
    authenticate,
    authorize(USER_ROLES.ADMIN),
    validate(rejectStaffTypeChangeRequestSchema),
    staffTypeChangeController.rejectRequest
);

router.patch(
    '/type-change-requests/:requestId/cancel',
    authenticate,
    authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN),
    validate(cancelStaffTypeChangeRequestSchema),
    staffTypeChangeController.cancelRequest
);

router.get(
    '/:id/type-change-impact',
    authenticate,
    authorize(USER_ROLES.ADMIN),
    validate(getStaffTypeChangeImpactSchema),
    staffTypeChangeController.getImpact
);

router.get(
    '/:id/type-change-history',
    authenticate,
    authorize(USER_ROLES.ADMIN),
    validate(getStaffTypeChangeHistorySchema),
    staffTypeChangeController.getHistory
);

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
    '/:id/employment-status',
    authenticate,
    authorize(USER_ROLES.ADMIN),
    validate(updateStaffEmploymentStatusSchema),
    staffProfileController.updateStaffEmploymentStatus
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
