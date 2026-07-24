const mongoose = require('mongoose');

const Booking = require('../bookings/booking.model');
const BookingMapper = require('../bookings/booking.mapper');
const bookingPaymentService = require('../bookings/bookingPayment.service');
const bookingHandoverPaymentPolicy = require('../booking-handovers/bookingHandoverPayment.policy');
const StaffProfile = require('../staff-profiles/staffProfile.model');
const auditLogService = require('../audit-logs/auditLog.service');
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
    PAYMENT_INITIATED_CHANNEL,
    PAYMENT_TRANSACTION_STATUS,
    PAYMENT_CURRENCY,
} = require('../../shared/constants/payment.constant');
const { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } = require('../../shared/constants/audit.constant');

const ACTIVE_PAYMENT_STATUSES = Object.freeze([
    PAYMENT_TRANSACTION_STATUS.INITIATED,
    PAYMENT_TRANSACTION_STATUS.PENDING,
    PAYMENT_TRANSACTION_STATUS.CANCELING,
]);

const PAYMENT_POLL_AFTER_MS = 3000;

const buildActivePaymentKey = (bookingId) => `${PAYMENT_PROVIDER.PAYOS}:${bookingId.toString()}`;

const getInitiatedChannel = (user) => (
    user.role === USER_ROLES.CUSTOMER
        ? PAYMENT_INITIATED_CHANNEL.CUSTOMER_SELF_SERVICE
        : PAYMENT_INITIATED_CHANNEL.STAFF_ASSISTED
);

const assertCustomerOwnsBooking = (user, booking) => {
    if (
        booking.is_walk_in
        || !booking.customer_id
        || booking.customer_id.toString() !== user._id.toString()
    ) {
        throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }
};

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

const assertActorCanAccessBooking = async (user, booking) => {
    if (user.role === USER_ROLES.CUSTOMER) {
        assertCustomerOwnsBooking(user, booking);
        return;
    }

    await assertStaffCanAccessBooking(user, booking);
};

const assertBookingCanCreatePayosPayment = (booking) => {
    if (booking.status !== BOOKING_STATUS.COMPLETED) {
        throw new AppError('Booking cannot be processed in current status', 400, 'BOOKING_PAYOS_PAYMENT_NOT_ALLOWED');
    }

    if (booking.payment_status === BOOKING_PAYMENT_STATUS.PAID) {
        throw new AppError('Booking is already paid', 409, 'BOOKING_ALREADY_PAID');
    }

    if (booking.payment_status === BOOKING_PAYMENT_STATUS.WAIVED) {
        throw new AppError(
            'Booking payment has been fully waived',
            409,
            'BOOKING_PAYMENT_WAIVED'
        );
    }

    if (!Number.isInteger(booking.final_price) || booking.final_price <= 0) {
        throw new AppError('Booking final price must be greater than 0', 400, 'BOOKING_INVALID_PAYMENT_AMOUNT');
    }
};

const findActivePayosPayment = async (bookingId, now = new Date()) => {
    const payment = await PaymentTransaction.findOne({
        booking_id: bookingId,
        provider: PAYMENT_PROVIDER.PAYOS,
        $or: [
            {
                status: PAYMENT_TRANSACTION_STATUS.CANCELING,
            },
            {
                status: {
                    $in: [
                        PAYMENT_TRANSACTION_STATUS.INITIATED,
                        PAYMENT_TRANSACTION_STATUS.PENDING,
                    ],
                },
                $or: [
                    { expires_at: null },
                    { expires_at: { $gt: now } },
                ],
            },
        ],
    }).sort({ created_at: -1 });

    return payment;
};

