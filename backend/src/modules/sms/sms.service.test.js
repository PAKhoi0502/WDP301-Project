jest.mock('./providers/mockSms.provider', () => ({
    sendOtp: jest.fn(),
}));

const mockSmsProvider = require('./providers/mockSms.provider');
const smsService = require('./sms.service');

describe('sms service', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = {
            ...originalEnv,
            NODE_ENV: 'development',
            SMS_PROVIDER: 'mock',
        };
        mockSmsProvider.sendOtp.mockResolvedValue({
            provider: 'mock',
            status: 'SENT',
            debug_otp: '123456',
        });
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('uses the mock provider with an SMS-ready phone number', async () => {
        await smsService.sendOtp({
            phone: '0901234567',
            otp: '123456',
            expiresInMinutes: 5,
        });

        expect(mockSmsProvider.sendOtp).toHaveBeenCalledWith({
            phone: '+84901234567',
            otp: '123456',
            expiresInMinutes: 5,
        });
    });

    it('rejects the mock provider in production without explicit opt-in', () => {
        process.env.NODE_ENV = 'production';

        expect(() => smsService.validateConfiguration()).toThrow(
            'Mock SMS provider cannot be used in production without ALLOW_MOCK_SMS=true'
        );
    });

    it('allows the mock provider in production when explicitly enabled', async () => {
        process.env.NODE_ENV = 'production';
        process.env.ALLOW_MOCK_SMS = 'true';

        await smsService.sendOtp({
            phone: '0901234567',
            otp: '123456',
            expiresInMinutes: 5,
        });

        expect(mockSmsProvider.sendOtp).toHaveBeenCalledWith({
            phone: '+84901234567',
            otp: '123456',
            expiresInMinutes: 5,
        });
    });
});
