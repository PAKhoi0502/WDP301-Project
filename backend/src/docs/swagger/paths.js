const authSwagger = require('../../modules/auth/auth.swagger');
const userSwagger = require('../../modules/users/user.swagger');
const staffProfileSwagger = require('../../modules/staff-profiles/staffProfile.swagger');
const garageSwagger = require('../../modules/garages/garage.swagger');
const washBaySwagger = require('../../modules/wash-bays/washBay.swagger');
const vehicleSwagger = require('../../modules/vehicles/vehicle.swagger');
const servicePackageSwagger = require('../../modules/service-packages/servicePackage.swagger');
const bookingSwagger = require('../../modules/bookings/booking.swagger');
const bookingWaitlistSwagger = require('../../modules/booking-waitlists/bookingWaitlist.swagger');
const bookingServiceStepSwagger = require('../../modules/booking-service-steps/bookingServiceStep.swagger');
const vehicleInspectionSwagger = require('../../modules/vehicle-inspections/vehicleInspection.swagger');
const promotionSwagger = require('../../modules/promotions/promotion.swagger');
const loyaltySwagger = require('../../modules/loyalty/loyalty.swagger');
const notificationSwagger = require('../../modules/notifications/notification.swagger');
const washHistorySwagger = require('../../modules/wash-histories/washHistory.swagger');
const paymentSwagger = require('../../modules/payments/payment.swagger');
const uploadSwagger = require('../../modules/uploads/upload.swagger');
const auditLogSwagger = require('../../modules/audit-logs/auditLog.swagger');

const paths = {
    ...authSwagger.paths,
    ...userSwagger.paths,
    ...staffProfileSwagger.paths,
    ...garageSwagger.paths,
    ...washBaySwagger.paths,
    ...vehicleSwagger.paths,
    ...servicePackageSwagger.paths,
    ...bookingSwagger.paths,
    ...bookingWaitlistSwagger.paths,
    ...bookingServiceStepSwagger.paths,
    ...vehicleInspectionSwagger.paths,
    ...promotionSwagger.paths,
    ...loyaltySwagger.paths,
    ...notificationSwagger.paths,
    ...washHistorySwagger.paths,
    ...paymentSwagger.paths,
    ...uploadSwagger.paths,
    ...auditLogSwagger.paths,
};

module.exports = paths;
