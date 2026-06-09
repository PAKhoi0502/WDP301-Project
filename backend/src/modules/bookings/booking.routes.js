const express = require('express');

const bookingController = require('./booking.controller');
const bookingServiceStepController = require('../booking-service-steps/bookingServiceStep.controller');
const vehicleInspectionController = require('../vehicle-inspections/vehicleInspection.controller');
const {
    idParamSchema,
    getAvailableSlotsSchema,
    getMyBookingsSchema,
    getAdminBookingsSchema,
    createCustomerBookingSchema,
    createWalkInBookingSchema,
    cancelBookingSchema,
    markNoShowSchema,
    bookingOperationSchema,
    assignWashBaySchema,
    serviceStepParamSchema,
} = require('./booking.validator');
const {
    createVehicleInspectionSchema,
    getVehicleInspectionsSchema,
} = require('../vehicle-inspections/vehicleInspection.validator');
const { validate } = require('../../shared/middlewares/validate.middleware');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');
const { USER_ROLES } = require('../../shared/constants/roles.constant');

const customerRouter = express.Router();
const adminRouter = express.Router();

customerRouter.get(
    '/available-slots',
    validate(getAvailableSlotsSchema),
    bookingController.getAvailableSlots
);

customerRouter.use(authenticate, authorize(USER_ROLES.CUSTOMER));

customerRouter.get(
    '/',
    validate(getMyBookingsSchema),
    bookingController.getMyBookings
);

customerRouter.post(
    '/',
    validate(createCustomerBookingSchema),
    bookingController.createCustomerBooking
);

customerRouter.get(
    '/:id/inspections',
    validate(getVehicleInspectionsSchema),
    vehicleInspectionController.getMyBookingInspections
);

customerRouter.get(
    '/:id',
    validate(idParamSchema),
    bookingController.getMyBookingById
);

customerRouter.patch(
    '/:id/cancel',
    validate(cancelBookingSchema),
    bookingController.cancelMyBooking
);

adminRouter.use(authenticate, authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN));

adminRouter.get(
    '/',
    validate(getAdminBookingsSchema),
    bookingController.getAllBookings
);

adminRouter.post(
    '/walk-in',
    validate(createWalkInBookingSchema),
    bookingController.createWalkInBooking
);

adminRouter.patch(
    '/:id/cancel',
    validate(cancelBookingSchema),
    bookingController.cancelBooking
);

adminRouter.patch(
    '/:id/mark-no-show',
    validate(markNoShowSchema),
    bookingController.markNoShow
);

adminRouter.patch(
    '/:id/check-in',
    validate(bookingOperationSchema),
    bookingController.checkInBooking
);

adminRouter.patch(
    '/:id/assign-wash-bay',
    validate(assignWashBaySchema),
    bookingController.assignWashBay
);

adminRouter.patch(
    '/:id/start-service',
    validate(bookingOperationSchema),
    bookingController.startService
);

adminRouter.get(
    '/:id/service-steps',
    validate(idParamSchema),
    bookingServiceStepController.getBookingServiceSteps
);

adminRouter.patch(
    '/:id/service-steps/:stepId/done',
    validate(serviceStepParamSchema),
    bookingServiceStepController.markBookingServiceStepDone
);

adminRouter.patch(
    '/:id/complete-service',
    validate(bookingOperationSchema),
    bookingController.completeService
);


adminRouter.patch(
    '/:id/mark-paid',
    validate(bookingOperationSchema),
    bookingController.markPaid
);

adminRouter.post(
    '/:id/inspections',
    validate(createVehicleInspectionSchema),
    vehicleInspectionController.createInspection
);

adminRouter.get(
    '/:id/inspections',
    validate(getVehicleInspectionsSchema),
    vehicleInspectionController.getAdminBookingInspections
);

module.exports = {
    customerRouter,
    adminRouter,
};
