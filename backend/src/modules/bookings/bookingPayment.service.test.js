jest.mock('./bookingReward.service', () => ({
    processCompletedPaidBooking: jest.fn(),
}));

const bookingRewardService = require('./bookingReward.service');
const bookingPaymentService = require('./bookingPayment.service');

describe('booking payment service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('marks booking paid with selected payment method and processes reward', async () => {
        const paidAt = new Date('2026-06-07T03:05:00.000Z');
        const session = { id: 'session' };
        const booking = {
            status: 'COMPLETED',
            payment_status: 'PENDING',
            payment_method: 'PAYOS',
            paid_at: null,
            save: jest.fn().mockResolvedValue(undefined),
        };

        bookingRewardService.processCompletedPaidBooking.mockResolvedValue({
            wash_history: { id: 'wash-history-id' },
            loyalty: { id: 'loyalty-id' },
            point_transaction: { id: 'point-transaction-id' },
            promotion_usage: null,
            notifications: [{ id: 'notification-id' }],
            already_processed: false,
        });

        const result = await bookingPaymentService.confirmBookingPaid({
            booking,
            paymentMethod: 'PAYOS',
            actorId: 'staff-id',
            paidAt,
            session,
        });

        expect(booking.payment_status).toBe('PAID');
        expect(booking.payment_method).toBe('PAYOS');
        expect(booking.paid_at).toBe(paidAt);
        expect(booking.save).toHaveBeenCalledWith({ session });
        expect(bookingRewardService.processCompletedPaidBooking).toHaveBeenCalledWith({
            booking,
            actorId: 'staff-id',
            session,
        });
        expect(result).toMatchObject({
            wash_history: { id: 'wash-history-id' },
            already_processed: false,
        });
    });

    it('keeps existing paid timestamp when booking is already paid', async () => {
        const existingPaidAt = new Date('2026-06-07T03:00:00.000Z');
        const newPaidAt = new Date('2026-06-07T03:05:00.000Z');
        const booking = {
            status: 'COMPLETED',
            payment_status: 'PAID',
            payment_method: 'CASH',
            paid_at: existingPaidAt,
            save: jest.fn().mockResolvedValue(undefined),
        };

        bookingRewardService.processCompletedPaidBooking.mockResolvedValue({
            wash_history: null,
            loyalty: null,
            point_transaction: null,
            promotion_usage: null,
            notifications: [],
            already_processed: true,
        });

        const result = await bookingPaymentService.confirmBookingPaid({
            booking,
            paymentMethod: 'PAYOS',
            actorId: 'staff-id',
            paidAt: newPaidAt,
        });

        expect(booking.payment_method).toBe('CASH');
        expect(booking.paid_at).toBe(existingPaidAt);
        expect(result.already_processed).toBe(true);
    });

    it('rejects payment confirmation for booking that is not completed', async () => {
        const booking = {
            status: 'IN_PROGRESS',
            payment_status: 'UNPAID',
            save: jest.fn(),
        };

        await expect(bookingPaymentService.confirmBookingPaid({
            booking,
            paymentMethod: 'CASH',
            actorId: 'staff-id',
        })).rejects.toMatchObject({
            statusCode: 400,
            errorCode: 'BOOKING_PAYMENT_NOT_ALLOWED',
        });
        expect(bookingRewardService.processCompletedPaidBooking).not.toHaveBeenCalled();
    });

    it('rejects payment confirmation without valid payment method', async () => {
        const booking = {
            status: 'COMPLETED',
            payment_status: 'UNPAID',
            save: jest.fn(),
        };

        await expect(bookingPaymentService.confirmBookingPaid({
            booking,
            actorId: 'staff-id',
        })).rejects.toMatchObject({
            statusCode: 400,
            errorCode: 'PAYMENT_METHOD_REQUIRED',
        });
    });

    it('does not convert a fully waived booking to paid', async () => {
        const booking = {
            status: 'COMPLETED',
            payment_status: 'WAIVED',
            save: jest.fn(),
        };

        await expect(bookingPaymentService.confirmBookingPaid({
            booking,
            paymentMethod: 'CASH',
            actorId: 'staff-id',
        })).rejects.toMatchObject({
            statusCode: 409,
            errorCode: 'BOOKING_PAYMENT_WAIVED',
        });
        expect(booking.save).not.toHaveBeenCalled();
        expect(bookingRewardService.processCompletedPaidBooking).not.toHaveBeenCalled();
    });
});
