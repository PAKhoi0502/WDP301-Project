const express = require('express');

const bookingController = require('./booking.controller');
const bookingServiceStepController = require('../booking-service-steps/bookingServiceStep.controller');
const vehicleInspectionController = require('../vehicle-inspections/vehicleInspection.controller');
const bookingHandoverController = require('../booking-handovers/bookingHandover.controller');
const customerCaseController = require('../customer-cases/customerCase.controller');
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
    startServiceSchema,
    getLateArrivalOptionsSchema,
    resolveLateArrivalSchema,
    assignWashBaySchema,
    serviceStepParamSchema,
    serviceItemParamSchema,
    serviceItemOperationSchema,
    pauseServiceItemSchema,
    assignInspectionStaffSchema,
    assignServiceItemStaffSchema,
} = require('./booking.validator');
const {
    bookingParamSchema: incidentBookingParamSchema,
    reportBookingIncidentSchema,
    getIncidentOptionsSchema,
    customerIncidentDecisionSchema,
    staffIncidentDecisionSchema,
    createIncidentCompensationVoucherSchema,
} = require('../booking-incidents/bookingIncident.validator');
const {
    createVehicleInspectionSchema,
    getVehicleInspectionsSchema,
} = require('../vehicle-inspections/vehicleInspection.validator');
const {
    bookingParamSchema: handoverBookingParamSchema,
    handoverOperationSchema,
    createCustomerCaseSchema,
} = require('../customer-cases/customerCase.validator');
const { validate } = require('../../shared/middlewares/validate.middleware');
const { authenticate, optionalAuthenticate, authorize } = require('../../shared/middlewares/auth.middleware');
const { USER_ROLES } = require('../../shared/constants/roles.constant');
const {
    STAFF_CAPABILITIES,
} = require('../../shared/constants/staff.constant');
const {
    BOOKING_INCIDENT_TYPES,
} = require('../../shared/constants/bookingIncident.constant');
const {
    requireStaffCapabilities,
    requireAnyStaffCapability,
    requireResolvedStaffCapability,
} = require('../../shared/middlewares/staffCapability.middleware');

const customerRouter = express.Router();
const adminRouter = express.Router();
const staffTaskRouter = express.Router();

customerRouter.get(
    '/available-slots',
    optionalAuthenticate,
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

customerRouter.get(
    '/:id/incidents/active',
    validate(incidentBookingParamSchema),
    bookingController.getMyActiveBookingIncident
);

customerRouter.patch(
    '/:id/incidents/:incidentId/decision',
    validate(customerIncidentDecisionSchema),
    bookingController.resolveMyBookingIncident
);

adminRouter.use(authenticate, authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN));

staffTaskRouter.use(authenticate, authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN));

staffTaskRouter.get(
    '/',
    requireStaffCapabilities(STAFF_CAPABILITIES.SERVICE_TASK_READ_ASSIGNED),
    validate(getAdminBookingsSchema),
    bookingController.getAllBookings
);

customerRouter.get(
    '/:id/handover',
    validate(handoverBookingParamSchema),
    bookingHandoverController.getMyHandover
);

customerRouter.post(
    '/:id/handover/accept',
    validate(handoverOperationSchema),
    bookingHandoverController.acceptMyHandover
);

customerRouter.post(
    '/:id/handover/report',
    validate(createCustomerCaseSchema),
    customerCaseController.createFromHandover
);

staffTaskRouter.get(
    '/:id',
    requireStaffCapabilities(STAFF_CAPABILITIES.SERVICE_TASK_READ_ASSIGNED),
    validate(idParamSchema),
    bookingController.getBookingById
);

staffTaskRouter.post(
    '/:id/incidents',
    validate(reportBookingIncidentSchema),
    requireResolvedStaffCapability((req) => ({
        [BOOKING_INCIDENT_TYPES.WASH_BAY_FAILURE]: STAFF_CAPABILITIES.INCIDENT_REPORT_WASH_BAY_FAILURE,
        [BOOKING_INCIDENT_TYPES.STAFF_UNAVAILABLE]: STAFF_CAPABILITIES.INCIDENT_REPORT_STAFF_UNAVAILABLE,
        [BOOKING_INCIDENT_TYPES.OTHER_GARAGE_INCIDENT]: STAFF_CAPABILITIES.INCIDENT_REPORT_OTHER_GARAGE,
    })[req.validated.body.incident_type]),
    bookingController.reportBookingIncident
);

