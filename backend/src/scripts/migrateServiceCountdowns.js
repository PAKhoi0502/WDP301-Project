require('dotenv').config();

const { connectDB, disconnectDB } = require('../config/db');
const ServicePackage = require('../modules/service-packages/servicePackage.model');
const Booking = require('../modules/bookings/booking.model');
const {
    SERVICE_PACKAGE_TYPES,
    SERVICE_STEP_TYPES,
    SERVICE_TRANSITION_MODES,
} = require('../shared/constants/servicePackage.constant');

const isAutomaticService = (servicePackage) => {
    if (servicePackage.service_type === SERVICE_PACKAGE_TYPES.COMBO) {
        return false;
    }

    const requiredSteps = (servicePackage.steps_template || []).filter((step) => step.is_required !== false);

    if (requiredSteps.length > 0) {
        return requiredSteps.every((step) => step.step_type === SERVICE_STEP_TYPES.AUTOMATED_WASH_STEP);
    }

    return servicePackage.requires_wash_bay && !servicePackage.requires_care_staff;
};

const migrateServiceCountdowns = async ({ dryRun = false } = {}) => {
    const servicePackages = await ServicePackage.find({}).lean();
    const serviceConfigurationById = new Map();
    const serviceOperations = [];

    for (const servicePackage of servicePackages) {
        const countdownDurationSeconds = servicePackage.countdown_duration_seconds
            || servicePackage.duration_minutes * 60;
        const transitionMode = servicePackage.transition_mode
            || (isAutomaticService(servicePackage)
                ? SERVICE_TRANSITION_MODES.AUTO
                : SERVICE_TRANSITION_MODES.REQUIRE_CONFIRMATION);

        serviceConfigurationById.set(servicePackage._id.toString(), {
            countdownDurationSeconds,
            transitionMode,
        });

        if (
            servicePackage.countdown_duration_seconds !== countdownDurationSeconds
            || servicePackage.transition_mode !== transitionMode
        ) {
            serviceOperations.push({
                updateOne: {
                    filter: { _id: servicePackage._id },
                    update: {
                        $set: {
                            countdown_duration_seconds: countdownDurationSeconds,
                            transition_mode: transitionMode,
                        },
                    },
                },
            });
        }
    }

    const bookings = await Booking.find({
        booking_items: { $exists: true, $ne: [] },
    }).select('_id booking_items').lean();
    const bookingOperations = [];

    for (const booking of bookings) {
        let changed = false;
        const bookingItems = (booking.booking_items || []).map((item) => {
            const plainItem = item.toObject ? item.toObject() : { ...item };
            const configuration = serviceConfigurationById.get(plainItem.service_package_id.toString());
            const countdownDurationSeconds = plainItem.countdown_duration_seconds
                || configuration?.countdownDurationSeconds
                || plainItem.duration_minutes * 60;
            const transitionMode = plainItem.transition_mode
                || configuration?.transitionMode
                || SERVICE_TRANSITION_MODES.REQUIRE_CONFIRMATION;

            if (
                plainItem.countdown_duration_seconds !== countdownDurationSeconds
                || plainItem.transition_mode !== transitionMode
            ) {
                changed = true;
            }

            return {
                ...plainItem,
                countdown_duration_seconds: countdownDurationSeconds,
                transition_mode: transitionMode,
            };
        });

        if (changed) {
            bookingOperations.push({
                updateOne: {
                    filter: { _id: booking._id },
                    update: { $set: { booking_items: bookingItems } },
                },
            });
        }
    }

    if (!dryRun) {
        if (serviceOperations.length > 0) {
            await ServicePackage.bulkWrite(serviceOperations, { ordered: false });
        }

        if (bookingOperations.length > 0) {
            await Booking.bulkWrite(bookingOperations, { ordered: false });
        }
    }

    return {
        dry_run: dryRun,
        service_packages_found: servicePackages.length,
        service_packages_to_update: serviceOperations.length,
        bookings_found: bookings.length,
        bookings_to_update: bookingOperations.length,
    };
};

const run = async () => {
    let exitCode = 0;
    const dryRun = process.argv.includes('--dry-run');

    try {
        await connectDB();

        const result = await migrateServiceCountdowns({ dryRun });

        console.log(
            `Service countdown migration ${dryRun ? 'dry run' : 'completed'}: service_packages_found=${result.service_packages_found}, service_packages_to_update=${result.service_packages_to_update}, bookings_found=${result.bookings_found}, bookings_to_update=${result.bookings_to_update}`
        );
    } catch (error) {
        console.error('Service countdown migration failed:', error);
        exitCode = 1;
    } finally {
        await disconnectDB();
        process.exitCode = exitCode;
    }
};

if (require.main === module) {
    run();
}

module.exports = {
    isAutomaticService,
    migrateServiceCountdowns,
};
