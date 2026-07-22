const mongoose = require('mongoose');

const StaffProfile = require('./staffProfile.model');
const StaffTypeChangeRequest = require('./staffTypeChange.model');
const StaffTypeChangeMapper = require('./staffTypeChange.mapper');
const Booking = require('../bookings/booking.model');
const User = require('../users/user.model');
const TokenService = require('../auth/services/token.service');
const auditLogService = require('../audit-logs/auditLog.service');
const notificationService = require('../notifications/notification.service');
const { AppError } = require('../../shared/utils/appError');
const { USER_ROLES } = require('../../shared/constants/roles.constant');
const {
    STAFF_EMPLOYMENT_STATUS,
    STAFF_TYPE_VALUES,
} = require('../../shared/constants/staff.constant');
const {
    STAFF_TYPE_CHANGE_STATUS,
    STAFF_TYPE_CHANGE_ACTIVE_STATUSES,
    STAFF_TYPE_CHANGE_REQUEST_SOURCES,
} = require('../../shared/constants/staffTypeChange.constant');
const {
    BOOKING_HOLD_SLOT_STATUSES,
    BOOKING_STATUS,
    BOOKING_ITEM_STATUS,
} = require('../../shared/constants/booking.constant');
const { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } = require('../../shared/constants/audit.constant');
const {
    NOTIFICATION_TYPES,
    NOTIFICATION_RELATED_TYPES,
} = require('../../shared/constants/notification.constant');

const USER_FIELDS = 'full_name email phone role is_active';
const ACTIVE_ITEM_STATUSES = [
    BOOKING_ITEM_STATUS.IN_PROGRESS,
    BOOKING_ITEM_STATUS.PAUSED,
    BOOKING_ITEM_STATUS.AWAITING_CONFIRMATION,
    BOOKING_ITEM_STATUS.WAITING_RESOURCE,
];

const normalizeText = (value) => {
    if (value === null || value === undefined) {
        return null;
    }

    return typeof value === 'string' ? value.trim() || null : value;
};

const toId = (value) => value?._id || value || null;
const toIdString = (value) => toId(value)?.toString?.() || null;

const applySession = (query, session) => (
    session && typeof query.session === 'function' ? query.session(session) : query
);

const populateRequestQuery = (query) => query
    .populate('requested_by', USER_FIELDS)
    .populate('approved_by', USER_FIELDS)
    .populate('rejected_by', USER_FIELDS)
    .populate('cancelled_by', USER_FIELDS);

const getStaffProfileByUserId = async (userId, session = null) => {
    const query = StaffProfile.findOne({ user_id: userId });
    const profile = await applySession(query, session);

    if (!profile) {
        throw new AppError('Staff profile not found', 404, 'STAFF_PROFILE_NOT_FOUND');
    }

    return profile;
};

const getStaffProfileById = async (staffProfileId, session = null) => {
    const query = StaffProfile.findById(staffProfileId);
    const profile = await applySession(query, session);

    if (!profile) {
        throw new AppError('Staff profile not found', 404, 'STAFF_PROFILE_NOT_FOUND');
    }

    return profile;
};

const getRequestById = async (requestId, session = null) => {
    const query = StaffTypeChangeRequest.findById(requestId);
    const request = await applySession(query, session);

    if (!request) {
        throw new AppError(
            'Staff type change request not found',
            404,
            'STAFF_TYPE_CHANGE_REQUEST_NOT_FOUND'
        );
    }

    return request;
};

const assertTargetStaffType = (currentStaffType, targetStaffType) => {
    if (!STAFF_TYPE_VALUES.includes(targetStaffType)) {
        throw new AppError('Invalid target staff type', 400, 'INVALID_STAFF_TYPE');
    }

    if (currentStaffType === targetStaffType) {
        throw new AppError(
            'Target staff type must be different from current staff type',
            400,
            'STAFF_TYPE_CHANGE_NO_CHANGE'
        );
    }
};

