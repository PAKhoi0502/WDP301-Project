const mongoose = require('mongoose');

const Booking = require('../bookings/booking.model');
const BookingHandover = require('../booking-handovers/bookingHandover.model');
const StaffProfile = require('../staff-profiles/staffProfile.model');
const CustomerCase = require('./customerCase.model');
const CustomerCaseTechnicalAssessment = require('./customerCaseTechnicalAssessment.model');
const CustomerCaseResolution = require('./customerCaseResolution.model');
const CustomerCaseRefund = require('./customerCaseRefund.model');
const customerCaseService = require('./customerCase.service');
const customerCaseNotificationService = require('./customerCaseNotification.service');
const customerVoucherService = require('../customer-vouchers/customerVoucher.service');
const bookingService = require('../bookings/booking.service');
const phoneVerificationService = require('../auth/services/phoneVerification.service');
const auditLogService = require('../audit-logs/auditLog.service');
const { AppError } = require('../../shared/utils/appError');
const { normalizePhone } = require('../../shared/utils/phone');
const { USER_ROLES } = require('../../shared/constants/roles.constant');
const { BOOKING_STATUS, BOOKING_PAYMENT_STATUS } = require('../../shared/constants/booking.constant');
const { CUSTOMER_VOUCHER_TYPE_VALUES } = require('../../shared/constants/customerVoucher.constant');
const { PHONE_VERIFICATION_PURPOSES } = require('../auth/phoneVerification.constant');
const {
    STAFF_TYPES,
    STAFF_EMPLOYMENT_STATUS,
} = require('../../shared/constants/staff.constant');
const {
    BOOKING_HANDOVER_STATES,
    BOOKING_HANDOVER_RESPONSES,
    CUSTOMER_CASE_CATEGORIES,
    CUSTOMER_CASE_STATUSES,
    CUSTOMER_CASE_OPEN_STATUSES,
    CUSTOMER_CASE_SOURCES,
    CUSTOMER_CASE_EVENT_TYPES,
    CUSTOMER_CASE_TECHNICAL_ASSESSMENT_STATUSES,
    CUSTOMER_CASE_RESOLUTION_STATUSES,
    CUSTOMER_CASE_RESOLUTION_ACTION_TYPES,
    CUSTOMER_CASE_REFUND_STATUSES,
    CUSTOMER_CASE_SLA_STATES,
    getCustomerCasePriority,
    getCustomerCasePriorityRank,
} = require('../../shared/constants/customerCase.constant');
const { NOTIFICATION_TYPES, NOTIFICATION_RELATED_TYPES } = require('../../shared/constants/notification.constant');
const { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } = require('../../shared/constants/audit.constant');

const toId = (value) => value?._id?.toString?.() || value?.toString?.() || null;
const normalizeText = (value) => typeof value === 'string' ? value.trim() || null : value || null;
const TECHNICAL_CATEGORIES = new Set([
    CUSTOMER_CASE_CATEGORIES.VEHICLE_DAMAGE,
    CUSTOMER_CASE_CATEGORIES.SERVICE_QUALITY,
    CUSTOMER_CASE_CATEGORIES.SERVICE_INCOMPLETE,
    CUSTOMER_CASE_CATEGORIES.SAFETY_CONCERN,
]);

const recordAudit = ({ user, action, customerCase, before = null, after = null, context = {}, metadata = {} }) => (
    auditLogService.recordAuditEvent({
        actorId: user?._id || null,
        action,
        resourceType: AUDIT_RESOURCE_TYPES.CUSTOMER_CASE,
        resourceId: customerCase._id,
        before,
        after,
        ip: context.ip,
        userAgent: context.userAgent,
        metadata,
    })
);

const notifyCaseActors = async (customerCase, { type, title, message, excludeUserId = null }) => {
    const [customerServiceIds, adminIds] = await Promise.all([
        customerCaseNotificationService.findGarageCustomerServiceUserIds(customerCase.garage_id),
        customerCaseNotificationService.findAdminUserIds(),
    ]);
    return customerCaseNotificationService.notifyUsers({
        userIds: [customerCase.customer_id, customerCase.assigned_to_id, ...customerServiceIds, ...adminIds],
        excludeUserId,
        type,
        title,
        message,
        relatedType: NOTIFICATION_RELATED_TYPES.CUSTOMER_CASE,
        relatedId: customerCase._id,
        metadata: { case_code: customerCase.case_code, booking_id: toId(customerCase.booking_id) },
    });
};

const assertAdmin = (user) => {
    if (user.role !== USER_ROLES.ADMIN) {
        throw new AppError('Only admin can perform this operation', 403, 'CUSTOMER_CASE_ADMIN_ONLY');
    }
};

const getAssessment = async (caseId) => {
    const assessment = await CustomerCaseTechnicalAssessment.findOne({ case_id: caseId });
    if (!assessment) {
        throw new AppError('Technical assessment has not been assigned', 404, 'CUSTOMER_CASE_ASSESSMENT_NOT_FOUND');
    }
    return assessment;
};

