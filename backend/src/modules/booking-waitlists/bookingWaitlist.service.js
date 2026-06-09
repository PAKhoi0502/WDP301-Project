const BookingWaitlist = require('./bookingWaitlist.model');
const BookingWaitlistMapper = require('./bookingWaitlist.mapper');
const Vehicle = require('../vehicles/vehicle.model');
const Garage = require('../garages/garage.model');
const ServicePackage = require('../service-packages/servicePackage.model');
const StaffProfile = require('../staff-profiles/staffProfile.model');
const notificationService = require('../notifications/notification.service');
const { AppError } = require('../../shared/utils/appError');
const { USER_ROLES } = require('../../shared/constants/roles.constant');
const {
    WAITLIST_STATUS,
    WAITLIST_ACTIVE_STATUSES,
} = require('../../shared/constants/waitlist.constant');
const {
    NOTIFICATION_TYPES,
    NOTIFICATION_RELATED_TYPES,
} = require('../../shared/constants/notification.constant');

const DEFAULT_OFFER_EXPIRE_MINUTES = Number(process.env.WAITLIST_OFFER_EXPIRE_MINUTES) || 15;
const DEFAULT_TIMEZONE_OFFSET = process.env.APP_TIMEZONE_OFFSET || '+07:00';

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

const toObjectIdString = (value) => {
    if (!value) {
        return null;
    }

    return value._id ? value._id.toString() : value.toString();
};

const parseDateTime = (value, fieldName = 'datetime') => {
    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
        throw new AppError(`${fieldName} is invalid`, 400, 'INVALID_DATETIME');
    }

    return date;
};

const normalizeAddOnServiceIds = (addOnServiceIds = []) => {
    return [...new Set((addOnServiceIds || [])
        .map((item) => toObjectIdString(item))
        .filter(Boolean))]
        .sort();
};

const areSameAddOnSet = (left = [], right = []) => {
    const normalizedLeft = normalizeAddOnServiceIds(left);
    const normalizedRight = normalizeAddOnServiceIds(right);

    if (normalizedLeft.length !== normalizedRight.length) {
        return false;
    }

    return normalizedLeft.every((item, index) => item === normalizedRight[index]);
};

const addMinutes = (date, minutes) => {
    return new Date(date.getTime() + minutes * 60 * 1000);
};

const normalizeOfferExpireMinutes = (value) => {
    if (value === undefined || value === null) {
        return DEFAULT_OFFER_EXPIRE_MINUTES;
    }

    const minutes = Number(value);

    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
        throw new AppError('Offer expiration minutes must be between 1 and 1440', 400, 'INVALID_WAITLIST_OFFER_EXPIRE_MINUTES');
    }

    return minutes;
};

const getTimezoneOffsetMinutes = (offset) => {
    const match = /^([+-])(\d{2}):(\d{2})$/.exec(offset);

    if (!match) {
        return 0;
    }

    const direction = match[1] === '-' ? -1 : 1;
    const hours = Number(match[2]);
    const minutes = Number(match[3]);

    return direction * ((hours * 60) + minutes);
};

const toLocalDateString = (date) => {
    const offsetMinutes = getTimezoneOffsetMinutes(DEFAULT_TIMEZONE_OFFSET);
    const shiftedDate = new Date(date.getTime() + offsetMinutes * 60 * 1000);

    return shiftedDate.toISOString().slice(0, 10);
};

const populateWaitlistQuery = (query) => {
    return query
        .populate('customer_id', 'full_name email phone role is_active')
        .populate('vehicle_id', 'raw_license_plate normalized_license_plate vehicle_type engine_type brand model color is_active')
        .populate('garage_id', 'name garage_code address city is_active')
        .populate('service_package_id', 'name vehicle_type service_type base_price duration_minutes requires_wash_bay requires_care_staff is_active')
        .populate('canceled_by_id', 'full_name email phone role is_active')
        .populate('created_booking_id', 'start_time end_time status payment_status')
        .populate('source_booking_id', 'start_time end_time status payment_status');
};

