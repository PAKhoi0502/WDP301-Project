const mockSmsProvider = require('./providers/mockSms.provider');
const { AppError } = require('../../shared/utils/appError');
const { toSmsPhone } = require('../../shared/utils/phone');

const getProviderName = () => {
    return (process.env.SMS_PROVIDER || 'mock').trim().toLowerCase();
};

const getProvider = () => {
    const providerName = getProviderName();

    if (process.env.NODE_ENV === 'production' && providerName === 'mock') {
        throw new AppError(
            'Mock SMS provider cannot be used in production',
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
