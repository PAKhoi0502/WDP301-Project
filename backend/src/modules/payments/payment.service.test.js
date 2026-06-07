const mockSession = {
    withTransaction: jest.fn(async (callback) => callback()),
    endSession: jest.fn(),
};

jest.mock('mongoose', () => ({
    startSession: jest.fn(() => mockSession),
}));

jest.mock('../bookings/booking.model', () => ({
    findById: jest.fn(),
}));

jest.mock('../bookings/bookingPayment.service', () => ({
    confirmBookingPaid: jest.fn(),
}));

jest.mock('../staff-profiles/staffProfile.model', () => ({
    findOne: jest.fn(),
}));

jest.mock('./paymentTransaction.model', () => ({
    findById: jest.fn(),
    findOne: jest.fn(),
    updateMany: jest.fn(),
    exists: jest.fn(),
    create: jest.fn(),
}));

jest.mock('./payos.service', () => ({
    buildCreatePaymentLinkPayload: jest.fn(),
    createPaymentLink: jest.fn(),
    cancelPaymentLink: jest.fn(),
}));

const Booking = require('../bookings/booking.model');
const bookingPaymentService = require('../bookings/bookingPayment.service');
const StaffProfile = require('../staff-profiles/staffProfile.model');
const PaymentTransaction = require('./paymentTransaction.model');
const payosService = require('./payos.service');
const paymentService = require('./payment.service');

