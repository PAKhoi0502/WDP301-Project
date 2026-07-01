jest.mock('mongoose', () => {
    const actualMongoose = jest.requireActual('mongoose');

    return {
        ...actualMongoose,
        startSession: jest.fn(),
    };
});

jest.mock('bcryptjs', () => ({
    hash: jest.fn(),
}));

jest.mock('./staffProfile.model', () => ({
    findById: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    exists: jest.fn(),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
}));

jest.mock('../users/user.model', () => ({
    exists: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
}));

jest.mock('../garages/garage.model', () => ({
    findById: jest.fn(),
}));

jest.mock('../auth/models/passwordResetToken.model', () => ({
    updateMany: jest.fn(),
    create: jest.fn(),
}));

jest.mock('../notifications/notification.service', () => ({
    createEmailNotification: jest.fn(),
}));

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const StaffProfile = require('./staffProfile.model');
const User = require('../users/user.model');
const Garage = require('../garages/garage.model');
const PasswordReset = require('../auth/models/passwordResetToken.model');
const notificationService = require('../notifications/notification.service');
const staffProfileService = require('./staffProfile.service');
const { USER_ROLES } = require('../../shared/constants/roles.constant');
const {
    USER_ONBOARDING_STATUSES,
} = require('../../shared/constants/userOnboarding.constant');
const {
    PASSWORD_RESET_PURPOSES,
} = require('../auth/passwordResetPurpose.constant');
const {
    NOTIFICATION_TYPES,
} = require('../../shared/constants/notification.constant');

describe('staff invitation service', () => {
    const originalEnv = process.env;
    const userId = '665f1b7b2a5f9d0012a12345';
    const staffProfileId = '665f1b7b2a5f9d0012a22222';
    const garageId = '665f1b7b2a5f9d0012a33333';
    const session = {
        withTransaction: jest.fn(async (callback) => callback()),
        endSession: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = {
            ...originalEnv,
            NODE_ENV: 'development',
            STAFF_INVITE_EXPIRES_IN_HOURS: '24',
            STAFF_INVITE_URL: 'https://app.example.com/staff-invite',
        };
        mongoose.startSession.mockResolvedValue(session);
        session.withTransaction.mockImplementation(async (callback) => callback());
        bcrypt.hash.mockResolvedValue('placeholder-password-hash');
        User.exists.mockResolvedValue(false);
        StaffProfile.exists.mockResolvedValue(false);
        Garage.findById.mockResolvedValue({
            _id: garageId,
            is_active: true,
        });
        PasswordReset.updateMany.mockResolvedValue({ modifiedCount: 0 });
        PasswordReset.create.mockResolvedValue({});
        notificationService.createEmailNotification.mockResolvedValue({
            email_status: 'SENT',
        });
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('creates a pending staff account, inactive staff profile, and invitation email', async () => {
        const createdUser = {
            _id: userId,
            full_name: 'Staff A',
            email: 'staff@example.com',
            phone: '+84901234567',
            role: USER_ROLES.STAFF,
            is_active: true,
            phone_verified_at: null,
            onboarding_status: USER_ONBOARDING_STATUSES.PENDING_PASSWORD_SETUP,
        };
        const createdStaffProfile = {
            _id: staffProfileId,
            user_id: userId,
            staff_code: 'STF100',
            staff_type: 'CUSTOMER_SERVICE_STAFF',
            garage_id: garageId,
            is_active: false,
        };
        const populatedStaffProfile = {
            ...createdStaffProfile,
            user_id: createdUser,
        };

        User.create.mockResolvedValue([createdUser]);
        StaffProfile.create.mockResolvedValue([createdStaffProfile]);
        StaffProfile.findById.mockReturnValue({
            populate: jest.fn().mockResolvedValue(populatedStaffProfile),
        });

        const result = await staffProfileService.inviteStaff({
            full_name: 'Staff A',
            email: 'STAFF@example.com',
            phone: '0901234567',
            staff_code: 'stf100',
            staff_type: 'CUSTOMER_SERVICE_STAFF',
            garage_id: garageId,
        });

        expect(User.create).toHaveBeenCalledWith(
            [
                expect.objectContaining({
                    full_name: 'Staff A',
                    email: 'staff@example.com',
                    phone: '+84901234567',
                    password_hash: 'placeholder-password-hash',
                    role: USER_ROLES.STAFF,
                    phone_verified_at: null,
                    onboarding_status: USER_ONBOARDING_STATUSES.PENDING_PASSWORD_SETUP,
                }),
            ],
            { session }
        );
        expect(StaffProfile.create).toHaveBeenCalledWith(
            [
                expect.objectContaining({
                    user_id: userId,
                    staff_code: 'STF100',
                    staff_type: 'CUSTOMER_SERVICE_STAFF',
                    garage_id: garageId,
                    is_active: false,
                }),
            ],
            { session }
        );
        expect(PasswordReset.create).toHaveBeenCalledWith(
            [
                expect.objectContaining({
                    user_id: userId,
                    phone: '+84901234567',
                    purpose: PASSWORD_RESET_PURPOSES.STAFF_INVITE,
                }),
            ],
            { session }
        );
        expect(notificationService.createEmailNotification).toHaveBeenCalledWith(
            expect.objectContaining({
                userId,
                recipientEmail: 'staff@example.com',
                type: NOTIFICATION_TYPES.AUTH_STAFF_INVITED,
                text: expect.stringContaining('+84901234567'),
                throwOnFailure: false,
            })
        );
        expect(result.staff_profile.is_active).toBe(false);
        expect(result.staff_profile.user.onboarding_status).toBe(
            USER_ONBOARDING_STATUSES.PENDING_PASSWORD_SETUP
        );
        expect(result.invite.invite_token).toBeTruthy();
    });

    it('resends an invitation for staff still pending password setup', async () => {
        const user = {
            _id: userId,
            full_name: 'Staff A',
            email: 'staff@example.com',
            phone: '+84901234567',
            role: USER_ROLES.STAFF,
            is_active: true,
            onboarding_status: USER_ONBOARDING_STATUSES.PENDING_PASSWORD_SETUP,
        };
        const staffProfile = {
            _id: staffProfileId,
            user_id: user,
            staff_code: 'STF100',
            staff_type: 'CUSTOMER_SERVICE_STAFF',
            garage_id: garageId,
            is_active: false,
        };

        StaffProfile.findById.mockReturnValue({
            populate: jest.fn().mockResolvedValue(staffProfile),
        });

        const result = await staffProfileService.resendStaffInvitation(staffProfileId);

        expect(PasswordReset.updateMany).toHaveBeenCalledWith(
            {
                user_id: userId,
                purpose: PASSWORD_RESET_PURPOSES.STAFF_INVITE,
                is_used: false,
            },
            {
                $set: {
                    is_used: true,
                    used_at: expect.any(Date),
                },
            },
            undefined
        );
        expect(notificationService.createEmailNotification).toHaveBeenCalledWith(
            expect.objectContaining({
                recipientEmail: 'staff@example.com',
                type: NOTIFICATION_TYPES.AUTH_STAFF_INVITED,
            })
        );
        expect(result.invite.invite_token).toBeTruthy();
    });
});
