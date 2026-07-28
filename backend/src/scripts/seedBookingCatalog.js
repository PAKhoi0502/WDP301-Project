const crypto = require('crypto');

const { BOOKING_STATUS } = require('../shared/constants/booking.constant');
const { VEHICLE_TYPES } = require('../shared/constants/vehicle.constant');
const { atLocalDayAndMinute } = require('./seedTime');

const BOOKING_TARGETS = Object.freeze({
    GAR001: Object.freeze({
        completed_paid: 73,
        completed_nonpaid: 2,
        canceled: 3,
        no_show: 2,
        checked_in: 1,
        in_progress: 1,
        confirmed: 4,
        paid_walk_in: 5,
        nonpaid_walk_in: 1,
        canceled_walk_in: 1,
    }),
    GAR002: Object.freeze({
        completed_paid: 79,
        completed_nonpaid: 2,
        canceled: 3,
        no_show: 2,
        checked_in: 1,
        in_progress: 0,
        confirmed: 5,
        paid_walk_in: 7,
        nonpaid_walk_in: 1,
        canceled_walk_in: 1,
    }),
    GAR003: Object.freeze({
        completed_paid: 70,
        completed_nonpaid: 2,
        canceled: 3,
        no_show: 2,
        checked_in: 0,
        in_progress: 1,
        confirmed: 6,
        paid_walk_in: 5,
        nonpaid_walk_in: 1,
        canceled_walk_in: 1,
    }),
    GAR004: Object.freeze({
        completed_paid: 68,
        completed_nonpaid: 2,
        canceled: 3,
        no_show: 1,
        checked_in: 1,
        in_progress: 0,
        confirmed: 7,
        paid_walk_in: 5,
        nonpaid_walk_in: 1,
        canceled_walk_in: 0,
    }),
    GAR005: Object.freeze({
        completed_paid: 65,
        completed_nonpaid: 2,
        canceled: 3,
        no_show: 1,
        checked_in: 0,
        in_progress: 1,
        confirmed: 4,
        paid_walk_in: 6,
        nonpaid_walk_in: 1,
        canceled_walk_in: 0,
    }),
});

const HISTORICAL_BUCKET_TARGETS = Object.freeze({
    GAR001: Object.freeze([7, 15, 24, 34]),
    GAR002: Object.freeze([8, 17, 25, 36]),
    GAR003: Object.freeze([7, 15, 23, 32]),
    GAR004: Object.freeze([7, 14, 22, 31]),
    GAR005: Object.freeze([6, 14, 21, 30]),
});

const HISTORICAL_BUCKETS = Object.freeze([
    Object.freeze({ from: -29, to: -22 }),
    Object.freeze({ from: -21, to: -15 }),
    Object.freeze({ from: -14, to: -8 }),
    Object.freeze({ from: -7, to: -1 }),
]);

const LOYALTY_VISIT_TARGETS = Object.freeze({
    GAR001: Object.freeze({
        platinum: Object.freeze([15]),
        gold: Object.freeze([8, 9]),
        silver: Object.freeze([3, 4, 4, 4, 4]),
        bronze: Object.freeze([
            ...Array(7).fill(2),
            ...Array(3).fill(1),
            ...Array(7).fill(0),
        ]),
    }),
    GAR002: Object.freeze({
        platinum: Object.freeze([]),
        gold: Object.freeze([10, 11]),
        silver: Object.freeze([4, 4, 4, 5, 5]),
        bronze: Object.freeze([
            ...Array(13).fill(2),
            ...Array(3).fill(1),
            ...Array(2).fill(0),
        ]),
    }),
    GAR003: Object.freeze({
        platinum: Object.freeze([16]),
        gold: Object.freeze([8, 9]),
        silver: Object.freeze([3, 4, 4, 4, 4]),
        bronze: Object.freeze([
            ...Array(5).fill(2),
            ...Array(3).fill(1),
            ...Array(9).fill(0),
        ]),
    }),
    GAR004: Object.freeze({
        platinum: Object.freeze([]),
        gold: Object.freeze([8, 9]),
        silver: Object.freeze([3, 4, 4, 4, 4]),
        bronze: Object.freeze([
            ...Array(10).fill(2),
            ...Array(7).fill(1),
            ...Array(1).fill(0),
        ]),
    }),
    GAR005: Object.freeze({
        platinum: Object.freeze([17]),
        gold: Object.freeze([9, 9]),
        silver: Object.freeze([3, 4, 4, 4, 5]),
        bronze: Object.freeze([
            ...Array(4).fill(1),
            ...Array(13).fill(0),
        ]),
    }),
});

