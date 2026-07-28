require('dotenv').config();

const User = require('../modules/users/user.model');
const Garage = require('../modules/garages/garage.model');
const { connectDB, disconnectDB } = require('../config/db');
const { USER_ROLES } = require('../shared/constants/roles.constant');
const { normalizePhone } = require('../shared/utils/phone');
const seedUser = require('./seedUser');
const seedGarage = require('./seedGarage');
const { buildSeedUsers, GARAGE_SEEDS } = require('./seedCatalog');
const { getSeedReferenceDate } = require('./seedTime');

const verifyUsersGarages = async ({
    referenceDate,
    verifyUsers = true,
    verifyGarages = true,
} = {}) => {
    const verification = {};

    if (verifyUsers) {
        const seedUsers = buildSeedUsers(referenceDate);
        const phones = seedUsers.map((user) => normalizePhone(user.phone));
        const users = await User.find({ phone: { $in: phones } })
            .select('phone email role created_at')
            .lean();
        const roleCounts = users.reduce((counts, user) => ({
            ...counts,
            [user.role]: (counts[user.role] || 0) + 1,
        }), {});
        const duplicatePhones = await User.aggregate([
            { $match: { phone: { $in: phones } } },
            { $group: { _id: '$phone', count: { $sum: 1 } } },
            { $match: { count: { $gt: 1 } } },
        ]);
        const duplicateEmails = await User.aggregate([
            { $match: { phone: { $in: phones } } },
            { $group: { _id: '$email', count: { $sum: 1 } } },
            { $match: { count: { $gt: 1 } } },
        ]);
        const customers = users.filter((user) => user.role === USER_ROLES.CUSTOMER);
        const customerDates = customers.map((user) => user.created_at.getTime());
        const registrationDayCount = new Set(
            customers.map((user) => user.created_at.toISOString().slice(0, 10))
        ).size;

        if (users.length !== seedUsers.length) {
            throw new Error(`User seed verification failed: expected ${seedUsers.length}, found ${users.length}`);
        }

        if (
            roleCounts[USER_ROLES.ADMIN] !== 2
            || roleCounts[USER_ROLES.STAFF] !== 50
            || roleCounts[USER_ROLES.CUSTOMER] !== 125
        ) {
            throw new Error(`User role verification failed: ${JSON.stringify(roleCounts)}`);
        }

        if (duplicatePhones.length > 0 || duplicateEmails.length > 0) {
            throw new Error('Seed user uniqueness verification failed');
        }

        if (registrationDayCount < 25) {
            throw new Error(`Customer registration distribution is too narrow: ${registrationDayCount} days`);
        }

        verification.users = {
            total: users.length,
            role_counts: roleCounts,
            duplicate_phones: duplicatePhones.length,
            duplicate_emails: duplicateEmails.length,
            customer_registration_days: registrationDayCount,
            customer_created_from: new Date(Math.min(...customerDates)),
            customer_created_to: new Date(Math.max(...customerDates)),
        };
    }

    if (verifyGarages) {
        const garageCodes = GARAGE_SEEDS.map((garage) => garage.garage_code);
        const garages = await Garage.find({ garage_code: { $in: garageCodes } })
            .select('garage_code name opening_time closing_time is_active')
            .lean();

        if (garages.length !== GARAGE_SEEDS.length) {
            throw new Error(`Garage seed verification failed: expected ${GARAGE_SEEDS.length}, found ${garages.length}`);
        }

        if (garages.some((garage) => (
            garage.opening_time !== '07:00'
            || garage.closing_time !== '19:00'
            || !garage.is_active
        ))) {
            throw new Error('Garage business-hour verification failed');
        }

        verification.garages = {
            total: garages.length,
            active: garages.filter((garage) => garage.is_active).length,
            business_hours: '07:00-19:00',
            garage_codes: garages
                .map((garage) => garage.garage_code)
                .sort(),
        };
    }

    return verification;
};

const seedUsersGarages = async ({
    dryRun = process.argv.includes('--dry-run'),
    usersOnly = process.argv.includes('--users-only'),
    garagesOnly = process.argv.includes('--garages-only'),
} = {}) => {
    if (usersOnly && garagesOnly) {
        throw new Error('Use only one of --users-only or --garages-only');
    }

    const referenceDate = getSeedReferenceDate();
    const shouldSeedUsers = !garagesOnly;
    const shouldSeedGarages = !usersOnly;

    if (dryRun) {
        const result = {
            dry_run: true,
            reference_date: referenceDate,
        };

        if (shouldSeedUsers) {
            result.users = await seedUser({
                referenceDate,
                dryRun: true,
            });
        }

        if (shouldSeedGarages) {
            result.garages = await seedGarage({
                referenceDate,
                dryRun: true,
            });
        }

        return result;
    }

    await connectDB();

    const session = await User.startSession();
    const result = {
        dry_run: false,
        reference_date: referenceDate,
    };

    try {
        await session.withTransaction(async () => {
            if (shouldSeedUsers) {
                result.users = await seedUser({
                    session,
                    referenceDate,
                });
            }

            if (shouldSeedGarages) {
                result.garages = await seedGarage({
                    session,
                    referenceDate,
                });
            }
        });

        result.verification = await verifyUsersGarages({
            referenceDate,
            verifyUsers: shouldSeedUsers,
            verifyGarages: shouldSeedGarages,
        });

        return result;
    } finally {
        await session.endSession();
        await disconnectDB();
    }
};

const run = async () => {
    try {
        const result = await seedUsersGarages();

        console.log('Users and garages seed completed');
        console.dir(result.verification || result, { depth: null });
    } catch (error) {
        console.error('Users and garages seed failed:', error);
        process.exitCode = 1;

        await disconnectDB().catch(() => {});
    }
};

if (require.main === module) {
    run();
}

module.exports = {
    seedUsersGarages,
    verifyUsersGarages,
};
