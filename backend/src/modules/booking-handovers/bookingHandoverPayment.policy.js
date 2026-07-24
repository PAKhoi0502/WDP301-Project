const BookingHandover = require('./bookingHandover.model');
const { AppError } = require('../../shared/utils/appError');
const {
    BOOKING_HANDOVER_STATES,
    BOOKING_HANDOVER_RESPONSES,
} = require('../../shared/constants/customerCase.constant');

const assertPaymentCollectionAllowed = async (bookingId, { session = null } = {}) => {
    let query = BookingHandover.findOne({ booking_id: bookingId });

    if (session) {
        query = query.session(session);
    }

    const handover = await query;

    if (!handover) {
        throw new AppError(
            'Booking must be prepared for handover before payment',
            409,
            'HANDOVER_NOT_READY_FOR_PAYMENT'
        );
    }

    if (
        handover.state === BOOKING_HANDOVER_STATES.ON_HOLD
        || handover.customer_response === BOOKING_HANDOVER_RESPONSES.ISSUE_REPORTED
    ) {
        throw new AppError(
            'Payment is on hold while a handover issue is being resolved',
            409,
            'HANDOVER_PAYMENT_ON_HOLD'
        );
    }

    if (
        handover.state !== BOOKING_HANDOVER_STATES.READY_FOR_CUSTOMER
        || handover.customer_response !== BOOKING_HANDOVER_RESPONSES.ACCEPTED
    ) {
        throw new AppError(
            'Customer must accept the vehicle condition before payment',
            409,
            'HANDOVER_CUSTOMER_ACCEPTANCE_REQUIRED'
        );
    }

    return handover;
};

module.exports = {
    assertPaymentCollectionAllowed,
};
