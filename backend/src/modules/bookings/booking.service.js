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
const loyaltyService = require('../loyalty/loyalty.service');
const CustomerLoyalty = require('../loyalty/customerLoyalty.model');
const TierRule = require('../loyalty/tierRule.model');
const { LOYALTY_TIERS } = require('../../shared/constants/loyalty.constant');
const { AppError } = require('../../shared/utils/appError');
const { USER_ROLES } = require('../../shared/constants/roles.constant');
const { STAFF_TYPES } = require('../../shared/constants/staff.constant');
const { WASH_BAY_STATUS } = require('../../shared/constants/washBay.constant');
const { SERVICE_PACKAGE_TYPES } = require('../../shared/constants/servicePackage.constant');
const {
    BOOKING_STATUS,
    BOOKING_HOLD_SLOT_STATUSES,
    BOOKING_CUSTOMER_CANCELABLE_STATUSES,
    BOOKING_STAFF_CANCELABLE_STATUSES,
    BOOKING_STAFF_NO_SHOW_STATUSES,
    BOOKING_PAYMENT_METHOD,
    BOOKING_PAYMENT_STATUS,
    DEFAULT_BOOKING_RULE,
} = require('../../shared/constants/booking.constant');

const DEFAULT_TIMEZONE_OFFSET = process.env.APP_TIMEZONE_OFFSET || '+07:00';
const BOOKING_ITEM_HOLD_STATUSES = ['PENDING', 'IN_PROGRESS'];

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

