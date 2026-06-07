const mongoose = require('mongoose');

const Booking = require('../bookings/booking.model');
const BookingMapper = require('../bookings/booking.mapper');
const bookingPaymentService = require('../bookings/bookingPayment.service');
const StaffProfile = require('../staff-profiles/staffProfile.model');
const PaymentTransaction = require('./paymentTransaction.model');
const PaymentMapper = require('./payment.mapper');
const payosService = require('./payos.service');
const { AppError } = require('../../shared/utils/appError');
const { USER_ROLES } = require('../../shared/constants/roles.constant');
const {
    BOOKING_STATUS,
    BOOKING_PAYMENT_METHOD,
    BOOKING_PAYMENT_STATUS,
} = require('../../shared/constants/booking.constant');
const {
    PAYMENT_PROVIDER,
    PAYMENT_METHOD,
    PAYMENT_TRANSACTION_STATUS,
    PAYMENT_CURRENCY,
} = require('../../shared/constants/payment.constant');

const getActiveStaffProfile = async (staffUserId) => {
    const staffProfile = await StaffProfile.findOne({
        user_id: staffUserId,
        is_active: true,
    });

    if (!staffProfile) {
        throw new AppError('Staff profile not found', 404, 'STAFF_PROFILE_NOT_FOUND');
    }

    return staffProfile;
};

const assertStaffCanAccessBooking = async (user, booking) => {
    if (user.role === USER_ROLES.ADMIN) {
        return;
    }

    const staffProfile = await getActiveStaffProfile(user._id);

    if (!staffProfile.garage_id) {
        throw new AppError('Staff is not assigned to any garage', 403, 'STAFF_GARAGE_NOT_ASSIGNED');
    }

    if (staffProfile.garage_id.toString() !== booking.garage_id.toString()) {
        throw new AppError('Staff cannot access bookings outside assigned garage', 403, 'STAFF_GARAGE_ACCESS_DENIED');
    }
};

const assertBookingCanCreatePayosPayment = (booking) => {
    if (booking.status !== BOOKING_STATUS.COMPLETED) {
        throw new AppError('Booking cannot be processed in current status', 400, 'BOOKING_PAYOS_PAYMENT_NOT_ALLOWED');
    }

    if (booking.payment_status === BOOKING_PAYMENT_STATUS.PAID) {
        throw new AppError('Booking is already paid', 409, 'BOOKING_ALREADY_PAID');
    }

    if (!Number.isInteger(booking.final_price) || booking.final_price <= 0) {
        throw new AppError('Booking final price must be greater than 0', 400, 'BOOKING_INVALID_PAYMENT_AMOUNT');
    }
};

const findReusablePendingPayment = async (bookingId, now = new Date()) => {
    const payment = await PaymentTransaction.findOne({
        booking_id: bookingId,
        provider: PAYMENT_PROVIDER.PAYOS,
        status: PAYMENT_TRANSACTION_STATUS.PENDING,
        $or: [
            { expires_at: null },
            { expires_at: { $gt: now } },
        ],
    }).sort({ created_at: -1 });

    return payment;
};

const expireOldPendingPayments = async (bookingId, now = new Date()) => {
    await PaymentTransaction.updateMany(
        {
            booking_id: bookingId,
            provider: PAYMENT_PROVIDER.PAYOS,
            status: PAYMENT_TRANSACTION_STATUS.PENDING,
            expires_at: { $lte: now },
        },
        {
            $set: {
                status: PAYMENT_TRANSACTION_STATUS.EXPIRED,
                expired_at: now,
            },
        }
    );
};

const generateOrderCode = async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const orderCode = Date.now() * 100 + Math.floor(Math.random() * 100);
        const existed = await PaymentTransaction.exists({ order_code: orderCode });

        if (!existed) {
            return orderCode;
        }
    }

    throw new AppError('Cannot generate payment order code', 500, 'PAYMENT_ORDER_CODE_GENERATION_FAILED');
};

const buildPaymentDescription = (orderCode) => {
    return `AWP ${orderCode}`.slice(0, 25);
};

