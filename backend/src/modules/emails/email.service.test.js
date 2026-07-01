jest.mock('nodemailer', () => ({
    createTransport: jest.fn(),
}));

const nodemailer = require('nodemailer');
const emailService = require('./email.service');

describe('email service', () => {
    const originalEnv = process.env;
    const sendMail = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = {
            ...originalEnv,
            SMTP_HOST: 'smtp.example.com',
            SMTP_PORT: '587',
            SMTP_SECURE: 'false',
            SMTP_USER: 'mailer@example.com',
            SMTP_PASS: 'secret',
            SMTP_FROM_EMAIL: 'noreply@example.com',
            SMTP_FROM_NAME: 'AutoWash Pro',
            PASSWORD_RESET_URL: 'https://app.example.com/reset-password',
            STAFF_INVITE_URL: 'https://app.example.com/staff-invite',
        };
        emailService.resetTransporterCache();
        nodemailer.createTransport.mockReturnValue({ sendMail });
        sendMail.mockResolvedValue({ messageId: 'message-1' });
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('sends email through configured SMTP transport', async () => {
        const result = await emailService.sendEmail({
            to: 'customer@example.com',
            subject: 'Payment confirmed',
            text: 'Your payment was confirmed.',
            html: '<p>Your payment was confirmed.</p><script>alert(1)</script>',
        });

        expect(nodemailer.createTransport).toHaveBeenCalledWith({
            host: 'smtp.example.com',
            port: 587,
            secure: false,
            auth: {
                user: 'mailer@example.com',
                pass: 'secret',
            },
        });
        expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
            from: '"AutoWash Pro" <noreply@example.com>',
            to: 'customer@example.com',
            subject: 'Payment confirmed',
            text: 'Your payment was confirmed.',
            html: '<p>Your payment was confirmed.</p>',
        }));
        expect(result).toEqual({ messageId: 'message-1' });
    });

    it('builds password reset email with reset token and reset link', () => {
        const result = emailService.buildPasswordResetEmail({
            resetToken: 'reset-token-123',
            expiresInMinutes: 15,
            fullName: 'Customer A',
        });

        expect(result.subject).toBe('Reset your AutoWash Pro password');
        expect(result.text).toContain('reset-token-123');
        expect(result.text).toContain('15 minutes');
        expect(result.html).toContain('token=reset-token-123');
    });

    it('builds staff invitation email with invite token and phone link', () => {
        const result = emailService.buildStaffInviteEmail({
            inviteToken: 'invite-token-123',
            expiresInHours: 24,
            fullName: 'Staff A',
            phone: '+84901234567',
        });

        expect(result.subject).toBe('Activate your AutoWash Pro staff account');
        expect(result.text).toContain('invite-token-123');
        expect(result.text).toContain('+84901234567');
        expect(result.text).toContain('24 hours');
        expect(result.html).toContain('token=invite-token-123');
        expect(result.html).toContain('phone=%2B84901234567');
    });

    it('rejects missing SMTP config', async () => {
        delete process.env.SMTP_HOST;

        await expect(emailService.sendEmail({
            to: 'customer@example.com',
            subject: 'Subject',
            text: 'Body',
        })).rejects.toMatchObject({
            errorCode: 'EMAIL_SMTP_CONFIG_MISSING',
        });
    });
});