const getWaitlistDocumentById = async (waitlistId) => {
    const waitlist = await populateWaitlistQuery(BookingWaitlist.findById(waitlistId));

    if (!waitlist) {
        throw new AppError('Waitlist entry not found', 404, 'WAITLIST_NOT_FOUND');
    }

    return waitlist;
};

const getRawWaitlistDocumentById = async (waitlistId) => {
    const waitlist = await BookingWaitlist.findById(waitlistId);

    if (!waitlist) {
        throw new AppError('Waitlist entry not found', 404, 'WAITLIST_NOT_FOUND');
    }

    return waitlist;
};

const getActiveVehicleForCustomer = async (vehicleId, customerId) => {
    const vehicle = await Vehicle.findOne({
        _id: vehicleId,
        customer_id: customerId,
        is_active: true,
    });

    if (!vehicle) {
        throw new AppError('Vehicle not found', 404, 'VEHICLE_NOT_FOUND');
    }

    return vehicle;
};

const getActiveGarage = async (garageId) => {
    const garage = await Garage.findById(garageId);

    if (!garage) {
        throw new AppError('Garage not found', 404, 'GARAGE_NOT_FOUND');
    }

    if (!garage.is_active) {
        throw new AppError('Garage is inactive', 400, 'GARAGE_INACTIVE');
    }

    return garage;
};

const getActiveServicePackage = async (servicePackageId) => {
    const servicePackage = await ServicePackage.findById(servicePackageId);

    if (!servicePackage) {
        throw new AppError('Service package not found', 404, 'SERVICE_PACKAGE_NOT_FOUND');
    }

    if (!servicePackage.is_active) {
        throw new AppError('Service package is inactive', 400, 'SERVICE_PACKAGE_INACTIVE');
    }

    return servicePackage;
};

const getActiveAddOnServices = async (addOnServiceIds = [], vehicleType) => {
    const normalizedIds = normalizeAddOnServiceIds(addOnServiceIds);

    if (normalizedIds.length === 0) {
        return [];
    }

    const services = await ServicePackage.find({
        _id: { $in: normalizedIds },
        is_active: true,
    });

    if (services.length !== normalizedIds.length) {
        throw new AppError('One or more add-on services are invalid or inactive', 400, 'INVALID_WAITLIST_ADD_ON_SERVICE');
    }

    for (const service of services) {
        if (service.vehicle_type !== vehicleType) {
            throw new AppError('Add-on service does not match vehicle type', 400, 'WAITLIST_SERVICE_VEHICLE_TYPE_MISMATCH');
        }
    }

    return services;
};

const assertServiceMatchesVehicle = (servicePackage, vehicleType) => {
    if (servicePackage.vehicle_type !== vehicleType) {
        throw new AppError('Service package does not match vehicle type', 400, 'WAITLIST_SERVICE_VEHICLE_TYPE_MISMATCH');
    }
};

const assertDesiredStartTimeIsFuture = (desiredStartTime) => {
    if (desiredStartTime <= new Date()) {
        throw new AppError('Waitlist desired start time must be in the future', 400, 'WAITLIST_START_TIME_IN_PAST');
    }
};

const assertNoActiveDuplicateWaitlist = async ({
    customerId,
    vehicleId,
    garageId,
    servicePackageId,
    addOnServiceIds,
    desiredStartTime,
}) => {
    const candidates = await BookingWaitlist.find({
        customer_id: customerId,
        vehicle_id: vehicleId,
        garage_id: garageId,
        service_package_id: servicePackageId,
        desired_start_time: desiredStartTime,
        status: { $in: WAITLIST_ACTIVE_STATUSES },
    });

    const existed = candidates.some((item) => areSameAddOnSet(item.add_on_service_ids, addOnServiceIds));

    if (existed) {
        throw new AppError('Active waitlist entry already exists for this slot', 409, 'WAITLIST_ALREADY_EXISTS');
    }
};

