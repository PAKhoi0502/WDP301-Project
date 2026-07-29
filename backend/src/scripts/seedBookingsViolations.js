require('dotenv').config();

const Booking = require('../modules/bookings/booking.model');
const BookingViolationEvent = require('../modules/booking-violations/bookingViolationEvent.model');
const CustomerBookingViolation = require('../modules/booking-violations/customerBookingViolation.model');
const Garage = require('../modules/garages/garage.model');
const Vehicle = require('../modules/vehicles/vehicle.model');
const WashBay = require('../modules/wash-bays/washBay.model');
const { connectDB, disconnectDB } = require('../config/db');
const {
    BOOKING_STATUS,
    BOOKING_PAYMENT_METHOD,
    BOOKING_PAYMENT_STATUS,
} = require('../shared/constants/booking.constant');
const { WASH_BAY_STATUS } = require('../shared/constants/washBay.constant');
const seedBooking = require('./seedBooking');
const seedGarage = require('./seedGarage');
const {
    seedServiceStepsInspectionsData,
    verifyServiceStepsInspections,
} = require('./seedServiceStepsInspections');
const {
    seedPaymentsPromotionUsagesData,
    verifyPaymentsPromotionUsages,
} = require('./seedPaymentsPromotionUsages');
const {
    seedLoyaltyHistoriesHandoversData,
} = require('./seedLoyaltyHistoriesHandovers');
const {
    seedIncidentsVouchersCustomerCasesData,
    verifyIncidentsVouchersCustomerCases,
} = require('./seedIncidentsVouchersCustomerCases');
const {
    seedNotificationsSurveysPlateScansData,
    verifyNotificationsSurveysPlateScans,
} = require('./seedNotificationsSurveysPlateScans');
const {
    buildBookingScenarios,
    assertBookingScenarioPlan,
} = require('./seedBookingCatalog');
const { getSeedReferenceDate } = require('./seedTime');

const toId = (value) => String(value?._id || value || '');

const countBy = (values, selector) => values.reduce((counts, value) => {
    const key = selector(value);

    counts[key] = (counts[key] || 0) + 1;

    return counts;
}, {});

const countsMatch = (actual, expected) => (
    Object.entries(expected).every(
        ([key, count]) => actual[key] === count
    )
    && Object.entries(actual).every(
        ([key, count]) => expected[key] === count
    )
);

