const mongoose = require('mongoose');

const CustomerVoucher = require('./customerVoucher.model');

describe('customer voucher model', () => {
    const createVoucher = (overrides = {}) => new CustomerVoucher({
        code: 'CARE_TEST_123',
        customer_id: new mongoose.Types.ObjectId(),
        garage_id: new mongoose.Types.ObjectId(),
        source_booking_id: new mongoose.Types.ObjectId(),
        source_incident_id: new mongoose.Types.ObjectId(),
        voucher_type: 'FIXED_AMOUNT',
        value: 50000,
        expires_at: new Date('2999-01-01T00:00:00.000Z'),
        issued_by_id: new mongoose.Types.ObjectId(),
        ...overrides,
    });

    it('accepts a valid fixed compensation voucher', async () => {
        await expect(createVoucher().validate()).resolves.toBeUndefined();
    });

    it('rejects percentage value above one hundred', async () => {
        const voucher = createVoucher({
            voucher_type: 'PERCENTAGE',
            value: 101,
        });

        await expect(voucher.validate()).rejects.toMatchObject({
            errors: {
                value: expect.anything(),
            },
        });
    });

    it('requires a service package for a free service voucher', async () => {
        const voucher = createVoucher({
            voucher_type: 'FREE_SERVICE',
            value: 0,
        });

        await expect(voucher.validate()).rejects.toMatchObject({
            errors: {
                service_package_id: expect.anything(),
            },
        });
    });

    it('accepts a customer-case compensation source instead of an incident', async () => {
        const voucher = createVoucher({
            source_incident_id: null,
            source_customer_case_id: new mongoose.Types.ObjectId(),
            source_customer_case_resolution_id: new mongoose.Types.ObjectId(),
        });

        await expect(voucher.validate()).resolves.toBeUndefined();
    });

    it('rejects ambiguous compensation sources', async () => {
        const voucher = createVoucher({
            source_customer_case_id: new mongoose.Types.ObjectId(),
        });

        await expect(voucher.validate()).rejects.toMatchObject({
            errors: { source_type: expect.anything() },
        });
    });

    it('accepts an admin gift without a booking or compensation source', async () => {
        const voucher = createVoucher({
            source_type: 'ADMIN_GIFT',
            source_booking_id: null,
            source_incident_id: null,
        });

        await expect(voucher.validate()).resolves.toBeUndefined();
    });

    it('rejects an admin gift that references a compensation source', async () => {
        const voucher = createVoucher({
            source_type: 'ADMIN_GIFT',
        });

        await expect(voucher.validate()).rejects.toMatchObject({
            errors: { source_type: expect.anything() },
        });
    });
});