const toObjectIdString = (value) => {
    if (!value) {
        return null;
    }

    return value._id ? value._id.toString() : value.toString();
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
        .populate('service_package_id', 'name vehicle_type service_type base_price duration_minutes wash_bay_duration_minutes points_earned requires_wash_bay requires_care_staff care_staff_type care_staff_required_count care_staff_duration_minutes is_active')
        .populate('promotion_id', 'code name discount_type discount_value max_discount_amount min_order_amount start_at end_at is_active')
        .populate('created_by_staff_id', 'full_name email phone role is_active')
        .populate('canceled_by_id', 'full_name email phone role is_active')
        .populate('no_show_by_id', 'full_name email phone role is_active')
        .populate({
            path: 'assigned_care_staff_ids',
            select: 'user_id staff_code staff_type garage_id is_active created_at updated_at',
            populate: {
                path: 'user_id',
                select: 'full_name email phone role is_active',
            },
        })
        .populate({
            path: 'booking_items.assigned_care_staff.staff_profile_id',
            select: 'user_id staff_code staff_type garage_id is_active created_at updated_at',
            populate: {
                path: 'user_id',
                select: 'full_name email phone role is_active',
            },
        })
        .populate('booking_items.assigned_care_staff.user_id', 'full_name email phone role is_active');
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

const loadActiveServicePackagesByIds = async (servicePackageIds = []) => {
    const uniqueIds = [...new Set(servicePackageIds.map((id) => toObjectIdString(id)))];

    if (uniqueIds.length === 0) {
        return [];
    }

    const servicePackages = await ServicePackage.find({
        _id: { $in: uniqueIds },
        is_active: true,
    });
    const servicePackageMap = new Map(servicePackages.map((item) => [item._id.toString(), item]));

    return uniqueIds.map((id) => {
        const servicePackage = servicePackageMap.get(id);

        if (!servicePackage) {
            throw new AppError('One or more selected services are invalid or inactive', 400, 'INVALID_BOOKING_SERVICE_ITEM');
        }

        return servicePackage;
    });
};

const assertBookingServiceItemValid = (servicePackage, vehicleType) => {
    if (servicePackage.vehicle_type !== vehicleType) {
        throw new AppError(
            'Selected services must match vehicle type',
            400,
            'BOOKING_SERVICE_ITEM_VEHICLE_TYPE_MISMATCH'
        );
    }
};

const assertNoDuplicateBookingItems = (serviceItems = []) => {
    const seen = new Map();

    for (const item of serviceItems) {
        const servicePackageId = toObjectIdString(item.servicePackage._id);
        const previous = seen.get(servicePackageId);

        if (previous) {
            throw new AppError('Duplicate service item is not allowed', 409, 'DUPLICATE_SERVICE_ITEM');
        }

        seen.set(servicePackageId, item);
    }
};

const resolveBookingServiceItems = async ({ servicePackage, addOnServiceIds = [], vehicleType }) => {
    const serviceItems = [];
    let includedServices = [];

    if (servicePackage.service_type === SERVICE_PACKAGE_TYPES.COMBO) {
        includedServices = await loadActiveServicePackagesByIds(servicePackage.included_service_ids || []);

        if (includedServices.length === 0) {
            throw new AppError('Combo service package must include at least one service', 400, 'COMBO_INCLUDED_SERVICES_REQUIRED');
        }

        includedServices.forEach((item) => {
            serviceItems.push({
                servicePackage: item,
                source: 'COMBO_INCLUDED',
                parentComboId: servicePackage._id,
                priceSnapshot: 0,
            });
        });
    } else {
        serviceItems.push({
            servicePackage,
            source: 'PRIMARY',
            parentComboId: null,
            priceSnapshot: servicePackage.base_price,
        });
    }

    const addOnServices = await loadActiveServicePackagesByIds(addOnServiceIds || []);

    addOnServices.forEach((item) => {
        if (item.service_type === SERVICE_PACKAGE_TYPES.COMBO) {
            throw new AppError('Add-on service cannot be a combo package', 400, 'INVALID_ADD_ON_SERVICE');
        }

        serviceItems.push({
            servicePackage: item,
            source: 'ADD_ON',
            parentComboId: null,
            priceSnapshot: item.base_price,
        });
    });

    serviceItems.forEach((item) => assertBookingServiceItemValid(item.servicePackage, vehicleType));
    assertNoDuplicateBookingItems(serviceItems);

    return {
        serviceItems,
        addOnServices,
    };
};

const buildBookingItems = ({ startTime, serviceItems }) => {
    let elapsedMinutes = 0;

    return serviceItems.map((item, index) => {
        const servicePackage = item.servicePackage;
        const itemStartTime = addMinutes(startTime, elapsedMinutes);
        const washBayStartTime = servicePackage.requires_wash_bay
            ? addMinutes(itemStartTime, servicePackage.wash_bay_start_offset_minutes || 0)
            : null;
        const washBayEndTime = washBayStartTime
            ? addMinutes(washBayStartTime, servicePackage.wash_bay_duration_minutes || servicePackage.duration_minutes)
            : null;
        const careStaffStartTime = servicePackage.requires_care_staff
            ? addMinutes(itemStartTime, servicePackage.care_staff_start_offset_minutes || 0)
            : null;
        const careStaffEndTime = careStaffStartTime
            ? addMinutes(careStaffStartTime, servicePackage.care_staff_duration_minutes || servicePackage.duration_minutes)
            : null;

        elapsedMinutes += servicePackage.duration_minutes;

        return {
            item_key: `ITEM_${index + 1}_${toObjectIdString(servicePackage._id).toUpperCase()}`,
            service_package_id: servicePackage._id,
            source: item.source,
            parent_combo_id: item.parentComboId || null,
            name_snapshot: servicePackage.name,
            price_snapshot: item.priceSnapshot,
            duration_minutes: servicePackage.duration_minutes,
            sequence: index + 1,
            requires_wash_bay: servicePackage.requires_wash_bay,
            wash_bay_start_time: washBayStartTime,
            wash_bay_end_time: washBayEndTime,
            requires_care_staff: servicePackage.requires_care_staff,
            care_staff_type: servicePackage.requires_care_staff
                ? servicePackage.care_staff_type || STAFF_TYPES.VEHICLE_CARE_STAFF
                : null,
            care_staff_required_count: servicePackage.requires_care_staff
                ? servicePackage.care_staff_required_count || 1
                : 0,
            care_staff_start_time: careStaffStartTime,
            care_staff_end_time: careStaffEndTime,
            status: 'PENDING',
        };
    });
};

const getBookingResourceSummary = (bookingItems = []) => {
    const washBayItems = bookingItems.filter((item) => item.requires_wash_bay);
    const careStaffItems = bookingItems.filter((item) => item.requires_care_staff);

    return {
        requires_wash_bay: washBayItems.length > 0,
        wash_bay_start_time: washBayItems.length > 0
            ? new Date(Math.min(...washBayItems.map((item) => item.wash_bay_start_time.getTime())))
            : null,
        wash_bay_end_time: washBayItems.length > 0
            ? new Date(Math.max(...washBayItems.map((item) => item.wash_bay_end_time.getTime())))
            : null,
        requires_care_staff: careStaffItems.length > 0,
        care_staff_type: careStaffItems.length > 0 ? careStaffItems[0].care_staff_type : null,
        care_staff_required_count: careStaffItems.length > 0
            ? Math.max(...careStaffItems.map((item) => item.care_staff_required_count))
            : 0,
        care_staff_start_time: careStaffItems.length > 0
            ? new Date(Math.min(...careStaffItems.map((item) => item.care_staff_start_time.getTime())))
            : null,
        care_staff_end_time: careStaffItems.length > 0
            ? new Date(Math.max(...careStaffItems.map((item) => item.care_staff_end_time.getTime())))
            : null,
    };
};

const buildBookingPlan = ({ startTime, servicePackage, serviceItems, addOnServices }) => {
    const bookingItems = buildBookingItems({ startTime, serviceItems });
    const totalDurationMinutes = bookingItems.reduce((total, item) => total + item.duration_minutes, 0);
    const originalPrice = servicePackage.base_price + addOnServices.reduce((total, item) => total + item.base_price, 0);
    const resourceSummary = getBookingResourceSummary(bookingItems);

    return {
        bookingItems,
        totalDurationMinutes,
        originalPrice,
        addOnServiceIds: addOnServices.map((item) => item._id),
        ...resourceSummary,
    };
};

const buildBookingBasePayload = ({
    garage,
    servicePackage,
    bookingPlan,
    startTime,
    vehicleType,
    note,
    promotionResult = null,
    redeemResult = null,
}) => {
    const endTime = addMinutes(startTime, bookingPlan.totalDurationMinutes);
    const originalPrice = bookingPlan.originalPrice;
    const promotionDiscountAmount = promotionResult?.discount_amount || 0;
    const pointsDiscountAmount = redeemResult?.points_discount_amount || 0;
    const discountAmount = promotionDiscountAmount + pointsDiscountAmount;
    const finalPrice = Math.max(originalPrice - discountAmount, 0);

    return {
        garage_id: garage._id,
        service_package_id: servicePackage._id,
        vehicle_type: vehicleType,
        booking_date: startOfBookingDate(startTime),
        start_time: startTime,
        end_time: endTime,
        add_on_service_ids: bookingPlan.addOnServiceIds,
        booking_items: bookingPlan.bookingItems,
        wash_bay_start_time: bookingPlan.wash_bay_start_time,
        wash_bay_end_time: bookingPlan.wash_bay_end_time,
        requires_care_staff: bookingPlan.requires_care_staff,
        care_staff_type: bookingPlan.care_staff_type,
        care_staff_required_count: bookingPlan.care_staff_required_count,
        care_staff_start_time: bookingPlan.care_staff_start_time,
        care_staff_end_time: bookingPlan.care_staff_end_time,
        assigned_care_staff_ids: [],
        original_price: originalPrice,
        promotion_discount_amount: promotionDiscountAmount,
        points_discount_amount: pointsDiscountAmount,
        discount_amount: discountAmount,
        final_price: finalPrice,
        payment_method: BOOKING_PAYMENT_METHOD.CASH,
        payment_status: BOOKING_PAYMENT_STATUS.UNPAID,
        used_points: redeemResult?.used_points || 0,
        earned_points: 0,
        promotion_id: promotionResult?.promotion?._id || null,
        requires_wash_bay: bookingPlan.requires_wash_bay,
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

const countConfiguredWashBays = async (garageId, vehicleType) => {
    return WashBay.countDocuments({
        garage_id: garageId,
        vehicle_type: vehicleType,
    });
};

const countActiveWashBayInventory = async (garageId, vehicleType) => {
    return WashBay.countDocuments({
        garage_id: garageId,
        vehicle_type: vehicleType,
        is_active: true,
        status: { $ne: WASH_BAY_STATUS.INACTIVE },
    });
};

const countBookableWashBays = async (garageId, vehicleType) => {
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
        status: { $in: BOOKING_HOLD_SLOT_STATUSES },
        booking_items: {
            $elemMatch: {
                requires_wash_bay: true,
                status: { $in: BOOKING_ITEM_HOLD_STATUSES },
                wash_bay_start_time: { $lt: washBayEndTime },
                wash_bay_end_time: { $gt: washBayStartTime },
            },
        },
    };

    if (excludedBookingId) {
        filter._id = { $ne: excludedBookingId };
    }

    const result = await Booking.aggregate([
        { $match: filter },
        { $unwind: '$booking_items' },
        {
            $match: {
                'booking_items.requires_wash_bay': true,
                'booking_items.status': { $in: BOOKING_ITEM_HOLD_STATUSES },
                'booking_items.wash_bay_start_time': { $lt: washBayEndTime },
                'booking_items.wash_bay_end_time': { $gt: washBayStartTime },
            },
        },
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
            },
        },
    ]);

    return result[0]?.total || 0;
};