const assertActiveStaffProfile = (profile) => {
    const employmentStatus = profile.employment_status
        || (profile.is_active
            ? STAFF_EMPLOYMENT_STATUS.ACTIVE
            : STAFF_EMPLOYMENT_STATUS.SUSPENDED);

    if (!profile.is_active || employmentStatus !== STAFF_EMPLOYMENT_STATUS.ACTIVE) {
        throw new AppError('Staff profile is not active', 409, 'STAFF_PROFILE_INACTIVE');
    }
};

const getAssignmentMatch = (staffProfile) => {
    const staffProfileId = staffProfile._id;
    const userId = toId(staffProfile.user_id);

    return {
        $or: [
            { assigned_inspection_staff_id: userId },
            {
                booking_items: {
                    $elemMatch: {
                        'assigned_care_staff.staff_profile_id': staffProfileId,
                        'assigned_care_staff.released_at': null,
                    },
                },
            },
            {
                booking_items: {
                    $elemMatch: {
                        'assigned_execution_staff.staff_profile_id': staffProfileId,
                        'assigned_execution_staff.released_at': null,
                    },
                },
            },
        ],
    };
};

const buildStaffTypeChangeImpact = async (
    staffProfile,
    targetStaffType,
    effectiveAt = new Date(),
    session = null
) => {
    assertTargetStaffType(staffProfile.staff_type, targetStaffType);

    const now = new Date();
    const effectiveDate = effectiveAt instanceof Date ? effectiveAt : new Date(effectiveAt);
    const assignmentMatch = getAssignmentMatch(staffProfile);
    const bookingBaseFilter = {
        status: { $in: BOOKING_HOLD_SLOT_STATUSES },
        ...assignmentMatch,
    };
    const activeFilter = {
        ...bookingBaseFilter,
        $and: [
            assignmentMatch,
            {
                $or: [
                    { status: BOOKING_STATUS.IN_PROGRESS },
                    { 'booking_items.status': { $in: ACTIVE_ITEM_STATUSES } },
                ],
            },
        ],
    };
    delete activeFilter.$or;
    const futureFilter = {
        ...bookingBaseFilter,
        start_time: { $gte: now },
    };
    const garageId = staffProfile.garage_id || null;
    const sourceCapacityFilter = {
        garage_id: garageId,
        staff_type: staffProfile.staff_type,
        is_active: true,
        $or: [
            { employment_status: STAFF_EMPLOYMENT_STATUS.ACTIVE },
            { employment_status: { $exists: false } },
        ],
    };
    const targetCapacityFilter = {
        ...sourceCapacityFilter,
        staff_type: targetStaffType,
    };

    const queries = [
        Booking.countDocuments(activeFilter),
        Booking.countDocuments(futureFilter),
        StaffProfile.countDocuments(sourceCapacityFilter),
        StaffProfile.countDocuments(targetCapacityFilter),
    ].map((query) => applySession(query, session));
    const [activeAssignments, futureAssignments, sourceCapacity, targetCapacity] = await Promise.all(queries);
    const appliesImmediately = effectiveDate.getTime() <= now.getTime();
    const blockers = [];
    const warnings = [];

    if (activeAssignments > 0) {
        blockers.push({
            code: 'STAFF_HAS_ACTIVE_ASSIGNMENTS',
            count: activeAssignments,
            message: 'Staff has service work currently in progress',
        });
    }

    if (futureAssignments > 0) {
        warnings.push({
            code: 'STAFF_HAS_FUTURE_ASSIGNMENTS',
            count: futureAssignments,
            message: 'Future assignments require handover or reassignment',
        });
    }

    if (garageId && sourceCapacity - 1 <= 0) {
        warnings.push({
            code: 'SOURCE_STAFF_TYPE_CAPACITY_EMPTY',
            count: 0,
            message: 'This change leaves no active staff in the current position at the garage',
        });
    }

    return {
        generated_at: now,
        effective_at: effectiveDate,
        applies_immediately: appliesImmediately,
        staff_profile_id: staffProfile._id.toString(),
        from_staff_type: staffProfile.staff_type,
        to_staff_type: targetStaffType,
        from_garage_id: toIdString(staffProfile.garage_id),
        to_garage_id: toIdString(staffProfile.garage_id),
        active_assignment_count: activeAssignments,
        future_assignment_count: futureAssignments,
        capacity: {
            source_before: sourceCapacity,
            source_after: Math.max(sourceCapacity - 1, 0),
            target_before: targetCapacity,
            target_after: targetCapacity + 1,
        },
        blockers,
        warnings,
        can_apply_now: activeAssignments === 0 && futureAssignments === 0,
    };
};

