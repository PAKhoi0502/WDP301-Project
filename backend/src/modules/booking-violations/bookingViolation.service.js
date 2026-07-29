const mongoose = require('mongoose');
const CustomerBookingViolation = require('./customerBookingViolation.model');
const BookingViolationEvent = require('./bookingViolationEvent.model');
const BookingViolationAdjustment = require('./bookingViolationAdjustment.model');
const BookingViolationAppeal = require('./bookingViolationAppeal.model');
const User = require('../users/user.model');
const notificationService = require('../notifications/notification.service');
const auditLogService = require('../audit-logs/auditLog.service');
const {
    BOOKING_VIOLATION_EVENTS,
    BOOKING_VIOLATION_SCORE,
    BOOKING_VIOLATION_LATE_CANCEL_HOURS,
    BOOKING_VIOLATION_REPEAT_CANCEL_COUNT,
    BOOKING_VIOLATION_REPEAT_CANCEL_DAYS,
    BOOKING_VIOLATION_RECOVERY_DAYS,
    BOOKING_VIOLATION_BLOCK_THRESHOLD,
    BOOKING_VIOLATION_DEPOSIT_THRESHOLD,
    BOOKING_VIOLATION_WARNING_THRESHOLD,
    BOOKING_VIOLATION_BLOCK_DAYS,
    BOOKING_VIOLATION_RISK_STATUSES,
    BOOKING_VIOLATION_ADJUSTMENT_TYPES,
    BOOKING_VIOLATION_APPEAL_STATUSES,
} = require('./bookingViolation.constant');
const {
    NOTIFICATION_TYPES,
    NOTIFICATION_RELATED_TYPES,
} = require('../../shared/constants/notification.constant');
const {
    AUDIT_ACTIONS,
    AUDIT_RESOURCE_TYPES,
} = require('../../shared/constants/audit.constant');
const { USER_ROLES } = require('../../shared/constants/roles.constant');
const { AppError } = require('../../shared/utils/appError');

const HOURS_TO_MS = 60 * 60 * 1000;
const DAYS_TO_MS = 24 * HOURS_TO_MS;

const addDays = (date, days) => new Date(date.getTime() + days * DAYS_TO_MS);

const getBlockDurationDays = (nextBlockCount) => {
    const index = Math.max(0, nextBlockCount - 1);

    return BOOKING_VIOLATION_BLOCK_DAYS[Math.min(index, BOOKING_VIOLATION_BLOCK_DAYS.length - 1)];
};

const runQueryWithSession = (query, session) => {
    if (session && query.session) {
        query.session(session);
    }

    return query;
};

const isCustomerBlocked = (violation, now = new Date()) => {
    return Boolean(violation?.booking_blocked_until && new Date(violation.booking_blocked_until) > now);
};

const deriveRiskStatus = (score = 0, blockedUntil = null, now = new Date()) => {
    if (blockedUntil && new Date(blockedUntil) > now) {
        return BOOKING_VIOLATION_RISK_STATUSES.BLOCKED;
    }

    if (score >= BOOKING_VIOLATION_DEPOSIT_THRESHOLD) {
        return BOOKING_VIOLATION_RISK_STATUSES.DEPOSIT_REQUIRED;
    }

    if (score >= BOOKING_VIOLATION_WARNING_THRESHOLD) {
        return BOOKING_VIOLATION_RISK_STATUSES.WARNING;
    }

    return BOOKING_VIOLATION_RISK_STATUSES.NORMAL;
};

const toCustomerSummary = (customer) => {
    if (
        !customer
        || typeof customer !== 'object'
        || (!customer._id && !customer.id)
    ) {
        return null;
    }

    return {
        id: customer._id?.toString() || customer.id || null,
        full_name: customer.full_name || 'Customer',
        phone: customer.phone || null,
        email: customer.email || null,
        avatar_url: customer.avatar_url || null,
        is_active: customer.is_active,
    };
};

