const express = require('express');

const bookingWaitlistController = require('./bookingWaitlist.controller');
const {
    idParamSchema,
    createWaitlistSchema,
    getMyWaitlistsSchema,
    getAdminWaitlistsSchema,
    cancelWaitlistSchema,
    offerWaitlistSchema,
} = require('./bookingWaitlist.validator');
const { validate } = require('../../shared/middlewares/validate.middleware');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');
const { USER_ROLES } = require('../../shared/constants/roles.constant');
const { STAFF_CAPABILITIES } = require('../../shared/constants/staff.constant');
const { requireStaffCapabilities } = require('../../shared/middlewares/staffCapability.middleware');

const customerRouter = express.Router();
const adminRouter = express.Router();

customerRouter.use(authenticate, authorize(USER_ROLES.CUSTOMER));

customerRouter.get(
    '/',
    validate(getMyWaitlistsSchema),
    bookingWaitlistController.getMyWaitlists
);

customerRouter.post(
    '/',
    validate(createWaitlistSchema),
    bookingWaitlistController.createMyWaitlist
);

customerRouter.get(
    '/:id',
    validate(idParamSchema),
    bookingWaitlistController.getMyWaitlistById
);

customerRouter.patch(
    '/:id/cancel',
    validate(cancelWaitlistSchema),
    bookingWaitlistController.cancelMyWaitlist
);

customerRouter.patch(
    '/:id/accept',
    validate(idParamSchema),
    bookingWaitlistController.acceptMyWaitlist
);

adminRouter.use(authenticate, authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN));
adminRouter.use(requireStaffCapabilities(STAFF_CAPABILITIES.WAITLIST_MANAGE_GARAGE));

adminRouter.get(
    '/',
    validate(getAdminWaitlistsSchema),
    bookingWaitlistController.getAllWaitlists
);

adminRouter.patch(
    '/:id/offer',
    validate(offerWaitlistSchema),
    bookingWaitlistController.offerWaitlist
);

adminRouter.patch(
    '/:id/expire',
    validate(idParamSchema),
    bookingWaitlistController.expireWaitlistOffer
);

adminRouter.patch(
    '/:id/cancel',
    validate(cancelWaitlistSchema),
    bookingWaitlistController.cancelWaitlist
);

module.exports = {
    customerRouter,
    adminRouter,
};