const getStaffTypeChangeImpact = async (
    staffProfileId,
    { to_staff_type: targetStaffType, effective_at: effectiveAt } = {}
) => {
    const profile = await getStaffProfileById(staffProfileId);

    return buildStaffTypeChangeImpact(
        profile,
        targetStaffType,
        effectiveAt || new Date()
    );
};

const recordChangeAudit = async ({
    request,
    actorId,
    action,
    before = null,
    after = null,
    auditContext = {},
    session = null,
}) => auditLogService.recordAuditEvent({
    actorId,
    action,
    resourceType: AUDIT_RESOURCE_TYPES.STAFF_TYPE_CHANGE_REQUEST,
    resourceId: request._id,
    before,
    after,
    ip: auditContext.ip,
    userAgent: auditContext.userAgent,
    metadata: {
        staff_profile_id: request.staff_profile_id,
        from_staff_type: request.from_staff_type,
        to_staff_type: request.to_staff_type,
        effective_at: request.effective_at,
        request_source: request.request_source || STAFF_TYPE_CHANGE_REQUEST_SOURCES.STAFF_SELF_REQUEST,
        requested_by_role: request.requested_by_role || USER_ROLES.STAFF,
    },
    session,
});

const notifyTargetStaff = async (request, type, title, message) => {
    try {
        const profile = await StaffProfile.findById(request.staff_profile_id).select('user_id');

        if (!profile?.user_id) {
            return null;
        }

        return notificationService.createInAppNotification({
            userId: profile.user_id,
            type,
            title,
            message,
            relatedType: NOTIFICATION_RELATED_TYPES.STAFF,
            relatedId: request._id,
            metadata: {
                from_staff_type: request.from_staff_type,
                to_staff_type: request.to_staff_type,
                status: request.status,
                effective_at: request.effective_at,
                request_source: request.request_source
                    || STAFF_TYPE_CHANGE_REQUEST_SOURCES.STAFF_SELF_REQUEST,
            },
        });
    } catch (error) {
        console.warn('[staff-type-change] notification failed', {
            request_id: request._id?.toString?.() || request._id,
            error: error.message,
        });
        return null;
    }
};

const notifyActiveAdmins = async (request) => {
    try {
        const admins = await User.find({
            role: USER_ROLES.ADMIN,
            is_active: true,
        }).select('_id');
        const metadata = {
            staff_profile_id: toIdString(request.staff_profile_id),
            from_staff_type: request.from_staff_type,
            to_staff_type: request.to_staff_type,
            status: request.status,
            effective_at: request.effective_at,
            request_source: request.request_source,
        };

        await Promise.allSettled(admins.map((admin) => (
            notificationService.createInAppNotification({
                userId: admin._id,
                type: NOTIFICATION_TYPES.STAFF_TYPE_CHANGE_REQUESTED,
                title: 'Staff position change requested',
                message: `A staff member requested a position change from ${request.from_staff_type} to ${request.to_staff_type}.`,
                relatedType: NOTIFICATION_RELATED_TYPES.STAFF,
                relatedId: request._id,
                metadata,
            })
        )));
    } catch (error) {
        console.warn('[staff-type-change] admin notification failed', {
            request_id: request._id?.toString?.() || request._id,
            error: error.message,
        });
    }
};

