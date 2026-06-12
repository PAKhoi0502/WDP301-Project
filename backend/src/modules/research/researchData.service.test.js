jest.mock('../surveys/surveyResponse.model', () => ({
    aggregate: jest.fn(),
}));

jest.mock('../analytics/analytics.service', () => ({
    getSurveyAnalytics: jest.fn(),
    buildSurveyResponsePipeline: jest.fn(),
}));

const SurveyResponse = require('../surveys/surveyResponse.model');
const analyticsService = require('../analytics/analytics.service');
const researchDataService = require('./researchData.service');

describe('research data service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        delete process.env.RESEARCH_MAX_TEXT_RESPONSES;
        delete process.env.RESEARCH_MAX_TEXT_CHARACTERS;
    });

    it('redacts direct identifiers from feedback', () => {
        const result = researchDataService.redactText(
            'Email me at test@example.com or +84901234567 about plate 51A-12345'
        );

        expect(result).toBe('Email me at [EMAIL] or [PHONE] about plate [LICENSE_PLATE]');
    });

    it('builds an auditable anonymous survey snapshot', async () => {
        const analytics = {
            metrics: {
                response_count: 3,
            },
            questions: [],
        };

        analyticsService.getSurveyAnalytics.mockResolvedValue(analytics);
        analyticsService.buildSurveyResponsePipeline.mockReturnValue([]);
        SurveyResponse.aggregate.mockResolvedValue([
            {
                metadata: [
                    {
                        source_text_count: 2,
                        source_max_submitted_at: new Date('2026-06-12T00:00:00.000Z'),
                    },
                ],
                feedback: [
                    {
                        question_id: { toString: () => 'question-1' },
                        question_text: 'What should improve?',
                        text: 'Call +84901234567 about 51A-12345',
                    },
                    {
                        question_id: { toString: () => 'question-1' },
                        question_text: 'What should improve?',
                        text: 'Waiting time is long',
                    },
                ],
            },
        ]);

        const snapshot = await researchDataService.buildSurveyInsightSnapshot({
            type: 'SURVEY_INSIGHT',
            filters: {
                survey_id: { toString: () => 'survey-1' },
                group_by: 'DAY',
            },
        });

        expect(snapshot.analytics).toBe(analytics);
        expect(snapshot.anonymous_feedback).toEqual([
            {
                id: 'feedback:1',
                question_id: 'question-1',
                question_text: 'What should improve?',
                text: 'Call [PHONE] about [LICENSE_PLATE]',
            },
            {
                id: 'feedback:2',
                question_id: 'question-1',
                question_text: 'What should improve?',
                text: 'Waiting time is long',
            },
        ]);
        expect(snapshot.metadata).toMatchObject({
            source_response_count: 3,
            source_text_count: 2,
            included_text_count: 2,
            truncated_text_count: 0,
        });
        expect(snapshot.snapshot_hash).toMatch(/^[0-9a-f]{64}$/);
        expect(JSON.stringify(snapshot)).not.toContain('+84901234567');
        expect(JSON.stringify(snapshot)).not.toContain('51A-12345');
    });
});