staffTaskRouter.get(
    '/:id/incidents/active',
    requireStaffCapabilities(STAFF_CAPABILITIES.INCIDENT_READ_ASSIGNED),
    validate(incidentBookingParamSchema),
    bookingController.getAdminActiveBookingIncident
);

staffTaskRouter.get(
    '/:id/service-steps',
    requireStaffCapabilities(STAFF_CAPABILITIES.SERVICE_TASK_READ_ASSIGNED),
    validate(idParamSchema),
    bookingServiceStepController.getBookingServiceSteps
);

staffTaskRouter.get(
    '/:id/service-workflow',
    requireStaffCapabilities(STAFF_CAPABILITIES.SERVICE_TASK_READ_ASSIGNED),
    validate(idParamSchema),
    bookingController.getServiceWorkflow
);

staffTaskRouter.patch(
    '/:id/service-steps/:stepId/done',
    requireAnyStaffCapability(
        STAFF_CAPABILITIES.SERVICE_TASK_WASH_EXECUTE_ASSIGNED,
        STAFF_CAPABILITIES.SERVICE_TASK_CARE_EXECUTE_ASSIGNED
    ),
    validate(serviceStepParamSchema),
    bookingServiceStepController.markBookingServiceStepDone
);

staffTaskRouter.patch(
    '/:id/service-items/:itemKey/complete-early',
    requireAnyStaffCapability(
        STAFF_CAPABILITIES.SERVICE_TASK_WASH_EXECUTE_ASSIGNED,
        STAFF_CAPABILITIES.SERVICE_TASK_CARE_EXECUTE_ASSIGNED
    ),
    validate(serviceItemOperationSchema),
    bookingController.completeServiceItemEarly
);

staffTaskRouter.patch(
    '/:id/service-items/:itemKey/confirm-complete',
    requireAnyStaffCapability(
        STAFF_CAPABILITIES.SERVICE_TASK_WASH_EXECUTE_ASSIGNED,
        STAFF_CAPABILITIES.SERVICE_TASK_CARE_EXECUTE_ASSIGNED
    ),
    validate(serviceItemOperationSchema),
    bookingController.confirmServiceItemComplete
);

staffTaskRouter.patch(
    '/:id/service-items/:itemKey/pause',
    requireAnyStaffCapability(
        STAFF_CAPABILITIES.SERVICE_TASK_WASH_EXECUTE_ASSIGNED,
        STAFF_CAPABILITIES.SERVICE_TASK_CARE_EXECUTE_ASSIGNED
    ),
    validate(pauseServiceItemSchema),
    bookingController.pauseServiceItem
);

staffTaskRouter.patch(
    '/:id/service-items/:itemKey/resume',
    requireAnyStaffCapability(
        STAFF_CAPABILITIES.SERVICE_TASK_WASH_EXECUTE_ASSIGNED,
        STAFF_CAPABILITIES.SERVICE_TASK_CARE_EXECUTE_ASSIGNED
    ),
    validate(serviceItemParamSchema),
    bookingController.resumeServiceItem
);

adminRouter.get(
    '/',
    requireAnyStaffCapability(
        STAFF_CAPABILITIES.BOOKING_READ_GARAGE,
        STAFF_CAPABILITIES.BOOKING_READ_ASSIGNED
    ),
    validate(getAdminBookingsSchema),
    bookingController.getAllBookings
);

adminRouter.post(
    '/walk-in',
    requireStaffCapabilities(STAFF_CAPABILITIES.BOOKING_WALK_IN_CREATE),
    validate(createWalkInBookingSchema),
    bookingController.createWalkInBooking
);

adminRouter.get(
    '/:id',
    requireAnyStaffCapability(
        STAFF_CAPABILITIES.BOOKING_READ_GARAGE,
        STAFF_CAPABILITIES.BOOKING_READ_ASSIGNED
    ),
    validate(idParamSchema),
    bookingController.getBookingById
);

adminRouter.patch(
    '/:id/cancel',
    requireStaffCapabilities(STAFF_CAPABILITIES.BOOKING_CANCEL_CUSTOMER_REQUEST),
    validate(cancelBookingSchema),
    bookingController.cancelBooking
);