const toExpiresAt = (expiredAt) => {
    if (!expiredAt) {
        return null;
    }

    return new Date(expiredAt * 1000);
};

const parsePayosTransactionTime = (value, fallback = new Date()) => {
    if (!value) {
        return fallback;
    }

    const normalizedValue = typeof value === 'string' && value.includes(' ')
        ? `${value.replace(' ', 'T')}+07:00`
        : value;
    const parsedDate = new Date(normalizedValue);

    if (Number.isNaN(parsedDate.getTime())) {
        return fallback;
    }

    return parsedDate;
};

const buildCreatePaymentResponse = (booking, payment, reused = false) => {
    return {
        booking: BookingMapper.toBookingDto(booking),
        payment: PaymentMapper.toPaymentTransactionDto(payment),
        reused,
    };
};

const buildPaymentDetailResponse = (booking, payment) => {
    return {
        booking: BookingMapper.toBookingDto(booking),
        payment: PaymentMapper.toPaymentTransactionDto(payment),
    };
};

const buildWebhookResponse = ({
    payment = null,
    booking = null,
    rewardResult = null,
    already_processed = false,
    ignored = false,
    reason = null,
} = {}) => {
    return {
        received: true,
        ignored,
        already_processed,
        reason,
        payment: PaymentMapper.toPaymentTransactionDto(payment),
        booking: BookingMapper.toBookingDto(booking),
        reward: rewardResult ? {
            wash_history: rewardResult.wash_history,
            loyalty: rewardResult.loyalty,
            point_transaction: rewardResult.point_transaction,
            promotion_usage: rewardResult.promotion_usage,
            notifications: rewardResult.notifications,
            already_processed: rewardResult.already_processed,
        } : null,
    };
};

const createInitiatedPayosPayment = async ({
    booking,
    orderCode,
    description,
    expiredAt,
    user,
}) => {
    const payments = await PaymentTransaction.create([{
        booking_id: booking._id,
        provider: PAYMENT_PROVIDER.PAYOS,
        method: PAYMENT_METHOD.QR,
        order_code: orderCode,
        amount: booking.final_price,
        currency: PAYMENT_CURRENCY.VND,
        description,
        status: PAYMENT_TRANSACTION_STATUS.INITIATED,
        expires_at: toExpiresAt(expiredAt),
        created_by_staff_id: user._id,
    }]);

    return payments[0];
};

const markPaymentCreateFailed = async (payment, error) => {
    payment.status = PAYMENT_TRANSACTION_STATUS.FAILED;
    payment.raw_webhook = {
        source: 'CREATE_PAYMENT_LINK',
        message: error.message,
        error_code: error.errorCode || null,
    };
    await payment.save();
};