const assertDesiredSlotCanUseWaitlist = async ({
    garageId,
    servicePackageId,
    addOnServiceIds,
    desiredStartTime,
}) => {
    const bookingService = require('../bookings/booking.service');
    const slotsResult = await bookingService.getAvailableSlots({
        garage_id: toObjectIdString(garageId),
        service_package_id: toObjectIdString(servicePackageId),
        add_on_service_ids: normalizeAddOnServiceIds(addOnServiceIds),
        date: toLocalDateString(desiredStartTime),
    });
    const desiredStartTimeValue = desiredStartTime.getTime();
    const slot = (slotsResult.slots || []).find((item) => {
        return new Date(item.start_time).getTime() === desiredStartTimeValue;
    });

    if (!slot) {
        throw new AppError('Waitlist desired slot does not exist', 400, 'WAITLIST_SLOT_NOT_FOUND');
    }

    if (slot.is_available) {
        throw new AppError('Booking slot is still available. Please create booking directly.', 409, 'WAITLIST_SLOT_STILL_AVAILABLE');
    }
};

const assertDesiredSlotIsAvailableForOffer = async ({
    garageId,
    servicePackageId,
    addOnServiceIds,
    desiredStartTime,
}) => {
    const bookingService = require('../bookings/booking.service');
    const slotsResult = await bookingService.getAvailableSlots({
        garage_id: toObjectIdString(garageId),
        service_package_id: toObjectIdString(servicePackageId),
        add_on_service_ids: normalizeAddOnServiceIds(addOnServiceIds),
        date: toLocalDateString(desiredStartTime),
    });
    const desiredStartTimeValue = desiredStartTime.getTime();
    const slot = (slotsResult.slots || []).find((item) => {
        return new Date(item.start_time).getTime() === desiredStartTimeValue;
    });

    if (!slot) {
        throw new AppError('Waitlist desired slot does not exist', 400, 'WAITLIST_SLOT_NOT_FOUND');
    }

    if (!slot.is_available) {
        throw new AppError('Waitlist slot is not currently available for offer', 409, 'WAITLIST_SLOT_NOT_AVAILABLE_FOR_OFFER');
    }
};

const emitWaitlistNotification = async ({ userId, type, title, message, waitlist, metadata = {} }) => {
    return notificationService.createInAppNotification({
        userId,
        type,
        title,
        message,
        relatedType: NOTIFICATION_RELATED_TYPES.WAITLIST,
        relatedId: waitlist._id,
        metadata: {
            waitlist_id: waitlist._id.toString(),
            desired_start_time: waitlist.desired_start_time,
            status: waitlist.status,
            ...metadata,
        },
    });
};

const buildAdminFilter = ({ status, customer_id, vehicle_id, garage_id, service_package_id, vehicle_type, from, to } = {}) => {
    const filter = {};

    if (status) {
        filter.status = status;
    }

    if (customer_id) {
        filter.customer_id = customer_id;
    }

    if (vehicle_id) {
        filter.vehicle_id = vehicle_id;
    }

    if (garage_id) {
        filter.garage_id = garage_id;
    }

    if (service_package_id) {
        filter.service_package_id = service_package_id;
    }

    if (vehicle_type) {
        filter.vehicle_type = vehicle_type;
    }

    if (from || to) {
        filter.desired_start_time = {};

        if (from) {
            filter.desired_start_time.$gte = new Date(from);
        }

        if (to) {
            filter.desired_start_time.$lte = new Date(to);
        }
    }

    return filter;
};

