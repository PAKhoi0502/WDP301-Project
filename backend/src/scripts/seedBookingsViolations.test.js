const {
    BOOKING_STATUS,
} = require('../shared/constants/booking.constant');
const {
    BOOKING_TARGETS,
    FUTURE_DAY_OFFSETS,
    LOYALTY_VISIT_TARGETS,
    buildBookingScenarios,
    assertBookingScenarioPlan,
} = require('./seedBookingCatalog');

const referenceDate = new Date('2026-07-28T05:00:00.000Z');

describe('booking seed catalog', () => {
    test('builds the approved deterministic booking distribution', () => {
        const scenarios = buildBookingScenarios(referenceDate);
        const summary = assertBookingScenarioPlan(scenarios);

        expect(summary.total).toBe(420);
        expect(summary.by_garage).toEqual({
            GAR001: 86,
            GAR002: 92,
            GAR003: 84,
            GAR004: 82,
            GAR005: 76,
        });
        expect(summary.by_status).toEqual({
            [BOOKING_STATUS.COMPLETED]: 365,
            [BOOKING_STATUS.CANCELED]: 15,
            [BOOKING_STATUS.NO_SHOW]: 8,
            [BOOKING_STATUS.CHECKED_IN]: 3,
            [BOOKING_STATUS.IN_PROGRESS]: 3,
            [BOOKING_STATUS.CONFIRMED]: 26,
        });
        expect(summary.walk_in).toBe(39);
        expect(summary.customer).toBe(381);
        expect(summary.historical_buckets).toEqual([
            35,
            75,
            115,
            163,
        ]);
        expect(new Set(
            scenarios.map((scenario) => scenario.booking_id_hex)
        ).size).toBe(420);
    });

    test('keeps garage totals internally consistent', () => {
        for (const [garageCode, target] of Object.entries(
            BOOKING_TARGETS
        )) {
            const total = target.completed_paid
                + target.completed_nonpaid
                + target.canceled
                + target.no_show
                + target.checked_in
                + target.in_progress
                + target.confirmed;
            const scenarios = buildBookingScenarios(referenceDate)
                .filter(
                    (scenario) => scenario.garage_code === garageCode
                );

            expect(scenarios).toHaveLength(total);
            expect(
                scenarios.filter(
                    (scenario) => scenario.kind === 'COMPLETED_PAID'
                )
            ).toHaveLength(target.completed_paid);
            expect(
                scenarios.filter(
                    (scenario) => scenario.kind === 'NO_SHOW'
                )
            ).toHaveLength(target.no_show);
        }
    });

    test('supports later loyalty seeding and tier booking windows', () => {
        const paidCustomerVisits = Object.values(
            LOYALTY_VISIT_TARGETS
        ).reduce((total, garage) => (
            total
            + Object.values(garage).flat().reduce(
                (subtotal, visits) => subtotal + visits,
                0
            )
        ), 0);
        const futureOffsets = Object.values(
            FUTURE_DAY_OFFSETS
        ).flat();

        expect(paidCustomerVisits).toBe(327);
        expect(futureOffsets).toHaveLength(26);
        expect(futureOffsets.filter((offset) => offset === 0))
            .toHaveLength(4);
        expect(futureOffsets.filter(
            (offset) => offset >= 1 && offset <= 7
        )).toHaveLength(12);
        expect(futureOffsets.filter(
            (offset) => offset >= 8 && offset <= 10
        )).toHaveLength(4);
        expect(futureOffsets.filter(
            (offset) => offset >= 11 && offset <= 14
        )).toHaveLength(4);
        expect(futureOffsets.filter(
            (offset) => offset >= 15 && offset <= 20
        )).toHaveLength(2);
    });
});