const createStaffTypeChangeRequest = async ({
    profile,
    actorId,
    actorRole,
    requestSource,
    payload,
    impactSnapshot = null,
    auditContext = {},
}) => {
    assertActiveStaffProfile(profile);
    assertTargetStaffType(profile.staff_type, payload.to_staff_type);

    const session = await mongoose.startSession();
    let request;

    try {
        await session.withTransaction(async () => {
            const existingQuery = StaffTypeChangeRequest.exists({
                staff_profile_id: profile._id,
                status: { $in: STAFF_TYPE_CHANGE_ACTIVE_STATUSES },
            });
            const existingRequest = await applySession(existingQuery, session);

            if (existingRequest) {
                throw new AppError(
                    'Staff already has an active type change request',
                    409,
                    'STAFF_TYPE_CHANGE_REQUEST_ALREADY_ACTIVE'
                );
            }

            const documents = await StaffTypeChangeRequest.create([{
                staff_profile_id: profile._id,
                from_staff_type: profile.staff_type,
                to_staff_type: payload.to_staff_type,
                from_garage_id: profile.garage_id,
                to_garage_id: profile.garage_id,
                reason: normalizeText(payload.reason),
                effective_at: payload.effective_at || new Date(),
                requested_by: actorId,
                request_source: requestSource,
                requested_by_role: actorRole,
                handover_note: normalizeText(payload.handover_note),
                impact_snapshot: impactSnapshot,
                status: STAFF_TYPE_CHANGE_STATUS.REQUESTED,
            }], { session });

            [request] = documents;

            await recordChangeAudit({
                request,
                actorId,
                action: AUDIT_ACTIONS.STAFF_TYPE_CHANGE_REQUESTED,
                after: request,
                auditContext,
                session,
            });
        });
    } catch (error) {
        if (error?.code === 11000) {
            throw new AppError(
                'Staff already has an active type change request',
                409,
                'STAFF_TYPE_CHANGE_REQUEST_ALREADY_ACTIVE'
            );
        }
        throw error;
    } finally {
        await session.endSession();
    }

    const populatedRequest = await populateRequestQuery(
        StaffTypeChangeRequest.findById(request._id)
    );

    if (requestSource === STAFF_TYPE_CHANGE_REQUEST_SOURCES.STAFF_SELF_REQUEST) {
        await notifyActiveAdmins(populatedRequest);
    } else {
        await notifyTargetStaff(
            populatedRequest,
            NOTIFICATION_TYPES.STAFF_TYPE_CHANGE_REQUESTED,
            'Staff position change initiated',
            `An administrator initiated your position change from ${populatedRequest.from_staff_type} to ${populatedRequest.to_staff_type}.`
        );
    }

    return StaffTypeChangeMapper.toStaffTypeChangeDto(populatedRequest);
};

const createMyStaffTypeChangeRequest = async (userId, payload, auditContext = {}) => {
    const profile = await getStaffProfileByUserId(userId);

    return createStaffTypeChangeRequest({
        profile,
        actorId: userId,
        actorRole: USER_ROLES.STAFF,
        requestSource: STAFF_TYPE_CHANGE_REQUEST_SOURCES.STAFF_SELF_REQUEST,
        payload,
        auditContext,
    });
};

