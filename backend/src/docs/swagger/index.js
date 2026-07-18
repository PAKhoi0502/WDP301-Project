const components = require('./components');
const paths = require('./paths');
const authSwagger = require('../../modules/auth/auth.swagger');
const userSwagger = require('../../modules/users/user.swagger');
const staffProfileSwagger = require('../../modules/staff-profiles/staffProfile.swagger');
const garageSwagger = require('../../modules/garages/garage.swagger');
const washBaySwagger = require('../../modules/wash-bays/washBay.swagger');
const vehicleSwagger = require('../../modules/vehicles/vehicle.swagger');
const customerSwagger = require('../../modules/customers/customer.swagger');
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
const surveySwagger = require('../../modules/surveys/survey.swagger');
const analyticsSwagger = require('../../modules/analytics/analytics.swagger');
const researchSwagger = require('../../modules/research/research.swagger');
const bookingIncidentSwagger = require('../../modules/booking-incidents/bookingIncident.swagger');
const customerVoucherSwagger = require('../../modules/customer-vouchers/customerVoucher.swagger');
const { enrichOpenApiRoles } = require('./roleMetadata');

const openApiSpec = enrichOpenApiRoles({
    openapi: '3.0.0',
    info: {
        title: 'AutoWash Pro API',
        version: '1.0.0',
        description: 'Smart Automated Car Wash Management System with Advance Booking and Loyalty Program',
    },
    servers: [
        {
            url: '/api/v1',
            description: 'Current server',
        },
    ],
    tags: [
        ...authSwagger.tags,
        ...userSwagger.tags,
        ...staffProfileSwagger.tags,
        ...garageSwagger.tags,
        ...washBaySwagger.tags,
        ...vehicleSwagger.tags,
        ...customerSwagger.tags,
        ...servicePackageSwagger.tags,
        ...bookingSwagger.tags,
        ...bookingWaitlistSwagger.tags,
        ...bookingServiceStepSwagger.tags,
        ...vehicleInspectionSwagger.tags,
        ...promotionSwagger.tags,
        ...loyaltySwagger.tags,
        ...notificationSwagger.tags,
        ...washHistorySwagger.tags,
        ...paymentSwagger.tags,
        ...uploadSwagger.tags,
        ...auditLogSwagger.tags,
        ...surveySwagger.tags,
        ...analyticsSwagger.tags,
        ...researchSwagger.tags,
        ...bookingIncidentSwagger.tags,
        ...customerVoucherSwagger.tags,
    ],
    paths,
    components: {
        ...components,
        schemas: {
            ...components.schemas,
            ...authSwagger.schemas,
            ...userSwagger.schemas,
            ...staffProfileSwagger.schemas,
            ...garageSwagger.schemas,
            ...washBaySwagger.schemas,
            ...vehicleSwagger.schemas,
            ...customerSwagger.schemas,
            ...servicePackageSwagger.schemas,
            ...bookingSwagger.schemas,
            ...bookingWaitlistSwagger.schemas,
            ...bookingServiceStepSwagger.schemas,
            ...vehicleInspectionSwagger.schemas,
            ...promotionSwagger.schemas,
            ...loyaltySwagger.schemas,
            ...notificationSwagger.schemas,
            ...washHistorySwagger.schemas,
            ...paymentSwagger.schemas,
            ...uploadSwagger.schemas,
            ...auditLogSwagger.schemas,
            ...surveySwagger.schemas,
            ...analyticsSwagger.schemas,
            ...researchSwagger.schemas,
            ...bookingIncidentSwagger.schemas,
            ...customerVoucherSwagger.schemas,
        },
    },
});

module.exports = openApiSpec;
