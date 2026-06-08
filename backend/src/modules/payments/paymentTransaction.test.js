const mongoose = require('mongoose');

const PaymentTransaction = require('./paymentTransaction.model');

describe('payment transaction model', () => {
    const createPaymentTransaction = (overrides = {}) => {
        return new PaymentTransaction({
            booking_id: new mongoose.Types.ObjectId(),
            order_code: 123456,
            payment_link_id: 'payos-link-id',
            checkout_url: 'https://pay.payos.vn/web/checkout/123456',
            qr_code: '00020101021238540010A000000727',
            amount: 120000,
            description: 'Booking #123456',
            created_by_staff_id: new mongoose.Types.ObjectId(),
            ...overrides,
        });
    };

    it('applies PayOS transaction defaults', async () => {
        const transaction = createPaymentTransaction();

        await expect(transaction.validate()).resolves.toBeUndefined();

        expect(transaction.provider).toBe('PAYOS');
        expect(transaction.method).toBe('QR');
        expect(transaction.currency).toBe('VND');
        expect(transaction.status).toBe('PENDING');
        expect(transaction.paid_at).toBeNull();
    });

    it('allows initiated transaction before PayOS link data is returned', async () => {
        const transaction = createPaymentTransaction({
            status: 'INITIATED',
            payment_link_id: null,
            checkout_url: null,
            qr_code: null,
        });

        await expect(transaction.validate()).resolves.toBeUndefined();
    });

    it('allows canceling transaction before final canceled timestamp is set', async () => {
        const transaction = createPaymentTransaction({
            status: 'CANCELING',
            canceled_at: null,
        });

        await expect(transaction.validate()).resolves.toBeUndefined();
    });

    it('requires PayOS link data for pending transaction', async () => {
        const transaction = createPaymentTransaction({
            payment_link_id: null,
            checkout_url: null,
            qr_code: null,
        });

        await expect(transaction.validate()).rejects.toMatchObject({
            errors: {
                payment_link_id: expect.anything(),
                checkout_url: expect.anything(),
                qr_code: expect.anything(),
            },
        });
    });

    it('requires integer order code and amount', async () => {
        const transaction = createPaymentTransaction({
            order_code: 123.45,
            amount: 1000.5,
        });

        await expect(transaction.validate()).rejects.toMatchObject({
            errors: {
                order_code: expect.anything(),
                amount: expect.anything(),
            },
        });
    });

    it('requires paid_at when status is PAID', async () => {
        const transaction = createPaymentTransaction({
            status: 'PAID',
        });

        await expect(transaction.validate()).rejects.toMatchObject({
            errors: {
                paid_at: expect.anything(),
            },
        });
    });

    it('removes version key from JSON output', () => {
        const transaction = createPaymentTransaction({
            _id: new mongoose.Types.ObjectId(),
        });

        const json = transaction.toJSON();

        expect(json.__v).toBeUndefined();
    });
});
