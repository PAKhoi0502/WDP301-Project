const express = require('express');
const staffBookingWorkflowController = require('./staffBookingWorkflow.controller');
const {
    listBookingWorkflowsSchema,
    getBookingWorkflowSchema,
    claimInspectionBookingSchema,
} = require('./staffBookingWorkflow.validator');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');
const { validate } = require('../../shared/middlewares/validate.middleware');
const { USER_ROLES } = require('../../shared/constants/roles.constant');
const { STAFF_CAPABILITIES } = require('../../shared/constants/staff.constant');
const {
    requireStaffCapabilities,
} = require('../../shared/middlewares/staffCapability.middleware');

const router = express.Router();

router.use(authenticate, authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN));

router.get(
    '/',
    requireStaffCapabilities(STAFF_CAPABILITIES.BOOKING_WORKFLOW_READ_GARAGE),
    validate(listBookingWorkflowsSchema),
    staffBookingWorkflowController.listBookingWorkflows
);

router.get(
    '/:bookingId/workflow',
    requireStaffCapabilities(STAFF_CAPABILITIES.BOOKING_WORKFLOW_READ_GARAGE),
    validate(getBookingWorkflowSchema),
    staffBookingWorkflowController.getBookingWorkflow
);

router.patch(
    '/:bookingId/claim-inspection',
    authorize(USER_ROLES.STAFF),
    requireStaffCapabilities(STAFF_CAPABILITIES.INSPECTION_CLAIM_GARAGE),
    validate(claimInspectionBookingSchema),
    staffBookingWorkflowController.claimInspectionBooking
);

module.exports = router;