const verifyBookingsViolations = async ({
    referenceDate,
    incidentLifecycle = false,
}) => {
    const scenarios = buildBookingScenarios(referenceDate);
    const scenarioSummary = assertBookingScenarioPlan(scenarios);
    const bookingIds = scenarios.map((scenario) => scenario.booking_id_hex);
    const [bookings, garages, washBays] = await Promise.all([
        Booking.find({ _id: { $in: bookingIds } }).lean(),
        Garage.find({
            garage_code: { $in: Object.keys(scenarioSummary.by_garage) },
        }).select('_id garage_code description').lean(),
        WashBay.find({ is_active: true }).lean(),
    ]);

    if (bookings.length !== scenarios.length) {
        throw new Error(
            `Booking verification failed: ${bookings.length}/${scenarios.length}`
        );
    }

    const garageById = new Map(
        garages.map((garage) => [toId(garage._id), garage])
    );
    const bookingById = new Map(
        bookings.map((booking) => [toId(booking._id), booking])
    );
    const customerBookings = bookings.filter(
        (booking) => !booking.is_walk_in
    );
    const vehicleIds = [
        ...new Set(customerBookings.map(
            (booking) => toId(booking.vehicle_id)
        )),
    ];
    const vehicles = await Vehicle.find({
        _id: { $in: vehicleIds },
    }).select('_id customer_id vehicle_type').lean();
    const vehicleById = new Map(
        vehicles.map((vehicle) => [toId(vehicle._id), vehicle])
    );

    for (const scenario of scenarios) {
        const booking = bookingById.get(scenario.booking_id_hex);
        const garage = garageById.get(toId(booking?.garage_id));
        const expectedBookingDate = new Date(Date.UTC(
            scenario.start_time.getUTCFullYear(),
            scenario.start_time.getUTCMonth(),
            scenario.start_time.getUTCDate()
        ));
        const localStart = new Date(
            scenario.start_time.getTime() + 7 * 60 * 60000
        );
        const localReservedEnd = new Date(Math.max(
            booking?.end_time?.getTime() || 0,
            booking?.wash_bay_reserved_until?.getTime() || 0,
            booking?.care_staff_reserved_until?.getTime() || 0
        ) + 7 * 60 * 60000);
        const localStartMinute = localStart.getUTCHours() * 60
            + localStart.getUTCMinutes();
        const localEndMinute = localReservedEnd.getUTCHours() * 60
            + localReservedEnd.getUTCMinutes();

        if (
            !booking
            || !garage
            || garage.garage_code !== scenario.garage_code
            || booking.status !== scenario.status
            || booking.start_time.getTime() !== scenario.start_time.getTime()
            || booking.booking_date.getTime()
                !== expectedBookingDate.getTime()
            || booking.is_walk_in !== (scenario.channel === 'WALK_IN')
            || localStartMinute < 7 * 60
            || localEndMinute > 19 * 60
        ) {
            throw new Error(
                `Booking scenario mapping mismatch: ${scenario.garage_code}:${scenario.seed_sequence}`
            );
        }

        const createdAt = booking.created_at?.getTime();
        const updatedAt = booking.updated_at?.getTime();
        const startTime = booking.start_time?.getTime();
        const startedAt = booking.started_at?.getTime();
        const completedAt = booking.completed_at?.getTime();
        const paidAt = booking.paid_at?.getTime();
        const canceledAt = booking.canceled_at?.getTime();
        const noShowAt = booking.no_show_at?.getTime();
        const checkedInAt = booking.checked_in_at?.getTime();

        if (
            !Number.isFinite(createdAt)
            || !Number.isFinite(updatedAt)
            || !Number.isFinite(startTime)
            || createdAt >= startTime
            || updatedAt < createdAt
            || (
                Number.isFinite(checkedInAt)
                && (checkedInAt < createdAt || checkedInAt >= startTime)
            )
            || (
                Number.isFinite(canceledAt)
                && (canceledAt < createdAt || canceledAt >= startTime)
            )
            || (
                Number.isFinite(noShowAt)
                && (noShowAt < createdAt || noShowAt <= startTime)
            )
            || (
                Number.isFinite(startedAt)
                && (startedAt < createdAt || startedAt < startTime)
            )
            || (
                Number.isFinite(completedAt)
                && (
                    !Number.isFinite(startedAt)
                    || completedAt <= startedAt
                )
            )
            || (
                Number.isFinite(paidAt)
                && (
                    !Number.isFinite(completedAt)
                    || paidAt < completedAt
                )
            )
        ) {
            throw new Error(
                `Booking timeline mismatch: ${scenario.garage_code}:${scenario.seed_sequence}`
            );
        }

        if (!booking.is_walk_in) {
            const vehicle = vehicleById.get(toId(booking.vehicle_id));

            if (
                !vehicle
                || toId(vehicle.customer_id) !== toId(booking.customer_id)
                || vehicle.vehicle_type !== booking.vehicle_type
            ) {
                throw new Error(
                    `Booking vehicle ownership mismatch: ${booking._id}`
                );
            }
        }

        if (
            (scenario.garage_code === 'GAR002'
                && booking.vehicle_type !== 'MOTORBIKE')
            || (scenario.garage_code === 'GAR005'
                && booking.vehicle_type !== 'CAR')
        ) {
            throw new Error(
                `Garage vehicle capability mismatch: ${scenario.garage_code}:${booking.vehicle_type}`
            );
        }
    }

    const statusCounts = countBy(bookings, (booking) => booking.status);
    const garageCounts = countBy(
        bookings,
        (booking) => garageById.get(toId(booking.garage_id)).garage_code
    );
    const completedPaid = bookings.filter((booking) => (
        booking.status === BOOKING_STATUS.COMPLETED
        && booking.payment_status === BOOKING_PAYMENT_STATUS.PAID
    ));
    const completedNonpaid = bookings.filter((booking) => (
        booking.status === BOOKING_STATUS.COMPLETED
        && booking.payment_status !== BOOKING_PAYMENT_STATUS.PAID
    ));
    const paymentSummary = {
        completed_paid: completedPaid.length,
        completed_nonpaid: completedNonpaid.length,
        paid_cash: completedPaid.filter(
            (booking) => (
                booking.payment_method === BOOKING_PAYMENT_METHOD.CASH
            )
        ).length,
        paid_payos: completedPaid.filter(
            (booking) => (
                booking.payment_method === BOOKING_PAYMENT_METHOD.PAYOS
            )
        ).length,
        nonpaid_pending: completedNonpaid.filter(
            (booking) => (
                booking.payment_status === BOOKING_PAYMENT_STATUS.PENDING
            )
        ).length,
        nonpaid_unpaid: completedNonpaid.filter(
            (booking) => (
                booking.payment_status === BOOKING_PAYMENT_STATUS.UNPAID
            )
        ).length,
    };

    if (
        !countsMatch(statusCounts, scenarioSummary.by_status)
        || !countsMatch(garageCounts, scenarioSummary.by_garage)
        || paymentSummary.completed_paid !== 355
        || paymentSummary.completed_nonpaid !== 10
        || paymentSummary.paid_cash !== 230
        || paymentSummary.paid_payos !== 125
        || paymentSummary.nonpaid_pending !== 0
        || paymentSummary.nonpaid_unpaid !== 10
    ) {
        throw new Error(
            `Booking aggregate verification failed: ${JSON.stringify({
                statusCounts,
                garageCounts,
                paymentSummary,
            })}`
        );
    }

    const noShows = bookings.filter(
        (booking) => booking.status === BOOKING_STATUS.NO_SHOW
    );
    const noShowIds = noShows.map((booking) => booking._id);
    const events = await BookingViolationEvent.find({
        booking_id: { $in: noShowIds },
        event: 'NO_SHOW',
    }).lean();
    const affectedCustomerIds = [
        ...new Set(noShows.map(
            (booking) => toId(booking.customer_id)
        )),
    ];
    const violationSummaries = await CustomerBookingViolation.find({
        customer_id: { $in: affectedCustomerIds },
    }).lean();
    const eventBookingIds = new Set(
        events.map((event) => toId(event.booking_id))
    );

    if (
        events.length !== noShows.length
        || noShows.some(
            (booking) => !eventBookingIds.has(toId(booking._id))
        )
        || violationSummaries.length !== 7
    ) {
        throw new Error(
            `Booking violation verification failed: events ${events.length}/8, summaries ${violationSummaries.length}/7`
        );
    }

    const violationScoreCounts = countBy(
        violationSummaries,
        (summary) => String(summary.violation_score)
    );

    if (
        violationScoreCounts['3'] !== 6
        || violationScoreCounts['6'] !== 1
    ) {
        throw new Error(
            `Booking violation score mismatch: ${JSON.stringify(violationScoreCounts)}`
        );
    }

    const occupiedBays = washBays.filter(
        (washBay) => washBay.status === WASH_BAY_STATUS.OCCUPIED
    );
    const maintenanceBays = washBays.filter(
        (washBay) => washBay.status === WASH_BAY_STATUS.MAINTENANCE
    );
    const expectedOccupiedBays = incidentLifecycle ? 2 : 3;
    const expectedMaintenanceBays = incidentLifecycle ? 1 : 0;
    const activeBookingIds = new Set(
        bookings.filter(
            (booking) => booking.status === BOOKING_STATUS.IN_PROGRESS
        ).map((booking) => toId(booking._id))
    );

    if (
        occupiedBays.length !== expectedOccupiedBays
        || maintenanceBays.length !== expectedMaintenanceBays
        || occupiedBays.some(
            (washBay) => (
                !activeBookingIds.has(toId(washBay.current_booking_id))
            )
        )
        || maintenanceBays.some((washBay) => washBay.current_booking_id)
    ) {
        throw new Error(
            `Wash bay active state mismatch: ${occupiedBays.length}:${maintenanceBays.length}/${expectedOccupiedBays}:${expectedMaintenanceBays}`
        );
    }

    const garageDescriptions = Object.fromEntries(
        garages.map((garage) => [
            garage.garage_code,
            garage.description,
        ])
    );

    if (
        !garageDescriptions.GAR002.includes('xe máy')
        || garageDescriptions.GAR002.includes('ô tô và xe máy')
        || !garageDescriptions.GAR005.includes('ô tô')
        || garageDescriptions.GAR005.includes('ô tô và xe máy')
    ) {
        throw new Error(
            `Garage description verification failed: ${JSON.stringify(garageDescriptions)}`
        );
    }

    return {
        bookings: {
            total: bookings.length,
            by_garage: garageCounts,
            by_status: statusCounts,
            walk_in: bookings.filter(
                (booking) => booking.is_walk_in
            ).length,
            customer: customerBookings.length,
            historical_buckets: scenarioSummary.historical_buckets,
        },
        payments: paymentSummary,
        violations: {
            events: events.length,
            customers: violationSummaries.length,
            score_distribution: violationScoreCounts,
        },
        wash_bays: {
            occupied: occupiedBays.length,
            maintenance: maintenanceBays.length,
            available: washBays.length
                - occupiedBays.length
                - maintenanceBays.length,
        },
        garage_descriptions: {
            GAR002: garageDescriptions.GAR002,
            GAR005: garageDescriptions.GAR005,
        },
    };
};