const FUTURE_DAY_OFFSETS = Object.freeze({
    GAR001: Object.freeze([0, 1, 4, 9]),
    GAR002: Object.freeze([0, 2, 5, 10, 13]),
    GAR003: Object.freeze([0, 1, 3, 6, 12, 18]),
    GAR004: Object.freeze([1, 2, 4, 7, 8, 11, 14]),
    GAR005: Object.freeze([0, 5, 9, 16]),
});

const ACTIVE_CHANNELS = Object.freeze({
    GAR001: Object.freeze({
        checked_in: 'WALK_IN',
        in_progress: 'CUSTOMER',
    }),
    GAR002: Object.freeze({
        checked_in: 'WALK_IN',
    }),
    GAR003: Object.freeze({
        in_progress: 'WALK_IN',
    }),
    GAR004: Object.freeze({
        checked_in: 'CUSTOMER',
    }),
    GAR005: Object.freeze({
        in_progress: 'CUSTOMER',
    }),
});

const stableHexId = (namespace, key) => crypto
    .createHash('sha256')
    .update(`${namespace}:${key}`)
    .digest('hex')
    .slice(0, 24);

const distributeOffsets = ({ count, from, to }) => {
    const dayCount = to - from + 1;

    return Array.from({ length: count }, (_, index) => (
        from + (index % dayCount)
    )).sort((left, right) => left - right);
};

const buildHistoricalOffsets = (garageCode) => HISTORICAL_BUCKETS.flatMap(
    (bucket, index) => distributeOffsets({
        count: HISTORICAL_BUCKET_TARGETS[garageCode][index],
        from: bucket.from,
        to: bucket.to,
    })
);

const takeEvenlySpacedIndexes = ({
    availableIndexes,
    count,
    minimumRatio = 0,
}) => {
    if (count === 0) {
        return [];
    }

    const candidates = availableIndexes.filter(
        (index) => index >= Math.floor(availableIndexes.length * minimumRatio)
    );
    const selected = [];

    for (let sequence = 0; sequence < count; sequence += 1) {
        const candidatePosition = Math.min(
            candidates.length - 1,
            Math.floor(((sequence + 1) * candidates.length) / (count + 1))
        );
        const selectedIndex = candidates[candidatePosition];

        selected.push(selectedIndex);
        candidates.splice(candidatePosition, 1);
    }

    return selected;
};

const buildHistoricalKinds = ({ garageCode, total }) => {
    const target = BOOKING_TARGETS[garageCode];
    const kinds = Array(total).fill('COMPLETED_PAID');
    const available = Array.from({ length: total }, (_, index) => index);
    const noShowIndexes = takeEvenlySpacedIndexes({
        availableIndexes: available,
        count: target.no_show,
        minimumRatio: 0.72,
    });

    noShowIndexes.forEach((index) => {
        kinds[index] = 'NO_SHOW';
        available.splice(available.indexOf(index), 1);
    });

    const canceledIndexes = takeEvenlySpacedIndexes({
        availableIndexes: available,
        count: target.canceled,
        minimumRatio: 0.32,
    });

    canceledIndexes.forEach((index) => {
        kinds[index] = 'CANCELED';
        available.splice(available.indexOf(index), 1);
    });

    const nonpaidIndexes = takeEvenlySpacedIndexes({
        availableIndexes: available,
        count: target.completed_nonpaid,
        minimumRatio: 0.55,
    });

    nonpaidIndexes.forEach((index) => {
        kinds[index] = 'COMPLETED_NONPAID';
    });

    return kinds;
};

