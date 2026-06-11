require('dotenv').config();

const mongoose = require('mongoose');

const { connectDB, disconnectDB } = require('../config/db');
const User = require('../modules/users/user.model');
const { normalizePhone, isValidPhone } = require('../shared/utils/phone');

const buildMigrationPlan = (users) => {
    const ownersByPhone = new Map();
    const updates = [];

    for (const user of users) {
        const normalizedPhone = normalizePhone(user.phone);

        if (!isValidPhone(normalizedPhone)) {
            throw new Error(`Invalid phone for user ${user._id}: ${user.phone}`);
        }

        const existingOwner = ownersByPhone.get(normalizedPhone);

        if (existingOwner && existingOwner !== user._id.toString()) {
            throw new Error(
                `Phone collision after normalization: ${normalizedPhone}`
            );
        }

        ownersByPhone.set(normalizedPhone, user._id.toString());

        if (normalizedPhone !== user.phone) {
            updates.push({
                updateOne: {
                    filter: {
                        _id: user._id,
                        phone: user.phone,
                    },
                    update: {
                        $set: {
                            phone: normalizedPhone,
                        },
                    },
                },
            });
        }
    }

    return updates;
};

const migrateUserPhonesToE164 = async () => {
    const users = await User.find({}).select('_id phone').lean();
    const updates = buildMigrationPlan(users);

    if (updates.length === 0) {
        return {
            scanned: users.length,
            updated: 0,
        };
    }

    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            await User.bulkWrite(updates, {
                session,
                ordered: true,
            });
        });
    } finally {
        await session.endSession();
    }

    return {
        scanned: users.length,
        updated: updates.length,
    };
};

const run = async () => {
    let exitCode = 0;

    try {
        await connectDB();

        const result = await migrateUserPhonesToE164();

        console.log(
            `Phone migration completed: scanned=${result.scanned}, updated=${result.updated}`
        );
    } catch (error) {
        console.error('Phone migration failed:', error);
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
    buildMigrationPlan,
    migrateUserPhonesToE164,
};
