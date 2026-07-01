jest.mock('mongoose', () => {
    const actualMongoose = jest.requireActual('mongoose');

    return {
        ...actualMongoose,
        startSession: jest.fn(),
    };
});

jest.mock('bcryptjs', () => ({
    compare: jest.fn(),
}));

jest.mock('./user.model', () => ({
    findById: jest.fn(),
    exists: jest.fn(),
    findByIdAndUpdate: jest.fn(),
}));

jest.mock('../auth/services/token.service', () => ({
    revokeAllByUser: jest.fn(),
}));

jest.mock('../auth/services/phoneVerification.service', () => ({
    getVerifiedChallenge: jest.fn(),
    consumeVerifiedChallenge: jest.fn(),
}));

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('./user.model');
const TokenService = require('../auth/services/token.service');
const phoneVerificationService = require('../auth/services/phoneVerification.service');
const userService = require('./user.service');
const {
    PHONE_VERIFICATION_PURPOSES,
} = require('../auth/phoneVerification.constant');

describe('user phone verification', () => {
    const userId = '665f1b7b2a5f9d0012a12345';
    const session = {
        withTransaction: jest.fn(async (callback) => callback()),
        endSession: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mongoose.startSession.mockResolvedValue(session);
        session.withTransaction.mockImplementation(async (callback) => callback());
        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: userId,
                phone: '+84901234567',
                password_hash: 'password-hash',
            }),
        });
        User.exists.mockResolvedValue(false);
        User.findByIdAndUpdate.mockResolvedValue({
            _id: userId,
            phone: '+84912345678',
            phone_verified_at: new Date(),
            is_active: true,
        });
        bcrypt.compare.mockResolvedValue(true);
        phoneVerificationService.getVerifiedChallenge.mockResolvedValue({
            _id: '665f1b7b2a5f9d0012a54321',
        });
        phoneVerificationService.consumeVerifiedChallenge.mockResolvedValue({});
        TokenService.revokeAllByUser.mockResolvedValue({});
    });

    it('changes phone after password and OTP verification and revokes sessions', async () => {
        await userService.updateMe(userId, {
            phone: '+84912345678',
            current_password: 'Customer@123',
            phone_verification_token: 'b'.repeat(96),
        });

        expect(bcrypt.compare).toHaveBeenCalledWith(
            'Customer@123',
            'password-hash'
        );
        expect(phoneVerificationService.getVerifiedChallenge).toHaveBeenCalledWith({
            phone: '+84912345678',
            purpose: PHONE_VERIFICATION_PURPOSES.CHANGE_PHONE,
            verificationToken: 'b'.repeat(96),
            userId,
            session,
        });
        expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
            userId,
            {
                $set: expect.objectContaining({
                    phone: '+84912345678',
                    phone_verified_at: expect.any(Date),
                }),
            },
            {
                new: true,
                runValidators: true,
                session,
            }
        );
        expect(TokenService.revokeAllByUser).toHaveBeenCalledWith(
            userId,
            'phone_changed',
            session
        );
        expect(phoneVerificationService.consumeVerifiedChallenge).toHaveBeenCalledWith(
            '665f1b7b2a5f9d0012a54321',
            session
        );
        expect(session.withTransaction).toHaveBeenCalledTimes(1);
        expect(session.endSession).toHaveBeenCalledTimes(1);
    });

    it('rejects a changed phone without the current password', async () => {
        await expect(
            userService.updateMe(userId, {
                phone: '0912345678',
                phone_verification_token: 'b'.repeat(96),
            })
        ).rejects.toMatchObject({
            errorCode: 'CURRENT_PASSWORD_REQUIRED',
        });
    });

    it('changes a user phone by admin after OTP verification and revokes sessions', async () => {
        const adminId = '665f1b7b2a5f9d0012a99999';

        User.findById.mockResolvedValue({
            _id: userId,
            phone: '+84901234567',
            role: 'CUSTOMER',
            is_active: true,
        });

        await userService.updateUser(
            userId,
            {
                phone: '+84912345678',
                phone_verification_token: 'c'.repeat(96),
            },
            adminId
        );

        expect(phoneVerificationService.getVerifiedChallenge).toHaveBeenCalledWith({
            phone: '+84912345678',
            purpose: PHONE_VERIFICATION_PURPOSES.CHANGE_PHONE,
            verificationToken: 'c'.repeat(96),
            userId: adminId,
            session,
        });
        expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
            userId,
            {
                $set: expect.objectContaining({
                    phone: '+84912345678',
                    phone_verified_at: expect.any(Date),
                }),
            },
            {
                new: true,
                runValidators: true,
                session,
            }
        );
        expect(TokenService.revokeAllByUser).toHaveBeenCalledWith(
            userId,
            'phone_changed_by_admin',
            session
        );
        expect(phoneVerificationService.consumeVerifiedChallenge).toHaveBeenCalledWith(
            '665f1b7b2a5f9d0012a54321',
            session
        );
    });

    it('rejects an admin phone change without OTP verification', async () => {
        User.findById.mockResolvedValue({
            _id: userId,
            phone: '+84901234567',
            role: 'CUSTOMER',
            is_active: true,
        });

        await expect(
            userService.updateUser(
                userId,
                {
                    phone: '+84912345678',
                },
                '665f1b7b2a5f9d0012a99999'
            )
        ).rejects.toMatchObject({
            errorCode: 'PHONE_VERIFICATION_TOKEN_REQUIRED',
        });
    });
});
