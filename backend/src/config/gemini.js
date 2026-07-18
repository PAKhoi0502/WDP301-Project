const { GoogleGenAI } = require('@google/genai');

const { AppError } = require('../shared/utils/appError');

let client = null;
let clientApiKey = null;

const getPositiveInteger = (name, fallback, max) => {
    const value = Number(process.env[name]);

    if (!Number.isInteger(value) || value < 1) {
        return fallback;
    }

    return Math.min(value, max);
};

const getGeminiConfig = () => {
    const apiKey = process.env.GEMINI_API_KEY?.trim();

    if (!apiKey) {
        throw new AppError(
            'Gemini configuration is missing',
            503,
            'GEMINI_CONFIGURATION_MISSING'
        );
    }

    return {
        apiKey,
        model: process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash',
        timeoutMs: getPositiveInteger('GEMINI_TIMEOUT_MS', 60000, 300000),
        maxOutputTokens: getPositiveInteger('GEMINI_MAX_OUTPUT_TOKENS', 4096, 32768),
    };
};

const getGeminiClient = () => {
    const config = getGeminiConfig();

    if (!client || clientApiKey !== config.apiKey) {
        client = new GoogleGenAI({
            apiKey: config.apiKey,
        });
        clientApiKey = config.apiKey;
    }

    return {
        client,
        config,
    };
};

const resetGeminiClient = () => {
    client = null;
    clientApiKey = null;
};

module.exports = {
    getGeminiConfig,
    getGeminiClient,
    resetGeminiClient,
};
