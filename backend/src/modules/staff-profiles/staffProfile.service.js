const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const StaffProfile = require('./staffProfile.model');
const StaffProfileMapper = require('./staffProfile.mapper');
const User = require('../users/user.model');
const Garage = require('../garages/garage.model');
const Booking = require('../bookings/booking.model');
const PasswordReset = require('../auth/models/passwordResetToken.model');
const TokenService = require('../auth/services/token.service');
const emailService = require('../emails/email.service');
const notificationService = require('../notifications/notification.service');
const auditLogService = require('../audit-logs/auditLog.service');
const { hashToken } = require('../auth/security/token.hash');
const {
    PASSWORD_RESET_PURPOSES,
} = require('../auth/passwordResetPurpose.constant');
const { AppError } = require('../../shared/utils/appError');
const { USER_ROLES } = require('../../shared/constants/roles.constant');
const {
    USER_ONBOARDING_STATUSES,
} = require('../../shared/constants/userOnboarding.constant');
const {
    STAFF_EMPLOYMENT_STATUS,
    STAFF_EMPLOYMENT_STATUS_VALUES,
    STAFF_TYPE_VALUES,
} = require('../../shared/constants/staff.constant');
const {
    BOOKING_HOLD_SLOT_STATUSES,
} = require('../../shared/constants/booking.constant');
const { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } = require('../../shared/constants/audit.constant');
const { normalizePhone } = require('../../shared/utils/phone');
const {
    NOTIFICATION_TYPES,
    NOTIFICATION_RELATED_TYPES,
} = require('../../shared/constants/notification.constant');

const DEFAULT_STAFF_INVITE_HOURS = 24;
const DEFAULT_SALT_ROUNDS = 10;
const USER_POPULATE_FIELDS = 'full_name email phone role avatar_url is_active phone_verified_at onboarding_status last_login_at created_at updated_at';
const STAFF_ASSIGNMENT_BLOCKING_ITEM_STATUSES = ['PENDING', 'IN_PROGRESS'];

const normalizeText = (value) => {
    if (typeof value !== 'string') {
        return value;
    }

    return value.trim();
};

const normalizeStaffCode = (staffCode) => {
    if (typeof staffCode !== 'string') {
        return staffCode;
    }

    return staffCode.trim().toUpperCase();
};

const normalizeObjectIdOrNull = (value) => {
    if (value === null) {
        return null;
    }

    if (typeof value === 'string') {
        const trimmedValue = value.trim();

        if (!trimmedValue) {
            return null;
        }

        return trimmedValue;
    }

    return value;
};

const normalizeEmail = (value) => {
    if (!value) {
        return value;
    }

    return value.trim().toLowerCase();
};

const normalizeReason = (value) => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value !== 'string') {
        return value;
    }

    return value.trim() || null;
};

const getStaffProfileEmploymentStatus = (staffProfile) => {
    if (STAFF_EMPLOYMENT_STATUS_VALUES.includes(staffProfile?.employment_status)) {
        return staffProfile.employment_status;
    }

    return staffProfile?.is_active
        ? STAFF_EMPLOYMENT_STATUS.ACTIVE
        : STAFF_EMPLOYMENT_STATUS.SUSPENDED;
};

const getStaffUserId = (staffProfile) => {
    const user = staffProfile?.user_id;

    if (user && typeof user === 'object' && user._id) {
        return user._id;
    }

    return user || null;
};

const normalizeStaffInvitationPayload = (payload = {}) => {
    const invitePayload = {};

    if (payload.full_name !== undefined) {
        invitePayload.full_name = normalizeText(payload.full_name);
    }

    if (payload.email !== undefined) {
        invitePayload.email = normalizeEmail(payload.email);
    }

    if (payload.phone !== undefined) {
        invitePayload.phone = normalizePhone(payload.phone);
    }

    if (payload.staff_code !== undefined) {
        invitePayload.staff_code = normalizeStaffCode(payload.staff_code);
    }

    if (payload.staff_type !== undefined) {
        invitePayload.staff_type = normalizeText(payload.staff_type);
    }

    if (payload.garage_id !== undefined) {
        invitePayload.garage_id = normalizeObjectIdOrNull(payload.garage_id);
    }

    return invitePayload;
};

