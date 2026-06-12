const crypto = require('crypto');

const SurveyResponse = require('../surveys/surveyResponse.model');
const analyticsService = require('../analytics/analytics.service');
const {
    SURVEY_QUESTION_TYPES,
} = require('../../shared/constants/survey.constant');
const {
    RESEARCH_REPORT_TYPES,
} = require('../../shared/constants/research.constant');

const getPositiveInteger = (name, fallback, max) => {
    const value = Number(process.env[name]);

    if (!Number.isInteger(value) || value < 1) {
        return fallback;
    }

    return Math.min(value, max);
};

const redactText = (value) => {
    return String(value || '')
        .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL]')
        .replace(/(?:\+?84|0)(?:[\s.-]?\d){8,10}\b/g, '[PHONE]')
        .replace(/\b\d{2}[A-Z]\d?[-\s]?\d{3,5}(?:\.\d{2})?\b/gi, '[LICENSE_PLATE]')
        .trim();
};

const buildAnonymousFeedback = (rows = []) => {
    const maxItems = getPositiveInteger('RESEARCH_MAX_TEXT_RESPONSES', 200, 1000);
    const maxCharacters = getPositiveInteger('RESEARCH_MAX_TEXT_CHARACTERS', 40000, 200000);
    const feedback = [];
    let includedCharacters = 0;

    for (const row of rows.slice(0, maxItems)) {
        const text = redactText(row.text);

        if (!text) {
            continue;
        }

        if (includedCharacters + text.length > maxCharacters) {
            break;
        }

        feedback.push({
            id: `feedback:${feedback.length + 1}`,
            question_id: row.question_id.toString(),
            question_text: row.question_text,
            text,
        });
        includedCharacters += text.length;
    }

    return {
        feedback,
        includedCharacters,
    };
};

const createSnapshotHash = (snapshot) => {
    return crypto
        .createHash('sha256')
        .update(JSON.stringify(snapshot))
        .digest('hex');
};

const buildSurveyInsightSnapshot = async (report) => {
    const filters = {
        from: report.filters.from || undefined,
        to: report.filters.to || undefined,
        garage_id: report.filters.garage_id?.toString() || undefined,
        service_package_id: report.filters.service_package_id?.toString() || undefined,
        vehicle_type: report.filters.vehicle_type || undefined,
        group_by: report.filters.group_by || 'DAY',
    };
    const surveyId = report.filters.survey_id.toString();
    const analytics = await analyticsService.getSurveyAnalytics(surveyId, filters);
    const basePipeline = analyticsService.buildSurveyResponsePipeline(surveyId, filters);
    const [result = {}] = await SurveyResponse.aggregate([
        ...basePipeline,
        { $unwind: '$answers' },
        {
            $match: {
                'answers.question_type_snapshot': SURVEY_QUESTION_TYPES.TEXT,
                'answers.text_value': { $nin: [null, ''] },
            },
        },
        { $sort: { submitted_at: -1 } },
        {
            $facet: {
                metadata: [
                    {
                        $group: {
                            _id: null,
                            source_text_count: { $sum: 1 },
                            source_max_submitted_at: { $max: '$submitted_at' },
                        },
                    },
                ],
                feedback: [
                    {
                        $project: {
                            _id: 0,
                            question_id: '$answers.question_id',
                            question_text: '$answers.question_text_snapshot',
                            text: '$answers.text_value',
                        },
                    },
                    {
                        $limit: getPositiveInteger(
                            'RESEARCH_MAX_TEXT_RESPONSES',
                            200,
                            1000
                        ) * 2,
                    },
                ],
            },
        },
    ]);
    const sourceMetadata = result.metadata?.[0] || {};
    const anonymousFeedback = buildAnonymousFeedback(result.feedback || []);
    const snapshot = {
        type: RESEARCH_REPORT_TYPES.SURVEY_INSIGHT,
        generated_at: new Date(),
        filters: {
            survey_id: surveyId,
            from: report.filters.from || null,
            to: report.filters.to || null,
            garage_id: report.filters.garage_id?.toString() || null,
            service_package_id: report.filters.service_package_id?.toString() || null,
            vehicle_type: report.filters.vehicle_type || null,
            group_by: report.filters.group_by || 'DAY',
        },
        analytics,
        anonymous_feedback: anonymousFeedback.feedback,
        metadata: {
            source_response_count: analytics.metrics.response_count,
            source_text_count: sourceMetadata.source_text_count || 0,
            included_text_count: anonymousFeedback.feedback.length,
            truncated_text_count: Math.max(
                (sourceMetadata.source_text_count || 0) - anonymousFeedback.feedback.length,
                0
            ),
            included_text_characters: anonymousFeedback.includedCharacters,
            source_max_submitted_at: sourceMetadata.source_max_submitted_at || null,
        },
    };

    return {
        ...snapshot,
        snapshot_hash: createSnapshotHash(snapshot),
    };
};

const buildResearchSnapshot = async (report) => {
    if (report.type === RESEARCH_REPORT_TYPES.SURVEY_INSIGHT) {
        return buildSurveyInsightSnapshot(report);
    }

    throw new Error(`Unsupported research type: ${report.type}`);
};

module.exports = {
    buildResearchSnapshot,
    buildSurveyInsightSnapshot,
    redactText,
    createSnapshotHash,
};