const assignTechnicalAssessment = async (user, staffContext, caseId, payload, auditContext = {}) => {
    const customerCase = await customerCaseService.getCaseDocument(caseId);
    customerCaseService.assertStaffGarageAccess(staffContext, customerCase);
    customerCaseService.assertCaseOpen(customerCase);

    const inspector = await StaffProfile.findOne({
        _id: payload.staff_profile_id,
        garage_id: customerCase.garage_id,
        staff_type: STAFF_TYPES.VEHICLE_INSPECTION_STAFF,
        is_active: true,
        employment_status: STAFF_EMPLOYMENT_STATUS.ACTIVE,
    });
    if (!inspector) {
        throw new AppError('Active inspection staff was not found in this garage', 404, 'INSPECTION_STAFF_NOT_FOUND');
    }

    const now = new Date();
    const previous = await CustomerCaseTechnicalAssessment.findOne({ case_id: customerCase._id });
    if (previous?.status === CUSTOMER_CASE_TECHNICAL_ASSESSMENT_STATUSES.SUBMITTED) {
        throw new AppError('Submitted assessment cannot be reassigned', 409, 'CUSTOMER_CASE_ASSESSMENT_ALREADY_SUBMITTED');
    }

    const assessment = await CustomerCaseTechnicalAssessment.findOneAndUpdate(
        { case_id: customerCase._id },
        {
            $set: {
                garage_id: customerCase.garage_id,
                inspector_staff_profile_id: inspector._id,
                inspector_user_id: inspector.user_id,
                assigned_by_id: user._id,
                assigned_at: now,
                status: CUSTOMER_CASE_TECHNICAL_ASSESSMENT_STATUSES.ASSIGNED,
                started_at: null,
            },
        },
        { new: true, upsert: true, runValidators: true }
    );

    await customerCaseService.createEvent({
        customerCase,
        actor: user,
        eventType: CUSTOMER_CASE_EVENT_TYPES.TECHNICAL_ASSESSMENT_ASSIGNED,
        metadata: { inspector_staff_profile_id: toId(inspector._id), inspector_user_id: toId(inspector.user_id) },
        visibleToCustomer: false,
    });
    await recordAudit({
        user,
        action: AUDIT_ACTIONS.CUSTOMER_CASE_TECHNICAL_ASSESSMENT_ASSIGNED,
        customerCase,
        before: previous,
        after: assessment,
        context: auditContext,
    });
    await customerCaseNotificationService.notifyUsers({
        userIds: [inspector.user_id],
        type: NOTIFICATION_TYPES.CUSTOMER_CASE_TECHNICAL_ASSESSMENT_ASSIGNED,
        title: `Technical assessment assigned: ${customerCase.case_code}`,
        message: 'A customer case requires your technical assessment.',
        relatedType: NOTIFICATION_RELATED_TYPES.CUSTOMER_CASE,
        relatedId: customerCase._id,
        metadata: { case_code: customerCase.case_code },
    });

    return customerCaseService.getCaseDetail(customerCase);
};

const assertInspectorAssignment = (user, staffContext, customerCase, assessment) => {
    customerCaseService.assertStaffGarageAccess(staffContext, customerCase);
    if (!staffContext?.is_admin && toId(assessment.inspector_user_id) !== toId(user._id)) {
        throw new AppError('Technical assessment is not assigned to you', 403, 'CUSTOMER_CASE_ASSESSMENT_ASSIGNMENT_REQUIRED');
    }
};

const startTechnicalAssessment = async (user, staffContext, caseId, auditContext = {}) => {
    const [customerCase, assessment] = await Promise.all([
        customerCaseService.getCaseDocument(caseId),
        getAssessment(caseId),
    ]);
    customerCaseService.assertCaseOpen(customerCase);
    assertInspectorAssignment(user, staffContext, customerCase, assessment);
    if (assessment.status === CUSTOMER_CASE_TECHNICAL_ASSESSMENT_STATUSES.SUBMITTED) {
        throw new AppError('Technical assessment was already submitted', 409, 'CUSTOMER_CASE_ASSESSMENT_ALREADY_SUBMITTED');
    }
    if (assessment.status === CUSTOMER_CASE_TECHNICAL_ASSESSMENT_STATUSES.ASSIGNED) {
        const before = assessment.toObject();
        assessment.status = CUSTOMER_CASE_TECHNICAL_ASSESSMENT_STATUSES.IN_PROGRESS;
        assessment.started_at = new Date();
        await assessment.save();
        await customerCaseService.createEvent({
            customerCase,
            actor: user,
            eventType: CUSTOMER_CASE_EVENT_TYPES.TECHNICAL_ASSESSMENT_STARTED,
            visibleToCustomer: false,
        });
        await recordAudit({
            user,
            action: AUDIT_ACTIONS.CUSTOMER_CASE_TECHNICAL_ASSESSMENT_STARTED,
            customerCase,
            before,
            after: assessment,
            context: auditContext,
        });
    }
    return customerCaseService.getCaseDetail(customerCase);
};

const getAssignedTechnicalAssessment = async (user, staffContext, caseId) => {
    const [customerCase, assessment] = await Promise.all([
        customerCaseService.getCaseDocument(caseId),
        getAssessment(caseId),
    ]);
    assertInspectorAssignment(user, staffContext, customerCase, assessment);
    return customerCaseService.getCaseDetail(customerCase);
};

const submitTechnicalAssessment = async (user, staffContext, caseId, payload, auditContext = {}) => {
    const [customerCase, assessment] = await Promise.all([
        customerCaseService.getCaseDocument(caseId),
        getAssessment(caseId),
    ]);
    customerCaseService.assertCaseOpen(customerCase);
    assertInspectorAssignment(user, staffContext, customerCase, assessment);
    if (assessment.status === CUSTOMER_CASE_TECHNICAL_ASSESSMENT_STATUSES.SUBMITTED) {
        throw new AppError('Technical assessment was already submitted', 409, 'CUSTOMER_CASE_ASSESSMENT_ALREADY_SUBMITTED');
    }
    await customerCaseService.validateEvidenceUploads({ actorId: user._id, uploadIds: payload.upload_ids, caseId });
    const before = assessment.toObject();
    assessment.status = CUSTOMER_CASE_TECHNICAL_ASSESSMENT_STATUSES.SUBMITTED;
    assessment.started_at = assessment.started_at || new Date();
    assessment.findings = payload.findings;
    assessment.root_cause = payload.root_cause;
    assessment.severity = payload.severity;
    assessment.recommended_resolution = payload.recommended_resolution;
    assessment.upload_ids = payload.upload_ids;
    assessment.submitted_at = new Date();
    await assessment.save();
    await customerCaseService.linkEvidenceUploads({ caseId, uploadIds: payload.upload_ids });
    await customerCaseService.createEvent({
        customerCase,
        actor: user,
        eventType: CUSTOMER_CASE_EVENT_TYPES.TECHNICAL_ASSESSMENT_SUBMITTED,
        metadata: { severity: assessment.severity },
    });
    await recordAudit({
        user,
        action: AUDIT_ACTIONS.CUSTOMER_CASE_TECHNICAL_ASSESSMENT_SUBMITTED,
        customerCase,
        before,
        after: assessment,
        context: auditContext,
    });
    await notifyCaseActors(customerCase, {
        type: NOTIFICATION_TYPES.CUSTOMER_CASE_TECHNICAL_ASSESSMENT_SUBMITTED,
        title: `Technical assessment completed: ${customerCase.case_code}`,
        message: 'The technical assessment is available for resolution review.',
        excludeUserId: user._id,
    });
    return customerCaseService.getCaseDetail(customerCase);
};

