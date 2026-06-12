jest.mock('mongoose', () => {
    const actualMongoose = jest.requireActual('mongoose');

    return {
        ...actualMongoose,
        startSession: jest.fn(),
    };
});

jest.mock('bcryptjs', () => ({
    hash: jest.fn(),
    compare: jest.fn(),
}));

jest.mock('../users/user.model', () => ({
    exists: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
    updateOne: jest.fn(),
}));

jest.mock('./services/phoneVerification.service', () => ({
    getVerifiedChallenge: jest.fn(),
    consumeVerifiedChallenge: jest.fn(),
    requestVerification: jest.fn(),
    verifyOtp: jest.fn(),
}));

jest.mock('./services/token.service', () => ({
    createRefreshToken: jest.fn(),
    revokeAllByUser: jest.fn(),
}));

jest.mock('../notifications/notification.service', () => ({
    createEmailNotification: jest.fn(),
}));

jest.mock('../wash-histories/walkInClaim.service', () => ({
    claimWalkInHistoryForCustomer: jest.fn(),
}));

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../users/user.model');
const phoneVerificationService = require('./services/phoneVerification.service');
const walkInClaimService = require('../wash-histories/walkInClaim.service');
const authCoreService = require('./services/auth.core.service');
const {
    PHONE_VERIFICATION_PURPOSES,
} = require('./phoneVerification.constant');

describe('auth registration phone verification', () => {
    const session = {
        withTransaction: jest.fn(async (callback) => callback()),
        endSession: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mongoose.startSession.mockResolvedValue(session);
        session.withTransaction.mockImplementation(async (callback) => callback());
        User.exists.mockResolvedValue(false);
        bcrypt.hash.mockResolvedValue('password-hash');
        phoneVerificationService.getVerifiedChallenge.mockResolvedValue({
            _id: '665f1b7b2a5f9d0012a12345',
        });
        phoneVerificationService.consumeVerifiedChallenge.mockResolvedValue({});
        walkInClaimService.claimWalkInHistoryForCustomer.mockResolvedValue({
            claimed_bookings: 0,
            claimed_wash_histories: 0,
            linked_promotion_usages: 0,
        });
        User.create.mockImplementation(async ([payload]) => ([
            {
                _id: '665f1b7b2a5f9d0012a54321',
                ...payload,
            },
        ]));
    });

    it('creates a verified user only after validating the verification token', async () => {
        const result = await authCoreService.register({
            phone: '+84901234567',
            password: 'Customer@123',
            phone_verification_token: 'a'.repeat(96),
        });

        expect(phoneVerificationService.getVerifiedChallenge).toHaveBeenCalledWith({
            phone: '+84901234567',
            purpose: PHONE_VERIFICATION_PURPOSES.REGISTER,
            verificationToken: 'a'.repeat(96),
            session,
        });
        expect(User.create).toHaveBeenCalledWith(
            [
                expect.objectContaining({
                    phone: '+84901234567',
                    phone_verified_at: expect.any(Date),
                }),
            ],
            { session }
        );
        expect(phoneVerificationService.consumeVerifiedChallenge).toHaveBeenCalledWith(
            '665f1b7b2a5f9d0012a12345',
            session
        );
        expect(session.withTransaction).toHaveBeenCalledTimes(1);
        expect(session.endSession).toHaveBeenCalledTimes(1);
        expect(walkInClaimService.claimWalkInHistoryForCustomer).toHaveBeenCalledWith({
            customerId: '665f1b7b2a5f9d0012a54321',
            phone: '+84901234567',
            phoneVerifiedAt: expect.any(Date),
        });
        expect(result.user.phone_verified_at).toEqual(expect.any(Date));
    });
});
