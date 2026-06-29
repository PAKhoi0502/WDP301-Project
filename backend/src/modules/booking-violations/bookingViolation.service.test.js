const mongoose = require('mongoose');

const createQueryMock = (value) => {
    const query = {
        session: jest.fn(() => query),
        lean: jest.fn(() => Promise.resolve(value)),
        then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
        catch: (reject) => Promise.resolve(value).catch(reject),
    };

    return query;
};

jest.mock('./customerBookingViolation.model', () => ({
    findOne: jest.fn(),
    create: jest.fn(),
}));

jest.mock('./bookingViolationEvent.model', () => ({
    findOne: jest.fn(),
    create: jest.fn(),
}));

const CustomerBookingViolation = require('./customerBookingViolation.model');
const BookingViolationEvent = require('./bookingViolationEvent.model');
const bookingViolationService = require('./bookingViolation.service');

const createViolationDocument = (overrides = {}) => ({
    _id: new mongoose.Types.ObjectId(),
    customer_id: new mongoose.Types.ObjectId(),
    violation_score: 0,
    booking_blocked_until: null,
    booking_block_count: 0,
    last_violation_at: null,
    last_event_at: null,
    save: jest.fn().mockResolvedValue(null),
    ...overrides,
});

describe('booking violation service', () => {
    const customerId = new mongoose.Types.ObjectId();
    const bookingId = new mongoose.Types.ObjectId();
    const actorId = new mongoose.Types.ObjectId();

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    it('blocks customer booking creation while block window is active', async () => {
        const blockedUntil = new Date('2026-06-30T10:00:00.000Z');

        CustomerBookingViolation.findOne.mockReturnValue(createQueryMock({
            customer_id: customerId,
            violation_score: 6,
            booking_blocked_until: blockedUntil,
            booking_block_count: 1,
        }));

        await expect(bookingViolationService.assertCustomerCanCreateBooking(
            customerId,
            new Date('2026-06-29T10:00:00.000Z')
        )).rejects.toMatchObject({
            statusCode: 403,
            errorCode: 'CUSTOMER_BOOKING_BLOCKED',
            errors: {
                violation_score: 6,
                booking_blocked_until: blockedUntil,
                booking_block_count: 1,
            },
        });
    });

    it('records late cancel and applies the first 3-day booking block at threshold', async () => {
        const now = new Date('2026-06-29T08:30:00.000Z');
        const booking = {
            _id: bookingId,
            customer_id: customerId,
            is_walk_in: false,
            start_time: new Date('2026-06-29T09:00:00.000Z'),
        };
        const violation = createViolationDocument({
            customer_id: customerId,
            violation_score: 5,
        });
        const createdEvent = {
            _id: new mongoose.Types.ObjectId(),
            booking_id: bookingId,
            customer_id: customerId,
            event: 'LATE_CANCEL',
            score_change: 1,
            score_before: 5,
            score_after: 6,
        };

        BookingViolationEvent.findOne.mockReturnValue(createQueryMock(null));
        CustomerBookingViolation.findOne.mockReturnValue(createQueryMock(violation));
        BookingViolationEvent.create.mockResolvedValue([createdEvent]);

        const result = await bookingViolationService.recordLateCancelIfNeeded({
            booking,
            reason: 'Customer canceled near start time',
            actorId,
            canceledAt: now,
        });

        expect(violation.violation_score).toBe(6);
        expect(violation.booking_block_count).toBe(1);
        expect(violation.booking_blocked_until.toISOString()).toBe('2026-07-02T08:30:00.000Z');
        expect(BookingViolationEvent.create).toHaveBeenCalledWith(
            [
                expect.objectContaining({
                    booking_id: bookingId,
                    customer_id: customerId,
                    event: 'LATE_CANCEL',
                    score_change: 1,
                    score_before: 5,
                    score_after: 6,
                    reason: 'Customer canceled near start time',
                    created_by: actorId,
                }),
            ],
            undefined
        );
        expect(result).toMatchObject({
            score_change: 1,
            score_before: 5,
            score_after: 6,
        });
    });

    it('skips early cancel outside the late cancel window', async () => {
        const result = await bookingViolationService.recordLateCancelIfNeeded({
            booking: {
                _id: bookingId,
                customer_id: customerId,
                is_walk_in: false,
                start_time: new Date('2026-06-29T12:00:00.000Z'),
            },
            actorId,
            canceledAt: new Date('2026-06-29T08:30:00.000Z'),
        });

        expect(result).toEqual({
            skipped: true,
            reason: 'NOT_LATE_CANCEL',
        });
        expect(BookingViolationEvent.create).not.toHaveBeenCalled();
    });

    it('reduces score for completed paid booking without going below zero', async () => {
        const booking = {
            _id: bookingId,
            customer_id: customerId,
            is_walk_in: false,
            paid_at: new Date('2026-06-29T10:00:00.000Z'),
        };
        const violation = createViolationDocument({
            customer_id: customerId,
            violation_score: 0,
        });

        BookingViolationEvent.findOne.mockReturnValue(createQueryMock(null));
        CustomerBookingViolation.findOne.mockReturnValue(createQueryMock(violation));
        BookingViolationEvent.create.mockResolvedValue([
            {
                _id: new mongoose.Types.ObjectId(),
                event: 'COMPLETED',
                score_change: -1,
                score_before: 0,
                score_after: 0,
            },
        ]);

        const result = await bookingViolationService.recordCompletedPaidBooking({
            booking,
            actorId,
        });

        expect(violation.violation_score).toBe(0);
        expect(BookingViolationEvent.create).toHaveBeenCalledWith(
            [
                expect.objectContaining({
                    event: 'COMPLETED',
                    score_change: -1,
                    score_before: 0,
                    score_after: 0,
                }),
            ],
            undefined
        );
        expect(result.score_after).toBe(0);
    });
});