const countActiveCareStaff = async (garageId, careStaffType = STAFF_TYPES.VEHICLE_CARE_STAFF) => {
    return StaffProfile.countDocuments({
        garage_id: garageId,
        staff_type: careStaffType,
        is_active: true,
    });
};

const countOverlappedCareStaffBookings = async (garageId, careStaffType, careStaffStartTime, careStaffEndTime, excludedBookingId = null) => {
    const filter = {
        garage_id: garageId,
        status: { $in: BOOKING_HOLD_SLOT_STATUSES },
        booking_items: {
            $elemMatch: {
                requires_care_staff: true,
                status: { $in: BOOKING_ITEM_HOLD_STATUSES },
                care_staff_type: careStaffType,
                care_staff_start_time: { $lt: careStaffEndTime },
                care_staff_end_time: { $gt: careStaffStartTime },
            },
        },
    };

    if (excludedBookingId) {
        filter._id = { $ne: excludedBookingId };
    }

    const result = await Booking.aggregate([
        { $match: filter },
        { $unwind: '$booking_items' },
        {
            $match: {
                'booking_items.requires_care_staff': true,
                'booking_items.status': { $in: BOOKING_ITEM_HOLD_STATUSES },
                'booking_items.care_staff_type': careStaffType,
                'booking_items.care_staff_start_time': { $lt: careStaffEndTime },
                'booking_items.care_staff_end_time': { $gt: careStaffStartTime },
            },
        },
        {
            $group: {
                _id: null,
                total: { $sum: '$booking_items.care_staff_required_count' },
            },
        },
    ]);

    return result[0]?.total || 0;
};

const hasTimeOverlap = (startTime, endTime, comparedStartTime, comparedEndTime) => {
    return startTime < comparedEndTime && endTime > comparedStartTime;
};

const findActiveCareStaffProfiles = async (garageId, careStaffType = STAFF_TYPES.VEHICLE_CARE_STAFF) => {
    return StaffProfile.find({
        garage_id: garageId,
        staff_type: careStaffType,
        is_active: true,
    })
        .sort({ staff_code: 1, created_at: 1, _id: 1 })
        .lean();
};

const getOverlappedAssignedCareStaffProfileIds = async (garageId, careStaffType, careStaffStartTime, careStaffEndTime, excludedBookingId = null) => {
    const filter = {
        garage_id: garageId,
        status: { $in: BOOKING_HOLD_SLOT_STATUSES },
        booking_items: {
            $elemMatch: {
                requires_care_staff: true,
                status: { $in: BOOKING_ITEM_HOLD_STATUSES },
                care_staff_type: careStaffType,
                care_staff_start_time: { $lt: careStaffEndTime },
                care_staff_end_time: { $gt: careStaffStartTime },
                'assigned_care_staff.released_at': null,
            },
        },
    };

    if (excludedBookingId) {
        filter._id = { $ne: excludedBookingId };
    }

    const result = await Booking.aggregate([
        { $match: filter },
        { $unwind: '$booking_items' },
        {
            $match: {
                'booking_items.requires_care_staff': true,
                'booking_items.status': { $in: BOOKING_ITEM_HOLD_STATUSES },
                'booking_items.care_staff_type': careStaffType,
                'booking_items.care_staff_start_time': { $lt: careStaffEndTime },
                'booking_items.care_staff_end_time': { $gt: careStaffStartTime },
            },
        },
        { $unwind: '$booking_items.assigned_care_staff' },
        {
            $match: {
                'booking_items.assigned_care_staff.released_at': null,
            },
        },
        {
            $group: {
                _id: '$booking_items.assigned_care_staff.staff_profile_id',
            },
        },
    ]);

    return new Set(result.map((item) => toObjectIdString(item._id)).filter(Boolean));
};