const seedBookingsViolations = async ({
    dryRun = process.argv.includes('--dry-run'),
} = {}) => {
    const referenceDate = getSeedReferenceDate();

    if (dryRun) {
        return {
            dry_run: true,
            reference_date: referenceDate,
            bookings: await seedBooking({
                referenceDate,
                dryRun: true,
            }),
        };
    }

    await connectDB();

    const session = await Booking.startSession();
    const result = {
        dry_run: false,
        reference_date: referenceDate,
    };

    try {
        await session.withTransaction(async () => {
            result.garages = await seedGarage({
                session,
                referenceDate,
            });
            result.bookings = await seedBooking({
                session,
                referenceDate,
            });
            result.service_lifecycle = await seedServiceStepsInspectionsData({
                session,
                referenceDate,
            });
            result.payment_promotion_lifecycle =
                await seedPaymentsPromotionUsagesData({
                    session,
                    referenceDate,
                });
            result.loyalty_history_handover_lifecycle =
                await seedLoyaltyHistoriesHandoversData({
                    session,
                    referenceDate,
                });
            result.incident_voucher_customer_case_lifecycle =
                await seedIncidentsVouchersCustomerCasesData({
                    session,
                    referenceDate,
                });
            result.notification_survey_plate_scan_lifecycle =
                await seedNotificationsSurveysPlateScansData({
                    session,
                    referenceDate,
                });
        });

        result.verification = await verifyBookingsViolations({
            referenceDate,
            incidentLifecycle: true,
        });
        result.service_lifecycle_verification =
            await verifyServiceStepsInspections({
                referenceDate,
            });
        result.payment_promotion_lifecycle_verification =
            await verifyPaymentsPromotionUsages({
                referenceDate,
            });
        result.incident_voucher_customer_case_lifecycle_verification =
            await verifyIncidentsVouchersCustomerCases({
                referenceDate,
            });
        result.notification_survey_plate_scan_lifecycle_verification =
            await verifyNotificationsSurveysPlateScans({
                referenceDate,
            });

        return result;
    } finally {
        await session.endSession();
        await disconnectDB();
    }
};

const run = async () => {
    try {
        const result = await seedBookingsViolations();

        console.log('Bookings and violations seed completed');
        console.dir(result.verification || result, { depth: null });
    } catch (error) {
        console.error('Bookings and violations seed failed:', error);
        process.exitCode = 1;

        await disconnectDB().catch(() => {});
    }
};

if (require.main === module) {
    run();
}

module.exports = {
    seedBookingsViolations,
    verifyBookingsViolations,
};