const toStatusDto = (violation, now = new Date()) => {
    const plain = violation?.toObject ? violation.toObject() : violation;
    const score = plain?.violation_score || 0;
    const blockedUntil = plain?.booking_blocked_until || null;
    const riskStatus = deriveRiskStatus(score, blockedUntil, now);

    return {
        customer_id: plain?.customer_id?._id?.toString()
            || plain?.customer_id?.toString?.()
            || null,
        customer: toCustomerSummary(plain?.customer_id),
        violation_score: score,
        risk_status: riskStatus,
        warning_required: riskStatus === BOOKING_VIOLATION_RISK_STATUSES.WARNING,
        deposit_required: riskStatus === BOOKING_VIOLATION_RISK_STATUSES.DEPOSIT_REQUIRED,
        booking_blocked: riskStatus === BOOKING_VIOLATION_RISK_STATUSES.BLOCKED,
        booking_blocked_until: blockedUntil,
        booking_block_count: plain?.booking_block_count || 0,
        last_violation_at: plain?.last_violation_at || null,
        last_event_at: plain?.last_event_at || null,
        last_recovery_at: plain?.last_recovery_at || null,
        thresholds: {
            warning: BOOKING_VIOLATION_WARNING_THRESHOLD,
            deposit_required: BOOKING_VIOLATION_DEPOSIT_THRESHOLD,
            blocked: BOOKING_VIOLATION_BLOCK_THRESHOLD,
        },
    };
};

const getOrCreateCustomerViolation = async (customerId, session = null) => {
    const existingQuery = CustomerBookingViolation.findOne({ customer_id: customerId });
    const existingViolation = await runQueryWithSession(existingQuery, session);

    if (existingViolation) {
        return existingViolation;
    }

    try {
        const documents = await CustomerBookingViolation.create(
            [
                {
                    customer_id: customerId,
                    violation_score: 0,
                    booking_blocked_until: null,
                    booking_block_count: 0,
                    risk_status: BOOKING_VIOLATION_RISK_STATUSES.NORMAL,
                    last_violation_at: null,
                    last_event_at: null,
                    last_recovery_at: null,
                },
            ],
            session ? { session } : undefined
        );

        return documents[0];
    } catch (error) {
        if (error?.code !== 11000) {
            throw error;
        }

        return runQueryWithSession(
            CustomerBookingViolation.findOne({ customer_id: customerId }),
            session
        );
    }
};

const assertCustomerCanCreateBooking = async (customerId, now = new Date()) => {
    const violation = await CustomerBookingViolation.findOne({ customer_id: customerId }).lean();
    const status = toStatusDto(violation || { customer_id: customerId }, now);

    if (!status.booking_blocked) {
        return {
            allowed: true,
            violation: status,
            deposit_required: status.deposit_required,
        };
    }

    throw new AppError(
        'Customer is temporarily blocked from creating bookings',
        403,
        'CUSTOMER_BOOKING_BLOCKED',
        {
            violation_score: status.violation_score,
            risk_status: status.risk_status,
            booking_blocked_until: status.booking_blocked_until,
            booking_block_count: status.booking_block_count,
        }
    );
};

const shouldTrackBooking = (booking) => {
    return Boolean(booking?._id && booking?.customer_id && !booking?.is_walk_in);
};

const findExistingEvent = async ({ bookingId, event, session = null }) => {
    return runQueryWithSession(
        BookingViolationEvent.findOne({ booking_id: bookingId, event }),
        session
    );
};

const createViolationEvent = async ({
    booking,
    event,
    scoreChange,
    scoreBefore,
    scoreAfter,
    reason,
    actorId,
    session = null,
}) => {
    const documents = await BookingViolationEvent.create(
        [
            {
                booking_id: booking._id,
                customer_id: booking.customer_id,
                event,
                score_change: scoreChange,
                score_before: scoreBefore,
                score_after: scoreAfter,
                reason: reason || null,
                created_by: actorId || null,
            },
        ],
        session ? { session } : undefined
    );

    return documents[0];
};

const getRiskNotification = (status, violation) => {
    if (status === BOOKING_VIOLATION_RISK_STATUSES.BLOCKED) {
        return {
            type: NOTIFICATION_TYPES.BOOKING_BLOCKED,
            title: 'Tạm khóa quyền đặt lịch',
            message: `Tài khoản đang có ${violation.violation_score} điểm vi phạm và bị khóa đặt lịch đến ${new Date(violation.booking_blocked_until).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}.`,
        };
    }

    if (status === BOOKING_VIOLATION_RISK_STATUSES.DEPOSIT_REQUIRED) {
        return {
            type: NOTIFICATION_TYPES.BOOKING_DEPOSIT_REQUIRED,
            title: 'Cần đặt cọc cho lịch tiếp theo',
            message: `Tài khoản đang có ${violation.violation_score} điểm vi phạm. Lịch tiếp theo sẽ thuộc diện yêu cầu đặt cọc khi tính năng được áp dụng.`,
        };
    }

    if (status === BOOKING_VIOLATION_RISK_STATUSES.WARNING) {
        return {
            type: NOTIFICATION_TYPES.BOOKING_VIOLATION_WARNING,
            title: 'Cảnh báo điểm vi phạm',
            message: `Tài khoản đang có ${violation.violation_score} điểm vi phạm. Vui lòng hạn chế hủy sát giờ hoặc không đến.`,
        };
    }

    return null;
};