const getBookableWashBayCount = async (garageId, vehicleType) => {
    const configuredWashBayCount = await countConfiguredWashBays(garageId, vehicleType);

    if (configuredWashBayCount <= 0) {
        throw new AppError(
            'Garage does not support this vehicle type',
            400,
            'GARAGE_VEHICLE_TYPE_NOT_SUPPORTED'
        );
    }

    const activeWashBayInventoryCount = await countActiveWashBayInventory(garageId, vehicleType);

    if (activeWashBayInventoryCount <= 0) {
        throw new AppError(
            'No active wash bay is available for this vehicle type',
            400,
            'NO_ACTIVE_WASH_BAY_FOR_VEHICLE_TYPE'
        );
    }

    const bookableWashBayCount = await countBookableWashBays(garageId, vehicleType);

    if (bookableWashBayCount <= 0) {
        throw new AppError(
            'Wash bay is temporarily unavailable for this vehicle type',
            409,
            'WASH_BAY_TEMPORARILY_UNAVAILABLE'
        );
    }

    return bookableWashBayCount;
};

const assertWashBayCapacityAvailable = async ({ garageId, vehicleType, requiresWashBay, washBayStartTime, washBayEndTime }) => {
    if (!requiresWashBay) {
        return;
    }

    const bookableWashBayCount = await getBookableWashBayCount(garageId, vehicleType);

    const overlappedBookingCount = await countOverlappedWashBayBookings(
        garageId,
        vehicleType,
        washBayStartTime,
        washBayEndTime
    );

    if (overlappedBookingCount >= bookableWashBayCount) {
        throw new AppError('Wash bay capacity is full for this time', 409, 'WASH_BAY_CAPACITY_FULL');
    }
};

const assertCareStaffCapacityAvailable = async ({
    garageId,
    requiresCareStaff,
    careStaffType,
    careStaffRequiredCount,
    careStaffStartTime,
    careStaffEndTime,
}) => {
    if (!requiresCareStaff) {
        return;
    }

    const activeCareStaffCount = await countActiveCareStaff(garageId, careStaffType);

    if (activeCareStaffCount <= 0) {
        throw new AppError(
            'No active care staff is available for this garage',
            400,
            'NO_ACTIVE_CARE_STAFF'
        );
    }

    const busyCareStaffCount = await countOverlappedCareStaffBookings(
        garageId,
        careStaffType,
        careStaffStartTime,
        careStaffEndTime
    );

    if (busyCareStaffCount + careStaffRequiredCount > activeCareStaffCount) {
        throw new AppError('Care staff capacity is full for this time', 409, 'CARE_STAFF_CAPACITY_FULL');
    }
};

