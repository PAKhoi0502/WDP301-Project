const components = require('./components');
const paths = require('./paths');
const authSwagger = require('../../modules/auth/auth.swagger');
const userSwagger = require('../../modules/users/user.swagger');
const staffProfileSwagger = require('../../modules/staff-profiles/staffProfile.swagger');
const garageSwagger = require('../../modules/garages/garage.swagger');
const washBaySwagger = require('../../modules/wash-bays/washBay.swagger');
const vehicleSwagger = require('../../modules/vehicles/vehicle.swagger');
const servicePackageSwagger = require('../../modules/service-packages/servicePackage.swagger');
const bookingSwagger = require('../../modules/bookings/booking.swagger');
const bookingServiceStepSwagger = require('../../modules/booking-service-steps/bookingServiceStep.swagger');
const vehicleInspectionSwagger = require('../../modules/vehicle-inspections/vehicleInspection.swagger');
const promotionSwagger = require('../../modules/promotions/promotion.swagger');

const openApiSpec = {
    openapi: '3.0.0',
    info: {
        title: 'AutoWash Pro API',
        version: '1.0.0',
        description: 'Smart Automated Car Wash Management System with Advance Booking and Loyalty Program',
    },
    servers: [
        {
            url: 'http://localhost:5000/api/v1',
            description: 'Local development server',
        },
    ],
    tags: [
        ...authSwagger.tags,
        ...userSwagger.tags,
        ...staffProfileSwagger.tags,
        ...garageSwagger.tags,
        ...washBaySwagger.tags,
        ...vehicleSwagger.tags,
        ...servicePackageSwagger.tags,
        ...bookingSwagger.tags,
        ...bookingServiceStepSwagger.tags,
        ...vehicleInspectionSwagger.tags,
        ...promotionSwagger.tags,
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
            ...servicePackageSwagger.schemas,
            ...bookingSwagger.schemas,
            ...bookingServiceStepSwagger.schemas,
            ...vehicleInspectionSwagger.schemas,
            ...promotionSwagger.schemas,
        },
    },
};

module.exports = openApiSpec;