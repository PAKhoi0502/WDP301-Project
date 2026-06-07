const mongoose = require('mongoose');

const Booking = require('./booking.model');
const BookingMapper = require('./booking.mapper');
const User = require('../users/user.model');
const Vehicle = require('../vehicles/vehicle.model');
const Garage = require('../garages/garage.model');
const WashBay = require('../wash-bays/washBay.model');
const StaffProfile = require('../staff-profiles/staffProfile.model');
const ServicePackage = require('../service-packages/servicePackage.model');
const bookingServiceStepService = require('../booking-service-steps/bookingServiceStep.service');
const bookingPaymentService = require('./bookingPayment.service');
const promotionService = require('../promotions/promotion.service');
const CustomerLoyalty = require('../loyalty/customerLoyalty.model');
const TierRule = require('../loyalty/tierRule.model');
const { LOYALTY_TIERS } = require('../../shared/constants/loyalty.constant');
const { AppError } = require('../../shared/utils/appError');
const { USER_ROLES } = require('../../shared/constants/roles.constant');
const { WASH_BAY_STATUS } = require('../../shared/constants/washBay.constant');
const {
    BOOKING_STATUS,
    BOOKING_HOLD_SLOT_STATUSES,
    BOOKING_CUSTOMER_CANCELABLE_STATUSES,
    BOOKING_PAYMENT_METHOD,
    BOOKING_PAYMENT_STATUS,
    DEFAULT_BOOKING_RULE,
} = require('../../shared/constants/booking.constant');

const DEFAULT_TIMEZONE_OFFSET = process.env.APP_TIMEZONE_OFFSET || '+07:00';

const normalizeText = (value) => {
    if (value === null) {
        return null;
    }

    if (typeof value !== 'string') {
        return value;
    }

    const trimmedValue = value.trim();

    return trimmedValue || null;
};

const normalizeRequiredText = (value) => {
    if (typeof value !== 'string') {
        return value;
    }

    return value.trim();
};

const normalizeEmail = (value) => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value !== 'string') {
        return value;
    }

    const trimmedValue = value.trim().toLowerCase();

    return trimmedValue || null;
};

const normalizeLicensePlate = (value) => {
    if (typeof value !== 'string') {
        return '';
    }

    return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
};

const escapeRegExp = (value) => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const parseDateTime = (value, fieldName = 'datetime') => {
    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
        throw new AppError(`${fieldName} is invalid`, 400, 'INVALID_DATETIME');
    }

    return date;
};

const addMinutes = (date, minutes) => {
    return new Date(date.getTime() + minutes * 60 * 1000);
};

const startOfBookingDate = (date) => {
    return new Date(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        0,
        0,
        0,
        0
    ));
};

const createDateFromLocalTime = (dateString, timeString) => {
    return new Date(`${dateString}T${timeString}:00${DEFAULT_TIMEZONE_OFFSET}`);
};

const toBookingRuleFromTierRule = (tierRule) => {
    if (!tierRule) {
        return { ...DEFAULT_BOOKING_RULE };
    }

    return {
        current_tier: tierRule.tier_name,
        booking_window_days: tierRule.booking_window_days,
        max_upcoming_bookings: tierRule.max_upcoming_bookings,
        priority_level: tierRule.priority_level,
    };
};

const getActiveBookingRuleByTier = async (tierName) => {
    const selectedTierName = tierName || LOYALTY_TIERS.BRONZE;

    const selectedTierRule = await TierRule.findOne({
        tier_name: selectedTierName,
        is_active: true,
    }).lean();

    if (selectedTierRule) {
        return toBookingRuleFromTierRule(selectedTierRule);
    }

    if (selectedTierName !== LOYALTY_TIERS.BRONZE) {
        const bronzeTierRule = await TierRule.findOne({
            tier_name: LOYALTY_TIERS.BRONZE,
            is_active: true,
        }).lean();

        if (bronzeTierRule) {
            return toBookingRuleFromTierRule(bronzeTierRule);
        }
    }

    return { ...DEFAULT_BOOKING_RULE };
};

const getBookingRuleForCustomer = async (customerId) => {
    const loyalty = await CustomerLoyalty.findOne({
        customer_id: customerId,
    })
        .select('current_tier')
        .lean();

    return getActiveBookingRuleByTier(loyalty?.current_tier || LOYALTY_TIERS.BRONZE);
};