const normalizeCreatePayload = (payload = {}) => {
    const createPayload = {};

    if (payload.user_id !== undefined) {
        createPayload.user_id = normalizeObjectIdOrNull(payload.user_id);
    }

    if (payload.staff_code !== undefined) {
        createPayload.staff_code = normalizeStaffCode(payload.staff_code);
    }

    if (payload.staff_type !== undefined) {
        createPayload.staff_type = normalizeText(payload.staff_type);
    }

    if (payload.garage_id !== undefined) {
        createPayload.garage_id = normalizeObjectIdOrNull(payload.garage_id);
    }

    return createPayload;
};

const normalizeUpdatePayload = (payload = {}) => {
    const updatePayload = {};

    if (payload.staff_code !== undefined) {
        updatePayload.staff_code = normalizeStaffCode(payload.staff_code);
    }

    if (payload.staff_type !== undefined) {
        updatePayload.staff_type = normalizeText(payload.staff_type);
    }

    if (payload.garage_id !== undefined) {
        updatePayload.garage_id = normalizeObjectIdOrNull(payload.garage_id);
    }

    return updatePayload;
};

const buildSearchFilter = async ({ search, staff_type, garage_id, user_id, is_active } = {}) => {
    const filter = {};

    if (search) {
        const keyword = search.trim();
        const matchingUserIds = await User.distinct('_id', {
            role: USER_ROLES.STAFF,
            $or: [
                { full_name: { $regex: keyword, $options: 'i' } },
                { email: { $regex: keyword, $options: 'i' } },
                { phone: { $regex: keyword, $options: 'i' } },
            ],
        });

        filter.$or = [
            { staff_code: { $regex: keyword, $options: 'i' } },
            { user_id: { $in: matchingUserIds } },
        ];
    }

    if (staff_type) {
        filter.staff_type = staff_type;
    }

    if (garage_id) {
        filter.garage_id = garage_id;
    }

    if (user_id) {
        filter.user_id = user_id;
    }

    if (is_active !== undefined) {
        filter.is_active = is_active;
    }

    return filter;
};

const assertUpdatePayloadNotEmpty = (payload) => {
    if (!payload || Object.keys(payload).length === 0) {
        throw new AppError(
            'No valid fields to update',
            400,
            'NO_VALID_FIELDS_TO_UPDATE'
        );
    }
};

const assertStaffTypeValid = (staffType) => {
    if (staffType !== undefined && !STAFF_TYPE_VALUES.includes(staffType)) {
        throw new AppError('Invalid staff type', 400, 'INVALID_STAFF_TYPE');
    }
};

const assertStaffInviteUserAvailable = async ({ phone, email }) => {
    const existingPhone = await User.exists({ phone });

    if (existingPhone) {
        throw new AppError(
            'Phone already exists',
            409,
            'PHONE_ALREADY_EXISTS'
        );
    }

    const existingEmail = await User.exists({ email });

    if (existingEmail) {
        throw new AppError(
            'Email already exists',
            409,
            'EMAIL_ALREADY_EXISTS'
        );
    }
};

const getSaltRounds = () => {
    return Number(process.env.BCRYPT_SALT_ROUNDS) || DEFAULT_SALT_ROUNDS;
};

const getStaffInviteExpiresInHours = () => {
    return Number(process.env.STAFF_INVITE_EXPIRES_IN_HOURS)
        || DEFAULT_STAFF_INVITE_HOURS;
};

const getStaffInviteExpiresAt = () => {
    return new Date(
        Date.now() + getStaffInviteExpiresInHours() * 60 * 60 * 1000
    );
};

const generateInviteToken = () => {
    return crypto.randomBytes(64).toString('hex');
};

const createPlaceholderPasswordHash = async () => {
    return bcrypt.hash(generateInviteToken(), getSaltRounds());
};

const shouldExposeInviteToken = () => {
    return process.env.NODE_ENV !== 'production';
};

