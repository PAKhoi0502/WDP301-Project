require('dotenv').config();

const mongoose = require('mongoose');

const { connectDB, disconnectDB } = require('../config/db');
const {
    STAFF_TYPE_CHANGE_REQUEST_SOURCES,
} = require('../shared/constants/staffTypeChange.constant');
const { USER_ROLES } = require('../shared/constants/roles.constant');

const LEGACY_REQUEST_FILTER = {
    $or: [
        { request_source: { $exists: false } },
        { requested_by_role: { $exists: false } },
    ],
};

const buildMigrationPipeline = () => ([
    {
        $set: {
            request_source: {
                $ifNull: [
                    '$request_source',
                    STAFF_TYPE_CHANGE_REQUEST_SOURCES.STAFF_SELF_REQUEST,
                ],
            },
            requested_by_role: {
                $ifNull: [
                    '$requested_by_role',
                    {
                        $cond: [
                            {
                                $eq: [
                                    '$request_source',
                                    STAFF_TYPE_CHANGE_REQUEST_SOURCES.ADMIN_DIRECTED,
                                ],
                            },
                            USER_ROLES.ADMIN,
                            USER_ROLES.STAFF,
                        ],
                    },
                ],
            },
        },
    },
]);

const migrateStaffTypeChangeSources = async ({ dryRun = false } = {}) => {
    const requests = mongoose.connection.collection('staff_type_change_requests');
    const legacyRequestsFound = await requests.countDocuments(LEGACY_REQUEST_FILTER);
    const result = {
        dry_run: dryRun,
        legacy_requests_found: legacyRequestsFound,
        requests_updated: 0,
    };

    if (dryRun || legacyRequestsFound === 0) {
        return result;
    }

    const updateResult = await requests.updateMany(
        LEGACY_REQUEST_FILTER,
        buildMigrationPipeline()
    );
    result.requests_updated = updateResult.modifiedCount;

    return result;
};

const run = async () => {
    let exitCode = 0;
    const dryRun = process.argv.includes('--dry-run');

    try {
        await connectDB();

        const result = await migrateStaffTypeChangeSources({ dryRun });

        console.log(
            `Staff type change source migration ${dryRun ? 'dry run' : 'completed'}: legacy_requests_found=${result.legacy_requests_found}, requests_updated=${result.requests_updated}`
        );
    } catch (error) {
        console.error('Staff type change source migration failed:', error);
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
    LEGACY_REQUEST_FILTER,
    buildMigrationPipeline,
    migrateStaffTypeChangeSources,
};
