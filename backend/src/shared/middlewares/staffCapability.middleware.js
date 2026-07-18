const StaffProfile = require('../../modules/staff-profiles/staffProfile.model');
const { AppError } = require('../utils/appError');
const { USER_ROLES } = require('../constants/roles.constant');
const {
    STAFF_EMPLOYMENT_STATUS,
    STAFF_CAPABILITY_VALUES,
    getStaffCapabilities,
    getStaffGroup,
} = require('../constants/staff.constant');

const toId = (value) => {
    if (!value) {
        return null;
    }

    return value._id?.toString?.() || value.toString?.() || value;
};

const buildAdminContext = (user) => ({
    is_admin: true,
    user_id: toId(user?._id),
    staff_profile_id: null,
    staff_type: null,
    staff_group: null,
    garage_id: null,
    capabilities: ['*'],
});

const resolveStaffContext = async (req) => {
    if (req.staffContext) {
        return req.staffContext;
    }

    if (!req.user) {
        throw new AppError(
            'Authentication required',
            401,
            'AUTHENTICATION_REQUIRED'
        );
    }

    if (req.user.role === USER_ROLES.ADMIN) {
        req.staffContext = buildAdminContext(req.user);
        return req.staffContext;
    }

    if (req.user.role !== USER_ROLES.STAFF) {
        throw new AppError(
            'Staff authorization is required',
            403,
            'STAFF_AUTHORIZATION_REQUIRED'
        );
    }

    const staffProfile = await StaffProfile.findOne({ user_id: req.user._id });

    if (!staffProfile) {
        throw new AppError(
            'Staff profile not found',
            403,
            'STAFF_PROFILE_NOT_FOUND'
        );
    }

    const employmentStatus = staffProfile.employment_status
        || (staffProfile.is_active
            ? STAFF_EMPLOYMENT_STATUS.ACTIVE
            : STAFF_EMPLOYMENT_STATUS.SUSPENDED);

    if (!staffProfile.is_active || employmentStatus !== STAFF_EMPLOYMENT_STATUS.ACTIVE) {
        throw new AppError(
            'Staff profile is not active',
            403,
            'STAFF_PROFILE_INACTIVE'
        );
    }

    req.staffContext = {
        is_admin: false,
        user_id: toId(req.user._id),
        staff_profile_id: toId(staffProfile._id),
        staff_type: staffProfile.staff_type,
        staff_group: getStaffGroup(staffProfile.staff_type),
        garage_id: toId(staffProfile.garage_id),
        capabilities: getStaffCapabilities(staffProfile.staff_type),
    };

    return req.staffContext;
};

const validateCapabilityConfiguration = (capabilities) => {
    const invalidCapabilities = capabilities.filter(
        (capability) => !STAFF_CAPABILITY_VALUES.includes(capability)
    );

    if (invalidCapabilities.length > 0) {
        throw new AppError(
            'Invalid staff capability configuration',
            500,
            'INVALID_STAFF_CAPABILITY_CONFIG'
        );
    }
};

const normalizeRequiredCapabilities = (required, req) => {
    const value = typeof required === 'function' ? required(req) : required;
    const capabilities = Array.isArray(value) ? value : [value];
    const normalizedCapabilities = capabilities.filter(Boolean);

    validateCapabilityConfiguration(normalizedCapabilities);

    if (normalizedCapabilities.length === 0) {
        throw new AppError(
            'Staff capability configuration is empty',
            500,
            'EMPTY_STAFF_CAPABILITY_CONFIG'
        );
    }

    return normalizedCapabilities;
};

const createCapabilityMiddleware = (required, matchAny) => async (req, res, next) => {
    try {
        const requiredCapabilities = normalizeRequiredCapabilities(required, req);
        const context = await resolveStaffContext(req);

        if (context.is_admin) {
            return next();
        }

        const allowed = matchAny
            ? requiredCapabilities.some((capability) => context.capabilities.includes(capability))
            : requiredCapabilities.every((capability) => context.capabilities.includes(capability));

        if (!allowed) {
            return next(
                new AppError(
                    'You do not have the required staff capability',
                    403,
                    'STAFF_CAPABILITY_REQUIRED'
                )
            );
        }

        return next();
    } catch (error) {
        return next(error);
    }
};

const attachStaffContext = async (req, res, next) => {
    try {
        await resolveStaffContext(req);
        return next();
    } catch (error) {
        return next(error);
    }
};

const requireStaffCapabilities = (...capabilities) => (
    createCapabilityMiddleware(capabilities, false)
);

const requireAnyStaffCapability = (...capabilities) => (
    createCapabilityMiddleware(capabilities, true)
);

const requireResolvedStaffCapability = (resolver) => (
    createCapabilityMiddleware(resolver, false)
);

module.exports = {
    resolveStaffContext,
    attachStaffContext,
    requireStaffCapabilities,
    requireAnyStaffCapability,
    requireResolvedStaffCapability,
};