const createStaffInviteToken = async ({ user, session = null }) => {
    const inviteToken = generateInviteToken();
    const expiresAt = getStaffInviteExpiresAt();

    await PasswordReset.updateMany(
        {
            user_id: user._id,
            purpose: PASSWORD_RESET_PURPOSES.STAFF_INVITE,
            is_used: false,
        },
        {
            $set: {
                is_used: true,
                used_at: new Date(),
            },
        },
        session ? { session } : undefined
    );

    await PasswordReset.create(
        [
            {
                user_id: user._id,
                phone: user.phone,
                reset_token_hash: hashToken(inviteToken),
                purpose: PASSWORD_RESET_PURPOSES.STAFF_INVITE,
                expires_at: expiresAt,
            },
        ],
        session ? { session } : undefined
    );

    return {
        inviteToken,
        expiresAt,
        expiresInHours: getStaffInviteExpiresInHours(),
    };
};

const sendStaffInviteEmail = async ({ user, invitation }) => {
    const emailPayload = emailService.buildStaffInviteEmail({
        inviteToken: invitation.inviteToken,
        expiresInHours: invitation.expiresInHours,
        fullName: user.full_name,
        phone: user.phone,
    });

    return notificationService.createEmailNotification({
        userId: user._id,
        recipientEmail: user.email,
        type: NOTIFICATION_TYPES.AUTH_STAFF_INVITED,
        title: emailPayload.subject,
        message: emailPayload.text,
        relatedType: NOTIFICATION_RELATED_TYPES.AUTH,
        relatedId: user._id,
        metadata: {
            phone: user.phone,
            expires_in_hours: invitation.expiresInHours,
        },
        html: emailPayload.html,
        text: emailPayload.text,
        throwOnFailure: false,
    });
};

const toInviteResponse = ({ staffProfile, invitation, emailNotification }) => ({
    staff_profile: StaffProfileMapper.toStaffProfileDto(staffProfile),
    invite: {
        expires_at: invitation.expiresAt,
        email_status: emailNotification?.email_status || null,
        invite_token: shouldExposeInviteToken()
            ? invitation.inviteToken
            : undefined,
    },
});

const getGarageDocument = async (garageId) => {
    if (!garageId) {
        return null;
    }

    const garage = await Garage.findById(garageId);

    if (!garage) {
        throw new AppError('Garage not found', 404, 'GARAGE_NOT_FOUND');
    }

    if (!garage.is_active) {
        throw new AppError('Garage is inactive', 400, 'GARAGE_INACTIVE');
    }

    return garage;
};

const getStaffUserDocument = async (userId) => {
    const user = await User.findById(userId);

    if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (user.role !== USER_ROLES.STAFF) {
        throw new AppError(
            'User must have STAFF role',
            400,
            'USER_MUST_HAVE_STAFF_ROLE'
        );
    }

    return user;
};

const assertStaffUserCanBeActivated = (user, { allowInactiveUser = false } = {}) => {
    const onboardingStatus = user?.onboarding_status
        || USER_ONBOARDING_STATUSES.ACTIVE;

    if (
        !user
        || typeof user !== 'object'
        || user.role !== USER_ROLES.STAFF
        || (!allowInactiveUser && !user.is_active)
        || onboardingStatus !== USER_ONBOARDING_STATUSES.ACTIVE
        || !user.phone_verified_at
    ) {
        throw new AppError(
            'Staff must complete password setup and phone verification before activation',
            409,
            'STAFF_PROFILE_ACTIVATION_REQUIRES_COMPLETED_ONBOARDING'
        );
    }
};

const assertStaffProfileCanBeReactivated = (staffProfile) => {
    if (
        getStaffProfileEmploymentStatus(staffProfile)
        === STAFF_EMPLOYMENT_STATUS.TERMINATED
    ) {
        throw new AppError(
            'Terminated staff profile cannot be activated',
            409,
            'STAFF_PROFILE_TERMINATED'
        );
    }

    assertStaffUserCanBeActivated(staffProfile.user_id, {
        allowInactiveUser: true,
    });
};

const applySessionToQuery = (query, session) => {
    if (session && query && typeof query.session === 'function') {
        return query.session(session);
    }

    return query;
};

