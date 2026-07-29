const express = require('express');

const authRoutes = require('../modules/auth/auth.routes');
const userRoutes = require('../modules/users/user.routes');
const staffProfileRoutes = require('../modules/staff-profiles/staffProfile.routes');
const garageRoutes = require('../modules/garages/garage.routes');
const washBayRoutes = require('../modules/wash-bays/washBay.routes');
const vehicleRoutes = require('../modules/vehicles/vehicle.routes');
const customerRoutes = require('../modules/customers/customer.routes');
const servicePackageRoutes = require('../modules/service-packages/servicePackage.routes');
const servicePriceRuleRoutes = require('../modules/service-price-rules/servicePriceRule.routes');
const bookingRoutes = require('../modules/bookings/booking.routes');
const bookingWaitlistRoutes = require('../modules/booking-waitlists/bookingWaitlist.routes');
const promotionRoutes = require('../modules/promotions/promotion.routes');
const loyaltyRoutes = require('../modules/loyalty/loyalty.routes');
const notificationRoutes = require('../modules/notifications/notification.routes');
const washHistoryRoutes = require('../modules/wash-histories/washHistory.routes');
const paymentRoutes = require('../modules/payments/payment.routes');
const uploadRoutes = require('../modules/uploads/upload.routes');
const auditLogRoutes = require('../modules/audit-logs/auditLog.routes');
const surveyRoutes = require('../modules/surveys/survey.routes');
const analyticsRoutes = require('../modules/analytics/analytics.routes');
const researchRoutes = require('../modules/research/research.routes');
const customerVoucherRoutes = require('../modules/customer-vouchers/customerVoucher.routes');
const customerCaseRoutes = require('../modules/customer-cases/customerCase.routes');
const bookingArrivalRoutes = require('../modules/booking-arrivals/bookingArrival.routes');
const staffBookingWorkflowRoutes = require('../modules/staff-booking-workflows/staffBookingWorkflow.routes');
const reviewRoutes = require('../modules/reviews/review.routes');

const router = express.Router();

router.get('/', (req, res) => {
    return res.status(200).json({
        success: true,
        message: 'Welcome to AutoWash Pro API v1',
    });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/staff-profiles', staffProfileRoutes);
router.use('/garages', reviewRoutes.publicGarageRouter);
router.use('/garages', garageRoutes.publicRouter);
router.use('/vehicles', vehicleRoutes.customerRouter);
router.use('/service-packages', reviewRoutes.publicServicePackageRouter);
router.use('/service-packages', servicePackageRoutes.publicRouter);
router.use('/pricing', servicePriceRuleRoutes.customerRouter);
router.use('/bookings', bookingRoutes.customerRouter);
router.use('/staff/bookings', bookingRoutes.staffRouter);
router.use('/staff/tasks', bookingRoutes.staffTaskRouter);
router.use('/staff/booking-arrivals', bookingArrivalRoutes.staffRouter);
router.use('/staff/workspace/bookings', staffBookingWorkflowRoutes);
router.use('/staff/workspace/wash-bays', washBayRoutes.staffRouter);
router.use('/staff/analytics', analyticsRoutes.staffRouter);
router.use('/waitlists', bookingWaitlistRoutes.customerRouter);
router.use('/promotions', promotionRoutes.publicRouter);
router.use('/promotions', promotionRoutes.customerRouter);
router.use('/loyalty', loyaltyRoutes.customerRouter);
router.use('/notifications', notificationRoutes);
router.use('/customer-vouchers', customerVoucherRoutes.customerRouter);
router.use('/customer-cases', customerCaseRoutes.customerRouter);
router.use('/wash-histories', washHistoryRoutes.customerRouter);
router.use('/payments', paymentRoutes.publicRouter);
router.use('/payments', paymentRoutes.customerRouter);
router.use('/uploads', uploadRoutes.publicRouter);
router.use('/surveys', surveyRoutes.customerRouter);
router.use('/reviews', reviewRoutes.customerRouter);
router.use('/admin/customers', customerRoutes.adminRouter);
router.use('/admin/vehicles', vehicleRoutes.adminRouter);
router.use('/admin/service-packages', servicePackageRoutes.adminRouter);
router.use('/admin/pricing', servicePriceRuleRoutes.adminRouter);
router.use('/admin/bookings', bookingRoutes.adminRouter);
router.use('/admin/waitlists', bookingWaitlistRoutes.adminRouter);
router.use('/admin/payments', paymentRoutes.adminRouter);
router.use('/admin/uploads', uploadRoutes.adminRouter);
router.use('/admin/audit-logs', auditLogRoutes.adminRouter);
router.use('/admin/surveys', surveyRoutes.adminRouter);
router.use('/staff/reviews', reviewRoutes.staffRouter);
router.use('/admin/reviews', reviewRoutes.adminRouter);
router.use('/admin/analytics', analyticsRoutes.adminRouter);
router.use('/admin/research', researchRoutes.adminRouter);
router.use('/admin/customer-vouchers', customerVoucherRoutes.adminRouter);
router.use('/staff/customer-cases', customerCaseRoutes.staffRouter);
router.use('/admin/customer-cases', customerCaseRoutes.adminRouter);
router.use('/admin/booking-arrivals', bookingArrivalRoutes.adminRouter);
router.use('/camera-devices', bookingArrivalRoutes.deviceRouter);
router.use('/admin/promotions', promotionRoutes.adminRouter);
router.use('/admin/loyalty', loyaltyRoutes.adminRouter);
router.use('/admin/wash-histories', washHistoryRoutes.adminRouter);
router.use('/admin/wash-bays', washBayRoutes.adminRouter);
router.use('/admin/garages/:garageId/wash-bays', washBayRoutes.garageRouter);
router.use('/admin/garages/:garageId/available-wash-bays', washBayRoutes.availableRouter);
router.use('/admin/garages', garageRoutes.adminRouter);

module.exports = router;
