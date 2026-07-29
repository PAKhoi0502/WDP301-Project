const reviewService = require('./review.service');
const { getAuditRequestContext } = require('../audit-logs/auditLog.service');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../../shared/utils/apiResponse');

const getGarageReviews = asyncHandler(async (req, res) => {
    const { garageId } = req.validated.params;
    const result = await reviewService.getGarageReviews(
        garageId,
        req.validated.query
    );

    return sendSuccess(res, {
        message: 'Get garage reviews successfully',
        data: result.data,
        meta: result.meta,
    });
});

const getGarageReviewSummary = asyncHandler(async (req, res) => {
    const { garageId } = req.validated.params;
    const result = await reviewService.getGarageReviewSummary(garageId);

    return sendSuccess(res, {
        message: 'Get garage review summary successfully',
        data: result,
    });
});

const getServicePackageReviews = asyncHandler(async (req, res) => {
    const { servicePackageId } = req.validated.params;
    const result = await reviewService.getServicePackageReviews(
        servicePackageId,
        req.validated.query
    );

    return sendSuccess(res, {
        message: 'Get service package reviews successfully',
        data: result.data,
        meta: result.meta,
    });
});

const getServicePackageReviewSummary = asyncHandler(async (req, res) => {
    const { servicePackageId } = req.validated.params;
    const result = await reviewService.getServicePackageReviewSummary(
        servicePackageId
    );

    return sendSuccess(res, {
        message: 'Get service package review summary successfully',
        data: result,
    });
});

const getReviewEligibility = asyncHandler(async (req, res) => {
    const result = await reviewService.getReviewEligibility(
        req.user._id,
        req.validated.query.booking_id
    );

    return sendSuccess(res, {
        message: 'Get review eligibility successfully',
        data: result,
    });
});

const createReview = asyncHandler(async (req, res) => {
    const result = await reviewService.createReview(
        req.user,
        req.validated.body,
        getAuditRequestContext(req)
    );

    return sendCreated(res, {
        message: 'Create review successfully',
        data: result,
    });
});

const createGarageReview = asyncHandler(async (req, res) => {
    const result = await reviewService.createReview(
        req.user,
        req.validated.body,
        getAuditRequestContext(req),
        req.validated.params.garageId
    );

    return sendCreated(res, {
        message: 'Create garage review successfully',
        data: result,
    });
});

const getMyReviews = asyncHandler(async (req, res) => {
    const result = await reviewService.getMyReviews(
        req.user._id,
        req.validated.query
    );

    return sendSuccess(res, {
        message: 'Get my reviews successfully',
        data: result.data,
        meta: result.meta,
    });
});

const getMyReviewByBooking = asyncHandler(async (req, res) => {
    const result = await reviewService.getMyReviewByBooking(
        req.user._id,
        req.validated.params.bookingId
    );

    return sendSuccess(res, {
        message: 'Get booking review successfully',
        data: result,
    });
});

const updateMyReview = asyncHandler(async (req, res) => {
    const result = await reviewService.updateMyReview(
        req.user,
        req.validated.params.id,
        req.validated.body,
        getAuditRequestContext(req)
    );

    return sendSuccess(res, {
        message: 'Update review successfully',
        data: result,
    });
});

const deleteMyReview = asyncHandler(async (req, res) => {
    const result = await reviewService.deleteMyReview(
        req.user,
        req.validated.params.id,
        getAuditRequestContext(req)
    );

    return sendSuccess(res, {
        message: 'Delete review successfully',
        data: result,
    });
});

const getStaffReviews = asyncHandler(async (req, res) => {
    const result = await reviewService.getStaffReviews(
        req.staffContext,
        req.validated.query
    );

    return sendSuccess(res, {
        message: 'Get garage reviews successfully',
        data: result.data,
        meta: result.meta,
    });
});

const getStaffReviewById = asyncHandler(async (req, res) => {
    const result = await reviewService.getStaffReviewById(
        req.staffContext,
        req.validated.params.id
    );

    return sendSuccess(res, {
        message: 'Get garage review successfully',
        data: result,
    });
});

const replyToReview = asyncHandler(async (req, res) => {
    const result = await reviewService.replyToReview(
        req.user,
        req.staffContext,
        req.validated.params.id,
        req.validated.body.content,
        getAuditRequestContext(req)
    );

    return sendSuccess(res, {
        message: 'Reply to review successfully',
        data: result,
    });
});

const deleteReviewReply = asyncHandler(async (req, res) => {
    const result = await reviewService.deleteReviewReply(
        req.user,
        req.staffContext,
        req.validated.params.id,
        getAuditRequestContext(req)
    );

    return sendSuccess(res, {
        message: 'Delete review reply successfully',
        data: result,
    });
});

const getAdminReviews = asyncHandler(async (req, res) => {
    const result = await reviewService.getAdminReviews(req.validated.query);

    return sendSuccess(res, {
        message: 'Get reviews successfully',
        data: result.data,
        meta: result.meta,
    });
});

const getAdminReviewById = asyncHandler(async (req, res) => {
    const result = await reviewService.getAdminReviewById(
        req.validated.params.id
    );

    return sendSuccess(res, {
        message: 'Get review successfully',
        data: result,
    });
});

const moderateReview = asyncHandler(async (req, res) => {
    const result = await reviewService.moderateReview(
        req.user,
        req.validated.params.id,
        req.validated.body,
        getAuditRequestContext(req)
    );

    return sendSuccess(res, {
        message: 'Moderate review successfully',
        data: result,
    });
});

const getReviewAnalytics = asyncHandler(async (req, res) => {
    const result = await reviewService.getReviewAnalytics(req.validated.query);

    return sendSuccess(res, {
        message: 'Get review analytics successfully',
        data: result,
    });
});

module.exports = {
    getGarageReviews,
    getGarageReviewSummary,
    getServicePackageReviews,
    getServicePackageReviewSummary,
    getReviewEligibility,
    createReview,
    createGarageReview,
    getMyReviews,
    getMyReviewByBooking,
    updateMyReview,
    deleteMyReview,
    getStaffReviews,
    getStaffReviewById,
    replyToReview,
    deleteReviewReply,
    getAdminReviews,
    getAdminReviewById,
    moderateReview,
    getReviewAnalytics,
};