const assertNoActiveStaffAssignments = async (staffProfileId, session = null) => {
    const query = Booking.findOne({
        status: { $in: BOOKING_HOLD_SLOT_STATUSES },
        $or: [
            { assigned_care_staff_ids: staffProfileId },
            {
                booking_items: {
                    $elemMatch: {
                        status: { $in: STAFF_ASSIGNMENT_BLOCKING_ITEM_STATUSES },
                        assigned_care_staff: {
                            $elemMatch: {
                                staff_profile_id: staffProfileId,
                                released_at: null,
                            },
                        },
                    },
                },
            },
        ],
    });
    const activeAssignment = await applySessionToQuery(query, session);

    if (activeAssignment) {
        throw new AppError(
            'Staff has active assignments',
            409,
            'STAFF_HAS_ACTIVE_ASSIGNMENTS'
        );
    }
};

const getStaffProfileDocumentById = async (staffProfileId) => {
    const staffProfile = await StaffProfile.findById(staffProfileId).populate(
        'user_id',
        USER_POPULATE_FIELDS
    );

    if (!staffProfile) {
        throw new AppError(
            'Staff profile not found',
            404,
            'STAFF_PROFILE_NOT_FOUND'
        );
    }

    return staffProfile;
};

const assertStaffProfileUserAvailable = async (userId) => {
    const existed = await StaffProfile.exists({ user_id: userId });

    if (existed) {
        throw new AppError(
            'Staff profile for this user already exists',
            409,
            'STAFF_PROFILE_USER_ALREADY_EXISTS'
        );
    }
};

const assertStaffCodeAvailable = async (staffCode, ignoredStaffProfileId = null) => {
    if (!staffCode) {
        return;
    }

    const filter = { staff_code: staffCode };

    if (ignoredStaffProfileId) {
        filter._id = { $ne: ignoredStaffProfileId };
    }

    const existed = await StaffProfile.exists(filter);

    if (existed) {
        throw new AppError(
            'Staff code already exists',
            409,
            'STAFF_CODE_ALREADY_EXISTS'
        );
    }
};

const getMyStaffProfile = async (userId) => {
    const staffProfile = await StaffProfile.findOne({ user_id: userId }).populate(
        'user_id',
        USER_POPULATE_FIELDS
    );

    if (!staffProfile) {
        throw new AppError(
            'Staff profile not found',
            404,
            'STAFF_PROFILE_NOT_FOUND'
        );
    }

    return StaffProfileMapper.toStaffProfileDto(staffProfile);
};

const getStaffProfileById = async (staffProfileId) => {
    const staffProfile = await getStaffProfileDocumentById(staffProfileId);

    return StaffProfileMapper.toStaffProfileDto(staffProfile);
};