const validateResolutionActions = (customerCase, actions) => {
    if (!actions.length) {
        throw new AppError('At least one resolution action is required', 400, 'CUSTOMER_CASE_RESOLUTION_ACTION_REQUIRED');
    }
    const actionTypes = actions.map((action) => action.action_type);
    if (new Set(actionTypes).size !== actionTypes.length) {
        throw new AppError('Resolution action types must be unique', 400, 'CUSTOMER_CASE_RESOLUTION_ACTION_DUPLICATE');
    }
    if (actionTypes.includes(CUSTOMER_CASE_RESOLUTION_ACTION_TYPES.NO_COMPENSATION) && actions.length > 1) {
        throw new AppError('No-compensation cannot be combined with another action', 400, 'CUSTOMER_CASE_RESOLUTION_ACTION_CONFLICT');
    }
    for (const action of actions) {
        if (action.action_type === CUSTOMER_CASE_RESOLUTION_ACTION_TYPES.REFUND && (!action.amount || action.amount <= 0)) {
            throw new AppError('Refund amount is required', 400, 'CUSTOMER_CASE_REFUND_AMOUNT_REQUIRED');
        }
        if (action.action_type === CUSTOMER_CASE_RESOLUTION_ACTION_TYPES.REFUND && !action.refund_method) {
            throw new AppError('Refund method is required', 400, 'CUSTOMER_CASE_REFUND_METHOD_REQUIRED');
        }
        if (action.action_type === CUSTOMER_CASE_RESOLUTION_ACTION_TYPES.VOUCHER) {
            if (!customerCase.customer_id) {
                throw new AppError('Account-bound vouchers are unavailable for walk-in reporters', 409, 'WALK_IN_CASE_VOUCHER_UNAVAILABLE');
            }
            if (!CUSTOMER_VOUCHER_TYPE_VALUES.includes(action.voucher_type) || !action.expires_at) {
                throw new AppError('Voucher configuration is incomplete', 400, 'CUSTOMER_CASE_VOUCHER_CONFIGURATION_INVALID');
            }
        }
        if (action.action_type === CUSTOMER_CASE_RESOLUTION_ACTION_TYPES.REWORK && !action.rework_start_time) {
            throw new AppError('Rework start time is required', 400, 'CUSTOMER_CASE_REWORK_START_TIME_REQUIRED');
        }
    }
};

const proposeResolution = async (user, caseId, payload, auditContext = {}) => {
    assertAdmin(user);
    const customerCase = await customerCaseService.getCaseDocument(caseId);
    customerCaseService.assertCaseOpen(customerCase);
    if (TECHNICAL_CATEGORIES.has(customerCase.category)) {
        const assessment = await CustomerCaseTechnicalAssessment.findOne({ case_id: customerCase._id });
        if (!assessment || assessment.status !== CUSTOMER_CASE_TECHNICAL_ASSESSMENT_STATUSES.SUBMITTED) {
            throw new AppError('A submitted technical assessment is required', 409, 'CUSTOMER_CASE_ASSESSMENT_REQUIRED');
        }
    }
    validateResolutionActions(customerCase, payload.actions);
    const latest = await CustomerCaseResolution.findOne({ case_id: customerCase._id }).sort({ version: -1 });
    if (latest?.status === CUSTOMER_CASE_RESOLUTION_STATUSES.CUSTOMER_ACCEPTED) {
        throw new AppError('Accepted resolution must be applied before another proposal', 409, 'CUSTOMER_CASE_RESOLUTION_PENDING_APPLICATION');
    }
    if (latest?.status === CUSTOMER_CASE_RESOLUTION_STATUSES.PROPOSED) {
        latest.status = CUSTOMER_CASE_RESOLUTION_STATUSES.SUPERSEDED;
        await latest.save();
    }
    const resolution = await CustomerCaseResolution.create({
        case_id: customerCase._id,
        version: (latest?.version || 0) + 1,
        status: CUSTOMER_CASE_RESOLUTION_STATUSES.PROPOSED,
        summary: payload.summary,
        actions: payload.actions,
        proposed_by_id: user._id,
        proposed_at: new Date(),
    });
    await customerCaseService.createEvent({
        customerCase,
        actor: user,
        eventType: CUSTOMER_CASE_EVENT_TYPES.RESOLUTION_PROPOSED,
        metadata: { resolution_id: toId(resolution._id), version: resolution.version, action_types: payload.actions.map((item) => item.action_type) },
    });
    await recordAudit({
        user,
        action: AUDIT_ACTIONS.CUSTOMER_CASE_RESOLUTION_PROPOSED,
        customerCase,
        after: resolution,
        context: auditContext,
    });
    await customerCaseNotificationService.notifyCustomerCaseUpdate(customerCase, {
        actorId: user._id,
        type: NOTIFICATION_TYPES.CUSTOMER_CASE_RESOLUTION_PROPOSED,
        title: `Resolution proposed for ${customerCase.case_code}`,
        message: 'Please review and accept or reject the proposed resolution.',
    });
    return customerCaseService.getCaseDetail(customerCase, { customerView: false });
};

