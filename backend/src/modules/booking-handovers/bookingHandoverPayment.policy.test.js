jest.mock('./bookingHandover.model', () => ({
    findOne: jest.fn(),
}));

const BookingHandover = require('./bookingHandover.model');
const bookingHandoverPaymentPolicy = require('./bookingHandoverPayment.policy');

describe('booking handover payment policy', () => {
    const bookingId = '507f1f77bcf86cd799439011';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('allows payment only after vehicle condition acceptance', async () => {
        BookingHandover.findOne.mockResolvedValue({
            state: 'READY_FOR_CUSTOMER',
            customer_response: 'ACCEPTED',
        });

        await expect(
            bookingHandoverPaymentPolicy.assertPaymentCollectionAllowed(bookingId)
        ).resolves.toMatchObject({
            state: 'READY_FOR_CUSTOMER',
            customer_response: 'ACCEPTED',
        });
    });

    it('blocks payment while a handover issue is on hold', async () => {
        BookingHandover.findOne.mockResolvedValue({
            state: 'ON_HOLD',
            customer_response: 'ISSUE_REPORTED',
        });

        await expect(
            bookingHandoverPaymentPolicy.assertPaymentCollectionAllowed(bookingId)
        ).rejects.toMatchObject({
            errorCode: 'HANDOVER_PAYMENT_ON_HOLD',
        });
    });

    it('blocks payment before customer acceptance', async () => {
        BookingHandover.findOne.mockResolvedValue({
            state: 'READY_FOR_CUSTOMER',
            customer_response: 'PENDING',
        });

        await expect(
            bookingHandoverPaymentPolicy.assertPaymentCollectionAllowed(bookingId)
        ).rejects.toMatchObject({
            errorCode: 'HANDOVER_CUSTOMER_ACCEPTANCE_REQUIRED',
        });
    });
});