const findLatestPayosPayment = async (bookingId) => {
    return PaymentTransaction.findOne({
        booking_id: bookingId,
        provider: PAYMENT_PROVIDER.PAYOS,
    }).sort({ created_at: -1 });
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

const buildCustomerPaymentResponse = (payment, reused = false) => {
    return {
        payment: PaymentMapper.toCustomerPaymentTransactionDto(payment),
        reused,
        poll_after_ms: ACTIVE_PAYMENT_STATUSES.includes(payment.status)
            ? PAYMENT_POLL_AFTER_MS
            : null,
    };
};

const buildPaymentResponseForActor = (user, booking, payment, reused = false) => {
    if (user.role === USER_ROLES.CUSTOMER) {
        return buildCustomerPaymentResponse(payment, reused);
    }

    return buildCreatePaymentResponse(booking, payment, reused);
};

const buildPaymentDetailResponse = (booking, payment) => {
    return {
        booking: BookingMapper.toBookingDto(booking),
        payment: PaymentMapper.toPaymentTransactionDto(payment),
    };
};

const recordPaymentAuditEvent = async ({
    actorId = null,
    action,
    payment,
    booking,
    before = null,
    after = null,
    auditContext = {},
    metadata = {},
    session = null,
}) => {
    return auditLogService.recordAuditEvent({
        actorId,
        action,
        resourceType: AUDIT_RESOURCE_TYPES.PAYMENT,
        resourceId: payment._id,
        before,
        after,
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
        metadata: {
            booking_id: booking?._id?.toString?.() || payment.booking_id?.toString?.() || null,
            provider: payment.provider,
            initiated_channel: payment.initiated_channel,
            ...metadata,
        },
        session,
    });
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
        created_by_staff_id: user.role === USER_ROLES.CUSTOMER ? null : user._id,
        initiated_by_user_id: user._id,
        initiated_by_role: user.role,
        initiated_channel: getInitiatedChannel(user),
        active_payment_key: buildActivePaymentKey(booking._id),
    }]);

    return payments[0];
};

const markPaymentCreateFailed = async ({ payment, error, booking, user, auditContext = {} }) => {
    const before = PaymentMapper.toPaymentTransactionDto(payment);
    payment.status = PAYMENT_TRANSACTION_STATUS.FAILED;
    payment.active_payment_key = null;
    payment.raw_webhook = {
        source: 'CREATE_PAYMENT_LINK',
        message: error.message,
        error_code: error.errorCode || null,
    };
    await payment.save();

    await recordPaymentAuditEvent({
        actorId: user._id,
        action: AUDIT_ACTIONS.PAYMENT_FAILED,
        payment,
        booking,
        before,
        after: PaymentMapper.toPaymentTransactionDto(payment),
        auditContext,
        metadata: {
            source: 'CREATE_PAYMENT_LINK',
            error_code: error.errorCode || null,
        },
    });
};

const isPaymentDuplicateError = (error) => error?.code === 11000;