const populateBookingQuery = (query) => {
    return query
        .populate('customer_id', 'full_name email phone role is_active')
        .populate('vehicle_id', 'raw_license_plate normalized_license_plate vehicle_type engine_type brand model color is_active')
        .populate('garage_id', 'name garage_code address city opening_time closing_time slot_interval_minutes is_active')
        .populate('wash_bay_id', 'name bay_code vehicle_type status is_active')
        .populate('service_package_id', 'name vehicle_type service_type base_price duration_minutes wash_bay_duration_minutes points_earned requires_wash_bay is_active')
        .populate('promotion_id', 'code name discount_type discount_value max_discount_amount min_order_amount start_at end_at is_active')
        .populate('created_by_staff_id', 'full_name email phone role is_active')
        .populate('canceled_by_id', 'full_name email phone role is_active');
};

const getBookingDocumentById = async (bookingId) => {
    const booking = await populateBookingQuery(Booking.findById(bookingId));

    if (!booking) {
        throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    return booking;
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

const assertUserActive = async (userId) => {
    const user = await User.findById(userId);

    if (!user || !user.is_active) {
        throw new AppError('User not found or inactive', 404, 'USER_NOT_FOUND');
    }

    return user;
};

const assertServicePackageMatchesVehicleType = (servicePackage, vehicleType) => {
    if (servicePackage.vehicle_type !== vehicleType) {
        throw new AppError(
            'Service package does not match vehicle type',
            400,
            'SERVICE_PACKAGE_VEHICLE_TYPE_MISMATCH'
        );
    }
};

const assertBookingInsideGarageBusinessHours = (garage, startTime, endTime) => {
    const dateString = startTime.toISOString().slice(0, 10);
    const openingDate = createDateFromLocalTime(dateString, garage.opening_time);
    const closingDate = createDateFromLocalTime(dateString, garage.closing_time);

    if (startTime < openingDate || endTime > closingDate) {
        throw new AppError(
            'Booking time is outside garage business hours',
            400,
            'BOOKING_OUTSIDE_BUSINESS_HOURS'
        );
    }
};

const assertBookingStartTimeInFuture = (startTime) => {
    if (startTime <= new Date()) {
        throw new AppError('Booking start time must be in the future', 400, 'BOOKING_START_TIME_IN_PAST');
    }
};

const assertBookingWithinWindow = (startTime, bookingRule) => {
    const maxStartTime = addMinutes(new Date(), bookingRule.booking_window_days * 24 * 60);

    if (startTime > maxStartTime) {
        throw new AppError(
            `Booking can only be created within ${bookingRule.booking_window_days} days`,
            400,
            'BOOKING_WINDOW_EXCEEDED'
        );
    }
};

const calculateBookingTimes = (startTime, servicePackage) => {
    const endTime = addMinutes(startTime, servicePackage.duration_minutes);

    if (!servicePackage.requires_wash_bay) {
        return {
            end_time: endTime,
            wash_bay_start_time: null,
            wash_bay_end_time: null,
        };
    }

    const washBayDuration = servicePackage.wash_bay_duration_minutes || servicePackage.duration_minutes;

    return {
        end_time: endTime,
        wash_bay_start_time: startTime,
        wash_bay_end_time: addMinutes(startTime, washBayDuration),
    };
};

const buildBookingBasePayload = ({ garage, servicePackage, startTime, vehicleType, note, promotionResult = null }) => {
    const bookingTimes = calculateBookingTimes(startTime, servicePackage);
    const originalPrice = servicePackage.base_price;
    const promotionDiscountAmount = promotionResult?.discount_amount || 0;
    const pointsDiscountAmount = 0;
    const discountAmount = promotionDiscountAmount + pointsDiscountAmount;
    const finalPrice = Math.max(originalPrice - discountAmount, 0);

    return {
        garage_id: garage._id,
        service_package_id: servicePackage._id,
        vehicle_type: vehicleType,
        booking_date: startOfBookingDate(startTime),
        start_time: startTime,
        end_time: bookingTimes.end_time,
        wash_bay_start_time: bookingTimes.wash_bay_start_time,
        wash_bay_end_time: bookingTimes.wash_bay_end_time,
        original_price: originalPrice,
        promotion_discount_amount: promotionDiscountAmount,
        points_discount_amount: pointsDiscountAmount,
        discount_amount: discountAmount,
        final_price: finalPrice,
        payment_method: BOOKING_PAYMENT_METHOD.CASH,
        payment_status: BOOKING_PAYMENT_STATUS.UNPAID,
        used_points: 0,
        earned_points: 0,
        promotion_id: promotionResult?.promotion?._id || null,
        requires_wash_bay: servicePackage.requires_wash_bay,
        status: BOOKING_STATUS.CONFIRMED,
        reward_processed: false,
        reward_processed_at: null,
        note: normalizeText(note),
    };
};

const buildAdminSearchFilter = ({ search, status, garage_id, customer_id, vehicle_id, service_package_id, vehicle_type, is_walk_in, from, to } = {}) => {
    const filter = {};

    if (search) {
        const keyword = escapeRegExp(search.trim());
        const normalizedKeyword = normalizeLicensePlate(search);

        filter.$or = [
            { guest_name: { $regex: keyword, $options: 'i' } },
            { guest_phone: { $regex: keyword, $options: 'i' } },
            { guest_email: { $regex: keyword, $options: 'i' } },
            { license_plate: { $regex: keyword, $options: 'i' } },
            { normalized_license_plate: { $regex: normalizedKeyword, $options: 'i' } },
        ];
    }

    if (status) {
        filter.status = status;
    }

    if (garage_id) {
        filter.garage_id = garage_id;
    }

    if (customer_id) {
        filter.customer_id = customer_id;
    }

    if (vehicle_id) {
        filter.vehicle_id = vehicle_id;
    }

    if (service_package_id) {
        filter.service_package_id = service_package_id;
    }

    if (vehicle_type) {
        filter.vehicle_type = vehicle_type;
    }

    if (is_walk_in !== undefined) {
        filter.is_walk_in = is_walk_in;
    }

    if (from || to) {
        filter.start_time = {};

        if (from) {
            filter.start_time.$gte = parseDateTime(from, 'from');
        }

        if (to) {
            filter.start_time.$lte = parseDateTime(to, 'to');
        }
    }

    return filter;
};

const buildCustomerSearchFilter = (customerId, { status, garage_id, vehicle_id, service_package_id, from, to } = {}) => {
    return buildAdminSearchFilter({
        status,
        garage_id,
        customer_id: customerId,
        vehicle_id,
        service_package_id,
        from,
        to,
        is_walk_in: false,
    });
};

const countActiveWashBays = async (garageId, vehicleType) => {
    return WashBay.countDocuments({
        garage_id: garageId,
        vehicle_type: vehicleType,
        is_active: true,
        status: { $nin: [WASH_BAY_STATUS.INACTIVE, WASH_BAY_STATUS.MAINTENANCE] },
    });
};

const countOverlappedWashBayBookings = async (garageId, vehicleType, washBayStartTime, washBayEndTime, excludedBookingId = null) => {
    const filter = {
        garage_id: garageId,
        vehicle_type: vehicleType,
        requires_wash_bay: true,
        status: { $in: BOOKING_HOLD_SLOT_STATUSES },
        wash_bay_start_time: { $lt: washBayEndTime },
        wash_bay_end_time: { $gt: washBayStartTime },
    };

    if (excludedBookingId) {
        filter._id = { $ne: excludedBookingId };
    }

    return Booking.countDocuments(filter);
};

const assertGarageCapacityAvailable = async ({ garageId, vehicleType, requiresWashBay, washBayStartTime, washBayEndTime }) => {
    if (!requiresWashBay) {
        return;
    }

    const activeWashBayCount = await countActiveWashBays(garageId, vehicleType);

    if (activeWashBayCount <= 0) {
        throw new AppError(
            'No active wash bay is available for this vehicle type',
            400,
            'NO_ACTIVE_WASH_BAY_FOR_VEHICLE_TYPE'
        );
    }

    const overlappedBookingCount = await countOverlappedWashBayBookings(
        garageId,
        vehicleType,
        washBayStartTime,
        washBayEndTime
    );

    if (overlappedBookingCount >= activeWashBayCount) {
        throw new AppError('Garage capacity is full for this time', 409, 'GARAGE_CAPACITY_FULL');
    }
};

const assertVehicleNoOverlap = async ({ vehicleId, normalizedLicensePlate, vehicleType, startTime, endTime }) => {
    const filter = {
        status: { $in: BOOKING_HOLD_SLOT_STATUSES },
        start_time: { $lt: endTime },
        end_time: { $gt: startTime },
    };

    if (vehicleId) {
        filter.vehicle_id = vehicleId;
    } else {
        filter.normalized_license_plate = normalizedLicensePlate;
        filter.vehicle_type = vehicleType;
    }

    const existed = await Booking.exists(filter);

    if (existed) {
        throw new AppError(
            'Vehicle already has an overlapped booking',
            409,
            'VEHICLE_BOOKING_OVERLAP'
        );
    }
};

const assertCustomerUpcomingLimit = async (customerId, bookingRule) => {
    const upcomingCount = await Booking.countDocuments({
        customer_id: customerId,
        is_walk_in: false,
        status: { $in: BOOKING_HOLD_SLOT_STATUSES },
        start_time: { $gte: new Date() },
    });

    if (upcomingCount >= bookingRule.max_upcoming_bookings) {
        throw new AppError(
            `Customer can only hold ${bookingRule.max_upcoming_bookings} upcoming booking`,
            409,
            'CUSTOMER_UPCOMING_BOOKING_LIMIT_EXCEEDED'
        );
    }
};

const assertWalkInLicensePlateNotLinkedToActiveVehicle = async (normalizedLicensePlate, vehicleType) => {
    const vehicle = await Vehicle.exists({
        normalized_license_plate: normalizedLicensePlate,
        vehicle_type: vehicleType,
        is_active: true,
    });

    if (vehicle) {
        throw new AppError(
            'License plate is already registered as an active vehicle',
            409,
            'LICENSE_PLATE_ALREADY_REGISTERED'
        );
    }
};

const assertStaffCanAccessGarage = async (user, garageId) => {
    if (user.role === USER_ROLES.ADMIN) {
        return null;
    }

    const staffProfile = await getActiveStaffProfile(user._id);

    if (!staffProfile.garage_id) {
        throw new AppError('Staff is not assigned to any garage', 403, 'STAFF_GARAGE_NOT_ASSIGNED');
    }

    if (staffProfile.garage_id.toString() !== garageId.toString()) {
        throw new AppError('Staff cannot access bookings outside assigned garage', 403, 'STAFF_GARAGE_ACCESS_DENIED');
    }

    return staffProfile;
};

const getAdminGarageFilter = async (user, requestedGarageId) => {
    if (user.role === USER_ROLES.ADMIN) {
        return requestedGarageId || undefined;
    }

    const staffProfile = await getActiveStaffProfile(user._id);

    if (!staffProfile.garage_id) {
        throw new AppError('Staff is not assigned to any garage', 403, 'STAFF_GARAGE_NOT_ASSIGNED');
    }

    if (requestedGarageId && staffProfile.garage_id.toString() !== requestedGarageId.toString()) {
        throw new AppError('Staff cannot access bookings outside assigned garage', 403, 'STAFF_GARAGE_ACCESS_DENIED');
    }

    return staffProfile.garage_id;
};

const getRawBookingDocumentById = async (bookingId) => {
    const booking = await Booking.findById(bookingId);

    if (!booking) {
        throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    return booking;
};

const assertStaffCanAccessBooking = async (user, booking) => {
    await assertStaffCanAccessGarage(user, booking.garage_id);
};

const assertBookingStatusIn = (booking, statuses, errorCode) => {
    if (!statuses.includes(booking.status)) {
        throw new AppError('Booking cannot be processed in current status', 400, errorCode);
    }
};

const getServicePackageForBooking = async (booking) => {
    const servicePackage = await ServicePackage.findById(booking.service_package_id);

    if (!servicePackage) {
        throw new AppError('Service package not found', 404, 'SERVICE_PACKAGE_NOT_FOUND');
    }

    return servicePackage;
};

const assignWashBayToBooking = async (booking, requestedWashBayId = null) => {
    if (!booking.requires_wash_bay) {
        throw new AppError('Booking does not require wash bay', 400, 'BOOKING_DOES_NOT_REQUIRE_WASH_BAY');
    }

    if (booking.wash_bay_id) {
        throw new AppError('Wash bay has already been assigned to this booking', 409, 'WASH_BAY_ALREADY_ASSIGNED');
    }

    const filter = {
        garage_id: booking.garage_id,
        vehicle_type: booking.vehicle_type,
        is_active: true,
        status: WASH_BAY_STATUS.AVAILABLE,
        current_booking_id: null,
    };

    if (requestedWashBayId) {
        filter._id = requestedWashBayId;
    }

    const washBay = await WashBay.findOneAndUpdate(
        filter,
        {
            status: WASH_BAY_STATUS.OCCUPIED,
            current_booking_id: booking._id,
        },
        {
            new: true,
            sort: { bay_code: 1, name: 1 },
        }
    );

    if (!washBay) {
        throw new AppError('No available wash bay found for this booking', 409, 'NO_AVAILABLE_WASH_BAY');
    }

    booking.wash_bay_id = washBay._id;

    await booking.save();

    return washBay;
};

const assignWashBayToBookingIfNeeded = async (booking) => {
    if (!booking.requires_wash_bay || booking.wash_bay_id) {
        return null;
    }

    return assignWashBayToBooking(booking);
};

const releaseWashBayForBooking = async (booking) => {
    if (!booking.wash_bay_id) {
        return;
    }

    await WashBay.findOneAndUpdate(
        {
            _id: booking.wash_bay_id,
            current_booking_id: booking._id,
        },
        {
            status: WASH_BAY_STATUS.AVAILABLE,
            current_booking_id: null,
        }
    );

};

const getAvailableSlots = async ({ garage_id, service_package_id, date } = {}) => {
    const garage = await getActiveGarage(garage_id);
    const servicePackage = await getActiveServicePackage(service_package_id);
    const openingDate = createDateFromLocalTime(date, garage.opening_time);
    const closingDate = createDateFromLocalTime(date, garage.closing_time);

    if (Number.isNaN(openingDate.getTime()) || Number.isNaN(closingDate.getTime())) {
        throw new AppError('Invalid garage business hours', 400, 'INVALID_GARAGE_BUSINESS_HOURS');
    }

    const activeWashBayCount = servicePackage.requires_wash_bay
        ? await countActiveWashBays(garage._id, servicePackage.vehicle_type)
        : null;

    const slots = [];
    let currentStartTime = new Date(openingDate);

    while (currentStartTime < closingDate) {
        const bookingTimes = calculateBookingTimes(currentStartTime, servicePackage);

        if (bookingTimes.end_time <= closingDate) {
            let isAvailable = currentStartTime > new Date();
            let availableCapacity = null;

            if (servicePackage.requires_wash_bay) {
                const overlappedBookingCount = await countOverlappedWashBayBookings(
                    garage._id,
                    servicePackage.vehicle_type,
                    bookingTimes.wash_bay_start_time,
                    bookingTimes.wash_bay_end_time
                );

                availableCapacity = Math.max(activeWashBayCount - overlappedBookingCount, 0);
                isAvailable = isAvailable && activeWashBayCount > 0 && availableCapacity > 0;
            }

            slots.push({
                start_time: currentStartTime,
                end_time: bookingTimes.end_time,
                wash_bay_start_time: bookingTimes.wash_bay_start_time,
                wash_bay_end_time: bookingTimes.wash_bay_end_time,
                is_available: isAvailable,
                available_capacity: availableCapacity,
            });
        }

        currentStartTime = addMinutes(currentStartTime, garage.slot_interval_minutes);
    }

    return {
        garage_id: garage._id.toString(),
        service_package_id: servicePackage._id.toString(),
        date,
        vehicle_type: servicePackage.vehicle_type,
        requires_wash_bay: servicePackage.requires_wash_bay,
        slot_interval_minutes: garage.slot_interval_minutes,
        active_wash_bay_count: activeWashBayCount,
        slots,
    };
};

const getMyBookings = async (customerId, query = {}) => {
    await assertUserActive(customerId);

    const { page = 1, limit = 20 } = query;
    const filter = buildCustomerSearchFilter(customerId, query);
    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
        populateBookingQuery(Booking.find(filter))
            .sort({ start_time: -1 })
            .skip(skip)
            .limit(limit),
        Booking.countDocuments(filter),
    ]);

    return {
        data: BookingMapper.toBookingDtoList(bookings),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

const getMyBookingById = async (customerId, bookingId) => {
    const booking = await getBookingDocumentById(bookingId);

    if (!booking.customer_id || booking.customer_id._id.toString() !== customerId.toString()) {
        throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    return BookingMapper.toBookingDto(booking);
};

const getAllBookings = async (user, query = {}) => {
    const { page = 1, limit = 20 } = query;
    const garageFilter = await getAdminGarageFilter(user, query.garage_id);
    const filter = buildAdminSearchFilter({
        ...query,
        garage_id: garageFilter,
    });
    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
        populateBookingQuery(Booking.find(filter))
            .sort({ start_time: -1 })
            .skip(skip)
            .limit(limit),
        Booking.countDocuments(filter),
    ]);

    return {
        data: BookingMapper.toBookingDtoList(bookings),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

const createCustomerBooking = async (customerId, payload = {}) => {
    const createPayload = BookingMapper.toCustomerCreatePayload(payload);
    const [garage, servicePackage, vehicle, bookingRule] = await Promise.all([
        getActiveGarage(createPayload.garage_id),
        getActiveServicePackage(createPayload.service_package_id),
        getActiveVehicleForCustomer(createPayload.vehicle_id, customerId),
        getBookingRuleForCustomer(customerId),
    ]);
    const startTime = parseDateTime(createPayload.start_time, 'start_time');
    const promotionResult = await promotionService.validatePromotionForBooking({
        promotion_code: createPayload.promotion_code,
        customer_id: customerId,
        servicePackage,
        vehicleType: vehicle.vehicle_type,
        orderAmount: servicePackage.base_price,
        bookingStartTime: startTime,
    });
    const basePayload = buildBookingBasePayload({
        garage,
        servicePackage,
        startTime,
        vehicleType: vehicle.vehicle_type,
        note: createPayload.note,
        promotionResult,
    });

    assertServicePackageMatchesVehicleType(servicePackage, vehicle.vehicle_type);
    assertBookingStartTimeInFuture(startTime);
    assertBookingWithinWindow(startTime, bookingRule);
    assertBookingInsideGarageBusinessHours(garage, basePayload.start_time, basePayload.end_time);
    await assertCustomerUpcomingLimit(customerId, bookingRule);
    await assertVehicleNoOverlap({
        vehicleId: vehicle._id,
        startTime: basePayload.start_time,
        endTime: basePayload.end_time,
    });
    await assertGarageCapacityAvailable({
        garageId: garage._id,
        vehicleType: vehicle.vehicle_type,
        requiresWashBay: basePayload.requires_wash_bay,
        washBayStartTime: basePayload.wash_bay_start_time,
        washBayEndTime: basePayload.wash_bay_end_time,
    });

    const booking = await Booking.create({
        ...basePayload,
        customer_id: customerId,
        vehicle_id: vehicle._id,
        is_walk_in: false,
        guest_name: null,
        guest_phone: null,
        guest_email: null,
        license_plate: vehicle.raw_license_plate,
        normalized_license_plate: vehicle.normalized_license_plate,
        created_by_staff_id: null,
    });

    const populatedBooking = await getBookingDocumentById(booking._id);

    return BookingMapper.toBookingDto(populatedBooking);
};

const createWalkInBooking = async (user, payload = {}) => {
    const createPayload = BookingMapper.toWalkInCreatePayload(payload);
    const [garage, servicePackage] = await Promise.all([
        getActiveGarage(createPayload.garage_id),
        getActiveServicePackage(createPayload.service_package_id),
    ]);
    const startTime = parseDateTime(createPayload.start_time, 'start_time');
    const normalizedLicensePlate = normalizeLicensePlate(createPayload.license_plate);
    const promotionResult = await promotionService.validatePromotionForBooking({
        promotion_code: createPayload.promotion_code,
        customer_id: null,
        servicePackage,
        vehicleType: createPayload.vehicle_type,
        orderAmount: servicePackage.base_price,
        bookingStartTime: startTime,
    });
    const basePayload = buildBookingBasePayload({
        garage,
        servicePackage,
        startTime,
        vehicleType: createPayload.vehicle_type,
        note: createPayload.note,
        promotionResult,
    });

    await assertStaffCanAccessGarage(user, garage._id);
    assertServicePackageMatchesVehicleType(servicePackage, createPayload.vehicle_type);
    assertBookingStartTimeInFuture(startTime);
    assertBookingInsideGarageBusinessHours(garage, basePayload.start_time, basePayload.end_time);

    if (!normalizedLicensePlate || normalizedLicensePlate.length < 5 || normalizedLicensePlate.length > 20) {
        throw new AppError('License plate is invalid after normalization', 400, 'INVALID_LICENSE_PLATE');
    }

    await assertWalkInLicensePlateNotLinkedToActiveVehicle(normalizedLicensePlate, createPayload.vehicle_type);
    await assertVehicleNoOverlap({
        normalizedLicensePlate,
        vehicleType: createPayload.vehicle_type,
        startTime: basePayload.start_time,
        endTime: basePayload.end_time,
    });
    await assertGarageCapacityAvailable({
        garageId: garage._id,
        vehicleType: createPayload.vehicle_type,
        requiresWashBay: basePayload.requires_wash_bay,
        washBayStartTime: basePayload.wash_bay_start_time,
        washBayEndTime: basePayload.wash_bay_end_time,
    });

    const booking = await Booking.create({
        ...basePayload,
        customer_id: null,
        vehicle_id: null,
        is_walk_in: true,
        guest_name: normalizeRequiredText(createPayload.guest_name),
        guest_phone: normalizeRequiredText(createPayload.guest_phone),
        guest_email: normalizeEmail(createPayload.guest_email),
        license_plate: normalizeRequiredText(createPayload.license_plate),
        normalized_license_plate: normalizedLicensePlate,
        created_by_staff_id: user._id,
    });

    const populatedBooking = await getBookingDocumentById(booking._id);

    return BookingMapper.toBookingDto(populatedBooking);
};

const cancelMyBooking = async (customerId, bookingId, { reason } = {}) => {
    const booking = await Booking.findOne({
        _id: bookingId,
        customer_id: customerId,
        is_walk_in: false,
    });

    if (!booking) {
        throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    if (!BOOKING_CUSTOMER_CANCELABLE_STATUSES.includes(booking.status)) {
        throw new AppError('Booking cannot be canceled in current status', 400, 'BOOKING_NOT_CANCELABLE');
    }

    booking.status = BOOKING_STATUS.CANCELED;
    booking.canceled_at = new Date();
    booking.canceled_by_id = customerId;
    booking.cancel_reason = normalizeText(reason);

    await booking.save();

    const populatedBooking = await getBookingDocumentById(booking._id);

    return BookingMapper.toBookingDto(populatedBooking);
};


const checkInBooking = async (user, bookingId, { note } = {}) => {
    const booking = await getRawBookingDocumentById(bookingId);

    await assertStaffCanAccessBooking(user, booking);
    assertBookingStatusIn(booking, [BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED], 'BOOKING_CHECK_IN_NOT_ALLOWED');

    booking.status = BOOKING_STATUS.CHECKED_IN;
    booking.checked_in_at = new Date();

    if (note !== undefined) {
        booking.note = normalizeText(note);
    }

    await booking.save();

    const populatedBooking = await getBookingDocumentById(booking._id);

    return BookingMapper.toBookingDto(populatedBooking);
};

const assignWashBay = async (user, bookingId, { wash_bay_id } = {}) => {
    const booking = await getRawBookingDocumentById(bookingId);

    await assertStaffCanAccessBooking(user, booking);
    assertBookingStatusIn(booking, [BOOKING_STATUS.CHECKED_IN, BOOKING_STATUS.IN_PROGRESS], 'BOOKING_ASSIGN_WASH_BAY_NOT_ALLOWED');

    await assignWashBayToBooking(booking, wash_bay_id || null);

    const populatedBooking = await getBookingDocumentById(booking._id);

    return BookingMapper.toBookingDto(populatedBooking);
};

const startService = async (user, bookingId, { note } = {}) => {
    const booking = await getRawBookingDocumentById(bookingId);

    await assertStaffCanAccessBooking(user, booking);
    assertBookingStatusIn(booking, [BOOKING_STATUS.CHECKED_IN], 'BOOKING_START_SERVICE_NOT_ALLOWED');

    const servicePackage = await getServicePackageForBooking(booking);

    await assignWashBayToBookingIfNeeded(booking);

    booking.status = BOOKING_STATUS.IN_PROGRESS;
    booking.started_at = new Date();

    if (note !== undefined) {
        booking.note = normalizeText(note);
    }

    await booking.save();

    const serviceSteps = await bookingServiceStepService.createStepsFromTemplate(booking, servicePackage);
    const populatedBooking = await getBookingDocumentById(booking._id);

    return {
        booking: BookingMapper.toBookingDto(populatedBooking),
        service_steps: serviceSteps,
    };
};

const getBookingServiceSteps = async (user, bookingId) => {
    const booking = await getRawBookingDocumentById(bookingId);

    await assertStaffCanAccessBooking(user, booking);

    return bookingServiceStepService.getStepsByBookingId(booking._id);
};

const markBookingServiceStepDone = async (user, bookingId, stepId, { note } = {}) => {
    const booking = await getRawBookingDocumentById(bookingId);

    await assertStaffCanAccessBooking(user, booking);
    assertBookingStatusIn(booking, [BOOKING_STATUS.IN_PROGRESS], 'BOOKING_SERVICE_STEP_DONE_NOT_ALLOWED');

    return bookingServiceStepService.markStepDone({
        bookingId: booking._id,
        stepId,
        staffId: user._id,
        note,
    });
};


const markPaid = async (user, bookingId, { note } = {}) => {
    const session = await mongoose.startSession();

    try {
        let response;

        await session.withTransaction(async () => {
            const booking = await Booking.findById(bookingId).session(session);

            if (!booking) {
                throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
            }

            await assertStaffCanAccessBooking(user, booking);
            assertBookingStatusIn(booking, [BOOKING_STATUS.COMPLETED], 'BOOKING_MARK_PAID_NOT_ALLOWED');

            if (
                booking.payment_method === BOOKING_PAYMENT_METHOD.PAYOS
                && booking.payment_status === BOOKING_PAYMENT_STATUS.PENDING
            ) {
                throw new AppError(
                    'Pending PayOS payment must be canceled before cash payment',
                    409,
                    'BOOKING_PENDING_PAYOS_PAYMENT'
                );
            }

            if (note !== undefined) {
                booking.note = normalizeText(note);
            }

            const paidResult = await bookingPaymentService.confirmBookingPaid({
                booking,
                paymentMethod: BOOKING_PAYMENT_METHOD.CASH,
                actorId: user._id,
                session,
            });
            const populatedBooking = await populateBookingQuery(Booking.findById(booking._id).session(session));

            response = {
                booking: BookingMapper.toBookingDto(populatedBooking),
                wash_history: paidResult.wash_history,
                loyalty: paidResult.loyalty,
                point_transaction: paidResult.point_transaction,
                promotion_usage: paidResult.promotion_usage,
                notifications: paidResult.notifications,
                already_processed: paidResult.already_processed,
            };
        });

        return response;
    } finally {
        await session.endSession();
    }
};

const completeService = async (user, bookingId, { note } = {}) => {
    const booking = await getRawBookingDocumentById(bookingId);

    await assertStaffCanAccessBooking(user, booking);
    assertBookingStatusIn(booking, [BOOKING_STATUS.IN_PROGRESS], 'BOOKING_COMPLETE_SERVICE_NOT_ALLOWED');
    await bookingServiceStepService.assertAllRequiredStepsDone(booking._id);
    await releaseWashBayForBooking(booking);

    booking.status = BOOKING_STATUS.COMPLETED;
    booking.completed_at = new Date();

    if (note !== undefined) {
        booking.note = normalizeText(note);
    }

    await booking.save();

    const populatedBooking = await getBookingDocumentById(booking._id);

    return BookingMapper.toBookingDto(populatedBooking);
};

module.exports = {
    getAvailableSlots,
    getMyBookings,
    getMyBookingById,
    getAllBookings,
    createCustomerBooking,
    createWalkInBooking,
    cancelMyBooking,
    checkInBooking,
    assignWashBay,
    startService,
    getBookingServiceSteps,
    markBookingServiceStepDone,
    completeService,
    markPaid,
};