const getStaffGarageId = async (user) => {
    if (user.role === USER_ROLES.ADMIN) {
        return null;
    }

    const staffProfile = await StaffProfile.findOne({
        user_id: user._id,
        is_active: true,
    });

    if (!staffProfile || !staffProfile.garage_id) {
        throw new AppError('Staff is not assigned to any garage', 403, 'STAFF_GARAGE_NOT_ASSIGNED');
    }

    return staffProfile.garage_id;
};

const applyStaffGarageAccess = async (user, filter = {}) => {
    const staffGarageId = await getStaffGarageId(user);

    if (!staffGarageId) {
        return filter;
    }

    if (filter.garage_id && filter.garage_id.toString() !== staffGarageId.toString()) {
        throw new AppError('Staff cannot access waitlists outside assigned garage', 403, 'STAFF_GARAGE_ACCESS_DENIED');
    }

    return {
        ...filter,
        garage_id: staffGarageId,
    };
};

const assertStaffCanAccessWaitlist = async (user, waitlist) => {
    const staffGarageId = await getStaffGarageId(user);

    if (!staffGarageId) {
        return;
    }

    if (waitlist.garage_id.toString() !== staffGarageId.toString()) {
        throw new AppError('Staff cannot access waitlists outside assigned garage', 403, 'STAFF_GARAGE_ACCESS_DENIED');
    }
};

const expireOfferIfNeeded = async (waitlist) => {
    if (
        waitlist.status !== WAITLIST_STATUS.OFFERED
        || !waitlist.offer_expires_at
        || waitlist.offer_expires_at > new Date()
    ) {
        return false;
    }

    waitlist.status = WAITLIST_STATUS.EXPIRED;
    waitlist.expired_at = new Date();
    await waitlist.save();
    await emitWaitlistNotification({
        userId: waitlist.customer_id,
        type: NOTIFICATION_TYPES.WAITLIST_OFFER_EXPIRED,
        title: 'Waitlist offer expired',
        message: 'Your waitlist offer has expired.',
        waitlist,
    });

    return true;
};

const expireExpiredOffers = async ({ limit = 50 } = {}) => {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 200));
    const now = new Date();
    const waitlists = await BookingWaitlist.find({
        status: WAITLIST_STATUS.OFFERED,
        offer_expires_at: { $lte: now },
    })
        .sort({ offer_expires_at: 1, created_at: 1 })
        .limit(safeLimit);
    const expiredWaitlists = [];

    for (const waitlist of waitlists) {
        if (await expireOfferIfNeeded(waitlist)) {
            expiredWaitlists.push(waitlist);
        }
    }

    return {
        checked_at: now,
        attempted: waitlists.length,
        expired: expiredWaitlists.length,
        data: BookingWaitlistMapper.toBookingWaitlistDtoList(expiredWaitlists),
    };
};

const createMyWaitlist = async (customerId, payload = {}) => {
    const desiredStartTime = parseDateTime(payload.desired_start_time, 'desired_start_time');
    const vehicle = await getActiveVehicleForCustomer(payload.vehicle_id, customerId);
    const garage = await getActiveGarage(payload.garage_id);
    const servicePackage = await getActiveServicePackage(payload.service_package_id);
    const addOnServiceIds = normalizeAddOnServiceIds(payload.add_on_service_ids || []);

    assertDesiredStartTimeIsFuture(desiredStartTime);
    assertServiceMatchesVehicle(servicePackage, vehicle.vehicle_type);
    await getActiveAddOnServices(addOnServiceIds, vehicle.vehicle_type);
    await assertDesiredSlotCanUseWaitlist({
        garageId: garage._id,
        servicePackageId: servicePackage._id,
        addOnServiceIds,
        desiredStartTime,
    });
    await assertNoActiveDuplicateWaitlist({
        customerId,
        vehicleId: vehicle._id,
        garageId: garage._id,
        servicePackageId: servicePackage._id,
        addOnServiceIds,
        desiredStartTime,
    });

    const waitlist = await BookingWaitlist.create({
        customer_id: customerId,
        vehicle_id: vehicle._id,
        garage_id: garage._id,
        service_package_id: servicePackage._id,
        add_on_service_ids: addOnServiceIds,
        vehicle_type: vehicle.vehicle_type,
        desired_start_time: desiredStartTime,
        status: WAITLIST_STATUS.WAITING,
        note: normalizeText(payload.note),
    });

    await emitWaitlistNotification({
        userId: customerId,
        type: NOTIFICATION_TYPES.WAITLIST_JOINED,
        title: 'Waitlist joined',
        message: 'You have joined the waitlist for your selected booking slot.',
        waitlist,
    });

    const populatedWaitlist = await getWaitlistDocumentById(waitlist._id);

    return BookingWaitlistMapper.toBookingWaitlistDto(populatedWaitlist);
};

