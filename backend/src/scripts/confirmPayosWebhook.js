require('dotenv').config();

const payosService = require('../modules/payments/payos.service');

const getWebhookUrl = () => {
    const value = process.env.PAYOS_WEBHOOK_URL?.trim();

    if (!value) {
        throw new Error('PAYOS_WEBHOOK_URL is required');
    }

    const url = new URL(value);

    if (url.protocol !== 'https:' || /(^|\.)localhost$/i.test(url.hostname)) {
        throw new Error('PAYOS_WEBHOOK_URL must be a public HTTPS URL');
    }

    return url;
};

const main = async () => {
    const webhookUrl = getWebhookUrl();

    await payosService.confirmWebhook(webhookUrl.toString());
    console.log(`PayOS webhook confirmed: ${webhookUrl.origin}${webhookUrl.pathname}`);
};

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
