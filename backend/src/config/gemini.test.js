const geminiConfig = require('./gemini');

describe('Gemini config', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = {
            ...originalEnv,
        };
        geminiConfig.resetGeminiClient();
    });

    afterAll(() => {
        process.env = originalEnv;
        geminiConfig.resetGeminiClient();
    });

    it('requires an API key', () => {
        delete process.env.GEMINI_API_KEY;

        expect(() => geminiConfig.getGeminiConfig()).toThrow(expect.objectContaining({
            statusCode: 503,
            errorCode: 'GEMINI_CONFIGURATION_MISSING',
        }));
    });

    it('uses configured model and limits', () => {
        process.env.GEMINI_API_KEY = 'test-key';
        process.env.GEMINI_MODEL = 'gemini-test-model';
        process.env.GEMINI_TIMEOUT_MS = '10000';
        process.env.GEMINI_MAX_OUTPUT_TOKENS = '2048';

        expect(geminiConfig.getGeminiConfig()).toEqual({
            apiKey: 'test-key',
            model: 'gemini-test-model',
            timeoutMs: 10000,
            maxOutputTokens: 2048,
        });
    });
});
