jest.mock('../../config/gemini', () => ({
    getGeminiClient: jest.fn(),
}));

const { getGeminiClient } = require('../../config/gemini');
const researchGeminiService = require('./researchGemini.service');

const validResult = {
    executive_summary: 'Khach hang danh gia dich vu tich cuc.',
    key_findings: [
        {
            title: 'NPS tot',
            evidence_refs: ['metric:question-1:nps'],
            impact: 'Tang kha nang quay lai.',
            confidence: 'HIGH',
        },
    ],
    customer_themes: [
        {
            theme: 'Nhanh',
            sentiment: 'POSITIVE',
            evidence_refs: ['feedback:1'],
        },
    ],
    risks: [],
    recommendations: [
        {
            title: 'Duy tri toc do',
            action: 'Tiep tuc theo doi thoi gian phuc vu.',
            priority: 'MEDIUM',
            evidence_refs: ['metric:question-1:nps'],
        },
    ],
    data_quality_notes: ['Mau du lieu nho.'],
};

describe('research Gemini service', () => {
    const generateContent = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        getGeminiClient.mockReturnValue({
            client: {
                models: {
                    generateContent,
                },
            },
            config: {
                model: 'gemini-2.5-flash',
                timeoutMs: 1000,
                maxOutputTokens: 4096,
            },
        });
    });

    it('validates structured output and returns usage metadata', async () => {
        generateContent.mockResolvedValue({
            text: JSON.stringify(validResult),
            usageMetadata: {
                promptTokenCount: 100,
                candidatesTokenCount: 50,
            },
        });

        const result = await researchGeminiService.generateSurveyInsight(
            {
                analytics: {},
                anonymous_feedback: [],
                metadata: {},
            },
            'Analyze service quality'
        );

        expect(result).toMatchObject({
            result: validResult,
            model: 'gemini-2.5-flash',
            prompt_version: 'survey-insight-v1',
        });
        expect(generateContent).toHaveBeenCalledTimes(1);
    });

    it('retries invalid output once', async () => {
        generateContent
            .mockResolvedValueOnce({
                text: '{"invalid":true}',
            })
            .mockResolvedValueOnce({
                text: JSON.stringify(validResult),
            });

        const result = await researchGeminiService.generateSurveyInsight(
            {
                analytics: {},
                anonymous_feedback: [],
                metadata: {},
            },
            'Analyze service quality'
        );

        expect(result.result).toEqual(validResult);
        expect(generateContent).toHaveBeenCalledTimes(2);
    });

    it('fails after two invalid outputs', async () => {
        generateContent.mockResolvedValue({
            text: 'not-json',
        });

        await expect(
            researchGeminiService.generateSurveyInsight(
                {
                    analytics: {},
                    anonymous_feedback: [],
                    metadata: {},
                },
                'Analyze service quality'
            )
        ).rejects.toMatchObject({
            statusCode: 502,
            errorCode: 'GEMINI_INVALID_OUTPUT',
        });
        expect(generateContent).toHaveBeenCalledTimes(2);
    });

    it('maps quota errors without retrying', async () => {
        generateContent.mockRejectedValue({
            status: 429,
        });

        await expect(
            researchGeminiService.generateSurveyInsight(
                {
                    analytics: {},
                    anonymous_feedback: [],
                    metadata: {},
                },
                'Analyze service quality'
            )
        ).rejects.toMatchObject({
            statusCode: 503,
            errorCode: 'GEMINI_QUOTA_EXCEEDED',
        });
        expect(generateContent).toHaveBeenCalledTimes(1);
    });

    it('aborts requests that exceed the configured timeout', async () => {
        getGeminiClient.mockReturnValue({
            client: {
                models: {
                    generateContent: jest.fn(({ config }) => {
                        return new Promise((resolve, reject) => {
                            config.abortSignal.addEventListener('abort', () => {
                                const error = new Error('aborted');

                                error.name = 'AbortError';
                                reject(error);
                            });
                        });
                    }),
                },
            },
            config: {
                model: 'gemini-2.5-flash',
                timeoutMs: 1,
                maxOutputTokens: 4096,
            },
        });

        await expect(
            researchGeminiService.generateSurveyInsight(
                {
                    analytics: {},
                    anonymous_feedback: [],
                    metadata: {},
                },
                'Analyze service quality'
            )
        ).rejects.toMatchObject({
            statusCode: 504,
            errorCode: 'GEMINI_TIMEOUT',
        });
    });
});
