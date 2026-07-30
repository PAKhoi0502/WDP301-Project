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

jest.mock('../booking-handovers/bookingHandoverPayment.policy', () => ({
    assertPaymentCollectionAllowed: jest.fn(),
}));

jest.mock('../staff-profiles/staffProfile.model', () => ({
    findOne: jest.fn(),
}));

jest.mock('./paymentTransaction.model', () => ({
    findById: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    updateMany: jest.fn(),
    exists: jest.fn(),
    create: jest.fn(),
}));

jest.mock('../audit-logs/auditLog.service', () => ({
    recordAuditEvent: jest.fn(),
}));

jest.mock('./payos.service', () => ({
    buildCreatePaymentLinkPayload: jest.fn(),
    createPaymentLink: jest.fn(),
    getPaymentLinkInformation: jest.fn(),
    cancelPaymentLink: jest.fn(),
}));

const Booking = require('../bookings/booking.model');
const bookingPaymentService = require('../bookings/bookingPayment.service');
const bookingHandoverPaymentPolicy = require('../booking-handovers/bookingHandoverPayment.policy');
const StaffProfile = require('../staff-profiles/staffProfile.model');
const PaymentTransaction = require('./paymentTransaction.model');
const payosService = require('./payos.service');
const auditLogService = require('../audit-logs/auditLog.service');
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

    const createLimitedQueryMock = (value) => ({
        sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(value),
        }),
    });

    beforeEach(() => {
        jest.clearAllMocks();
        Booking.findById.mockReset();
        StaffProfile.findOne.mockReset();
        PaymentTransaction.findById.mockReset();
        PaymentTransaction.findOne.mockReset();
        PaymentTransaction.find.mockReset();
        PaymentTransaction.updateMany.mockReset();
        PaymentTransaction.exists.mockReset();
        PaymentTransaction.create.mockReset();
        payosService.buildCreatePaymentLinkPayload.mockReset();
        payosService.createPaymentLink.mockReset();
        payosService.getPaymentLinkInformation.mockReset();
        payosService.cancelPaymentLink.mockReset();
        payosService.verifyWebhook = jest.fn();
        bookingPaymentService.confirmBookingPaid.mockReset();
        bookingHandoverPaymentPolicy.assertPaymentCollectionAllowed.mockReset();
        bookingHandoverPaymentPolicy.assertPaymentCollectionAllowed.mockResolvedValue({});
        mockSession.withTransaction.mockImplementation(async (callback) => callback());
        mockSession.endSession.mockResolvedValue(undefined);
        jest.spyOn(Date, 'now').mockReturnValue(1780826400000);
        jest.spyOn(Math, 'random').mockReturnValue(0.12);
        PaymentTransaction.updateMany.mockResolvedValue({ modifiedCount: 0 });
        PaymentTransaction.find.mockReturnValue(createLimitedQueryMock([]));
        PaymentTransaction.exists.mockResolvedValue(null);
        auditLogService.recordAuditEvent.mockResolvedValue({ id: 'audit-id' });
        payosService.cancelPaymentLink.mockResolvedValue({ status: 'CANCELLED' });
        payosService.getPaymentLinkInformation.mockResolvedValue({ status: 'PENDING' });
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

    it('rejects creating a new PayOS link while cancel is in progress', async () => {
        const booking = createBooking({
            payment_method: 'PAYOS',
            payment_status: 'PENDING',
        });
        const cancelingPayment = {
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
            status: 'CANCELING',
            expires_at: new Date('2026-06-07T10:15:00.000Z'),
        };

        Booking.findById.mockResolvedValue(booking);
        PaymentTransaction.findOne.mockReturnValue(createQueryMock(cancelingPayment));

        await expect(paymentService.createPayosPayment(adminUser, bookingId)).rejects.toMatchObject({
            statusCode: 409,
            errorCode: 'PAYMENT_CANCEL_IN_PROGRESS',
        });

        expect(payosService.createPaymentLink).not.toHaveBeenCalled();
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
                initiated_by_user_id: adminUser._id,
                initiated_by_role: 'ADMIN',
                initiated_channel: 'STAFF_ASSISTED',
                active_payment_key: `PAYOS:${bookingId}`,
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

    it('lets a customer reuse the active payment for an owned booking', async () => {
        const customerUser = {
            _id: '507f1f77bcf86cd799439021',
            role: 'CUSTOMER',
        };
        const booking = createBooking({
            customer_id: customerUser._id,
            is_walk_in: false,
        });
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
            initiated_by_user_id: adminUser._id,
            initiated_by_role: 'ADMIN',
            initiated_channel: 'STAFF_ASSISTED',
        };

        Booking.findById.mockResolvedValue(booking);
        PaymentTransaction.findOne.mockReturnValue(createQueryMock(pendingPayment));

        const result = await paymentService.createPayosPayment(customerUser, bookingId);

        expect(result.reused).toBe(true);
        expect(result.poll_after_ms).toBe(3000);
        expect(result.booking).toBeUndefined();
        expect(result.payment.qr_code).toBe('000201010212');
        expect(result.payment.initiated_by_user_id).toBeUndefined();
        expect(auditLogService.recordAuditEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                actorId: customerUser._id,
                action: 'PAYMENT_REUSED',
            })
        );
    });

    it('hides another customer booking as not found', async () => {
        const customerUser = {
            _id: '507f1f77bcf86cd799439021',
            role: 'CUSTOMER',
        };

        Booking.findById.mockResolvedValue(createBooking({
            customer_id: '507f1f77bcf86cd799439022',
            is_walk_in: false,
        }));

        await expect(
            paymentService.createPayosPayment(customerUser, bookingId)
        ).rejects.toMatchObject({
            statusCode: 404,
            errorCode: 'BOOKING_NOT_FOUND',
        });

        expect(PaymentTransaction.find).not.toHaveBeenCalled();
    });

    it('reuses the winner when concurrent creation hits the active payment key', async () => {
        const booking = createBooking();
        const concurrentPayment = {
            _id: '507f1f77bcf86cd799439023',
            booking_id: bookingId,
            provider: 'PAYOS',
            method: 'QR',
            order_code: 178082640000013,
            amount: 120000,
            currency: 'VND',
            description: 'AWP 178082640000013',
            status: 'INITIATED',
            initiated_by_user_id: adminUser._id,
            initiated_by_role: 'ADMIN',
            initiated_channel: 'STAFF_ASSISTED',
        };
        const duplicateError = Object.assign(new Error('duplicate key'), {
            code: 11000,
            keyPattern: { active_payment_key: 1 },
        });

        Booking.findById.mockResolvedValue(booking);
        PaymentTransaction.findOne
            .mockReturnValueOnce(createQueryMock(null))
            .mockReturnValueOnce(createQueryMock(concurrentPayment));
        payosService.buildCreatePaymentLinkPayload.mockReturnValue({
            expiredAt: 1780827300,
        });
        PaymentTransaction.create.mockRejectedValue(duplicateError);

        const result = await paymentService.createPayosPayment(adminUser, bookingId);

        expect(result.reused).toBe(true);
        expect(result.payment.id).toBe('507f1f77bcf86cd799439023');
        expect(payosService.createPaymentLink).not.toHaveBeenCalled();
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

    it('lets a customer poll the latest payment for an owned booking', async () => {
        const customerUser = {
            _id: '507f1f77bcf86cd799439021',
            role: 'CUSTOMER',
        };
        const booking = createBooking({
            customer_id: customerUser._id,
            is_walk_in: false,
            payment_method: 'PAYOS',
            payment_status: 'PENDING',
        });
        const payment = {
            _id: '507f1f77bcf86cd799439014',
            booking_id: bookingId,
            provider: 'PAYOS',
            method: 'QR',
            order_code: 178082640000012,
            checkout_url: 'https://pay.payos.vn/web/checkout/123',
            qr_code: '000201010212',
            amount: 120000,
            currency: 'VND',
            description: 'AWP 178082640000012',
            status: 'PENDING',
        };

        Booking.findById.mockResolvedValue(booking);
        PaymentTransaction.findOne.mockReturnValue(createQueryMock(payment));

        const result = await paymentService.getPayosPaymentForBooking(customerUser, bookingId);

        expect(result.payment.id).toBe('507f1f77bcf86cd799439014');
        expect(result.payment.qr_code).toBe('000201010212');
        expect(result.poll_after_ms).toBe(3000);
        expect(result.booking).toBeUndefined();
    });

    it('confirms a paid PayOS transaction from provider polling when webhook delivery was missed', async () => {
        const customerUser = {
            _id: '507f1f77bcf86cd799439021',
            role: 'CUSTOMER',
        };
        const booking = createBooking({
            customer_id: customerUser._id,
            is_walk_in: false,
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
            checkout_url: 'https://pay.payos.vn/web/checkout/123',
            qr_code: '000201010212',
            amount: 120000,
            currency: 'VND',
            description: 'AWP 178082640000012',
            status: 'PENDING',
            save: jest.fn().mockResolvedValue(undefined),
        };

        Booking.findById
            .mockResolvedValueOnce(booking)
            .mockReturnValueOnce(createSessionQueryMock(booking))
            .mockResolvedValueOnce(booking);
        PaymentTransaction.findOne.mockReturnValue(createQueryMock(payment));
        PaymentTransaction.findById.mockReturnValue(createSessionQueryMock(payment));
        payosService.getPaymentLinkInformation.mockResolvedValue({
            status: 'PAID',
            orderCode: payment.order_code,
            paymentLinkId: payment.payment_link_id,
            amount: payment.amount,
            amountPaid: payment.amount,
            transactions: [{
                amount: payment.amount,
                transactionDateTime: '2026-06-07T10:05:00+07:00',
            }],
        });

        const result = await paymentService.getPayosPaymentForBooking(customerUser, bookingId);

        expect(payosService.getPaymentLinkInformation).toHaveBeenCalledWith('payos-link-id');
        expect(payment.status).toBe('PAID');
        expect(booking.payment_status).toBe('PAID');
        expect(booking.payment_method).toBe('PAYOS');
        expect(result.payment.status).toBe('PAID');
        expect(result.poll_after_ms).toBeNull();
        expect(bookingPaymentService.confirmBookingPaid).toHaveBeenCalledWith(expect.objectContaining({
            booking,
            paymentMethod: 'PAYOS',
            paidAt: new Date('2026-06-07T03:05:00.000Z'),
            session: mockSession,
        }));
        expect(auditLogService.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
            action: 'PAYMENT_CONFIRMED',
            metadata: expect.objectContaining({ source: 'PAYOS_PROVIDER_SYNC' }),
        }));
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
        let transactionCount = 0;
        mockSession.withTransaction.mockImplementation(async (callback) => {
            transactionCount += 1;

            if (transactionCount === 1) {
                await callback();
                expect(payosService.cancelPaymentLink).not.toHaveBeenCalled();
                return;
            }

            expect(payosService.cancelPaymentLink).toHaveBeenCalledTimes(1);
            await callback();
        });

        const result = await paymentService.cancelPayosPayment(adminUser, payment._id, {
            reason: 'Customer changed to cash payment',
        });

        expect(payosService.cancelPaymentLink).toHaveBeenCalledWith(
            178082640000012,
            'Customer changed to cash payment'
        );
        expect(payment.status).toBe('CANCELED');
        expect(payment.canceled_at).toBeInstanceOf(Date);
        expect(payment.save).toHaveBeenCalledTimes(2);
        expect(payment.save).toHaveBeenNthCalledWith(1, { session: mockSession });
        expect(payment.save).toHaveBeenNthCalledWith(2, { session: mockSession });
        expect(booking.payment_method).toBe('CASH');
        expect(booking.payment_status).toBe('UNPAID');
        expect(booking.save).toHaveBeenCalledWith({ session: mockSession });
        expect(result.payment.status).toBe('CANCELED');
    });

    it('continues canceling payment without resetting cancel state first', async () => {
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
            status: 'CANCELING',
            save: jest.fn().mockResolvedValue(undefined),
        };

        PaymentTransaction.findById.mockReturnValue(createSessionQueryMock(payment));
        Booking.findById.mockReturnValue(createSessionQueryMock(booking));

        const result = await paymentService.cancelPayosPayment(adminUser, payment._id);

        expect(payosService.cancelPaymentLink).toHaveBeenCalledWith(178082640000012, undefined);
        expect(payment.status).toBe('CANCELED');
        expect(payment.save).toHaveBeenCalledTimes(1);
        expect(result.payment.status).toBe('CANCELED');
    });

    it('lets a customer cancel a pending payment for an owned booking', async () => {
        const customerUser = {
            _id: '507f1f77bcf86cd799439021',
            role: 'CUSTOMER',
        };
        const booking = createBooking({
            customer_id: customerUser._id,
            is_walk_in: false,
            payment_method: 'PAYOS',
            payment_status: 'PENDING',
            paid_at: null,
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
            status: 'PENDING',
            initiated_by_user_id: customerUser._id,
            initiated_by_role: 'CUSTOMER',
            initiated_channel: 'CUSTOMER_SELF_SERVICE',
            save: jest.fn().mockResolvedValue(undefined),
        };

        PaymentTransaction.findById.mockReturnValue(createSessionQueryMock(payment));
        Booking.findById.mockReturnValue(createSessionQueryMock(booking));

        const result = await paymentService.cancelPayosPayment(
            customerUser,
            payment._id,
            { reason: 'Customer changed to cash payment' }
        );

        expect(payosService.cancelPaymentLink).toHaveBeenCalledWith(
            178082640000012,
            'Customer changed to cash payment'
        );
        expect(result.booking).toBeUndefined();
        expect(result.reused).toBe(false);
        expect(result.poll_after_ms).toBeNull();
        expect(result.payment.status).toBe('CANCELED');
        expect(result.payment.initiated_by_user_id).toBeUndefined();
        expect(booking.payment_method).toBe('CASH');
        expect(booking.payment_status).toBe('UNPAID');
    });

    it('hides another customer payment as not found during cancellation', async () => {
        const customerUser = {
            _id: '507f1f77bcf86cd799439021',
            role: 'CUSTOMER',
        };
        const booking = createBooking({
            customer_id: '507f1f77bcf86cd799439022',
            is_walk_in: false,
            payment_method: 'PAYOS',
            payment_status: 'PENDING',
        });
        const payment = {
            _id: '507f1f77bcf86cd799439014',
            booking_id: bookingId,
            status: 'PENDING',
        };

        PaymentTransaction.findById.mockReturnValue(createSessionQueryMock(payment));
        Booking.findById.mockReturnValue(createSessionQueryMock(booking));

        await expect(
            paymentService.cancelPayosPayment(customerUser, payment._id)
        ).rejects.toMatchObject({
            statusCode: 404,
            errorCode: 'BOOKING_NOT_FOUND',
        });

        expect(payosService.cancelPaymentLink).not.toHaveBeenCalled();
    });

    it('resolves a booking pending PayOS payment for cash without creating a new link', async () => {
        const booking = createBooking({
            payment_method: 'PAYOS',
            payment_status: 'PENDING',
            paid_at: null,
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
            expires_at: new Date('2999-01-01T00:00:00.000Z'),
            save: jest.fn().mockResolvedValue(undefined),
        };

        Booking.findById
            .mockResolvedValueOnce(booking)
            .mockReturnValueOnce(createSessionQueryMock(booking))
            .mockReturnValueOnce(createSessionQueryMock(booking));
        PaymentTransaction.findOne.mockReturnValueOnce(createQueryMock(payment));
        PaymentTransaction.findById
            .mockReturnValueOnce(createSessionQueryMock(payment))
            .mockReturnValueOnce(createSessionQueryMock(payment));

        const result = await paymentService.resolvePendingPayosPaymentForCash(
            adminUser,
            bookingId
        );

        expect(result.resolution).toBe('CANCELED');
        expect(result.payment.status).toBe('CANCELED');
        expect(booking.payment_method).toBe('CASH');
        expect(booking.payment_status).toBe('UNPAID');
        expect(payosService.cancelPaymentLink).toHaveBeenCalledTimes(1);
        expect(payosService.createPaymentLink).not.toHaveBeenCalled();
    });

    it('finalizes local cancellation when customer already canceled on PayOS checkout', async () => {
        const booking = createBooking({
            payment_method: 'PAYOS',
            payment_status: 'PENDING',
            paid_at: null,
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

        Booking.findById
            .mockResolvedValueOnce(booking)
            .mockReturnValueOnce(createSessionQueryMock(booking))
            .mockReturnValueOnce(createSessionQueryMock(booking));
        PaymentTransaction.findOne.mockReturnValueOnce(createQueryMock(payment));
        PaymentTransaction.findById
            .mockReturnValueOnce(createSessionQueryMock(payment))
            .mockReturnValueOnce(createSessionQueryMock(payment));
        payosService.getPaymentLinkInformation.mockResolvedValueOnce({
            status: 'CANCELLED',
        });

        const result = await paymentService.resolvePendingPayosPaymentForCash(
            adminUser,
            bookingId
        );

        expect(result.resolution).toBe('CANCELED');
        expect(result.payment.status).toBe('CANCELED');
        expect(booking.payment_method).toBe('CASH');
        expect(booking.payment_status).toBe('UNPAID');
        expect(payosService.getPaymentLinkInformation).toHaveBeenCalledWith('payos-link-id');
        expect(payosService.cancelPaymentLink).not.toHaveBeenCalled();
    });

    it('skips PayOS resolution when booking is already ready for cash payment', async () => {
        const booking = createBooking({
            payment_method: 'CASH',
            payment_status: 'UNPAID',
        });

        Booking.findById.mockResolvedValueOnce(booking);
        PaymentTransaction.findOne.mockReturnValue(createQueryMock(null));

        const result = await paymentService.resolvePendingPayosPaymentForCash(
            adminUser,
            bookingId
        );

        expect(result.resolution).toBe('NONE');
        expect(result.payment).toBeNull();
        expect(PaymentTransaction.findOne).toHaveBeenCalledTimes(1);
        expect(payosService.cancelPaymentLink).not.toHaveBeenCalled();
    });

    it('does not create a replacement PayOS link when pending transaction is missing', async () => {
        const booking = createBooking({
            payment_method: 'PAYOS',
            payment_status: 'PENDING',
        });

        Booking.findById
            .mockResolvedValueOnce(booking)
            .mockResolvedValueOnce(booking);
        PaymentTransaction.findOne.mockReturnValueOnce(createQueryMock(null));

        await expect(
            paymentService.resolvePendingPayosPaymentForCash(adminUser, bookingId)
        ).rejects.toMatchObject({
            statusCode: 409,
            errorCode: 'BOOKING_PENDING_PAYOS_TRANSACTION_NOT_FOUND',
        });

        expect(payosService.createPaymentLink).not.toHaveBeenCalled();
        expect(payosService.cancelPaymentLink).not.toHaveBeenCalled();
    });

    it('accepts PayOS as the winner when payment completes during cash confirmation', async () => {
        const pendingBooking = createBooking({
            payment_method: 'PAYOS',
            payment_status: 'PENDING',
        });
        const paidBooking = createBooking({
            payment_method: 'PAYOS',
            payment_status: 'PAID',
            paid_at: new Date('2026-06-07T03:05:00.000Z'),
        });

        Booking.findById
            .mockResolvedValueOnce(pendingBooking)
            .mockResolvedValueOnce(paidBooking);
        PaymentTransaction.findOne.mockReturnValueOnce(createQueryMock(null));

        const result = await paymentService.resolvePendingPayosPaymentForCash(
            adminUser,
            bookingId
        );

        expect(result.resolution).toBe('PAYOS_PAID');
        expect(result.booking.payment_method).toBe('PAYOS');
        expect(result.booking.payment_status).toBe('PAID');
        expect(payosService.cancelPaymentLink).not.toHaveBeenCalled();
    });

    it('rolls canceling payment back to pending when PayOS cancel fails', async () => {
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
            save: jest.fn().mockResolvedValue(undefined),
        };
        const error = new Error('PayOS cancel unavailable');

        PaymentTransaction.findById
            .mockReturnValueOnce(createSessionQueryMock(payment))
            .mockResolvedValueOnce(payment);
        Booking.findById.mockReturnValue(createSessionQueryMock(booking));
        payosService.cancelPaymentLink.mockRejectedValue(error);

        await expect(paymentService.cancelPayosPayment(adminUser, payment._id)).rejects.toThrow('PayOS cancel unavailable');

        expect(payment.status).toBe('PENDING');
        expect(payment.raw_webhook).toMatchObject({
            source: 'CANCEL_PAYMENT_LINK',
            message: 'PayOS cancel unavailable',
        });
        expect(booking.payment_status).toBe('PENDING');
        expect(booking.save).not.toHaveBeenCalled();
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

    it('expires overdue pending PayOS payment and resets booking to unpaid', async () => {
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
            expires_at: new Date('2000-01-01T00:00:00.000Z'),
            save: jest.fn().mockResolvedValue(undefined),
        };

        PaymentTransaction.findById.mockReturnValue(createSessionQueryMock(payment));
        Booking.findById.mockReturnValue(createSessionQueryMock(booking));

        const result = await paymentService.expirePayosPayment(adminUser, payment._id);

        expect(payment.status).toBe('EXPIRED');
        expect(payment.expired_at).toBeInstanceOf(Date);
        expect(payment.save).toHaveBeenCalledWith({ session: mockSession });
        expect(booking.payment_method).toBe('CASH');
        expect(booking.payment_status).toBe('UNPAID');
        expect(booking.save).toHaveBeenCalledWith({ session: mockSession });
        expect(result.payment.status).toBe('EXPIRED');
        expect(result.booking.payment_status).toBe('UNPAID');
    });

    it('returns already expired PayOS payment idempotently', async () => {
        const booking = createBooking({
            payment_method: 'CASH',
            payment_status: 'UNPAID',
        });
        const payment = {
            _id: '507f1f77bcf86cd799439014',
            booking_id: bookingId,
            provider: 'PAYOS',
            method: 'QR',
            order_code: 178082640000012,
            payment_link_id: 'payos-link-id',
            amount: 120000,
            status: 'EXPIRED',
            expires_at: new Date('2000-01-01T00:00:00.000Z'),
            expired_at: new Date('2000-01-01T00:15:00.000Z'),
            save: jest.fn().mockResolvedValue(undefined),
        };

        PaymentTransaction.findById.mockReturnValue(createSessionQueryMock(payment));
        Booking.findById.mockReturnValue(createSessionQueryMock(booking));

        const result = await paymentService.expirePayosPayment(adminUser, payment._id);

        expect(payment.save).not.toHaveBeenCalled();
        expect(booking.save).not.toHaveBeenCalled();
        expect(result.payment.status).toBe('EXPIRED');
    });

    it('rejects expiring PayOS payment before expires at', async () => {
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
            expires_at: new Date('2999-01-01T00:00:00.000Z'),
            save: jest.fn().mockResolvedValue(undefined),
        };

        PaymentTransaction.findById.mockReturnValue(createSessionQueryMock(payment));
        Booking.findById.mockReturnValue(createSessionQueryMock(booking));

        await expect(paymentService.expirePayosPayment(adminUser, payment._id)).rejects.toMatchObject({
            statusCode: 400,
            errorCode: 'PAYMENT_NOT_EXPIRED',
        });

        expect(payment.save).not.toHaveBeenCalled();
        expect(booking.save).not.toHaveBeenCalled();
    });

    it('automatically expires due PayOS payments and releases the booking', async () => {
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
            active_payment_key: `PAYOS:${bookingId}`,
            expires_at: new Date('2026-01-01T00:00:00.000Z'),
            save: jest.fn().mockResolvedValue(undefined),
        };

        PaymentTransaction.find.mockReturnValue(createLimitedQueryMock([payment]));
        PaymentTransaction.findById.mockReturnValue(createSessionQueryMock(payment));
        Booking.findById.mockReturnValue(createSessionQueryMock(booking));

        const result = await paymentService.expireDuePayosPayments({
            now: new Date('2026-07-21T00:00:00.000Z'),
        });

        expect(result).toMatchObject({
            processed: 1,
            expired: 1,
            failed: 0,
        });
        expect(payment.status).toBe('EXPIRED');
        expect(payment.active_payment_key).toBeNull();
        expect(booking.payment_method).toBe('CASH');
        expect(booking.payment_status).toBe('UNPAID');
        expect(auditLogService.recordAuditEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'PAYMENT_EXPIRED',
                actorId: null,
            })
        );
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
        expect(auditLogService.recordAuditEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'PAYMENT_CONFIRMED',
                actorId: null,
            })
        );
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

    it('returns idempotent response for paid PayOS webhook even when booking is missing', async () => {
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
            amount: 999999,
            code: '00',
        });
        PaymentTransaction.findOne.mockReturnValue(createSessionQueryMock(payment));
        Booking.findById.mockReturnValue(createSessionQueryMock(null));

        const result = await paymentService.handlePayosWebhook({
            code: '00',
            success: true,
            data: { orderCode: 178082640000012 },
            signature: 'valid-signature',
        });

        expect(payment.save).not.toHaveBeenCalled();
        expect(bookingPaymentService.confirmBookingPaid).not.toHaveBeenCalled();
        expect(result.already_processed).toBe(true);
        expect(result.booking).toBeNull();
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

    it('ignores verified PayOS webhook when booking is missing', async () => {
        const payment = {
            booking_id: bookingId,
            order_code: 178082640000012,
            payment_link_id: 'payos-link-id',
            amount: 120000,
            status: 'PENDING',
            save: jest.fn(),
        };

        payosService.verifyWebhook = jest.fn().mockResolvedValue({
            orderCode: 178082640000012,
            paymentLinkId: 'payos-link-id',
            amount: 120000,
            code: '00',
        });
        PaymentTransaction.findOne.mockReturnValue(createSessionQueryMock(payment));
        Booking.findById.mockReturnValue(createSessionQueryMock(null));

        const result = await paymentService.handlePayosWebhook({
            code: '00',
            success: true,
            data: { orderCode: 178082640000012 },
            signature: 'valid-signature',
        });

        expect(result.received).toBe(true);
        expect(result.ignored).toBe(true);
        expect(result.reason).toBe('BOOKING_NOT_FOUND');
        expect(payment.save).not.toHaveBeenCalled();
        expect(bookingPaymentService.confirmBookingPaid).not.toHaveBeenCalled();
    });

    it('ignores verified PayOS webhook when booking is not completed', async () => {
        const booking = createBooking({
            status: 'IN_PROGRESS',
            payment_method: 'PAYOS',
            payment_status: 'PENDING',
        });
        const payment = {
            booking_id: bookingId,
            order_code: 178082640000012,
            payment_link_id: 'payos-link-id',
            amount: 120000,
            status: 'PENDING',
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

        expect(result.received).toBe(true);
        expect(result.ignored).toBe(true);
        expect(result.reason).toBe('BOOKING_NOT_PROCESSABLE');
        expect(payment.save).not.toHaveBeenCalled();
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
        const booking = createBooking({
            payment_method: 'PAYOS',
            payment_status: 'PENDING',
        });
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
        Booking.findById.mockReturnValue(createSessionQueryMock(booking));

        const result = await paymentService.handlePayosWebhook({
            code: '01',
            success: false,
            data: { orderCode: 178082640000012 },
            signature: 'valid-signature',
        });

        expect(payment.status).toBe('FAILED');
        expect(payment.raw_webhook).toMatchObject({ code: '01' });
        expect(payment.save).toHaveBeenCalledWith({ session: mockSession });
        expect(booking.payment_method).toBe('CASH');
        expect(booking.payment_status).toBe('UNPAID');
        expect(result.ignored).toBe(true);
    });
});
