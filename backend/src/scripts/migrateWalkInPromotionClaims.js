require('dotenv').config();

const mongoose = require('mongoose');

const { connectDB, disconnectDB } = require('../config/db');
const Booking = require('../modules/bookings/booking.model');
const Promotion = require('../modules/promotions/promotion.model');
const PromotionUsage = require('../modules/promotion-usages/promotionUsage.model');
const { normalizePhone, isValidPhone } = require('../shared/utils/phone');
const {
    PROMOTION_AUDIENCES,
    PROMOTION_USAGE_STATUS,
} = require('../shared/constants/promotion.constant');

const migrateWalkInPromotionClaims = async () => {
    const bookings = await Booking.find({
        is_walk_in: true,
        guest_phone: { $type: 'string' },
    })
        .select('_id guest_phone normalized_guest_phone')
        .lean();
    const bookingPhoneById = new Map();
    const bookingUpdates = [];

    for (const booking of bookings) {
        const normalizedPhone = normalizePhone(booking.guest_phone);

        if (!isValidPhone(normalizedPhone)) {
            continue;
        }

        bookingPhoneById.set(booking._id.toString(), normalizedPhone);

        if (
            booking.guest_phone !== normalizedPhone
            || booking.normalized_guest_phone !== normalizedPhone
        ) {
            bookingUpdates.push({
                updateOne: {
                    filter: { _id: booking._id },
                    update: {
                        $set: {
                            guest_phone: normalizedPhone,
                            normalized_guest_phone: normalizedPhone,
                        },
                    },
                },
            });
        }
    }

    const usages = await PromotionUsage.find({})
        .select('_id booking_id status used_at consumed_at guest_phone_normalized')
        .lean();
    const usageUpdates = [];

    for (const usage of usages) {
        const update = {};
        const normalizedPhone = bookingPhoneById.get(usage.booking_id.toString());

        if (!usage.status) {
            update.status = PROMOTION_USAGE_STATUS.CONSUMED;
        }

        if (!usage.consumed_at) {
            update.consumed_at = usage.used_at || new Date();
        }

        if (!usage.used_at) {
            update.used_at = update.consumed_at;
        }

        if (!usage.guest_phone_normalized && normalizedPhone) {
            update.guest_phone_normalized = normalizedPhone;
        }

        if (Object.keys(update).length) {
            usageUpdates.push({
                updateOne: {
                    filter: { _id: usage._id },
                    update: { $set: update },
                },
            });
        }
    }

    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            if (bookingUpdates.length) {
                await Booking.bulkWrite(bookingUpdates, { session, ordered: true });
            }

            if (usageUpdates.length) {
                await PromotionUsage.bulkWrite(usageUpdates, { session, ordered: true });
            }

            await Promotion.updateMany(
                { audience: { $exists: false } },
                {
                    $set: {
                        audience: PROMOTION_AUDIENCES.ALL,
                        phone_required: false,
                        per_phone_limit: null,
                    },
                },
                { session }
            );
            await Promotion.updateMany(
                { reserved_count: { $exists: false } },
                { $set: { reserved_count: 0 } },
                { session }
            );

            const usageCounts = await PromotionUsage.aggregate([
                {
                    $group: {
                        _id: '$promotion_id',
                        used_count: {
                            $sum: {
                                $cond: [
                                    { $eq: ['$status', PROMOTION_USAGE_STATUS.CONSUMED] },
                                    1,
                                    0,
                                ],
                            },
                        },
                        reserved_count: {
                            $sum: {
                                $cond: [
                                    { $eq: ['$status', PROMOTION_USAGE_STATUS.RESERVED] },
                                    1,
                                    0,
                                ],
                            },
                        },
                    },
                },
            ]).session(session);

            for (const count of usageCounts) {
                await Promotion.updateOne(
                    { _id: count._id },
                    {
                        $set: {
                            used_count: count.used_count,
                            reserved_count: count.reserved_count,
                        },
                    },
                    { session }
                );
            }
        });
    } finally {
        await session.endSession();
    }

    await PromotionUsage.createIndexes();

    return {
        scanned_bookings: bookings.length,
        updated_bookings: bookingUpdates.length,
        scanned_promotion_usages: usages.length,
        updated_promotion_usages: usageUpdates.length,
    };
};

const run = async () => {
    let exitCode = 0;

    try {
        await connectDB();

        const result = await migrateWalkInPromotionClaims();

        console.log(
            `Walk-in promotion migration completed: scanned_bookings=${result.scanned_bookings}, updated_bookings=${result.updated_bookings}, scanned_promotion_usages=${result.scanned_promotion_usages}, updated_promotion_usages=${result.updated_promotion_usages}`
        );
    } catch (error) {
        console.error('Walk-in promotion migration failed:', error);
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
    migrateWalkInPromotionClaims,
};
