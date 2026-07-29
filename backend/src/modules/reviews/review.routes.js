const express = require('express');

const reviewController = require('./review.controller');
const {
    idParamSchema,
    garageReviewListSchema,
    garageReviewSummarySchema,
    servicePackageReviewListSchema,
    servicePackageReviewSummarySchema,
    reviewEligibilitySchema,
    createReviewSchema,
    createGarageReviewSchema,
    updateReviewSchema,
    getMyReviewsSchema,
    reviewByBookingSchema,
    staffReviewListSchema,
    replyReviewSchema,
    adminReviewListSchema,
    moderateReviewSchema,
    reviewAnalyticsSchema,
} = require('./review.validator');
const { validate } = require('../../shared/middlewares/validate.middleware');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');
const {
    requireStaffCapabilities,
} = require('../../shared/middlewares/staffCapability.middleware');
const { USER_ROLES } = require('../../shared/constants/roles.constant');
const { STAFF_CAPABILITIES } = require('../../shared/constants/staff.constant');

const publicGarageRouter = express.Router();
const publicServicePackageRouter = express.Router();
const customerRouter = express.Router();
const staffRouter = express.Router();
const adminRouter = express.Router();

publicGarageRouter.get(
    '/:garageId/reviews',
    validate(garageReviewListSchema),
    reviewController.getGarageReviews
);
publicGarageRouter.post(
    '/:garageId/reviews',
    authenticate,
    authorize(USER_ROLES.CUSTOMER),
    validate(createGarageReviewSchema),
    reviewController.createGarageReview
);
publicGarageRouter.get(
    '/:garageId/review-summary',
    validate(garageReviewSummarySchema),
    reviewController.getGarageReviewSummary
);

publicServicePackageRouter.get(
    '/:servicePackageId/reviews',
    validate(servicePackageReviewListSchema),
    reviewController.getServicePackageReviews
);
publicServicePackageRouter.get(
    '/:servicePackageId/review-summary',
    validate(servicePackageReviewSummarySchema),
    reviewController.getServicePackageReviewSummary
);

customerRouter.use(authenticate, authorize(USER_ROLES.CUSTOMER));

customerRouter.get(
    '/eligibility',
    validate(reviewEligibilitySchema),
    reviewController.getReviewEligibility
);
customerRouter.get(
    '/mine',
    validate(getMyReviewsSchema),
    reviewController.getMyReviews
);
customerRouter.get(
    '/by-booking/:bookingId',
    validate(reviewByBookingSchema),
    reviewController.getMyReviewByBooking
);
customerRouter.post(
    '/',
    validate(createReviewSchema),
    reviewController.createReview
);
customerRouter.patch(
    '/:id',
    validate(updateReviewSchema),
    reviewController.updateMyReview
);
customerRouter.delete(
    '/:id',
    validate(idParamSchema),
    reviewController.deleteMyReview
);

staffRouter.use(authenticate, authorize(USER_ROLES.STAFF));

staffRouter.get(
    '/',
    requireStaffCapabilities(STAFF_CAPABILITIES.REVIEW_READ_GARAGE),
    validate(staffReviewListSchema),
    reviewController.getStaffReviews
);
staffRouter.get(
    '/:id',
    requireStaffCapabilities(STAFF_CAPABILITIES.REVIEW_READ_GARAGE),
    validate(idParamSchema),
    reviewController.getStaffReviewById
);
staffRouter.put(
    '/:id/reply',
    requireStaffCapabilities(STAFF_CAPABILITIES.REVIEW_REPLY_GARAGE),
    validate(replyReviewSchema),
    reviewController.replyToReview
);
staffRouter.delete(
    '/:id/reply',
    requireStaffCapabilities(STAFF_CAPABILITIES.REVIEW_REPLY_GARAGE),
    validate(idParamSchema),
    reviewController.deleteReviewReply
);

adminRouter.use(authenticate, authorize(USER_ROLES.ADMIN));

adminRouter.get(
    '/analytics',
    validate(reviewAnalyticsSchema),
    reviewController.getReviewAnalytics
);
adminRouter.get(
    '/',
    validate(adminReviewListSchema),
    reviewController.getAdminReviews
);
adminRouter.get(
    '/:id',
    validate(idParamSchema),
    reviewController.getAdminReviewById
);
adminRouter.patch(
    '/:id/moderation',
    validate(moderateReviewSchema),
    reviewController.moderateReview
);

module.exports = {
    publicGarageRouter,
    publicServicePackageRouter,
    customerRouter,
    staffRouter,
    adminRouter,
};
