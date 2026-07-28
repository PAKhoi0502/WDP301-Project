const {
    SURVEY_TARGETS,
    SURVEY_CATALOG,
    SURVEY_RESPONSE_TARGETS,
    PLATE_SCAN_TARGETS,
} = require('./seedNotificationsSurveysPlateScansCatalog');
const {
    takeEvenly,
    assertPlanTargets,
} = require('./seedNotificationsSurveysPlateScans');

const sumCounts = (counts) => Object.values(counts).reduce(
    (total, count) => total + count,
    0
);

const buildTargetSummary = () => ({
    surveys: {
        total: SURVEY_TARGETS.total,
        by_status: { ...SURVEY_TARGETS.by_status },
    },
    responses: {
        total: SURVEY_RESPONSE_TARGETS.total,
        by_survey: { ...SURVEY_RESPONSE_TARGETS.by_survey },
        by_garage: {
            GAR001: 12,
            GAR002: 12,
            GAR003: 12,
            GAR004: 12,
            GAR005: 12,
        },
        rating_distribution: {
            ...SURVEY_RESPONSE_TARGETS.rating_distribution,
        },
        nps_segments: {
            ...SURVEY_RESPONSE_TARGETS.nps_segments,
        },
        nps_score: 26.67,
        text_answers: SURVEY_RESPONSE_TARGETS.text_answers,
    },
    plate_scans: {
        total: PLATE_SCAN_TARGETS.total,
        by_status: { ...PLATE_SCAN_TARGETS.by_status },
        by_mode: { ...PLATE_SCAN_TARGETS.by_mode },
        by_capture_source: {
            ...PLATE_SCAN_TARGETS.by_capture_source,
        },
        by_garage: {
            GAR001: 6,
            GAR002: 6,
            GAR003: 6,
            GAR004: 6,
            GAR005: 6,
        },
        retry_chains: PLATE_SCAN_TARGETS.retry_chains,
        retained_images: PLATE_SCAN_TARGETS.retained_images,
    },
    notifications: {
        total: 1,
        by_type: { PAYMENT_CONFIRMED: 1 },
        by_status: { READ: 1 },
        by_recipient_role: { CUSTOMER: 1 },
        email_channels: 0,
    },
});

describe('notifications, surveys, responses and plate scans seed', () => {
    test('locks the approved survey and response distributions', () => {
        expect(SURVEY_CATALOG).toHaveLength(3);
        expect(sumCounts(SURVEY_TARGETS.by_status)).toBe(3);
        expect(sumCounts(SURVEY_RESPONSE_TARGETS.by_survey)).toBe(60);
        expect(
            sumCounts(SURVEY_RESPONSE_TARGETS.rating_distribution)
        ).toBe(60);
        expect(sumCounts(SURVEY_RESPONSE_TARGETS.nps_segments)).toBe(60);
        expect(SURVEY_RESPONSE_TARGETS.text_answers).toBe(30);
    });

    test('locks plate scan lifecycle, source and mode totals', () => {
        expect(sumCounts(PLATE_SCAN_TARGETS.by_status)).toBe(30);
        expect(sumCounts(PLATE_SCAN_TARGETS.by_mode)).toBe(30);
        expect(sumCounts(PLATE_SCAN_TARGETS.by_capture_source)).toBe(30);
        expect(PLATE_SCAN_TARGETS.retry_chains).toBe(2);
        expect(PLATE_SCAN_TARGETS.retained_images).toBe(0);
    });

    test('accepts the complete target summary and rejects drift', () => {
        const summary = buildTargetSummary();

        expect(() => assertPlanTargets({ summary })).not.toThrow();

        summary.responses.rating_distribution[5] = 17;

        expect(() => assertPlanTargets({ summary })).toThrow(
            'Survey response seed targets mismatch'
        );
    });

    test('selects records evenly and deterministically', () => {
        const values = Array.from({ length: 20 }, (_, index) => index);

        expect(takeEvenly(values, 5)).toEqual([0, 5, 10, 14, 19]);
        expect(new Set(takeEvenly(values, 12)).size).toBe(12);
        expect(() => takeEvenly(values, 21)).toThrow(
            'Cannot select 21 records from 20 candidates'
        );
    });
});
