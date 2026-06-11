const crypto = require('crypto');

const sendOtp = async ({ phone, otp, expiresInMinutes }) => {
    console.log(
        `[Mock SMS] phone=${phone} otp=${otp} expires_in_minutes=${expiresInMinutes}`
    );

    return {
        provider: 'mock',
        message_id: crypto.randomUUID(),
        status: 'SENT',
        debug_otp: otp,
    };
};

module.exports = {
    sendOtp,
};