const getAllStaffProfiles = async ({ page = 1, limit = 20, search, staff_type, garage_id, user_id, is_active } = {}) => {
    const filter = await buildSearchFilter({ search, staff_type, garage_id, user_id, is_active });
    const skip = (page - 1) * limit;

    const [staffProfiles, total] = await Promise.all([
        StaffProfile.find(filter)
            .populate(
                'user_id',
                USER_POPULATE_FIELDS
            )
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit),
        StaffProfile.countDocuments(filter),
    ]);

    return {
        data: StaffProfileMapper.toStaffProfileDtoList(staffProfiles),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

const createStaffProfile = async (payload = {}) => {
    const createPayload = normalizeCreatePayload(
        StaffProfileMapper.toCreatePayload(payload)
    );

    assertStaffTypeValid(createPayload.staff_type);
    const staffUser = await getStaffUserDocument(createPayload.user_id);
    await getGarageDocument(createPayload.garage_id);
    await assertStaffProfileUserAvailable(createPayload.user_id);
    await assertStaffCodeAvailable(createPayload.staff_code);

    assertStaffUserCanBeActivated(staffUser);

    const createdStaffProfile = await StaffProfile.create(createPayload);

    const staffProfile = await getStaffProfileDocumentById(createdStaffProfile._id);

    return StaffProfileMapper.toStaffProfileDto(staffProfile);
};

const updateStaffProfile = async (staffProfileId, payload = {}) => {
    if (payload.staff_type !== undefined) {
        throw new AppError(
            'Staff type must be changed through the staff type change workflow',
            409,
            'STAFF_TYPE_CHANGE_WORKFLOW_REQUIRED'
        );
    }

    const updatePayload = normalizeUpdatePayload(
        StaffProfileMapper.toUpdatePayload(payload)
    );

    assertUpdatePayloadNotEmpty(updatePayload);
    assertStaffTypeValid(updatePayload.staff_type);

    await getStaffProfileDocumentById(staffProfileId);
    await getGarageDocument(updatePayload.garage_id);
    await assertStaffCodeAvailable(updatePayload.staff_code, staffProfileId);

    const updatedStaffProfile = await StaffProfile.findByIdAndUpdate(
        staffProfileId,
        { $set: updatePayload },
        { new: true, runValidators: true }
    ).populate(
        'user_id',
        USER_POPULATE_FIELDS
    );

    return StaffProfileMapper.toStaffProfileDto(updatedStaffProfile);
};

const updateStaffEmploymentStatus = async (
    staffProfileId,
    employmentStatus,
    { reason = null, actorId = null, auditContext = {} } = {}
) => {
    if (!STAFF_EMPLOYMENT_STATUS_VALUES.includes(employmentStatus)) {
        throw new AppError(
            'Invalid staff employment status',
            400,
            'INVALID_STAFF_EMPLOYMENT_STATUS'
        );
    }

    const staffProfile = await getStaffProfileDocumentById(staffProfileId);
    const currentEmploymentStatus = getStaffProfileEmploymentStatus(staffProfile);
    const staffUserId = getStaffUserId(staffProfile);
    const normalizedReason = normalizeReason(reason);

    if (
        currentEmploymentStatus === employmentStatus
        && staffProfile.is_active === (employmentStatus === STAFF_EMPLOYMENT_STATUS.ACTIVE)
        && staffProfile.user_id?.is_active === (employmentStatus === STAFF_EMPLOYMENT_STATUS.ACTIVE)
    ) {
        throw new AppError('Staff profile status is unchanged', 400, 'NO_CHANGE');
    }

    if (
        currentEmploymentStatus === STAFF_EMPLOYMENT_STATUS.TERMINATED
        && employmentStatus !== STAFF_EMPLOYMENT_STATUS.TERMINATED
    ) {
        throw new AppError(
            'Terminated staff profile cannot change status',
            409,
            'STAFF_PROFILE_TERMINATED'
        );
    }

    if (employmentStatus === STAFF_EMPLOYMENT_STATUS.ACTIVE) {
        assertStaffProfileCanBeReactivated(staffProfile);
    }

    const session = await mongoose.startSession();
    let updatedStaffProfile;

    try {
        await session.withTransaction(async () => {
            if (employmentStatus === STAFF_EMPLOYMENT_STATUS.TERMINATED) {
                await assertNoActiveStaffAssignments(staffProfile._id, session);
            }

            const now = new Date();
            const isActive = employmentStatus === STAFF_EMPLOYMENT_STATUS.ACTIVE;
            const staffProfileUpdate = {
                is_active: isActive,
                employment_status: employmentStatus,
                status_reason: normalizedReason,
                status_changed_at: now,
                status_changed_by: actorId,
            };

            if (employmentStatus === STAFF_EMPLOYMENT_STATUS.SUSPENDED) {
                staffProfileUpdate.suspended_at = now;
            }

            if (employmentStatus === STAFF_EMPLOYMENT_STATUS.TERMINATED) {
                staffProfileUpdate.terminated_at = now;
            }

            updatedStaffProfile = await StaffProfile.findByIdAndUpdate(
                staffProfileId,
                { $set: staffProfileUpdate },
                { new: true, runValidators: true, session }
            ).populate(
                'user_id',
                USER_POPULATE_FIELDS
            );

            await User.findByIdAndUpdate(
                staffUserId,
                { $set: { is_active: isActive } },
                { new: true, runValidators: true, session }
            );

            if (!isActive) {
                const revokedReason = employmentStatus === STAFF_EMPLOYMENT_STATUS.TERMINATED
                    ? 'staff_terminated'
                    : 'staff_suspended';
                await TokenService.revokeAllByUser(staffUserId, revokedReason, session);
            }

            await auditLogService.recordAuditEvent({
                actorId,
                action: employmentStatus === STAFF_EMPLOYMENT_STATUS.TERMINATED
                    ? AUDIT_ACTIONS.DELETE
                    : AUDIT_ACTIONS.UPDATE,
                resourceType: AUDIT_RESOURCE_TYPES.STAFF_PROFILE,
                resourceId: staffProfileId,
                before: staffProfile,
                after: updatedStaffProfile,
                ip: auditContext.ip,
                userAgent: auditContext.userAgent,
                metadata: {
                    employment_status: employmentStatus,
                    reason: normalizedReason,
                    user_id: staffUserId?.toString(),
                },
                session,
            });
        });
    } finally {
        await session.endSession();
    }

    return StaffProfileMapper.toStaffProfileDto(updatedStaffProfile);
};

const updateStaffProfileStatus = async (staffProfileId, isActive, options = {}) => {
    return updateStaffEmploymentStatus(
        staffProfileId,
        isActive
            ? STAFF_EMPLOYMENT_STATUS.ACTIVE
            : STAFF_EMPLOYMENT_STATUS.SUSPENDED,
        options
    );
};

const terminateStaffProfile = async (staffProfileId, options = {}) => {
    return updateStaffEmploymentStatus(
        staffProfileId,
        STAFF_EMPLOYMENT_STATUS.TERMINATED,
        options
    );
};

const inviteStaff = async (payload = {}) => {
    const invitePayload = normalizeStaffInvitationPayload(payload);

    assertStaffTypeValid(invitePayload.staff_type);
    await getGarageDocument(invitePayload.garage_id);
    await assertStaffCodeAvailable(invitePayload.staff_code);
    await assertStaffInviteUserAvailable({
        phone: invitePayload.phone,
        email: invitePayload.email,
    });

    const passwordHash = await createPlaceholderPasswordHash();
    const session = await mongoose.startSession();
    let createdUser;
    let createdStaffProfile;
    let invitation;

    try {
        await session.withTransaction(async () => {
            [createdUser] = await User.create(
                [
                    {
                        full_name: invitePayload.full_name,
                        email: invitePayload.email,
                        phone: invitePayload.phone,
                        password_hash: passwordHash,
                        role: USER_ROLES.STAFF,
                        is_active: true,
                        phone_verified_at: null,
                        onboarding_status: USER_ONBOARDING_STATUSES.PENDING_PASSWORD_SETUP,
                    },
                ],
                { session }
            );

            [createdStaffProfile] = await StaffProfile.create(
                [
                    {
                        user_id: createdUser._id,
                        staff_code: invitePayload.staff_code,
                        staff_type: invitePayload.staff_type,
                        garage_id: invitePayload.garage_id,
                        is_active: false,
                    },
                ],
                { session }
            );

            invitation = await createStaffInviteToken({
                user: createdUser,
                session,
            });
        });
    } finally {
        await session.endSession();
    }

    const staffProfile = await getStaffProfileDocumentById(createdStaffProfile._id);
    const emailNotification = await sendStaffInviteEmail({
        user: createdUser,
        invitation,
    });

    return toInviteResponse({
        staffProfile,
        invitation,
        emailNotification,
    });
};

const resendStaffInvitation = async (staffProfileId) => {
    const staffProfile = await getStaffProfileDocumentById(staffProfileId);
    const user = staffProfile.user_id;

    if (!user || typeof user !== 'object') {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (
        user.role !== USER_ROLES.STAFF
        || user.onboarding_status !== USER_ONBOARDING_STATUSES.PENDING_PASSWORD_SETUP
    ) {
        throw new AppError(
            'Staff invitation is not pending password setup',
            400,
            'STAFF_INVITATION_NOT_PENDING'
        );
    }

    const invitation = await createStaffInviteToken({ user });
    const emailNotification = await sendStaffInviteEmail({
        user,
        invitation,
    });

    return toInviteResponse({
        staffProfile,
        invitation,
        emailNotification,
    });
};

module.exports = {
    getMyStaffProfile,
    getStaffProfileById,
    getAllStaffProfiles,
    inviteStaff,
    resendStaffInvitation,
    createStaffProfile,
    updateStaffProfile,
    updateStaffProfileStatus,
    updateStaffEmploymentStatus,
    terminateStaffProfile,
};
