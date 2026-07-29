const mongoose = require('mongoose');

const { connectDB, disconnectDB } = require('../config/db');
const PasswordResetRateLimit = require('../modules/auth/models/passwordResetRateLimit.model');
const PasswordResetToken = require('../modules/auth/models/passwordResetToken.model');
const PhoneVerification = require('../modules/auth/models/phoneVerification.model');
const RefreshToken = require('../modules/auth/models/refreshToken.model');
const AuditLog = require('../modules/audit-logs/auditLog.model');
const BookingServiceStep = require('../modules/booking-service-steps/bookingServiceStep.model');
const BookingIncident = require('../modules/booking-incidents/bookingIncident.model');
const BookingViolationEvent = require('../modules/booking-violations/bookingViolationEvent.model');
const CustomerBookingViolation = require('../modules/booking-violations/customerBookingViolation.model');
const BookingWaitlist = require('../modules/booking-waitlists/bookingWaitlist.model');
const Booking = require('../modules/bookings/booking.model');
const Garage = require('../modules/garages/garage.model');
const CustomerLoyalty = require('../modules/loyalty/customerLoyalty.model');
const LoyaltyRedeemRule = require('../modules/loyalty/loyaltyRedeemRule.model');
const PointTransaction = require('../modules/loyalty/pointTransaction.model');
const TierRule = require('../modules/loyalty/tierRule.model');
const Notification = require('../modules/notifications/notification.model');
const PaymentTransaction = require('../modules/payments/paymentTransaction.model');
const PromotionUsage = require('../modules/promotion-usages/promotionUsage.model');
const Promotion = require('../modules/promotions/promotion.model');
const ServicePackage = require('../modules/service-packages/servicePackage.model');
const ServicePriceRule = require('../modules/service-price-rules/servicePriceRule.model');
const PriceQuote = require('../modules/service-price-rules/priceQuote.model');
const StaffProfile = require('../modules/staff-profiles/staffProfile.model');
const Survey = require('../modules/surveys/survey.model');
const SurveyResponse = require('../modules/surveys/surveyResponse.model');
const ResearchReport = require('../modules/research/researchReport.model');
const Upload = require('../modules/uploads/upload.model');
const User = require('../modules/users/user.model');
const VehicleInspection = require('../modules/vehicle-inspections/vehicleInspection.model');
const Vehicle = require('../modules/vehicles/vehicle.model');
const WashBay = require('../modules/wash-bays/washBay.model');
const WashHistory = require('../modules/wash-histories/washHistory.model');
const BookingHandover = require('../modules/booking-handovers/bookingHandover.model');
const CustomerCase = require('../modules/customer-cases/customerCase.model');
const CustomerCaseEvent = require('../modules/customer-cases/customerCaseEvent.model');
const CustomerCaseMessage = require('../modules/customer-cases/customerCaseMessage.model');
const CustomerCaseTechnicalAssessment = require('../modules/customer-cases/customerCaseTechnicalAssessment.model');
const CustomerCaseResolution = require('../modules/customer-cases/customerCaseResolution.model');
const CustomerCaseRefund = require('../modules/customer-cases/customerCaseRefund.model');
const CustomerVoucher = require('../modules/customer-vouchers/customerVoucher.model');
const BookingPlateScan = require('../modules/booking-arrivals/bookingPlateScan.model');
const CameraDevice = require('../modules/booking-arrivals/cameraDevice.model');
const Review = require('../modules/reviews/review.model');