const markWalkIns = (scenarios, kind, count) => {
    const matches = scenarios.filter((scenario) => scenario.kind === kind);

    for (let index = 0; index < count; index += 1) {
        const position = Math.min(
            matches.length - 1,
            Math.floor(((index + 1) * matches.length) / (count + 1))
        );

        matches[position].channel = 'WALK_IN';
    }
};

const buildHistoricalScenarios = ({
    garageCode,
    garageIndex,
    referenceDate,
}) => {
    const offsets = buildHistoricalOffsets(garageCode);
    const kinds = buildHistoricalKinds({
        garageCode,
        total: offsets.length,
    });
    const perDaySequence = new Map();
    const scenarios = offsets.map((dayOffset, index) => {
        const sequence = perDaySequence.get(dayOffset) || 0;
        const minuteOfDay = 7 * 60 + 30 + sequence * 105
            + ((garageIndex + dayOffset + 60) % 3) * 10;

        perDaySequence.set(dayOffset, sequence + 1);

        return {
            garage_code: garageCode,
            seed_sequence: index + 1,
            kind: kinds[index],
            channel: 'CUSTOMER',
            day_offset: dayOffset,
            start_time: atLocalDayAndMinute({
                referenceDate,
                dayOffset,
                minuteOfDay,
            }),
        };
    });
    const target = BOOKING_TARGETS[garageCode];

    markWalkIns(scenarios, 'COMPLETED_PAID', target.paid_walk_in);
    markWalkIns(scenarios, 'COMPLETED_NONPAID', target.nonpaid_walk_in);
    markWalkIns(scenarios, 'CANCELED', target.canceled_walk_in);

    return scenarios;
};

const buildActiveScenarios = ({
    garageCode,
    referenceDate,
    firstSequence,
}) => {
    const target = BOOKING_TARGETS[garageCode];
    const activeChannels = ACTIVE_CHANNELS[garageCode];
    const scenarios = [];

    for (let index = 0; index < target.checked_in; index += 1) {
        scenarios.push({
            garage_code: garageCode,
            seed_sequence: firstSequence + scenarios.length,
            kind: 'CHECKED_IN',
            channel: activeChannels.checked_in,
            day_offset: 0,
            start_time: atLocalDayAndMinute({
                referenceDate,
                minuteOfDay: 12 * 60 + 20,
            }),
        });
    }

    for (let index = 0; index < target.in_progress; index += 1) {
        scenarios.push({
            garage_code: garageCode,
            seed_sequence: firstSequence + scenarios.length,
            kind: 'IN_PROGRESS',
            channel: activeChannels.in_progress,
            day_offset: 0,
            start_time: atLocalDayAndMinute({
                referenceDate,
                minuteOfDay: 11 * 60 + 40,
            }),
            force_wash_bay: true,
        });
    }

    return scenarios;
};

const buildConfirmedScenarios = ({
    garageCode,
    referenceDate,
    firstSequence,
}) => FUTURE_DAY_OFFSETS[garageCode].map((dayOffset, index) => ({
    garage_code: garageCode,
    seed_sequence: firstSequence + index,
    kind: 'CONFIRMED',
    channel: 'CUSTOMER',
    day_offset: dayOffset,
    future_sequence: index,
    start_time: atLocalDayAndMinute({
        referenceDate,
        dayOffset,
        minuteOfDay: dayOffset === 0
            ? 14 * 60 + index * 60
            : 8 * 60 + 30 + ((index * 3 + Number(garageCode.slice(-1))) % 7) * 75,
    }),
}));

const toBookingStatus = (kind) => {
    if (kind.startsWith('COMPLETED')) {
        return BOOKING_STATUS.COMPLETED;
    }

    return BOOKING_STATUS[kind];
};

