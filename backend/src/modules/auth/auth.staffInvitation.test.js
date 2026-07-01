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
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
}));

jest.mock('../staff-profiles/staffProfile.model', () => ({
    findOneAndUpdate: jest.fn(),
}));

jest.mock('./models/passwordResetToken.model', () => ({
    findOne: jest.fn(),
    updateOne: jest.fn(),
}));

jest.mock('./services/phoneVerification.service', () => ({
    verifyOtp: jest.fn(),
    getVerifiedChallenge: jest.fn(),
    consumeVerifiedChallenge: jest.fn(),
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
const StaffProfile = require('../staff-profiles/staffProfile.model');
const PasswordReset = require('./models/passwordResetToken.model');
const phoneVerificationService = require('./services/phoneVerification.service');
const TokenService = require('./services/token.service');
const authCoreService = require('./services/auth.core.service');
const {
    PHONE_VERIFICATION_PURPOSES,
} = require('./phoneVerification.constant');
const {
    PASSWORD_RESET_PURPOSES,
} = require('./passwordResetPurpose.constant');
const {
    USER_ONBOARDING_STATUSES,
} = require('../../shared/constants/userOnboarding.constant');
const { USER_ROLES } = require('../../shared/constants/roles.constant');

describe('auth staff invitation', () => {
    const userId = '665f1b7b2a5f9d0012a12345';
    const inviteId = '665f1b7b2a5f9d0012a22222';
    const session = {
        withTransaction: jest.fn(async (callback) => callback()),
        endSession: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mongoose.startSession.mockResolvedValue(session);
        session.withTransaction.mockImplementation(async (callback) => callback());
        bcrypt.hash.mockResolvedValue('new-password-hash');
        TokenService.revokeAllByUser.mockResolvedValue({});
    });

    it('accepts a staff invitation and moves the account to phone verification', async () => {
        User.findOne.mockResolvedValue({
            _id: userId,
            phone: '+84901234567',
            role: USER_ROLES.STAFF,
            is_active: true,
            onboarding_status: USER_ONBOARDING_STATUSES.PENDING_PASSWORD_SETUP,
        });
        PasswordReset.findOne.mockResolvedValue({
            _id: inviteId,
            attempt_count: 0,
        });
        User.findOneAndUpdate.mockResolvedValue({
            _id: userId,
            phone: '+84901234567',
            role: USER_ROLES.STAFF,
            is_active: true,
            onboarding_status: USER_ONBOARDING_STATUSES.PENDING_PHONE_VERIFICATION,
        });
        PasswordReset.updateOne.mockResolvedValue({ modifiedCount: 1 });

        const result = await authCoreService.acceptStaffInvitation({
            phone: '0901234567',
            invite_token: 'invite-token',
            new_password: 'Staff@123',
        });

        expect(PasswordReset.findOne).toHaveBeenCalledWith(expect.objectContaining({
            user_id: userId,
            purpose: PASSWORD_RESET_PURPOSES.STAFF_INVITE,
            is_used: false,
        }));
        expect(User.findOneAndUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                _id: userId,
                role: USER_ROLES.STAFF,
                onboarding_status: USER_ONBOARDING_STATUSES.PENDING_PASSWORD_SETUP,
            }),
            {
                $set: expect.objectContaining({
                    password_hash: 'new-password-hash',
                    onboarding_status: USER_ONBOARDING_STATUSES.PENDING_PHONE_VERIFICATION,
                }),
            },
            {
                new: true,
                session,
            }
        );
        expect(TokenService.revokeAllByUser).toHaveBeenCalledWith(
            userId,
            'staff_invitation_accepted',
            session
        );
        expect(result.user.onboarding_status).toBe(
            USER_ONBOARDING_STATUSES.PENDING_PHONE_VERIFICATION
        );
    });

    it('activates staff access when staff activation OTP is verified', async () => {
        phoneVerificationService.verifyOtp.mockResolvedValue({
            verification_token: 'v'.repeat(96),
            phone: '+84901234567',
            purpose: PHONE_VERIFICATION_PURPOSES.STAFF_ACTIVATION,
        });
        phoneVerificationService.getVerifiedChallenge.mockResolvedValue({
            _id: '665f1b7b2a5f9d0012a33333',
        });
        User.findOneAndUpdate.mockResolvedValue({
            _id: userId,
            phone: '+84901234567',
            role: USER_ROLES.STAFF,
            is_active: true,
            phone_verified_at: new Date(),
            onboarding_status: USER_ONBOARDING_STATUSES.ACTIVE,
        });
        StaffProfile.findOneAndUpdate.mockResolvedValue({
            _id: '665f1b7b2a5f9d0012a44444',
            user_id: userId,
            is_active: true,
        });
        phoneVerificationService.consumeVerifiedChallenge.mockResolvedValue({});

        const result = await authCoreService.verifyPhoneOtp({
            challenge_id: '665f1b7b2a5f9d0012a55555',
            otp: '123456',
            user_id: userId,
        });

        expect(phoneVerificationService.getVerifiedChallenge).toHaveBeenCalledWith({
            phone: '+84901234567',
            purpose: PHONE_VERIFICATION_PURPOSES.STAFF_ACTIVATION,
            verificationToken: 'v'.repeat(96),
            userId,
            session,
        });
        expect(User.findOneAndUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                _id: userId,
                role: USER_ROLES.STAFF,
                onboarding_status: USER_ONBOARDING_STATUSES.PENDING_PHONE_VERIFICATION,
                phone_verified_at: null,
            }),
            {
                $set: expect.objectContaining({
                    phone_verified_at: expect.any(Date),
                    onboarding_status: USER_ONBOARDING_STATUSES.ACTIVE,
                }),
            },
            {
                new: true,
                session,
            }
        );
        expect(StaffProfile.findOneAndUpdate).toHaveBeenCalledWith(
            { user_id: userId },
            { $set: { is_active: true } },
            { new: true, session }
        );
        expect(phoneVerificationService.consumeVerifiedChallenge).toHaveBeenCalledWith(
            '665f1b7b2a5f9d0012a33333',
            session
        );
        expect(result.activated).toBe(true);
        expect(result.onboarding_status).toBe(USER_ONBOARDING_STATUSES.ACTIVE);
    });
});