const resetTargets = Object.freeze([
    { group: 'Runtime arrival', model: BookingPlateScan, seed: 'seedNotificationsSurveysPlateScans.js', note: 'Historical recognition, confirmation and expired retention audit metadata' },
    { group: 'Runtime arrival', model: CameraDevice, seed: 'seedCameraDevice.js', note: 'Registered fixed gate cameras and health state' },
    { group: 'Runtime compensation', model: CustomerVoucher, seed: 'seedIncidentsVouchersCustomerCases.js', note: 'Incident and customer case compensation lifecycle' },
    { group: 'Runtime customer case', model: CustomerCaseRefund, seed: 'seedIncidentsVouchersCustomerCases.js', note: 'Auditable refund processing ledger' },
    { group: 'Runtime customer case', model: CustomerCaseResolution, seed: 'seedIncidentsVouchersCustomerCases.js', note: 'Versioned customer resolution proposals' },
    { group: 'Runtime customer case', model: CustomerCaseTechnicalAssessment, seed: 'seedIncidentsVouchersCustomerCases.js', note: 'Assigned inspection staff findings' },
    { group: 'Runtime customer case', model: CustomerCaseEvent, seed: 'seedIncidentsVouchersCustomerCases.js', note: 'Immutable customer case timeline' },
    { group: 'Runtime customer case', model: CustomerCaseMessage, seed: 'seedIncidentsVouchersCustomerCases.js', note: 'Customer and garage case messages' },
    { group: 'Runtime customer case', model: CustomerCase, seed: 'seedIncidentsVouchersCustomerCases.js', note: 'After-service issue cases' },
    { group: 'Runtime incident', model: BookingIncident, seed: 'seedIncidentsVouchersCustomerCases.js', note: 'Garage incident decision and operational recovery history' },
    { group: 'Runtime customer case', model: BookingHandover, seed: 'seedLoyaltyHistoriesHandovers.js', note: 'Vehicle handover state and inspection snapshot' },
    { group: 'Runtime review', model: Review, seed: 'seedReviews.js', note: 'Verified public garage and service package reviews' },
    { group: 'Runtime upload', model: Upload, seed: '-', note: 'Uploaded file metadata' },
    { group: 'Runtime audit', model: AuditLog, seed: '-', note: 'Generated by audited app events' },
    { group: 'Runtime research', model: ResearchReport, seed: '-', note: 'Admin research reports and snapshots' },
    { group: 'Runtime survey', model: SurveyResponse, seed: 'seedNotificationsSurveysPlateScans.js', note: 'Customer responses linked to paid completed bookings and wash histories' },
    { group: 'Runtime survey', model: Survey, seed: 'seedNotificationsSurveysPlateScans.js', note: 'Draft, published and closed survey lifecycle' },
    { group: 'Runtime booking', model: BookingServiceStep, seed: 'seedServiceStepsInspections.js', note: 'Deterministic service workflow history for completed and active bookings' },
    { group: 'Runtime booking', model: VehicleInspection, seed: 'seedServiceStepsInspections.js', note: 'Before and after wash evidence linked to booking workflow' },
    { group: 'Runtime booking', model: PaymentTransaction, seed: 'seedPaymentsPromotionUsages.js', note: 'Deterministic terminal PayOS history without active provider links' },
    { group: 'Runtime booking', model: BookingViolationEvent, seed: 'seedBooking.js', note: 'NO_SHOW score events seeded with booking history' },
    { group: 'Runtime booking', model: PromotionUsage, seed: 'seedPaymentsPromotionUsages.js', note: 'Reserved, consumed and released promotion lifecycle history' },
    { group: 'Runtime booking', model: PointTransaction, seed: 'seedLoyaltyHistoriesHandovers.js', note: 'Chronological earn, redeem and refund ledger' },
    { group: 'Runtime booking', model: WashHistory, seed: 'seedLoyaltyHistoriesHandovers.js', note: 'Completed paid service history for customers and walk-ins' },
    { group: 'Runtime booking', model: Notification, seed: 'seedNotificationsSurveysPlateScans.js', note: 'In-app lifecycle notifications derived from persisted business events' },
    { group: 'Runtime booking', model: CustomerBookingViolation, seed: 'seedBooking.js', note: 'Score summaries rebuilt from booking violation events' },
    { group: 'Runtime booking', model: BookingWaitlist, seed: '-', note: 'Customer waitlist entries and offers' },
    { group: 'Runtime booking', model: Booking, seed: 'seedBooking.js', note: 'Deterministic customer and walk-in booking history' },
    { group: 'Runtime pricing', model: PriceQuote, seed: '-', note: 'Short-lived server price quotes' },
    { group: 'Auth transient', model: RefreshToken, seed: '-', note: 'Login sessions' },
    { group: 'Auth transient', model: PhoneVerification, seed: '-', note: 'Phone OTP challenges and rate limits' },
    { group: 'Auth transient', model: PasswordResetToken, seed: '-', note: 'Password reset tokens' },
    { group: 'Auth transient', model: PasswordResetRateLimit, seed: '-', note: 'Password reset rate limits' },
    { group: 'Seed data', model: CustomerLoyalty, seed: 'seedLoyaltyHistoriesHandovers.js', note: 'Derived customer tier, spend, visit and point balances' },
    { group: 'Seed data', model: StaffProfile, seed: 'seedStaffProfile.js', note: 'Depends on users and garages' },
    { group: 'Seed data', model: WashBay, seed: 'seedWashBay.js', note: 'Depends on garages' },
    { group: 'Seed data', model: Vehicle, seed: 'seedVehicle.js', note: 'Depends on customer users' },
    { group: 'Seed data', model: Promotion, seed: 'seedPromotion.js', note: 'Tier, vehicle and service campaigns' },
    { group: 'Seed data', model: ServicePackage, seed: 'seedServicePackage.js', note: 'Global service catalog' },
    { group: 'Seed data', model: ServicePriceRule, seed: 'seedServicePriceRule.js', note: 'Global and garage vehicle-classification prices' },
    { group: 'Seed data', model: LoyaltyRedeemRule, seed: 'seedLoyaltyRedeemRule.js', note: 'Loyalty redeem config' },
    { group: 'Seed data', model: TierRule, seed: 'seedTierRule.js', note: 'Loyalty tier config' },
    { group: 'Seed data', model: Garage, seed: 'seedGarage.js', note: 'Demo garages' },
    { group: 'Seed data', model: User, seed: 'seedUser.js', note: 'Admin, staff, customers' },
]);