const getMyWaitlists = async (customerId, { page = 1, limit = 20, status, garage_id, service_package_id, vehicle_id } = {}) => {
    const filter = {
        customer_id: customerId,
    };

    if (status) {
        filter.status = status;
    }

    if (garage_id) {
        filter.garage_id = garage_id;
    }

    if (service_package_id) {
        filter.service_package_id = service_package_id;
    }

    if (vehicle_id) {
        filter.vehicle_id = vehicle_id;
    }

    const skip = (page - 1) * limit;

    const [waitlists, total] = await Promise.all([
        populateWaitlistQuery(BookingWaitlist.find(filter))
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit),
        BookingWaitlist.countDocuments(filter),
    ]);

    return {
        data: BookingWaitlistMapper.toBookingWaitlistDtoList(waitlists),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

const getMyWaitlistById = async (customerId, waitlistId) => {
    const waitlist = await populateWaitlistQuery(BookingWaitlist.findOne({
        _id: waitlistId,
        customer_id: customerId,
    }));

    if (!waitlist) {
        throw new AppError('Waitlist entry not found', 404, 'WAITLIST_NOT_FOUND');
    }

    return BookingWaitlistMapper.toBookingWaitlistDto(waitlist);
};

const getAllWaitlists = async (user, query = {}) => {
    const filter = await applyStaffGarageAccess(user, buildAdminFilter(query));
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [waitlists, total] = await Promise.all([
        populateWaitlistQuery(BookingWaitlist.find(filter))
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit),
        BookingWaitlist.countDocuments(filter),
    ]);

    return {
        data: BookingWaitlistMapper.toBookingWaitlistDtoList(waitlists),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

const cancelWaitlistDocument = async ({ waitlist, actorId, reason }) => {
    await expireOfferIfNeeded(waitlist);

    if (!WAITLIST_ACTIVE_STATUSES.includes(waitlist.status)) {
        throw new AppError('Waitlist cannot be canceled in current status', 400, 'WAITLIST_CANCEL_NOT_ALLOWED');
    }

    waitlist.status = WAITLIST_STATUS.CANCELED;
    waitlist.canceled_at = new Date();
    waitlist.canceled_by_id = actorId;
    waitlist.cancel_reason = normalizeText(reason);

    await waitlist.save();
    await emitWaitlistNotification({
        userId: waitlist.customer_id,
        type: NOTIFICATION_TYPES.WAITLIST_CANCELED,
        title: 'Waitlist canceled',
        message: 'Your waitlist entry has been canceled.',
        waitlist,
    });

    return getWaitlistDocumentById(waitlist._id);
};

const cancelMyWaitlist = async (customerId, waitlistId, { reason } = {}) => {
    const waitlist = await BookingWaitlist.findOne({
        _id: waitlistId,
        customer_id: customerId,
    });

    if (!waitlist) {
        throw new AppError('Waitlist entry not found', 404, 'WAITLIST_NOT_FOUND');
    }

    const canceledWaitlist = await cancelWaitlistDocument({
        waitlist,
        actorId: customerId,
        reason,
    });

    return BookingWaitlistMapper.toBookingWaitlistDto(canceledWaitlist);
};

const cancelWaitlist = async (user, waitlistId, { reason } = {}) => {
    const waitlist = await getRawWaitlistDocumentById(waitlistId);

    await assertStaffCanAccessWaitlist(user, waitlist);

    const canceledWaitlist = await cancelWaitlistDocument({
        waitlist,
        actorId: user._id,
        reason,
    });

    return BookingWaitlistMapper.toBookingWaitlistDto(canceledWaitlist);
};

const offerWaitlist = async (user, waitlistId, { offer_expires_in_minutes } = {}) => {
    const waitlist = await getRawWaitlistDocumentById(waitlistId);

    await assertStaffCanAccessWaitlist(user, waitlist);
    await expireOfferIfNeeded(waitlist);

    if (waitlist.status !== WAITLIST_STATUS.WAITING) {
        throw new AppError('Waitlist cannot be offered in current status', 400, 'WAITLIST_OFFER_NOT_ALLOWED');
    }

    const desiredStartTime = parseDateTime(waitlist.desired_start_time, 'desired_start_time');

    assertDesiredStartTimeIsFuture(desiredStartTime);
    await assertDesiredSlotIsAvailableForOffer({
        garageId: waitlist.garage_id,
        servicePackageId: waitlist.service_package_id,
        addOnServiceIds: waitlist.add_on_service_ids,
        desiredStartTime,
    });

    const now = new Date();
    const offerExpireMinutes = normalizeOfferExpireMinutes(offer_expires_in_minutes);

    waitlist.status = WAITLIST_STATUS.OFFERED;
    waitlist.offered_at = now;
    waitlist.offer_expires_at = addMinutes(now, offerExpireMinutes);
    waitlist.source_booking_id = null;

    await waitlist.save();
    await emitWaitlistNotification({
        userId: waitlist.customer_id,
        type: NOTIFICATION_TYPES.WAITLIST_OFFERED,
        title: 'Waitlist slot available',
        message: 'A slot from your waitlist is now available. Accept it before the offer expires.',
        waitlist,
        metadata: {
            offered_by_id: toObjectIdString(user._id),
            offer_expires_at: waitlist.offer_expires_at,
        },
    });

    const populatedWaitlist = await getWaitlistDocumentById(waitlist._id);

    return BookingWaitlistMapper.toBookingWaitlistDto(populatedWaitlist);
};

const expireWaitlistOffer = async (user, waitlistId) => {
    const waitlist = await getRawWaitlistDocumentById(waitlistId);

    await assertStaffCanAccessWaitlist(user, waitlist);

    if (waitlist.status !== WAITLIST_STATUS.OFFERED) {
        throw new AppError('Waitlist offer cannot be expired in current status', 400, 'WAITLIST_EXPIRE_NOT_ALLOWED');
    }

    waitlist.status = WAITLIST_STATUS.EXPIRED;
    waitlist.expired_at = new Date();

    await waitlist.save();
    await emitWaitlistNotification({
        userId: waitlist.customer_id,
        type: NOTIFICATION_TYPES.WAITLIST_OFFER_EXPIRED,
        title: 'Waitlist offer expired',
        message: 'Your waitlist offer has expired.',
        waitlist,
        metadata: {
            expired_by_id: toObjectIdString(user._id),
        },
    });

    const populatedWaitlist = await getWaitlistDocumentById(waitlist._id);

    return BookingWaitlistMapper.toBookingWaitlistDto(populatedWaitlist);
};

const offerNextForReleasedBooking = async (booking) => {
    if (!booking || !booking.start_time) {
        return null;
    }

    const sourceBookingId = booking._id || booking.id;
    const releasedCustomerId = toObjectIdString(booking.customer_id);
    const desiredStartTime = parseDateTime(booking.start_time, 'booking.start_time');
    const candidates = await BookingWaitlist.find({
        garage_id: booking.garage_id,
        service_package_id: booking.service_package_id,
        vehicle_type: booking.vehicle_type,
        desired_start_time: desiredStartTime,
        status: WAITLIST_STATUS.WAITING,
    }).sort({ created_at: 1 });
    const bookingAddOnServiceIds = normalizeAddOnServiceIds(booking.add_on_service_ids || []);
    const waitlist = candidates.find((item) => {
        return (!releasedCustomerId || toObjectIdString(item.customer_id) !== releasedCustomerId)
            && areSameAddOnSet(item.add_on_service_ids, bookingAddOnServiceIds);
    });

    if (!waitlist) {
        return null;
    }

    const now = new Date();

    waitlist.status = WAITLIST_STATUS.OFFERED;
    waitlist.offered_at = now;
    waitlist.offer_expires_at = addMinutes(now, DEFAULT_OFFER_EXPIRE_MINUTES);
    waitlist.source_booking_id = sourceBookingId;

    await waitlist.save();
    await emitWaitlistNotification({
        userId: waitlist.customer_id,
        type: NOTIFICATION_TYPES.WAITLIST_OFFERED,
        title: 'Waitlist slot available',
        message: 'A slot from your waitlist is now available. Accept it before the offer expires.',
        waitlist,
        metadata: {
            source_booking_id: toObjectIdString(sourceBookingId),
            offer_expires_at: waitlist.offer_expires_at,
        },
    });

    const populatedWaitlist = await getWaitlistDocumentById(waitlist._id);

    return BookingWaitlistMapper.toBookingWaitlistDto(populatedWaitlist);
};

const acceptMyWaitlist = async (customerId, waitlistId) => {
    const waitlist = await BookingWaitlist.findOne({
        _id: waitlistId,
        customer_id: customerId,
    });

    if (!waitlist) {
        throw new AppError('Waitlist entry not found', 404, 'WAITLIST_NOT_FOUND');
    }

    if (await expireOfferIfNeeded(waitlist)) {
        throw new AppError('Waitlist offer has expired', 409, 'WAITLIST_OFFER_EXPIRED');
    }

    if (waitlist.status !== WAITLIST_STATUS.OFFERED) {
        throw new AppError('Waitlist offer cannot be accepted in current status', 400, 'WAITLIST_ACCEPT_NOT_ALLOWED');
    }

    const bookingService = require('../bookings/booking.service');
    const booking = await bookingService.createCustomerBooking(customerId, {
        garage_id: toObjectIdString(waitlist.garage_id),
        vehicle_id: toObjectIdString(waitlist.vehicle_id),
        service_package_id: toObjectIdString(waitlist.service_package_id),
        add_on_service_ids: normalizeAddOnServiceIds(waitlist.add_on_service_ids),
        start_time: waitlist.desired_start_time.toISOString(),
    });

    waitlist.status = WAITLIST_STATUS.ACCEPTED;
    waitlist.accepted_at = new Date();
    waitlist.created_booking_id = booking.id;

    await waitlist.save();
    await emitWaitlistNotification({
        userId: waitlist.customer_id,
        type: NOTIFICATION_TYPES.WAITLIST_OFFER_ACCEPTED,
        title: 'Waitlist offer accepted',
        message: 'Your waitlist offer has been accepted and a booking was created.',
        waitlist,
        metadata: {
            created_booking_id: booking.id,
        },
    });

    const populatedWaitlist = await getWaitlistDocumentById(waitlist._id);

    return {
        waitlist: BookingWaitlistMapper.toBookingWaitlistDto(populatedWaitlist),
        booking,
    };
};

module.exports = {
    createMyWaitlist,
    getMyWaitlists,
    getMyWaitlistById,
    getAllWaitlists,
    cancelMyWaitlist,
    cancelWaitlist,
    offerWaitlist,
    expireWaitlistOffer,
    expireExpiredOffers,
    offerNextForReleasedBooking,
    acceptMyWaitlist,
};
