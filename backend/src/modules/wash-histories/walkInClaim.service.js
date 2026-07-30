const mongoose = require('mongoose');

const Booking = require('../bookings/booking.model');
const WashHistory = require('./washHistory.model');
const PromotionUsage = require('../promotion-usages/promotionUsage.model');
const CustomerVoucher = require('../customer-vouchers/customerVoucher.model');
const ServicePackage = require('../service-packages/servicePackage.model');
const loyaltyService = require('../loyalty/loyalty.service');
const washHistoryService = require('./washHistory.service');
const notificationService = require('../notifications/notification.service');
const { AppError } = require('../../shared/utils/appError');
const { normalizePhone, isValidPhone } = require('../../shared/utils/phone');
const {
    BOOKING_STATUS,
    BOOKING_PAYMENT_STATUS,
} = require('../../shared/constants/booking.constant');

const DEFAULT_CLAIM_LOOKBACK_MONTHS = 12;

const getClaimCutoff = () => {
    const configuredMonths = Number(process.env.WALK_IN_CLAIM_LOOKBACK_MONTHS);
    const months = Number.isInteger(configuredMonths) && configuredMonths > 0
        ? configuredMonths
        : DEFAULT_CLAIM_LOOKBACK_MONTHS;
    const cutoff = new Date();

    cutoff.setMonth(cutoff.getMonth() - months);

    return cutoff;
};

const toIdString = (value) => value?.toString?.() || '';

const getBookingVisitAt = (booking) => (
    booking.paid_at
    || booking.payment_waived_at
    || booking.completed_at
    || booking.created_at
    || null
);

const loadServicePackageMap = async (bookings, session) => {
    const servicePackageIds = [...new Set(
        bookings
            .flatMap((booking) => [
                booking.service_package_id,
                ...(booking.add_on_service_ids || []),
            ])
            .filter(Boolean)
            .map(toIdString)
    )];

    if (!servicePackageIds.length) {
        return new Map();
    }

    const servicePackages = await ServicePackage.find({
        _id: { $in: servicePackageIds },
    }).session(session);

    return new Map(
        servicePackages.map((servicePackage) => [
            toIdString(servicePackage._id),
            servicePackage,
        ])
    );
};