const createAdminStaffTypeChangeRequest = async (
    staffProfileId,
    actorId,
    payload,
    auditContext = {}
) => {
    const profile = await getStaffProfileById(staffProfileId);
    assertActiveStaffProfile(profile);
    const effectiveAt = payload.effective_at || new Date();
    const impact = await buildStaffTypeChangeImpact(
        profile,
        payload.to_staff_type,
        effectiveAt
    );

    if ((impact.active_assignment_count > 0 || impact.future_assignment_count > 0)
        && !normalizeText(payload.handover_note)) {
        throw new AppError(
            'Handover note is required when the staff member has active or future assignments',
            400,
            'STAFF_TYPE_CHANGE_HANDOVER_REQUIRED'
        );
    }

    return createStaffTypeChangeRequest({
        profile,
        actorId,
        actorRole: USER_ROLES.ADMIN,
        requestSource: STAFF_TYPE_CHANGE_REQUEST_SOURCES.ADMIN_DIRECTED,
        payload: { ...payload, effective_at: effectiveAt },
        impactSnapshot: impact,
        auditContext,
    });
};

const paginateRequests = async (filter, { page = 1, limit = 20 } = {}) => {
    const skip = (page - 1) * limit;
    const [requests, total] = await Promise.all([
        populateRequestQuery(
            StaffTypeChangeRequest.find(filter)
                .sort({ created_at: -1 })
                .skip(skip)
                .limit(limit)
        ),
        StaffTypeChangeRequest.countDocuments(filter),
    ]);

    return {
        data: StaffTypeChangeMapper.toStaffTypeChangeDtoList(requests),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

const getMyStaffTypeChangeRequests = async (userId, query = {}) => {
    const profile = await getStaffProfileByUserId(userId);
    const filter = { staff_profile_id: profile._id };

    if (query.status) {
        filter.status = query.status;
    }

    return paginateRequests(filter, query);
};

const getAdminStaffTypeChangeRequests = async (query = {}) => {
    const filter = {};

    if (query.status) {
        filter.status = query.status;
    }

    if (query.staff_profile_id) {
        filter.staff_profile_id = query.staff_profile_id;
    }

    if (query.request_source) {
        filter.request_source = query.request_source;
    }

    return paginateRequests(filter, query);
};

const applyApprovedRequest = async (
    request,
    { actorId, emergencyOverride = false, overrideReason = null, auditContext = {} } = {}
) => {
    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            const transactionalRequest = await getRequestById(request._id, session);

            if (transactionalRequest.status !== STAFF_TYPE_CHANGE_STATUS.APPROVED) {
                throw new AppError(
                    'Staff type change request is not approved for application',
                    409,
                    'STAFF_TYPE_CHANGE_REQUEST_NOT_APPROVED'
                );
            }

            const profile = await getStaffProfileById(transactionalRequest.staff_profile_id, session);

            if (profile.staff_type !== transactionalRequest.from_staff_type) {
                throw new AppError(
                    'Staff type changed after this request was created',
                    409,
                    'STAFF_TYPE_CHANGE_STALE_REQUEST'
                );
            }

            const impact = await buildStaffTypeChangeImpact(
                profile,
                transactionalRequest.to_staff_type,
                transactionalRequest.effective_at,
                session
            );

            if (impact.active_assignment_count > 0 && !emergencyOverride) {
                throw new AppError(
                    'Staff has active assignments',
                    409,
                    'STAFF_HAS_ACTIVE_ASSIGNMENTS'
                );
            }

            if (impact.future_assignment_count > 0 && !emergencyOverride) {
                throw new AppError(
                    'Staff has future assignments that require handover',
                    409,
                    'STAFF_HAS_FUTURE_ASSIGNMENTS'
                );
            }

            const before = {
                staff_type: profile.staff_type,
                garage_id: profile.garage_id,
            };

            profile.staff_type = transactionalRequest.to_staff_type;
            profile.garage_id = transactionalRequest.to_garage_id;
            await profile.save({ session });

            transactionalRequest.status = STAFF_TYPE_CHANGE_STATUS.APPLIED;
            transactionalRequest.applied_at = new Date();
            transactionalRequest.impact_snapshot = impact;
            transactionalRequest.emergency_override = emergencyOverride;
            transactionalRequest.override_reason = normalizeText(overrideReason);
            transactionalRequest.failure_reason = null;
            await transactionalRequest.save({ session });

            await TokenService.revokeAllByUser(
                profile.user_id,
                'staff_type_changed',
                session
            );

            await recordChangeAudit({
                request: transactionalRequest,
                actorId,
                action: AUDIT_ACTIONS.STAFF_TYPE_CHANGE_APPLIED,
                before,
                after: {
                    staff_type: profile.staff_type,
                    garage_id: profile.garage_id,
                },
                auditContext,
                session,
            });
        });
    } finally {
        await session.endSession();
    }

    const appliedRequest = await populateRequestQuery(
        StaffTypeChangeRequest.findById(request._id)
    );

    await notifyTargetStaff(
        appliedRequest,
        NOTIFICATION_TYPES.STAFF_TYPE_CHANGE_APPLIED,
        'Staff position changed',
        `Your staff position has changed to ${appliedRequest.to_staff_type}.`
    );

    return StaffTypeChangeMapper.toStaffTypeChangeDto(appliedRequest);
};

