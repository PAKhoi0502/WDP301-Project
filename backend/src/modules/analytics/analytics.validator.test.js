const {
    staffAnalyticsQuerySchema,
} = require('./analytics.validator');

describe('staff analytics validator', () => {
    it('accepts only the dashboard date range and grouping fields', () => {
        const result = staffAnalyticsQuerySchema.safeParse({
            query: {
                from: '2026-07-29T00:00:00.000+07:00',
                to: '2026-07-29T23:59:59.999+07:00',
                group_by: 'DAY',
            },
        });

        expect(result.success).toBe(true);
    });

    it('rejects a caller-supplied garage filter', () => {
        const result = staffAnalyticsQuerySchema.safeParse({
            query: {
                garage_id: '507f1f77bcf86cd799439099',
            },
        });

        expect(result.success).toBe(false);
    });
});
