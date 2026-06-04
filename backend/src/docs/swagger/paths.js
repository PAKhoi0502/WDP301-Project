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

const paths = {
    ...authSwagger.paths,
    ...userSwagger.paths,
    ...staffProfileSwagger.paths,
    ...garageSwagger.paths,
    ...washBaySwagger.paths,
    ...vehicleSwagger.paths,
    ...servicePackageSwagger.paths,
    ...bookingSwagger.paths,
    ...bookingServiceStepSwagger.paths,
    ...vehicleInspectionSwagger.paths,
};

module.exports = paths;