const approveStaffTypeChangeRequest = async (
    requestId,
    actorId,
    payload = {},
    auditContext = {}
) => {
    const request = await getRequestById(requestId);

    if (request.status !== STAFF_TYPE_CHANGE_STATUS.REQUESTED) {
        throw new AppError(
            'Only requested staff type changes can be approved',
            409,
            'STAFF_TYPE_CHANGE_REQUEST_NOT_PENDING'
        );
    }

    const profile = await getStaffProfileById(request.staff_profile_id);

    if (profile.staff_type !== request.from_staff_type) {
        throw new AppError(
            'Staff type changed after this request was created',
            409,
            'STAFF_TYPE_CHANGE_STALE_REQUEST'
        );
    }

    const effectiveAt = payload.effective_at || request.effective_at || new Date();
    const impact = await buildStaffTypeChangeImpact(
        profile,
        request.to_staff_type,
        effectiveAt
    );
    const appliesImmediately = effectiveAt.getTime() <= Date.now();

    if (
        appliesImmediately
        && impact.active_assignment_count > 0
        && !payload.emergency_override
    ) {
        throw new AppError(
            'Staff has active assignments; schedule the change or use an emergency override',
            409,
            'STAFF_HAS_ACTIVE_ASSIGNMENTS'
        );
    }


    if (
        appliesImmediately
        && impact.future_assignment_count > 0
        && !payload.emergency_override
    ) {
        throw new AppError(
            'Staff has future assignments that require handover',
            409,
            'STAFF_HAS_FUTURE_ASSIGNMENTS'
        );
    }

    request.approved_by = actorId;
    request.approved_at = new Date();
    request.effective_at = effectiveAt;
    request.handover_note = normalizeText(payload.handover_note) || request.handover_note;
    request.emergency_override = Boolean(payload.emergency_override);
    request.override_reason = normalizeText(payload.override_reason);
    request.impact_snapshot = impact;
    request.status = appliesImmediately
        ? STAFF_TYPE_CHANGE_STATUS.APPROVED
        : STAFF_TYPE_CHANGE_STATUS.SCHEDULED;
    await request.save();

    await recordChangeAudit({
        request,
        actorId,
        action: AUDIT_ACTIONS.STAFF_TYPE_CHANGE_APPROVED,
        after: request,
        auditContext,
    });

    if (appliesImmediately) {
        return applyApprovedRequest(request, {
            actorId,
            emergencyOverride: Boolean(payload.emergency_override),
            overrideReason: payload.override_reason,
            auditContext,
        });
    }

    const scheduledRequest = await populateRequestQuery(
        StaffTypeChangeRequest.findById(request._id)
    );

    await notifyTargetStaff(
        scheduledRequest,
        NOTIFICATION_TYPES.STAFF_TYPE_CHANGE_APPROVED,
        'Staff position change approved',
        `Your position change to ${scheduledRequest.to_staff_type} is scheduled.`
    );

    return StaffTypeChangeMapper.toStaffTypeChangeDto(scheduledRequest);
};

