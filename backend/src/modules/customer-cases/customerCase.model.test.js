const CustomerCase = require('./customerCase.model');

describe('customer case model', () => {
    const base = {
        case_code: 'CC-20260718-ABCDEF12',
        booking_id: '507f1f77bcf86cd799439011',
        handover_id: '507f1f77bcf86cd799439012',
        garage_id: '507f1f77bcf86cd799439013',
        customer_id: '507f1f77bcf86cd799439014',
        category: 'SERVICE_QUALITY',
        priority: 'NORMAL',
        priority_rank: 1,
        source: 'HANDOVER',
        description: 'The completed service quality did not meet expectations.',
        booking_snapshot: {},
    };

    it('requires a dedupe key while the case is open', async () => {
        const customerCase = new CustomerCase(base);

        await expect(customerCase.validate()).rejects.toMatchObject({
            errors: expect.objectContaining({ open_dedupe_key: expect.any(Object) }),
        });
    });

    it('requires final liability and resolution audit fields when resolved', async () => {
        const customerCase = new CustomerCase({
            ...base,
            status: 'RESOLVED',
            open_dedupe_key: null,
        });

        await expect(customerCase.validate()).rejects.toMatchObject({
            errors: expect.objectContaining({
                conclusion: expect.any(Object),
                liability_status: expect.any(Object),
            }),
        });
    });

    it('requires reporter and staff audit data for an accountless walk-in case', async () => {
        const customerCase = new CustomerCase({
            ...base,
            customer_id: null,
            is_walk_in_case: true,
            open_dedupe_key: `${base.booking_id}:${base.category}`,
        });

        await expect(customerCase.validate()).rejects.toMatchObject({
            errors: expect.objectContaining({ reporter_phone: expect.any(Object) }),
        });
    });
});
