const {
    createCustomerCaseSchema,
    addEvidenceSchema,
    concludeCustomerCaseSchema,
    proposeResolutionSchema,
    createWalkInCustomerCaseSchema,
    updateRefundSchema,
} = require('./customerCase.validator');

describe('customer case validators', () => {
    const id = '507f1f77bcf86cd799439011';

    it('accepts a categorized handover report with unique evidence ids', () => {
        const result = createCustomerCaseSchema.safeParse({
            params: { id },
            body: {
                category: 'VEHICLE_DAMAGE',
                description: 'A new scratch is visible on the left door.',
                vehicle_received: false,
                upload_ids: [id],
            },
        });

        expect(result.success).toBe(true);
    });

    it('rejects duplicate evidence ids', () => {
        const result = addEvidenceSchema.safeParse({
            params: { id },
            body: { upload_ids: [id, id] },
        });

        expect(result.success).toBe(false);
    });

    it('does not allow an undetermined admin conclusion', () => {
        const result = concludeCustomerCaseSchema.safeParse({
            params: { id },
            body: {
                liability_status: 'UNDETERMINED',
                conclusion: 'There is enough text for a conclusion.',
            },
        });

        expect(result.success).toBe(false);
    });

    it('rejects a discovery timestamp in the future', () => {
        const result = createCustomerCaseSchema.safeParse({
            params: { id },
            body: {
                category: 'SERVICE_QUALITY',
                description: 'The completed service did not meet expectations.',
                discovered_at: '2999-01-01T00:00:00+07:00',
            },
        });

        expect(result.success).toBe(false);
    });

    it('accepts a combined refund, voucher and rework proposal', () => {
        const result = proposeResolutionSchema.safeParse({
            params: { id },
            body: {
                summary: 'Garage proposes a complete compensation package.',
                actions: [
                    { action_type: 'REFUND', amount: 100000, refund_method: 'BANK_TRANSFER' },
                    { action_type: 'VOUCHER', voucher_type: 'FIXED_AMOUNT', value: 50000, expires_at: '2027-07-18T12:00:00+07:00' },
                    { action_type: 'REWORK', rework_start_time: '2027-07-20T09:00:00+07:00' },
                ],
            },
        });

        expect(result.success).toBe(true);
    });

    it('requires the booking-bound verification token for walk-in case creation', () => {
        const result = createWalkInCustomerCaseSchema.safeParse({
            body: {
                booking_id: id,
                category: 'SERVICE_QUALITY',
                description: 'The walk-in customer reports an incomplete service.',
            },
        });

        expect(result.success).toBe(false);
    });

    it('requires only processable refund statuses at the API boundary', () => {
        const result = updateRefundSchema.safeParse({
            params: { id, refundId: id },
            body: { status: 'APPROVED' },
        });

        expect(result.success).toBe(false);
    });
});