const assertGarageCapacityAvailable = async ({
    garageId,
    vehicleType,
    bookingItems = [],
}) => {
    for (const item of bookingItems) {
        await assertWashBayCapacityAvailable({
            garageId,
            vehicleType,
            requiresWashBay: item.requires_wash_bay,
            washBayStartTime: item.wash_bay_start_time,
            washBayEndTime: item.wash_bay_end_time,
        });
        await assertCareStaffCapacityAvailable({
            garageId,
            requiresCareStaff: item.requires_care_staff,
            careStaffType: item.care_staff_type,
            careStaffRequiredCount: item.care_staff_required_count,
            careStaffStartTime: item.care_staff_start_time,
            careStaffEndTime: item.care_staff_end_time,
        });
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

const normalizeBookingItemKey = (value) => normalizeText(value)?.toUpperCase() || null;

const getCareStaffAssignmentStaffProfileId = (assignment) => {
    return assignment?.staff_profile_id?._id || assignment?.staff_profile_id || null;
};

const getStaffProfileUserId = (staffProfile) => {
    return staffProfile?.user_id?._id || staffProfile?.user_id || null;
};

const getActiveCareStaffAssignments = (bookingItem) => {
    return (bookingItem.assigned_care_staff || []).filter((assignment) => !assignment.released_at);
};

const getPlannedBusyCareStaffProfileIds = (plannedAssignments, careStaffType, careStaffStartTime, careStaffEndTime) => {
    return new Set(plannedAssignments
        .filter((assignment) => {
            return assignment.careStaffType === careStaffType
                && hasTimeOverlap(
                    assignment.careStaffStartTime,
                    assignment.careStaffEndTime,
                    careStaffStartTime,
                    careStaffEndTime
                );
        })
        .map((assignment) => assignment.staffProfileId)
        .filter(Boolean));
};

const addPlannedCareStaffAssignments = (plannedAssignments, bookingItem, assignments) => {
    for (const assignment of assignments) {
        const staffProfileId = toObjectIdString(getCareStaffAssignmentStaffProfileId(assignment));

        if (!staffProfileId) {
            continue;
        }

        plannedAssignments.push({
            staffProfileId,
            careStaffType: bookingItem.care_staff_type || STAFF_TYPES.VEHICLE_CARE_STAFF,
            careStaffStartTime: bookingItem.care_staff_start_time,
            careStaffEndTime: bookingItem.care_staff_end_time,
        });
    }
};

const syncAssignedCareStaffIds = (booking) => {
    const staffProfileIds = [];
    const seenStaffProfileIds = new Set();

    for (const item of booking.booking_items || []) {
        for (const assignment of item.assigned_care_staff || []) {
            const staffProfileId = getCareStaffAssignmentStaffProfileId(assignment);
            const staffProfileIdString = toObjectIdString(staffProfileId);

            if (!staffProfileIdString || seenStaffProfileIds.has(staffProfileIdString)) {
                continue;
            }

            seenStaffProfileIds.add(staffProfileIdString);
            staffProfileIds.push(staffProfileId);
        }
    }

    booking.assigned_care_staff_ids = staffProfileIds;

    if (typeof booking.markModified === 'function') {
        booking.markModified('assigned_care_staff_ids');
    }
};

const releaseCareStaffAssignmentsForBookingItem = (bookingItem, releasedAt) => {
    let released = false;

    for (const assignment of bookingItem.assigned_care_staff || []) {
        if (!assignment.released_at) {
            assignment.released_at = releasedAt;
            released = true;
        }
    }

    return released;
};

const releaseActiveCareStaffAssignmentsForBooking = (booking, releasedAt) => {
    const releasedBookingItemKeys = [];

    for (const bookingItem of booking.booking_items || []) {
        if (releaseCareStaffAssignmentsForBookingItem(bookingItem, releasedAt)) {
            const bookingItemKey = normalizeBookingItemKey(bookingItem.item_key);

            if (bookingItemKey) {
                releasedBookingItemKeys.push(bookingItemKey);
            }
        }
    }

    if (releasedBookingItemKeys.length > 0 && typeof booking.markModified === 'function') {
        booking.markModified('booking_items');
    }

    return releasedBookingItemKeys;
};

const assignCareStaffToBookingIfNeeded = async (booking) => {
    const careStaffItems = [...(booking.booking_items || [])]
        .filter((item) => item.requires_care_staff)
        .sort((a, b) => a.sequence - b.sequence);

    if (careStaffItems.length === 0) {
        syncAssignedCareStaffIds(booking);
        return;
    }

    const assignedAt = new Date();
    const plannedAssignments = [];

    for (const bookingItem of careStaffItems) {
        bookingItem.assigned_care_staff = bookingItem.assigned_care_staff || [];

        const careStaffType = bookingItem.care_staff_type || STAFF_TYPES.VEHICLE_CARE_STAFF;
        const requiredCount = bookingItem.care_staff_required_count || 1;
        const activeAssignments = getActiveCareStaffAssignments(bookingItem);

        addPlannedCareStaffAssignments(plannedAssignments, bookingItem, activeAssignments);

        if (activeAssignments.length >= requiredCount) {
            continue;
        }

        const activeProfiles = await findActiveCareStaffProfiles(booking.garage_id, careStaffType);

        if (activeProfiles.length <= 0) {
            throw new AppError(
                'No active care staff is available for this garage',
                400,
                'NO_ACTIVE_CARE_STAFF'
            );
        }

        const busyCareStaffCount = await countOverlappedCareStaffBookings(
            booking.garage_id,
            careStaffType,
            bookingItem.care_staff_start_time,
            bookingItem.care_staff_end_time,
            booking._id
        );

        if (busyCareStaffCount + requiredCount > activeProfiles.length) {
            throw new AppError('Care staff capacity is full for this time', 409, 'CARE_STAFF_CAPACITY_FULL');
        }

        const busyAssignedCareStaffProfileIds = await getOverlappedAssignedCareStaffProfileIds(
            booking.garage_id,
            careStaffType,
            bookingItem.care_staff_start_time,
            bookingItem.care_staff_end_time,
            booking._id
        );
        const plannedBusyCareStaffProfileIds = getPlannedBusyCareStaffProfileIds(
            plannedAssignments,
            careStaffType,
            bookingItem.care_staff_start_time,
            bookingItem.care_staff_end_time
        );
        const activeAssignmentIds = new Set(activeAssignments
            .map((assignment) => toObjectIdString(getCareStaffAssignmentStaffProfileId(assignment)))
            .filter(Boolean));
        const selectedProfiles = activeProfiles
            .filter((profile) => {
                const staffProfileId = toObjectIdString(profile._id);

                return staffProfileId
                    && !busyAssignedCareStaffProfileIds.has(staffProfileId)
                    && !plannedBusyCareStaffProfileIds.has(staffProfileId)
                    && !activeAssignmentIds.has(staffProfileId);
            })
            .slice(0, requiredCount - activeAssignments.length);

        if (selectedProfiles.length < requiredCount - activeAssignments.length) {
            throw new AppError('Care staff capacity is full for this time', 409, 'CARE_STAFF_CAPACITY_FULL');
        }

        const newAssignments = selectedProfiles.map((profile) => ({
            staff_profile_id: profile._id,
            user_id: getStaffProfileUserId(profile),
            assigned_at: assignedAt,
            released_at: null,
        }));

        bookingItem.assigned_care_staff.push(...newAssignments);
        addPlannedCareStaffAssignments(plannedAssignments, bookingItem, newAssignments);
    }

    syncAssignedCareStaffIds(booking);

    if (typeof booking.markModified === 'function') {
        booking.markModified('booking_items');
    }
};

const markBookingItemDoneIfReady = async (booking, bookingItemKey) => {
    const normalizedBookingItemKey = normalizeBookingItemKey(bookingItemKey);

    if (!normalizedBookingItemKey) {
        return;
    }

    const bookingItem = (booking.booking_items || []).find((item) => {
        return normalizeBookingItemKey(item.item_key) === normalizedBookingItemKey;
    });

    if (!bookingItem || bookingItem.status === 'DONE') {
        return;
    }

    const isReady = await bookingServiceStepService.areAllRequiredStepsDoneForBookingItem(
        booking._id,
        normalizedBookingItemKey
    );

    if (!isReady) {
        return;
    }

    const releasedAt = new Date();

    bookingItem.status = 'DONE';
    releaseCareStaffAssignmentsForBookingItem(bookingItem, releasedAt);
    booking.markModified('booking_items');
    await booking.save();
    await bookingServiceStepService.markResourceReleasedForBookingItem(
        booking._id,
        normalizedBookingItemKey,
        releasedAt
    );

    const hasPendingWashBayItem = (booking.booking_items || []).some((item) => {
        return item.requires_wash_bay && BOOKING_ITEM_HOLD_STATUSES.includes(item.status);
    });

    if (bookingItem.requires_wash_bay && !hasPendingWashBayItem) {
        await releaseWashBayForBooking(booking);
    }
};

const getAvailableSlots = async ({ garage_id, service_package_id, add_on_service_ids = [], date } = {}) => {
    const garage = await getActiveGarage(garage_id);
    const servicePackage = await getActiveServicePackage(service_package_id);
    const { serviceItems, addOnServices } = await resolveBookingServiceItems({
        servicePackage,
        addOnServiceIds: add_on_service_ids,
        vehicleType: servicePackage.vehicle_type,
    });
    const openingDate = createDateFromLocalTime(date, garage.opening_time);
    const closingDate = createDateFromLocalTime(date, garage.closing_time);

    if (Number.isNaN(openingDate.getTime()) || Number.isNaN(closingDate.getTime())) {
        throw new AppError('Invalid garage business hours', 400, 'INVALID_GARAGE_BUSINESS_HOURS');
    }

    const hasWashBayItem = serviceItems.some((item) => item.servicePackage.requires_wash_bay);
    const careStaffTypes = [...new Set(serviceItems
        .filter((item) => item.servicePackage.requires_care_staff)
        .map((item) => item.servicePackage.care_staff_type || STAFF_TYPES.VEHICLE_CARE_STAFF))];
    const activeWashBayCount = hasWashBayItem
        ? await getBookableWashBayCount(garage._id, servicePackage.vehicle_type)
        : null;
    const activeCareStaffByType = {};

    for (const careStaffType of careStaffTypes) {
        activeCareStaffByType[careStaffType] = await countActiveCareStaff(garage._id, careStaffType);
    }

    const slots = [];
    let currentStartTime = new Date(openingDate);

    while (currentStartTime < closingDate) {
        const bookingPlan = buildBookingPlan({
            startTime: currentStartTime,
            servicePackage,
            serviceItems,
            addOnServices,
        });
        const endTime = addMinutes(currentStartTime, bookingPlan.totalDurationMinutes);

        if (endTime <= closingDate) {
            let isAvailable = currentStartTime > new Date();
            let availableCapacity = null;
            let availableWashBayCapacity = null;
            let availableCareStaffCapacity = null;

            for (const item of bookingPlan.bookingItems) {
                if (item.requires_wash_bay) {
                    const overlappedBookingCount = await countOverlappedWashBayBookings(
                        garage._id,
                        servicePackage.vehicle_type,
                        item.wash_bay_start_time,
                        item.wash_bay_end_time
                    );
                    const itemAvailableWashBayCapacity = Math.max(activeWashBayCount - overlappedBookingCount, 0);

                    availableWashBayCapacity = availableWashBayCapacity === null
                        ? itemAvailableWashBayCapacity
                        : Math.min(availableWashBayCapacity, itemAvailableWashBayCapacity);
                    isAvailable = isAvailable && activeWashBayCount > 0 && itemAvailableWashBayCapacity > 0;
                }

                if (item.requires_care_staff) {
                    const activeCareStaffCount = activeCareStaffByType[item.care_staff_type] || 0;
                    const busyCareStaffCount = await countOverlappedCareStaffBookings(
                        garage._id,
                        item.care_staff_type,
                        item.care_staff_start_time,
                        item.care_staff_end_time
                    );
                    const itemAvailableCareStaffCapacity = Math.max(activeCareStaffCount - busyCareStaffCount, 0);

                    availableCareStaffCapacity = availableCareStaffCapacity === null
                        ? itemAvailableCareStaffCapacity
                        : Math.min(availableCareStaffCapacity, itemAvailableCareStaffCapacity);
                    isAvailable = isAvailable
                        && activeCareStaffCount > 0
                        && itemAvailableCareStaffCapacity >= item.care_staff_required_count;
                }
            }

            if (availableWashBayCapacity !== null) {
                availableCapacity = availableWashBayCapacity;
            }

            if (availableCareStaffCapacity !== null) {
                availableCapacity = availableCapacity === null
                    ? availableCareStaffCapacity
                    : Math.min(availableCapacity, availableCareStaffCapacity);
            }

            slots.push({
                start_time: currentStartTime,
                end_time: endTime,
                wash_bay_start_time: bookingPlan.wash_bay_start_time,
                wash_bay_end_time: bookingPlan.wash_bay_end_time,
                care_staff_start_time: bookingPlan.care_staff_start_time,
                care_staff_end_time: bookingPlan.care_staff_end_time,
                booking_items: bookingPlan.bookingItems,
                is_available: isAvailable,
                available_capacity: availableCapacity,
                available_wash_bay_capacity: availableWashBayCapacity,
                available_care_staff_capacity: availableCareStaffCapacity,
            });
        }

        currentStartTime = addMinutes(currentStartTime, garage.slot_interval_minutes);
    }

    return {
        garage_id: garage._id.toString(),
        service_package_id: servicePackage._id.toString(),
        add_on_service_ids: addOnServices.map((item) => item._id.toString()),
        date,
        vehicle_type: servicePackage.vehicle_type,
        requires_wash_bay: serviceItems.some((item) => item.servicePackage.requires_wash_bay),
        requires_care_staff: serviceItems.some((item) => item.servicePackage.requires_care_staff),
        care_staff_type: careStaffTypes.length === 1 ? careStaffTypes[0] : null,
        care_staff_required_count: serviceItems.reduce((max, item) => {
            if (!item.servicePackage.requires_care_staff) {
                return max;
            }

            return Math.max(max, item.servicePackage.care_staff_required_count || 1);
        }, 0),
        slot_interval_minutes: garage.slot_interval_minutes,
        active_wash_bay_count: activeWashBayCount,
        active_care_staff_count: careStaffTypes.length === 1 ? activeCareStaffByType[careStaffTypes[0]] : null,
        active_care_staff_by_type: activeCareStaffByType,
        slots,
    };
};

const getPriceAfterPromotion = ({ originalPrice, promotionResult = null }) => {
    return Math.max(originalPrice - (promotionResult?.discount_amount || 0), 0);
};

const buildCustomerBookingCreatePayload = ({ basePayload, customerId, vehicle }) => {
    return {
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
    };
};

const createBookingDocument = async (payload, session = null) => {
    if (!session) {
        return Booking.create(payload);
    }

    const documents = await Booking.create([payload], { session });

    return documents[0];
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

    assertServicePackageMatchesVehicleType(servicePackage, vehicle.vehicle_type);

    const { serviceItems, addOnServices } = await resolveBookingServiceItems({
        servicePackage,
        addOnServiceIds: createPayload.add_on_service_ids || [],
        vehicleType: vehicle.vehicle_type,
    });
    const bookingPlan = buildBookingPlan({
        startTime,
        servicePackage,
        serviceItems,
        addOnServices,
    });

    const promotionResult = await promotionService.validatePromotionForBooking({
        promotion_code: createPayload.promotion_code,
        customer_id: customerId,
        servicePackage,
        vehicleType: vehicle.vehicle_type,
        orderAmount: bookingPlan.originalPrice,
        bookingStartTime: startTime,
    });
    const usedPoints = createPayload.used_points || 0;
    const priceAfterPromotion = getPriceAfterPromotion({
        originalPrice: bookingPlan.originalPrice,
        promotionResult,
    });
    const redeemResult = await loyaltyService.calculateBookingRedeemDiscount({
        customerId,
        usedPoints,
        priceAfterPromotion,
    });
    const basePayload = buildBookingBasePayload({
        garage,
        servicePackage,
        bookingPlan,
        startTime,
        vehicleType: vehicle.vehicle_type,
        note: createPayload.note,
        promotionResult,
        redeemResult,
    });

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
        bookingItems: basePayload.booking_items,
    });

    let booking;

    if (basePayload.used_points > 0) {
        const session = await mongoose.startSession();

        try {
            await session.withTransaction(async () => {
                const transactionalRedeemResult = await loyaltyService.calculateBookingRedeemDiscount({
                    customerId,
                    usedPoints: basePayload.used_points,
                    priceAfterPromotion,
                    session,
                });
                const transactionalBasePayload = buildBookingBasePayload({
                    garage,
                    servicePackage,
                    bookingPlan,
                    startTime,
                    vehicleType: vehicle.vehicle_type,
                    note: createPayload.note,
                    promotionResult,
                    redeemResult: transactionalRedeemResult,
                });

                booking = await createBookingDocument(
                    buildCustomerBookingCreatePayload({
                        basePayload: transactionalBasePayload,
                        customerId,
                        vehicle,
                    }),
                    session
                );

                await loyaltyService.redeemPointsForBooking({
                    booking,
                    customerId,
                    usedPoints: transactionalBasePayload.used_points,
                    priceAfterPromotion,
                    actorId: customerId,
                    expectedPointsDiscountAmount: transactionalBasePayload.points_discount_amount,
                    session,
                });
            });
        } finally {
            await session.endSession();
        }
    } else {
        booking = await createBookingDocument(buildCustomerBookingCreatePayload({
            basePayload,
            customerId,
            vehicle,
        }));
    }

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

    await assertStaffCanAccessGarage(user, garage._id);

    assertServicePackageMatchesVehicleType(
        servicePackage,
        createPayload.vehicle_type
    );

    const { serviceItems, addOnServices } = await resolveBookingServiceItems({
        servicePackage,
        addOnServiceIds: createPayload.add_on_service_ids || [],
        vehicleType: createPayload.vehicle_type,
    });
    const bookingPlan = buildBookingPlan({
        startTime,
        servicePackage,
        serviceItems,
        addOnServices,
    });

    const promotionResult = await promotionService.validatePromotionForBooking({
        promotion_code: createPayload.promotion_code,
        customer_id: null,
        servicePackage,
        vehicleType: createPayload.vehicle_type,
        orderAmount: bookingPlan.originalPrice,
        bookingStartTime: startTime,
    });
    const basePayload = buildBookingBasePayload({
        garage,
        servicePackage,
        bookingPlan,
        startTime,
        vehicleType: createPayload.vehicle_type,
        note: createPayload.note,
        promotionResult,
    });

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
        bookingItems: basePayload.booking_items,
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
    await loyaltyService.refundRedeemedPointsForBooking({
        booking,
        actorId: customerId,
    });

    const populatedBooking = await getBookingDocumentById(booking._id);

    return BookingMapper.toBookingDto(populatedBooking);
};