const respondResolution = async (user, caseId, payload, auditContext = {}) => {
    const customerCase = await customerCaseService.getCaseDocument(caseId);
    customerCaseService.assertCustomerOwnsCase(user, customerCase);
    const resolution = await CustomerCaseResolution.findById(payload.resolution_id);
    if (!resolution || toId(resolution.case_id) !== toId(customerCase._id)) {
        throw new AppError('Resolution proposal not found', 404, 'CUSTOMER_CASE_RESOLUTION_NOT_FOUND');
    }
    if (resolution.status !== CUSTOMER_CASE_RESOLUTION_STATUSES.PROPOSED) {
        throw new AppError('Resolution proposal is no longer awaiting response', 409, 'CUSTOMER_CASE_RESOLUTION_NOT_PENDING');
    }
    const before = resolution.toObject();
    resolution.status = payload.accepted
        ? CUSTOMER_CASE_RESOLUTION_STATUSES.CUSTOMER_ACCEPTED
        : CUSTOMER_CASE_RESOLUTION_STATUSES.CUSTOMER_REJECTED;
    resolution.customer_responded_by_id = user._id;
    resolution.customer_response_note = normalizeText(payload.note);
    resolution.customer_responded_at = new Date();
    await resolution.save();
    await customerCaseService.createEvent({
        customerCase,
        actor: user,
        eventType: payload.accepted ? CUSTOMER_CASE_EVENT_TYPES.RESOLUTION_ACCEPTED : CUSTOMER_CASE_EVENT_TYPES.RESOLUTION_REJECTED,
        metadata: { resolution_id: toId(resolution._id), version: resolution.version, note: resolution.customer_response_note },
    });
    await recordAudit({
        user,
        action: AUDIT_ACTIONS.CUSTOMER_CASE_RESOLUTION_RESPONDED,
        customerCase,
        before,
        after: resolution,
        context: auditContext,
    });
    await notifyCaseActors(customerCase, {
        type: NOTIFICATION_TYPES.CUSTOMER_CASE_RESOLUTION_RESPONDED,
        title: `Customer responded: ${customerCase.case_code}`,
        message: payload.accepted ? 'The customer accepted the resolution.' : 'The customer rejected the resolution.',
        excludeUserId: user._id,
    });
    return customerCaseService.getCaseDetail(customerCase, { customerView: true });
};

const recordWalkInResolutionResponse = async (user, staffContext, caseId, payload, auditContext = {}) => {
    const session = await mongoose.startSession();
    let customerCase;
    let resolution;
    let before;
    try {
        await session.withTransaction(async () => {
            customerCase = await customerCaseService.getCaseDocument(caseId, { session });
            if (!customerCase.is_walk_in_case) {
                throw new AppError('This operation is only available for walk-in cases', 409, 'CUSTOMER_CASE_NOT_WALK_IN');
            }
            customerCaseService.assertAssignedHandler(user, staffContext, customerCase);
            [resolution] = await Promise.all([
                CustomerCaseResolution.findById(payload.resolution_id).session(session),
            ]);
            const booking = await Booking.findById(customerCase.booking_id).session(session);
            if (!resolution || toId(resolution.case_id) !== toId(customerCase._id)) {
                throw new AppError('Resolution proposal not found', 404, 'CUSTOMER_CASE_RESOLUTION_NOT_FOUND');
            }
            if (resolution.status !== CUSTOMER_CASE_RESOLUTION_STATUSES.PROPOSED) {
                throw new AppError('Resolution proposal is no longer awaiting response', 409, 'CUSTOMER_CASE_RESOLUTION_NOT_PENDING');
            }
            const phone = normalizePhone(booking?.normalized_guest_phone || booking?.guest_phone);
            const challenge = await phoneVerificationService.getVerifiedChallenge({
                phone,
                purpose: PHONE_VERIFICATION_PURPOSES.WALK_IN_CUSTOMER_CASE,
                verificationToken: payload.verification_token,
                userId: user._id,
                session,
            });
            before = resolution.toObject();
            resolution.status = payload.accepted
                ? CUSTOMER_CASE_RESOLUTION_STATUSES.CUSTOMER_ACCEPTED
                : CUSTOMER_CASE_RESOLUTION_STATUSES.CUSTOMER_REJECTED;
            resolution.customer_responded_by_id = user._id;
            resolution.customer_response_note = normalizeText(payload.note);
            resolution.customer_responded_at = new Date();
            await resolution.save({ session });
            await phoneVerificationService.consumeVerifiedChallenge(challenge._id, session);
            await customerCaseService.createEvent({
                customerCase,
                actor: user,
                eventType: payload.accepted ? CUSTOMER_CASE_EVENT_TYPES.RESOLUTION_ACCEPTED : CUSTOMER_CASE_EVENT_TYPES.RESOLUTION_REJECTED,
                metadata: {
                    resolution_id: toId(resolution._id),
                    version: resolution.version,
                    note: resolution.customer_response_note,
                    walk_in_phone_verified: true,
                    response_recorded_by_staff: true,
                },
                session,
            });
        });
    } finally {
        await session.endSession();
    }
    await recordAudit({
        user,
        action: AUDIT_ACTIONS.CUSTOMER_CASE_RESOLUTION_RESPONDED,
        customerCase,
        before,
        after: resolution,
        context: auditContext,
        metadata: { walk_in_phone_verified: true },
    });
    await notifyCaseActors(customerCase, {
        type: NOTIFICATION_TYPES.CUSTOMER_CASE_RESOLUTION_RESPONDED,
        title: `Walk-in customer responded: ${customerCase.case_code}`,
        message: payload.accepted ? 'The verified walk-in customer accepted the resolution.' : 'The verified walk-in customer rejected the resolution.',
        excludeUserId: user._id,
    });
    return customerCaseService.getCaseDetail(customerCase);
};

