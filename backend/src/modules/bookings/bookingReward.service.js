const ServicePackage = require('../service-packages/servicePackage.model');
const loyaltyService = require('../loyalty/loyalty.service');
const washHistoryService = require('../wash-histories/washHistory.service');
const promotionUsageService = require('../promotion-usages/promotionUsage.service');
const notificationService = require('../notifications/notification.service');
const bookingViolationService = require('../booking-violations/bookingViolation.service');
const { AppError } = require('../../shared/utils/appError');

const getServicePackage = async (servicePackageId, session = null) => {
    const query = ServicePackage.findById(servicePackageId);

    if (session) {
        query.session(session);
    }

    const servicePackage = await query;

    if (!servicePackage) {
        throw new AppError('Service package not found', 404, 'SERVICE_PACKAGE_NOT_FOUND');
    }

    return servicePackage;
};

const getAddOnServices = async (addOnServiceIds = [], session = null) => {
    const uniqueAddOnServiceIds = [...new Set(
        addOnServiceIds.filter(Boolean).map((servicePackageId) => servicePackageId.toString())
    )];

    if (!uniqueAddOnServiceIds.length) {
        return [];
    }

    const query = ServicePackage.find({
        _id: { $in: uniqueAddOnServiceIds },
    });

    if (session) {
        query.session(session);
    }

    const addOnServices = await query;

    if (addOnServices.length !== uniqueAddOnServiceIds.length) {
        throw new AppError('Add-on service package not found', 404, 'ADD_ON_SERVICE_PACKAGE_NOT_FOUND');
    }

    return addOnServices;
};

const processCompletedPaidBooking = async ({ booking, actorId, session = null }) => {
    if (booking.reward_processed) {
        return {
            wash_history: null,
            loyalty: null,
            point_transaction: null,
            promotion_usage: null,
            notifications: [],
            earned_points: booking.earned_points || 0,
            already_processed: true,
        };
    }

    const servicePackage = await getServicePackage(booking.service_package_id, session);
    const addOnServices = await getAddOnServices(booking.add_on_service_ids, session);
    const loyaltyResult = await loyaltyService.processBookingLoyalty({
        booking,
        servicePackage,
        addOnServices,
        actorId,
        session,
    });

    booking.earned_points = loyaltyResult.earned_points;

    const washHistory = await washHistoryService.createWashHistoryFromBooking({
        booking,
        earnedPoints: loyaltyResult.earned_points,
        session,
    });

    const promotionUsage = await promotionUsageService.createPromotionUsageFromBooking({
        booking,
        actorId,
        session,
    });
    await bookingViolationService.recordCompletedPaidBooking({
        booking,
        actorId,
        session,
    });

    const paymentNotification = await notificationService.emitPaymentConfirmed({
        booking,
        session,
    });
    const rewardNotification = await notificationService.emitRewardEarned({
        booking,
        earnedPoints: loyaltyResult.earned_points,
        session,
    });

    booking.reward_processed = true;
    booking.reward_processed_at = new Date();

    await booking.save(session ? { session } : undefined);

    return {
        wash_history: washHistory,
        loyalty: loyaltyResult.loyalty,
        point_transaction: loyaltyResult.point_transaction,
        promotion_usage: promotionUsage,
        notifications: [paymentNotification, rewardNotification].filter(Boolean),
        earned_points: loyaltyResult.earned_points,
        already_processed: false,
    };
};

module.exports = {
    processCompletedPaidBooking,
};
