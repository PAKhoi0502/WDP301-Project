jest.mock('../users/user.model', () => ({
    exists: jest.fn(),
    findById: jest.fn(),
}));

jest.mock('./models/phoneVerification.model', () => ({
    findOne: jest.fn(),
    countDocuments: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn(),
    deleteOne: jest.fn(),
    updateOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
}));

jest.mock('../sms/sms.service', () => ({
    sendOtp: jest.fn(),
}));

const User = require('../users/user.model');
const PhoneVerification = require('./models/phoneVerification.model');
const smsService = require('../sms/sms.service');
const phoneVerificationService = require('./services/phoneVerification.service');
const {
    PHONE_VERIFICATION_PURPOSES,
} = require('./phoneVerification.constant');
const { USER_ROLES } = require('../../shared/constants/roles.constant');
const {
    USER_ONBOARDING_STATUSES,
} = require('../../shared/constants/userOnboarding.constant');

describe('phone verification service', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = {
            ...originalEnv,
            NODE_ENV: 'test',
            SMS_PROVIDER: 'mock',
            OTP_SECRET: 'test-otp-secret',
            OTP_EXPIRES_IN_MINUTES: '5',
            OTP_MAX_ATTEMPTS: '5',
            OTP_REQUEST_COOLDOWN_SECONDS: '60',
            OTP_RATE_LIMIT_WINDOW_MINUTES: '60',
            OTP_RATE_LIMIT_MAX_REQUESTS: '5',
            OTP_IP_RATE_LIMIT_MAX_REQUESTS: '20',
            PHONE_VERIFICATION_TOKEN_EXPIRES_IN_MINUTES: '10',
        };
        User.exists.mockResolvedValue(false);
        PhoneVerification.findOne.mockReturnValue({
            sort: jest.fn().mockResolvedValue(null),
        });
        PhoneVerification.countDocuments.mockResolvedValue(0);
        PhoneVerification.updateMany.mockResolvedValue({ modifiedCount: 0 });
        PhoneVerification.create.mockResolvedValue({});
        PhoneVerification.deleteOne.mockResolvedValue({ deletedCount: 1 });
        PhoneVerification.updateOne.mockResolvedValue({ modifiedCount: 1 });
        smsService.sendOtp.mockImplementation(async ({ otp }) => ({
            provider: 'mock',
            status: 'SENT',
            debug_otp: otp,
        }));
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('requests and verifies a registration OTP without storing the clear OTP', async () => {
        const requestResult = await phoneVerificationService.requestVerification({
            phone: '+84901234567',
            purpose: PHONE_VERIFICATION_PURPOSES.REGISTER,
            requestIp: '127.0.0.1',
            userAgent: 'jest',
        });
        const createdChallenge = PhoneVerification.create.mock.calls[0][0];

        expect(requestResult.phone).toBe('+84901234567');
        expect(requestResult.debug_otp).toMatch(/^[0-9]{6}$/);
        expect(createdChallenge.otp_hash).not.toBe(requestResult.debug_otp);
        expect(createdChallenge.user_id).toBeNull();

        PhoneVerification.findOne.mockResolvedValue({
            _id: createdChallenge._id,
            phone: createdChallenge.phone,
            purpose: createdChallenge.purpose,
            user_id: null,
            otp_hash: createdChallenge.otp_hash,
            attempt_count: 0,
            expires_at: createdChallenge.expires_at,
            verified_at: null,
        });
        PhoneVerification.findOneAndUpdate.mockResolvedValue({
            phone: createdChallenge.phone,
            purpose: createdChallenge.purpose,
        });

        const verifyResult = await phoneVerificationService.verifyOtp({
            challengeId: requestResult.challenge_id,
            otp: requestResult.debug_otp,
        });

        expect(verifyResult.verification_token).toMatch(/^[0-9a-f]{96}$/);
        expect(PhoneVerification.findOneAndUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                _id: createdChallenge._id,
                verified_at: null,
            }),
            expect.objectContaining({
                $set: expect.objectContaining({
                    verification_token_hash: expect.any(String),
                    verified_at: expect.any(Date),
                }),
            }),
            { new: true }
        );
    });

    it('invalidates a challenge after the maximum wrong attempts', async () => {
        PhoneVerification.findOne.mockResolvedValue({
            _id: '665f1b7b2a5f9d0012a12345',
            phone: '+84901234567',
            purpose: PHONE_VERIFICATION_PURPOSES.REGISTER,
            user_id: null,
            otp_hash: '0'.repeat(64),
            attempt_count: 4,
            expires_at: new Date(Date.now() + 60000),
            verified_at: null,
        });

        await expect(
            phoneVerificationService.verifyOtp({
                challengeId: '665f1b7b2a5f9d0012a12345',
                otp: '123456',
            })
        ).rejects.toMatchObject({
            errorCode: 'OTP_INVALID_OR_EXPIRED',
        });

        expect(PhoneVerification.updateOne).toHaveBeenCalledWith(
            expect.objectContaining({
                _id: '665f1b7b2a5f9d0012a12345',
                attempt_count: { $lt: 5 },
            }),
            {
                $inc: {
                    attempt_count: 1,
                },
                $set: {
                    invalidated_at: expect.any(Date),
                },
            }
        );
    });

    it('removes the challenge when SMS delivery fails', async () => {
        smsService.sendOtp.mockRejectedValue(new Error('SMS unavailable'));

        await expect(
            phoneVerificationService.requestVerification({
                phone: '+84901234567',
                purpose: PHONE_VERIFICATION_PURPOSES.REGISTER,
                requestIp: '127.0.0.1',
            })
        ).rejects.toThrow('SMS unavailable');

        const createdChallenge = PhoneVerification.create.mock.calls[0][0];

        expect(PhoneVerification.deleteOne).toHaveBeenCalledWith({
            _id: createdChallenge._id,
        });
    });

    it('requires authentication when requesting a change-phone OTP', async () => {
        await expect(
            phoneVerificationService.requestVerification({
                phone: '0912345678',
                purpose: PHONE_VERIFICATION_PURPOSES.CHANGE_PHONE,
            })
        ).rejects.toMatchObject({
            errorCode: 'AUTHENTICATION_REQUIRED',
        });

        expect(smsService.sendOtp).not.toHaveBeenCalled();
    });

    it('requests a staff activation OTP for the authenticated pending staff phone', async () => {
        User.findById.mockResolvedValue({
            _id: '665f1b7b2a5f9d0012a99999',
            phone: '+84901234567',
            role: USER_ROLES.STAFF,
            phone_verified_at: null,
            onboarding_status: USER_ONBOARDING_STATUSES.PENDING_PHONE_VERIFICATION,
        });

        const requestResult = await phoneVerificationService.requestVerification({
            phone: '0901234567',
            purpose: PHONE_VERIFICATION_PURPOSES.STAFF_ACTIVATION,
            userId: '665f1b7b2a5f9d0012a99999',
            requestIp: '127.0.0.1',
        });
        const createdChallenge = PhoneVerification.create.mock.calls[0][0];

        expect(requestResult.purpose).toBe(PHONE_VERIFICATION_PURPOSES.STAFF_ACTIVATION);
        expect(createdChallenge.user_id).toBe('665f1b7b2a5f9d0012a99999');
        expect(smsService.sendOtp).toHaveBeenCalled();
    });

    it('rejects staff activation OTP when the phone does not match the account', async () => {
        User.findById.mockResolvedValue({
            _id: '665f1b7b2a5f9d0012a99999',
            phone: '+84901234567',
            role: USER_ROLES.STAFF,
            phone_verified_at: null,
            onboarding_status: USER_ONBOARDING_STATUSES.PENDING_PHONE_VERIFICATION,
        });

        await expect(
            phoneVerificationService.requestVerification({
                phone: '0912345678',
                purpose: PHONE_VERIFICATION_PURPOSES.STAFF_ACTIVATION,
                userId: '665f1b7b2a5f9d0012a99999',
                requestIp: '127.0.0.1',
            })
        ).rejects.toMatchObject({
            errorCode: 'STAFF_ACTIVATION_PHONE_MISMATCH',
        });

        expect(smsService.sendOtp).not.toHaveBeenCalled();
    });

    it('binds a walk-in case OTP to the requesting garage staff user', async () => {
        User.findById.mockResolvedValue({
            _id: '665f1b7b2a5f9d0012a99999',
            role: USER_ROLES.STAFF,
        });

        const result = await phoneVerificationService.requestVerification({
            phone: '0901234567',
            purpose: PHONE_VERIFICATION_PURPOSES.WALK_IN_CUSTOMER_CASE,
            userId: '665f1b7b2a5f9d0012a99999',
            requestIp: '127.0.0.1',
        });

        expect(result.purpose).toBe(PHONE_VERIFICATION_PURPOSES.WALK_IN_CUSTOMER_CASE);
        expect(PhoneVerification.create.mock.calls[0][0].user_id)
            .toBe('665f1b7b2a5f9d0012a99999');
    });

    it('does not allow a customer account to request a walk-in case OTP', async () => {
        User.findById.mockResolvedValue({
            _id: '665f1b7b2a5f9d0012a99999',
            role: USER_ROLES.CUSTOMER,
        });

        await expect(phoneVerificationService.requestVerification({
            phone: '0901234567',
            purpose: PHONE_VERIFICATION_PURPOSES.WALK_IN_CUSTOMER_CASE,
            userId: '665f1b7b2a5f9d0012a99999',
        })).rejects.toMatchObject({ errorCode: 'WALK_IN_CASE_VERIFICATION_NOT_ALLOWED' });
    });

    it('does not expose debug OTP in production unless explicitly enabled', async () => {
        process.env.NODE_ENV = 'production';

        const requestResult = await phoneVerificationService.requestVerification({
            phone: '+84901234567',
            purpose: PHONE_VERIFICATION_PURPOSES.REGISTER,
            requestIp: '127.0.0.1',
        });

        expect(requestResult.debug_otp).toBeUndefined();
    });

    it('exposes debug OTP in production when explicitly enabled', async () => {
        process.env.NODE_ENV = 'production';
        process.env.SHOW_DEBUG_OTP = 'true';

        const requestResult = await phoneVerificationService.requestVerification({
            phone: '+84901234567',
            purpose: PHONE_VERIFICATION_PURPOSES.REGISTER,
            requestIp: '127.0.0.1',
        });

        expect(requestResult.debug_otp).toMatch(/^[0-9]{6}$/);
    });
});