const applyResolution = async (user, caseId, resolutionId, auditContext = {}) => {
    assertAdmin(user);
    const customerCase = await customerCaseService.getCaseDocument(caseId);
    const resolution = await CustomerCaseResolution.findById(resolutionId);
    if (!resolution || toId(resolution.case_id) !== toId(customerCase._id)) {
        throw new AppError('Resolution proposal not found', 404, 'CUSTOMER_CASE_RESOLUTION_NOT_FOUND');
    }
    if (resolution.status === CUSTOMER_CASE_RESOLUTION_STATUSES.APPLIED) {
        return customerCaseService.getCaseDetail(customerCase);
    }
    if (![CUSTOMER_CASE_RESOLUTION_STATUSES.CUSTOMER_ACCEPTED, CUSTOMER_CASE_RESOLUTION_STATUSES.FAILED].includes(resolution.status)) {
        throw new AppError('Customer acceptance is required before applying resolution', 409, 'CUSTOMER_CASE_RESOLUTION_ACCEPTANCE_REQUIRED');
    }
    const booking = await Booking.findById(customerCase.booking_id);
    if (!booking) throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');

    const before = resolution.toObject();
    try {
        for (const action of resolution.actions) {
            if (action.action_type === CUSTOMER_CASE_RESOLUTION_ACTION_TYPES.REFUND) {
                if (resolution.refund_ids.length > 0) continue;
                if (booking.payment_status !== BOOKING_PAYMENT_STATUS.PAID) {
                    throw new AppError('Only paid bookings can be refunded', 409, 'CUSTOMER_CASE_REFUND_PAYMENT_REQUIRED');
                }
                const existingRefund = await CustomerCaseRefund.findOne({ resolution_id: resolution._id });
                if (existingRefund) {
                    resolution.refund_ids.push(existingRefund._id);
                    continue;
                }
                const activeRefundTotal = await CustomerCaseRefund.aggregate([
                    { $match: { booking_id: booking._id, status: { $in: [CUSTOMER_CASE_REFUND_STATUSES.APPROVED, CUSTOMER_CASE_REFUND_STATUSES.PROCESSING, CUSTOMER_CASE_REFUND_STATUSES.COMPLETED] } } },
                    { $group: { _id: null, total: { $sum: '$amount' } } },
                ]);
                if ((activeRefundTotal[0]?.total || 0) + action.amount > booking.final_price) {
                    throw new AppError('Refund total exceeds the paid booking amount', 409, 'CUSTOMER_CASE_REFUND_EXCEEDS_BOOKING_AMOUNT');
                }
                const refund = await CustomerCaseRefund.create({
                    case_id: customerCase._id,
                    resolution_id: resolution._id,
                    booking_id: booking._id,
                    amount: action.amount,
                    method: action.refund_method,
                    status: CUSTOMER_CASE_REFUND_STATUSES.APPROVED,
                    approved_by_id: user._id,
                    approved_at: new Date(),
                    note: action.note,
                });
                resolution.refund_ids.push(refund._id);
            }
            if (action.action_type === CUSTOMER_CASE_RESOLUTION_ACTION_TYPES.VOUCHER) {
                if (resolution.voucher_ids.length > 0) continue;
                const voucher = await customerVoucherService.issueCompensationVoucher({
                    user,
                    customerId: customerCase.customer_id,
                    garageId: customerCase.garage_id,
                    bookingId: customerCase.booking_id,
                    customerCaseId: customerCase._id,
                    customerCaseResolutionId: resolution._id,
                    voucherType: action.voucher_type,
                    value: action.value,
                    maxDiscountAmount: action.max_discount_amount,
                    minOrderAmount: action.min_order_amount,
                    servicePackageId: action.service_package_id,
                    expiresAt: action.expires_at,
                    note: action.note,
                });
                resolution.voucher_ids.push(voucher._id);
            }
            if (action.action_type === CUSTOMER_CASE_RESOLUTION_ACTION_TYPES.REWORK) {
                if (resolution.rework_booking_ids.length > 0) continue;
                const rework = await bookingService.createReworkBooking({
                    user,
                    originalBooking: booking,
                    customerCaseId: customerCase._id,
                    resolutionId: resolution._id,
                    servicePackageId: action.service_package_id || booking.service_package_id,
                    startTime: action.rework_start_time,
                    note: action.note,
                });
                resolution.rework_booking_ids.push(rework._id || rework.id);
            }
        }
        resolution.status = CUSTOMER_CASE_RESOLUTION_STATUSES.APPLIED;
        resolution.applied_by_id = user._id;
        resolution.applied_at = new Date();
        resolution.failure_reason = null;
        await resolution.save();
    } catch (error) {
        resolution.status = CUSTOMER_CASE_RESOLUTION_STATUSES.FAILED;
        resolution.failure_reason = error.message;
        await resolution.save();
        throw error;
    }
    await customerCaseService.createEvent({
        customerCase,
        actor: user,
        eventType: CUSTOMER_CASE_EVENT_TYPES.RESOLUTION_APPLIED,
        metadata: {
            resolution_id: toId(resolution._id),
            refund_ids: resolution.refund_ids.map(toId),
            voucher_ids: resolution.voucher_ids.map(toId),
            rework_booking_ids: resolution.rework_booking_ids.map(toId),
        },
    });
    await recordAudit({
        user,
        action: AUDIT_ACTIONS.CUSTOMER_CASE_RESOLUTION_APPLIED,
        customerCase,
        before,
        after: resolution,
        context: auditContext,
    });
    await customerCaseNotificationService.notifyCustomerCaseUpdate(customerCase, {
        actorId: user._id,
        type: NOTIFICATION_TYPES.CUSTOMER_CASE_RESOLUTION_APPLIED,
        title: `Resolution applied for ${customerCase.case_code}`,
        message: 'The accepted compensation actions have been created and can be tracked in this case.',
    });
    return customerCaseService.getCaseDetail(customerCase);
};