adminRouter.post(
    '/:id/incidents',
    validate(reportBookingIncidentSchema),
    requireResolvedStaffCapability((req) => ({
        [BOOKING_INCIDENT_TYPES.WASH_BAY_FAILURE]: STAFF_CAPABILITIES.INCIDENT_REPORT_WASH_BAY_FAILURE,
        [BOOKING_INCIDENT_TYPES.STAFF_UNAVAILABLE]: STAFF_CAPABILITIES.INCIDENT_REPORT_STAFF_UNAVAILABLE,
        [BOOKING_INCIDENT_TYPES.OTHER_GARAGE_INCIDENT]: STAFF_CAPABILITIES.INCIDENT_REPORT_OTHER_GARAGE,
    })[req.validated.body.incident_type]),
    bookingController.reportBookingIncident
);

adminRouter.get(
    '/:id/incidents/active',
    requireAnyStaffCapability(
        STAFF_CAPABILITIES.INCIDENT_READ_GARAGE,
        STAFF_CAPABILITIES.INCIDENT_READ_ASSIGNED
    ),
    validate(incidentBookingParamSchema),
    bookingController.getAdminActiveBookingIncident
);

adminRouter.get(
    '/:id/incidents/:incidentId/resolution-options',
    requireStaffCapabilities(STAFF_CAPABILITIES.INCIDENT_READ_GARAGE),
    validate(getIncidentOptionsSchema),
    bookingController.getAdminBookingIncidentOptions
);

adminRouter.patch(
    '/:id/incidents/:incidentId/record-customer-decision',
    requireStaffCapabilities(STAFF_CAPABILITIES.INCIDENT_RECORD_CUSTOMER_DECISION),
    validate(staffIncidentDecisionSchema),
    bookingController.recordBookingIncidentCustomerDecision
);

adminRouter.post(
    '/:id/incidents/:incidentId/compensation-vouchers',
    requireStaffCapabilities(STAFF_CAPABILITIES.INCIDENT_COMPENSATION_ISSUE),
    validate(createIncidentCompensationVoucherSchema),
    bookingController.createIncidentCompensationVoucher
);

adminRouter.patch(
    '/:id/mark-no-show',
    requireStaffCapabilities(STAFF_CAPABILITIES.BOOKING_ARRIVAL_MANAGE),
    validate(markNoShowSchema),
    bookingController.markNoShow
);

adminRouter.patch(
    '/:id/check-in',
    requireStaffCapabilities(STAFF_CAPABILITIES.BOOKING_CHECK_IN),
    validate(bookingOperationSchema),
    bookingController.checkInBooking
);

adminRouter.get(
    '/:id/late-arrival-options',
    requireStaffCapabilities(STAFF_CAPABILITIES.BOOKING_LATE_ARRIVAL_MANAGE),
    validate(getLateArrivalOptionsSchema),
    bookingController.getLateArrivalOptions
);

adminRouter.patch(
    '/:id/resolve-late-arrival',
    requireStaffCapabilities(STAFF_CAPABILITIES.BOOKING_LATE_ARRIVAL_MANAGE),
    validate(resolveLateArrivalSchema),
    bookingController.resolveLateArrival
);

adminRouter.patch(
    '/:id/assign-wash-bay',
    requireStaffCapabilities(STAFF_CAPABILITIES.BOOKING_WASH_BAY_ASSIGN),
    validate(assignWashBaySchema),
    bookingController.assignWashBay
);

adminRouter.patch(
    '/:id/assign-inspection-staff',
    authorize(USER_ROLES.ADMIN),
    validate(assignInspectionStaffSchema),
    bookingController.assignInspectionStaff
);

adminRouter.patch(
    '/:id/start-service',
    requireStaffCapabilities(STAFF_CAPABILITIES.BOOKING_SERVICE_START),
    validate(startServiceSchema),
    bookingController.startService
);

adminRouter.get(
    '/:id/service-steps',
    requireAnyStaffCapability(
        STAFF_CAPABILITIES.BOOKING_SERVICE_READ_GARAGE,
        STAFF_CAPABILITIES.SERVICE_TASK_READ_ASSIGNED
    ),
    validate(idParamSchema),
    bookingServiceStepController.getBookingServiceSteps
);

adminRouter.get(
    '/:id/service-workflow',
    requireAnyStaffCapability(
        STAFF_CAPABILITIES.BOOKING_SERVICE_READ_GARAGE,
        STAFF_CAPABILITIES.SERVICE_TASK_READ_ASSIGNED
    ),
    validate(idParamSchema),
    bookingController.getServiceWorkflow
);

