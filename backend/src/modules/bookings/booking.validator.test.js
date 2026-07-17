const {
    getAvailableSlotsSchema,
    getLateArrivalOptionsSchema,
    resolveLateArrivalSchema,
    createWalkInBookingSchema,
    serviceItemOperationSchema,
    pauseServiceItemSchema,
} = require('./booking.validator');

describe('booking available slots validator', () => {
    const baseQuery = {
        garage_id: '507f1f77bcf86cd799439011',
        service_package_id: '507f1f77bcf86cd799439012',
    };

    it('accepts the legacy single-date query', () => {
        const result = getAvailableSlotsSchema.safeParse({
            query: {
                ...baseQuery,
                date: '2026-06-11',
            },
        });

        expect(result.success).toBe(true);
    });

    it('accepts a seven-day range query with a vehicle', () => {
        const result = getAvailableSlotsSchema.safeParse({
            query: {
                ...baseQuery,
                vehicle_id: '507f1f77bcf86cd799439013',
                start_date: '2026-06-11',
                days: '7',
            },
        });

        expect(result.success).toBe(true);
        expect(result.data.query.days).toBe(7);
    });

    it('rejects a query without date or start_date', () => {
        const result = getAvailableSlotsSchema.safeParse({
            query: baseQuery,
        });

        expect(result.success).toBe(false);
    });

    it('rejects date and start_date used together', () => {
        const result = getAvailableSlotsSchema.safeParse({
            query: {
                ...baseQuery,
                date: '2026-06-11',
                start_date: '2026-06-11',
            },
        });

        expect(result.success).toBe(false);
    });

    it('rejects ranges longer than seven days', () => {
        const result = getAvailableSlotsSchema.safeParse({
            query: {
                ...baseQuery,
                start_date: '2026-06-11',
                days: '8',
            },
        });

        expect(result.success).toBe(false);
    });
});

describe('booking late arrival validator', () => {
    const bookingId = '507f1f77bcf86cd799439011';

    it('accepts a seven-day late arrival option query', () => {
        const result = getLateArrivalOptionsSchema.safeParse({
            params: {
                id: bookingId,
            },
            query: {
                days: '7',
            },
        });

        expect(result.success).toBe(true);
        expect(result.data.query.days).toBe(7);
    });

    it('requires a new start time when rescheduling', () => {
        const result = resolveLateArrivalSchema.safeParse({
            params: {
                id: bookingId,
            },
            body: {
                resolution: 'RESCHEDULED',
            },
        });

        expect(result.success).toBe(false);
    });

    it('accepts a valid reschedule request', () => {
        const result = resolveLateArrivalSchema.safeParse({
            params: {
                id: bookingId,
            },
            body: {
                resolution: 'RESCHEDULED',
                new_start_time: '2026-06-11T12:00:00+07:00',
                reason: 'CUSTOMER_LATE',
            },
        });

        expect(result.success).toBe(true);
    });

    it('rejects a new start time when accepting the original window', () => {
        const result = resolveLateArrivalSchema.safeParse({
            params: {
                id: bookingId,
            },
            body: {
                resolution: 'ACCEPT_WITHIN_ORIGINAL_WINDOW',
                new_start_time: '2026-06-11T12:00:00+07:00',
            },
        });

        expect(result.success).toBe(false);
    });
});

describe('walk-in booking validator', () => {
    const baseBody = {
        garage_id: '507f1f77bcf86cd799439011',
        service_package_id: '507f1f77bcf86cd799439012',
        start_time: '2026-06-11T12:00:00+07:00',
        license_plate: '59A-123.45',
        vehicle_type: 'CAR',
    };

    it('allows booking without guest identity fields', () => {
        const result = createWalkInBookingSchema.safeParse({
            body: baseBody,
        });

        expect(result.success).toBe(true);
    });

    it('allows immediate walk-in without start time', () => {
        const { start_time, ...immediateBody } = baseBody;
        const result = createWalkInBookingSchema.safeParse({
            body: {
                ...immediateBody,
                serve_now: true,
            },
        });

        expect(result.success).toBe(true);
        expect(result.data.body.serve_now).toBe(true);
        expect(result.data.body.suggestion_days).toBe(1);
    });

    it('requires exactly one immediate or scheduled start mode', () => {
        const { start_time, ...bodyWithoutStartTime } = baseBody;
        const missingStart = createWalkInBookingSchema.safeParse({
            body: bodyWithoutStartTime,
        });
        const conflictingStart = createWalkInBookingSchema.safeParse({
            body: {
                ...baseBody,
                serve_now: true,
            },
        });

        expect(missingStart.success).toBe(false);
        expect(conflictingStart.success).toBe(false);
    });

    it('normalizes a provided guest phone', () => {
        const result = createWalkInBookingSchema.safeParse({
            body: {
                ...baseBody,
                guest_phone: '0901 234 567',
            },
        });

        expect(result.success).toBe(true);
        expect(result.data.body.guest_phone).toBe('+84901234567');
    });

    it('rejects an invalid provided guest phone', () => {
        const result = createWalkInBookingSchema.safeParse({
            body: {
                ...baseBody,
                guest_phone: '123',
            },
        });

        expect(result.success).toBe(false);
    });
});

describe('booking service item validator', () => {
    const params = {
        id: '507f1f77bcf86cd799439011',
        itemKey: 'ITEM_1_507F1F77BCF86CD799439012',
    };

    it('accepts a service item completion request', () => {
        const result = serviceItemOperationSchema.safeParse({
            params,
            body: {
                note: 'Completed early',
            },
        });

        expect(result.success).toBe(true);
    });

    it('requires a pause reason', () => {
        const missingReason = pauseServiceItemSchema.safeParse({
            params,
            body: {},
        });
        const validReason = pauseServiceItemSchema.safeParse({
            params,
            body: {
                reason: 'Equipment inspection',
            },
        });

        expect(missingReason.success).toBe(false);
        expect(validReason.success).toBe(true);
    });
});