const notifyRiskTransition = async ({
    customerId,
    previousStatus,
    violation,
    relatedId,
    session = null,
}) => {
    const nextStatus = deriveRiskStatus(
        violation.violation_score,
        violation.booking_blocked_until
    );

    if (nextStatus === previousStatus) {
        return null;
    }

    const payload = getRiskNotification(nextStatus, violation);

    if (!payload) {
        return null;
    }

    return notificationService.createInAppNotification({
        userId: customerId,
        ...payload,
        relatedType: NOTIFICATION_RELATED_TYPES.BOOKING_VIOLATION,
        relatedId,
        metadata: {
            violation_score: violation.violation_score,
            risk_status: nextStatus,
            booking_blocked_until: violation.booking_blocked_until,
        },
        session,
    });
};

const applyScoreChange = ({
    violation,
    scoreChange,
    occurredAt,
    allowNewBlock = true,
    clearActiveBlock = false,
}) => {
    const scoreBefore = violation.violation_score || 0;
    const scoreAfter = Math.max(0, scoreBefore + scoreChange);
    const previousStatus = deriveRiskStatus(
        scoreBefore,
        violation.booking_blocked_until,
        occurredAt
    );

    violation.violation_score = scoreAfter;
    violation.last_event_at = occurredAt;

    if (scoreChange > 0) {
        violation.last_violation_at = occurredAt;
        violation.last_recovery_at = null;
    }

    if (
        scoreChange > 0
        && scoreAfter >= BOOKING_VIOLATION_BLOCK_THRESHOLD
        && allowNewBlock
        && !isCustomerBlocked(violation, occurredAt)
    ) {
        const nextBlockCount = (violation.booking_block_count || 0) + 1;
        const blockDays = getBlockDurationDays(nextBlockCount);

        violation.booking_block_count = nextBlockCount;
        violation.booking_blocked_until = addDays(occurredAt, blockDays);
    }

    if (
        clearActiveBlock
        && scoreAfter < BOOKING_VIOLATION_BLOCK_THRESHOLD
        && scoreChange < 0
    ) {
        violation.booking_blocked_until = null;
    }

    violation.risk_status = deriveRiskStatus(
        scoreAfter,
        violation.booking_blocked_until,
        occurredAt
    );

    return {
        scoreBefore,
        scoreAfter,
        actualScoreChange: scoreAfter - scoreBefore,
        previousStatus,
    };
};

const recordViolationEvent = async ({
    booking,
    event,
    scoreChange: requestedScoreChange,
    reason,
    actorId,
    occurredAt = new Date(),
    session = null,
}) => {
    if (!shouldTrackBooking(booking)) {
        return {
            skipped: true,
            reason: 'BOOKING_NOT_TRACKABLE',
        };
    }

    const existingEvent = await findExistingEvent({
        bookingId: booking._id,
        event,
        session,
    });

    if (existingEvent) {
        return {
            already_processed: true,
            event: existingEvent,
        };
    }

    const scoreChange = requestedScoreChange ?? BOOKING_VIOLATION_SCORE[event];
    const violation = await getOrCreateCustomerViolation(booking.customer_id, session);
    const result = applyScoreChange({
        violation,
        scoreChange,
        occurredAt,
    });

    await violation.save(session ? { session } : undefined);

    const createdEvent = await createViolationEvent({
        booking,
        event,
        scoreChange: result.actualScoreChange,
        scoreBefore: result.scoreBefore,
        scoreAfter: result.scoreAfter,
        reason,
        actorId,
        session,
    });

    await notifyRiskTransition({
        customerId: booking.customer_id,
        previousStatus: result.previousStatus,
        violation,
        relatedId: booking._id,
        session,
    });

    return {
        violation,
        event: createdEvent,
        score_change: result.actualScoreChange,
        score_before: result.scoreBefore,
        score_after: result.scoreAfter,
    };
};

