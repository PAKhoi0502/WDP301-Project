require('dotenv').config();

const { connectDB, disconnectDB } = require('../config/db');
const ServicePackage = require('../modules/service-packages/servicePackage.model');
const ServicePriceRule = require('../modules/service-price-rules/servicePriceRule.model');
const Booking = require('../modules/bookings/booking.model');
const Vehicle = require('../modules/vehicles/vehicle.model');

const migrateServicePriceRules = async ({ dryRun = false } = {}) => {
    const servicePackages = await ServicePackage.find({}).lean();
    const operations = [];

    for (const servicePackage of servicePackages) {
        const hasConfiguredRule = await ServicePriceRule.exists({
            service_package_id: servicePackage._id,
        });

        if (hasConfiguredRule) {
            continue;
        }

        operations.push({
            insertOne: {
                document: {
                    service_package_id: servicePackage._id,
                    garage_id: null,
                    vehicle_type: servicePackage.vehicle_type,
                    engine_type: null,
                    motorbike_cc_group: null,
                    car_body_type: null,
                    seat_min: null,
                    seat_max: null,
                    price: servicePackage.base_price,
                    duration_minutes: null,
                    wash_bay_duration_minutes: null,
                    care_staff_duration_minutes: null,
                    effective_from: servicePackage.created_at || new Date(),
                    effective_to: null,
                    version: 1,
                    is_active: true,
                    note: 'Default rule migrated from service package base price',
                    created_at: new Date(),
                    updated_at: new Date(),
                },
            },
        });
    }

    if (!dryRun && operations.length > 0) {
        await ServicePriceRule.bulkWrite(operations, { ordered: true });
    }

    const bookings = await Booking.find({
        status: { $in: ['PENDING', 'CONFIRMED'] },
        $or: [
            { quoted_vehicle_snapshot: { $exists: false } },
            { quoted_vehicle_snapshot: null },
            { pricing_review_status: { $exists: false } },
        ],
    }).select('_id vehicle_id vehicle_type quoted_vehicle_snapshot').lean();
    const vehicleIds = bookings.map((booking) => booking.vehicle_id).filter(Boolean);
    const vehicles = await Vehicle.find({ _id: { $in: vehicleIds } })
        .select('_id vehicle_type engine_type motorbike_cc_group car_body_type seat_count')
        .lean();
    const vehicleById = new Map(
        vehicles.map((vehicle) => [vehicle._id.toString(), vehicle])
    );
    const bookingOperations = bookings.map((booking) => {
        const vehicle = booking.vehicle_id
            ? vehicleById.get(booking.vehicle_id.toString())
            : null;
        const snapshot = booking.quoted_vehicle_snapshot || {
            vehicle_type: vehicle?.vehicle_type || booking.vehicle_type,
            engine_type: vehicle?.engine_type || null,
            motorbike_cc_group: vehicle?.motorbike_cc_group || null,
            car_body_type: vehicle?.car_body_type || null,
            seat_count: vehicle?.seat_count || null,
        };

        return {
            updateOne: {
                filter: { _id: booking._id },
                update: {
                    $set: {
                        quoted_vehicle_snapshot: snapshot,
                        pricing_review_status: 'REVIEW_REQUIRED',
                    },
                },
            },
        };
    });

    if (!dryRun && bookingOperations.length > 0) {
        await Booking.bulkWrite(bookingOperations, { ordered: true });
    }

    return {
        dry_run: dryRun,
        service_package_count: servicePackages.length,
        default_rule_count: operations.length,
        booking_review_backfill_count: bookingOperations.length,
    };
};

const run = async () => {
    let exitCode = 0;

    try {
        await connectDB();
        const result = await migrateServicePriceRules({
            dryRun: process.argv.includes('--dry-run'),
        });
        console.table([result]);
    } catch (error) {
        console.error('Service price rule migration failed:', error);
        exitCode = 1;
    } finally {
        await disconnectDB();
        process.exitCode = exitCode;
    }
};

if (require.main === module) {
    run();
}

module.exports = migrateServicePriceRules;