const createPayosPayment = async (user, bookingId, payload = {}, auditContext = {}) => {
    const booking = await Booking.findById(bookingId);

    if (!booking) {
        throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    await assertActorCanAccessBooking(user, booking);
    assertBookingCanCreatePayosPayment(booking);
    await bookingHandoverPaymentPolicy.assertPaymentCollectionAllowed(booking._id);

    const now = new Date();

    await expireDuePayosPayments({
        bookingId: booking._id,
        now,
        limit: 10,
        source: 'CREATE_OR_REUSE',
    });

    const pendingPayment = await findActivePayosPayment(booking._id, now);

    if (pendingPayment) {
        if (pendingPayment.status === PAYMENT_TRANSACTION_STATUS.CANCELING) {
            throw new AppError('Payment cancel is already in progress', 409, 'PAYMENT_CANCEL_IN_PROGRESS');
        }

        if (
            pendingPayment.status === PAYMENT_TRANSACTION_STATUS.PENDING
            && (
                booking.payment_method !== BOOKING_PAYMENT_METHOD.PAYOS
                || booking.payment_status !== BOOKING_PAYMENT_STATUS.PENDING
            )
        ) {
            booking.payment_method = BOOKING_PAYMENT_METHOD.PAYOS;
            booking.payment_status = BOOKING_PAYMENT_STATUS.PENDING;
            await booking.save();
        }

        await recordPaymentAuditEvent({
            actorId: user._id,
            action: AUDIT_ACTIONS.PAYMENT_REUSED,
            payment: pendingPayment,
            booking,
            auditContext,
            metadata: {
                source: 'CREATE_OR_REUSE',
            },
        });

        return buildPaymentResponseForActor(user, booking, pendingPayment, true);
    }

    const orderCode = await generateOrderCode();
    const description = buildPaymentDescription(orderCode);
    const returnUrl = user.role === USER_ROLES.CUSTOMER
        ? process.env.PAYOS_CUSTOMER_RETURN_URL || undefined
        : payload.return_url;
    const cancelUrl = user.role === USER_ROLES.CUSTOMER
        ? process.env.PAYOS_CUSTOMER_CANCEL_URL || undefined
        : payload.cancel_url;
    const expiredAt = payosService.buildCreatePaymentLinkPayload({
        orderCode,
        amount: booking.final_price,
        description,
        returnUrl,
        cancelUrl,
    }).expiredAt;

    let initiatedPayment;

    try {
        initiatedPayment = await createInitiatedPayosPayment({
            booking,
            orderCode,
            description,
            expiredAt,
            user,
        });
    } catch (error) {
        if (!isPaymentDuplicateError(error)) {
            throw error;
        }

        const concurrentPayment = await findActivePayosPayment(booking._id, now);

        if (!concurrentPayment) {
            throw error;
        }

        await recordPaymentAuditEvent({
            actorId: user._id,
            action: AUDIT_ACTIONS.PAYMENT_REUSED,
            payment: concurrentPayment,
            booking,
            auditContext,
            metadata: {
                source: 'CONCURRENT_CREATE',
            },
        });

        return buildPaymentResponseForActor(user, booking, concurrentPayment, true);
    }

    let paymentLink;

    try {
        paymentLink = await payosService.createPaymentLink({
            orderCode,
            amount: booking.final_price,
            description,
            returnUrl,
            cancelUrl,
            expiredAt,
        });
    } catch (error) {
        await markPaymentCreateFailed({
            payment: initiatedPayment,
            error,
            booking,
            user,
            auditContext,
        });
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
            await bookingHandoverPaymentPolicy.assertPaymentCollectionAllowed(
                freshBooking._id,
                { session }
            );

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

            await recordPaymentAuditEvent({
                actorId: user._id,
                action: AUDIT_ACTIONS.PAYMENT_CREATED,
                payment,
                booking: freshBooking,
                after: PaymentMapper.toPaymentTransactionDto(payment),
                auditContext,
                metadata: {
                    source: 'CREATE_PAYMENT_LINK',
                },
                session,
            });

            response = buildPaymentResponseForActor(user, freshBooking, payment, false);
        });

        return response;
    } catch (error) {
        await payosService.cancelPaymentLink(orderCode, 'Local payment finalization failed').catch(() => null);
        await markPaymentCreateFailed({
            payment: initiatedPayment,
            error,
            booking,
            user,
            auditContext,
        });
        throw error;
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

const getPayosPaymentForBooking = async (user, bookingId) => {
    let booking = await Booking.findById(bookingId);

    if (!booking) {
        throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    await assertActorCanAccessBooking(user, booking);
    await expireDuePayosPayments({
        bookingId: booking._id,
        limit: 10,
        source: 'PAYMENT_POLL',
    });

    booking = await Booking.findById(bookingId);

    if (!booking) {
        throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    await assertActorCanAccessBooking(user, booking);

    const payment = await findLatestPayosPayment(booking._id);

    if (!payment) {
        throw new AppError('Payment transaction not found', 404, 'PAYMENT_TRANSACTION_NOT_FOUND');
    }

    if (user.role === USER_ROLES.CUSTOMER) {
        return buildCustomerPaymentResponse(payment, true);
    }

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

const beginPayosPaymentCancel = async (user, paymentId) => {
    const session = await mongoose.startSession();

    try {
        let cancelContext;

        await session.withTransaction(async () => {
            const payment = await PaymentTransaction.findById(paymentId).session(session);

            if (!payment) {
                throw new AppError('Payment transaction not found', 404, 'PAYMENT_TRANSACTION_NOT_FOUND');
            }

            const booking = await Booking.findById(payment.booking_id).session(session);

            if (!booking) {
                throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
            }

            await assertActorCanAccessBooking(user, booking);

            if (payment.status === PAYMENT_TRANSACTION_STATUS.CANCELING) {
                cancelContext = {
                    orderCode: payment.order_code,
                };

                return;
            }

            assertPaymentCanBeCanceled(payment);

            payment.status = PAYMENT_TRANSACTION_STATUS.CANCELING;
            await payment.save({ session });

            cancelContext = {
                orderCode: payment.order_code,
            };
        });

        return cancelContext;
    } finally {
        await session.endSession();
    }
};

const rollbackPayosPaymentCancel = async (paymentId, error) => {
    const payment = await PaymentTransaction.findById(paymentId);

    if (!payment || payment.status !== PAYMENT_TRANSACTION_STATUS.CANCELING) {
        return;
    }

    payment.status = PAYMENT_TRANSACTION_STATUS.PENDING;
    payment.raw_webhook = {
        source: 'CANCEL_PAYMENT_LINK',
        message: error.message,
        error_code: error.errorCode || null,
    };
    await payment.save();
};

const finishPayosPaymentCancel = async (
    user,
    paymentId,
    auditContext = {},
    metadata = {}
) => {
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

            await assertActorCanAccessBooking(user, booking);

            if (payment.status === PAYMENT_TRANSACTION_STATUS.PAID) {
                throw new AppError('Paid payment cannot be canceled', 409, 'PAYMENT_ALREADY_PAID');
            }

            if (payment.status !== PAYMENT_TRANSACTION_STATUS.CANCELING) {
                throw new AppError('Payment cannot be canceled in current status', 400, 'PAYMENT_CANCEL_NOT_ALLOWED');
            }

            const before = PaymentMapper.toPaymentTransactionDto(payment);
            payment.status = PAYMENT_TRANSACTION_STATUS.CANCELED;
            payment.canceled_at = new Date();
            payment.active_payment_key = null;
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

            await recordPaymentAuditEvent({
                actorId: user._id,
                action: AUDIT_ACTIONS.PAYMENT_CANCELED,
                payment,
                booking,
                before,
                after: PaymentMapper.toPaymentTransactionDto(payment),
                auditContext,
                metadata,
                session,
            });

            response = buildPaymentDetailResponse(booking, payment);
        });

        return response;
    } finally {
        await session.endSession();
    }
};

const cancelPayosPayment = async (user, paymentId, { reason } = {}, auditContext = {}) => {
    const cancelContext = await beginPayosPaymentCancel(user, paymentId);

    try {
        await payosService.cancelPaymentLink(cancelContext.orderCode, reason);
    } catch (error) {
        await rollbackPayosPaymentCancel(paymentId, error);
        throw error;
    }

    return finishPayosPaymentCancel(user, paymentId, auditContext, {
        reason: reason || null,
    });
};

const finishPayosPaymentCanceledAtProvider = async (user, paymentId) => {
    await beginPayosPaymentCancel(user, paymentId);

    return finishPayosPaymentCancel(user, paymentId);
};

const getCurrentBookingAfterPaymentRace = async (user, bookingId) => {
    const booking = await Booking.findById(bookingId);

    if (!booking) {
        throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    await assertActorCanAccessBooking(user, booking);

    return booking;
};

const assertPaymentCanBeExpired = (payment, now) => {
    if (payment.status === PAYMENT_TRANSACTION_STATUS.EXPIRED) {
        return;
    }

    if (payment.status === PAYMENT_TRANSACTION_STATUS.PAID) {
        throw new AppError('Paid payment cannot be expired', 409, 'PAYMENT_ALREADY_PAID');
    }

    if (payment.status === PAYMENT_TRANSACTION_STATUS.CANCELING) {
        throw new AppError('Payment cancel is already in progress', 409, 'PAYMENT_CANCEL_IN_PROGRESS');
    }

    if (![
        PAYMENT_TRANSACTION_STATUS.INITIATED,
        PAYMENT_TRANSACTION_STATUS.PENDING,
    ].includes(payment.status)) {
        throw new AppError('Payment cannot be expired in current status', 400, 'PAYMENT_EXPIRE_NOT_ALLOWED');
    }

    if (!payment.expires_at) {
        throw new AppError('Payment expiration time is missing', 400, 'PAYMENT_EXPIRES_AT_MISSING');
    }

    if (payment.expires_at.getTime() > now.getTime()) {
        throw new AppError('Payment has not expired yet', 400, 'PAYMENT_NOT_EXPIRED');
    }
};

const expirePayosPaymentInternal = async ({
    user = null,
    paymentId,
    now = new Date(),
    auditContext = {},
    source = 'MANUAL',
}) => {
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

            if (user) {
                await assertStaffCanAccessBooking(user, booking);
            }

            assertPaymentCanBeExpired(payment, now);

            if (payment.status !== PAYMENT_TRANSACTION_STATUS.EXPIRED) {
                const before = PaymentMapper.toPaymentTransactionDto(payment);
                payment.status = PAYMENT_TRANSACTION_STATUS.EXPIRED;
                payment.expired_at = now;
                payment.active_payment_key = null;
                await payment.save({ session });

                await recordPaymentAuditEvent({
                    actorId: user?._id || null,
                    action: AUDIT_ACTIONS.PAYMENT_EXPIRED,
                    payment,
                    booking,
                    before,
                    after: PaymentMapper.toPaymentTransactionDto(payment),
                    auditContext,
                    metadata: { source },
                    session,
                });
            }

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

const expirePayosPayment = async (user, paymentId, auditContext = {}) => {
    return expirePayosPaymentInternal({
        user,
        paymentId,
        auditContext,
        source: 'MANUAL',
    });
};

const expireDuePayosPayments = async ({
    limit = 50,
    bookingId = null,
    now = new Date(),
    source = 'SCHEDULER',
} = {}) => {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 200));
    const filter = {
        provider: PAYMENT_PROVIDER.PAYOS,
        status: {
            $in: [
                PAYMENT_TRANSACTION_STATUS.INITIATED,
                PAYMENT_TRANSACTION_STATUS.PENDING,
            ],
        },
        expires_at: { $lte: now },
    };

    if (bookingId) {
        filter.booking_id = bookingId;
    }

    const duePayments = await PaymentTransaction.find(filter)
        .sort({ expires_at: 1 })
        .limit(safeLimit);
    const results = [];

    for (const payment of duePayments) {
        try {
            const result = await expirePayosPaymentInternal({
                paymentId: payment._id,
                now,
                source,
            });

            results.push({
                payment_id: payment._id.toString(),
                status: result.payment.status,
            });
        } catch (error) {
            results.push({
                payment_id: payment._id.toString(),
                status: 'FAILED',
                error_code: error.errorCode || null,
                error: error.message,
            });
        }
    }

    return {
        processed: results.length,
        expired: results.filter((item) => item.status === PAYMENT_TRANSACTION_STATUS.EXPIRED).length,
        failed: results.filter((item) => item.status === 'FAILED').length,
        data: results,
    };
};

const resolvePendingPayosPaymentForCash = async (
    user,
    bookingId,
    { reason = 'Staff switched booking to cash payment' } = {}
) => {
    const booking = await getCurrentBookingAfterPaymentRace(user, bookingId);

    if (booking.status !== BOOKING_STATUS.COMPLETED) {
        throw new AppError(
            'Booking cannot be marked as paid in current status',
            400,
            'BOOKING_MARK_PAID_NOT_ALLOWED'
        );
    }

    await expireDuePayosPayments({
        bookingId: booking._id,
        limit: 10,
        source: 'CASH_PAYMENT_RESOLUTION',
    });

    const payment = await findActivePayosPayment(booking._id);

    if (payment?.status === PAYMENT_TRANSACTION_STATUS.INITIATED) {
        throw new AppError(
            'PayOS payment creation is in progress',
            409,
            'PAYMENT_CREATION_IN_PROGRESS'
        );
    }

    if (!payment && (
        booking.payment_method !== BOOKING_PAYMENT_METHOD.PAYOS
        || booking.payment_status !== BOOKING_PAYMENT_STATUS.PENDING
    )) {
        return {
            resolution: 'NONE',
            booking: BookingMapper.toBookingDto(booking),
            payment: null,
        };
    }

    if (!payment) {
        const currentBooking = await getCurrentBookingAfterPaymentRace(user, booking._id);

        if (currentBooking.payment_status === BOOKING_PAYMENT_STATUS.PAID) {
            return {
                resolution: 'PAYOS_PAID',
                booking: BookingMapper.toBookingDto(currentBooking),
                payment: null,
            };
        }

        if (currentBooking.payment_status === BOOKING_PAYMENT_STATUS.UNPAID) {
            return {
                resolution: 'NONE',
                booking: BookingMapper.toBookingDto(currentBooking),
                payment: null,
            };
        }

        throw new AppError(
            'Pending PayOS transaction not found for booking',
            409,
            'BOOKING_PENDING_PAYOS_TRANSACTION_NOT_FOUND'
        );
    }

    try {
        const providerPayment = await payosService.getPaymentLinkInformation(
            payment.payment_link_id || payment.order_code
        );
        const providerStatus = String(providerPayment?.status || '').toUpperCase();

        if (providerStatus === 'PAID') {
            throw new AppError(
                'PayOS payment was already paid and cannot be converted to cash',
                409,
                'PAYMENT_ALREADY_PAID'
            );
        }

        if (providerStatus === 'CANCELLED' || providerStatus === 'CANCELED') {
            const result = await finishPayosPaymentCanceledAtProvider(user, payment._id);

            return {
                resolution: 'CANCELED',
                ...result,
            };
        }

        if (!['PENDING', 'PROCESSING'].includes(providerStatus)) {
            throw new AppError(
                'PayOS payment status cannot be resolved for cash payment',
                409,
                'PAYOS_PAYMENT_STATUS_UNRESOLVED'
            );
        }

        const result = await cancelPayosPayment(user, payment._id, { reason });

        return {
            resolution: 'CANCELED',
            ...result,
        };
    } catch (error) {
        if (error?.errorCode !== 'PAYMENT_ALREADY_PAID') {
            throw error;
        }

        const currentBooking = await getCurrentBookingAfterPaymentRace(user, booking._id);

        if (currentBooking.payment_status !== BOOKING_PAYMENT_STATUS.PAID) {
            throw error;
        }

        return {
            resolution: 'PAYOS_PAID',
            booking: BookingMapper.toBookingDto(currentBooking),
            payment: null,
        };
    }
};

const resolvePendingPayosPaymentForHandoverIssue = async (user, bookingId) => (
    resolvePendingPayosPaymentForCash(user, bookingId, {
        reason: 'Payment put on hold because a handover issue was reported',
    })
);

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

            const booking = await Booking.findById(payment.booking_id).session(session);

            const canFailPayment = ACTIVE_PAYMENT_STATUSES.includes(payment.status);

            if (canFailPayment) {
                const before = PaymentMapper.toPaymentTransactionDto(payment);
                payment.status = PAYMENT_TRANSACTION_STATUS.FAILED;
                payment.active_payment_key = null;
                payment.raw_webhook = payload;
                await payment.save({ session });

                if (
                    booking
                    && booking.payment_method === BOOKING_PAYMENT_METHOD.PAYOS
                    && booking.payment_status === BOOKING_PAYMENT_STATUS.PENDING
                ) {
                    booking.payment_method = BOOKING_PAYMENT_METHOD.CASH;
                    booking.payment_status = BOOKING_PAYMENT_STATUS.UNPAID;
                    booking.paid_at = null;
                    await booking.save({ session });
                }

                await recordPaymentAuditEvent({
                    action: AUDIT_ACTIONS.PAYMENT_FAILED,
                    payment,
                    booking,
                    before,
                    after: PaymentMapper.toPaymentTransactionDto(payment),
                    metadata: {
                        source: 'PAYOS_WEBHOOK',
                        provider_code: webhookData.code || null,
                    },
                    session,
                });
            }

            response = buildWebhookResponse({
                payment,
                booking,
                ignored: true,
                already_processed: !canFailPayment,
                reason: canFailPayment ? null : 'PAYMENT_ALREADY_TERMINAL',
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

            if (payment.status === PAYMENT_TRANSACTION_STATUS.PAID) {
                const booking = await Booking.findById(payment.booking_id).session(session);

                response = buildWebhookResponse({
                    payment,
                    booking,
                    already_processed: true,
                });

                return;
            }

            const booking = await Booking.findById(payment.booking_id).session(session);

            if (!booking) {
                response = buildWebhookResponse({
                    payment,
                    ignored: true,
                    reason: 'BOOKING_NOT_FOUND',
                });

                return;
            }

            assertPayosWebhookAmountMatches(payment, booking, webhookData);

            if (booking.status !== BOOKING_STATUS.COMPLETED) {
                response = buildWebhookResponse({
                    payment,
                    booking,
                    ignored: true,
                    reason: 'BOOKING_NOT_PROCESSABLE',
                });

                return;
            }

            const paidAt = parsePayosTransactionTime(webhookData.transactionDateTime);

            if (!payment.payment_link_id) {
                payment.payment_link_id = webhookData.paymentLinkId;
            }

            const paymentBefore = PaymentMapper.toPaymentTransactionDto(payment);
            payment.status = PAYMENT_TRANSACTION_STATUS.PAID;
            payment.paid_at = paidAt;
            payment.active_payment_key = null;
            payment.raw_webhook = payload;
            await payment.save({ session });

            const paidResult = await bookingPaymentService.confirmBookingPaid({
                booking,
                paymentMethod: BOOKING_PAYMENT_METHOD.PAYOS,
                actorId: payment.initiated_by_user_id || payment.created_by_staff_id,
                paidAt,
                session,
            });

            await recordPaymentAuditEvent({
                action: AUDIT_ACTIONS.PAYMENT_CONFIRMED,
                payment,
                booking,
                before: paymentBefore,
                after: PaymentMapper.toPaymentTransactionDto(payment),
                metadata: {
                    source: 'PAYOS_WEBHOOK',
                    initiated_by_user_id: payment.initiated_by_user_id?.toString?.()
                        || payment.created_by_staff_id?.toString?.()
                        || null,
                },
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
    getPayosPaymentForBooking,
    cancelPayosPayment,
    expirePayosPayment,
    expireDuePayosPayments,
    resolvePendingPayosPaymentForCash,
    resolvePendingPayosPaymentForHandoverIssue,
    handlePayosWebhook,
};