const rejectStaffTypeChangeRequest = async (
    requestId,
    actorId,
    reason,
    auditContext = {}
) => {
    const request = await getRequestById(requestId);

    if (request.status !== STAFF_TYPE_CHANGE_STATUS.REQUESTED) {
        throw new AppError(
            'Only requested staff type changes can be rejected',
            409,
            'STAFF_TYPE_CHANGE_REQUEST_NOT_PENDING'
        );
    }

    request.status = STAFF_TYPE_CHANGE_STATUS.REJECTED;
    request.rejected_by = actorId;
    request.rejected_at = new Date();
    request.decision_reason = normalizeText(reason);
    await request.save();

    await recordChangeAudit({
        request,
        actorId,
        action: AUDIT_ACTIONS.STAFF_TYPE_CHANGE_REJECTED,
        after: request,
        auditContext,
    });

    const rejectedRequest = await populateRequestQuery(
        StaffTypeChangeRequest.findById(request._id)
    );
    await notifyTargetStaff(
        rejectedRequest,
        NOTIFICATION_TYPES.STAFF_TYPE_CHANGE_REJECTED,
        'Staff position change rejected',
        `Your position change request was rejected: ${request.decision_reason}.`
    );

    return StaffTypeChangeMapper.toStaffTypeChangeDto(rejectedRequest);
};

const cancelStaffTypeChangeRequest = async (
    requestId,
    user,
    reason = null,
    auditContext = {}
) => {
    const request = await getRequestById(requestId);

    if (!STAFF_TYPE_CHANGE_ACTIVE_STATUSES.includes(request.status)) {
        throw new AppError(
            'Staff type change request cannot be cancelled in its current status',
            409,
            'STAFF_TYPE_CHANGE_REQUEST_NOT_CANCELLABLE'
        );
    }

    const profile = await getStaffProfileById(request.staff_profile_id);
    const isAdmin = user.role === USER_ROLES.ADMIN;
    const isTargetStaff = toIdString(profile.user_id) === toIdString(user._id);
    const requestSource = request.request_source
        || STAFF_TYPE_CHANGE_REQUEST_SOURCES.STAFF_SELF_REQUEST;
    const staffCanCancel = isTargetStaff
        && request.status === STAFF_TYPE_CHANGE_STATUS.REQUESTED
        && requestSource === STAFF_TYPE_CHANGE_REQUEST_SOURCES.STAFF_SELF_REQUEST;

    if (!isAdmin && !staffCanCancel) {
        throw new AppError(
            'You cannot cancel this staff type change request',
            403,
            'STAFF_TYPE_CHANGE_CANCEL_FORBIDDEN'
        );
    }

    const normalizedReason = normalizeText(reason);

    if (isAdmin && !normalizedReason) {
        throw new AppError(
            'Admin cancellation requires a reason',
            400,
            'STAFF_TYPE_CHANGE_CANCEL_REASON_REQUIRED'
        );
    }

    request.status = STAFF_TYPE_CHANGE_STATUS.CANCELLED;
    request.cancelled_by = user._id;
    request.cancelled_at = new Date();
    request.decision_reason = normalizedReason;
    await request.save();

    await recordChangeAudit({
        request,
        actorId: user._id,
        action: AUDIT_ACTIONS.STAFF_TYPE_CHANGE_CANCELLED,
        after: request,
        auditContext,
    });

    const cancelledRequest = await populateRequestQuery(
        StaffTypeChangeRequest.findById(request._id)
    );
    await notifyTargetStaff(
        cancelledRequest,
        NOTIFICATION_TYPES.STAFF_TYPE_CHANGE_CANCELLED,
        'Staff position change cancelled',
        'Your staff position change request was cancelled.'
    );

    return StaffTypeChangeMapper.toStaffTypeChangeDto(cancelledRequest);
};

