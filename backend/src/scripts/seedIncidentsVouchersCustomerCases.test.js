const {
    INCIDENT_TARGETS,
    VOUCHER_TARGETS,
    CUSTOMER_CASE_TARGETS,
    CUSTOMER_CASE_CATEGORY_SEQUENCE,
    CUSTOMER_CASE_STATUS_SEQUENCE,
    CUSTOMER_CASE_DEPENDENT_TARGETS,
} = require('./seedIncidentsVouchersCustomerCasesCatalog');
const {
    takeEvenly,
    assertPlanTargets,
} = require('./seedIncidentsVouchersCustomerCases');

const countBy = (values) => values.reduce((counts, value) => ({
    ...counts,
    [value]: (counts[value] || 0) + 1,
}), {});

const sumCounts = (counts) => Object.values(counts).reduce(
    (total, count) => total + count,
    0
);

const buildTargetSummary = () => ({
    incidents: {
        total: INCIDENT_TARGETS.total,
        by_type: { ...INCIDENT_TARGETS.by_type },
        by_status: { ...INCIDENT_TARGETS.by_status },
        by_decision: { ...INCIDENT_TARGETS.by_decision },
        by_garage: {
            GAR001: 2,
            GAR002: 2,
            GAR003: 2,
            GAR004: 2,
            GAR005: 2,
        },
    },
    vouchers: {
        total: VOUCHER_TARGETS.total,
        by_type: { ...VOUCHER_TARGETS.by_type },
        by_status: { ...VOUCHER_TARGETS.by_status },
        by_source: { ...VOUCHER_TARGETS.by_source },
    },
    customer_cases: {
        total: CUSTOMER_CASE_TARGETS.total,
        registered: CUSTOMER_CASE_TARGETS.registered,
        walk_in: CUSTOMER_CASE_TARGETS.walk_in,
        by_status: { ...CUSTOMER_CASE_TARGETS.by_status },
        by_category: { ...CUSTOMER_CASE_TARGETS.by_category },
        by_source: { ...CUSTOMER_CASE_TARGETS.by_source },
        by_garage: {
            GAR001: 4,
            GAR002: 4,
            GAR003: 4,
            GAR004: 3,
            GAR005: 3,
        },
        reopened: CUSTOMER_CASE_TARGETS.reopened,
        sla_escalated: CUSTOMER_CASE_TARGETS.sla_escalated,
    },
    dependents: {
        messages: CUSTOMER_CASE_DEPENDENT_TARGETS.messages,
        events: 146,
        technical_assessments:
            CUSTOMER_CASE_DEPENDENT_TARGETS.technical_assessments,
        assessment_statuses: {
            ...CUSTOMER_CASE_DEPENDENT_TARGETS.assessment_statuses,
        },
        resolutions: CUSTOMER_CASE_DEPENDENT_TARGETS.resolutions,
        resolution_statuses: {
            ...CUSTOMER_CASE_DEPENDENT_TARGETS.resolution_statuses,
        },
        refunds: CUSTOMER_CASE_DEPENDENT_TARGETS.refunds,
        refund_statuses: {
            ...CUSTOMER_CASE_DEPENDENT_TARGETS.refund_statuses,
        },
    },
});

describe('incidents, vouchers and customer cases seed', () => {
    test('locks all agreed catalog totals', () => {
        expect(sumCounts(INCIDENT_TARGETS.by_type)).toBe(10);
        expect(sumCounts(INCIDENT_TARGETS.by_status)).toBe(10);
        expect(sumCounts(INCIDENT_TARGETS.by_decision)).toBe(9);
        expect(sumCounts(VOUCHER_TARGETS.by_type)).toBe(12);
        expect(sumCounts(VOUCHER_TARGETS.by_status)).toBe(12);
        expect(sumCounts(VOUCHER_TARGETS.by_source)).toBe(12);
        expect(sumCounts(CUSTOMER_CASE_TARGETS.by_status)).toBe(18);
        expect(sumCounts(CUSTOMER_CASE_TARGETS.by_category)).toBe(18);
        expect(sumCounts(CUSTOMER_CASE_TARGETS.by_source)).toBe(18);
        expect(CUSTOMER_CASE_TARGETS.registered).toBe(15);
        expect(CUSTOMER_CASE_TARGETS.walk_in).toBe(3);
    });

    test('keeps category and status sequences aligned with their targets', () => {
        expect(CUSTOMER_CASE_CATEGORY_SEQUENCE).toHaveLength(18);
        expect(CUSTOMER_CASE_STATUS_SEQUENCE).toHaveLength(18);
        expect(countBy(CUSTOMER_CASE_CATEGORY_SEQUENCE)).toEqual(
            CUSTOMER_CASE_TARGETS.by_category
        );
        expect(countBy(CUSTOMER_CASE_STATUS_SEQUENCE)).toEqual(
            CUSTOMER_CASE_TARGETS.by_status
        );
    });

    test('accepts the complete target summary and rejects count drift', () => {
        const summary = buildTargetSummary();

        expect(() => assertPlanTargets(summary)).not.toThrow();

        summary.vouchers.by_status.ISSUED = 4;

        expect(() => assertPlanTargets(summary)).toThrow(
            'Voucher seed target mismatch'
        );
    });

    test('selects evenly without duplicates and remains deterministic', () => {
        const values = Array.from({ length: 20 }, (_, index) => ({
            _id: String(index),
            value: index,
        }));
        const first = takeEvenly(values, 6);
        const second = takeEvenly(values, 6);

        expect(first).toEqual(second);
        expect(first).toHaveLength(6);
        expect(new Set(first.map((item) => item._id)).size).toBe(6);
        expect(first[0].value).toBe(0);
        expect(first.at(-1).value).toBe(19);
    });
});
