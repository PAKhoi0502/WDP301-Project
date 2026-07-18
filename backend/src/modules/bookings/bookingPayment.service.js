const bookingRewardService = require('./bookingReward.service');
const customerVoucherService = require('../customer-vouchers/customerVoucher.service');
const {
    BOOKING_STATUS,
    BOOKING_PAYMENT_STATUS,
    BOOKING_PAYMENT_METHOD_VALUES,
} = require('../../shared/constants/booking.constant');
const { AppError } = require('../../shared/utils/appError');

const buildPaidBookingResult = (rewardResult) => {
    return {
        wash_history: rewardResult.wash_history,
        loyalty: rewardResult.loyalty,
        point_transaction: rewardResult.point_transaction,
        promotion_usage: rewardResult.promotion_usage,
        notifications: rewardResult.notifications,
        already_processed: rewardResult.already_processed,
    };
};

const confirmBookingPaid = async ({
    booking,
    paymentMethod,
    actorId,
    paidAt = new Date(),
    session = null,
} = {}) => {
    if (!booking) {
        throw new AppError('Booking is required', 400, 'BOOKING_REQUIRED');
    }

    if (booking.status !== BOOKING_STATUS.COMPLETED) {
        throw new AppError(
            'Only completed booking can be marked as paid',
            400,
            'BOOKING_PAYMENT_NOT_ALLOWED'
        );
    }

    if (!BOOKING_PAYMENT_METHOD_VALUES.includes(paymentMethod)) {
        throw new AppError('Payment method is required', 400, 'PAYMENT_METHOD_REQUIRED');
    }

    if (booking.payment_status !== BOOKING_PAYMENT_STATUS.PAID) {
        booking.payment_status = BOOKING_PAYMENT_STATUS.PAID;
        booking.payment_method = paymentMethod;
        booking.paid_at = paidAt;
    }

    if (!booking.paid_at) {
        booking.paid_at = paidAt;
    }

    await booking.save(session ? { session } : undefined);
    if (booking.customer_voucher_id) {
        await customerVoucherService.consumeVoucherForBooking({
            bookingId: booking._id,
            session,
        });
    }

    const rewardResult = await bookingRewardService.processCompletedPaidBooking({
        booking,
        actorId,
        session,
    });

    return buildPaidBookingResult(rewardResult);
};

module.exports = {
    confirmBookingPaid,
};
