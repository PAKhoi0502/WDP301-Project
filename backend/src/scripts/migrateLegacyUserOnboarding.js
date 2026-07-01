require('dotenv').config();

const mongoose = require('mongoose');

const { connectDB, disconnectDB } = require('../config/db');
const User = require('../modules/users/user.model');
const { USER_ROLES } = require('../shared/constants/roles.constant');
const {
    USER_ONBOARDING_STATUSES,
} = require('../shared/constants/userOnboarding.constant');

const LEGACY_USER_FILTER = {
    onboarding_status: { $exists: false },
};

const LEGACY_STAFF_FILTER = {
    ...LEGACY_USER_FILTER,
    role: USER_ROLES.STAFF,
};

const buildLegacyStaffUpdate = () => ([
    {
        $set: {
            onboarding_status: USER_ONBOARDING_STATUSES.ACTIVE,
            phone_verified_at: {
                $ifNull: [
                    '$phone_verified_at',
                    { $ifNull: ['$created_at', '$$NOW'] },
                ],
            },
        },
    },
]);

const migrateLegacyUserOnboarding = async ({ dryRun = false } = {}) => {
    const [legacyUserCount, legacyStaffCount] = await Promise.all([
        User.countDocuments(LEGACY_USER_FILTER),
        User.countDocuments(LEGACY_STAFF_FILTER),
    ]);

    const result = {
        dry_run: dryRun,
        legacy_users_found: legacyUserCount,
        legacy_staff_found: legacyStaffCount,
        legacy_non_staff_found: legacyUserCount - legacyStaffCount,
        staff_updated: 0,
        non_staff_updated: 0,
    };

    if (dryRun || legacyUserCount === 0) {
        return result;
    }

    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            const staffResult = await User.updateMany(
                LEGACY_STAFF_FILTER,
                buildLegacyStaffUpdate(),
                { session }
            );

            const nonStaffResult = await User.updateMany(
                LEGACY_USER_FILTER,
                {
                    $set: {
                        onboarding_status: USER_ONBOARDING_STATUSES.ACTIVE,
                    },
                },
                { session }
            );

            result.staff_updated = staffResult.modifiedCount;
            result.non_staff_updated = nonStaffResult.modifiedCount;
        });
    } finally {
        await session.endSession();
    }

    return result;
};

const run = async () => {
    let exitCode = 0;
    const dryRun = process.argv.includes('--dry-run');

    try {
        await connectDB();

        const result = await migrateLegacyUserOnboarding({ dryRun });

        console.log(
            `Legacy onboarding migration ${dryRun ? 'dry run' : 'completed'}: legacy_users_found=${result.legacy_users_found}, legacy_staff_found=${result.legacy_staff_found}, legacy_non_staff_found=${result.legacy_non_staff_found}, staff_updated=${result.staff_updated}, non_staff_updated=${result.non_staff_updated}`
        );
    } catch (error) {
        console.error('Legacy onboarding migration failed:', error);
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
    LEGACY_USER_FILTER,
    LEGACY_STAFF_FILTER,
    buildLegacyStaffUpdate,
    migrateLegacyUserOnboarding,
};
