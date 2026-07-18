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
});