const claimWalkInHistoryForCustomer = async ({
    customerId,
    phone,
    phoneVerifiedAt,
} = {}) => {
    const normalizedPhone = normalizePhone(phone);

    if (!phoneVerifiedAt) {
        throw new AppError('Verified phone is required to claim walk-in history', 400, 'VERIFIED_PHONE_REQUIRED');
    }

    if (!isValidPhone(normalizedPhone)) {
        throw new AppError('Phone number is invalid', 400, 'INVALID_PHONE');
    }

    const session = await mongoose.startSession();
    let result = {
        claimed_bookings: 0,
        claimed_wash_histories: 0,
        linked_promotion_usages: 0,
        claimed_customer_vouchers: 0,
        loyalty_bookings_processed: 0,
        awarded_points: 0,
        total_spent_added: 0,
        total_visits_added: 0,
        current_tier: null,
    };

    try {
        await session.withTransaction(async () => {
            const cutoff = getClaimCutoff();
            const bookings = await Booking.find({
                is_walk_in: true,
                normalized_guest_phone: normalizedPhone,
                status: BOOKING_STATUS.COMPLETED,
                payment_status: {
                    $in: [
                        BOOKING_PAYMENT_STATUS.PAID,
                        BOOKING_PAYMENT_STATUS.WAIVED,
                    ],
                },
                $and: [
                    {
                        $or: [
                            { claimed_customer_id: null },
                            { claimed_customer_id: customerId },
                        ],
                    },
                    {
                        $or: [
                            { paid_at: { $gte: cutoff } },
                            {
                                payment_status: BOOKING_PAYMENT_STATUS.WAIVED,
                                payment_waived_at: { $gte: cutoff },
                            },
                        ],
                    },
                ],
                loyalty_claimed_at: null,
            })
                .session(session);
            bookings.sort((left, right) => {
                const leftTime = new Date(getBookingVisitAt(left) || 0).getTime();
                const rightTime = new Date(getBookingVisitAt(right) || 0).getTime();

                return leftTime - rightTime;
            });
            const bookingIds = bookings.map((booking) => booking._id);
            const customerVoucherUpdate = await CustomerVoucher.updateMany(
                {
                    customer_id: null,
                    normalized_guest_phone: normalizedPhone,
                },
                {
                    $set: {
                        customer_id: customerId,
                    },
                    $unset: {
                        guest_phone: '',
                        normalized_guest_phone: '',
                    },
                },
                { session }
            );
            result.claimed_customer_vouchers =
                customerVoucherUpdate.modifiedCount || 0;

            if (!bookingIds.length) {
                return;
            }

            const claimedAt = new Date();
            const servicePackageMap = await loadServicePackageMap(bookings, session);
            let claimedBookings = 0;
            let claimedWashHistories = 0;
            let loyaltyBookingsProcessed = 0;
            let awardedPoints = 0;
            let totalSpentAdded = 0;
            let totalVisitsAdded = 0;
            let currentTier = null;

            for (const booking of bookings) {
                const servicePackage = servicePackageMap.get(
                    toIdString(booking.service_package_id)
                );

                if (!servicePackage) {
                    throw new AppError(
                        'Service package not found for walk-in claim',
                        404,
                        'WALK_IN_CLAIM_SERVICE_PACKAGE_NOT_FOUND'
                    );
                }

                const addOnServices = (booking.add_on_service_ids || []).map(
                    (servicePackageId) => servicePackageMap.get(
                        toIdString(servicePackageId)
                    )
                );

                if (addOnServices.some((item) => !item)) {
                    throw new AppError(
                        'Add-on service package not found for walk-in claim',
                        404,
                        'WALK_IN_CLAIM_ADD_ON_NOT_FOUND'
                    );
                }

                const visitAt = getBookingVisitAt(booking) || claimedAt;
                const loyaltyResult = await loyaltyService.processBookingLoyalty({
                    booking,
                    servicePackage,
                    addOnServices,
                    actorId: customerId,
                    customerId,
                    visitAt,
                    session,
                });
                const bookingUpdate = await Booking.updateOne(
                    {
                        _id: booking._id,
                        normalized_guest_phone: normalizedPhone,
                        loyalty_claimed_at: null,
                        $or: [
                            { claimed_customer_id: null },
                            { claimed_customer_id: customerId },
                        ],
                    },
                    {
                        $set: {
                            claimed_customer_id: customerId,
                            claimed_at: booking.claimed_at || claimedAt,
                            loyalty_claimed_at: claimedAt,
                            earned_points: loyaltyResult.earned_points,
                        },
                    },
                    { session }
                );

                if (!bookingUpdate.modifiedCount) {
                    throw new AppError(
                        'Walk-in booking was claimed concurrently',
                        409,
                        'WALK_IN_BOOKING_CLAIM_CONFLICT'
                    );
                }

                const claimedBooking = {
                    ...booking.toObject(),
                    claimed_customer_id: customerId,
                    claimed_at: booking.claimed_at || claimedAt,
                    loyalty_claimed_at: claimedAt,
                    earned_points: loyaltyResult.earned_points,
                };
                const washHistoryUpdate = await WashHistory.updateOne(
                    {
                        booking_id: booking._id,
                        $or: [
                            { customer_id: null },
                            { customer_id: customerId },
                        ],
                    },
                    {
                        $set: {
                            customer_id: customerId,
                            points_earned: loyaltyResult.earned_points,
                        },
                    },
                    { session }
                );

                if (washHistoryUpdate.matchedCount) {
                    claimedWashHistories += 1;
                } else {
                    const conflictingWashHistory = await WashHistory.findOne({
                        booking_id: booking._id,
                    }).session(session);

                    if (conflictingWashHistory) {
                        throw new AppError(
                            'Wash history belongs to another customer',
                            409,
                            'WALK_IN_WASH_HISTORY_CUSTOMER_CONFLICT'
                        );
                    }

                    await washHistoryService.createWashHistoryFromBooking({
                        booking: claimedBooking,
                        earnedPoints: loyaltyResult.earned_points,
                        session,
                    });
                    claimedWashHistories += 1;
                }

                await notificationService.emitRewardEarned({
                    booking: claimedBooking,
                    earnedPoints: loyaltyResult.already_processed
                        ? 0
                        : loyaltyResult.earned_points,
                    session,
                });
                await notificationService.emitReviewRequest({
                    booking: claimedBooking,
                    session,
                });

                claimedBookings += 1;
                loyaltyBookingsProcessed += 1;
                awardedPoints += loyaltyResult.already_processed
                    ? 0
                    : loyaltyResult.earned_points;
                totalSpentAdded += loyaltyResult.total_spent_added || 0;
                totalVisitsAdded += loyaltyResult.total_visits_added || 0;
                currentTier = loyaltyResult.loyalty?.current_tier || currentTier;
            }

            const promotionUsageUpdate = await PromotionUsage.updateMany(
                {
                    booking_id: { $in: bookingIds },
                    $or: [
                        { customer_id: null },
                        { customer_id: customerId },
                    ],
                },
                {
                    $set: {
                        customer_id: customerId,
                    },
                },
                { session }
            );

            result = {
                claimed_bookings: claimedBookings,
                claimed_wash_histories: claimedWashHistories,
                linked_promotion_usages: promotionUsageUpdate.modifiedCount || 0,
                claimed_customer_vouchers: customerVoucherUpdate.modifiedCount || 0,
                loyalty_bookings_processed: loyaltyBookingsProcessed,
                awarded_points: awardedPoints,
                total_spent_added: totalSpentAdded,
                total_visits_added: totalVisitsAdded,
                current_tier: currentTier,
            };
        });
    } finally {
        await session.endSession();
    }

    return result;
};

module.exports = {
    claimWalkInHistoryForCustomer,
};