const updateRefundStatus = async (user, caseId, refundId, payload, auditContext = {}) => {
    assertAdmin(user);
    const customerCase = await customerCaseService.getCaseDocument(caseId);
    const refund = await CustomerCaseRefund.findOne({ _id: refundId, case_id: customerCase._id });
    if (!refund) throw new AppError('Refund record not found', 404, 'CUSTOMER_CASE_REFUND_NOT_FOUND');
    if (refund.status === CUSTOMER_CASE_REFUND_STATUSES.COMPLETED) {
        throw new AppError('Completed refund cannot be changed', 409, 'CUSTOMER_CASE_REFUND_ALREADY_COMPLETED');
    }
    if (payload.status === CUSTOMER_CASE_REFUND_STATUSES.COMPLETED && !payload.transaction_reference) {
        throw new AppError('Transaction reference is required for a completed refund', 400, 'CUSTOMER_CASE_REFUND_REFERENCE_REQUIRED');
    }
    if (payload.status === CUSTOMER_CASE_REFUND_STATUSES.FAILED && !payload.failure_reason) {
        throw new AppError('Failure reason is required', 400, 'CUSTOMER_CASE_REFUND_FAILURE_REASON_REQUIRED');
    }
    const before = refund.toObject();
    refund.status = payload.status;
    refund.transaction_reference = normalizeText(payload.transaction_reference);
    refund.note = normalizeText(payload.note);
    refund.failure_reason = normalizeText(payload.failure_reason);
    refund.processed_by_id = user._id;
    refund.processed_at = new Date();
    await refund.save();
    await customerCaseService.createEvent({
        customerCase,
        actor: user,
        eventType: CUSTOMER_CASE_EVENT_TYPES.REFUND_STATUS_CHANGED,
        metadata: { refund_id: toId(refund._id), from_status: before.status, to_status: refund.status, transaction_reference: refund.transaction_reference },
    });
    await recordAudit({ user, action: AUDIT_ACTIONS.CUSTOMER_CASE_REFUND_STATUS_CHANGED, customerCase, before, after: refund, context: auditContext });
    await notifyCaseActors(customerCase, {
        type: NOTIFICATION_TYPES.CUSTOMER_CASE_REFUND_UPDATED,
        title: `Refund updated: ${customerCase.case_code}`,
        message: refund.status === CUSTOMER_CASE_REFUND_STATUSES.COMPLETED
            ? 'The approved refund has been completed.'
            : `The refund status changed to ${refund.status}.`,
        excludeUserId: user._id,
    });
    return customerCaseService.getCaseDetail(customerCase);
};

const getSlaState = (customerCase, now = new Date()) => {
    if (customerCase.first_response_breached_at || customerCase.resolution_breached_at) return CUSTOMER_CASE_SLA_STATES.BREACHED;
    if ([CUSTOMER_CASE_STATUSES.RESOLVED, CUSTOMER_CASE_STATUSES.CLOSED].includes(customerCase.status)) return CUSTOMER_CASE_SLA_STATES.ON_TRACK;
    const firstOverdue = !customerCase.acknowledged_at && customerCase.first_response_due_at <= now;
    const resolutionOverdue = customerCase.resolution_due_at <= now;
    if (firstOverdue && resolutionOverdue) return CUSTOMER_CASE_SLA_STATES.BREACHED;
    if (resolutionOverdue) return CUSTOMER_CASE_SLA_STATES.RESOLUTION_OVERDUE;
    if (firstOverdue) return CUSTOMER_CASE_SLA_STATES.FIRST_RESPONSE_OVERDUE;
    return CUSTOMER_CASE_SLA_STATES.ON_TRACK;
};

const getSlaDashboard = async (staffContext, query = {}) => {
    const filter = {};
    if (!staffContext?.is_admin) filter.garage_id = staffContext.garage_id;
    else if (query.garage_id) filter.garage_id = query.garage_id;
    const cases = await CustomerCase.find(filter).sort({ priority_rank: -1, resolution_due_at: 1 }).limit(query.limit || 100);
    const rows = cases.map((item) => {
        if (!item.first_response_due_at || !item.resolution_due_at) {
            const fallbackSla = customerCaseService.getSlaDeadlines(item.priority, item.created_at || new Date());
            if (!item.first_response_due_at) item.first_response_due_at = fallbackSla.first_response_due_at;
            if (!item.resolution_due_at) item.resolution_due_at = fallbackSla.resolution_due_at;
        }
        return ({
        id: toId(item._id),
        case_code: item.case_code,
        garage_id: toId(item.garage_id),
        status: item.status,
        priority: item.priority,
        sla_state: getSlaState(item),
        first_response_due_at: item.first_response_due_at,
        resolution_due_at: item.resolution_due_at,
        escalation_level: item.escalation_level || 0,
        assigned_to_id: toId(item.assigned_to_id),
        });
    });
    const counts = rows.reduce((result, row) => {
        result.total += 1;
        result.by_sla_state[row.sla_state] = (result.by_sla_state[row.sla_state] || 0) + 1;
        result.by_priority[row.priority] = (result.by_priority[row.priority] || 0) + 1;
        result.by_status[row.status] = (result.by_status[row.status] || 0) + 1;
        return result;
    }, { total: 0, by_sla_state: {}, by_priority: {}, by_status: {} });
    return { summary: counts, cases: rows };
};

const processDueSlaEscalations = async ({ limit = 50 } = {}) => {
    const now = new Date();
    const missingSlaCases = await CustomerCase.find({
        status: { $in: CUSTOMER_CASE_OPEN_STATUSES },
        $or: [
            { first_response_due_at: null },
            { first_response_due_at: { $exists: false } },
            { resolution_due_at: null },
            { resolution_due_at: { $exists: false } },
        ],
    }).limit(limit);
    for (const customerCase of missingSlaCases) {
        const sla = customerCaseService.getSlaDeadlines(
            customerCase.priority,
            customerCase.created_at || now
        );
        customerCase.first_response_due_at = customerCase.first_response_due_at || sla.first_response_due_at;
        customerCase.resolution_due_at = customerCase.resolution_due_at || sla.resolution_due_at;
        await customerCase.save();
    }
    const dueCases = await CustomerCase.find({
        status: { $in: CUSTOMER_CASE_OPEN_STATUSES },
        escalation_level: 0,
        $or: [
            { acknowledged_at: null, first_response_due_at: { $lte: now } },
            { resolution_due_at: { $lte: now } },
        ],
    }).sort({ priority_rank: -1, resolution_due_at: 1 }).limit(limit);
    let escalated = 0;
    for (const customerCase of dueCases) {
        const firstResponseBreached = !customerCase.acknowledged_at && customerCase.first_response_due_at <= now;
        const resolutionBreached = customerCase.resolution_due_at <= now;
        if (firstResponseBreached) customerCase.first_response_breached_at = customerCase.first_response_breached_at || now;
        if (resolutionBreached) customerCase.resolution_breached_at = customerCase.resolution_breached_at || now;
        customerCase.escalation_level = 1;
        customerCase.escalated_at = now;
        await customerCase.save();
        await customerCaseService.createEvent({
            customerCase,
            actor: null,
            eventType: CUSTOMER_CASE_EVENT_TYPES.SLA_ESCALATED,
            metadata: { first_response_breached: firstResponseBreached, resolution_breached: resolutionBreached, escalation_level: 1 },
            visibleToCustomer: false,
        });
        await recordAudit({
            user: null,
            action: AUDIT_ACTIONS.CUSTOMER_CASE_SLA_ESCALATED,
            customerCase,
            before: { escalation_level: 0 },
            after: {
                escalation_level: customerCase.escalation_level,
                first_response_breached_at: customerCase.first_response_breached_at,
                resolution_breached_at: customerCase.resolution_breached_at,
            },
            metadata: { scheduler: true },
        });
        await notifyCaseActors(customerCase, {
            type: NOTIFICATION_TYPES.CUSTOMER_CASE_SLA_ESCALATED,
            title: `SLA escalation: ${customerCase.case_code}`,
            message: 'This customer case exceeded an SLA deadline and requires immediate attention.',
        });
        escalated += 1;
    }
    return { processed: dueCases.length, escalated };
};

