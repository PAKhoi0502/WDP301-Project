const crypto = require('crypto');
const mongoose = require('mongoose');

const Booking = require('../bookings/booking.model');
const BookingHandover = require('../booking-handovers/bookingHandover.model');
const CustomerCase = require('./customerCase.model');
const CustomerCaseEvent = require('./customerCaseEvent.model');
const CustomerCaseMessage = require('./customerCaseMessage.model');
const CustomerCaseTechnicalAssessment = require('./customerCaseTechnicalAssessment.model');
const CustomerCaseResolution = require('./customerCaseResolution.model');
const CustomerCaseRefund = require('./customerCaseRefund.model');
const Upload = require('../uploads/upload.model');
const StaffProfile = require('../staff-profiles/staffProfile.model');
const User = require('../users/user.model');
const CustomerCaseMapper = require('./customerCase.mapper');
const customerCaseNotificationService = require('./customerCaseNotification.service');
const auditLogService = require('../audit-logs/auditLog.service');
const { AppError } = require('../../shared/utils/appError');
const { USER_ROLES } = require('../../shared/constants/roles.constant');
const { BOOKING_PAYMENT_STATUS } = require('../../shared/constants/booking.constant');
const {
    STAFF_TYPES,
    STAFF_EMPLOYMENT_STATUS,
} = require('../../shared/constants/staff.constant');
const {
    UPLOAD_PURPOSES,
    UPLOAD_RELATED_TYPES,
} = require('../../shared/constants/upload.constant');
const {
    NOTIFICATION_TYPES,
} = require('../../shared/constants/notification.constant');
const {
    BOOKING_HANDOVER_STATES,
    BOOKING_HANDOVER_RESPONSES,
    BOOKING_HANDOVER_RESPONSE_SOURCES,
    CUSTOMER_CASE_CATEGORIES,
    CUSTOMER_CASE_STATUSES,
    CUSTOMER_CASE_OPEN_STATUSES,
    CUSTOMER_CASE_SOURCES,
    CUSTOMER_CASE_EVENT_TYPES,
    CUSTOMER_CASE_LIMITS,
    getCustomerCasePriority,
    getCustomerCasePriorityRank,
} = require('../../shared/constants/customerCase.constant');
const { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } = require('../../shared/constants/audit.constant');

const normalizeText = (value) => typeof value === 'string' ? value.trim() || null : value || null;
const toId = (value) => value?._id?.toString?.() || value?.toString?.() || null;

