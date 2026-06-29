const CustomerBookingViolation = require('./customerBookingViolation.model');
const BookingViolationEvent = require('./bookingViolationEvent.model');
const {
    BOOKING_VIOLATION_EVENTS,
    BOOKING_VIOLATION_SCORE,
    BOOKING_VIOLATION_LATE_CANCEL_HOURS,
    BOOKING_VIOLATION_BLOCK_THRESHOLD,
    BOOKING_VIOLATION_BLOCK_DAYS,
} = require('./bookingViolation.constant');
const { AppError } = require('../../shared/utils/appError');

const HOURS_TO_MS = 60 * 60 * 1000;
const DAYS_TO_MS = 24 * 60 * 60 * 1000;

const addDays = (date, days) => {
    return new Date(date.getTime() + days * DAYS_TO_MS);
};

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

const getOrCreateCustomerViolation = async (customerId, session = null) => {
    const existingQuery = CustomerBookingViolation.findOne({ customer_id: customerId });
    const existingViolation = await runQueryWithSession(existingQuery, session);

    if (existingViolation) {
        return existingViolation;
    }

    const documents = await CustomerBookingViolation.create(
        [
            {
                customer_id: customerId,
                violation_score: 0,
                booking_blocked_until: null,
                booking_block_count: 0,
                last_violation_at: null,
                last_event_at: null,
            },
        ],
        session ? { session } : undefined
    );

    return documents[0];
};

const isCustomerBlocked = (violation, now = new Date()) => {
    return Boolean(violation?.booking_blocked_until && violation.booking_blocked_until > now);
};

const assertCustomerCanCreateBooking = async (customerId, now = new Date()) => {
    const violation = await CustomerBookingViolation.findOne({ customer_id: customerId }).lean();

    if (!isCustomerBlocked(violation, now)) {
        return {
            allowed: true,
            violation,
        };
    }

    throw new AppError(
        'Customer is temporarily blocked from creating bookings',
        403,
        'CUSTOMER_BOOKING_BLOCKED',
        {
            violation_score: violation.violation_score,
            booking_blocked_until: violation.booking_blocked_until,
            booking_block_count: violation.booking_block_count,
        }
    );
};

const shouldTrackBooking = (booking) => {
    return Boolean(booking?._id && booking?.customer_id && !booking?.is_walk_in);
};

const findExistingEvent = async ({ bookingId, event, session = null }) => {
    const query = BookingViolationEvent.findOne({
        booking_id: bookingId,
        event,
    });

    return runQueryWithSession(query, session);
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

const recordViolationEvent = async ({
    booking,
    event,
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

    const scoreChange = BOOKING_VIOLATION_SCORE[event];
    const violation = await getOrCreateCustomerViolation(booking.customer_id, session);
    const scoreBefore = violation.violation_score || 0;
    const scoreAfter = Math.max(0, scoreBefore + scoreChange);

    violation.violation_score = scoreAfter;
    violation.last_event_at = occurredAt;

    if (scoreChange > 0) {
        violation.last_violation_at = occurredAt;
    }

    if (scoreChange > 0 && scoreAfter >= BOOKING_VIOLATION_BLOCK_THRESHOLD) {
        const nextBlockCount = (violation.booking_block_count || 0) + 1;
        const blockDays = getBlockDurationDays(nextBlockCount);

        violation.booking_block_count = nextBlockCount;
        violation.booking_blocked_until = addDays(occurredAt, blockDays);
    }

    await violation.save(session ? { session } : undefined);

    const createdEvent = await createViolationEvent({
        booking,
        event,
        scoreChange,
        scoreBefore,
        scoreAfter,
        reason,
        actorId,
        session,
    });

    return {
        violation,
        event: createdEvent,
        score_change: scoreChange,
        score_before: scoreBefore,
        score_after: scoreAfter,
    };
};

const isLateCancel = (booking, canceledAt = new Date()) => {
    if (!booking?.start_time) {
        return false;
    }

    const lateCancelStartsAt = new Date(
        new Date(booking.start_time).getTime() - BOOKING_VIOLATION_LATE_CANCEL_HOURS * HOURS_TO_MS
    );

    return canceledAt >= lateCancelStartsAt;
};

const recordLateCancelIfNeeded = async ({ booking, reason, actorId, canceledAt = new Date(), session = null }) => {
    if (!isLateCancel(booking, canceledAt)) {
        return {
            skipped: true,
            reason: 'NOT_LATE_CANCEL',
        };
    }

    return recordViolationEvent({
        booking,
        event: BOOKING_VIOLATION_EVENTS.LATE_CANCEL,
        reason,
        actorId,
        occurredAt: canceledAt,
        session,
    });
};

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

const recordCompletedPaidBooking = async ({ booking, actorId, completedAt = new Date(), session = null }) => {
    return recordViolationEvent({
        booking,
        event: BOOKING_VIOLATION_EVENTS.COMPLETED,
        reason: 'Completed paid booking',
        actorId,
        occurredAt: booking?.paid_at || booking?.completed_at || completedAt,
        session,
    });
};

module.exports = {
    getOrCreateCustomerViolation,
    assertCustomerCanCreateBooking,
    recordViolationEvent,
    recordLateCancelIfNeeded,
    recordNoShow,
    recordCompletedPaidBooking,
    isLateCancel,
};