const reopenCase = async (user, staffContext, caseId, payload, auditContext = {}) => {
    const customerCase = await customerCaseService.getCaseDocument(caseId);
    if (user.role === USER_ROLES.CUSTOMER) customerCaseService.assertCustomerOwnsCase(user, customerCase);
    else if (user.role === USER_ROLES.ADMIN) {
        // Admin is cross-garage by design; staffContext is optional on admin-only routes.
    }
    else throw new AppError('Only the owning customer or admin can reopen a case', 403, 'CUSTOMER_CASE_REOPEN_FORBIDDEN');
    if (![CUSTOMER_CASE_STATUSES.RESOLVED, CUSTOMER_CASE_STATUSES.CLOSED].includes(customerCase.status)) {
        throw new AppError('Only a resolved or closed case can be reopened', 409, 'CUSTOMER_CASE_REOPEN_STATUS_INVALID');
    }
    const reopenDays = Number(process.env.CUSTOMER_CASE_REOPEN_WINDOW_DAYS) || 7;
    const resolvedAt = customerCase.closed_at || customerCase.resolved_at;
    if (user.role !== USER_ROLES.ADMIN && (!resolvedAt || Date.now() - resolvedAt.getTime() > reopenDays * 86400000)) {
        throw new AppError('Customer case reopen window has expired', 409, 'CUSTOMER_CASE_REOPEN_WINDOW_EXPIRED');
    }
    const duplicate = await CustomerCase.exists({
        _id: { $ne: customerCase._id },
        open_dedupe_key: `${toId(customerCase.booking_id)}:${customerCase.category}`,
        status: { $in: CUSTOMER_CASE_OPEN_STATUSES },
    });
    if (duplicate) throw new AppError('Another open case already covers this issue', 409, 'CUSTOMER_CASE_DUPLICATE_OPEN');
    const before = customerCase.toObject();
    const previousStatus = customerCase.status;
    const sla = customerCaseService.getSlaDeadlines(customerCase.priority);
    customerCase.status = CUSTOMER_CASE_STATUSES.INVESTIGATING;
    customerCase.open_dedupe_key = `${toId(customerCase.booking_id)}:${customerCase.category}`;
    customerCase.reopen_count = (customerCase.reopen_count || 0) + 1;
    customerCase.last_reopened_at = new Date();
    customerCase.last_reopened_by_id = user._id;
    customerCase.last_reopen_reason = payload.reason;
    customerCase.resolution_due_at = sla.resolution_due_at;
    customerCase.resolution_breached_at = null;
    customerCase.escalation_level = 0;
    customerCase.escalated_at = null;
    customerCase.closed_at = null;
    customerCase.closed_by_id = null;
    customerCase.liability_status = 'UNDETERMINED';
    customerCase.conclusion = null;
    customerCase.resolution_summary = null;
    customerCase.resolved_at = null;
    customerCase.resolved_by_id = null;
    await customerCase.save();
    await customerCaseService.createEvent({
        customerCase,
        actor: user,
        eventType: CUSTOMER_CASE_EVENT_TYPES.REOPENED,
        fromStatus: previousStatus,
        toStatus: customerCase.status,
        metadata: {
            reason: payload.reason,
            reopen_count: customerCase.reopen_count,
            previous_conclusion: before.conclusion,
            previous_resolution_summary: before.resolution_summary,
            previous_liability_status: before.liability_status,
        },
    });
    await recordAudit({ user, action: AUDIT_ACTIONS.CUSTOMER_CASE_REOPENED, customerCase, before, after: customerCase, context: auditContext });
    await notifyCaseActors(customerCase, {
        type: NOTIFICATION_TYPES.CUSTOMER_CASE_REOPENED,
        title: `Case reopened: ${customerCase.case_code}`,
        message: 'The case was reopened for further investigation.',
        excludeUserId: user._id,
    });
    return customerCaseService.getCaseDetail(customerCase, { customerView: user.role === USER_ROLES.CUSTOMER });
};

const getVerifiedWalkInBooking = async (staffContext, bookingId) => {
    const booking = await Booking.findById(bookingId);
    if (!booking || !booking.is_walk_in) throw new AppError('Walk-in booking not found', 404, 'WALK_IN_BOOKING_NOT_FOUND');
    customerCaseService.assertStaffGarageAccess(staffContext, { garage_id: booking.garage_id });
    if (!booking.normalized_guest_phone) throw new AppError('Walk-in booking has no verified phone target', 409, 'WALK_IN_BOOKING_PHONE_REQUIRED');
    return booking;
};

const requestWalkInOtp = async (user, staffContext, payload, meta = {}) => {
    const booking = await getVerifiedWalkInBooking(staffContext, payload.booking_id);
    return phoneVerificationService.requestVerification({
        phone: booking.normalized_guest_phone,
        purpose: PHONE_VERIFICATION_PURPOSES.WALK_IN_CUSTOMER_CASE,
        userId: user._id,
        requestIp: meta.ip,
        userAgent: meta.userAgent,
    });
};