const getCancelScore = (booking, canceledAt = new Date()) => {
    if (!booking?.start_time) {
        return BOOKING_VIOLATION_SCORE.CANCEL;
    }

    const hoursUntilStart = (
        new Date(booking.start_time).getTime() - canceledAt.getTime()
    ) / HOURS_TO_MS;

    return hoursUntilStart < BOOKING_VIOLATION_LATE_CANCEL_HOURS
        ? BOOKING_VIOLATION_SCORE.LATE_CANCEL
        : BOOKING_VIOLATION_SCORE.CANCEL;
};

const isLateCancel = (booking, canceledAt = new Date()) => {
    return getCancelScore(booking, canceledAt) === BOOKING_VIOLATION_SCORE.LATE_CANCEL;
};

const recordCustomerCancellation = async ({
    booking,
    reason,
    actorId,
    canceledAt = new Date(),
    session = null,
}) => {
    const scoreChange = getCancelScore(booking, canceledAt);
    const primary = await recordViolationEvent({
        booking,
        event: BOOKING_VIOLATION_EVENTS.CANCEL,
        scoreChange,
        reason,
        actorId,
        occurredAt: canceledAt,
        session,
    });

    if (primary.skipped || primary.already_processed) {
        return primary;
    }

    const windowStart = addDays(canceledAt, -BOOKING_VIOLATION_REPEAT_CANCEL_DAYS);
    const windowEnd = new Date(Math.max(Date.now(), canceledAt.getTime()));
    const cancellationFilter = {
        customer_id: booking.customer_id,
        event: {
            $in: [
                BOOKING_VIOLATION_EVENTS.CANCEL,
                BOOKING_VIOLATION_EVENTS.LATE_CANCEL,
            ],
        },
        created_at: { $gte: windowStart, $lte: windowEnd },
        is_reversed: { $ne: true },
    };
    const recentCancelCount = await runQueryWithSession(
        BookingViolationEvent.countDocuments(cancellationFilter),
        session
    );

    if (recentCancelCount < BOOKING_VIOLATION_REPEAT_CANCEL_COUNT) {
        return {
            ...primary,
            repeated_cancel: null,
        };
    }

    const recentSurcharge = await runQueryWithSession(
        BookingViolationEvent.findOne({
            customer_id: booking.customer_id,
            event: BOOKING_VIOLATION_EVENTS.REPEATED_CANCEL,
            created_at: { $gte: windowStart, $lte: windowEnd },
            is_reversed: { $ne: true },
        }),
        session
    );

    if (recentSurcharge) {
        return {
            ...primary,
            repeated_cancel: {
                skipped: true,
                reason: 'REPEATED_CANCEL_ALREADY_APPLIED_IN_WINDOW',
            },
        };
    }

    const repeatedCancel = await recordViolationEvent({
        booking,
        event: BOOKING_VIOLATION_EVENTS.REPEATED_CANCEL,
        reason: `${BOOKING_VIOLATION_REPEAT_CANCEL_COUNT} cancellations within ${BOOKING_VIOLATION_REPEAT_CANCEL_DAYS} days`,
        actorId,
        occurredAt: canceledAt,
        session,
    });

    return {
        ...primary,
        repeated_cancel: repeatedCancel,
    };
};

const recordLateCancelIfNeeded = recordCustomerCancellation;

const recordNoShow = async ({ booking, reason, actorId, noShowAt = new Date(), session = null }) => {
    return recordViolationEvent({
        booking,
        event: BOOKING_VIOLATION_EVENTS.NO_SHOW,
        reason,
        actorId,
        occurredAt: noShowAt,
        session,
    });
};

const recordCompletedPaidBooking = async ({
    booking,
    actorId,
    completedAt = new Date(),
    session = null,
}) => {
    return recordViolationEvent({
        booking,
        event: BOOKING_VIOLATION_EVENTS.COMPLETED,
        reason: 'Completed paid booking',
        actorId,
        occurredAt: booking?.paid_at || booking?.completed_at || completedAt,
        session,
    });
};

const getMyStatus = async (customerId) => {
    const violation = await getOrCreateCustomerViolation(customerId);

    return toStatusDto(violation);
};

