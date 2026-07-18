const Booking = require('../bookings/booking.model');
const StaffProfile = require('../staff-profiles/staffProfile.model');
const VehicleInspection = require('./vehicleInspection.model');
const VehicleInspectionMapper = require('./vehicleInspection.mapper');
const { AppError } = require('../../shared/utils/appError');
const { USER_ROLES } = require('../../shared/constants/roles.constant');
const { BOOKING_STATUS } = require('../../shared/constants/booking.constant');
const { VEHICLE_INSPECTION_TYPES } = require('../../shared/constants/vehicleInspection.constant');
const {
    STAFF_CAPABILITIES,
    staffTypeHasCapability,
} = require('../../shared/constants/staff.constant');

const normalizeText = (value) => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value !== 'string') {
        return value;
    }

    const trimmedValue = value.trim();

    return trimmedValue || null;
};

const normalizeImages = (images = []) => {
    return images.map((image) => ({
        image_url: image.image_url.trim(),
        public_id: normalizeText(image.public_id),
        caption: normalizeText(image.caption),
    }));
};

const populateInspectionQuery = (query) => {
    return query.populate('inspected_by', 'full_name email phone role is_active');
};

const getBookingDocumentById = async (bookingId) => {
    const booking = await Booking.findById(bookingId);

    if (!booking) {
        throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    return booking;
};

const getActiveStaffProfile = async (staffUserId) => {
    const staffProfile = await StaffProfile.findOne({
        user_id: staffUserId,
        is_active: true,
    });

    if (!staffProfile) {
        throw new AppError('Staff profile not found', 404, 'STAFF_PROFILE_NOT_FOUND');
    }

    return staffProfile;
};

const assertStaffCanAccessBooking = async (
    user,
    booking,
    { requireCreateCapability = false } = {}
) => {
    if (user.role === USER_ROLES.ADMIN) {
        return;
    }

    const staffProfile = await getActiveStaffProfile(user._id);

    if (!staffProfile.garage_id) {
        throw new AppError('Staff is not assigned to any garage', 403, 'STAFF_GARAGE_NOT_ASSIGNED');
    }

    if (staffProfile.garage_id.toString() !== booking.garage_id.toString()) {
        throw new AppError('Staff cannot access bookings outside assigned garage', 403, 'STAFF_GARAGE_ACCESS_DENIED');
    }

    const requiredCapability = requireCreateCapability
        ? STAFF_CAPABILITIES.INSPECTION_CREATE_ASSIGNED
        : STAFF_CAPABILITIES.INSPECTION_READ_ASSIGNED;
    const hasGarageRead = staffTypeHasCapability(
        staffProfile.staff_type,
        STAFF_CAPABILITIES.INSPECTION_READ_GARAGE
    );

    if (requireCreateCapability && !staffTypeHasCapability(
        staffProfile.staff_type,
        requiredCapability
    )) {
        throw new AppError(
            'Staff is not allowed to create vehicle inspections',
            403,
            'INSPECTION_CAPABILITY_REQUIRED'
        );
    }

    if (!requireCreateCapability && !hasGarageRead && !staffTypeHasCapability(
        staffProfile.staff_type,
        requiredCapability
    )) {
        throw new AppError(
            'Staff is not allowed to view vehicle inspections',
            403,
            'INSPECTION_CAPABILITY_REQUIRED'
        );
    }

    if (!hasGarageRead && (
        !booking.assigned_inspection_staff_id
        || booking.assigned_inspection_staff_id.toString() !== user._id.toString()
    )) {
        throw new AppError(
            'Inspection staff must be assigned to this booking',
            403,
            'INSPECTION_ASSIGNMENT_REQUIRED'
        );
    }
};

const assertCustomerCanAccessBooking = (customerId, booking) => {
    if (!booking.customer_id || booking.customer_id.toString() !== customerId.toString()) {
        throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }
};

const assertInspectionTypeAllowed = (booking, type) => {
    if (type === VEHICLE_INSPECTION_TYPES.BEFORE_WASH) {
        const allowedStatuses = [BOOKING_STATUS.CHECKED_IN, BOOKING_STATUS.IN_PROGRESS];

        if (!allowedStatuses.includes(booking.status)) {
            throw new AppError(
                'Before-wash inspection can only be created after check-in and before completion',
                400,
                'BEFORE_WASH_INSPECTION_NOT_ALLOWED'
            );
        }
    }

    if (type === VEHICLE_INSPECTION_TYPES.AFTER_WASH) {
        const allowedStatuses = [BOOKING_STATUS.IN_PROGRESS, BOOKING_STATUS.COMPLETED];

        if (!allowedStatuses.includes(booking.status)) {
            throw new AppError(
                'After-wash inspection can only be created during or after service',
                400,
                'AFTER_WASH_INSPECTION_NOT_ALLOWED'
            );
        }
    }
};

const createInspection = async (user, bookingId, payload = {}) => {
    const booking = await getBookingDocumentById(bookingId);

    await assertStaffCanAccessBooking(user, booking, { requireCreateCapability: true });
    assertInspectionTypeAllowed(booking, payload.type);

    const existedInspection = await VehicleInspection.exists({
        booking_id: booking._id,
        type: payload.type,
    });

    if (existedInspection) {
        throw new AppError('Inspection already exists for this booking and type', 409, 'VEHICLE_INSPECTION_ALREADY_EXISTS');
    }

    const inspection = await VehicleInspection.create({
        booking_id: booking._id,
        type: payload.type,
        note: normalizeText(payload.note),
        images: normalizeImages(payload.images || []),
        inspected_by: user._id,
        inspected_at: new Date(),
    });

    const populatedInspection = await populateInspectionQuery(VehicleInspection.findById(inspection._id));

    return VehicleInspectionMapper.toVehicleInspectionDto(populatedInspection);
};

const getAdminBookingInspections = async (user, bookingId) => {
    const booking = await getBookingDocumentById(bookingId);

    await assertStaffCanAccessBooking(user, booking);

    const inspections = await populateInspectionQuery(
        VehicleInspection.find({ booking_id: booking._id }).sort({ inspected_at: 1 })
    );

    return VehicleInspectionMapper.toVehicleInspectionDtoList(inspections);
};

const getMyBookingInspections = async (customerId, bookingId) => {
    const booking = await getBookingDocumentById(bookingId);

    assertCustomerCanAccessBooking(customerId, booking);

    const inspections = await populateInspectionQuery(
        VehicleInspection.find({ booking_id: booking._id }).sort({ inspected_at: 1 })
    );

    return VehicleInspectionMapper.toVehicleInspectionDtoList(inspections);
};

module.exports = {
    createInspection,
    getAdminBookingInspections,
    getMyBookingInspections,
};