const cancelBooking = async (user, bookingId, { reason } = {}) => {
    const booking = await getRawBookingDocumentById(bookingId);

    await assertStaffCanAccessBooking(user, booking);

    if (booking.payment_status === BOOKING_PAYMENT_STATUS.PAID) {
        throw new AppError('Paid booking cannot be canceled', 409, 'BOOKING_PAID_CANNOT_CANCEL');
    }

    if (booking.payment_status === BOOKING_PAYMENT_STATUS.PENDING) {
        throw new AppError('Pending payment booking cannot be canceled', 409, 'BOOKING_PENDING_PAYMENT_CANNOT_CANCEL');
    }

    if (!BOOKING_STAFF_CANCELABLE_STATUSES.includes(booking.status)) {
        throw new AppError('Booking cannot be canceled in current status', 400, 'BOOKING_CANCEL_NOT_ALLOWED');
    }

    await releaseWashBayForBooking(booking);

    const canceledAt = new Date();
    const releasedBookingItemKeys = releaseActiveCareStaffAssignmentsForBooking(booking, canceledAt);

    booking.status = BOOKING_STATUS.CANCELED;
    booking.canceled_at = canceledAt;
    booking.canceled_by_id = user._id;
    booking.cancel_reason = normalizeText(reason);

    await booking.save();
    await loyaltyService.refundRedeemedPointsForBooking({
        booking,
        actorId: user._id,
    });

    for (const bookingItemKey of releasedBookingItemKeys) {
        await bookingServiceStepService.markResourceReleasedForBookingItem(
            booking._id,
            bookingItemKey,
            canceledAt
        );
    }

    const populatedBooking = await getBookingDocumentById(booking._id);

    return BookingMapper.toBookingDto(populatedBooking);
};

