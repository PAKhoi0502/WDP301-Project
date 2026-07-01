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
    findOne: jest.fn(),
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
    findByIdAndUpdate: jest.fn(),
}));

jest.mock('../bookings/booking.model', () => ({
    findOne: jest.fn(),
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

jest.mock('../auth/services/token.service', () => ({
    revokeAllByUser: jest.fn(),
}));

jest.mock('../audit-logs/auditLog.service', () => ({
    recordAuditEvent: jest.fn(),
}));

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const StaffProfile = require('./staffProfile.model');
const User = require('../users/user.model');
const Booking = require('../bookings/booking.model');
const Garage = require('../garages/garage.model');
const PasswordReset = require('../auth/models/passwordResetToken.model');
const notificationService = require('../notifications/notification.service');
const TokenService = require('../auth/services/token.service');
const auditLogService = require('../audit-logs/auditLog.service');
const staffProfileService = require('./staffProfile.service');
const { USER_ROLES } = require('../../shared/constants/roles.constant');
const { STAFF_EMPLOYMENT_STATUS } = require('../../shared/constants/staff.constant');
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
        User.findByIdAndUpdate.mockResolvedValue({});
        StaffProfile.exists.mockResolvedValue(false);
        Booking.findOne.mockResolvedValue(null);
        Garage.findById.mockResolvedValue({
            _id: garageId,
            is_active: true,
        });
        PasswordReset.updateMany.mockResolvedValue({ modifiedCount: 0 });
        PasswordReset.create.mockResolvedValue({});
        notificationService.createEmailNotification.mockResolvedValue({
            email_status: 'SENT',
        });
        TokenService.revokeAllByUser.mockResolvedValue({ modifiedCount: 0 });
        auditLogService.recordAuditEvent.mockResolvedValue(null);
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

    it('rejects activating a staff profile before onboarding is complete', async () => {
        const pendingUser = {
            _id: userId,
            role: USER_ROLES.STAFF,
            is_active: true,
            phone_verified_at: null,
            onboarding_status: USER_ONBOARDING_STATUSES.PENDING_PHONE_VERIFICATION,
        };
        const staffProfile = {
            _id: staffProfileId,
            user_id: pendingUser,
            is_active: false,
        };

        StaffProfile.findById.mockReturnValue({
            populate: jest.fn().mockResolvedValue(staffProfile),
        });

        await expect(
            staffProfileService.updateStaffProfileStatus(staffProfileId, true)
        ).rejects.toMatchObject({
            statusCode: 409,
            errorCode: 'STAFF_PROFILE_ACTIVATION_REQUIRES_COMPLETED_ONBOARDING',
        });

        expect(StaffProfile.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('allows activating a verified staff profile after onboarding', async () => {
        const activeUser = {
            _id: userId,
            role: USER_ROLES.STAFF,
            is_active: true,
            phone_verified_at: new Date(),
            onboarding_status: USER_ONBOARDING_STATUSES.ACTIVE,
        };
        const staffProfile = {
            _id: staffProfileId,
            user_id: activeUser,
            is_active: false,
        };
        const updatedStaffProfile = {
            ...staffProfile,
            is_active: true,
        };

        StaffProfile.findById.mockReturnValue({
            populate: jest.fn().mockResolvedValue(staffProfile),
        });
        StaffProfile.findByIdAndUpdate.mockReturnValue({
            populate: jest.fn().mockResolvedValue(updatedStaffProfile),
        });

        const result = await staffProfileService.updateStaffProfileStatus(
            staffProfileId,
            true
        );

        expect(StaffProfile.findByIdAndUpdate).toHaveBeenCalledWith(
            staffProfileId,
            {
                $set: expect.objectContaining({
                    is_active: true,
                    employment_status: STAFF_EMPLOYMENT_STATUS.ACTIVE,
                    status_reason: null,
                    status_changed_at: expect.any(Date),
                    status_changed_by: null,
                }),
            },
            { new: true, runValidators: true, session }
        );
        expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
            userId,
            { $set: { is_active: true } },
            { new: true, runValidators: true, session }
        );
        expect(result.is_active).toBe(true);
        expect(result.employment_status).toBe(STAFF_EMPLOYMENT_STATUS.ACTIVE);
    });

    it('suspends staff profile, disables user, and revokes refresh tokens', async () => {
        const pendingUser = {
            _id: userId,
            role: USER_ROLES.STAFF,
            is_active: true,
            phone_verified_at: null,
            onboarding_status: USER_ONBOARDING_STATUSES.PENDING_PHONE_VERIFICATION,
        };
        const staffProfile = {
            _id: staffProfileId,
            user_id: pendingUser,
            is_active: true,
        };
        const updatedStaffProfile = {
            ...staffProfile,
            is_active: false,
        };

        StaffProfile.findById.mockReturnValue({
            populate: jest.fn().mockResolvedValue(staffProfile),
        });
        StaffProfile.findByIdAndUpdate.mockReturnValue({
            populate: jest.fn().mockResolvedValue(updatedStaffProfile),
        });

        const result = await staffProfileService.updateStaffProfileStatus(
            staffProfileId,
            false,
            { reason: 'Violation' }
        );

        expect(StaffProfile.findByIdAndUpdate).toHaveBeenCalledWith(
            staffProfileId,
            {
                $set: expect.objectContaining({
                    is_active: false,
                    employment_status: STAFF_EMPLOYMENT_STATUS.SUSPENDED,
                    status_reason: 'Violation',
                    suspended_at: expect.any(Date),
                    status_changed_at: expect.any(Date),
                    status_changed_by: null,
                }),
            },
            { new: true, runValidators: true, session }
        );
        expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
            userId,
            { $set: { is_active: false } },
            { new: true, runValidators: true, session }
        );
        expect(TokenService.revokeAllByUser).toHaveBeenCalledWith(
            userId,
            'staff_suspended',
            session
        );
        expect(result.is_active).toBe(false);
        expect(result.employment_status).toBe(STAFF_EMPLOYMENT_STATUS.SUSPENDED);
    });

    it('rejects terminating staff profile with active assignments', async () => {
        const activeUser = {
            _id: userId,
            role: USER_ROLES.STAFF,
            is_active: true,
            phone_verified_at: new Date(),
            onboarding_status: USER_ONBOARDING_STATUSES.ACTIVE,
        };
        const staffProfile = {
            _id: staffProfileId,
            user_id: activeUser,
            is_active: true,
            employment_status: STAFF_EMPLOYMENT_STATUS.ACTIVE,
        };

        StaffProfile.findById.mockReturnValue({
            populate: jest.fn().mockResolvedValue(staffProfile),
        });
        Booking.findOne.mockResolvedValue({ _id: '665f1b7b2a5f9d0012a44444' });

        await expect(
            staffProfileService.terminateStaffProfile(staffProfileId)
        ).rejects.toMatchObject({
            statusCode: 409,
            errorCode: 'STAFF_HAS_ACTIVE_ASSIGNMENTS',
        });

        expect(StaffProfile.findByIdAndUpdate).not.toHaveBeenCalled();
        expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
        expect(TokenService.revokeAllByUser).not.toHaveBeenCalled();
    });

    it('prevents the legacy create API from activating a pending staff user', async () => {
        User.findById.mockResolvedValue({
            _id: userId,
            role: USER_ROLES.STAFF,
            is_active: true,
            phone_verified_at: null,
            onboarding_status: USER_ONBOARDING_STATUSES.PENDING_PASSWORD_SETUP,
        });

        await expect(staffProfileService.createStaffProfile({
            user_id: userId,
            staff_code: 'STF200',
            staff_type: 'CUSTOMER_SERVICE_STAFF',
            garage_id: garageId,
        })).rejects.toMatchObject({
            statusCode: 409,
            errorCode: 'STAFF_PROFILE_ACTIVATION_REQUIRES_COMPLETED_ONBOARDING',
        });

        expect(StaffProfile.create).not.toHaveBeenCalled();
    });
});