const getStaffTypeChangeHistory = async (staffProfileId, query = {}) => {
    await getStaffProfileById(staffProfileId);

    return paginateRequests({
        staff_profile_id: staffProfileId,
        status: STAFF_TYPE_CHANGE_STATUS.APPLIED,
    }, query);
};

const processDueStaffTypeChanges = async ({ limit = 50 } = {}) => {
    const dueRequests = await StaffTypeChangeRequest.find({
        status: {
            $in: [
                STAFF_TYPE_CHANGE_STATUS.APPROVED,
                STAFF_TYPE_CHANGE_STATUS.SCHEDULED,
            ],
        },
        effective_at: { $lte: new Date() },
    })
        .sort({ effective_at: 1 })
        .limit(Math.max(1, Math.min(Number(limit) || 50, 200)));
    const result = {
        processed: 0,
        applied: 0,
        deferred: 0,
        failed: 0,
    };

    for (const dueRequest of dueRequests) {
        const claimed = await StaffTypeChangeRequest.findOneAndUpdate(
            {
                _id: dueRequest._id,
                status: {
                    $in: [
                        STAFF_TYPE_CHANGE_STATUS.APPROVED,
                        STAFF_TYPE_CHANGE_STATUS.SCHEDULED,
                    ],
                },
            },
            {
                $set: {
                    status: STAFF_TYPE_CHANGE_STATUS.APPROVED,
                    failure_reason: null,
                },
            },
            { new: true }
        );

        if (!claimed) {
            continue;
        }

        result.processed += 1;

        try {
            await applyApprovedRequest(claimed, {
                actorId: claimed.approved_by,
                emergencyOverride: claimed.emergency_override,
                overrideReason: claimed.override_reason,
            });
            result.applied += 1;
        } catch (error) {
            if ([
                'STAFF_HAS_ACTIVE_ASSIGNMENTS',
                'STAFF_HAS_FUTURE_ASSIGNMENTS',
            ].includes(error.errorCode)) {
                await StaffTypeChangeRequest.findByIdAndUpdate(claimed._id, {
                    $set: {
                        status: STAFF_TYPE_CHANGE_STATUS.SCHEDULED,
                        is_open: true,
                        failure_reason: error.message,
                    },
                });
                result.deferred += 1;
                continue;
            }

            const failedRequest = await StaffTypeChangeRequest.findByIdAndUpdate(
                claimed._id,
                {
                    $set: {
                        status: STAFF_TYPE_CHANGE_STATUS.FAILED,
                        is_open: false,
                        failure_reason: error.message,
                    },
                },
                { new: true }
            );

            if (failedRequest) {
                try {
                    await recordChangeAudit({
                        request: failedRequest,
                        actorId: null,
                        action: AUDIT_ACTIONS.STAFF_TYPE_CHANGE_FAILED,
                        before: { status: claimed.status },
                        after: failedRequest,
                    });
                } catch (auditError) {
                    console.warn('[staff-type-change] failure audit failed', {
                        request_id: failedRequest._id?.toString?.() || failedRequest._id,
                        error: auditError.message,
                    });
                }

                await notifyTargetStaff(
                    failedRequest,
                    NOTIFICATION_TYPES.STAFF_TYPE_CHANGE_FAILED,
                    'Staff position change failed',
                    `Your scheduled position change could not be applied: ${error.message}`
                );
            }
            result.failed += 1;
        }
    }

    return result;
};

module.exports = {
    createMyStaffTypeChangeRequest,
    createAdminStaffTypeChangeRequest,
    getMyStaffTypeChangeRequests,
    getAdminStaffTypeChangeRequests,
    getStaffTypeChangeImpact,
    approveStaffTypeChangeRequest,
    rejectStaffTypeChangeRequest,
    cancelStaffTypeChangeRequest,
    getStaffTypeChangeHistory,
    processDueStaffTypeChanges,
};
