const nodemailer = require('nodemailer');
const sanitizeHtml = require('sanitize-html');

const { AppError } = require('../../shared/utils/appError');

let cachedTransporter = null;
let cachedConfigKey = null;

const normalizeText = (value) => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value !== 'string') {
        return value;
    }

    const trimmedValue = value.trim();

    return trimmedValue || null;
};

const parseBoolean = (value, defaultValue = false) => {
    if (value === undefined || value === null || value === '') {
        return defaultValue;
    }

    if (typeof value === 'boolean') {
        return value;
    }

    return ['true', '1', 'yes', 'on'].includes(value.toString().trim().toLowerCase());
};

const getSmtpConfig = () => {
    const host = normalizeText(process.env.SMTP_HOST);
    const port = Number(process.env.SMTP_PORT) || 587;
    const secure = parseBoolean(process.env.SMTP_SECURE, port === 465);
    const user = normalizeText(process.env.SMTP_USER);
    const pass = normalizeText(process.env.SMTP_PASS);
    const fromEmail = normalizeText(process.env.SMTP_FROM_EMAIL) || user;
    const fromName = normalizeText(process.env.SMTP_FROM_NAME) || 'AutoWash Pro';

    if (!host) {
        throw new AppError('SMTP_HOST is missing', 500, 'EMAIL_SMTP_CONFIG_MISSING');
    }

    if (!fromEmail) {
        throw new AppError('SMTP_FROM_EMAIL is missing', 500, 'EMAIL_FROM_CONFIG_MISSING');
    }

    return {
        host,
        port,
        secure,
        user,
        pass,
        fromEmail,
        fromName,
    };
};

const getConfigKey = (config) => {
    return [
        config.host,
        config.port,
        config.secure,
        config.user,
        config.fromEmail,
        config.fromName,
    ].join('|');
};

const getTransporter = () => {
    const config = getSmtpConfig();
    const configKey = getConfigKey(config);

    if (cachedTransporter && cachedConfigKey === configKey) {
        return {
            transporter: cachedTransporter,
            config,
        };
    }

    const transportOptions = {
        host: config.host,
        port: config.port,
        secure: config.secure,
    };

    if (config.user || config.pass) {
        transportOptions.auth = {
            user: config.user,
            pass: config.pass,
        };
    }

    cachedTransporter = nodemailer.createTransport(transportOptions);
    cachedConfigKey = configKey;

    return {
        transporter: cachedTransporter,
        config,
    };
};

const sanitizeEmailHtml = (html) => {
    return sanitizeHtml(html, {
        allowedTags: [
            'p',
            'br',
            'strong',
            'em',
            'b',
            'i',
            'u',
            'a',
            'div',
            'span',
            'h1',
            'h2',
            'h3',
            'ul',
            'ol',
            'li',
            'table',
            'tbody',
            'tr',
            'td',
        ],
        allowedAttributes: {
            a: ['href', 'target', 'rel'],
            div: ['style'],
            span: ['style'],
            p: ['style'],
            table: ['style', 'cellpadding', 'cellspacing', 'role'],
            td: ['style'],
        },
        allowedSchemes: ['http', 'https', 'mailto'],
    });
};

const escapeHtml = (value = '') => {
    return value
        .toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

const buildDefaultHtml = ({ title, message, actionUrl = null, actionLabel = null, footer = null }) => {
    const actionBlock = actionUrl && actionLabel
        ? `<p><a href="${escapeHtml(actionUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(actionLabel)}</a></p>`
        : '';
    const footerBlock = footer
        ? `<p style="color:#666;font-size:12px">${escapeHtml(footer)}</p>`
        : '';

    return sanitizeEmailHtml(`
        <div>
            <h2>${escapeHtml(title)}</h2>
            <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
            ${actionBlock}
            ${footerBlock}
        </div>
    `);
};

const sendEmail = async ({ to, subject, text, html, replyTo = null }) => {
    const recipient = normalizeText(to);
    const emailSubject = normalizeText(subject);
    const emailText = normalizeText(text);
    const emailHtml = normalizeText(html);

    if (!recipient) {
        throw new AppError('Email recipient is required', 400, 'EMAIL_RECIPIENT_REQUIRED');
    }

    if (!emailSubject) {
        throw new AppError('Email subject is required', 400, 'EMAIL_SUBJECT_REQUIRED');
    }

    if (!emailText && !emailHtml) {
        throw new AppError('Email body is required', 400, 'EMAIL_BODY_REQUIRED');
    }

    const { transporter, config } = getTransporter();
    const mailOptions = {
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to: recipient,
        subject: emailSubject,
        text: emailText || undefined,
        html: emailHtml ? sanitizeEmailHtml(emailHtml) : undefined,
        replyTo: normalizeText(replyTo) || undefined,
    };

    return transporter.sendMail(mailOptions);
};

const buildPasswordResetEmail = ({ resetToken, expiresInMinutes, fullName }) => {
    const resetUrl = normalizeText(process.env.PASSWORD_RESET_URL);
    const greetingName = normalizeText(fullName) || 'customer';
    const title = 'Reset your AutoWash Pro password';
    const message = [
        `Hello ${greetingName},`,
        `Use this reset token to reset your password: ${resetToken}`,
        `This token expires in ${expiresInMinutes} minutes.`,
        'If you did not request a password reset, you can ignore this email.',
    ].join('\n\n');
    const actionUrl = resetUrl
        ? `${resetUrl}${resetUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(resetToken)}`
        : null;

    return {
        subject: title,
        text: message,
        html: buildDefaultHtml({
            title,
            message,
            actionUrl,
            actionLabel: actionUrl ? 'Open reset page' : null,
            footer: 'AutoWash Pro security email',
        }),
    };
};

const buildStaffInviteEmail = ({
    inviteToken,
    expiresInHours,
    fullName,
    phone,
}) => {
    const inviteUrl = normalizeText(process.env.STAFF_INVITE_URL);
    const greetingName = normalizeText(fullName) || 'staff member';
    const title = 'Activate your AutoWash Pro staff account';
    const message = [
        `Hello ${greetingName},`,
        'An administrator created an AutoWash Pro staff account for you.',
        `Your login phone is: ${phone}`,
        `Use this invitation token to set your password: ${inviteToken}`,
        `This invitation expires in ${expiresInHours} hours.`,
        'After setting your password, sign in and verify your phone number with OTP to activate staff access.',
    ].join('\n\n');
    const actionUrl = inviteUrl
        ? `${inviteUrl}${inviteUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(inviteToken)}&phone=${encodeURIComponent(phone)}`
        : null;

    return {
        subject: title,
        text: message,
        html: buildDefaultHtml({
            title,
            message,
            actionUrl,
            actionLabel: actionUrl ? 'Set staff password' : null,
            footer: 'AutoWash Pro staff invitation',
        }),
    };
};

const resetTransporterCache = () => {
    cachedTransporter = null;
    cachedConfigKey = null;
};

module.exports = {
    sendEmail,
    buildDefaultHtml,
    buildPasswordResetEmail,
    buildStaffInviteEmail,
    resetTransporterCache,
};
