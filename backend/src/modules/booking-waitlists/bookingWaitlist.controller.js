const bookingWaitlistService = require('./bookingWaitlist.service');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../../shared/utils/apiResponse');

const createMyWaitlist = asyncHandler(async (req, res) => {
    const { body } = req.validated;

    const result = await bookingWaitlistService.createMyWaitlist(req.user._id, body);

    return sendCreated(res, {
        message: 'Join waitlist successfully',
        data: result,
    });
});

const getMyWaitlists = asyncHandler(async (req, res) => {
    const { query } = req.validated;

    const result = await bookingWaitlistService.getMyWaitlists(req.user._id, query);

    return sendSuccess(res, {
        message: 'Get waitlists successfully',
        data: result.data,
        meta: result.meta,
    });
});

const getMyWaitlistById = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await bookingWaitlistService.getMyWaitlistById(req.user._id, id);

    return sendSuccess(res, {
        message: 'Get waitlist successfully',
        data: result,
    });
});

const cancelMyWaitlist = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { body } = req.validated;

    const result = await bookingWaitlistService.cancelMyWaitlist(req.user._id, id, body || {});

    return sendSuccess(res, {
        message: 'Cancel waitlist successfully',
        data: result,
    });
});

const acceptMyWaitlist = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await bookingWaitlistService.acceptMyWaitlist(req.user._id, id);

    return sendCreated(res, {
        message: 'Accept waitlist offer successfully',
        data: result,
    });
});

const getAllWaitlists = asyncHandler(async (req, res) => {
    const { query } = req.validated;

    const result = await bookingWaitlistService.getAllWaitlists(req.user, query);

    return sendSuccess(res, {
        message: 'Get waitlists successfully',
        data: result.data,
        meta: result.meta,
    });
});

const cancelWaitlist = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { body } = req.validated;

    const result = await bookingWaitlistService.cancelWaitlist(req.user, id, body || {});

    return sendSuccess(res, {
        message: 'Cancel waitlist successfully',
        data: result,
    });
});

const offerWaitlist = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { body } = req.validated;

    const result = await bookingWaitlistService.offerWaitlist(req.user, id, body || {});

    return sendSuccess(res, {
        message: 'Offer waitlist successfully',
        data: result,
    });
});

const expireWaitlistOffer = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await bookingWaitlistService.expireWaitlistOffer(req.user, id);

    return sendSuccess(res, {
        message: 'Expire waitlist offer successfully',
        data: result,
    });
});

module.exports = {
    createMyWaitlist,
    getMyWaitlists,
    getMyWaitlistById,
    cancelMyWaitlist,
    acceptMyWaitlist,
    getAllWaitlists,
    cancelWaitlist,
    offerWaitlist,
    expireWaitlistOffer,
};
