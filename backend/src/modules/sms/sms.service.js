const mockSmsProvider = require('./providers/mockSms.provider');
const { AppError } = require('../../shared/utils/appError');
const { toSmsPhone } = require('../../shared/utils/phone');

const getProviderName = () => {
    return (process.env.SMS_PROVIDER || 'mock').trim().toLowerCase();
};

const isEnvEnabled = (name) => {
    return ['true', '1', 'yes', 'on'].includes(
        String(process.env[name] || '').trim().toLowerCase()
    );
};

const getProvider = () => {
    const providerName = getProviderName();
    const mockAllowed = process.env.NODE_ENV !== 'production'
        || isEnvEnabled('ALLOW_MOCK_SMS');

    if (providerName === 'mock' && !mockAllowed) {
        throw new AppError(
            'Mock SMS provider cannot be used in production without ALLOW_MOCK_SMS=true',
            500,
            'SMS_PROVIDER_NOT_ALLOWED'
        );
    }

    if (providerName === 'mock') {
        return mockSmsProvider;
    }

    throw new AppError(
        `Unsupported SMS provider: ${providerName}`,
        500,
        'SMS_PROVIDER_UNSUPPORTED'
    );
};

const validateConfiguration = () => {
    getProvider();

    return true;
};

const sendOtp = async ({ phone, otp, expiresInMinutes }) => {
    const provider = getProvider();

    return provider.sendOtp({
        phone: toSmsPhone(phone),
        otp,
        expiresInMinutes,
    });
};

module.exports = {
    sendOtp,
    validateConfiguration,
};
