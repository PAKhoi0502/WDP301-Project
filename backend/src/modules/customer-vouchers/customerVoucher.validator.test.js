const {
    createAdminGiftVoucherSchema,
    getAdminVouchersSchema,
} = require('./customerVoucher.validator');

describe('customer voucher validator', () => {
    const validBody = {
        customer_id: '507f1f77bcf86cd799439011',
        garage_id: '507f1f77bcf86cd799439012',
        voucher_type: 'FIXED_AMOUNT',
        value: 50000,
        min_order_amount: 100000,
        expires_at: '2999-01-01T00:00:00.000Z',
        note: 'Tri ân khách hàng thân thiết',
    };

    it('accepts a valid direct customer gift', () => {
        expect(createAdminGiftVoucherSchema.safeParse({
            body: validBody,
        }).success).toBe(true);
    });

    it('requires a maximum discount for a percentage gift', () => {
        const result = createAdminGiftVoucherSchema.safeParse({
            body: {
                ...validBody,
                voucher_type: 'PERCENTAGE',
                value: 20,
            },
        });

        expect(result.success).toBe(false);
        expect(result.error.issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    path: ['body', 'max_discount_amount'],
                }),
            ])
        );
    });

    it('accepts customer and source filters for admin listing', () => {
        expect(getAdminVouchersSchema.safeParse({
            query: {
                customer_id: validBody.customer_id,
                source: 'ADMIN_GIFT',
                page: '1',
                limit: '20',
            },
        }).success).toBe(true);
    });
});
