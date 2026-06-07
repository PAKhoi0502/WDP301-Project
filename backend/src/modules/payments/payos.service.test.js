const mockCreate = jest.fn();
const mockGet = jest.fn();
const mockCancel = jest.fn();
const mockVerify = jest.fn();
const mockConfirm = jest.fn();
const mockPayOS = jest.fn(() => ({
    paymentRequests: {
        create: mockCreate,
        get: mockGet,
        cancel: mockCancel,
    },
    webhooks: {
        verify: mockVerify,
        confirm: mockConfirm,
    },
}));

class MockAPIError extends Error {}
class MockWebhookError extends Error {
    constructor(message) {
        super(message);
        this.name = 'WebhookError';
    }
}
class MockPayOSError extends Error {}

jest.mock('@payos/node', () => ({
    PayOS: mockPayOS,
    APIError: MockAPIError,
    WebhookError: MockWebhookError,
    PayOSError: MockPayOSError,
}));

const payosService = require('./payos.service');

describe('payos service wrapper', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-06-07T10:00:00.000Z').getTime());

        process.env = {
            ...originalEnv,
            PAYOS_CLIENT_ID: 'client-id',
            PAYOS_API_KEY: 'api-key',
            PAYOS_CHECKSUM_KEY: 'checksum-key',
            PAYOS_RETURN_URL: 'http://localhost:5173/payment/success',
            PAYOS_CANCEL_URL: 'http://localhost:5173/payment/cancel',
            PAYOS_PAYMENT_EXPIRE_MINUTES: '15',
        };
    });

    afterEach(() => {
        Date.now.mockRestore();
        process.env = originalEnv;
    });

    it('builds create payment link payload with default urls and expiration', () => {
        const payload = payosService.buildCreatePaymentLinkPayload({
            orderCode: 123456,
            amount: 120000,
            description: 'Booking 123456',
        });

        expect(payload).toMatchObject({
            orderCode: 123456,
            amount: 120000,
            description: 'Booking 123456',
            returnUrl: 'http://localhost:5173/payment/success',
            cancelUrl: 'http://localhost:5173/payment/cancel',
            expiredAt: 1780827300,
        });
    });

    it('creates payment link through PayOS SDK', async () => {
        mockCreate.mockResolvedValue({
            paymentLinkId: 'payos-link-id',
            checkoutUrl: 'https://pay.payos.vn/web/checkout/123456',
            qrCode: '000201010212',
        });

        const result = await payosService.createPaymentLink({
            orderCode: 123456,
            amount: 120000,
            description: 'Booking 123456',
        });

        expect(mockPayOS).toHaveBeenCalledWith(expect.objectContaining({
            clientId: 'client-id',
            apiKey: 'api-key',
            checksumKey: 'checksum-key',
        }));
        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
            orderCode: 123456,
            amount: 120000,
        }));
        expect(result.paymentLinkId).toBe('payos-link-id');
    });

    it('verifies webhook through PayOS SDK', async () => {
        mockVerify.mockResolvedValue({
            orderCode: 123456,
            amount: 120000,
            paymentLinkId: 'payos-link-id',
        });

        const result = await payosService.verifyWebhook({
            data: { orderCode: 123456 },
            signature: 'valid-signature',
        });

        expect(mockVerify).toHaveBeenCalledWith({
            data: { orderCode: 123456 },
            signature: 'valid-signature',
        });
        expect(result.orderCode).toBe(123456);
    });

    it('throws config error when PayOS env is missing', async () => {
        delete process.env.PAYOS_CLIENT_ID;

        await expect(payosService.createPaymentLink({
            orderCode: 123456,
            amount: 120000,
            description: 'Booking 123456',
        })).rejects.toMatchObject({
            statusCode: 500,
            errorCode: 'PAYOS_CONFIG_MISSING',
        });
    });

    it('normalizes webhook verification errors', async () => {
        mockVerify.mockRejectedValue(new MockWebhookError('Data not integrity'));

        await expect(payosService.verifyWebhook({
            data: { orderCode: 123456 },
            signature: 'invalid-signature',
        })).rejects.toMatchObject({
            statusCode: 400,
            errorCode: 'PAYOS_WEBHOOK_INVALID',
        });
    });
});
