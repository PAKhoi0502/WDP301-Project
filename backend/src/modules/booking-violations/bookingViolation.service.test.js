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
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
}));

jest.mock('./bookingViolationEvent.model', () => ({
    findOne: jest.fn(),
    create: jest.fn(),
    countDocuments: jest.fn(),
}));

jest.mock('./bookingViolationAdjustment.model', () => ({
    create: jest.fn(),
}));
jest.mock('./bookingViolationAppeal.model', () => ({}));
jest.mock('../users/user.model', () => ({}));
jest.mock('../notifications/notification.service', () => ({
    createInAppNotification: jest.fn(),
}));
jest.mock('../audit-logs/auditLog.service', () => ({
    recordAuditEvent: jest.fn(),
}));

const CustomerBookingViolation = require('./customerBookingViolation.model');
const BookingViolationEvent = require('./bookingViolationEvent.model');
const BookingViolationAdjustment = require('./bookingViolationAdjustment.model');
const notificationService = require('../notifications/notification.service');
const bookingViolationService = require('./bookingViolation.service');

const createViolationDocument = (overrides = {}) => ({
    _id: new mongoose.Types.ObjectId(),
    customer_id: new mongoose.Types.ObjectId(),
    violation_score: 0,
    risk_status: 'NORMAL',
    booking_blocked_until: null,
    booking_block_count: 0,
    last_violation_at: null,
    last_event_at: null,
    last_recovery_at: null,
    save: jest.fn().mockResolvedValue(null),
    ...overrides,
});