const buildCaseCode = () => {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `CC-${date}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
};

const getSlaDeadlines = (priority, now = new Date()) => {
    const minutesByPriority = {
        NORMAL: [240, 4320],
        HIGH: [120, 1440],
        CRITICAL: [15, 240],
    };
    const [firstResponseMinutes, resolutionMinutes] = minutesByPriority[priority] || minutesByPriority.NORMAL;
    const readMinutes = (name, fallback) => {
        const value = Number(process.env[name]);
        return Number.isFinite(value) && value > 0 ? value : fallback;
    };
    const suffix = String(priority || 'NORMAL').toUpperCase();
    return {
        first_response_due_at: new Date(now.getTime() + readMinutes(`CUSTOMER_CASE_${suffix}_FIRST_RESPONSE_MINUTES`, firstResponseMinutes) * 60000),
        resolution_due_at: new Date(now.getTime() + readMinutes(`CUSTOMER_CASE_${suffix}_RESOLUTION_MINUTES`, resolutionMinutes) * 60000),
    };
};

const populateCaseQuery = (query) => query
    .populate('customer_id', 'full_name email phone role')
    .populate('assigned_to_id', 'full_name email phone role')
    .populate('upload_ids', 'url mime_type size purpose owner_id created_at');

const populateMessageQuery = (query) => query
    .populate('sender_id', 'full_name email phone role')
    .populate('upload_ids', 'url mime_type size purpose owner_id created_at');

const populateEventQuery = (query) => query.populate('actor_id', 'full_name email phone role');

const getCaseDocument = async (caseId, { session = null } = {}) => {
    let query = CustomerCase.findById(caseId);

    if (session) {
        query = query.session(session);
    }

    const customerCase = await query;

    if (!customerCase) {
        throw new AppError('Customer case not found', 404, 'CUSTOMER_CASE_NOT_FOUND');
    }

    return customerCase;
};

const assertCustomerOwnsCase = (user, customerCase) => {
    if (toId(customerCase.customer_id) !== toId(user._id)) {
        throw new AppError('Customer case not found', 404, 'CUSTOMER_CASE_NOT_FOUND');
    }
};

const assertStaffGarageAccess = (staffContext, customerCase) => {
    if (staffContext?.is_admin) {
        return;
    }

    if (!staffContext?.garage_id || staffContext.garage_id !== toId(customerCase.garage_id)) {
        throw new AppError('Customer case does not belong to your garage', 403, 'CUSTOMER_CASE_GARAGE_ACCESS_REQUIRED');
    }
};

const assertAssignedHandler = (user, staffContext, customerCase) => {
    assertStaffGarageAccess(staffContext, customerCase);

    if (staffContext?.is_admin) {
        return;
    }

    if (!customerCase.assigned_to_id || toId(customerCase.assigned_to_id) !== toId(user._id)) {
        throw new AppError('Customer case must be assigned to you', 403, 'CUSTOMER_CASE_ASSIGNMENT_REQUIRED');
    }
};

const assertCaseOpen = (customerCase) => {
    if (!CUSTOMER_CASE_OPEN_STATUSES.includes(customerCase.status)) {
        throw new AppError('Customer case is no longer open', 409, 'CUSTOMER_CASE_NOT_OPEN');
    }
};

const buildBookingSnapshot = (booking) => ({
    id: toId(booking._id),
    status: booking.status,
    garage_id: toId(booking.garage_id),
    customer_id: toId(booking.customer_id),
    vehicle_id: toId(booking.vehicle_id),
    service_package_id: toId(booking.service_package_id),
    license_plate: booking.license_plate,
    start_time: booking.start_time,
    service_started_at: booking.service_started_at,
    completed_at: booking.completed_at,
    payment_method: booking.payment_method,
    payment_status: booking.payment_status,
    final_price: booking.final_price,
    booking_items: (booking.booking_items || []).map((item) => ({
        item_key: item.item_key,
        service_package_id: toId(item.service_package_id),
        name_snapshot: item.name_snapshot,
        status: item.status,
        actual_started_at: item.actual_started_at,
        actual_completed_at: item.actual_completed_at,
        completed_by_staff_id: toId(item.completed_by_staff_id),
        assigned_execution_staff: (item.assigned_execution_staff || []).map((assignment) => ({
            staff_profile_id: toId(assignment.staff_profile_id),
            user_id: toId(assignment.user_id),
            assigned_at: assignment.assigned_at,
            released_at: assignment.released_at,
        })),
    })),
});

const validateEvidenceUploads = async ({ actorId, uploadIds = [], caseId = null, session = null }) => {
    if (uploadIds.length === 0) {
        return [];
    }

    let query = Upload.find({ _id: { $in: uploadIds } });

    if (session) {
        query = query.session(session);
    }

    const uploads = await query;

    if (uploads.length !== uploadIds.length) {
        throw new AppError('One or more evidence uploads were not found', 404, 'CUSTOMER_CASE_UPLOAD_NOT_FOUND');
    }

    for (const upload of uploads) {
        if (upload.purpose !== UPLOAD_PURPOSES.CUSTOMER_CASE_EVIDENCE) {
            throw new AppError('Upload purpose must be customer case evidence', 409, 'CUSTOMER_CASE_UPLOAD_PURPOSE_INVALID');
        }

        if (toId(upload.owner_id) !== toId(actorId)) {
            throw new AppError('Evidence upload must belong to the current user', 403, 'CUSTOMER_CASE_UPLOAD_OWNER_REQUIRED');
        }

        if (!upload.mime_type?.startsWith('image/')) {
            throw new AppError('Customer case evidence must be an image', 409, 'CUSTOMER_CASE_EVIDENCE_IMAGE_REQUIRED');
        }

        if (upload.related_id && toId(upload.related_id) !== toId(caseId)) {
            throw new AppError('Evidence upload already belongs to another resource', 409, 'CUSTOMER_CASE_UPLOAD_ALREADY_LINKED');
        }
    }

    return uploads;
};

const linkEvidenceUploads = async ({ caseId, uploadIds = [], session = null }) => {
    if (uploadIds.length === 0) {
        return;
    }

    await Upload.updateMany(
        { _id: { $in: uploadIds } },
        {
            $set: {
                related_type: UPLOAD_RELATED_TYPES.CUSTOMER_CASE,
                related_id: caseId,
            },
        },
        session ? { session } : undefined
    );
};

const createEvent = async ({ customerCase, actor, eventType, fromStatus = null, toStatus = null, metadata = {}, visibleToCustomer = true, session = null }) => {
    const [event] = await CustomerCaseEvent.create(
        [{
            case_id: customerCase._id,
            event_type: eventType,
            actor_id: actor?._id || null,
            actor_role: actor?.role || null,
            from_status: fromStatus,
            to_status: toStatus,
            visible_to_customer: visibleToCustomer,
            metadata,
        }],
        session ? { session } : undefined
    );

    return event;
};

const getCaseDetail = async (customerCase, { customerView = false } = {}) => {
    const populatedCase = await populateCaseQuery(CustomerCase.findById(customerCase._id));
    const eventFilter = { case_id: customerCase._id };

    if (customerView) {
        eventFilter.visible_to_customer = true;
    }

    const [messages, events, technicalAssessment, resolutions, refunds] = await Promise.all([
        populateMessageQuery(CustomerCaseMessage.find({ case_id: customerCase._id }).sort({ created_at: 1 })),
        populateEventQuery(CustomerCaseEvent.find(eventFilter).sort({ created_at: 1 })),
        CustomerCaseTechnicalAssessment.findOne({ case_id: customerCase._id })
            .populate('upload_ids', 'url mime_type size purpose owner_id created_at'),
        CustomerCaseResolution.find({ case_id: customerCase._id }).sort({ version: -1 }),
        CustomerCaseRefund.find({ case_id: customerCase._id }).sort({ created_at: -1 }),
    ]);

    return {
        case: CustomerCaseMapper.toCustomerCaseDto(populatedCase, { customerView }),
        messages: CustomerCaseMapper.toCustomerCaseMessageDtoList(messages),
        timeline: CustomerCaseMapper.toCustomerCaseEventDtoList(events),
        technical_assessment: CustomerCaseMapper.toTechnicalAssessmentDto(
            customerView && technicalAssessment?.status !== 'SUBMITTED' ? null : technicalAssessment,
            { customerView }
        ),
        resolutions: resolutions
            .filter((resolution) => !customerView || !['FAILED', 'SUPERSEDED'].includes(resolution.status))
            .map(CustomerCaseMapper.toResolutionDto),
        refunds: refunds.map(CustomerCaseMapper.toRefundDto),
    };
};

const createFromHandover = async (user, bookingId, payload = {}, auditContext = {}) => {
    const preflightBooking = await Booking.findById(bookingId);

    if (
        preflightBooking
        && preflightBooking.customer_id
        && toId(preflightBooking.customer_id) === toId(user._id)
        && preflightBooking.payment_status === BOOKING_PAYMENT_STATUS.PENDING
    ) {
        const paymentService = require('../payments/payment.service');
        await paymentService.resolvePendingPayosPaymentForHandoverIssue(
            user,
            preflightBooking._id
        );
    }

    const session = await mongoose.startSession();
    let createdCase;

    try {
        await session.withTransaction(async () => {
            const booking = await Booking.findById(bookingId).session(session);

            if (!booking || !booking.customer_id || toId(booking.customer_id) !== toId(user._id)) {
                throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
            }

            const handover = await BookingHandover.findOne({ booking_id: booking._id }).session(session);

            if (!handover || ![
                BOOKING_HANDOVER_STATES.READY_FOR_CUSTOMER,
                BOOKING_HANDOVER_STATES.ON_HOLD,
                BOOKING_HANDOVER_STATES.RELEASED,
            ].includes(handover.state)) {
                throw new AppError('Booking is not available for customer issue reporting', 409, 'CUSTOMER_CASE_HANDOVER_NOT_READY');
            }

            if (
                payload.vehicle_received
                && ![
                    BOOKING_PAYMENT_STATUS.PAID,
                    BOOKING_PAYMENT_STATUS.WAIVED,
                ].includes(booking.payment_status)
            ) {
                throw new AppError(
                    'Booking payment is required before recording vehicle receipt',
                    409,
                    'HANDOVER_PAYMENT_REQUIRED'
                );
            }

            const discoveredAt = payload.discovered_at ? new Date(payload.discovered_at) : new Date();

            if (booking.completed_at && discoveredAt < new Date(booking.completed_at)) {
                throw new AppError(
                    'Issue discovery time cannot be before service completion',
                    409,
                    'CUSTOMER_CASE_DISCOVERY_TIME_INVALID'
                );
            }

            const duplicate = await CustomerCase.exists({
                booking_id: booking._id,
                category: payload.category,
                status: { $in: CUSTOMER_CASE_OPEN_STATUSES },
            }).session(session);

            if (duplicate) {
                throw new AppError('An open case already exists for this booking and category', 409, 'CUSTOMER_CASE_DUPLICATE_OPEN');
            }

            await validateEvidenceUploads({
                actorId: user._id,
                uploadIds: payload.upload_ids || [],
                session,
            });

            const source = handover.state === BOOKING_HANDOVER_STATES.RELEASED
                ? CUSTOMER_CASE_SOURCES.AFTER_HANDOVER
                : CUSTOMER_CASE_SOURCES.HANDOVER;
            const priority = getCustomerCasePriority(payload.category);
            const slaDeadlines = getSlaDeadlines(priority);
            const [customerCase] = await CustomerCase.create(
                [{
                    case_code: buildCaseCode(),
                    booking_id: booking._id,
                    handover_id: handover._id,
                    garage_id: booking.garage_id,
                    customer_id: user._id,
                    vehicle_id: booking.vehicle_id,
                    category: payload.category,
                    priority,
                priority_rank: getCustomerCasePriorityRank(priority),
                ...slaDeadlines,
                    open_dedupe_key: `${toId(booking._id)}:${payload.category}`,
                    source,
                    description: payload.description,
                    damage_location: normalizeText(payload.damage_location),
                    desired_resolution: normalizeText(payload.desired_resolution),
                    discovered_at: discoveredAt,
                    vehicle_received: payload.vehicle_received || handover.state === BOOKING_HANDOVER_STATES.RELEASED,
                    upload_ids: payload.upload_ids || [],
                    booking_snapshot: buildBookingSnapshot(booking),
                    inspection_snapshot: handover.inspection_snapshot || {},
                }],
                { session }
            );
            createdCase = customerCase;

            await linkEvidenceUploads({
                caseId: customerCase._id,
                uploadIds: payload.upload_ids || [],
                session,
            });

            const now = new Date();
            const handoverBefore = {
                state: handover.state,
                customer_response: handover.customer_response,
                customer_responded_at: handover.customer_responded_at,
                released_at: handover.released_at,
                issue_case_ids: (handover.issue_case_ids || []).map(toId),
            };
            handover.customer_response = BOOKING_HANDOVER_RESPONSES.ISSUE_REPORTED;
            handover.customer_response_source = BOOKING_HANDOVER_RESPONSE_SOURCES.CUSTOMER_SELF_SERVICE;
            handover.customer_response_recorded_by_id = user._id;
            handover.customer_response_note = normalizeText(payload.description);
            handover.customer_responded_at = now;
            handover.issue_case_ids.addToSet(customerCase._id);

            if (payload.vehicle_received || handover.state === BOOKING_HANDOVER_STATES.RELEASED) {
                handover.state = BOOKING_HANDOVER_STATES.RELEASED;
                handover.released_at = handover.released_at || now;
                handover.released_by_id = handover.released_by_id || user._id;
            } else {
                handover.state = BOOKING_HANDOVER_STATES.ON_HOLD;
            }

            await handover.save({ session });
            await auditLogService.recordAuditEvent({
                actorId: user._id,
                action: AUDIT_ACTIONS.BOOKING_HANDOVER_ISSUE_REPORTED,
                resourceType: AUDIT_RESOURCE_TYPES.BOOKING_HANDOVER,
                resourceId: handover._id,
                before: handoverBefore,
                after: {
                    state: handover.state,
                    customer_response: handover.customer_response,
                    customer_responded_at: handover.customer_responded_at,
                    released_at: handover.released_at,
                    issue_case_ids: (handover.issue_case_ids || []).map(toId),
                },
                ip: auditContext.ip,
                userAgent: auditContext.userAgent,
                metadata: { booking_id: toId(booking._id), customer_case_id: toId(customerCase._id) },
                session,
            });
            await createEvent({
                customerCase,
                actor: user,
                eventType: CUSTOMER_CASE_EVENT_TYPES.SUBMITTED,
                toStatus: CUSTOMER_CASE_STATUSES.SUBMITTED,
                metadata: {
                    category: customerCase.category,
                    priority: customerCase.priority,
                    upload_ids: (payload.upload_ids || []).map(toId),
                    vehicle_received: customerCase.vehicle_received,
                },
                session,
            });
            await auditLogService.recordAuditEvent({
                actorId: user._id,
                action: AUDIT_ACTIONS.CUSTOMER_CASE_SUBMITTED,
                resourceType: AUDIT_RESOURCE_TYPES.CUSTOMER_CASE,
                resourceId: customerCase._id,
                after: CustomerCaseMapper.toCustomerCaseDto(customerCase),
                ip: auditContext.ip,
                userAgent: auditContext.userAgent,
                metadata: { booking_id: toId(booking._id), handover_id: toId(handover._id) },
                session,
            });
        });
    } catch (error) {
        if (error?.code === 11000 && error?.keyPattern?.open_dedupe_key) {
            throw new AppError(
                'An open case already exists for this booking and category',
                409,
                'CUSTOMER_CASE_DUPLICATE_OPEN'
            );
        }

        throw error;
    } finally {
        await session.endSession();
    }

    await customerCaseNotificationService.notifyCaseSubmitted(createdCase, user._id);
    return getCaseDetail(createdCase, { customerView: true });
};

const buildListFilter = ({
    status,
    category,
    priority,
    booking_id,
    case_code,
    assigned_to_id,
} = {}) => {
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    if (booking_id) filter.booking_id = booking_id;
    if (case_code) filter.case_code = case_code;
    if (assigned_to_id) filter.assigned_to_id = assigned_to_id;
    return filter;
};

const getMyCases = async (user, filters = {}) => {
    const filter = { ...buildListFilter(filters), customer_id: user._id };
    const skip = (filters.page - 1) * filters.limit;
    const [items, total] = await Promise.all([
        populateCaseQuery(CustomerCase.find(filter).sort({ created_at: -1 }).skip(skip).limit(filters.limit)),
        CustomerCase.countDocuments(filter),
    ]);

    return {
        data: CustomerCaseMapper.toCustomerCaseDtoList(items, { customerView: true, includeSnapshots: false }),
        meta: { page: filters.page, limit: filters.limit, total, total_pages: Math.ceil(total / filters.limit) },
    };
};

const getMyCaseById = async (user, caseId) => {
    const customerCase = await getCaseDocument(caseId);
    assertCustomerOwnsCase(user, customerCase);
    return getCaseDetail(customerCase, { customerView: true });
};

const getStaffCases = async (staffContext, filters = {}) => {
    const filter = buildListFilter(filters);

    if (staffContext?.is_admin) {
        if (filters.garage_id) filter.garage_id = filters.garage_id;
    } else {
        filter.garage_id = staffContext.garage_id;
    }

    const skip = (filters.page - 1) * filters.limit;
    const [items, total] = await Promise.all([
        populateCaseQuery(CustomerCase.find(filter).sort({ priority_rank: -1, created_at: -1 }).skip(skip).limit(filters.limit)),
        CustomerCase.countDocuments(filter),
    ]);

    return {
        data: CustomerCaseMapper.toCustomerCaseDtoList(items, { includeSnapshots: false }),
        meta: { page: filters.page, limit: filters.limit, total, total_pages: Math.ceil(total / filters.limit) },
    };
};

const getStaffCaseById = async (staffContext, caseId) => {
    const customerCase = await getCaseDocument(caseId);
    assertStaffGarageAccess(staffContext, customerCase);
    return getCaseDetail(customerCase);
};

const addEvidence = async (user, staffContext, caseId, payload = {}, auditContext = {}) => {
    const session = await mongoose.startSession();
    let customerCase;

    try {
        await session.withTransaction(async () => {
            customerCase = await getCaseDocument(caseId, { session });

            if (user.role === USER_ROLES.CUSTOMER) {
                assertCustomerOwnsCase(user, customerCase);
            } else {
                assertAssignedHandler(user, staffContext, customerCase);
            }

            assertCaseOpen(customerCase);
            await validateEvidenceUploads({
                actorId: user._id,
                uploadIds: payload.upload_ids,
                caseId: customerCase._id,
                session,
            });

            const newUploadIds = payload.upload_ids.filter(
                (uploadId) => !(customerCase.upload_ids || []).some((existingId) => toId(existingId) === toId(uploadId))
            );

            if (newUploadIds.length === 0) {
                throw new AppError('All evidence uploads are already linked to this case', 409, 'CUSTOMER_CASE_EVIDENCE_DUPLICATE');
            }

            if ((customerCase.upload_ids || []).length + newUploadIds.length > CUSTOMER_CASE_LIMITS.MAX_EVIDENCE_PER_CASE) {
                throw new AppError(
                    'Customer case evidence limit exceeded',
                    409,
                    'CUSTOMER_CASE_EVIDENCE_LIMIT_EXCEEDED'
                );
            }

            customerCase.upload_ids.push(...newUploadIds);
            await customerCase.save({ session });
            await linkEvidenceUploads({ caseId: customerCase._id, uploadIds: newUploadIds, session });
            await createEvent({
                customerCase,
                actor: user,
                eventType: CUSTOMER_CASE_EVENT_TYPES.EVIDENCE_ADDED,
                fromStatus: customerCase.status,
                toStatus: customerCase.status,
                metadata: { upload_ids: newUploadIds.map(toId) },
                session,
            });
            await auditLogService.recordAuditEvent({
                actorId: user._id,
                action: AUDIT_ACTIONS.CUSTOMER_CASE_EVIDENCE_ADDED,
                resourceType: AUDIT_RESOURCE_TYPES.CUSTOMER_CASE,
                resourceId: customerCase._id,
                ip: auditContext.ip,
                userAgent: auditContext.userAgent,
                metadata: { upload_ids: newUploadIds.map(toId) },
                session,
            });
        });
    } finally {
        await session.endSession();
    }

    return getCaseDetail(customerCase, { customerView: user.role === USER_ROLES.CUSTOMER });
};

const assignCase = async (user, staffContext, caseId, payload = {}, auditContext = {}) => {
    const customerCase = await getCaseDocument(caseId);
    assertStaffGarageAccess(staffContext, customerCase);
    assertCaseOpen(customerCase);
    const staffProfile = await StaffProfile.findById(payload.staff_profile_id);

    if (
        !staffProfile
        || !staffProfile.is_active
        || staffProfile.employment_status !== STAFF_EMPLOYMENT_STATUS.ACTIVE
        || staffProfile.staff_type !== STAFF_TYPES.CUSTOMER_SERVICE_STAFF
        || toId(staffProfile.garage_id) !== toId(customerCase.garage_id)
    ) {
        throw new AppError('Assignee must be an active customer service staff in the case garage', 409, 'CUSTOMER_CASE_ASSIGNEE_INVALID');
    }

    const activeStaffUser = await User.exists({
        _id: staffProfile.user_id,
        role: USER_ROLES.STAFF,
        is_active: true,
    });

    if (!activeStaffUser) {
        throw new AppError('Assignee user account is not active', 409, 'CUSTOMER_CASE_ASSIGNEE_INVALID');
    }

    const before = CustomerCaseMapper.toCustomerCaseDto(customerCase);
    const previousAssigneeId = toId(customerCase.assigned_to_id);
    customerCase.assigned_to_id = staffProfile.user_id;
    customerCase.assigned_by_id = user._id;
    customerCase.assigned_at = new Date();
    await customerCase.save();

    await createEvent({
        customerCase,
        actor: user,
        eventType: CUSTOMER_CASE_EVENT_TYPES.ASSIGNED,
        fromStatus: customerCase.status,
        toStatus: customerCase.status,
        metadata: { previous_assignee_id: previousAssigneeId, assigned_to_id: toId(staffProfile.user_id) },
        visibleToCustomer: false,
    });
    await auditLogService.recordAuditEvent({
        actorId: user._id,
        action: AUDIT_ACTIONS.CUSTOMER_CASE_ASSIGNED,
        resourceType: AUDIT_RESOURCE_TYPES.CUSTOMER_CASE,
        resourceId: customerCase._id,
        before,
        after: CustomerCaseMapper.toCustomerCaseDto(customerCase),
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
    });
    await customerCaseNotificationService.notifyCaseAssigned(customerCase, staffProfile.user_id, user._id);

    return getCaseDetail(customerCase);
};

const acknowledgeCase = async (user, staffContext, caseId, payload = {}, auditContext = {}) => {
    const customerCase = await getCaseDocument(caseId);
    assertStaffGarageAccess(staffContext, customerCase);
    assertCaseOpen(customerCase);

    if (customerCase.assigned_to_id && toId(customerCase.assigned_to_id) !== toId(user._id) && !staffContext?.is_admin) {
        throw new AppError('Customer case is assigned to another staff member', 403, 'CUSTOMER_CASE_ASSIGNMENT_REQUIRED');
    }

    if (customerCase.status !== CUSTOMER_CASE_STATUSES.SUBMITTED) {
        if (toId(customerCase.acknowledged_by_id) === toId(user._id) || staffContext?.is_admin) {
            return getCaseDetail(customerCase);
        }

        throw new AppError('Customer case has already been acknowledged', 409, 'CUSTOMER_CASE_ALREADY_ACKNOWLEDGED');
    }

    const before = CustomerCaseMapper.toCustomerCaseDto(customerCase);
    const previousStatus = customerCase.status;
    const autoAssigned = !customerCase.assigned_to_id && !staffContext?.is_admin;
    const now = new Date();

    if (autoAssigned) {
        customerCase.assigned_to_id = user._id;
        customerCase.assigned_by_id = user._id;
        customerCase.assigned_at = now;
    }

    customerCase.status = CUSTOMER_CASE_STATUSES.ACKNOWLEDGED;
    customerCase.acknowledged_by_id = user._id;
    customerCase.acknowledged_at = now;
    await customerCase.save();

    if (autoAssigned) {
        await createEvent({
            customerCase,
            actor: user,
            eventType: CUSTOMER_CASE_EVENT_TYPES.ASSIGNED,
            fromStatus: previousStatus,
            toStatus: previousStatus,
            metadata: { assigned_to_id: toId(user._id), automatic: true },
            visibleToCustomer: false,
        });
    }

    await createEvent({
        customerCase,
        actor: user,
        eventType: CUSTOMER_CASE_EVENT_TYPES.ACKNOWLEDGED,
        fromStatus: previousStatus,
        toStatus: customerCase.status,
        metadata: { note: normalizeText(payload.note) },
    });
    await auditLogService.recordAuditEvent({
        actorId: user._id,
        action: AUDIT_ACTIONS.CUSTOMER_CASE_ACKNOWLEDGED,
        resourceType: AUDIT_RESOURCE_TYPES.CUSTOMER_CASE,
        resourceId: customerCase._id,
        before,
        after: CustomerCaseMapper.toCustomerCaseDto(customerCase),
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
    });
    await customerCaseNotificationService.notifyCustomerCaseUpdate(customerCase, {
        actorId: user._id,
        type: NOTIFICATION_TYPES.CUSTOMER_CASE_ACKNOWLEDGED,
        title: `Issue ${customerCase.case_code} acknowledged`,
        message: 'The garage has acknowledged your issue and started reviewing it.',
    });

    return getCaseDetail(customerCase);
};

const postMessage = async (user, staffContext, caseId, payload = {}, auditContext = {}) => {
    const session = await mongoose.startSession();
    let customerCase;
    let createdMessage;

    try {
        await session.withTransaction(async () => {
            customerCase = await getCaseDocument(caseId, { session });

            if (user.role === USER_ROLES.CUSTOMER) {
                assertCustomerOwnsCase(user, customerCase);
            } else {
                assertAssignedHandler(user, staffContext, customerCase);
            }

            if (customerCase.status === CUSTOMER_CASE_STATUSES.CLOSED) {
                throw new AppError('Closed customer case does not accept new messages', 409, 'CUSTOMER_CASE_CLOSED');
            }

            await validateEvidenceUploads({
                actorId: user._id,
                uploadIds: payload.upload_ids || [],
                caseId: customerCase._id,
                session,
            });

            const previousStatus = customerCase.status;
            if (user.role !== USER_ROLES.CUSTOMER && customerCase.status === CUSTOMER_CASE_STATUSES.ACKNOWLEDGED) {
                customerCase.status = CUSTOMER_CASE_STATUSES.INVESTIGATING;
            }

            const newMessageUploadIds = (payload.upload_ids || []).filter(
                (uploadId) => !(customerCase.upload_ids || []).some((existingId) => toId(existingId) === toId(uploadId))
            );

            if (
                (customerCase.upload_ids || []).length + newMessageUploadIds.length
                > CUSTOMER_CASE_LIMITS.MAX_EVIDENCE_PER_CASE
            ) {
                throw new AppError(
                    'Customer case evidence limit exceeded',
                    409,
                    'CUSTOMER_CASE_EVIDENCE_LIMIT_EXCEEDED'
                );
            }

            customerCase.upload_ids.push(...newMessageUploadIds);

            await customerCase.save({ session });
            await linkEvidenceUploads({ caseId: customerCase._id, uploadIds: payload.upload_ids || [], session });
            [createdMessage] = await CustomerCaseMessage.create(
                [{
                    case_id: customerCase._id,
                    sender_id: user._id,
                    sender_role: user.role,
                    message: payload.message,
                    upload_ids: payload.upload_ids || [],
                }],
                { session }
            );
            await createEvent({
                customerCase,
                actor: user,
                eventType: CUSTOMER_CASE_EVENT_TYPES.MESSAGE_SENT,
                fromStatus: previousStatus,
                toStatus: customerCase.status,
                metadata: { message_id: toId(createdMessage._id), upload_ids: (payload.upload_ids || []).map(toId) },
                session,
            });
            await auditLogService.recordAuditEvent({
                actorId: user._id,
                action: AUDIT_ACTIONS.CUSTOMER_CASE_MESSAGE_SENT,
                resourceType: AUDIT_RESOURCE_TYPES.CUSTOMER_CASE,
                resourceId: customerCase._id,
                ip: auditContext.ip,
                userAgent: auditContext.userAgent,
                metadata: { message_id: toId(createdMessage._id), sender_role: user.role },
                session,
            });
        });
    } finally {
        await session.endSession();
    }

    await customerCaseNotificationService.notifyCaseMessage(customerCase, user);
    return getCaseDetail(customerCase, { customerView: user.role === USER_ROLES.CUSTOMER });
};

const concludeCase = async (user, caseId, payload = {}, auditContext = {}) => {
    if (user.role !== USER_ROLES.ADMIN) {
        throw new AppError('Only admin can conclude customer cases', 403, 'CUSTOMER_CASE_CONCLUSION_ADMIN_ONLY');
    }

    const customerCase = await getCaseDocument(caseId);

    if (customerCase.status === CUSTOMER_CASE_STATUSES.CLOSED) {
        throw new AppError('Customer case is already closed', 409, 'CUSTOMER_CASE_CLOSED');
    }

    if (customerCase.status === CUSTOMER_CASE_STATUSES.RESOLVED) {
        return getCaseDetail(customerCase);
    }

    if (![
        CUSTOMER_CASE_STATUSES.ACKNOWLEDGED,
        CUSTOMER_CASE_STATUSES.INVESTIGATING,
    ].includes(customerCase.status)) {
        throw new AppError(
            'Customer case must be acknowledged before conclusion',
            409,
            'CUSTOMER_CASE_ACKNOWLEDGEMENT_REQUIRED'
        );
    }

    const resolutionFilter = { case_id: customerCase._id };
    if (customerCase.last_reopened_at) {
        resolutionFilter.proposed_at = { $gte: customerCase.last_reopened_at };
    }
    const latestResolution = await CustomerCaseResolution.findOne(resolutionFilter)
        .sort({ version: -1 });
    if (!latestResolution || latestResolution.status !== 'APPLIED') {
        throw new AppError(
            'An accepted and applied resolution is required before conclusion',
            409,
            'CUSTOMER_CASE_APPLIED_RESOLUTION_REQUIRED'
        );
    }

    const before = CustomerCaseMapper.toCustomerCaseDto(customerCase);
    const previousStatus = customerCase.status;
    customerCase.status = CUSTOMER_CASE_STATUSES.RESOLVED;
    customerCase.liability_status = payload.liability_status;
    customerCase.conclusion = payload.conclusion;
    customerCase.resolution_summary = normalizeText(payload.resolution_summary);
    customerCase.open_dedupe_key = null;
    customerCase.resolved_by_id = user._id;
    customerCase.resolved_at = new Date();
    await customerCase.save();

    await createEvent({
        customerCase,
        actor: user,
        eventType: CUSTOMER_CASE_EVENT_TYPES.CONCLUDED,
        fromStatus: previousStatus,
        toStatus: customerCase.status,
        metadata: {
            liability_status: customerCase.liability_status,
            conclusion: customerCase.conclusion,
            resolution_summary: customerCase.resolution_summary,
        },
    });
    await auditLogService.recordAuditEvent({
        actorId: user._id,
        action: AUDIT_ACTIONS.CUSTOMER_CASE_CONCLUDED,
        resourceType: AUDIT_RESOURCE_TYPES.CUSTOMER_CASE,
        resourceId: customerCase._id,
        before,
        after: CustomerCaseMapper.toCustomerCaseDto(customerCase),
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
    });
    await customerCaseNotificationService.notifyCustomerCaseUpdate(customerCase, {
        actorId: user._id,
        type: NOTIFICATION_TYPES.CUSTOMER_CASE_RESOLVED,
        title: `Issue ${customerCase.case_code} resolved`,
        message: 'The garage has recorded a conclusion for your reported issue.',
    });

    return getCaseDetail(customerCase);
};

const closeCase = async (user, caseId, payload = {}, auditContext = {}) => {
    if (user.role !== USER_ROLES.ADMIN) {
        throw new AppError('Only admin can close customer cases', 403, 'CUSTOMER_CASE_CLOSE_ADMIN_ONLY');
    }

    const customerCase = await getCaseDocument(caseId);

    if (customerCase.status === CUSTOMER_CASE_STATUSES.CLOSED) {
        return getCaseDetail(customerCase);
    }

    if (customerCase.status !== CUSTOMER_CASE_STATUSES.RESOLVED) {
        throw new AppError('Customer case must be concluded before closing', 409, 'CUSTOMER_CASE_CONCLUSION_REQUIRED');
    }

    const before = CustomerCaseMapper.toCustomerCaseDto(customerCase);
    const previousStatus = customerCase.status;
    customerCase.status = CUSTOMER_CASE_STATUSES.CLOSED;
    customerCase.closed_by_id = user._id;
    customerCase.closed_at = new Date();
    await customerCase.save();

    await createEvent({
        customerCase,
        actor: user,
        eventType: CUSTOMER_CASE_EVENT_TYPES.CLOSED,
        fromStatus: previousStatus,
        toStatus: customerCase.status,
        metadata: { note: normalizeText(payload.note) },
    });
    await auditLogService.recordAuditEvent({
        actorId: user._id,
        action: AUDIT_ACTIONS.CUSTOMER_CASE_CLOSED,
        resourceType: AUDIT_RESOURCE_TYPES.CUSTOMER_CASE,
        resourceId: customerCase._id,
        before,
        after: CustomerCaseMapper.toCustomerCaseDto(customerCase),
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
    });
    await customerCaseNotificationService.notifyCustomerCaseUpdate(customerCase, {
        actorId: user._id,
        type: NOTIFICATION_TYPES.CUSTOMER_CASE_CLOSED,
        title: `Issue ${customerCase.case_code} closed`,
        message: 'Your reported issue has been closed. The conclusion remains available in the case timeline.',
    });

    return getCaseDetail(customerCase);
};

module.exports = {
    createFromHandover,
    getMyCases,
    getMyCaseById,
    getStaffCases,
    getStaffCaseById,
    addEvidence,
    assignCase,
    acknowledgeCase,
    postMessage,
    concludeCase,
    closeCase,
    getCaseDocument,
    getCaseDetail,
    assertCustomerOwnsCase,
    assertStaffGarageAccess,
    assertAssignedHandler,
    assertCaseOpen,
    buildBookingSnapshot,
    validateEvidenceUploads,
    linkEvidenceUploads,
    createEvent,
    buildCaseCode,
    getSlaDeadlines,
};
