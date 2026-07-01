const express = require('express');

const authController = require('./auth.controller');
const {
    registerSchema,
    requestPhoneVerificationSchema,
    verifyPhoneOtpSchema,
    loginSchema,
    changePasswordSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    acceptStaffInvitationSchema,
} = require('./auth.validator');
const { validate } = require('../../shared/middlewares/validate.middleware');
const {
    authenticate,
    optionalAuthenticate,
} = require('../../shared/middlewares/auth.middleware');

const router = express.Router();

router.post(
    '/phone-verifications/request',
    optionalAuthenticate,
    validate(requestPhoneVerificationSchema),
    authController.requestPhoneVerification
);

router.post(
    '/phone-verifications/verify',
    optionalAuthenticate,
    validate(verifyPhoneOtpSchema),
    authController.verifyPhoneOtp
);

router.post(
    '/register',
    validate(registerSchema),
    authController.register
);

router.post(
    '/login',
    validate(loginSchema),
    authController.login
);

router.post(
    '/refresh',
    authController.refresh
);

router.post(
    '/logout',
    authController.logout
);

router.post(
    '/logout-all',
    authenticate,
    authController.logoutAllDevices
);

router.get(
    '/me',
    authenticate,
    authController.getMe
);

router.post(
    '/change-password',
    authenticate,
    validate(changePasswordSchema),
    authController.changePassword
);

router.post(
    '/forgot-password',
    validate(forgotPasswordSchema),
    authController.forgotPassword
);

router.post(
    '/reset-password',
    validate(resetPasswordSchema),
    authController.resetPassword
);

router.post(
    '/staff-invitations/accept',
    validate(acceptStaffInvitationSchema),
    authController.acceptStaffInvitation
);

module.exports = router;