const buildBookingScenarios = (referenceDate) => {
    const scenarios = [];

    Object.keys(BOOKING_TARGETS).forEach((garageCode, garageIndex) => {
        const historical = buildHistoricalScenarios({
            garageCode,
            garageIndex,
            referenceDate,
        });
        const active = buildActiveScenarios({
            garageCode,
            referenceDate,
            firstSequence: historical.length + 1,
        });
        const confirmed = buildConfirmedScenarios({
            garageCode,
            referenceDate,
            firstSequence: historical.length + active.length + 1,
        });

        scenarios.push(...historical, ...active, ...confirmed);
    });

    return scenarios.map((scenario) => ({
        ...scenario,
        status: toBookingStatus(scenario.kind),
        booking_id_hex: stableHexId(
            'AUTOWASH_BOOKING_V1',
            `${scenario.garage_code}:${String(scenario.seed_sequence).padStart(3, '0')}`
        ),
    }));
};

const summarizeBookingScenarios = (scenarios) => {
    const summary = {
        total: scenarios.length,
        by_garage: {},
        by_status: {},
        walk_in: 0,
        customer: 0,
        historical_buckets: [0, 0, 0, 0],
    };

    for (const scenario of scenarios) {
        summary.by_garage[scenario.garage_code] = (
            summary.by_garage[scenario.garage_code] || 0
        ) + 1;
        summary.by_status[scenario.status] = (
            summary.by_status[scenario.status] || 0
        ) + 1;
        summary[scenario.channel === 'WALK_IN' ? 'walk_in' : 'customer'] += 1;

        if (scenario.day_offset < 0) {
            const bucketIndex = HISTORICAL_BUCKETS.findIndex((bucket) => (
                scenario.day_offset >= bucket.from
                && scenario.day_offset <= bucket.to
            ));

            summary.historical_buckets[bucketIndex] += 1;
        }
    }

    return summary;
};

const assertBookingScenarioPlan = (scenarios) => {
    const summary = summarizeBookingScenarios(scenarios);

    if (summary.total !== 420) {
        throw new Error(`Booking seed total mismatch: ${summary.total}`);
    }

    const expectedStatuses = {
        [BOOKING_STATUS.COMPLETED]: 365,
        [BOOKING_STATUS.CANCELED]: 15,
        [BOOKING_STATUS.NO_SHOW]: 8,
        [BOOKING_STATUS.CHECKED_IN]: 3,
        [BOOKING_STATUS.IN_PROGRESS]: 3,
        [BOOKING_STATUS.CONFIRMED]: 26,
    };

    for (const [status, expected] of Object.entries(expectedStatuses)) {
        if (summary.by_status[status] !== expected) {
            throw new Error(
                `Booking status target mismatch: ${status}:${summary.by_status[status]}`
            );
        }
    }

    if (summary.walk_in !== 39 || summary.customer !== 381) {
        throw new Error(
            `Booking channel target mismatch: ${summary.walk_in}:${summary.customer}`
        );
    }

    if (summary.historical_buckets.join(',') !== '35,75,115,163') {
        throw new Error(
            `Booking historical bucket mismatch: ${summary.historical_buckets.join(',')}`
        );
    }

    return summary;
};

const getGuestVehicleType = (garageCode, sequence) => {
    if (garageCode === 'GAR002') {
        return VEHICLE_TYPES.MOTORBIKE;
    }

    if (garageCode === 'GAR005') {
        return VEHICLE_TYPES.CAR;
    }

    return sequence % 2 === 0
        ? VEHICLE_TYPES.CAR
        : VEHICLE_TYPES.MOTORBIKE;
};

module.exports = {
    BOOKING_TARGETS,
    HISTORICAL_BUCKETS,
    HISTORICAL_BUCKET_TARGETS,
    LOYALTY_VISIT_TARGETS,
    FUTURE_DAY_OFFSETS,
    stableHexId,
    buildBookingScenarios,
    summarizeBookingScenarios,
    assertBookingScenarioPlan,
    getGuestVehicleType,
};
