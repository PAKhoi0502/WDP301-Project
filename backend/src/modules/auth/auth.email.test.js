jest.mock('../users/user.model', () => ({
    findOne: jest.fn(),
    exists: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn(),
}));

jest.mock('./models/passwordResetToken.model', () => ({
    updateMany: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
}));

jest.mock('./models/passwordResetRateLimit.model', () => ({
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
}));

jest.mock('./services/token.service', () => ({
    createRefreshToken: jest.fn(),
    revokeAllByUser: jest.fn(),
}));

jest.mock('../notifications/notification.service', () => ({
    createEmailNotification: jest.fn(),
}));

const User = require('../users/user.model');
const PasswordReset = require('./models/passwordResetToken.model');
const PasswordResetRateLimit = require('./models/passwordResetRateLimit.model');
const notificationService = require('../notifications/notification.service');
const authCoreService = require('./services/auth.core.service');
const {
    NOTIFICATION_TYPES,
    NOTIFICATION_RELATED_TYPES,
} = require('../../shared/constants/notification.constant');

describe('auth password reset email', () => {
    const originalEnv = process.env;
    const userId = '507f1f77bcf86cd799439011';

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = {
            ...originalEnv,
            NODE_ENV: 'development',
            PASSWORD_RESET_EXPIRES_IN_MINUTES: '15',
        };
        PasswordResetRateLimit.findOne.mockResolvedValue(null);
        PasswordResetRateLimit.findOneAndUpdate.mockResolvedValue({});
        PasswordReset.updateMany.mockResolvedValue({ modifiedCount: 0 });
        PasswordReset.create.mockResolvedValue({});
        notificationService.createEmailNotification.mockResolvedValue({
            email_status: 'SENT',
        });
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('creates password reset email notification when user has email', async () => {
        User.findOne.mockResolvedValue({
            _id: userId,
            phone: '0901234567',
            email: 'customer@example.com',
            full_name: 'Customer A',
            is_active: true,
        });

        const result = await authCoreService.forgotPassword({
            phone: '0901234567',
        });

        expect(result.reset_token).toBeTruthy();
        expect(notificationService.createEmailNotification).toHaveBeenCalledWith(expect.objectContaining({
            userId,
            recipientEmail: 'customer@example.com',
            type: NOTIFICATION_TYPES.AUTH_PASSWORD_RESET_REQUESTED,
            relatedType: NOTIFICATION_RELATED_TYPES.AUTH,
            relatedId: userId,
            text: expect.stringContaining(result.reset_token),
            html: expect.stringContaining(result.reset_token),
            throwOnFailure: false,
        }));
    });

    it('does not create email notification when active user has no email', async () => {
        User.findOne.mockResolvedValue({
            _id: userId,
            phone: '0901234567',
            email: '',
            full_name: 'Customer A',
            is_active: true,
        });

        const result = await authCoreService.forgotPassword({
            phone: '0901234567',
        });

        expect(result.reset_token).toBeTruthy();
        expect(notificationService.createEmailNotification).not.toHaveBeenCalled();
    });
});