const verifyWalkInOtp = async (user, payload) => phoneVerificationService.verifyOtp({
    challengeId: payload.challenge_id,
    otp: payload.otp,
    userId: user._id,
});

const createWalkInCase = async (user, staffContext, payload, auditContext = {}) => {
    const session = await mongoose.startSession();
    let customerCase;
    try {
        await session.withTransaction(async () => {
            const booking = await Booking.findById(payload.booking_id).session(session);
            if (!booking || !booking.is_walk_in) throw new AppError('Walk-in booking not found', 404, 'WALK_IN_BOOKING_NOT_FOUND');
            customerCaseService.assertStaffGarageAccess(staffContext, { garage_id: booking.garage_id });
            if (booking.status !== BOOKING_STATUS.COMPLETED) throw new AppError('Walk-in service must be completed before reporting a handover issue', 409, 'WALK_IN_CASE_BOOKING_NOT_COMPLETED');
            if (payload.vehicle_received && booking.payment_status !== BOOKING_PAYMENT_STATUS.PAID) {
                throw new AppError('Booking payment is required before recording vehicle receipt', 409, 'HANDOVER_PAYMENT_REQUIRED');
            }
            const handover = await BookingHandover.findOne({ booking_id: booking._id }).session(session);
            if (!handover || ![BOOKING_HANDOVER_STATES.READY_FOR_CUSTOMER, BOOKING_HANDOVER_STATES.ON_HOLD, BOOKING_HANDOVER_STATES.RELEASED].includes(handover.state)) {
                throw new AppError('Walk-in handover is not ready for issue reporting', 409, 'CUSTOMER_CASE_HANDOVER_NOT_READY');
            }
            const phone = normalizePhone(booking.normalized_guest_phone || booking.guest_phone);
            const challenge = await phoneVerificationService.getVerifiedChallenge({
                phone,
                purpose: PHONE_VERIFICATION_PURPOSES.WALK_IN_CUSTOMER_CASE,
                verificationToken: payload.verification_token,
                userId: user._id,
                session,
            });
            const duplicate = await CustomerCase.exists({
                booking_id: booking._id,
                category: payload.category,
                status: { $in: CUSTOMER_CASE_OPEN_STATUSES },
            }).session(session);
            if (duplicate) throw new AppError('An open case already exists for this issue category', 409, 'CUSTOMER_CASE_DUPLICATE_OPEN');
            const uploads = await customerCaseService.validateEvidenceUploads({ actorId: user._id, uploadIds: payload.upload_ids, session });
            const priority = getCustomerCasePriority(payload.category);
            const discoveredAt = payload.discovered_at ? new Date(payload.discovered_at) : new Date();
            if (booking.completed_at && discoveredAt < new Date(booking.completed_at)) {
                throw new AppError('Issue discovery time cannot be before service completion', 409, 'CUSTOMER_CASE_DISCOVERY_TIME_INVALID');
            }
            const source = handover.state === BOOKING_HANDOVER_STATES.RELEASED ? CUSTOMER_CASE_SOURCES.AFTER_HANDOVER : CUSTOMER_CASE_SOURCES.HANDOVER;
            const sla = customerCaseService.getSlaDeadlines(priority);
            [customerCase] = await CustomerCase.create([{
                case_code: customerCaseService.buildCaseCode(),
                booking_id: booking._id,
                handover_id: handover._id,
                garage_id: booking.garage_id,
                customer_id: null,
                vehicle_id: null,
                is_walk_in_case: true,
                reporter_name: booking.guest_name,
                reporter_phone: phone,
                created_by_staff_id: user._id,
                phone_verified_at: challenge.verified_at,
                category: payload.category,
                priority,
                priority_rank: getCustomerCasePriorityRank(priority),
                ...sla,
                open_dedupe_key: `${toId(booking._id)}:${payload.category}`,
                source,
                description: payload.description,
                desired_resolution: normalizeText(payload.desired_resolution),
                discovered_at: discoveredAt,
                vehicle_received: payload.vehicle_received || handover.state === BOOKING_HANDOVER_STATES.RELEASED,
                upload_ids: uploads.map((upload) => upload._id),
                booking_snapshot: customerCaseService.buildBookingSnapshot(booking),
                inspection_snapshot: handover.inspection_snapshot || {},
            }], { session });
            handover.customer_response = BOOKING_HANDOVER_RESPONSES.ISSUE_REPORTED;
            handover.customer_responded_at = new Date();
            handover.issue_case_ids.addToSet(customerCase._id);
            if (handover.state !== BOOKING_HANDOVER_STATES.RELEASED) handover.state = BOOKING_HANDOVER_STATES.ON_HOLD;
            await handover.save({ session });
            await customerCaseService.linkEvidenceUploads({ caseId: customerCase._id, uploadIds: payload.upload_ids, session });
            await customerCaseService.createEvent({
                customerCase,
                actor: user,
                eventType: CUSTOMER_CASE_EVENT_TYPES.SUBMITTED,
                metadata: { source, walk_in: true, phone_verified: true },
                session,
            });
            await phoneVerificationService.consumeVerifiedChallenge(challenge._id, session);
        });
    } finally {
        await session.endSession();
    }
    await recordAudit({ user, action: AUDIT_ACTIONS.CUSTOMER_CASE_SUBMITTED, customerCase, after: customerCase, context: auditContext, metadata: { walk_in: true } });
    await customerCaseNotificationService.notifyCaseSubmitted(customerCase, user._id);
    return customerCaseService.getCaseDetail(customerCase);
};

module.exports = {
    assignTechnicalAssessment,
    getAssignedTechnicalAssessment,
    startTechnicalAssessment,
    submitTechnicalAssessment,
    proposeResolution,
    respondResolution,
    recordWalkInResolutionResponse,
    applyResolution,
    updateRefundStatus,
    getSlaDashboard,
    processDueSlaEscalations,
    reopenCase,
    requestWalkInOtp,
    verifyWalkInOtp,
    createWalkInCase,
};