const toEventDto = (event) => {
    const plain = event?.toObject ? event.toObject() : event;

    return {
        id: plain._id?.toString() || plain.id,
        source: 'BOOKING_EVENT',
        booking_id: plain.booking_id?._id?.toString()
            || plain.booking_id?.toString?.()
            || null,
        booking_code: plain.booking_id?.booking_code || null,
        event: plain.event,
        score_change: plain.score_change,
        score_before: plain.score_before,
        score_after: plain.score_after,
        reason: plain.reason || null,
        is_reversed: Boolean(plain.is_reversed),
        reversal_reason: plain.reversal_reason || null,
        created_at: plain.created_at,
    };
};

const toAdjustmentDto = (adjustment) => {
    const plain = adjustment?.toObject ? adjustment.toObject() : adjustment;

    return {
        id: plain._id?.toString() || plain.id,
        source: 'ADJUSTMENT',
        event: plain.type,
        score_change: plain.score_change,
        score_before: plain.score_before,
        score_after: plain.score_after,
        reason: plain.reason,
        created_by: toCustomerSummary(plain.created_by),
        created_at: plain.created_at,
    };
};

const getHistory = async (customerId, { page = 1, limit = 20 } = {}) => {
    const fetchLimit = Math.min(page * limit, 500);
    const [events, adjustments, eventTotal, adjustmentTotal] = await Promise.all([
        BookingViolationEvent.find({ customer_id: customerId })
            .populate('booking_id', 'booking_code')
            .sort({ created_at: -1 })
            .limit(fetchLimit)
            .lean(),
        BookingViolationAdjustment.find({ customer_id: customerId })
            .populate('created_by', 'full_name email phone avatar_url is_active')
            .sort({ created_at: -1 })
            .limit(fetchLimit)
            .lean(),
        BookingViolationEvent.countDocuments({ customer_id: customerId }),
        BookingViolationAdjustment.countDocuments({ customer_id: customerId }),
    ]);
    const combined = [
        ...events.map(toEventDto),
        ...adjustments.map(toAdjustmentDto),
    ].sort((left, right) => new Date(right.created_at) - new Date(left.created_at));
    const total = eventTotal + adjustmentTotal;
    const skip = (page - 1) * limit;

    return {
        data: combined.slice(skip, skip + limit),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

const toAppealDto = (appeal) => {
    const plain = appeal?.toObject ? appeal.toObject() : appeal;

    return {
        id: plain._id?.toString() || plain.id,
        customer_id: plain.customer_id?._id?.toString()
            || plain.customer_id?.toString?.()
            || null,
        customer: toCustomerSummary(plain.customer_id),
        event: plain.event_id ? toEventDto(plain.event_id) : null,
        reason: plain.reason,
        status: plain.status,
        admin_note: plain.admin_note || null,
        reviewed_by: toCustomerSummary(plain.reviewed_by),
        reviewed_at: plain.reviewed_at || null,
        resolution_score_change: plain.resolution_score_change || 0,
        created_at: plain.created_at,
        updated_at: plain.updated_at,
    };
};

const getAppeals = async ({
    customerId = null,
    status = null,
    page = 1,
    limit = 20,
} = {}) => {
    const filter = {};

    if (customerId) {
        filter.customer_id = customerId;
    }

    if (status) {
        filter.status = status;
    }

    const [appeals, total] = await Promise.all([
        BookingViolationAppeal.find(filter)
            .populate('customer_id', 'full_name phone email avatar_url is_active')
            .populate({
                path: 'event_id',
                populate: { path: 'booking_id', select: 'booking_code' },
            })
            .populate('reviewed_by', 'full_name phone email avatar_url is_active')
            .sort({ created_at: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
        BookingViolationAppeal.countDocuments(filter),
    ]);

    return {
        data: appeals.map(toAppealDto),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

const createAppeal = async ({ customerId, eventId, reason }) => {
    const event = await BookingViolationEvent.findOne({
        _id: eventId,
        customer_id: customerId,
        score_change: { $gt: 0 },
        is_reversed: { $ne: true },
    });

    if (!event) {
        throw new AppError(
            'Booking violation event is not appealable',
            404,
            'BOOKING_VIOLATION_EVENT_NOT_APPEALABLE'
        );
    }

    const existingAppeal = await BookingViolationAppeal.findOne({ event_id: eventId });

    if (existingAppeal) {
        throw new AppError(
            'An appeal already exists for this event',
            409,
            'BOOKING_VIOLATION_APPEAL_EXISTS'
        );
    }

    const appeal = await BookingViolationAppeal.create({
        customer_id: customerId,
        event_id: eventId,
        reason,
    });

    await appeal.populate({
        path: 'event_id',
        populate: { path: 'booking_id', select: 'booking_code' },
    });

    return toAppealDto(appeal);
};

const getRiskFilter = (riskStatus, now) => {
    if (riskStatus === BOOKING_VIOLATION_RISK_STATUSES.BLOCKED) {
        return { booking_blocked_until: { $gt: now } };
    }

    if (riskStatus === BOOKING_VIOLATION_RISK_STATUSES.DEPOSIT_REQUIRED) {
        return {
            violation_score: {
                $gte: BOOKING_VIOLATION_DEPOSIT_THRESHOLD,
            },
            $or: [
                { booking_blocked_until: null },
                { booking_blocked_until: { $lte: now } },
            ],
        };
    }

    if (riskStatus === BOOKING_VIOLATION_RISK_STATUSES.WARNING) {
        return {
            violation_score: {
                $gte: BOOKING_VIOLATION_WARNING_THRESHOLD,
                $lt: BOOKING_VIOLATION_DEPOSIT_THRESHOLD,
            },
        };
    }

    if (riskStatus === BOOKING_VIOLATION_RISK_STATUSES.NORMAL) {
        return {
            violation_score: { $lt: BOOKING_VIOLATION_WARNING_THRESHOLD },
        };
    }

    return {};
};

const listAdminCustomers = async ({
    risk_status,
    search,
    page = 1,
    limit = 20,
} = {}) => {
    const now = new Date();
    const filter = getRiskFilter(risk_status, now);

    if (search) {
        const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const customers = await User.find({
            role: USER_ROLES.CUSTOMER,
            $or: [
                { full_name: regex },
                { phone: regex },
                { email: regex },
            ],
        }).select('_id').lean();

        filter.customer_id = { $in: customers.map((customer) => customer._id) };
    }

    const [violations, total] = await Promise.all([
        CustomerBookingViolation.find(filter)
            .populate('customer_id', 'full_name phone email avatar_url is_active')
            .sort({ violation_score: -1, last_event_at: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
        CustomerBookingViolation.countDocuments(filter),
    ]);

    return {
        data: violations.map((violation) => toStatusDto(violation, now)),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

const getAdminCustomerDetail = async (customerId, historyQuery = {}) => {
    const customer = await User.findOne({
        _id: customerId,
        role: USER_ROLES.CUSTOMER,
    }).select('full_name phone email avatar_url is_active');

    if (!customer) {
        throw new AppError('Customer not found', 404, 'CUSTOMER_NOT_FOUND');
    }

    const violation = await getOrCreateCustomerViolation(customerId);
    const violationWithCustomer = {
        ...violation.toObject(),
        customer_id: customer.toObject(),
    };
    const [history, appeals] = await Promise.all([
        getHistory(customerId, historyQuery),
        getAppeals({ customerId, page: 1, limit: 100 }),
    ]);

    return {
        status: toStatusDto(violationWithCustomer),
        history: history.data,
        history_meta: history.meta,
        appeals: appeals.data,
    };
};

const createAdjustmentDocument = async ({
    customerId,
    type,
    scoreChange,
    scoreBefore,
    scoreAfter,
    reason,
    referenceId = null,
    actorId = null,
    session = null,
}) => {
    const documents = await BookingViolationAdjustment.create(
        [
            {
                customer_id: customerId,
                type,
                score_change: scoreChange,
                score_before: scoreBefore,
                score_after: scoreAfter,
                reason,
                reference_id: referenceId,
                created_by: actorId,
            },
        ],
        session ? { session } : undefined
    );

    return documents[0];
};

const adjustCustomerScore = async ({
    customerId,
    scoreChange,
    reason,
    adminId,
    auditContext = {},
}) => {
    const customer = await User.findOne({
        _id: customerId,
        role: USER_ROLES.CUSTOMER,
    }).select('_id');

    if (!customer) {
        throw new AppError('Customer not found', 404, 'CUSTOMER_NOT_FOUND');
    }

    const session = await mongoose.startSession();
    let response;

    try {
        await session.withTransaction(async () => {
            const violation = await getOrCreateCustomerViolation(customerId, session);
            const scoreBefore = violation.violation_score || 0;
            const state = applyScoreChange({
                violation,
                scoreChange,
                occurredAt: new Date(),
                clearActiveBlock: true,
            });

            if (state.actualScoreChange === 0) {
                throw new AppError(
                    'Adjustment does not change the current score',
                    400,
                    'BOOKING_VIOLATION_ADJUSTMENT_NO_CHANGE'
                );
            }

            await violation.save({ session });
            const adjustment = await createAdjustmentDocument({
                customerId,
                type: BOOKING_VIOLATION_ADJUSTMENT_TYPES.ADMIN_ADJUSTMENT,
                scoreChange: state.actualScoreChange,
                scoreBefore,
                scoreAfter: state.scoreAfter,
                reason,
                actorId: adminId,
                session,
            });

            await auditLogService.recordAuditEvent({
                actorId: adminId,
                action: AUDIT_ACTIONS.BOOKING_VIOLATION_ADJUSTED,
                resourceType: AUDIT_RESOURCE_TYPES.BOOKING_VIOLATION,
                resourceId: violation._id,
                before: { violation_score: scoreBefore },
                after: {
                    violation_score: state.scoreAfter,
                    risk_status: violation.risk_status,
                    booking_blocked_until: violation.booking_blocked_until,
                },
                metadata: { reason, adjustment_id: adjustment._id },
                ip: auditContext.ip,
                userAgent: auditContext.userAgent,
                session,
            });

            await notifyRiskTransition({
                customerId,
                previousStatus: state.previousStatus,
                violation,
                relatedId: violation._id,
                session,
            });

            response = {
                status: toStatusDto(violation),
                adjustment: toAdjustmentDto(adjustment),
            };
        });
    } finally {
        await session.endSession();
    }

    return response;
};

const reviewAppeal = async ({
    appealId,
    status,
    adminNote,
    adminId,
    auditContext = {},
}) => {
    const session = await mongoose.startSession();
    let response;

    try {
        await session.withTransaction(async () => {
            const appeal = await BookingViolationAppeal.findById(appealId).session(session);

            if (!appeal) {
                throw new AppError(
                    'Booking violation appeal not found',
                    404,
                    'BOOKING_VIOLATION_APPEAL_NOT_FOUND'
                );
            }

            if (appeal.status !== BOOKING_VIOLATION_APPEAL_STATUSES.PENDING) {
                throw new AppError(
                    'Booking violation appeal has already been reviewed',
                    409,
                    'BOOKING_VIOLATION_APPEAL_ALREADY_REVIEWED'
                );
            }

            const now = new Date();
            let resolutionScoreChange = 0;

            if (status === BOOKING_VIOLATION_APPEAL_STATUSES.APPROVED) {
                const event = await BookingViolationEvent.findOne({
                    _id: appeal.event_id,
                    customer_id: appeal.customer_id,
                    score_change: { $gt: 0 },
                    is_reversed: { $ne: true },
                }).session(session);

                if (!event) {
                    throw new AppError(
                        'Booking violation event is no longer reversible',
                        409,
                        'BOOKING_VIOLATION_EVENT_NOT_REVERSIBLE'
                    );
                }

                const violation = await getOrCreateCustomerViolation(appeal.customer_id, session);
                const state = applyScoreChange({
                    violation,
                    scoreChange: -event.score_change,
                    occurredAt: now,
                    allowNewBlock: false,
                    clearActiveBlock: true,
                });

                resolutionScoreChange = state.actualScoreChange;
                event.is_reversed = true;
                event.reversed_at = now;
                event.reversed_by = adminId;
                event.reversal_reason = adminNote;

                await event.save({ session });
                await violation.save({ session });
                await createAdjustmentDocument({
                    customerId: appeal.customer_id,
                    type: BOOKING_VIOLATION_ADJUSTMENT_TYPES.APPEAL_REVERSAL,
                    scoreChange: resolutionScoreChange,
                    scoreBefore: state.scoreBefore,
                    scoreAfter: state.scoreAfter,
                    reason: adminNote,
                    referenceId: appeal._id,
                    actorId: adminId,
                    session,
                });
            }

            appeal.status = status;
            appeal.admin_note = adminNote;
            appeal.reviewed_by = adminId;
            appeal.reviewed_at = now;
            appeal.resolution_score_change = resolutionScoreChange;
            await appeal.save({ session });

            await auditLogService.recordAuditEvent({
                actorId: adminId,
                action: AUDIT_ACTIONS.BOOKING_VIOLATION_APPEAL_REVIEWED,
                resourceType: AUDIT_RESOURCE_TYPES.BOOKING_VIOLATION_APPEAL,
                resourceId: appeal._id,
                before: { status: BOOKING_VIOLATION_APPEAL_STATUSES.PENDING },
                after: {
                    status,
                    resolution_score_change: resolutionScoreChange,
                },
                metadata: { admin_note: adminNote },
                ip: auditContext.ip,
                userAgent: auditContext.userAgent,
                session,
            });

            await notificationService.createInAppNotification({
                userId: appeal.customer_id,
                type: NOTIFICATION_TYPES.BOOKING_VIOLATION_APPEAL_RESOLVED,
                title: status === BOOKING_VIOLATION_APPEAL_STATUSES.APPROVED
                    ? 'Khiếu nại điểm vi phạm đã được chấp nhận'
                    : 'Khiếu nại điểm vi phạm đã được xem xét',
                message: adminNote,
                relatedType: NOTIFICATION_RELATED_TYPES.BOOKING_VIOLATION_APPEAL,
                relatedId: appeal._id,
                metadata: {
                    status,
                    resolution_score_change: resolutionScoreChange,
                },
                session,
            });

            await appeal.populate([
                {
                    path: 'event_id',
                    populate: { path: 'booking_id', select: 'booking_code' },
                },
                {
                    path: 'reviewed_by',
                    select: 'full_name phone email avatar_url is_active',
                },
            ]);
            response = toAppealDto(appeal);
        });
    } finally {
        await session.endSession();
    }

    return response;
};

const processInactivityRecovery = async ({ limit = 100, now = new Date() } = {}) => {
    const cutoff = addDays(now, -BOOKING_VIOLATION_RECOVERY_DAYS);
    const candidates = await CustomerBookingViolation.find({
        violation_score: { $gt: 0 },
        last_violation_at: { $lte: cutoff },
        $or: [
            { last_recovery_at: null },
            { last_recovery_at: { $lte: cutoff } },
        ],
    })
        .sort({ last_violation_at: 1 })
        .limit(Math.max(1, Math.min(limit, 500)))
        .lean();
    let recovered = 0;

    for (const candidate of candidates) {
        const scoreAfter = Math.max(0, candidate.violation_score - 1);
        const riskStatus = deriveRiskStatus(scoreAfter, candidate.booking_blocked_until, now);
        const updated = await CustomerBookingViolation.findOneAndUpdate(
            {
                _id: candidate._id,
                violation_score: candidate.violation_score,
                last_recovery_at: candidate.last_recovery_at || null,
            },
            {
                $set: {
                    violation_score: scoreAfter,
                    risk_status: riskStatus,
                    last_recovery_at: now,
                    last_event_at: now,
                    ...(scoreAfter < BOOKING_VIOLATION_BLOCK_THRESHOLD
                        ? { booking_blocked_until: null }
                        : {}),
                },
            },
            { new: true }
        );

        if (!updated) {
            continue;
        }

        await createAdjustmentDocument({
            customerId: candidate.customer_id,
            type: BOOKING_VIOLATION_ADJUSTMENT_TYPES.INACTIVITY_RECOVERY,
            scoreChange: -1,
            scoreBefore: candidate.violation_score,
            scoreAfter,
            reason: `No booking violations for ${BOOKING_VIOLATION_RECOVERY_DAYS} days`,
            referenceId: candidate._id,
        });
        recovered += 1;
    }

    return {
        examined: candidates.length,
        recovered,
    };
};

module.exports = {
    getOrCreateCustomerViolation,
    assertCustomerCanCreateBooking,
    recordViolationEvent,
    recordCustomerCancellation,
    recordLateCancelIfNeeded,
    recordNoShow,
    recordCompletedPaidBooking,
    getCancelScore,
    isLateCancel,
    deriveRiskStatus,
    toStatusDto,
    getMyStatus,
    getHistory,
    getAppeals,
    createAppeal,
    listAdminCustomers,
    getAdminCustomerDetail,
    adjustCustomerScore,
    reviewAppeal,
    processInactivityRecovery,
};
