const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const StaffProfile = require('./staffProfile.model');
const StaffProfileMapper = require('./staffProfile.mapper');
const User = require('../users/user.model');
const Garage = require('../garages/garage.model');
const PasswordReset = require('../auth/models/passwordResetToken.model');
const emailService = require('../emails/email.service');
const notificationService = require('../notifications/notification.service');
const { hashToken } = require('../auth/security/token.hash');
const {
    PASSWORD_RESET_PURPOSES,
} = require('../auth/passwordResetPurpose.constant');
const { AppError } = require('../../shared/utils/appError');
const { USER_ROLES } = require('../../shared/constants/roles.constant');
const {
    USER_ONBOARDING_STATUSES,
} = require('../../shared/constants/userOnboarding.constant');
const { STAFF_TYPE_VALUES } = require('../../shared/constants/staff.constant');
const { normalizePhone } = require('../../shared/utils/phone');
const {
    NOTIFICATION_TYPES,
    NOTIFICATION_RELATED_TYPES,
} = require('../../shared/constants/notification.constant');

const DEFAULT_STAFF_INVITE_HOURS = 24;
const DEFAULT_SALT_ROUNDS = 10;
const USER_POPULATE_FIELDS = 'full_name email phone role avatar_url is_active phone_verified_at onboarding_status last_login_at created_at updated_at';

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

const buildSearchFilter = ({ search, staff_type, garage_id, user_id, is_active } = {}) => {
    const filter = {};

    if (search) {
        const keyword = search.trim();

        filter.staff_code = { $regex: keyword, $options: 'i' };
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

const assertStaffUserCanBeActivated = (user) => {
    const onboardingStatus = user?.onboarding_status
        || USER_ONBOARDING_STATUSES.ACTIVE;

    if (
        !user
        || typeof user !== 'object'
        || user.role !== USER_ROLES.STAFF
        || !user.is_active
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
    const filter = buildSearchFilter({ search, staff_type, garage_id, user_id, is_active });
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

const updateStaffProfileStatus = async (staffProfileId, isActive) => {
    const staffProfile = await getStaffProfileDocumentById(staffProfileId);

    if (staffProfile.is_active === isActive) {
        throw new AppError('Staff profile status is unchanged', 400, 'NO_CHANGE');
    }

    if (isActive) {
        assertStaffUserCanBeActivated(staffProfile.user_id);
    }

    const updatedStaffProfile = await StaffProfile.findByIdAndUpdate(
        staffProfileId,
        { $set: { is_active: isActive } },
        { new: true, runValidators: true }
    ).populate(
        'user_id',
        USER_POPULATE_FIELDS
    );

    return StaffProfileMapper.toStaffProfileDto(updatedStaffProfile);
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
};
