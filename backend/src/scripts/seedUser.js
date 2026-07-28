const bcrypt = require('bcryptjs');

const User = require('../modules/users/user.model');
const { USER_ROLES } = require('../shared/constants/roles.constant');
const {
    USER_ONBOARDING_STATUSES,
} = require('../shared/constants/userOnboarding.constant');
const { normalizePhone, isValidPhone } = require('../shared/utils/phone');
const { buildSeedUsers } = require('./seedCatalog');
const { getSeedReferenceDate } = require('./seedTime');

const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);

const getSeedPasswords = () => {
    const passwords = {
        ADMIN: process.env.SEED_ADMIN_PASSWORD?.trim(),
        STAFF: process.env.SEED_STAFF_PASSWORD?.trim(),
        CUSTOMER: process.env.SEED_CUSTOMER_PASSWORD?.trim(),
    };
    const missing = Object.entries(passwords)
        .filter(([, value]) => !value)
        .map(([key]) => `SEED_${key}_PASSWORD`);

    if (missing.length > 0) {
        throw new Error(`Missing required seed passwords: ${missing.join(', ')}`);
    }

    return passwords;
};

const assertUniqueSeedUsers = (users) => {
    const phones = new Set();
    const emails = new Set();

    for (const user of users) {
        const phone = normalizePhone(user.phone);
        const email = user.email.trim().toLowerCase();

        if (!isValidPhone(phone)) {
            throw new Error(`Invalid seed phone: ${user.phone}`);
        }

        if (phones.has(phone)) {
            throw new Error(`Duplicate seed phone: ${phone}`);
        }

        if (emails.has(email)) {
            throw new Error(`Duplicate seed email: ${email}`);
        }

        phones.add(phone);
        emails.add(email);
    }
};

const summarizeSeedUsers = (users) => {
    const roleCounts = users.reduce((counts, user) => ({
        ...counts,
        [user.role]: (counts[user.role] || 0) + 1,
    }), {});
    const customers = users.filter((user) => user.role === USER_ROLES.CUSTOMER);
    const customerDates = customers.map((user) => user.created_at.getTime());

    return {
        planned: users.length,
        role_counts: roleCounts,
        customer_created_from: new Date(Math.min(...customerDates)),
        customer_created_to: new Date(Math.max(...customerDates)),
    };
};

const seedUser = async ({
    session = null,
    referenceDate = getSeedReferenceDate(),
    dryRun = false,
} = {}) => {
    console.log('== Seeding users ==');

    const passwords = getSeedPasswords();
    const users = buildSeedUsers(referenceDate);

    assertUniqueSeedUsers(users);

    const summary = summarizeSeedUsers(users);

    if (dryRun) {
        console.table([summary]);
        return {
            ...summary,
            dry_run: true,
        };
    }

    const [adminHash, staffHash, customerHash] = await Promise.all([
        bcrypt.hash(passwords.ADMIN, BCRYPT_SALT_ROUNDS),
        bcrypt.hash(passwords.STAFF, BCRYPT_SALT_ROUNDS),
        bcrypt.hash(passwords.CUSTOMER, BCRYPT_SALT_ROUNDS),
    ]);
    const passwordHashByGroup = {
        ADMIN: adminHash,
        STAFF: staffHash,
        CUSTOMER: customerHash,
    };
    const operations = users.map((user) => {
        const phone = normalizePhone(user.phone);
        const email = user.email.trim().toLowerCase();
        const payload = {
            full_name: user.full_name,
            email,
            phone,
            role: user.role,
            avatar_url: '',
            is_active: true,
            phone_verified_at: user.created_at,
            onboarding_status: USER_ONBOARDING_STATUSES.ACTIVE,
            last_login_at: null,
        };
        const validationError = new User({
            ...payload,
            password_hash: passwordHashByGroup[user.password_group],
            password_changed_at: user.created_at,
            created_at: user.created_at,
            updated_at: user.created_at,
        }).validateSync();

        if (validationError) {
            throw validationError;
        }

        return {
            updateOne: {
                filter: { phone },
                update: {
                    $set: payload,
                    $setOnInsert: {
                        password_hash: passwordHashByGroup[user.password_group],
                        password_changed_at: user.created_at,
                        created_at: user.created_at,
                        updated_at: user.created_at,
                    },
                },
                upsert: true,
                timestamps: false,
            },
        };
    });
    const result = await User.bulkWrite(operations, {
        ordered: true,
        session,
    });

    const completedSummary = {
        ...summary,
        dry_run: false,
        matched: result.matchedCount,
        modified: result.modifiedCount,
        inserted: result.upsertedCount,
    };

    console.table([{
        planned: completedSummary.planned,
        matched: completedSummary.matched,
        modified: completedSummary.modified,
        inserted: completedSummary.inserted,
    }]);
    console.log('Users seeding completed');

    return completedSummary;
};

module.exports = seedUser;
module.exports.assertUniqueSeedUsers = assertUniqueSeedUsers;
module.exports.summarizeSeedUsers = summarizeSeedUsers;