describe('payment service createPayosPayment', () => {
    const bookingId = '507f1f77bcf86cd799439011';
    const adminUser = {
        _id: '507f1f77bcf86cd799439012',
        role: 'ADMIN',
    };

    const createBooking = (overrides = {}) => ({
        _id: bookingId,
        garage_id: '507f1f77bcf86cd799439013',
        status: 'COMPLETED',
        payment_method: 'CASH',
        payment_status: 'UNPAID',
        final_price: 120000,
        save: jest.fn().mockResolvedValue(undefined),
        ...overrides,
    });

    const createQueryMock = (value) => ({
        sort: jest.fn().mockResolvedValue(value),
    });

    const createSessionQueryMock = (value) => ({
        session: jest.fn().mockResolvedValue(value),
    });

    beforeEach(() => {
        jest.clearAllMocks();
        Booking.findById.mockReset();
        StaffProfile.findOne.mockReset();
        PaymentTransaction.findById.mockReset();
        PaymentTransaction.findOne.mockReset();
        PaymentTransaction.updateMany.mockReset();
        PaymentTransaction.exists.mockReset();
        PaymentTransaction.create.mockReset();
        payosService.buildCreatePaymentLinkPayload.mockReset();
        payosService.createPaymentLink.mockReset();
        payosService.cancelPaymentLink.mockReset();
        payosService.verifyWebhook = jest.fn();
        bookingPaymentService.confirmBookingPaid.mockReset();
        mockSession.withTransaction.mockImplementation(async (callback) => callback());
        mockSession.endSession.mockResolvedValue(undefined);
        jest.spyOn(Date, 'now').mockReturnValue(1780826400000);
        jest.spyOn(Math, 'random').mockReturnValue(0.12);
        PaymentTransaction.updateMany.mockResolvedValue({ modifiedCount: 0 });
        PaymentTransaction.exists.mockResolvedValue(null);
        payosService.cancelPaymentLink.mockResolvedValue({ status: 'CANCELLED' });
        bookingPaymentService.confirmBookingPaid.mockImplementation(async ({
            booking,
            paymentMethod,
            paidAt,
        }) => {
            booking.payment_method = paymentMethod;
            booking.payment_status = 'PAID';
            booking.paid_at = paidAt;

            return {
                wash_history: { id: 'wash-history-id' },
                loyalty: { id: 'loyalty-id' },
                point_transaction: { id: 'point-transaction-id' },
                promotion_usage: null,
                notifications: [],
                already_processed: false,
            };
        });
    });

    afterEach(() => {
        Date.now.mockRestore();
        Math.random.mockRestore();
    });

    it('reuses active pending PayOS payment and marks booking pending', async () => {
        const booking = createBooking();
        const pendingPayment = {
            _id: '507f1f77bcf86cd799439014',
            booking_id: bookingId,
            provider: 'PAYOS',
            method: 'QR',
            order_code: 178082640000012,
            payment_link_id: 'payos-link-id',
            checkout_url: 'https://pay.payos.vn/web/checkout/123',
            qr_code: '000201010212',
            amount: 120000,
            currency: 'VND',
            description: 'AWP 178082640000012',
            status: 'PENDING',
            expires_at: new Date('2026-06-07T10:15:00.000Z'),
        };

        Booking.findById.mockResolvedValue(booking);
        PaymentTransaction.findOne.mockReturnValue(createQueryMock(pendingPayment));

        const result = await paymentService.createPayosPayment(adminUser, bookingId);

        expect(booking.payment_method).toBe('PAYOS');
        expect(booking.payment_status).toBe('PENDING');
        expect(booking.save).toHaveBeenCalledTimes(1);
        expect(payosService.createPaymentLink).not.toHaveBeenCalled();
        expect(result.reused).toBe(true);
        expect(result.payment.id).toBe('507f1f77bcf86cd799439014');
    });

    it('generates PayOS QR payment link and transaction for completed unpaid booking', async () => {
        const booking = createBooking();
        const initiatedPayment = {
            _id: '507f1f77bcf86cd799439014',
            booking_id: bookingId,
            order_code: 178082640000012,
            amount: 120000,
            currency: 'VND',
            description: 'AWP 178082640000012',
            status: 'INITIATED',
            save: jest.fn().mockResolvedValue(undefined),
        };

        Booking.findById
            .mockResolvedValueOnce(booking)
            .mockReturnValueOnce(createSessionQueryMock(booking));
        PaymentTransaction.findOne.mockReturnValue(createQueryMock(null));
        payosService.buildCreatePaymentLinkPayload.mockReturnValue({
            expiredAt: 1780827300,
        });
        payosService.createPaymentLink.mockResolvedValue({
            paymentLinkId: 'payos-link-id',
            checkoutUrl: 'https://pay.payos.vn/web/checkout/123',
            qrCode: '000201010212',
            amount: 120000,
            currency: 'VND',
        });
        PaymentTransaction.create.mockResolvedValue([initiatedPayment]);
        PaymentTransaction.findById.mockReturnValue(createSessionQueryMock(initiatedPayment));

        const result = await paymentService.createPayosPayment(adminUser, bookingId, {
            return_url: 'http://localhost:5173/payment/success',
            cancel_url: 'http://localhost:5173/payment/cancel',
        });

        expect(payosService.createPaymentLink).toHaveBeenCalledWith(expect.objectContaining({
            orderCode: 178082640000012,
            amount: 120000,
            description: 'AWP 178082640000012',
            expiredAt: 1780827300,
        }));
        expect(booking.payment_method).toBe('PAYOS');
        expect(booking.payment_status).toBe('PENDING');
        expect(PaymentTransaction.create).toHaveBeenCalledWith(
            [expect.objectContaining({
                booking_id: bookingId,
                provider: 'PAYOS',
                method: 'QR',
                order_code: 178082640000012,
                amount: 120000,
                status: 'INITIATED',
                created_by_staff_id: adminUser._id,
            })]
        );
        expect(initiatedPayment.payment_link_id).toBe('payos-link-id');
        expect(initiatedPayment.checkout_url).toBe('https://pay.payos.vn/web/checkout/123');
        expect(initiatedPayment.qr_code).toBe('000201010212');
        expect(initiatedPayment.status).toBe('PENDING');
        expect(initiatedPayment.save).toHaveBeenCalledWith({ session: mockSession });
        expect(result.reused).toBe(false);
        expect(result.payment.payment_link_id).toBe('payos-link-id');
        expect(result.payment.checkout_url).toBe('https://pay.payos.vn/web/checkout/123');
        expect(result.payment.qr_code).toBe('000201010212');
    });

    it('keeps internal initiated transaction and marks it failed when PayOS create link fails', async () => {
        const booking = createBooking();
        const initiatedPayment = {
            _id: '507f1f77bcf86cd799439014',
            booking_id: bookingId,
            order_code: 178082640000012,
            amount: 120000,
            status: 'INITIATED',
            save: jest.fn().mockResolvedValue(undefined),
        };
        const error = new Error('PayOS unavailable');

        Booking.findById.mockResolvedValueOnce(booking);
        PaymentTransaction.findOne.mockReturnValue(createQueryMock(null));
        payosService.buildCreatePaymentLinkPayload.mockReturnValue({
            expiredAt: 1780827300,
        });
        PaymentTransaction.create.mockResolvedValue([initiatedPayment]);
        payosService.createPaymentLink.mockRejectedValue(error);

        await expect(paymentService.createPayosPayment(adminUser, bookingId)).rejects.toThrow('PayOS unavailable');
        expect(initiatedPayment.status).toBe('FAILED');
        expect(initiatedPayment.raw_webhook).toMatchObject({
            source: 'CREATE_PAYMENT_LINK',
            message: 'PayOS unavailable',
        });
        expect(initiatedPayment.save).toHaveBeenCalledTimes(1);
    });

    it('rejects booking that is not completed', async () => {
        Booking.findById.mockResolvedValue(createBooking({
            status: 'IN_PROGRESS',
        }));

        await expect(paymentService.createPayosPayment(adminUser, bookingId)).rejects.toMatchObject({
            statusCode: 400,
            errorCode: 'BOOKING_PAYOS_PAYMENT_NOT_ALLOWED',
        });
    });

    it('rejects staff outside booking garage', async () => {
        const staffUser = {
            _id: '507f1f77bcf86cd799439015',
            role: 'STAFF',
        };

        Booking.findById.mockResolvedValue(createBooking());
        StaffProfile.findOne.mockResolvedValue({
            garage_id: '507f1f77bcf86cd799439016',
        });

        await expect(paymentService.createPayosPayment(staffUser, bookingId)).rejects.toMatchObject({
            statusCode: 403,
            errorCode: 'STAFF_GARAGE_ACCESS_DENIED',
        });
    });

    it('gets payment detail for accessible booking', async () => {
        const booking = createBooking({
            payment_method: 'PAYOS',
            payment_status: 'PENDING',
        });
        const payment = {
            _id: '507f1f77bcf86cd799439014',
            booking_id: bookingId,
            provider: 'PAYOS',
            method: 'QR',
            order_code: 178082640000012,
            payment_link_id: 'payos-link-id',
            amount: 120000,
            status: 'PENDING',
        };

        PaymentTransaction.findById.mockResolvedValue(payment);
        Booking.findById.mockResolvedValue(booking);

        const result = await paymentService.getPaymentById(adminUser, payment._id);

        expect(result.payment.id).toBe('507f1f77bcf86cd799439014');
        expect(result.booking.payment_status).toBe('PENDING');
    });

    it('cancels pending PayOS payment and resets booking to cash unpaid', async () => {
        const booking = createBooking({
            payment_method: 'PAYOS',
            payment_status: 'PENDING',
            paid_at: null,
            save: jest.fn().mockResolvedValue(undefined),
        });
        const payment = {
            _id: '507f1f77bcf86cd799439014',
            booking_id: bookingId,
            provider: 'PAYOS',
            method: 'QR',
            order_code: 178082640000012,
            payment_link_id: 'payos-link-id',
            amount: 120000,
            status: 'PENDING',
            save: jest.fn().mockResolvedValue(undefined),
        };

        PaymentTransaction.findById.mockReturnValue(createSessionQueryMock(payment));
        Booking.findById.mockReturnValue(createSessionQueryMock(booking));

        const result = await paymentService.cancelPayosPayment(adminUser, payment._id, {
            reason: 'Customer changed to cash payment',
        });

        expect(payosService.cancelPaymentLink).toHaveBeenCalledWith(
            178082640000012,
            'Customer changed to cash payment'
        );
        expect(payment.status).toBe('CANCELED');
        expect(payment.canceled_at).toBeInstanceOf(Date);
        expect(payment.save).toHaveBeenCalledWith({ session: mockSession });
        expect(booking.payment_method).toBe('CASH');
        expect(booking.payment_status).toBe('UNPAID');
        expect(booking.save).toHaveBeenCalledWith({ session: mockSession });
        expect(result.payment.status).toBe('CANCELED');
    });

    it('rejects canceling a paid PayOS payment', async () => {
        const booking = createBooking({
            payment_method: 'PAYOS',
            payment_status: 'PAID',
        });
        const payment = {
            _id: '507f1f77bcf86cd799439014',
            booking_id: bookingId,
            status: 'PAID',
        };

        PaymentTransaction.findById.mockReturnValue(createSessionQueryMock(payment));
        Booking.findById.mockReturnValue(createSessionQueryMock(booking));

        await expect(paymentService.cancelPayosPayment(adminUser, payment._id)).rejects.toMatchObject({
            statusCode: 409,
            errorCode: 'PAYMENT_ALREADY_PAID',
        });
    });

    it('handles successful PayOS webhook and confirms booking paid once', async () => {
        const booking = createBooking({
            payment_method: 'PAYOS',
            payment_status: 'PENDING',
            save: jest.fn().mockResolvedValue(undefined),
        });
        const payment = {
            _id: '507f1f77bcf86cd799439014',
            booking_id: bookingId,
            provider: 'PAYOS',
            method: 'QR',
            order_code: 178082640000012,
            payment_link_id: 'payos-link-id',
            checkout_url: 'https://pay.payos.vn/web/checkout/123',
            qr_code: '000201010212',
            amount: 120000,
            currency: 'VND',
            description: 'AWP 178082640000012',
            status: 'PENDING',
            created_by_staff_id: adminUser._id,
            save: jest.fn().mockResolvedValue(undefined),
        };

        payosService.verifyWebhook = jest.fn().mockResolvedValue({
            orderCode: 178082640000012,
            paymentLinkId: 'payos-link-id',
            amount: 120000,
            transactionDateTime: '2026-06-07 10:05:00',
            code: '00',
        });
        PaymentTransaction.findOne.mockReturnValue(createSessionQueryMock(payment));
        Booking.findById.mockReturnValue(createSessionQueryMock(booking));

        const result = await paymentService.handlePayosWebhook({
            code: '00',
            success: true,
            data: { orderCode: 178082640000012 },
            signature: 'valid-signature',
        });

        expect(payment.status).toBe('PAID');
        expect(payment.paid_at.toISOString()).toBe('2026-06-07T03:05:00.000Z');
        expect(payment.raw_webhook).toMatchObject({ code: '00' });
        expect(booking.payment_method).toBe('PAYOS');
        expect(booking.payment_status).toBe('PAID');
        expect(booking.paid_at.toISOString()).toBe('2026-06-07T03:05:00.000Z');
        expect(bookingPaymentService.confirmBookingPaid).toHaveBeenCalledWith({
            booking,
            paymentMethod: 'PAYOS',
            actorId: adminUser._id,
            paidAt: new Date('2026-06-07T03:05:00.000Z'),
            session: mockSession,
        });
        expect(result.received).toBe(true);
        expect(result.already_processed).toBe(false);
    });

    it('returns idempotent response when PayOS webhook is repeated second time', async () => {
        const booking = createBooking({
            payment_method: 'PAYOS',
            payment_status: 'PAID',
            paid_at: new Date('2026-06-07T03:05:00.000Z'),
            reward_processed: true,
        });
        const payment = {
            _id: '507f1f77bcf86cd799439014',
            booking_id: bookingId,
            provider: 'PAYOS',
            method: 'QR',
            order_code: 178082640000012,
            payment_link_id: 'payos-link-id',
            amount: 120000,
            status: 'PAID',
            paid_at: new Date('2026-06-07T03:05:00.000Z'),
            save: jest.fn(),
        };

        payosService.verifyWebhook = jest.fn().mockResolvedValue({
            orderCode: 178082640000012,
            paymentLinkId: 'payos-link-id',
            amount: 120000,
            code: '00',
        });
        PaymentTransaction.findOne.mockReturnValue(createSessionQueryMock(payment));
        Booking.findById.mockReturnValue(createSessionQueryMock(booking));

        const result = await paymentService.handlePayosWebhook({
            code: '00',
            success: true,
            data: { orderCode: 178082640000012 },
            signature: 'valid-signature',
        });

        expect(payment.save).not.toHaveBeenCalled();
        expect(bookingPaymentService.confirmBookingPaid).not.toHaveBeenCalled();
        expect(result.already_processed).toBe(true);
    });

    it('ignores verified PayOS webhook when transaction is unknown', async () => {
        payosService.verifyWebhook.mockResolvedValue({
            orderCode: 178082640000012,
            paymentLinkId: 'unknown-link-id',
            amount: 120000,
            code: '00',
        });
        PaymentTransaction.findOne.mockReturnValue(createSessionQueryMock(null));

        const result = await paymentService.handlePayosWebhook({
            code: '00',
            success: true,
            data: { orderCode: 178082640000012 },
            signature: 'valid-signature',
        });

        expect(result.received).toBe(true);
        expect(result.ignored).toBe(true);
        expect(result.reason).toBe('UNKNOWN_PAYMENT_TRANSACTION');
        expect(bookingPaymentService.confirmBookingPaid).not.toHaveBeenCalled();
    });

    it('rejects PayOS webhook when amount does not match booking', async () => {
        const booking = createBooking({
            payment_method: 'PAYOS',
            payment_status: 'PENDING',
        });
        const payment = {
            booking_id: bookingId,
            order_code: 178082640000012,
            payment_link_id: 'payos-link-id',
            amount: 120000,
            status: 'PENDING',
        };

        payosService.verifyWebhook = jest.fn().mockResolvedValue({
            orderCode: 178082640000012,
            paymentLinkId: 'payos-link-id',
            amount: 100000,
            code: '00',
        });
        PaymentTransaction.findOne.mockReturnValue(createSessionQueryMock(payment));
        Booking.findById.mockReturnValue(createSessionQueryMock(booking));

        await expect(paymentService.handlePayosWebhook({
            code: '00',
            success: true,
            data: { orderCode: 178082640000012 },
            signature: 'valid-signature',
        })).rejects.toMatchObject({
            statusCode: 400,
            errorCode: 'PAYOS_PAYMENT_AMOUNT_MISMATCH',
        });
    });

    it('marks payment failed when PayOS webhook is not successful', async () => {
        const payment = {
            _id: '507f1f77bcf86cd799439014',
            booking_id: bookingId,
            order_code: 178082640000012,
            payment_link_id: 'payos-link-id',
            amount: 120000,
            status: 'PENDING',
            save: jest.fn().mockResolvedValue(undefined),
        };

        payosService.verifyWebhook = jest.fn().mockResolvedValue({
            orderCode: 178082640000012,
            paymentLinkId: 'payos-link-id',
            amount: 120000,
            code: '01',
        });
        PaymentTransaction.findOne.mockReturnValue(createSessionQueryMock(payment));

        const result = await paymentService.handlePayosWebhook({
            code: '01',
            success: false,
            data: { orderCode: 178082640000012 },
            signature: 'valid-signature',
        });

        expect(payment.status).toBe('FAILED');
        expect(payment.raw_webhook).toMatchObject({ code: '01' });
        expect(payment.save).toHaveBeenCalledWith({ session: mockSession });
        expect(result.ignored).toBe(true);
    });
});