const createPayosPayment = async (user, bookingId, payload = {}) => {
    const booking = await Booking.findById(bookingId);

    if (!booking) {
        throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    await assertStaffCanAccessBooking(user, booking);
    assertBookingCanCreatePayosPayment(booking);

    const now = new Date();

    await expireOldPendingPayments(booking._id, now);

    const pendingPayment = await findReusablePendingPayment(booking._id, now);

    if (pendingPayment) {
        if (booking.payment_method !== BOOKING_PAYMENT_METHOD.PAYOS
            || booking.payment_status !== BOOKING_PAYMENT_STATUS.PENDING) {
            booking.payment_method = BOOKING_PAYMENT_METHOD.PAYOS;
            booking.payment_status = BOOKING_PAYMENT_STATUS.PENDING;
            await booking.save();
        }

        return buildCreatePaymentResponse(booking, pendingPayment, true);
    }

    const orderCode = await generateOrderCode();
    const description = buildPaymentDescription(orderCode);
    const expiredAt = payosService.buildCreatePaymentLinkPayload({
        orderCode,
        amount: booking.final_price,
        description,
        returnUrl: payload.return_url,
        cancelUrl: payload.cancel_url,
    }).expiredAt;

    const initiatedPayment = await createInitiatedPayosPayment({
        booking,
        orderCode,
        description,
        expiredAt,
        user,
    });

    let paymentLink;

    try {
        paymentLink = await payosService.createPaymentLink({
            orderCode,
            amount: booking.final_price,
            description,
            returnUrl: payload.return_url,
            cancelUrl: payload.cancel_url,
            expiredAt,
        });
    } catch (error) {
        await markPaymentCreateFailed(initiatedPayment, error);
        throw error;
    }

    const session = await mongoose.startSession();

    try {
        let response;

        await session.withTransaction(async () => {
            const freshBooking = await Booking.findById(booking._id).session(session);

            if (!freshBooking) {
                throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
            }

            assertBookingCanCreatePayosPayment(freshBooking);

            const payment = await PaymentTransaction.findById(initiatedPayment._id).session(session);

            if (!payment) {
                throw new AppError('Payment transaction not found', 404, 'PAYMENT_TRANSACTION_NOT_FOUND');
            }

            freshBooking.payment_method = BOOKING_PAYMENT_METHOD.PAYOS;
            freshBooking.payment_status = BOOKING_PAYMENT_STATUS.PENDING;
            await freshBooking.save({ session });

            payment.payment_link_id = paymentLink.paymentLinkId;
            payment.checkout_url = paymentLink.checkoutUrl;
            payment.qr_code = paymentLink.qrCode;
            payment.amount = paymentLink.amount || freshBooking.final_price;
            payment.currency = paymentLink.currency || PAYMENT_CURRENCY.VND;
            payment.status = PAYMENT_TRANSACTION_STATUS.PENDING;
            await payment.save({ session });

            response = buildCreatePaymentResponse(freshBooking, payment, false);
        });

        return response;
    } finally {
        await session.endSession();
    }
};

const getPaymentById = async (user, paymentId) => {
    const payment = await PaymentTransaction.findById(paymentId);

    if (!payment) {
        throw new AppError('Payment transaction not found', 404, 'PAYMENT_TRANSACTION_NOT_FOUND');
    }

    const booking = await Booking.findById(payment.booking_id);

    if (!booking) {
        throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    await assertStaffCanAccessBooking(user, booking);

    return buildPaymentDetailResponse(booking, payment);
};

const assertPaymentCanBeCanceled = (payment) => {
    if (payment.status === PAYMENT_TRANSACTION_STATUS.PAID) {
        throw new AppError('Paid payment cannot be canceled', 409, 'PAYMENT_ALREADY_PAID');
    }

    if (payment.status !== PAYMENT_TRANSACTION_STATUS.PENDING) {
        throw new AppError('Payment cannot be canceled in current status', 400, 'PAYMENT_CANCEL_NOT_ALLOWED');
    }
};

const cancelPayosPayment = async (user, paymentId, { reason } = {}) => {
    const session = await mongoose.startSession();

    try {
        let response;

        await session.withTransaction(async () => {
            const payment = await PaymentTransaction.findById(paymentId).session(session);

            if (!payment) {
                throw new AppError('Payment transaction not found', 404, 'PAYMENT_TRANSACTION_NOT_FOUND');
            }

            const booking = await Booking.findById(payment.booking_id).session(session);

            if (!booking) {
                throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
            }

            await assertStaffCanAccessBooking(user, booking);
            assertPaymentCanBeCanceled(payment);

            await payosService.cancelPaymentLink(payment.order_code, reason);

            const canceledAt = new Date();

            payment.status = PAYMENT_TRANSACTION_STATUS.CANCELED;
            payment.canceled_at = canceledAt;
            await payment.save({ session });

            if (
                booking.payment_method === BOOKING_PAYMENT_METHOD.PAYOS
                && booking.payment_status === BOOKING_PAYMENT_STATUS.PENDING
            ) {
                booking.payment_method = BOOKING_PAYMENT_METHOD.CASH;
                booking.payment_status = BOOKING_PAYMENT_STATUS.UNPAID;
                booking.paid_at = null;
                await booking.save({ session });
            }

            response = buildPaymentDetailResponse(booking, payment);
        });

        return response;
    } finally {
        await session.endSession();
    }
};

const getPayosPaymentByWebhookData = async (webhookData, session = null) => {
    const query = PaymentTransaction.findOne({
        provider: PAYMENT_PROVIDER.PAYOS,
        order_code: webhookData.orderCode,
    });

    const payment = session ? await query.session(session) : await query;

    if (payment && payment.payment_link_id && payment.payment_link_id !== webhookData.paymentLinkId) {
        throw new AppError('PayOS payment link does not match transaction', 400, 'PAYOS_PAYMENT_LINK_MISMATCH');
    }

    return payment;
};

const assertPayosWebhookAmountMatches = (payment, booking, webhookData) => {
    const webhookAmount = Number(webhookData.amount);

    if (webhookAmount !== payment.amount || webhookAmount !== booking.final_price) {
        throw new AppError('PayOS payment amount does not match booking amount', 400, 'PAYOS_PAYMENT_AMOUNT_MISMATCH');
    }
};

const markPayosPaymentFailed = async (payload, webhookData) => {
    const session = await mongoose.startSession();

    try {
        let response;

        await session.withTransaction(async () => {
            const payment = await getPayosPaymentByWebhookData(webhookData, session);

            if (!payment) {
                response = buildWebhookResponse({
                    ignored: true,
                    reason: 'UNKNOWN_PAYMENT_TRANSACTION',
                });

                return;
            }

            if (payment.status !== PAYMENT_TRANSACTION_STATUS.PAID) {
                payment.status = PAYMENT_TRANSACTION_STATUS.FAILED;
                payment.raw_webhook = payload;
                await payment.save({ session });
            }

            response = buildWebhookResponse({
                payment,
                ignored: true,
                already_processed: payment.status === PAYMENT_TRANSACTION_STATUS.PAID,
            });
        });

        return response;
    } finally {
        await session.endSession();
    }
};

const handlePayosWebhook = async (payload = {}) => {
    const webhookData = await payosService.verifyWebhook(payload);

    if (payload.success !== true || payload.code !== '00' || webhookData.code !== '00') {
        return markPayosPaymentFailed(payload, webhookData);
    }

    const session = await mongoose.startSession();

    try {
        let response;

        await session.withTransaction(async () => {
            const payment = await getPayosPaymentByWebhookData(webhookData, session);

            if (!payment) {
                response = buildWebhookResponse({
                    ignored: true,
                    reason: 'UNKNOWN_PAYMENT_TRANSACTION',
                });

                return;
            }

            const booking = await Booking.findById(payment.booking_id).session(session);

            if (!booking) {
                throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
            }

            assertPayosWebhookAmountMatches(payment, booking, webhookData);

            if (payment.status === PAYMENT_TRANSACTION_STATUS.PAID) {
                response = buildWebhookResponse({
                    payment,
                    booking,
                    already_processed: true,
                });

                return;
            }

            if (booking.status !== BOOKING_STATUS.COMPLETED) {
                throw new AppError('Booking cannot be processed in current status', 400, 'BOOKING_PAYOS_WEBHOOK_NOT_ALLOWED');
            }

            const paidAt = parsePayosTransactionTime(webhookData.transactionDateTime);

            if (!payment.payment_link_id) {
                payment.payment_link_id = webhookData.paymentLinkId;
            }

            payment.status = PAYMENT_TRANSACTION_STATUS.PAID;
            payment.paid_at = paidAt;
            payment.raw_webhook = payload;
            await payment.save({ session });

            const paidResult = await bookingPaymentService.confirmBookingPaid({
                booking,
                paymentMethod: BOOKING_PAYMENT_METHOD.PAYOS,
                actorId: payment.created_by_staff_id,
                paidAt,
                session,
            });

            response = buildWebhookResponse({
                payment,
                booking,
                rewardResult: paidResult,
                already_processed: paidResult.already_processed,
            });
        });

        return response;
    } finally {
        await session.endSession();
    }
};

module.exports = {
    createPayosPayment,
    getPaymentById,
    cancelPayosPayment,
    handlePayosWebhook,
};
