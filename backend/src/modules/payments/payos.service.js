const { PayOS, APIError, WebhookError, PayOSError } = require('@payos/node');

const { AppError } = require('../../shared/utils/appError');

const DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_PAYMENT_EXPIRE_MINUTES = 15;

const getRequiredEnv = (name) => {
    const value = process.env[name];

    if (!value || !value.trim()) {
        throw new AppError(
            'PayOS configuration is missing',
            500,
            'PAYOS_CONFIG_MISSING',
            [{ field: name, message: `${name} is required` }]
        );
    }

    return value.trim();
};

const getOptionalEnv = (name) => {
    const value = process.env[name];

    if (!value || !value.trim()) {
        return undefined;
    }

    return value.trim();
};

const getOptionalPositiveInteger = (name, fallback) => {
    const value = Number(process.env[name]);

    if (!Number.isInteger(value) || value <= 0) {
        return fallback;
    }

    return value;
};

const getPayosClient = () => {
    return new PayOS({
        clientId: getRequiredEnv('PAYOS_CLIENT_ID'),
        apiKey: getRequiredEnv('PAYOS_API_KEY'),
        checksumKey: getRequiredEnv('PAYOS_CHECKSUM_KEY'),
        partnerCode: getOptionalEnv('PAYOS_PARTNER_CODE'),
        baseURL: getOptionalEnv('PAYOS_BASE_URL'),
        timeout: getOptionalPositiveInteger('PAYOS_TIMEOUT_MS', DEFAULT_TIMEOUT_MS),
        maxRetries: getOptionalPositiveInteger('PAYOS_MAX_RETRIES', DEFAULT_MAX_RETRIES),
        logLevel: getOptionalEnv('PAYOS_LOG_LEVEL') || 'warn',
    });
};

const normalizePayosError = (error, fallbackCode = 'PAYOS_ERROR') => {
    if (error instanceof AppError) {
        return error;
    }

    if (
        error instanceof WebhookError
        || error.name === 'WebhookError'
        || error.constructor?.name === 'WebhookError'
    ) {
        return new AppError(
            'Invalid PayOS webhook',
            400,
            'PAYOS_WEBHOOK_INVALID'
        );
    }

    if (error instanceof APIError) {
        return new AppError(
            error.desc || error.message || 'PayOS request failed',
            error.status || 502,
            error.code || fallbackCode
        );
    }

    if (error instanceof PayOSError) {
        return new AppError(
            error.message || 'PayOS request failed',
            502,
            fallbackCode
        );
    }

    return new AppError(
        error.message || 'PayOS request failed',
        502,
        fallbackCode
    );
};

const getDefaultExpiredAt = () => {
    const expireMinutes = getOptionalPositiveInteger(
        'PAYOS_PAYMENT_EXPIRE_MINUTES',
        DEFAULT_PAYMENT_EXPIRE_MINUTES
    );

    return Math.floor(Date.now() / 1000) + expireMinutes * 60;
};

const buildCreatePaymentLinkPayload = (payload) => {
    const returnUrl = payload.returnUrl || getRequiredEnv('PAYOS_RETURN_URL');
    const cancelUrl = payload.cancelUrl || getRequiredEnv('PAYOS_CANCEL_URL');

    return {
        orderCode: payload.orderCode,
        amount: payload.amount,
        description: payload.description,
        returnUrl,
        cancelUrl,
        items: payload.items,
        buyerName: payload.buyerName,
        buyerEmail: payload.buyerEmail,
        buyerPhone: payload.buyerPhone,
        buyerAddress: payload.buyerAddress,
        expiredAt: payload.expiredAt || getDefaultExpiredAt(),
    };
};

const createPaymentLink = async (payload) => {
    try {
        const client = getPayosClient();
        const paymentLinkPayload = buildCreatePaymentLinkPayload(payload);

        return await client.paymentRequests.create(paymentLinkPayload);
    } catch (error) {
        throw normalizePayosError(error, 'PAYOS_CREATE_PAYMENT_LINK_FAILED');
    }
};

const getPaymentLinkInformation = async (id) => {
    try {
        const client = getPayosClient();

        return await client.paymentRequests.get(id);
    } catch (error) {
        throw normalizePayosError(error, 'PAYOS_GET_PAYMENT_LINK_FAILED');
    }
};

const cancelPaymentLink = async (id, cancellationReason) => {
    try {
        const client = getPayosClient();

        return await client.paymentRequests.cancel(id, cancellationReason);
    } catch (error) {
        throw normalizePayosError(error, 'PAYOS_CANCEL_PAYMENT_LINK_FAILED');
    }
};

const verifyWebhook = async (payload) => {
    try {
        const client = getPayosClient();

        return await client.webhooks.verify(payload);
    } catch (error) {
        throw normalizePayosError(error, 'PAYOS_VERIFY_WEBHOOK_FAILED');
    }
};

const confirmWebhook = async (webhookUrl) => {
    try {
        const client = getPayosClient();

        return await client.webhooks.confirm(webhookUrl);
    } catch (error) {
        throw normalizePayosError(error, 'PAYOS_CONFIRM_WEBHOOK_FAILED');
    }
};

module.exports = {
    buildCreatePaymentLinkPayload,
    createPaymentLink,
    getPaymentLinkInformation,
    cancelPaymentLink,
    verifyWebhook,
    confirmWebhook,
};