const markNoShow = async (user, bookingId, { reason } = {}) => {
    const booking = await getRawBookingDocumentById(bookingId);

    await assertStaffCanAccessBooking(user, booking);

    if (booking.is_walk_in) {
        throw new AppError('Walk-in booking cannot be marked no-show', 400, 'WALK_IN_BOOKING_CANNOT_NO_SHOW');
    }

    if (booking.payment_status === BOOKING_PAYMENT_STATUS.PAID) {
        throw new AppError('Paid booking cannot be marked no-show', 409, 'BOOKING_PAID_CANNOT_NO_SHOW');
    }

    if (booking.payment_status === BOOKING_PAYMENT_STATUS.PENDING) {
        throw new AppError('Pending payment booking cannot be marked no-show', 409, 'BOOKING_PENDING_PAYMENT_CANNOT_NO_SHOW');
    }

    if (!BOOKING_STAFF_NO_SHOW_STATUSES.includes(booking.status)) {
        throw new AppError('Booking cannot be marked no-show in current status', 400, 'BOOKING_NO_SHOW_NOT_ALLOWED');
    }

    await releaseWashBayForBooking(booking);

    const noShowAt = new Date();
    const releasedBookingItemKeys = releaseActiveCareStaffAssignmentsForBooking(booking, noShowAt);

    booking.status = BOOKING_STATUS.NO_SHOW;
    booking.no_show_at = noShowAt;
    booking.no_show_by_id = user._id;
    booking.no_show_reason = normalizeText(reason);

    await booking.save();
    await loyaltyService.refundRedeemedPointsForBooking({
        booking,
        actorId: user._id,
    });

    for (const bookingItemKey of releasedBookingItemKeys) {
        await bookingServiceStepService.markResourceReleasedForBookingItem(
            booking._id,
            bookingItemKey,
            noShowAt
        );
    }

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

    await assignCareStaffToBookingIfNeeded(booking);
    await assignWashBayToBookingIfNeeded(booking);

    booking.status = BOOKING_STATUS.IN_PROGRESS;
    booking.started_at = new Date();

    if (note !== undefined) {
        booking.note = normalizeText(note);
    }

    await booking.save();

    const serviceSteps = await bookingServiceStepService.createStepsForBooking(booking, servicePackage);
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

    const step = await bookingServiceStepService.markStepDone({
        bookingId: booking._id,
        stepId,
        staffId: user._id,
        note,
    });

    await markBookingItemDoneIfReady(booking, step.booking_item_key);

    return step;
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

    const completedAt = new Date();
    const releasedBookingItemKeys = releaseActiveCareStaffAssignmentsForBooking(booking, completedAt);

    booking.status = BOOKING_STATUS.COMPLETED;
    booking.completed_at = completedAt;

    if (note !== undefined) {
        booking.note = normalizeText(note);
    }

    await booking.save();

    for (const bookingItemKey of releasedBookingItemKeys) {
        await bookingServiceStepService.markResourceReleasedForBookingItem(
            booking._id,
            bookingItemKey,
            completedAt
        );
    }

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
    cancelBooking,
    markNoShow,
    checkInBooking,
    assignWashBay,
    startService,
    getBookingServiceSteps,
    markBookingServiceStepDone,
    completeService,
    markPaid,
};
