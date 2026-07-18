const BookingHandover = require('./bookingHandover.model');

describe('booking handover model', () => {
    const base = {
        booking_id: '507f1f77bcf86cd799439011',
        garage_id: '507f1f77bcf86cd799439012',
        customer_id: '507f1f77bcf86cd799439013',
    };

    it('requires a release timestamp for released vehicles', async () => {
        const handover = new BookingHandover({
            ...base,
            state: 'RELEASED',
            customer_response: 'ACCEPTED',
            accepted_at: new Date(),
        });

        await expect(handover.validate()).rejects.toMatchObject({
            errors: expect.objectContaining({ released_at: expect.any(Object) }),
        });
    });

    it('requires a linked case when an issue is reported', async () => {
        const handover = new BookingHandover({
            ...base,
            state: 'READY_FOR_CUSTOMER',
            ready_at: new Date(),
            customer_response: 'ISSUE_REPORTED',
        });

        await expect(handover.validate()).rejects.toMatchObject({
            errors: expect.objectContaining({ issue_case_ids: expect.any(Object) }),
        });
    });

    it('supports a walk-in handover without a customer account', async () => {
        const handover = new BookingHandover({
            booking_id: base.booking_id,
            garage_id: base.garage_id,
            customer_id: null,
            guest_name: 'Walk-in Customer',
            guest_phone: '+84901234567',
            state: 'READY_FOR_CUSTOMER',
            ready_at: new Date(),
        });

        await expect(handover.validate()).resolves.toBeUndefined();
    });
});