adminRouter.patch(
    '/:id/service-steps/:stepId/done',
    requireAnyStaffCapability(
        STAFF_CAPABILITIES.SERVICE_TASK_WASH_EXECUTE_ASSIGNED,
        STAFF_CAPABILITIES.SERVICE_TASK_CARE_EXECUTE_ASSIGNED
    ),
    validate(serviceStepParamSchema),
    bookingServiceStepController.markBookingServiceStepDone
);

adminRouter.patch(
    '/:id/service-items/:itemKey/complete-early',
    requireAnyStaffCapability(
        STAFF_CAPABILITIES.SERVICE_TASK_WASH_EXECUTE_ASSIGNED,
        STAFF_CAPABILITIES.SERVICE_TASK_CARE_EXECUTE_ASSIGNED
    ),
    validate(serviceItemOperationSchema),
    bookingController.completeServiceItemEarly
);

adminRouter.patch(
    '/:id/service-items/:itemKey/confirm-complete',
    requireAnyStaffCapability(
        STAFF_CAPABILITIES.SERVICE_TASK_WASH_EXECUTE_ASSIGNED,
        STAFF_CAPABILITIES.SERVICE_TASK_CARE_EXECUTE_ASSIGNED
    ),
    validate(serviceItemOperationSchema),
    bookingController.confirmServiceItemComplete
);

adminRouter.patch(
    '/:id/service-items/:itemKey/pause',
    requireAnyStaffCapability(
        STAFF_CAPABILITIES.SERVICE_TASK_WASH_EXECUTE_ASSIGNED,
        STAFF_CAPABILITIES.SERVICE_TASK_CARE_EXECUTE_ASSIGNED
    ),
    validate(pauseServiceItemSchema),
    bookingController.pauseServiceItem
);

adminRouter.patch(
    '/:id/service-items/:itemKey/resume',
    requireAnyStaffCapability(
        STAFF_CAPABILITIES.SERVICE_TASK_WASH_EXECUTE_ASSIGNED,
        STAFF_CAPABILITIES.SERVICE_TASK_CARE_EXECUTE_ASSIGNED
    ),
    validate(serviceItemParamSchema),
    bookingController.resumeServiceItem
);

adminRouter.patch(
    '/:id/service-items/:itemKey/assign-staff',
    authorize(USER_ROLES.ADMIN),
    validate(assignServiceItemStaffSchema),
    bookingController.assignServiceItemStaff
);

adminRouter.patch(
    '/:id/complete-service',
    requireStaffCapabilities(STAFF_CAPABILITIES.BOOKING_SERVICE_COMPLETE),
    validate(bookingOperationSchema),
    bookingController.completeService
);

adminRouter.patch(
    '/:id/handover/ready',
    requireStaffCapabilities(STAFF_CAPABILITIES.BOOKING_HANDOVER_MANAGE_GARAGE),
    validate(handoverOperationSchema),
    bookingHandoverController.markReady
);

adminRouter.get(
    '/:id/handover',
    requireStaffCapabilities(STAFF_CAPABILITIES.BOOKING_HANDOVER_MANAGE_GARAGE),
    validate(handoverBookingParamSchema),
    bookingHandoverController.getStaffHandover
);

adminRouter.patch(
    '/:id/handover/release',
    requireStaffCapabilities(STAFF_CAPABILITIES.BOOKING_HANDOVER_MANAGE_GARAGE),
    validate(handoverOperationSchema),
    bookingHandoverController.release
);

adminRouter.patch(
    '/:id/reopen-service',
    authorize(USER_ROLES.ADMIN),
    validate(bookingOperationSchema),
    bookingController.reopenCompletedBooking
);

adminRouter.patch(
    '/:id/mark-paid',
    requireStaffCapabilities(STAFF_CAPABILITIES.BOOKING_PAYMENT_COLLECT_CASH),
    validate(bookingOperationSchema),
    bookingController.markPaid
);

adminRouter.post(
    '/:id/inspections',
    requireStaffCapabilities(STAFF_CAPABILITIES.INSPECTION_CREATE_ASSIGNED),
    validate(createVehicleInspectionSchema),
    vehicleInspectionController.createInspection
);

adminRouter.get(
    '/:id/inspections',
    requireAnyStaffCapability(
        STAFF_CAPABILITIES.INSPECTION_READ_GARAGE,
        STAFF_CAPABILITIES.INSPECTION_READ_ASSIGNED
    ),
    validate(getVehicleInspectionsSchema),
    vehicleInspectionController.getAdminBookingInspections
);

module.exports = {
    customerRouter,
    adminRouter,
    staffRouter: adminRouter,
    staffTaskRouter,
};