const toResetTable = () => resetTargets.map((target, index) => ({
    order: index + 1,
    group: target.group,
    collection: target.model.collection.name,
    seed: target.seed,
    note: target.note,
}));

const isProductionTarget = () => {
    const dbName = mongoose.connection.name || process.env.MONGODB_DB_NAME || '';
    const nodeEnv = process.env.NODE_ENV || '';

    return nodeEnv.toLowerCase() === 'production' || /prod|production/i.test(dbName);
};

const resetDatabase = async ({ dryRun = process.argv.includes('--dry-run') } = {}) => {
    const dbName = mongoose.connection.name || process.env.MONGODB_DB_NAME || 'wdp301_project';
    const forceProduction = process.argv.includes('--force-production');

    if (isProductionTarget() && !forceProduction) {
        throw new Error('Database reset is blocked for production target. Use --force-production only when you are certain.');
    }

    const table = toResetTable();

    console.log(`Reset target database: ${dbName}`);
    console.table(table);

    if (dryRun) {
        console.log('Dry run completed. No data was deleted.');

        return {
            dry_run: true,
            table,
            deleted: [],
        };
    }

    const deleted = [];

    for (const target of resetTargets) {
        const collection = target.model.collection.name;
        const result = await target.model.deleteMany({});
        const deletedCount = result.deletedCount || 0;

        deleted.push({
            collection,
            deleted_count: deletedCount,
        });
        console.log(`Reset collection ${collection}: deleted ${deletedCount}`);
    }

    console.table(deleted);
    console.log('Database reset completed');

    return {
        dry_run: false,
        table,
        deleted,
    };
};

const run = async () => {
    let exitCode = 0;

    try {
        require('dotenv').config();
        await connectDB();
        await resetDatabase();
    } catch (error) {
        console.error('Database reset failed:', error);
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
    resetDatabase,
    resetTargets,
    toResetTable,
};
