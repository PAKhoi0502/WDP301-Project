const mockSession = {
    withTransaction: jest.fn(async (callback) => callback()),
    endSession: jest.fn(),
};

jest.mock('mongoose', () => {
    const actualMongoose = jest.requireActual('mongoose');

    return {
        ...actualMongoose,
        startSession: jest.fn(() => mockSession),
    };
});

jest.mock('./booking.model', () => ({
    findById: jest.fn(),
}));

jest.mock('./bookingPayment.service', () => ({
    confirmBookingPaid: jest.fn(),
}));

const Booking = require('./booking.model');
const bookingPaymentService = require('./bookingPayment.service');
const bookingService = require('./booking.service');

describe('booking cash mark paid flow', () => {
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
        reward_processed: false,
        note: null,
        save: jest.fn().mockResolvedValue(undefined),
        ...overrides,
    });

    const createFindByIdSessionQuery = (value) => ({
        session: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        then: (resolve) => Promise.resolve(resolve(value)),
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockSession.withTransaction.mockImplementation(async (callback) => callback());
        mockSession.endSession.mockResolvedValue(undefined);
        bookingPaymentService.confirmBookingPaid.mockResolvedValue({
            wash_history: { id: 'wash-history-id' },
            loyalty: { id: 'loyalty-id' },
            point_transaction: { id: 'point-transaction-id' },
            promotion_usage: { id: 'promotion-usage-id' },
            notifications: [{ id: 'notification-id' }],
            already_processed: false,
        });
    });

    it('keeps cash mark paid working through shared confirmBookingPaid logic', async () => {
        const booking = createBooking();

        Booking.findById
            .mockReturnValueOnce(createFindByIdSessionQuery(booking))
            .mockReturnValueOnce(createFindByIdSessionQuery({
                ...booking,
                payment_method: 'CASH',
                payment_status: 'PAID',
                paid_at: new Date('2026-06-07T03:05:00.000Z'),
            }));

        const result = await bookingService.markPaid(adminUser, bookingId, {
            note: 'cash collected',
        });

        expect(booking.note).toBe('cash collected');
        expect(bookingPaymentService.confirmBookingPaid).toHaveBeenCalledWith({
            booking,
            paymentMethod: 'CASH',
            actorId: adminUser._id,
            session: mockSession,
        });
        expect(result.booking.payment_method).toBe('CASH');
        expect(result.booking.payment_status).toBe('PAID');
        expect(result.wash_history).toEqual({ id: 'wash-history-id' });
        expect(result.already_processed).toBe(false);
    });

    it('blocks cash mark paid while a PayOS payment is pending', async () => {
        const booking = createBooking({
            payment_method: 'PAYOS',
            payment_status: 'PENDING',
        });

        Booking.findById.mockReturnValueOnce(createFindByIdSessionQuery(booking));

        await expect(bookingService.markPaid(adminUser, bookingId)).rejects.toMatchObject({
            statusCode: 409,
            errorCode: 'BOOKING_PENDING_PAYOS_PAYMENT',
        });
        expect(bookingPaymentService.confirmBookingPaid).not.toHaveBeenCalled();
    });
});
