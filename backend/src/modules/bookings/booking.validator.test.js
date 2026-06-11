const { getAvailableSlotsSchema } = require('./booking.validator');

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
