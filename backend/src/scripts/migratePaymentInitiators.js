require('dotenv').config();

const mongoose = require('mongoose');

const { connectDB, disconnectDB } = require('../config/db');
const {
    PAYMENT_PROVIDER,
    PAYMENT_INITIATED_CHANNEL,
    PAYMENT_TRANSACTION_STATUS,
} = require('../shared/constants/payment.constant');

const ACTIVE_STATUSES = new Set([
    PAYMENT_TRANSACTION_STATUS.INITIATED,
    PAYMENT_TRANSACTION_STATUS.PENDING,
    PAYMENT_TRANSACTION_STATUS.CANCELING,
]);

const migratePaymentInitiators = async ({ dryRun = false, now = new Date() } = {}) => {
    const payments = mongoose.connection.collection('payment_transactions');
    const users = mongoose.connection.collection('users');
    const transactions = await payments.find({ provider: PAYMENT_PROVIDER.PAYOS }).toArray();
    const initiatorIds = [...new Set(
        transactions
            .map((transaction) => transaction.initiated_by_user_id || transaction.created_by_staff_id)
            .filter(Boolean)
            .map((value) => value.toString())
    )];
    const initiators = initiatorIds.length > 0
        ? await users.find({
            _id: { $in: initiatorIds.map((value) => new mongoose.Types.ObjectId(value)) },
        }).project({ role: 1 }).toArray()
        : [];
    const roleByUserId = new Map(initiators.map((user) => [user._id.toString(), user.role]));
    const activeByBookingId = new Map();

    for (const transaction of transactions) {
        const isExpired = transaction.expires_at
            && transaction.expires_at.getTime() <= now.getTime()
            && [
                PAYMENT_TRANSACTION_STATUS.INITIATED,
                PAYMENT_TRANSACTION_STATUS.PENDING,
            ].includes(transaction.status);

        if (!ACTIVE_STATUSES.has(transaction.status) || isExpired) {
            continue;
        }

        const bookingId = transaction.booking_id.toString();
        const activeTransactions = activeByBookingId.get(bookingId) || [];

        activeTransactions.push(transaction);
        activeByBookingId.set(bookingId, activeTransactions);
    }

    const duplicateBookings = [...activeByBookingId.entries()]
        .filter(([, activeTransactions]) => activeTransactions.length > 1)
        .map(([bookingId, activeTransactions]) => ({
            booking_id: bookingId,
            payment_ids: activeTransactions.map((transaction) => transaction._id.toString()),
        }));

    if (duplicateBookings.length > 0) {
        const error = new Error('Active PayOS transaction duplicates must be resolved before migration');

        error.code = 'ACTIVE_PAYMENT_DUPLICATES_FOUND';
        error.duplicates = duplicateBookings;
        throw error;
    }

    const operations = transactions.map((transaction) => {
        const initiatorId = transaction.initiated_by_user_id || transaction.created_by_staff_id || null;
        const isExpired = transaction.expires_at
            && transaction.expires_at.getTime() <= now.getTime()
            && [
                PAYMENT_TRANSACTION_STATUS.INITIATED,
                PAYMENT_TRANSACTION_STATUS.PENDING,
            ].includes(transaction.status);
        const isActive = ACTIVE_STATUSES.has(transaction.status) && !isExpired;
        const set = {
            initiated_by_user_id: initiatorId,
            initiated_by_role: initiatorId
                ? roleByUserId.get(initiatorId.toString()) || 'STAFF'
                : null,
            initiated_channel: initiatorId
                ? PAYMENT_INITIATED_CHANNEL.STAFF_ASSISTED
                : null,
            active_payment_key: isActive
                ? `${PAYMENT_PROVIDER.PAYOS}:${transaction.booking_id.toString()}`
                : null,
        };

        if (isExpired) {
            set.status = PAYMENT_TRANSACTION_STATUS.EXPIRED;
            set.expired_at = transaction.expired_at || now;
        }

        return {
            updateOne: {
                filter: { _id: transaction._id },
                update: { $set: set },
            },
        };
    });

    if (!dryRun && operations.length > 0) {
        await payments.bulkWrite(operations, { ordered: false });
        await payments.createIndex(
            { active_payment_key: 1 },
            {
                unique: true,
                partialFilterExpression: {
                    active_payment_key: { $type: 'string' },
                },
                name: 'active_payment_key_1',
            }
        );
    }

    return {
        dry_run: dryRun,
        transactions_found: transactions.length,
        transactions_to_update: operations.length,
        active_transactions: activeByBookingId.size,
        duplicate_bookings: duplicateBookings,
    };
};

const run = async () => {
    let exitCode = 0;
    const dryRun = process.argv.includes('--dry-run');

    try {
        await connectDB();

        const result = await migratePaymentInitiators({ dryRun });

        console.log(
            `Payment initiator migration ${dryRun ? 'dry run' : 'completed'}: transactions_found=${result.transactions_found}, transactions_to_update=${result.transactions_to_update}, active_transactions=${result.active_transactions}`
        );
    } catch (error) {
        console.error('Payment initiator migration failed:', error);
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
    migratePaymentInitiators,
};