describe('booking violation service', () => {
    const customerId = new mongoose.Types.ObjectId();
    const bookingId = new mongoose.Types.ObjectId();
    const actorId = new mongoose.Types.ObjectId();

    beforeEach(() => {
        jest.clearAllMocks();
        notificationService.createInAppNotification.mockResolvedValue(null);
        BookingViolationEvent.countDocuments.mockResolvedValue(1);
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
                risk_status: 'BLOCKED',
                booking_blocked_until: blockedUntil,
                booking_block_count: 1,
            },
        });
    });

    it('adds 2 points for a cancellation under 2 hours and applies the first 3-day block', async () => {
        const canceledAt = new Date('2026-06-29T08:30:00.000Z');
        const booking = {
            _id: bookingId,
            customer_id: customerId,
            is_walk_in: false,
            start_time: new Date('2026-06-29T09:00:00.000Z'),
        };
        const violation = createViolationDocument({
            customer_id: customerId,
            violation_score: 4,
            risk_status: 'WARNING',
        });

        BookingViolationEvent.findOne.mockReturnValue(createQueryMock(null));
        CustomerBookingViolation.findOne.mockReturnValue(createQueryMock(violation));
        BookingViolationEvent.create.mockImplementation(async ([payload]) => [{
            _id: new mongoose.Types.ObjectId(),
            ...payload,
        }]);

        const result = await bookingViolationService.recordCustomerCancellation({
            booking,
            reason: 'Customer canceled near start time',
            actorId,
            canceledAt,
        });

        expect(violation.violation_score).toBe(6);
        expect(violation.booking_block_count).toBe(1);
        expect(violation.booking_blocked_until.toISOString()).toBe('2026-07-02T08:30:00.000Z');
        expect(BookingViolationEvent.create).toHaveBeenCalledWith(
            [
                expect.objectContaining({
                    event: 'CANCEL',
                    score_change: 2,
                    score_before: 4,
                    score_after: 6,
                }),
            ],
            undefined
        );
        expect(result).toMatchObject({
            score_change: 2,
            score_before: 4,
            score_after: 6,
            repeated_cancel: null,
        });
    });

    it('still adds 1 point for a cancellation more than 6 hours before start', async () => {
        const canceledAt = new Date('2026-06-29T08:30:00.000Z');
        const violation = createViolationDocument({
            customer_id: customerId,
            violation_score: 1,
        });

        BookingViolationEvent.findOne.mockReturnValue(createQueryMock(null));
        CustomerBookingViolation.findOne.mockReturnValue(createQueryMock(violation));
        BookingViolationEvent.create.mockImplementation(async ([payload]) => [{
            _id: new mongoose.Types.ObjectId(),
            ...payload,
        }]);

        const result = await bookingViolationService.recordCustomerCancellation({
            booking: {
                _id: bookingId,
                customer_id: customerId,
                is_walk_in: false,
                start_time: new Date('2026-06-29T16:00:00.000Z'),
            },
            actorId,
            canceledAt,
        });

        expect(result.score_change).toBe(1);
        expect(result.score_after).toBe(2);
        expect(violation.violation_score).toBe(2);
    });

    it('adds 3 points for no-show', async () => {
        const violation = createViolationDocument({
            customer_id: customerId,
            violation_score: 0,
        });

        BookingViolationEvent.findOne.mockReturnValue(createQueryMock(null));
        CustomerBookingViolation.findOne.mockReturnValue(createQueryMock(violation));
        BookingViolationEvent.create.mockImplementation(async ([payload]) => [{
            _id: new mongoose.Types.ObjectId(),
            ...payload,
        }]);

        const result = await bookingViolationService.recordNoShow({
            booking: {
                _id: bookingId,
                customer_id: customerId,
                is_walk_in: false,
            },
            actorId,
        });

        expect(result.score_change).toBe(3);
        expect(result.score_after).toBe(3);
        expect(violation.risk_status).toBe('WARNING');
    });

    it('adds a single 2-point surcharge for the third cancellation within 7 days', async () => {
        const canceledAt = new Date('2026-06-29T08:30:00.000Z');
        const violation = createViolationDocument({
            customer_id: customerId,
            violation_score: 1,
        });

        BookingViolationEvent.findOne.mockReturnValue(createQueryMock(null));
        BookingViolationEvent.countDocuments.mockResolvedValue(3);
        CustomerBookingViolation.findOne.mockReturnValue(createQueryMock(violation));
        BookingViolationEvent.create.mockImplementation(async ([payload]) => [{
            _id: new mongoose.Types.ObjectId(),
            ...payload,
        }]);

        const result = await bookingViolationService.recordCustomerCancellation({
            booking: {
                _id: bookingId,
                customer_id: customerId,
                is_walk_in: false,
                start_time: new Date('2026-06-29T16:00:00.000Z'),
            },
            actorId,
            canceledAt,
        });

        expect(BookingViolationEvent.create).toHaveBeenCalledTimes(2);
        expect(BookingViolationEvent.create).toHaveBeenNthCalledWith(
            2,
            [
                expect.objectContaining({
                    event: 'REPEATED_CANCEL',
                    score_change: 2,
                    score_before: 2,
                    score_after: 4,
                }),
            ],
            undefined
        );
        expect(result.repeated_cancel).toMatchObject({
            score_change: 2,
            score_after: 4,
        });
        expect(violation.violation_score).toBe(4);
    });

    it('recovers 1 point after 60 days without a violation', async () => {
        const now = new Date('2026-06-29T08:30:00.000Z');
        const candidate = {
            _id: new mongoose.Types.ObjectId(),
            customer_id: customerId,
            violation_score: 3,
            booking_blocked_until: null,
            last_violation_at: new Date('2026-04-20T08:30:00.000Z'),
            last_recovery_at: null,
        };
        const findQuery = {
            sort: jest.fn(),
            limit: jest.fn(),
            lean: jest.fn(),
        };

        findQuery.sort.mockReturnValue(findQuery);
        findQuery.limit.mockReturnValue(findQuery);
        findQuery.lean.mockResolvedValue([candidate]);
        CustomerBookingViolation.find.mockReturnValue(findQuery);
        CustomerBookingViolation.findOneAndUpdate.mockResolvedValue({
            ...candidate,
            violation_score: 2,
            risk_status: 'NORMAL',
            last_recovery_at: now,
        });
        BookingViolationAdjustment.create.mockImplementation(async ([payload]) => [{
            _id: new mongoose.Types.ObjectId(),
            ...payload,
        }]);

        const result = await bookingViolationService.processInactivityRecovery({
            now,
            limit: 10,
        });

        expect(result).toEqual({ examined: 1, recovered: 1 });
        expect(CustomerBookingViolation.findOneAndUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                _id: candidate._id,
                violation_score: 3,
            }),
            expect.objectContaining({
                $set: expect.objectContaining({
                    violation_score: 2,
                    risk_status: 'NORMAL',
                    last_recovery_at: now,
                }),
            }),
            { new: true }
        );
        expect(BookingViolationAdjustment.create).toHaveBeenCalledWith(
            [
                expect.objectContaining({
                    type: 'INACTIVITY_RECOVERY',
                    score_change: -1,
                    score_before: 3,
                    score_after: 2,
                }),
            ],
            undefined
        );
    });

    it('does not reduce a completed paid booking below zero', async () => {
        const violation = createViolationDocument({
            customer_id: customerId,
            violation_score: 0,
        });

        BookingViolationEvent.findOne.mockReturnValue(createQueryMock(null));
        CustomerBookingViolation.findOne.mockReturnValue(createQueryMock(violation));
        BookingViolationEvent.create.mockImplementation(async ([payload]) => [{
            _id: new mongoose.Types.ObjectId(),
            ...payload,
        }]);

        const result = await bookingViolationService.recordCompletedPaidBooking({
            booking: {
                _id: bookingId,
                customer_id: customerId,
                is_walk_in: false,
                paid_at: new Date('2026-06-29T10:00:00.000Z'),
            },
            actorId,
        });

        expect(violation.violation_score).toBe(0);
        expect(result.score_change).toBe(0);
        expect(result.score_after).toBe(0);
    });
});
