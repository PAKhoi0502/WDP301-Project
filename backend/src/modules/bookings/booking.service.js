const mongoose = require('mongoose');
const { randomUUID } = require('crypto');

const Booking = require('./booking.model');
const BookingMapper = require('./booking.mapper');
const User = require('../users/user.model');
const Vehicle = require('../vehicles/vehicle.model');
const Garage = require('../garages/garage.model');
const WashBay = require('../wash-bays/washBay.model');
const StaffProfile = require('../staff-profiles/staffProfile.model');
const ServicePackage = require('../service-packages/servicePackage.model');
const BookingIncident = require('../booking-incidents/bookingIncident.model');
const BookingIncidentMapper = require('../booking-incidents/bookingIncident.mapper');
const bookingServiceStepService = require('../booking-service-steps/bookingServiceStep.service');
const bookingPaymentService = require('./bookingPayment.service');
const paymentService = require('../payments/payment.service');
const auditLogService = require('../audit-logs/auditLog.service');
const promotionService = require('../promotions/promotion.service');
const promotionUsageService = require('../promotion-usages/promotionUsage.service');
const loyaltyService = require('../loyalty/loyalty.service');
const bookingViolationService = require('../booking-violations/bookingViolation.service');
const customerVoucherService = require('../customer-vouchers/customerVoucher.service');
const CustomerVoucherMapper = require('../customer-vouchers/customerVoucher.mapper');
const notificationService = require('../notifications/notification.service');
const CustomerLoyalty = require('../loyalty/customerLoyalty.model');
const TierRule = require('../loyalty/tierRule.model');
const { LOYALTY_TIERS } = require('../../shared/constants/loyalty.constant');
const { AppError } = require('../../shared/utils/appError');
const { USER_ROLES } = require('../../shared/constants/roles.constant');
const {
    STAFF_TYPES,
    STAFF_CAPABILITIES,
    staffTypeHasCapability,
} = require('../../shared/constants/staff.constant');
const { WASH_BAY_STATUS } = require('../../shared/constants/washBay.constant');
const {
    SERVICE_PACKAGE_TYPES,
    SERVICE_TRANSITION_MODES,
} = require('../../shared/constants/servicePackage.constant');
const { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } = require('../../shared/constants/audit.constant');
const { normalizePhone, isValidPhone } = require('../../shared/utils/phone');
const {
    BOOKING_STATUS,
    BOOKING_ARRIVAL_STATUS,
    BOOKING_LATE_RESOLUTION,
    BOOKING_HOLD_SLOT_STATUSES,
    BOOKING_CUSTOMER_CANCELABLE_STATUSES,
    BOOKING_STAFF_CANCELABLE_STATUSES,
    BOOKING_STAFF_NO_SHOW_STATUSES,
    BOOKING_PAYMENT_METHOD,
    BOOKING_PAYMENT_STATUS,
    DEFAULT_BOOKING_RULE,
    BOOKING_ITEM_STATUS,
    BOOKING_ITEM_COMPLETION_SOURCE,
} = require('../../shared/constants/booking.constant');
const {
    BOOKING_OPERATION_STATUS,
    BOOKING_INCIDENT_TYPES,
    BOOKING_INCIDENT_STATUS,
    BOOKING_INCIDENT_DECISIONS,
    BOOKING_INCIDENT_CONTACT_CHANNELS,
    BOOKING_INCIDENT_DECISION_SOURCES,
    BOOKING_INCIDENT_CONTINUATION_POLICIES,
    BOOKING_CANCELLATION_SOURCES,
} = require('../../shared/constants/bookingIncident.constant');
const {
    NOTIFICATION_TYPES,
    NOTIFICATION_RELATED_TYPES,
} = require('../../shared/constants/notification.constant');

const DEFAULT_TIMEZONE_OFFSET = process.env.APP_TIMEZONE_OFFSET || '+07:00';
const BOOKING_ITEM_HOLD_STATUSES = [
    BOOKING_ITEM_STATUS.PENDING,
    BOOKING_ITEM_STATUS.IN_PROGRESS,
    BOOKING_ITEM_STATUS.PAUSED,
    BOOKING_ITEM_STATUS.AWAITING_CONFIRMATION,
    BOOKING_ITEM_STATUS.WAITING_RESOURCE,
    BOOKING_ITEM_STATUS.DONE,
];
const BOOKING_ITEM_ACTIVE_STATUSES = [
    BOOKING_ITEM_STATUS.PENDING,
    BOOKING_ITEM_STATUS.IN_PROGRESS,
    BOOKING_ITEM_STATUS.PAUSED,
    BOOKING_ITEM_STATUS.AWAITING_CONFIRMATION,
    BOOKING_ITEM_STATUS.WAITING_RESOURCE,
];
const BOOKING_RESOURCE_HOLD_STATUSES = [...BOOKING_HOLD_SLOT_STATUSES, BOOKING_STATUS.COMPLETED];
const SERVICE_ITEM_TIMER_CLAIM_TIMEOUT_MS = 30 * 1000;

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

const addSeconds = (date, seconds) => {
    return new Date(date.getTime() + seconds * 1000);
};

const getTimezoneOffsetMinutes = () => {
    const match = DEFAULT_TIMEZONE_OFFSET.match(/^([+-])(\d{2}):(\d{2})$/);

    if (!match) {
        return 0;
    }

    const direction = match[1] === '-' ? -1 : 1;

    return direction * (Number(match[2]) * 60 + Number(match[3]));
};

const getLocalDateString = (date) => {
    return addMinutes(date, getTimezoneOffsetMinutes()).toISOString().slice(0, 10);
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

const parseDateOnly = (dateString) => {
    const [year, month, day] = String(dateString).split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
        !Number.isInteger(year)
        || !Number.isInteger(month)
        || !Number.isInteger(day)
        || date.getUTCFullYear() !== year
        || date.getUTCMonth() !== month - 1
        || date.getUTCDate() !== day
    ) {
        throw new AppError('Booking date is invalid', 400, 'INVALID_BOOKING_DATE');
    }

    return date;
};

const addDaysToDateString = (dateString, days) => {
    const date = parseDateOnly(dateString);

    date.setUTCDate(date.getUTCDate() + days);

    return date.toISOString().slice(0, 10);
};

const ceilToGarageSlot = (date, garage) => {
    const openingDate = createDateFromLocalTime(getLocalDateString(date), garage.opening_time);
    const intervalMilliseconds = garage.slot_interval_minutes * 60 * 1000;
    const elapsedMilliseconds = date.getTime() - openingDate.getTime();
    const roundedIntervals = Math.ceil(elapsedMilliseconds / intervalMilliseconds);

    return new Date(openingDate.getTime() + roundedIntervals * intervalMilliseconds);
};

const getFirstFutureCandidateStartTime = ({ openingDate, now, garage }) => {
    if (now < openingDate) {
        return new Date(openingDate);
    }

    const candidate = ceilToGarageSlot(now, garage);

    if (candidate <= now) {
        return addMinutes(candidate, garage.slot_interval_minutes);
    }

    return candidate;
};

const assertBookingStartTimeAligned = (garage, startTime) => {
    const openingDate = createDateFromLocalTime(getLocalDateString(startTime), garage.opening_time);
    const intervalMilliseconds = garage.slot_interval_minutes * 60 * 1000;
    const elapsedMilliseconds = startTime.getTime() - openingDate.getTime();

    if (elapsedMilliseconds < 0 || elapsedMilliseconds % intervalMilliseconds !== 0) {
        throw new AppError(
            `Booking start time must align with the garage ${garage.slot_interval_minutes}-minute slot interval`,
            400,
            'BOOKING_START_TIME_NOT_ALIGNED'
        );
    }
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
        .populate('garage_id', 'name garage_code address city opening_time closing_time slot_interval_minutes late_grace_minutes is_active')
        .populate('wash_bay_id', 'name bay_code vehicle_type status is_active')
        .populate('service_package_id', 'name vehicle_type service_type base_price duration_minutes countdown_duration_seconds transition_mode wash_bay_duration_minutes points_earned requires_wash_bay requires_care_staff care_staff_type care_staff_required_count care_staff_duration_minutes is_active')
        .populate('promotion_id', 'code name discount_type discount_value max_discount_amount min_order_amount start_at end_at is_active')
        .populate('customer_voucher_id')
        .populate({
            path: 'active_incident_id',
            populate: [
                { path: 'reported_by_id', select: 'full_name email phone role is_active' },
                { path: 'decision_recorded_by_id', select: 'full_name email phone role is_active' },
                { path: 'resolved_by_id', select: 'full_name email phone role is_active' },
            ],
        })
        .populate('created_by_staff_id', 'full_name email phone role is_active')
        .populate('assigned_inspection_staff_id', 'full_name email phone role is_active')
        .populate('canceled_by_id', 'full_name email phone role is_active')
        .populate('no_show_by_id', 'full_name email phone role is_active')
        .populate('late_accepted_by_id', 'full_name email phone role is_active')
        .populate('rescheduled_by_id', 'full_name email phone role is_active')
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
        .populate('booking_items.assigned_care_staff.user_id', 'full_name email phone role is_active')
        .populate({
            path: 'booking_items.assigned_execution_staff.staff_profile_id',
            select: 'user_id staff_code staff_type garage_id is_active created_at updated_at',
            populate: {
                path: 'user_id',
                select: 'full_name email phone role is_active',
            },
        })
        .populate('booking_items.assigned_execution_staff.user_id', 'full_name email phone role is_active');
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
    const dateString = getLocalDateString(startTime);
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

const assertBookingStartTimeInFuture = (startTime, now = new Date()) => {
    if (startTime <= now) {
        throw new AppError('Booking start time must be in the future', 400, 'BOOKING_START_TIME_IN_PAST');
    }
};

const getBookingWindowEnd = (now, bookingRule) => {
    return addMinutes(now, bookingRule.booking_window_days * 24 * 60);
};

const assertBookingWithinWindow = (startTime, bookingRule, now = new Date()) => {
    const maxStartTime = getBookingWindowEnd(now, bookingRule);

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

const buildBookingItems = ({ startTime, serviceItems, garage }) => {
    let elapsedMinutes = 0;

    return serviceItems.map((item, index) => {
        const servicePackage = item.servicePackage;
        const itemStartTime = addMinutes(startTime, elapsedMinutes);
        const itemEndTime = addMinutes(itemStartTime, servicePackage.duration_minutes);
        const washBayStartTime = servicePackage.requires_wash_bay
            ? addMinutes(itemStartTime, servicePackage.wash_bay_start_offset_minutes || 0)
            : null;
        const washBayWorkEndTime = washBayStartTime
            ? addMinutes(washBayStartTime, servicePackage.wash_bay_duration_minutes || servicePackage.duration_minutes)
            : null;
        const washBayReservedUntil = washBayWorkEndTime
            ? ceilToGarageSlot(washBayWorkEndTime, garage)
            : null;
        const careStaffStartTime = servicePackage.requires_care_staff
            ? addMinutes(itemStartTime, servicePackage.care_staff_start_offset_minutes || 0)
            : null;
        const careStaffWorkEndTime = careStaffStartTime
            ? addMinutes(careStaffStartTime, servicePackage.care_staff_duration_minutes || servicePackage.duration_minutes)
            : null;
        const careStaffReservedUntil = careStaffWorkEndTime
            ? ceilToGarageSlot(careStaffWorkEndTime, garage)
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
            countdown_duration_seconds: servicePackage.countdown_duration_seconds
                || servicePackage.duration_minutes * 60,
            transition_mode: servicePackage.transition_mode
                || SERVICE_TRANSITION_MODES.REQUIRE_CONFIRMATION,
            item_start_time: itemStartTime,
            item_end_time: itemEndTime,
            sequence: index + 1,
            requires_wash_bay: servicePackage.requires_wash_bay,
            wash_bay_start_time: washBayStartTime,
            wash_bay_end_time: washBayWorkEndTime,
            wash_bay_work_end_time: washBayWorkEndTime,
            wash_bay_reserved_until: washBayReservedUntil,
            requires_care_staff: servicePackage.requires_care_staff,
            care_staff_type: servicePackage.requires_care_staff
                ? servicePackage.care_staff_type || STAFF_TYPES.VEHICLE_CARE_STAFF
                : null,
            care_staff_required_count: servicePackage.requires_care_staff
                ? servicePackage.care_staff_required_count || 1
                : 0,
            care_staff_start_time: careStaffStartTime,
            care_staff_end_time: careStaffWorkEndTime,
            care_staff_work_end_time: careStaffWorkEndTime,
            care_staff_reserved_until: careStaffReservedUntil,
            status: BOOKING_ITEM_STATUS.PENDING,
            actual_started_at: null,
            countdown_ends_at: null,
            actual_completed_at: null,
            remaining_seconds_at_pause: null,
            countdown_resume_seconds: null,
            paused_at: null,
            paused_by_staff_id: null,
            pause_reason: null,
            total_paused_seconds: 0,
            completion_source: null,
            completed_by_staff_id: null,
            completion_note: null,
            timer_claimed_at: null,
            timer_claim_token: null,
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
        wash_bay_work_end_time: washBayItems.length > 0
            ? new Date(Math.max(...washBayItems.map((item) => item.wash_bay_work_end_time.getTime())))
            : null,
        wash_bay_reserved_until: washBayItems.length > 0
            ? new Date(Math.max(...washBayItems.map((item) => item.wash_bay_reserved_until.getTime())))
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
        care_staff_work_end_time: careStaffItems.length > 0
            ? new Date(Math.max(...careStaffItems.map((item) => item.care_staff_work_end_time.getTime())))
            : null,
        care_staff_reserved_until: careStaffItems.length > 0
            ? new Date(Math.max(...careStaffItems.map((item) => item.care_staff_reserved_until.getTime())))
            : null,
    };
};

const buildBookingPlan = ({ startTime, servicePackage, serviceItems, addOnServices, garage }) => {
    const bookingItems = buildBookingItems({ startTime, serviceItems, garage });
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

const BOOKING_ITEM_TIMELINE_FIELDS = [
    'item_start_time',
    'item_end_time',
    'wash_bay_start_time',
    'wash_bay_end_time',
    'wash_bay_work_end_time',
    'wash_bay_reserved_until',
    'care_staff_start_time',
    'care_staff_end_time',
    'care_staff_work_end_time',
    'care_staff_reserved_until',
];

const shiftDateByMilliseconds = (value, milliseconds) => {
    if (!value) {
        return null;
    }

    return new Date(new Date(value).getTime() + milliseconds);
};

const buildShiftedBookingTimeline = ({ booking, startTime }) => {
    const previousStartTime = new Date(booking.start_time);
    const shiftMilliseconds = startTime.getTime() - previousStartTime.getTime();
    const bookingItems = (booking.booking_items || []).map((item) => {
        const plainItem = item.toObject ? item.toObject() : { ...item };
        const shiftedItem = {
            ...plainItem,
            assigned_care_staff: [],
            status: BOOKING_ITEM_STATUS.PENDING,
            actual_started_at: null,
            countdown_ends_at: null,
            actual_completed_at: null,
            remaining_seconds_at_pause: null,
            countdown_resume_seconds: null,
            paused_at: null,
            paused_by_staff_id: null,
            pause_reason: null,
            total_paused_seconds: 0,
            completion_source: null,
            completed_by_staff_id: null,
            completion_note: null,
            timer_claimed_at: null,
            timer_claim_token: null,
        };

        for (const field of BOOKING_ITEM_TIMELINE_FIELDS) {
            shiftedItem[field] = shiftDateByMilliseconds(plainItem[field], shiftMilliseconds);
        }

        return shiftedItem;
    });
    const resourceSummary = getBookingResourceSummary(bookingItems);

    return {
        start_time: startTime,
        end_time: shiftDateByMilliseconds(booking.end_time, shiftMilliseconds),
        booking_items: bookingItems,
        ...resourceSummary,
    };
};

const getArrivalClassification = ({ arrivedAt, scheduledStartTime, lateGraceMinutes }) => {
    const lateThreshold = addMinutes(scheduledStartTime, lateGraceMinutes);
    const lateMilliseconds = arrivedAt.getTime() - scheduledStartTime.getTime();
    const graceExceededMilliseconds = arrivedAt.getTime() - lateThreshold.getTime();

    if (arrivedAt < scheduledStartTime) {
        return {
            arrivalStatus: BOOKING_ARRIVAL_STATUS.EARLY,
            lateMinutes: 0,
            graceExceededMinutes: 0,
            lateThreshold,
        };
    }

    if (arrivedAt <= lateThreshold) {
        return {
            arrivalStatus: BOOKING_ARRIVAL_STATUS.ON_TIME,
            lateMinutes: 0,
            graceExceededMinutes: 0,
            lateThreshold,
        };
    }

    return {
        arrivalStatus: BOOKING_ARRIVAL_STATUS.LATE,
        lateMinutes: Math.max(Math.floor(lateMilliseconds / 60000), 0),
        graceExceededMinutes: Math.max(Math.floor(graceExceededMilliseconds / 60000), 0),
        lateThreshold,
    };
};

const getLateArrivalSearchStartTime = ({ booking, garage, now }) => {
    const arrivedAt = new Date(booking.arrived_at);
    const searchFrom = arrivedAt > now ? arrivedAt : now;
    const openingDate = createDateFromLocalTime(getLocalDateString(searchFrom), garage.opening_time);

    if (searchFrom <= openingDate) {
        return openingDate;
    }

    return ceilToGarageSlot(searchFrom, garage);
};

const buildLateArrivalCandidateDays = ({ booking, garage, searchStartTime, days }) => {
    const startDate = getLocalDateString(searchStartTime);

    return Array.from({ length: days }, (_, dayIndex) => {
        const date = addDaysToDateString(startDate, dayIndex);
        const openingDate = createDateFromLocalTime(date, garage.opening_time);
        const closingDate = createDateFromLocalTime(date, garage.closing_time);
        const candidates = [];
        let currentStartTime = dayIndex === 0 && searchStartTime > openingDate
            ? new Date(searchStartTime)
            : openingDate;

        while (currentStartTime < closingDate) {
            const timeline = buildShiftedBookingTimeline({
                booking,
                startTime: currentStartTime,
            });
            const latestPlannedEnd = getLatestPlannedEnd(timeline);

            if (latestPlannedEnd <= closingDate) {
                candidates.push({
                    date,
                    timeline,
                    latestPlannedEnd,
                });
            }

            currentStartTime = addMinutes(currentStartTime, garage.slot_interval_minutes);
        }

        return {
            date,
            opening_time: garage.opening_time,
            closing_time: garage.closing_time,
            candidates,
        };
    });
};

const evaluateLateArrivalCandidates = async ({
    booking,
    garage,
    candidateDays,
}) => {
    const allCandidates = candidateDays.flatMap((day) => day.candidates);

    if (allCandidates.length === 0) {
        return candidateDays.map((day) => ({
            date: day.date,
            opening_time: day.opening_time,
            closing_time: day.closing_time,
            has_available_slots: false,
            reason: 'NO_CONTINUOUS_SLOT_AVAILABLE',
            suggested_slots: [],
        }));
    }

    const rangeStart = new Date(Math.min(
        ...allCandidates.map((candidate) => candidate.timeline.start_time.getTime())
    ));
    const rangeEnd = new Date(Math.max(
        ...allCandidates.map((candidate) => candidate.latestPlannedEnd.getTime())
    ));
    const requiresWashBay = (booking.booking_items || []).some((item) => item.requires_wash_bay);
    const careStaffTypes = [...new Set(
        (booking.booking_items || [])
            .filter((item) => item.requires_care_staff)
            .map((item) => item.care_staff_type || STAFF_TYPES.VEHICLE_CARE_STAFF)
    )];
    const activeCareStaffByType = {};
    const careStaffReservationsByType = {};
    const [
        activeWashBayCount,
        washBayReservations,
        vehicleReservations,
        careStaffEntries,
    ] = await Promise.all([
        requiresWashBay
            ? getBookableWashBayCount(garage._id, booking.vehicle_type)
            : Promise.resolve(null),
        requiresWashBay
            ? getWashBayReservations(
                garage._id,
                booking.vehicle_type,
                rangeStart,
                rangeEnd,
                booking._id
            )
            : Promise.resolve([]),
        getVehicleBookingReservations(
            booking.vehicle_id,
            rangeStart,
            rangeEnd,
            booking._id,
            booking.normalized_license_plate,
            booking.vehicle_type
        ),
        Promise.all(careStaffTypes.map(async (careStaffType) => {
            const [activeCount, reservations] = await Promise.all([
                countActiveCareStaff(garage._id, careStaffType),
                getCareStaffReservations(
                    garage._id,
                    careStaffType,
                    rangeStart,
                    rangeEnd,
                    booking._id
                ),
            ]);

            return {
                careStaffType,
                activeCount,
                reservations,
            };
        })),
    ]);

    for (const entry of careStaffEntries) {
        activeCareStaffByType[entry.careStaffType] = entry.activeCount;
        careStaffReservationsByType[entry.careStaffType] = entry.reservations;
    }

    return candidateDays.map((day) => {
        const suggestedSlots = [];

        for (const candidate of day.candidates) {
            const timeline = candidate.timeline;
            let isAvailable = !hasVehicleBookingOverlap(
                vehicleReservations,
                timeline.start_time,
                timeline.end_time
            );
            let availableWashBayCapacity = null;
            let availableCareStaffCapacity = null;

            for (const item of timeline.booking_items) {
                if (item.requires_wash_bay) {
                    const busyCount = getPeakConcurrentResourceUsage(
                        washBayReservations,
                        item.wash_bay_start_time,
                        item.wash_bay_reserved_until
                    );
                    const itemCapacity = Math.max(activeWashBayCount - busyCount, 0);

                    availableWashBayCapacity = availableWashBayCapacity === null
                        ? itemCapacity
                        : Math.min(availableWashBayCapacity, itemCapacity);
                    isAvailable = isAvailable && itemCapacity > 0;
                }

                if (item.requires_care_staff) {
                    const activeCount = activeCareStaffByType[item.care_staff_type] || 0;
                    const busyCount = getPeakConcurrentResourceUsage(
                        careStaffReservationsByType[item.care_staff_type] || [],
                        item.care_staff_start_time,
                        item.care_staff_reserved_until
                    );
                    const itemCapacity = Math.max(activeCount - busyCount, 0);

                    availableCareStaffCapacity = availableCareStaffCapacity === null
                        ? itemCapacity
                        : Math.min(availableCareStaffCapacity, itemCapacity);
                    isAvailable = isAvailable
                        && itemCapacity >= item.care_staff_required_count;
                }
            }

            if (!isAvailable) {
                continue;
            }

            suggestedSlots.push({
                start_time: timeline.start_time,
                end_time: timeline.end_time,
                wash_bay_reserved_until: timeline.wash_bay_reserved_until,
                care_staff_reserved_until: timeline.care_staff_reserved_until,
                is_available: true,
                unavailable_reasons: [],
                available_wash_bay_capacity: availableWashBayCapacity,
                available_care_staff_capacity: availableCareStaffCapacity,
                booking_items: timeline.booking_items,
            });
        }

        return {
            date: day.date,
            opening_time: day.opening_time,
            closing_time: day.closing_time,
            has_available_slots: suggestedSlots.length > 0,
            reason: suggestedSlots.length > 0 ? null : 'NO_CONTINUOUS_SLOT_AVAILABLE',
            suggested_slots: suggestedSlots,
        };
    });
};

const buildBookingBasePayload = ({
    garage,
    servicePackage,
    bookingPlan,
    startTime,
    vehicleType,
    note,
    promotionResult = null,
    voucherResult = null,
    redeemResult = null,
}) => {
    const endTime = addMinutes(startTime, bookingPlan.totalDurationMinutes);
    const originalPrice = bookingPlan.originalPrice;
    const promotionDiscountAmount = promotionResult?.discount_amount || 0;
    const voucherDiscountAmount = voucherResult?.discount_amount || 0;
    const pointsDiscountAmount = redeemResult?.points_discount_amount || 0;
    const discountAmount = promotionDiscountAmount + voucherDiscountAmount + pointsDiscountAmount;
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
        wash_bay_work_end_time: bookingPlan.wash_bay_work_end_time,
        wash_bay_reserved_until: bookingPlan.wash_bay_reserved_until,
        requires_care_staff: bookingPlan.requires_care_staff,
        care_staff_type: bookingPlan.care_staff_type,
        care_staff_required_count: bookingPlan.care_staff_required_count,
        care_staff_start_time: bookingPlan.care_staff_start_time,
        care_staff_end_time: bookingPlan.care_staff_end_time,
        care_staff_work_end_time: bookingPlan.care_staff_work_end_time,
        care_staff_reserved_until: bookingPlan.care_staff_reserved_until,
        assigned_care_staff_ids: [],
        original_price: originalPrice,
        promotion_discount_amount: promotionDiscountAmount,
        voucher_discount_amount: voucherDiscountAmount,
        points_discount_amount: pointsDiscountAmount,
        discount_amount: discountAmount,
        final_price: finalPrice,
        payment_method: BOOKING_PAYMENT_METHOD.CASH,
        payment_status: BOOKING_PAYMENT_STATUS.UNPAID,
        used_points: redeemResult?.used_points || 0,
        earned_points: 0,
        promotion_id: promotionResult?.promotion?._id || null,
        customer_voucher_id: voucherResult?.voucher?._id || null,
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

const getPeakConcurrentResourceUsage = (reservations, rangeStart, rangeEnd) => {
    const normalizedReservations = reservations
        .map((reservation) => ({
            bookingId: toObjectIdString(reservation.booking_id || reservation._id),
            startTime: new Date(reservation.start_time),
            endTime: new Date(reservation.reserved_until || reservation.end_time),
            requiredCount: Math.max(Number(reservation.required_count) || 1, 1),
        }))
        .filter((reservation) => {
            return reservation.bookingId
                && !Number.isNaN(reservation.startTime.getTime())
                && !Number.isNaN(reservation.endTime.getTime())
                && reservation.startTime < rangeEnd
                && reservation.endTime > rangeStart;
        });
    const boundaries = [...new Set([
        rangeStart.getTime(),
        rangeEnd.getTime(),
        ...normalizedReservations.flatMap((reservation) => [
            Math.max(reservation.startTime.getTime(), rangeStart.getTime()),
            Math.min(reservation.endTime.getTime(), rangeEnd.getTime()),
        ]),
    ])].sort((firstTime, secondTime) => firstTime - secondTime);
    let peakUsage = 0;

    for (let index = 0; index < boundaries.length - 1; index += 1) {
        const segmentStart = boundaries[index];
        const segmentEnd = boundaries[index + 1];

        if (segmentStart >= segmentEnd) {
            continue;
        }

        const usageByBooking = new Map();

        for (const reservation of normalizedReservations) {
            if (reservation.startTime.getTime() >= segmentEnd || reservation.endTime.getTime() <= segmentStart) {
                continue;
            }

            usageByBooking.set(
                reservation.bookingId,
                Math.max(usageByBooking.get(reservation.bookingId) || 0, reservation.requiredCount)
            );
        }

        const segmentUsage = [...usageByBooking.values()].reduce((total, count) => total + count, 0);

        peakUsage = Math.max(peakUsage, segmentUsage);
    }

    return peakUsage;
};

const getWashBayReservations = async (
    garageId,
    vehicleType,
    rangeStart,
    rangeEnd,
    excludedBookingId = null
) => {
    const filter = {
        garage_id: garageId,
        vehicle_type: vehicleType,
        status: { $in: BOOKING_RESOURCE_HOLD_STATUSES },
        booking_items: {
            $elemMatch: {
                requires_wash_bay: true,
                status: { $in: BOOKING_ITEM_HOLD_STATUSES },
                wash_bay_start_time: { $lt: rangeEnd },
                $or: [
                    { wash_bay_reserved_until: { $gt: rangeStart } },
                    {
                        wash_bay_reserved_until: null,
                        wash_bay_end_time: { $gt: rangeStart },
                    },
                ],
            },
        },
    };

    if (excludedBookingId) {
        filter._id = { $ne: excludedBookingId };
    }

    const reservations = await Booking.aggregate([
        { $match: filter },
        { $unwind: '$booking_items' },
        {
            $match: {
                'booking_items.requires_wash_bay': true,
                'booking_items.status': { $in: BOOKING_ITEM_HOLD_STATUSES },
                'booking_items.wash_bay_start_time': { $lt: rangeEnd },
                $or: [
                    { 'booking_items.wash_bay_reserved_until': { $gt: rangeStart } },
                    {
                        'booking_items.wash_bay_reserved_until': null,
                        'booking_items.wash_bay_end_time': { $gt: rangeStart },
                    },
                ],
            },
        },
        {
            $project: {
                _id: 0,
                booking_id: '$_id',
                start_time: '$booking_items.wash_bay_start_time',
                reserved_until: {
                    $ifNull: [
                        '$booking_items.wash_bay_reserved_until',
                        '$booking_items.wash_bay_end_time',
                    ],
                },
                required_count: { $literal: 1 },
            },
        },
    ]);

    return reservations;
};

const countOverlappedWashBayBookings = async (garageId, vehicleType, washBayStartTime, washBayReservedUntil, excludedBookingId = null) => {
    const reservations = await getWashBayReservations(
        garageId,
        vehicleType,
        washBayStartTime,
        washBayReservedUntil,
        excludedBookingId
    );

    return getPeakConcurrentResourceUsage(
        reservations,
        washBayStartTime,
        washBayReservedUntil
    );
};

const countActiveCareStaff = async (garageId, careStaffType = STAFF_TYPES.VEHICLE_CARE_STAFF) => {
    return StaffProfile.countDocuments({
        garage_id: garageId,
        staff_type: careStaffType,
        is_active: true,
    });
};

const getCareStaffReservations = async (
    garageId,
    careStaffType,
    rangeStart,
    rangeEnd,
    excludedBookingId = null
) => {
    const filter = {
        garage_id: garageId,
        status: { $in: BOOKING_RESOURCE_HOLD_STATUSES },
        booking_items: {
            $elemMatch: {
                requires_care_staff: true,
                status: { $in: BOOKING_ITEM_HOLD_STATUSES },
                care_staff_type: careStaffType,
                care_staff_start_time: { $lt: rangeEnd },
                $or: [
                    { care_staff_reserved_until: { $gt: rangeStart } },
                    {
                        care_staff_reserved_until: null,
                        care_staff_end_time: { $gt: rangeStart },
                    },
                ],
            },
        },
    };

    if (excludedBookingId) {
        filter._id = { $ne: excludedBookingId };
    }

    const reservations = await Booking.aggregate([
        { $match: filter },
        { $unwind: '$booking_items' },
        {
            $match: {
                'booking_items.requires_care_staff': true,
                'booking_items.status': { $in: BOOKING_ITEM_HOLD_STATUSES },
                'booking_items.care_staff_type': careStaffType,
                'booking_items.care_staff_start_time': { $lt: rangeEnd },
                $or: [
                    { 'booking_items.care_staff_reserved_until': { $gt: rangeStart } },
                    {
                        'booking_items.care_staff_reserved_until': null,
                        'booking_items.care_staff_end_time': { $gt: rangeStart },
                    },
                ],
            },
        },
        {
            $project: {
                _id: 0,
                booking_id: '$_id',
                start_time: '$booking_items.care_staff_start_time',
                reserved_until: {
                    $ifNull: [
                        '$booking_items.care_staff_reserved_until',
                        '$booking_items.care_staff_end_time',
                    ],
                },
                required_count: '$booking_items.care_staff_required_count',
            },
        },
    ]);

    return reservations;
};

const countOverlappedCareStaffBookings = async (garageId, careStaffType, careStaffStartTime, careStaffReservedUntil, excludedBookingId = null) => {
    const reservations = await getCareStaffReservations(
        garageId,
        careStaffType,
        careStaffStartTime,
        careStaffReservedUntil,
        excludedBookingId
    );

    return getPeakConcurrentResourceUsage(
        reservations,
        careStaffStartTime,
        careStaffReservedUntil
    );
};

const hasTimeOverlap = (startTime, endTime, comparedStartTime, comparedEndTime) => {
    return startTime < comparedEndTime && endTime > comparedStartTime;
};

const getVehicleBookingReservations = async (
    vehicleId,
    rangeStart,
    rangeEnd,
    excludedBookingId = null,
    normalizedLicensePlate = null,
    vehicleType = null
) => {
    if (!vehicleId && !normalizedLicensePlate) {
        return [];
    }

    const filter = {
        status: { $in: BOOKING_HOLD_SLOT_STATUSES },
        start_time: { $lt: rangeEnd },
        end_time: { $gt: rangeStart },
    };

    if (vehicleId) {
        filter.vehicle_id = vehicleId;
    } else {
        filter.normalized_license_plate = normalizedLicensePlate;
        filter.vehicle_type = vehicleType;
    }

    if (excludedBookingId) {
        filter._id = { $ne: excludedBookingId };
    }

    return Booking.aggregate([
        {
            $match: filter,
        },
        {
            $project: {
                _id: 0,
                booking_id: '$_id',
                start_time: '$start_time',
                end_time: '$end_time',
            },
        },
    ]);
};

const hasVehicleBookingOverlap = (reservations, startTime, endTime) => {
    return reservations.some((reservation) => {
        const reservationStartTime = new Date(reservation.start_time);
        const reservationEndTime = new Date(reservation.end_time);

        return !Number.isNaN(reservationStartTime.getTime())
            && !Number.isNaN(reservationEndTime.getTime())
            && hasTimeOverlap(startTime, endTime, reservationStartTime, reservationEndTime);
    });
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

const getActiveAssignedCareStaffProfileIds = async (garageId, careStaffType, excludedBookingId = null) => {
    const filter = {
        garage_id: garageId,
        status: { $in: BOOKING_RESOURCE_HOLD_STATUSES },
        booking_items: {
            $elemMatch: {
                requires_care_staff: true,
                status: { $in: BOOKING_ITEM_HOLD_STATUSES },
                care_staff_type: careStaffType,
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

const assertWashBayCapacityAvailable = async ({
    garageId,
    vehicleType,
    requiresWashBay,
    washBayStartTime,
    washBayReservedUntil,
    excludedBookingId = null,
}) => {
    if (!requiresWashBay) {
        return;
    }

    const bookableWashBayCount = await getBookableWashBayCount(garageId, vehicleType);

    const overlappedBookingCount = await countOverlappedWashBayBookings(
        garageId,
        vehicleType,
        washBayStartTime,
        washBayReservedUntil,
        excludedBookingId
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
    careStaffReservedUntil,
    excludedBookingId = null,
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
        careStaffReservedUntil,
        excludedBookingId
    );

    if (busyCareStaffCount + careStaffRequiredCount > activeCareStaffCount) {
        throw new AppError('Care staff capacity is full for this time', 409, 'CARE_STAFF_CAPACITY_FULL');
    }
};

const assertGarageCapacityAvailable = async ({
    garageId,
    vehicleType,
    bookingItems = [],
    excludedBookingId = null,
}) => {
    for (const item of bookingItems) {
        await assertWashBayCapacityAvailable({
            garageId,
            vehicleType,
            requiresWashBay: item.requires_wash_bay,
            washBayStartTime: item.wash_bay_start_time,
            washBayReservedUntil: item.wash_bay_reserved_until || item.wash_bay_end_time,
            excludedBookingId,
        });
        await assertCareStaffCapacityAvailable({
            garageId,
            requiresCareStaff: item.requires_care_staff,
            careStaffType: item.care_staff_type,
            careStaffRequiredCount: item.care_staff_required_count,
            careStaffStartTime: item.care_staff_start_time,
            careStaffReservedUntil: item.care_staff_reserved_until || item.care_staff_end_time,
            excludedBookingId,
        });
    }
};

const assertVehicleNoOverlap = async ({
    vehicleId,
    normalizedLicensePlate,
    vehicleType,
    startTime,
    endTime,
    excludedBookingId = null,
}) => {
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

    if (excludedBookingId) {
        filter._id = { $ne: excludedBookingId };
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

const getStaffAssignmentFilter = (staffProfile) => ({
    $or: [
        { assigned_inspection_staff_id: staffProfile.user_id },
        {
            booking_items: {
                $elemMatch: {
                    'assigned_care_staff.staff_profile_id': staffProfile._id,
                    'assigned_care_staff.released_at': null,
                },
            },
        },
        {
            booking_items: {
                $elemMatch: {
                    'assigned_execution_staff.staff_profile_id': staffProfile._id,
                    'assigned_execution_staff.released_at': null,
                },
            },
        },
    ],
});

const assignmentMatchesStaff = (assignment, staffProfile, user) => (
    !assignment?.released_at
    && (
        toObjectIdString(assignment.staff_profile_id) === toObjectIdString(staffProfile._id)
        || toObjectIdString(assignment.user_id) === toObjectIdString(user._id)
    )
);

const isStaffAssignedToBooking = (staffProfile, user, booking) => {
    if (
        toObjectIdString(booking.assigned_inspection_staff_id)
        === toObjectIdString(user._id)
    ) {
        return true;
    }

    return (booking.booking_items || []).some((item) => (
        [...(item.assigned_care_staff || []), ...(item.assigned_execution_staff || [])]
            .some((assignment) => assignmentMatchesStaff(assignment, staffProfile, user))
    ));
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

const getRawBookingDocumentById = async (bookingId, session = null) => {
    const query = Booking.findById(bookingId);
    const booking = session && typeof query.session === 'function'
        ? await query.session(session)
        : await query;

    if (!booking) {
        throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    return booking;
};

const assertStaffCanAccessBooking = async (user, booking) => {
    const staffProfile = await assertStaffCanAccessGarage(user, booking.garage_id);

    if (!staffProfile || staffTypeHasCapability(
        staffProfile.staff_type,
        STAFF_CAPABILITIES.BOOKING_READ_GARAGE
    )) {
        return staffProfile;
    }

    if (!isStaffAssignedToBooking(staffProfile, user, booking)) {
        throw new AppError(
            'Staff can only access assigned bookings',
            403,
            'STAFF_BOOKING_ASSIGNMENT_REQUIRED'
        );
    }

    return staffProfile;
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

const assignWashBayToBooking = async (booking, requestedWashBayId = null, session = null) => {
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
            ...(session ? { session } : {}),
        }
    );

    if (!washBay) {
        throw new AppError('No available wash bay found for this booking', 409, 'NO_AVAILABLE_WASH_BAY');
    }

    booking.wash_bay_id = washBay._id;

    await booking.save(session ? { session } : undefined);

    return washBay;
};

const assignWashBayToBookingIfNeeded = async (booking, session = null) => {
    if (!booking.requires_wash_bay || booking.wash_bay_id) {
        return null;
    }

    return assignWashBayToBooking(booking, null, session);
};

const releaseWashBayForBooking = async (booking, session = null) => {
    if (!booking.wash_bay_id) {
        return;
    }

    const filter = {
        _id: booking.wash_bay_id,
        current_booking_id: booking._id,
    };
    const update = {
        status: WASH_BAY_STATUS.AVAILABLE,
        current_booking_id: null,
    };

    if (session) {
        await WashBay.findOneAndUpdate(filter, update, { session });
        return;
    }

    await WashBay.findOneAndUpdate(filter, update);

};

const reclaimReleasedWashBayForBooking = async (booking) => {
    if (!booking.requires_wash_bay) {
        return null;
    }

    if (!booking.wash_bay_id) {
        throw new AppError(
            'Booking wash bay is missing and cannot be reopened',
            409,
            'BOOKING_REOPEN_WASH_BAY_MISSING'
        );
    }

    const washBay = await WashBay.findOneAndUpdate(
        {
            _id: booking.wash_bay_id,
            status: WASH_BAY_STATUS.AVAILABLE,
            current_booking_id: null,
            is_active: true,
        },
        {
            status: WASH_BAY_STATUS.OCCUPIED,
            current_booking_id: booking._id,
        },
        {
            new: true,
        }
    );

    if (!washBay) {
        throw new AppError(
            'Assigned wash bay is not available for reopening',
            409,
            'BOOKING_REOPEN_WASH_BAY_UNAVAILABLE'
        );
    }

    return washBay;
};

const normalizeBookingItemKey = (value) => normalizeText(value)?.toUpperCase() || null;

const isSameDateTime = (left, right) => {
    if (!left || !right) {
        return false;
    }

    return new Date(left).getTime() === new Date(right).getTime();
};

const getCareStaffAssignmentStaffProfileId = (assignment) => {
    return assignment?.staff_profile_id?._id || assignment?.staff_profile_id || null;
};

const getStaffProfileUserId = (staffProfile) => {
    return staffProfile?.user_id?._id || staffProfile?.user_id || null;
};

const getActiveCareStaffAssignments = (bookingItem) => {
    return (bookingItem.assigned_care_staff || []).filter((assignment) => !assignment.released_at);
};

const getCareStaffWorkEndTime = (bookingItem) => {
    return bookingItem.care_staff_work_end_time || bookingItem.care_staff_end_time;
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
            careStaffEndTime: getCareStaffWorkEndTime(bookingItem),
        });
    }
};

const syncAssignedCareStaffIds = (booking) => {
    const staffProfileIds = [];
    const seenStaffProfileIds = new Set();

    for (const item of booking.booking_items || []) {
        for (const assignment of item.assigned_care_staff || []) {
            if (assignment.released_at) {
                continue;
            }

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

    for (const assignments of [
        bookingItem.assigned_care_staff || [],
        bookingItem.assigned_execution_staff || [],
    ]) {
        for (const assignment of assignments) {
            if (!assignment.released_at) {
                assignment.released_at = releasedAt;
                released = true;
            }
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
        syncAssignedCareStaffIds(booking);
        booking.markModified('booking_items');
    }

    return releasedBookingItemKeys;
};

const restoreCareStaffAssignmentsReleasedAt = async (booking, releasedAt) => {
    const restoredBookingItemKeys = [];
    const busyCareStaffByType = new Map();

    for (const bookingItem of booking.booking_items || []) {
        let restored = false;
        const careStaffType = bookingItem.care_staff_type || STAFF_TYPES.VEHICLE_CARE_STAFF;

        for (const assignment of bookingItem.assigned_care_staff || []) {
            if (!isSameDateTime(assignment.released_at, releasedAt)) {
                continue;
            }

            const staffProfileId = toObjectIdString(getCareStaffAssignmentStaffProfileId(assignment));

            if (staffProfileId) {
                if (!busyCareStaffByType.has(careStaffType)) {
                    busyCareStaffByType.set(
                        careStaffType,
                        await getActiveAssignedCareStaffProfileIds(booking.garage_id, careStaffType, booking._id)
                    );
                }

                if (busyCareStaffByType.get(careStaffType).has(staffProfileId)) {
                    throw new AppError(
                        'Assigned care staff is not available for reopening',
                        409,
                        'BOOKING_REOPEN_CARE_STAFF_UNAVAILABLE'
                    );
                }
            }

            assignment.released_at = null;
            restored = true;
        }

        for (const assignment of bookingItem.assigned_execution_staff || []) {
            if (isSameDateTime(assignment.released_at, releasedAt)) {
                assignment.released_at = null;
                restored = true;
            }
        }

        if (restored) {
            const bookingItemKey = normalizeBookingItemKey(bookingItem.item_key);

            if (bookingItemKey) {
                restoredBookingItemKeys.push(bookingItemKey);
            }
        }
    }

    if (restoredBookingItemKeys.length > 0) {
        if (typeof booking.markModified === 'function') {
            booking.markModified('booking_items');
        }

        syncAssignedCareStaffIds(booking);
    }

    return restoredBookingItemKeys;
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
            bookingItem.care_staff_reserved_until || bookingItem.care_staff_end_time,
            booking._id
        );

        if (busyCareStaffCount + requiredCount > activeProfiles.length) {
            throw new AppError('Care staff capacity is full for this time', 409, 'CARE_STAFF_CAPACITY_FULL');
        }

        const busyAssignedCareStaffProfileIds = await getActiveAssignedCareStaffProfileIds(
            booking.garage_id,
            careStaffType,
            booking._id
        );
        const plannedBusyCareStaffProfileIds = getPlannedBusyCareStaffProfileIds(
            plannedAssignments,
            careStaffType,
            bookingItem.care_staff_start_time,
            getCareStaffWorkEndTime(bookingItem)
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

const getEffectiveCountdownDurationSeconds = (bookingItem) => {
    const countdownDurationSeconds = Number(
        bookingItem.countdown_resume_seconds
        || bookingItem.countdown_duration_seconds
        || bookingItem.duration_minutes * 60
    );

    if (!Number.isInteger(countdownDurationSeconds) || countdownDurationSeconds < 1) {
        throw new AppError(
            'Booking service item countdown configuration is invalid',
            409,
            'BOOKING_SERVICE_ITEM_COUNTDOWN_INVALID'
        );
    }

    return countdownDurationSeconds;
};

const getBookingItemByKey = (booking, bookingItemKey) => {
    const normalizedBookingItemKey = normalizeBookingItemKey(bookingItemKey);

    return (booking.booking_items || []).find((item) => {
        return normalizeBookingItemKey(item.item_key) === normalizedBookingItemKey;
    }) || null;
};

const getCurrentBookingItem = (booking) => {
    const currentStatuses = [
        BOOKING_ITEM_STATUS.IN_PROGRESS,
        BOOKING_ITEM_STATUS.PAUSED,
        BOOKING_ITEM_STATUS.AWAITING_CONFIRMATION,
        BOOKING_ITEM_STATUS.WAITING_RESOURCE,
    ];

    return [...(booking.booking_items || [])]
        .sort((firstItem, secondItem) => firstItem.sequence - secondItem.sequence)
        .find((item) => currentStatuses.includes(item.status)) || null;
};

const getNextPendingBookingItem = (booking, completedItem) => {
    return [...(booking.booking_items || [])]
        .sort((firstItem, secondItem) => firstItem.sequence - secondItem.sequence)
        .find((item) => (
            item.sequence > completedItem.sequence
            && item.status === BOOKING_ITEM_STATUS.PENDING
        )) || null;
};

const startBookingItemCountdown = (bookingItem, startedAt = new Date()) => {
    const countdownDurationSeconds = getEffectiveCountdownDurationSeconds(bookingItem);

    bookingItem.status = BOOKING_ITEM_STATUS.IN_PROGRESS;
    bookingItem.actual_started_at = startedAt;
    bookingItem.countdown_ends_at = addSeconds(startedAt, countdownDurationSeconds);
    bookingItem.actual_completed_at = null;
    bookingItem.remaining_seconds_at_pause = null;
    bookingItem.countdown_resume_seconds = null;
    bookingItem.paused_at = null;
    bookingItem.paused_by_staff_id = null;
    bookingItem.pause_reason = null;
    bookingItem.total_paused_seconds = 0;
    bookingItem.completion_source = null;
    bookingItem.completed_by_staff_id = null;
    bookingItem.completion_note = null;
    bookingItem.timer_claimed_at = null;
    bookingItem.timer_claim_token = null;

    return bookingItem;
};

const recordServiceItemAudit = async ({
    booking,
    bookingItem,
    actorId = null,
    action,
    before = null,
    metadata = {},
    auditContext = {},
}) => {
    try {
        await auditLogService.recordAuditEvent({
            actorId,
            action,
            resourceType: AUDIT_RESOURCE_TYPES.BOOKING,
            resourceId: booking._id,
            before,
            after: {
                item_key: bookingItem.item_key,
                status: bookingItem.status,
                actual_started_at: bookingItem.actual_started_at,
                countdown_ends_at: bookingItem.countdown_ends_at,
                actual_completed_at: bookingItem.actual_completed_at,
                completion_source: bookingItem.completion_source,
            },
            metadata: {
                booking_item_key: bookingItem.item_key,
                service_package_id: bookingItem.service_package_id,
                ...metadata,
            },
            ip: auditContext.ip,
            userAgent: auditContext.userAgent,
        });
    } catch (error) {
        console.warn('[bookings] service item audit failed', {
            booking_id: booking._id?.toString?.() || booking._id,
            booking_item_key: bookingItem.item_key,
            action,
            error: error.message,
        });
    }
};

const getCompletionAuditAction = (completionSource) => {
    if (completionSource === BOOKING_ITEM_COMPLETION_SOURCE.TIMER) {
        return AUDIT_ACTIONS.BOOKING_SERVICE_ITEM_AUTO_COMPLETED;
    }

    if (completionSource === BOOKING_ITEM_COMPLETION_SOURCE.STAFF_EARLY) {
        return AUDIT_ACTIONS.BOOKING_SERVICE_ITEM_COMPLETED_EARLY;
    }

    return AUDIT_ACTIONS.BOOKING_SERVICE_ITEM_CONFIRMED;
};

const completeBookingItemAndAdvance = async ({
    booking,
    bookingItem,
    completionSource,
    completedAt = new Date(),
    staffId = null,
    note,
    auditContext = {},
}) => {
    const before = {
        status: bookingItem.status,
        countdown_ends_at: bookingItem.countdown_ends_at,
        remaining_seconds_at_pause: bookingItem.remaining_seconds_at_pause,
    };

    await bookingServiceStepService.completeStepsForBookingItem({
        bookingId: booking._id,
        bookingItemKey: normalizeBookingItemKey(bookingItem.item_key),
        completedAt,
        staffId,
        note,
    });

    if (bookingItem.status === BOOKING_ITEM_STATUS.PAUSED && bookingItem.paused_at) {
        bookingItem.total_paused_seconds = (bookingItem.total_paused_seconds || 0)
            + Math.max(
                0,
                Math.ceil((completedAt.getTime() - new Date(bookingItem.paused_at).getTime()) / 1000)
            );
    }

    bookingItem.status = BOOKING_ITEM_STATUS.DONE;
    bookingItem.actual_completed_at = completedAt;
    bookingItem.countdown_ends_at = null;
    bookingItem.remaining_seconds_at_pause = null;
    bookingItem.paused_at = null;
    bookingItem.paused_by_staff_id = null;
    bookingItem.pause_reason = null;
    bookingItem.completion_source = completionSource;
    bookingItem.completed_by_staff_id = staffId;
    bookingItem.completion_note = normalizeText(note);
    bookingItem.timer_claimed_at = null;
    bookingItem.timer_claim_token = null;

    releaseCareStaffAssignmentsForBookingItem(bookingItem, completedAt);

    const nextBookingItem = getNextPendingBookingItem(booking, bookingItem);

    if (nextBookingItem) {
        startBookingItemCountdown(nextBookingItem, completedAt);
    }

    if (typeof booking.markModified === 'function') {
        booking.markModified('booking_items');
    }

    await booking.save();
    await bookingServiceStepService.markResourceReleasedForBookingItem(
        booking._id,
        normalizeBookingItemKey(bookingItem.item_key),
        completedAt
    );

    const hasPendingWashBayItem = (booking.booking_items || []).some((item) => {
        return item.requires_wash_bay && BOOKING_ITEM_ACTIVE_STATUSES.includes(item.status);
    });

    if (bookingItem.requires_wash_bay && !hasPendingWashBayItem) {
        await releaseWashBayForBooking(booking);
    }

    await recordServiceItemAudit({
        booking,
        bookingItem,
        actorId: staffId,
        action: getCompletionAuditAction(completionSource),
        before,
        metadata: {
            next_booking_item_key: nextBookingItem?.item_key || null,
            note: normalizeText(note),
        },
        auditContext,
    });

    if (nextBookingItem) {
        await recordServiceItemAudit({
            booking,
            bookingItem: nextBookingItem,
            actorId: staffId,
            action: AUDIT_ACTIONS.BOOKING_SERVICE_ITEM_STARTED,
            metadata: {
                previous_booking_item_key: bookingItem.item_key,
                started_automatically: true,
            },
            auditContext,
        });
    }

    return nextBookingItem;
};

const markBookingItemDoneIfReady = async (booking, bookingItemKey, { staffId = null, note } = {}) => {
    const normalizedBookingItemKey = normalizeBookingItemKey(bookingItemKey);

    if (!normalizedBookingItemKey) {
        return false;
    }

    const bookingItem = getBookingItemByKey(booking, normalizedBookingItemKey);

    if (!bookingItem || bookingItem.status === BOOKING_ITEM_STATUS.DONE) {
        return false;
    }

    const isReady = await bookingServiceStepService.areAllRequiredStepsDoneForBookingItem(
        booking._id,
        normalizedBookingItemKey
    );

    if (!isReady) {
        return false;
    }

    await completeBookingItemAndAdvance({
        booking,
        bookingItem,
        completionSource: BOOKING_ITEM_COMPLETION_SOURCE.STAFF_CONFIRM,
        completedAt: new Date(),
        staffId,
        note,
    });

    return true;
};

const getAvailableSlots = async ({
    garage_id,
    vehicle_id,
    service_package_id,
    add_on_service_ids = [],
    date,
    start_date,
    days,
    customer_id,
} = {}) => {
    const now = new Date();
    const requestedStartDate = start_date || date;
    const requestedDayCount = days || (start_date ? 7 : 1);

    parseDateOnly(requestedStartDate);

    const [garage, servicePackage, bookingRule] = await Promise.all([
        getActiveGarage(garage_id),
        getActiveServicePackage(service_package_id),
        customer_id
            ? getBookingRuleForCustomer(customer_id)
            : getActiveBookingRuleByTier(LOYALTY_TIERS.BRONZE),
    ]);
    let vehicle = null;

    if (vehicle_id) {
        if (!customer_id) {
            throw new AppError(
                'Authentication is required to check vehicle availability',
                401,
                'AUTHENTICATION_REQUIRED'
            );
        }

        vehicle = await getActiveVehicleForCustomer(vehicle_id, customer_id);
        assertServicePackageMatchesVehicleType(servicePackage, vehicle.vehicle_type);
    }

    const vehicleType = vehicle?.vehicle_type || servicePackage.vehicle_type;
    const { serviceItems, addOnServices } = await resolveBookingServiceItems({
        servicePackage,
        addOnServiceIds: add_on_service_ids,
        vehicleType,
    });
    const requestedDates = Array.from(
        { length: requestedDayCount },
        (_, index) => addDaysToDateString(requestedStartDate, index)
    );
    const bookingWindowEnd = getBookingWindowEnd(now, bookingRule);
    const today = getLocalDateString(now);
    const plannedDays = requestedDates.map((requestedDate) => {
        const openingDate = createDateFromLocalTime(requestedDate, garage.opening_time);
        const closingDate = createDateFromLocalTime(requestedDate, garage.closing_time);

        if (
            Number.isNaN(openingDate.getTime())
            || Number.isNaN(closingDate.getTime())
            || openingDate >= closingDate
        ) {
            throw new AppError('Invalid garage business hours', 400, 'INVALID_GARAGE_BUSINESS_HOURS');
        }

        if (requestedDate < today) {
            return {
                date: requestedDate,
                openingDate,
                closingDate,
                candidates: [],
                reason: 'DATE_IN_PAST',
            };
        }

        const firstCandidateStartTime = requestedDate === today
            ? getFirstFutureCandidateStartTime({ openingDate, now, garage })
            : new Date(openingDate);

        if (firstCandidateStartTime > bookingWindowEnd) {
            return {
                date: requestedDate,
                openingDate,
                closingDate,
                candidates: [],
                reason: 'BOOKING_WINDOW_EXCEEDED',
            };
        }

        if (requestedDate === today && firstCandidateStartTime >= closingDate) {
            return {
                date: requestedDate,
                openingDate,
                closingDate,
                candidates: [],
                reason: 'NO_FUTURE_SLOT_TODAY',
            };
        }

        const candidates = [];
        let currentStartTime = firstCandidateStartTime;

        while (currentStartTime < closingDate && currentStartTime <= bookingWindowEnd) {
            const bookingPlan = buildBookingPlan({
                startTime: currentStartTime,
                servicePackage,
                serviceItems,
                addOnServices,
                garage,
            });
            const endTime = addMinutes(currentStartTime, bookingPlan.totalDurationMinutes);
            const latestPlannedEnd = getLatestPlannedEnd({
                end_time: endTime,
                wash_bay_reserved_until: bookingPlan.wash_bay_reserved_until,
                care_staff_reserved_until: bookingPlan.care_staff_reserved_until,
            });

            if (latestPlannedEnd <= closingDate) {
                candidates.push({
                    startTime: currentStartTime,
                    endTime,
                    latestPlannedEnd,
                    bookingPlan,
                });
            }

            currentStartTime = addMinutes(currentStartTime, garage.slot_interval_minutes);
        }

        return {
            date: requestedDate,
            openingDate,
            closingDate,
            candidates,
            reason: candidates.length > 0 ? null : 'NO_CONTINUOUS_SLOT_AVAILABLE',
        };
    });
    const allCandidates = plannedDays.flatMap((item) => item.candidates);
    const reservationRangeStart = allCandidates.length > 0
        ? new Date(Math.min(...allCandidates.map((item) => item.startTime.getTime())))
        : null;
    const reservationRangeEnd = allCandidates.length > 0
        ? new Date(Math.max(...allCandidates.map((item) => item.latestPlannedEnd.getTime())))
        : null;

    const hasWashBayItem = serviceItems.some((item) => item.servicePackage.requires_wash_bay);
    const careStaffTypes = [...new Set(serviceItems
        .filter((item) => item.servicePackage.requires_care_staff)
        .map((item) => item.servicePackage.care_staff_type || STAFF_TYPES.VEHICLE_CARE_STAFF))];
    const shouldCheckCapacity = allCandidates.length > 0;
    const activeWashBayCountPromise = hasWashBayItem && shouldCheckCapacity
        ? getBookableWashBayCount(garage._id, vehicleType)
        : Promise.resolve(null);
    const activeCareStaffByType = {};
    const careStaffReservationsByType = {};
    const activeCareStaffEntriesPromise = shouldCheckCapacity
        ? Promise.all(careStaffTypes.map(async (careStaffType) => {
            const [activeCareStaffCount, reservations] = await Promise.all([
                countActiveCareStaff(garage._id, careStaffType),
                getCareStaffReservations(
                    garage._id,
                    careStaffType,
                    reservationRangeStart,
                    reservationRangeEnd
                ),
            ]);

            return {
                careStaffType,
                activeCareStaffCount,
                reservations,
            };
        }))
        : Promise.resolve([]);
    const [activeWashBayCount, washBayReservations, vehicleReservations, activeCareStaffEntries] = await Promise.all([
        activeWashBayCountPromise,
        hasWashBayItem && shouldCheckCapacity
            ? getWashBayReservations(
                garage._id,
                vehicleType,
                reservationRangeStart,
                reservationRangeEnd
            )
            : Promise.resolve([]),
        shouldCheckCapacity
            ? getVehicleBookingReservations(
                vehicle?._id,
                reservationRangeStart,
                reservationRangeEnd
            )
            : Promise.resolve([]),
        activeCareStaffEntriesPromise,
    ]);

    for (const entry of activeCareStaffEntries) {
        activeCareStaffByType[entry.careStaffType] = entry.activeCareStaffCount;
        careStaffReservationsByType[entry.careStaffType] = entry.reservations;
    }

    const availabilityDays = plannedDays.map((plannedDay) => {
        const slots = plannedDay.candidates.map((candidate) => {
            const unavailableReasons = [];
            let isAvailable = true;
            let availableCapacity = null;
            let availableWashBayCapacity = null;
            let availableCareStaffCapacity = null;
            const { startTime, endTime, bookingPlan } = candidate;

            if (hasVehicleBookingOverlap(vehicleReservations, startTime, endTime)) {
                isAvailable = false;
                unavailableReasons.push('VEHICLE_BOOKING_OVERLAP');
            }

            for (const item of bookingPlan.bookingItems) {
                if (item.requires_wash_bay) {
                    const overlappedBookingCount = getPeakConcurrentResourceUsage(
                        washBayReservations,
                        item.wash_bay_start_time,
                        item.wash_bay_reserved_until
                    );
                    const itemAvailableWashBayCapacity = Math.max(
                        activeWashBayCount - overlappedBookingCount,
                        0
                    );

                    availableWashBayCapacity = availableWashBayCapacity === null
                        ? itemAvailableWashBayCapacity
                        : Math.min(availableWashBayCapacity, itemAvailableWashBayCapacity);

                    if (activeWashBayCount <= 0 || itemAvailableWashBayCapacity <= 0) {
                        isAvailable = false;
                        unavailableReasons.push('WASH_BAY_CAPACITY_FULL');
                    }
                }

                if (item.requires_care_staff) {
                    const activeCareStaffCount = activeCareStaffByType[item.care_staff_type] || 0;
                    const busyCareStaffCount = getPeakConcurrentResourceUsage(
                        careStaffReservationsByType[item.care_staff_type] || [],
                        item.care_staff_start_time,
                        item.care_staff_reserved_until
                    );
                    const itemAvailableCareStaffCapacity = Math.max(
                        activeCareStaffCount - busyCareStaffCount,
                        0
                    );

                    availableCareStaffCapacity = availableCareStaffCapacity === null
                        ? itemAvailableCareStaffCapacity
                        : Math.min(availableCareStaffCapacity, itemAvailableCareStaffCapacity);

                    if (
                        activeCareStaffCount <= 0
                        || itemAvailableCareStaffCapacity < item.care_staff_required_count
                    ) {
                        isAvailable = false;
                        unavailableReasons.push('CARE_STAFF_CAPACITY_FULL');
                    }
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

            return {
                start_time: startTime,
                end_time: endTime,
                wash_bay_start_time: bookingPlan.wash_bay_start_time,
                wash_bay_end_time: bookingPlan.wash_bay_end_time,
                wash_bay_work_end_time: bookingPlan.wash_bay_work_end_time,
                wash_bay_reserved_until: bookingPlan.wash_bay_reserved_until,
                care_staff_start_time: bookingPlan.care_staff_start_time,
                care_staff_end_time: bookingPlan.care_staff_end_time,
                care_staff_work_end_time: bookingPlan.care_staff_work_end_time,
                care_staff_reserved_until: bookingPlan.care_staff_reserved_until,
                booking_items: bookingPlan.bookingItems,
                is_available: isAvailable,
                unavailable_reasons: [...new Set(unavailableReasons)],
                available_capacity: availableCapacity,
                available_wash_bay_capacity: availableWashBayCapacity,
                available_care_staff_capacity: availableCareStaffCapacity,
            };
        });

        const availableSlots = slots.filter((slot) => slot.is_available);

        return {
            date: plannedDay.date,
            opening_time: garage.opening_time,
            closing_time: garage.closing_time,
            latest_start_time: slots.at(-1)?.start_time || null,
            has_available_slots: availableSlots.length > 0,
            reason: availableSlots.length > 0
                ? null
                : plannedDay.reason || 'NO_CONTINUOUS_SLOT_AVAILABLE',
            available_slots: availableSlots,
            slots,
        };
    });
    const firstDay = availabilityDays[0];

    return {
        garage_id: garage._id.toString(),
        vehicle_id: vehicle?._id.toString() || null,
        service_package_id: servicePackage._id.toString(),
        add_on_service_ids: addOnServices.map((item) => item._id.toString()),
        date: requestedStartDate,
        start_date: requestedStartDate,
        requested_days: requestedDayCount,
        generated_at: now,
        booking_tier: bookingRule.current_tier,
        booking_window_days: bookingRule.booking_window_days,
        booking_window_end: bookingWindowEnd,
        vehicle_type: vehicleType,
        service_duration_minutes: serviceItems.reduce(
            (total, item) => total + item.servicePackage.duration_minutes,
            0
        ),
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
        has_available_slots: availabilityDays.some((item) => item.has_available_slots),
        available_slots: firstDay.available_slots,
        slots: firstDay.slots,
        days: availabilityDays,
    };
};

const getLatestPlannedEnd = (bookingLike) => {
    const endTimes = [
        bookingLike.end_time,
        bookingLike.wash_bay_reserved_until,
        bookingLike.care_staff_reserved_until,
    ].filter(Boolean);

    return new Date(Math.max(...endTimes.map((date) => date.getTime())));
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

    if (user.role !== USER_ROLES.ADMIN) {
        const staffProfile = await getActiveStaffProfile(user._id);

        if (!staffTypeHasCapability(
            staffProfile.staff_type,
            STAFF_CAPABILITIES.BOOKING_READ_GARAGE
        )) {
            filter.$and = [
                ...(filter.$and || []),
                getStaffAssignmentFilter(staffProfile),
            ];
        }
    }

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

const getBookingById = async (user, bookingId) => {
    const booking = await getRawBookingDocumentById(bookingId);

    await assertStaffCanAccessBooking(user, booking);

    const populatedBooking = await getBookingDocumentById(booking._id);

    return BookingMapper.toBookingDto(populatedBooking);
};

const createCustomerBooking = async (customerId, payload = {}) => {
    const now = new Date();
    const createPayload = BookingMapper.toCustomerCreatePayload(payload);
    await bookingViolationService.assertCustomerCanCreateBooking(customerId, now);

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
        garage,
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
    const voucherResult = await customerVoucherService.previewVoucherForBooking({
        customerId,
        code: createPayload.voucher_code,
        servicePackage,
        orderAmount: priceAfterPromotion,
    });
    const priceAfterVoucher = Math.max(
        priceAfterPromotion - (voucherResult?.discount_amount || 0),
        0
    );
    const redeemResult = await loyaltyService.calculateBookingRedeemDiscount({
        customerId,
        usedPoints,
        priceAfterPromotion: priceAfterVoucher,
    });
    const basePayload = buildBookingBasePayload({
        garage,
        servicePackage,
        bookingPlan,
        startTime,
        vehicleType: vehicle.vehicle_type,
        note: createPayload.note,
        promotionResult,
        voucherResult,
        redeemResult,
    });

    assertBookingStartTimeInFuture(startTime, now);
    assertBookingStartTimeAligned(garage, startTime);
    assertBookingWithinWindow(startTime, bookingRule, now);
    assertBookingInsideGarageBusinessHours(garage, basePayload.start_time, getLatestPlannedEnd(basePayload));
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

    if (basePayload.used_points > 0 || voucherResult) {
        const session = await mongoose.startSession();

        try {
            await session.withTransaction(async () => {
                const transactionalVoucherResult = await customerVoucherService.previewVoucherForBooking({
                    customerId,
                    code: createPayload.voucher_code,
                    servicePackage,
                    orderAmount: priceAfterPromotion,
                    session,
                });
                const transactionalPriceAfterVoucher = Math.max(
                    priceAfterPromotion - (transactionalVoucherResult?.discount_amount || 0),
                    0
                );
                const transactionalRedeemResult = await loyaltyService.calculateBookingRedeemDiscount({
                    customerId,
                    usedPoints: basePayload.used_points,
                    priceAfterPromotion: transactionalPriceAfterVoucher,
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
                    voucherResult: transactionalVoucherResult,
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

                if (transactionalVoucherResult) {
                    await customerVoucherService.reserveVoucherForBooking({
                        voucherId: transactionalVoucherResult.voucher._id,
                        customerId,
                        bookingId: booking._id,
                        session,
                    });
                }

                if (transactionalBasePayload.used_points > 0) {
                    await loyaltyService.redeemPointsForBooking({
                        booking,
                        customerId,
                        usedPoints: transactionalBasePayload.used_points,
                        priceAfterPromotion: transactionalPriceAfterVoucher,
                        actorId: customerId,
                        expectedPointsDiscountAmount: transactionalBasePayload.points_discount_amount,
                        session,
                    });
                }
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
    const now = new Date();
    const createPayload = BookingMapper.toWalkInCreatePayload(payload);
    const [garage, servicePackage] = await Promise.all([
        getActiveGarage(createPayload.garage_id),
        getActiveServicePackage(createPayload.service_package_id),
    ]);
    const serveNow = createPayload.serve_now === true;
    const startTime = serveNow
        ? now
        : parseDateTime(createPayload.start_time, 'start_time');
    const normalizedLicensePlate = normalizeLicensePlate(createPayload.license_plate);
    const normalizedGuestPhone = createPayload.guest_phone
        ? normalizePhone(createPayload.guest_phone)
        : null;

    await assertStaffCanAccessGarage(user, garage._id);

    if (normalizedGuestPhone && !isValidPhone(normalizedGuestPhone)) {
        throw new AppError('Guest phone is invalid', 400, 'INVALID_GUEST_PHONE');
    }

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
        garage,
    });

    const promotionResult = await promotionService.validatePromotionForBooking({
        promotion_code: createPayload.promotion_code,
        customer_id: null,
        guest_phone_normalized: normalizedGuestPhone,
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

    if (!serveNow) {
        assertBookingStartTimeInFuture(startTime, now);
        assertBookingStartTimeAligned(garage, startTime);
    }
    assertBookingInsideGarageBusinessHours(garage, basePayload.start_time, getLatestPlannedEnd(basePayload));

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
    try {
        await assertGarageCapacityAvailable({
            garageId: garage._id,
            vehicleType: createPayload.vehicle_type,
            bookingItems: basePayload.booking_items,
        });
    } catch (error) {
        const resourceErrorCodes = new Set([
            'WASH_BAY_CAPACITY_FULL',
            'CARE_STAFF_CAPACITY_FULL',
            'WASH_BAY_TEMPORARILY_UNAVAILABLE',
            'NO_ACTIVE_WASH_BAY_FOR_VEHICLE_TYPE',
            'NO_ACTIVE_CARE_STAFF',
        ]);

        if (!resourceErrorCodes.has(error.errorCode)) {
            throw error;
        }

        let suggestedSlots = [];

        try {
            const availability = await getAvailableSlots({
                garage_id: garage._id,
                service_package_id: servicePackage._id,
                add_on_service_ids: createPayload.add_on_service_ids || [],
                start_date: getLocalDateString(now),
                days: createPayload.suggestion_days || 1,
            });

            suggestedSlots = availability.days.flatMap((day) => day.available_slots);
        } catch (availabilityError) {
            suggestedSlots = [];
        }

        throw new AppError(
            error.message,
            error.statusCode,
            error.errorCode,
            {
                can_serve_now: false,
                requested_start_time: startTime,
                unavailable_reasons: [error.errorCode],
                suggested_slots: suggestedSlots,
            }
        );
    }

    const buildWalkInPayload = (effectiveBasePayload) => ({
        ...effectiveBasePayload,
        customer_id: null,
        vehicle_id: null,
        is_walk_in: true,
        guest_name: normalizeText(createPayload.guest_name),
        guest_phone: normalizedGuestPhone,
        normalized_guest_phone: normalizedGuestPhone,
        guest_email: normalizeEmail(createPayload.guest_email),
        license_plate: normalizeRequiredText(createPayload.license_plate),
        normalized_license_plate: normalizedLicensePlate,
        created_by_staff_id: user._id,
        ...(serveNow ? {
            status: BOOKING_STATUS.CHECKED_IN,
            arrival_status: BOOKING_ARRIVAL_STATUS.ON_TIME,
            arrived_at: now,
            arrival_reference_start_time: startTime,
            checked_in_at: now,
        } : {}),
    });

    let booking;

    if (promotionResult?.promotion) {
        const session = await mongoose.startSession();

        try {
            await session.withTransaction(async () => {
                const transactionalPromotionResult = await promotionService.validatePromotionForBooking({
                    promotion_code: createPayload.promotion_code,
                    customer_id: null,
                    guest_phone_normalized: normalizedGuestPhone,
                    servicePackage,
                    vehicleType: createPayload.vehicle_type,
                    orderAmount: bookingPlan.originalPrice,
                    bookingStartTime: startTime,
                    session,
                });
                const transactionalBasePayload = buildBookingBasePayload({
                    garage,
                    servicePackage,
                    bookingPlan,
                    startTime,
                    vehicleType: createPayload.vehicle_type,
                    note: createPayload.note,
                    promotionResult: transactionalPromotionResult,
                });
                const documents = await Booking.create(
                    [buildWalkInPayload(transactionalBasePayload)],
                    { session }
                );

                [booking] = documents;

                await promotionUsageService.reservePromotionUsageForBooking({
                    booking,
                    promotion: transactionalPromotionResult.promotion,
                    guestPhoneNormalized: normalizedGuestPhone,
                    actorId: user._id,
                    session,
                });
            });
        } finally {
            await session.endSession();
        }
    } else {
        booking = await Booking.create(buildWalkInPayload(basePayload));
    }

    const populatedBooking = await getBookingDocumentById(booking._id);

    return BookingMapper.toBookingDto(populatedBooking);
};

const assertBookingHasNoActiveIncident = (booking) => {
    if (
        booking.operation_status === BOOKING_OPERATION_STATUS.AWAITING_CUSTOMER_DECISION
        || booking.active_incident_id
    ) {
        throw new AppError(
            'Booking has an unresolved garage incident',
            409,
            'BOOKING_INCIDENT_DECISION_REQUIRED'
        );
    }
};

const emitBookingCanceledNotification = async ({ booking, incidentId = null }) => {
    if (!booking.customer_id) {
        return null;
    }

    return notificationService.createInAppNotification({
        userId: booking.customer_id,
        type: NOTIFICATION_TYPES.BOOKING_CANCELED,
        title: 'Booking canceled',
        message: incidentId
            ? 'Your booking was canceled after you confirmed the garage incident resolution.'
            : 'Your booking has been canceled.',
        relatedType: NOTIFICATION_RELATED_TYPES.BOOKING,
        relatedId: booking._id,
        metadata: {
            booking_id: booking._id.toString(),
            cancellation_source: booking.cancellation_source,
            incident_id: toObjectIdString(incidentId),
            canceled_at: booking.canceled_at,
        },
    });
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

    assertBookingHasNoActiveIncident(booking);

    if (!BOOKING_CUSTOMER_CANCELABLE_STATUSES.includes(booking.status)) {
        throw new AppError('Booking cannot be canceled in current status', 400, 'BOOKING_NOT_CANCELABLE');
    }

    const canceledAt = new Date();

    booking.status = BOOKING_STATUS.CANCELED;
    booking.canceled_at = canceledAt;
    booking.canceled_by_id = customerId;
    booking.cancel_reason = normalizeText(reason);
    booking.cancellation_source = BOOKING_CANCELLATION_SOURCES.CUSTOMER;

    await booking.save();
    if (booking.customer_voucher_id) {
        await customerVoucherService.releaseVoucherForBooking({ bookingId: booking._id });
    }
    await loyaltyService.refundRedeemedPointsForBooking({
        booking,
        actorId: customerId,
    });
    await bookingViolationService.recordLateCancelIfNeeded({
        booking,
        reason: booking.cancel_reason,
        actorId: customerId,
        canceledAt,
    });
    await emitBookingCanceledNotification({ booking });

    const populatedBooking = await getBookingDocumentById(booking._id);

    return BookingMapper.toBookingDto(populatedBooking);
};

const cancelBooking = async (user, bookingId, { reason } = {}) => {
    const booking = await getRawBookingDocumentById(bookingId);

    await assertStaffCanAccessBooking(user, booking);
    assertBookingHasNoActiveIncident(booking);

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
    booking.cancellation_source = user.role === USER_ROLES.ADMIN
        ? BOOKING_CANCELLATION_SOURCES.ADMIN_CORRECTION
        : BOOKING_CANCELLATION_SOURCES.STAFF_CUSTOMER_REQUEST;

    if (booking.is_walk_in && booking.promotion_id) {
        const session = await mongoose.startSession();

        try {
            await session.withTransaction(async () => {
                await booking.save({ session });
                await promotionUsageService.releaseReservedPromotionForBooking({
                    bookingId: booking._id,
                    session,
                });
            });
        } finally {
            await session.endSession();
        }
    } else {
        await booking.save();
    }

    if (booking.arrival_status !== BOOKING_ARRIVAL_STATUS.LATE) {
        await loyaltyService.refundRedeemedPointsForBooking({
            booking,
            actorId: user._id,
        });
    }
    if (booking.customer_voucher_id) {
        await customerVoucherService.releaseVoucherForBooking({ bookingId: booking._id });
    }
    await emitBookingCanceledNotification({ booking });

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
    assertBookingHasNoActiveIncident(booking);

    if (booking.arrived_at) {
        throw new AppError(
            'Booking cannot be marked no-show after customer arrival',
            409,
            'BOOKING_ARRIVED_CANNOT_NO_SHOW'
        );
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

    if (booking.is_walk_in && booking.promotion_id) {
        const session = await mongoose.startSession();

        try {
            await session.withTransaction(async () => {
                await booking.save({ session });
                await promotionUsageService.releaseReservedPromotionForBooking({
                    bookingId: booking._id,
                    session,
                });
            });
        } finally {
            await session.endSession();
        }
    } else {
        await booking.save();
    }
    await bookingViolationService.recordNoShow({
        booking,
        reason: booking.no_show_reason,
        actorId: user._id,
        noShowAt,
    });
    if (booking.customer_voucher_id) {
        await customerVoucherService.consumeVoucherForBooking({ bookingId: booking._id });
    }

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

const BOOKING_INCIDENT_ELIGIBLE_STATUSES = [
    BOOKING_STATUS.PENDING,
    BOOKING_STATUS.CONFIRMED,
    BOOKING_STATUS.CHECKED_IN,
    BOOKING_STATUS.IN_PROGRESS,
];

const populateBookingIncidentQuery = (query) => query
    .populate('reported_by_id', 'full_name email phone role is_active')
    .populate('decision_recorded_by_id', 'full_name email phone role is_active')
    .populate('resolved_by_id', 'full_name email phone role is_active');

const getBookingIncidentDocument = async (bookingId, incidentId, session = null) => {
    const query = BookingIncident.findOne({
        _id: incidentId,
        booking_id: bookingId,
    });
    const incident = session ? await query.session(session) : await query;

    if (!incident) {
        throw new AppError('Booking incident not found', 404, 'BOOKING_INCIDENT_NOT_FOUND');
    }

    return incident;
};

const getIncidentScheduleSnapshot = (booking) => ({
    _id: booking._id,
    customer_id: booking.customer_id,
    garage_id: booking.garage_id,
    service_package_id: booking.service_package_id,
    vehicle_type: booking.vehicle_type,
    add_on_service_ids: booking.add_on_service_ids || [],
    start_time: booking.start_time,
    end_time: booking.end_time,
    booking_status: booking.status,
    checked_in_at: booking.checked_in_at,
    started_at: booking.started_at,
    booking_items: (booking.booking_items || []).map((item) => ({
        item_key: item.item_key,
        sequence: item.sequence,
        status: item.status,
        actual_started_at: item.actual_started_at,
        countdown_ends_at: item.countdown_ends_at,
        actual_completed_at: item.actual_completed_at,
        remaining_seconds_at_pause: item.remaining_seconds_at_pause,
    })),
});

const pauseCurrentBookingItemForIncident = (booking, userId, pausedAt) => {
    const bookingItem = getCurrentBookingItem(booking);

    if (!bookingItem || bookingItem.status !== BOOKING_ITEM_STATUS.IN_PROGRESS) {
        return null;
    }

    const remainingSeconds = Math.max(getRemainingServiceItemSeconds(bookingItem, pausedAt), 1);

    bookingItem.status = BOOKING_ITEM_STATUS.PAUSED;
    bookingItem.remaining_seconds_at_pause = remainingSeconds;
    bookingItem.paused_at = pausedAt;
    bookingItem.paused_by_staff_id = userId;
    bookingItem.pause_reason = 'GARAGE_INCIDENT';
    bookingItem.countdown_ends_at = null;
    bookingItem.timer_claimed_at = null;
    bookingItem.timer_claim_token = null;
    booking.markModified('booking_items');

    return bookingItem;
};

const releaseAffectedStaffForIncident = ({
    booking,
    affectedStaffProfileId,
    affectedBookingItemKey,
    releasedAt,
}) => {
    const normalizedItemKey = normalizeBookingItemKey(affectedBookingItemKey);
    let matchedAssignment = false;
    const releasedBookingItemKeys = [];

    for (const bookingItem of booking.booking_items || []) {
        if (normalizedItemKey && normalizeBookingItemKey(bookingItem.item_key) !== normalizedItemKey) {
            continue;
        }

        let released = false;

        for (const assignment of bookingItem.assigned_care_staff || []) {
            if (assignment.released_at) {
                continue;
            }

            const staffProfileId = toObjectIdString(getCareStaffAssignmentStaffProfileId(assignment));

            if (affectedStaffProfileId && staffProfileId !== toObjectIdString(affectedStaffProfileId)) {
                continue;
            }

            assignment.released_at = releasedAt;
            matchedAssignment = true;
            released = true;
        }

        if (released) {
            releasedBookingItemKeys.push(normalizeBookingItemKey(bookingItem.item_key));
        }
    }

    if (affectedStaffProfileId && !matchedAssignment) {
        throw new AppError(
            'Affected staff is not actively assigned to this booking',
            400,
            'BOOKING_INCIDENT_STAFF_NOT_ASSIGNED'
        );
    }

    if (matchedAssignment) {
        syncAssignedCareStaffIds(booking);
        booking.markModified('booking_items');
    }

    return releasedBookingItemKeys.filter(Boolean);
};

const getGarageStaffUserIds = async (garageId) => {
    const staffProfiles = await StaffProfile.find({
        garage_id: garageId,
        is_active: true,
    }).select('user_id').lean();

    return [...new Set(staffProfiles
        .map((profile) => toObjectIdString(profile.user_id))
        .filter(Boolean))];
};

const sendBookingIncidentReportedNotifications = async ({ booking, incident }) => {
    const staffUserIds = await getGarageStaffUserIds(booking.garage_id);
    const notifications = staffUserIds.map((userId) => notificationService.createInAppNotification({
        userId,
        type: NOTIFICATION_TYPES.BOOKING_INCIDENT_REPORTED,
        title: 'Garage incident requires customer decision',
        message: 'Contact the customer and record whether they continue, reschedule, or cancel.',
        relatedType: NOTIFICATION_RELATED_TYPES.BOOKING,
        relatedId: booking._id,
        metadata: {
            booking_id: booking._id.toString(),
            incident_id: incident._id.toString(),
            incident_type: incident.incident_type,
        },
    }));

    if (booking.customer_id) {
        notifications.push(notificationService.createInAppNotification({
            userId: booking.customer_id,
            type: NOTIFICATION_TYPES.BOOKING_CUSTOMER_DECISION_REQUIRED,
            title: 'Your booking needs a decision',
            message: 'The garage reported an operational incident. Choose whether to continue, reschedule, or cancel.',
            relatedType: NOTIFICATION_RELATED_TYPES.BOOKING,
            relatedId: booking._id,
            metadata: {
                booking_id: booking._id.toString(),
                incident_id: incident._id.toString(),
                incident_type: incident.incident_type,
            },
        }));
    }

    await Promise.allSettled(notifications);
};

const sendBookingIncidentResolvedNotifications = async ({ booking, incident }) => {
    const recipients = new Set(await getGarageStaffUserIds(booking.garage_id));

    if (booking.customer_id) {
        recipients.add(toObjectIdString(booking.customer_id));
    }

    await Promise.allSettled([...recipients].map((userId) => notificationService.createInAppNotification({
        userId,
        type: NOTIFICATION_TYPES.BOOKING_INCIDENT_RESOLVED,
        title: 'Booking incident resolved',
        message: `The customer decision was recorded as ${incident.decision}.`,
        relatedType: NOTIFICATION_RELATED_TYPES.BOOKING,
        relatedId: booking._id,
        metadata: {
            booking_id: booking._id.toString(),
            incident_id: incident._id.toString(),
            decision: incident.decision,
            new_start_time: incident.new_start_time,
        },
    })));
};

const reportBookingIncident = async (user, bookingId, payload = {}, auditContext = {}) => {
    const session = await mongoose.startSession();
    let booking;
    let incident;
    let releasedBookingItemKeys = [];

    try {
        await session.withTransaction(async () => {
            booking = await getRawBookingDocumentById(bookingId, session);

            await assertStaffCanAccessBooking(user, booking);
            assertBookingStatusIn(
                booking,
                BOOKING_INCIDENT_ELIGIBLE_STATUSES,
                'BOOKING_INCIDENT_REPORT_NOT_ALLOWED'
            );
            assertBookingHasNoActiveIncident(booking);

            const reportedAt = new Date();
            const activeBookingItem = getCurrentBookingItem(booking);
            const affectedBookingItemKey = normalizeBookingItemKey(
                payload.affected_booking_item_key || activeBookingItem?.item_key
            );

            if (
                affectedBookingItemKey
                && !getBookingItemByKey(booking, affectedBookingItemKey)
            ) {
                throw new AppError(
                    'Affected booking item not found',
                    404,
                    'BOOKING_INCIDENT_ITEM_NOT_FOUND'
                );
            }

            const pausedItem = pauseCurrentBookingItemForIncident(booking, user._id, reportedAt);
            let affectedWashBayId = payload.affected_wash_bay_id || null;

            if (payload.incident_type === BOOKING_INCIDENT_TYPES.WASH_BAY_FAILURE) {
                affectedWashBayId = affectedWashBayId || booking.wash_bay_id;

                if (
                    affectedWashBayId
                    && (!booking.wash_bay_id
                        || toObjectIdString(booking.wash_bay_id) !== toObjectIdString(affectedWashBayId))
                ) {
                    throw new AppError(
                        'Affected wash bay is not assigned to this booking',
                        400,
                        'BOOKING_INCIDENT_WASH_BAY_NOT_ASSIGNED'
                    );
                }

                if (affectedWashBayId) {
                    const updatedWashBay = await WashBay.findOneAndUpdate(
                        {
                            _id: affectedWashBayId,
                            garage_id: booking.garage_id,
                            current_booking_id: booking._id,
                        },
                        {
                            status: WASH_BAY_STATUS.MAINTENANCE,
                            current_booking_id: null,
                            is_active: true,
                        },
                        { new: true, session }
                    );

                    if (!updatedWashBay) {
                        throw new AppError(
                            'Assigned wash bay could not be marked for maintenance',
                            409,
                            'BOOKING_INCIDENT_WASH_BAY_UPDATE_FAILED'
                        );
                    }

                    booking.wash_bay_id = null;
                }
            }

            if (payload.incident_type === BOOKING_INCIDENT_TYPES.STAFF_UNAVAILABLE) {
                releasedBookingItemKeys = releaseAffectedStaffForIncident({
                    booking,
                    affectedStaffProfileId: payload.affected_staff_profile_id,
                    affectedBookingItemKey,
                    releasedAt: reportedAt,
                });
            }

            const documents = await BookingIncident.create(
                [
                    {
                        booking_id: booking._id,
                        garage_id: booking.garage_id,
                        customer_id: booking.customer_id,
                        incident_type: payload.incident_type,
                        description: normalizeText(payload.description),
                        affected_booking_item_key: affectedBookingItemKey,
                        affected_wash_bay_id: affectedWashBayId,
                        affected_staff_profile_id: payload.affected_staff_profile_id || null,
                        reported_by_id: user._id,
                        reported_booking_status: booking.status,
                        reported_schedule_snapshot: getIncidentScheduleSnapshot(booking),
                        countdown_paused_automatically: Boolean(pausedItem),
                    },
                ],
                { session }
            );

            [incident] = documents;
            booking.operation_status = BOOKING_OPERATION_STATUS.AWAITING_CUSTOMER_DECISION;
            booking.active_incident_id = incident._id;
            await booking.save({ session });

            await auditLogService.recordAuditEvent({
                actorId: user._id,
                action: AUDIT_ACTIONS.BOOKING_INCIDENT_REPORTED,
                resourceType: AUDIT_RESOURCE_TYPES.BOOKING_INCIDENT,
                resourceId: incident._id,
                after: {
                    booking_id: booking._id,
                    incident_type: incident.incident_type,
                    operation_status: booking.operation_status,
                    countdown_paused_automatically: incident.countdown_paused_automatically,
                },
                ip: auditContext.ip,
                userAgent: auditContext.userAgent,
                session,
            });
        });
    } catch (error) {
        if (error?.code === 11000) {
            throw new AppError(
                'Booking already has an unresolved garage incident',
                409,
                'BOOKING_INCIDENT_ALREADY_ACTIVE'
            );
        }

        throw error;
    } finally {
        await session.endSession();
    }

    for (const bookingItemKey of releasedBookingItemKeys) {
        await bookingServiceStepService.markResourceReleasedForBookingItem(
            booking._id,
            bookingItemKey,
            incident.created_at
        );
    }

    await sendBookingIncidentReportedNotifications({ booking, incident });

    const [populatedBooking, populatedIncident] = await Promise.all([
        getBookingDocumentById(booking._id),
        populateBookingIncidentQuery(BookingIncident.findById(incident._id)),
    ]);

    return {
        booking: BookingMapper.toBookingDto(populatedBooking),
        incident: BookingIncidentMapper.toBookingIncidentDto(populatedIncident),
    };
};

const getIncidentSearchStartTime = ({ garage, now }) => {
    const localDate = getLocalDateString(now);
    const openingDate = createDateFromLocalTime(localDate, garage.opening_time);
    const closingDate = createDateFromLocalTime(localDate, garage.closing_time);

    if (now <= openingDate) {
        return openingDate;
    }

    const roundedTime = ceilToGarageSlot(now, garage);

    if (roundedTime < closingDate) {
        return roundedTime;
    }

    return createDateFromLocalTime(addDaysToDateString(localDate, 1), garage.opening_time);
};

const buildIncidentContinuationBooking = (booking) => {
    const remainingItems = (booking.booking_items || [])
        .filter((item) => ![BOOKING_ITEM_STATUS.DONE, BOOKING_ITEM_STATUS.SKIPPED].includes(item.status))
        .sort((firstItem, secondItem) => firstItem.sequence - secondItem.sequence);

    if (remainingItems.length === 0) {
        throw new AppError(
            'Booking has no remaining service items to reschedule',
            409,
            'BOOKING_INCIDENT_NO_REMAINING_ITEMS'
        );
    }

    const plainBooking = booking.toObject ? booking.toObject() : { ...booking };
    const firstItem = remainingItems[0];
    const lastItem = remainingItems[remainingItems.length - 1];

    return {
        ...plainBooking,
        _id: booking._id,
        start_time: firstItem.item_start_time,
        end_time: lastItem.item_end_time,
        booking_items: remainingItems.map((item) => item.toObject ? item.toObject() : { ...item }),
    };
};

const getIncidentResolutionOptionsInternal = async ({ booking, incident, days = 3 }) => {
    const garage = await getActiveGarage(booking.garage_id);
    const continuationBooking = buildIncidentContinuationBooking(booking);
    const searchStartTime = getIncidentSearchStartTime({
        garage,
        now: new Date(),
    });
    const candidateDays = buildLateArrivalCandidateDays({
        booking: continuationBooking,
        garage,
        searchStartTime,
        days,
    });
    const availabilityDays = await evaluateLateArrivalCandidates({
        booking: continuationBooking,
        garage,
        candidateDays,
    });
    let canReassignAndContinue = false;

    if ([BOOKING_STATUS.CHECKED_IN, BOOKING_STATUS.IN_PROGRESS].includes(booking.status)) {
        if (incident.incident_type === BOOKING_INCIDENT_TYPES.WASH_BAY_FAILURE) {
            canReassignAndContinue = !booking.requires_wash_bay || Boolean(await WashBay.exists({
                garage_id: booking.garage_id,
                vehicle_type: booking.vehicle_type,
                is_active: true,
                status: WASH_BAY_STATUS.AVAILABLE,
                current_booking_id: null,
            }));
        } else if (incident.incident_type === BOOKING_INCIDENT_TYPES.STAFF_UNAVAILABLE) {
            const affectedItem = getBookingItemByKey(
                booking,
                incident.affected_booking_item_key
            ) || getCurrentBookingItem(booking);
            const requiredCount = affectedItem?.care_staff_required_count || 0;
            const activeAssignments = affectedItem
                ? getActiveCareStaffAssignments(affectedItem).length
                : 0;

            canReassignAndContinue = requiredCount === 0 || activeAssignments < requiredCount;
        } else {
            canReassignAndContinue = true;
        }
    }

    return {
        booking_id: booking._id.toString(),
        incident_id: incident._id.toString(),
        incident_type: incident.incident_type,
        operation_status: booking.operation_status,
        can_reassign_and_continue: canReassignAndContinue,
        available_actions: [
            ...(canReassignAndContinue
                ? [BOOKING_INCIDENT_DECISIONS.REASSIGN_AND_CONTINUE]
                : []),
            BOOKING_INCIDENT_DECISIONS.RESCHEDULE_NEAREST,
            BOOKING_INCIDENT_DECISIONS.RESCHEDULE_CUSTOM,
            BOOKING_INCIDENT_DECISIONS.CANCEL_BY_GARAGE,
        ],
        search_start_time: searchStartTime,
        days: availabilityDays,
        suggested_slots: availabilityDays.flatMap((day) => day.suggested_slots),
    };
};

const assertCustomerOwnsIncidentBooking = (customerId, booking) => {
    if (
        !booking.customer_id
        || toObjectIdString(booking.customer_id) !== toObjectIdString(customerId)
        || booking.is_walk_in
    ) {
        throw new AppError('Booking incident not found', 404, 'BOOKING_INCIDENT_NOT_FOUND');
    }
};

const getAdminActiveBookingIncident = async (user, bookingId) => {
    const booking = await getRawBookingDocumentById(bookingId);

    await assertStaffCanAccessBooking(user, booking);

    if (!booking.active_incident_id) {
        return null;
    }

    const incident = await populateBookingIncidentQuery(
        BookingIncident.findById(booking.active_incident_id)
    );

    return {
        incident: BookingIncidentMapper.toBookingIncidentDto(incident),
        resolution_options: await getIncidentResolutionOptionsInternal({
            booking,
            incident,
            days: 3,
        }),
    };
};

const getMyActiveBookingIncident = async (customerId, bookingId) => {
    const booking = await getRawBookingDocumentById(bookingId);

    assertCustomerOwnsIncidentBooking(customerId, booking);

    if (!booking.active_incident_id) {
        return null;
    }

    const incident = await populateBookingIncidentQuery(
        BookingIncident.findById(booking.active_incident_id)
    );

    return {
        incident: BookingIncidentMapper.toBookingIncidentDto(incident),
        resolution_options: await getIncidentResolutionOptionsInternal({
            booking,
            incident,
            days: 3,
        }),
    };
};

const getAdminBookingIncidentOptions = async (user, bookingId, incidentId, { days = 3 } = {}) => {
    const booking = await getRawBookingDocumentById(bookingId);

    await assertStaffCanAccessBooking(user, booking);
    const incident = await getBookingIncidentDocument(booking._id, incidentId);

    if (incident.status !== BOOKING_INCIDENT_STATUS.AWAITING_CUSTOMER_DECISION) {
        throw new AppError(
            'Booking incident has already been resolved',
            409,
            'BOOKING_INCIDENT_ALREADY_RESOLVED'
        );
    }

    return getIncidentResolutionOptionsInternal({ booking, incident, days });
};

const applyIncidentRescheduledTimeline = ({
    booking,
    startTime,
    continuationPolicy,
    user,
    incident,
    resolvedAt,
}) => {
    const completedItems = (booking.booking_items || [])
        .filter((item) => [BOOKING_ITEM_STATUS.DONE, BOOKING_ITEM_STATUS.SKIPPED].includes(item.status))
        .map((item) => item.toObject ? item.toObject() : { ...item });
    const continuationBooking = buildIncidentContinuationBooking(booking);
    const pausedItem = (booking.booking_items || []).find((item) => item.status === BOOKING_ITEM_STATUS.PAUSED);
    const pausedItemKey = normalizeBookingItemKey(pausedItem?.item_key);
    const pausedRemainingSeconds = pausedItem?.remaining_seconds_at_pause || null;
    const timeline = buildShiftedBookingTimeline({
        booking: continuationBooking,
        startTime,
    });

    if (
        continuationPolicy === BOOKING_INCIDENT_CONTINUATION_POLICIES.RESUME_REMAINING
        && pausedItemKey
        && pausedRemainingSeconds
    ) {
        const shiftedPausedItem = timeline.booking_items.find((item) => (
            normalizeBookingItemKey(item.item_key) === pausedItemKey
        ));

        if (shiftedPausedItem) {
            shiftedPausedItem.countdown_resume_seconds = pausedRemainingSeconds;
        }
    }

    if (!booking.original_start_time) {
        booking.original_start_time = incident.reported_schedule_snapshot.start_time;
    }

    if (!booking.original_end_time) {
        booking.original_end_time = incident.reported_schedule_snapshot.end_time;
    }

    booking.booking_date = startOfBookingDate(timeline.start_time);
    booking.start_time = timeline.start_time;
    booking.end_time = timeline.end_time;
    booking.booking_items = [...completedItems, ...timeline.booking_items]
        .sort((firstItem, secondItem) => firstItem.sequence - secondItem.sequence);
    booking.wash_bay_start_time = timeline.wash_bay_start_time;
    booking.wash_bay_end_time = timeline.wash_bay_end_time;
    booking.wash_bay_work_end_time = timeline.wash_bay_work_end_time;
    booking.wash_bay_reserved_until = timeline.wash_bay_reserved_until;
    booking.care_staff_start_time = timeline.care_staff_start_time;
    booking.care_staff_end_time = timeline.care_staff_end_time;
    booking.care_staff_work_end_time = timeline.care_staff_work_end_time;
    booking.care_staff_reserved_until = timeline.care_staff_reserved_until;
    booking.assigned_care_staff_ids = [];
    booking.status = BOOKING_STATUS.CONFIRMED;
    booking.arrival_status = null;
    booking.arrived_at = null;
    booking.arrival_reference_start_time = startTime;
    booking.late_minutes = 0;
    booking.grace_exceeded_minutes = 0;
    booking.late_resolution = null;
    booking.late_accepted_by_id = null;
    booking.late_accepted_at = null;
    booking.checked_in_at = null;
    booking.started_at = null;
    booking.rescheduled_at = resolvedAt;
    booking.rescheduled_by_id = user._id;
    booking.reschedule_reason = 'GARAGE_INCIDENT';
    booking.reschedule_count = (booking.reschedule_count || 0) + 1;
    booking.markModified('booking_items');
};

const resumeIncidentPausedItem = (booking, resumedAt) => {
    const bookingItem = (booking.booking_items || []).find((item) => (
        item.status === BOOKING_ITEM_STATUS.PAUSED
    ));

    if (!bookingItem) {
        return null;
    }

    const remainingSeconds = bookingItem.remaining_seconds_at_pause;

    if (!remainingSeconds || remainingSeconds < 1) {
        throw new AppError(
            'Paused service item has no remaining countdown',
            409,
            'BOOKING_SERVICE_ITEM_REMAINING_TIME_INVALID'
        );
    }

    const pausedSeconds = bookingItem.paused_at
        ? Math.max(0, Math.ceil((resumedAt.getTime() - new Date(bookingItem.paused_at).getTime()) / 1000))
        : 0;

    bookingItem.status = BOOKING_ITEM_STATUS.IN_PROGRESS;
    bookingItem.countdown_ends_at = addSeconds(resumedAt, remainingSeconds);
    bookingItem.remaining_seconds_at_pause = null;
    bookingItem.total_paused_seconds = (bookingItem.total_paused_seconds || 0) + pausedSeconds;
    bookingItem.paused_at = null;
    bookingItem.paused_by_staff_id = null;
    bookingItem.pause_reason = null;
    bookingItem.timer_claimed_at = null;
    bookingItem.timer_claim_token = null;
    booking.markModified('booking_items');

    return bookingItem;
};

const resolveBookingIncidentDecision = async (
    user,
    bookingId,
    incidentId,
    payload,
    decisionSource,
    auditContext = {}
) => {
    const session = await mongoose.startSession();
    let booking;
    let incident;
    let releasedBookingItemKeys = [];
    let shouldOfferWaitlist = false;

    try {
        await session.withTransaction(async () => {
            booking = await getRawBookingDocumentById(bookingId, session);

            if (decisionSource === BOOKING_INCIDENT_DECISION_SOURCES.CUSTOMER) {
                assertCustomerOwnsIncidentBooking(user._id, booking);
            } else {
                await assertStaffCanAccessBooking(user, booking);
            }

            incident = await getBookingIncidentDocument(booking._id, incidentId, session);

            if (
                incident.status !== BOOKING_INCIDENT_STATUS.AWAITING_CUSTOMER_DECISION
                || toObjectIdString(booking.active_incident_id) !== incident._id.toString()
            ) {
                throw new AppError(
                    'Booking incident has already been resolved',
                    409,
                    'BOOKING_INCIDENT_ALREADY_RESOLVED'
                );
            }

            const resolvedAt = new Date();
            const decision = payload.decision;
            const before = {
                booking_status: booking.status,
                operation_status: booking.operation_status,
                start_time: booking.start_time,
                end_time: booking.end_time,
                incident_status: incident.status,
            };

            if (decision === BOOKING_INCIDENT_DECISIONS.REASSIGN_AND_CONTINUE) {
                if (![BOOKING_STATUS.CHECKED_IN, BOOKING_STATUS.IN_PROGRESS].includes(booking.status)) {
                    throw new AppError(
                        'Booking cannot continue with reassignment in current status',
                        400,
                        'BOOKING_INCIDENT_REASSIGN_NOT_ALLOWED'
                    );
                }

                await assignCareStaffToBookingIfNeeded(booking);
                await assignWashBayToBookingIfNeeded(booking, session);

                if (booking.status === BOOKING_STATUS.IN_PROGRESS) {
                    resumeIncidentPausedItem(booking, resolvedAt);
                }
            } else if (
                [
                    BOOKING_INCIDENT_DECISIONS.RESCHEDULE_NEAREST,
                    BOOKING_INCIDENT_DECISIONS.RESCHEDULE_CUSTOM,
                ].includes(decision)
            ) {
                const options = await getIncidentResolutionOptionsInternal({
                    booking,
                    incident,
                    days: 7,
                });
                const nearestSlot = options.suggested_slots[0] || null;
                const requestedStartTime = decision === BOOKING_INCIDENT_DECISIONS.RESCHEDULE_NEAREST
                    ? nearestSlot?.start_time
                    : parseDateTime(payload.new_start_time, 'new_start_time');

                if (!requestedStartTime) {
                    throw new AppError(
                        'No incident reschedule slot is currently available',
                        409,
                        'BOOKING_INCIDENT_NO_RESCHEDULE_SLOT'
                    );
                }

                const selectedSlot = options.suggested_slots.find((slot) => (
                    new Date(slot.start_time).getTime() === requestedStartTime.getTime()
                ));

                if (!selectedSlot) {
                    throw new AppError(
                        'Selected incident reschedule slot is no longer available',
                        409,
                        'BOOKING_INCIDENT_SLOT_NO_LONGER_AVAILABLE'
                    );
                }

                await releaseWashBayForBooking(booking, session);
                booking.wash_bay_id = null;
                releasedBookingItemKeys = releaseActiveCareStaffAssignmentsForBooking(booking, resolvedAt);
                applyIncidentRescheduledTimeline({
                    booking,
                    startTime: requestedStartTime,
                    continuationPolicy: payload.continuation_policy
                        || BOOKING_INCIDENT_CONTINUATION_POLICIES.RESUME_REMAINING,
                    user,
                    incident,
                    resolvedAt,
                });
                shouldOfferWaitlist = true;
            } else if (decision === BOOKING_INCIDENT_DECISIONS.CANCEL_BY_GARAGE) {
                if (booking.payment_status !== BOOKING_PAYMENT_STATUS.UNPAID) {
                    throw new AppError(
                        'Garage incident cancellation requires an unpaid booking',
                        409,
                        'BOOKING_INCIDENT_PAYMENT_REFUND_REQUIRED'
                    );
                }

                await releaseWashBayForBooking(booking, session);
                releasedBookingItemKeys = releaseActiveCareStaffAssignmentsForBooking(booking, resolvedAt);
                booking.status = BOOKING_STATUS.CANCELED;
                booking.canceled_at = resolvedAt;
                booking.canceled_by_id = user._id;
                booking.cancel_reason = normalizeText(payload.customer_note)
                    || `Garage incident: ${incident.incident_type}`;
                booking.cancellation_source = BOOKING_CANCELLATION_SOURCES.GARAGE_INCIDENT;
                booking.cancellation_incident_id = incident._id;

                if (booking.customer_voucher_id) {
                    await customerVoucherService.releaseVoucherForBooking({
                        bookingId: booking._id,
                        session,
                    });
                }
                await loyaltyService.refundRedeemedPointsForBooking({
                    booking,
                    actorId: user._id,
                    session,
                });

                if (booking.is_walk_in && booking.promotion_id) {
                    await promotionUsageService.releaseReservedPromotionForBooking({
                        bookingId: booking._id,
                        session,
                    });
                }

                shouldOfferWaitlist = true;
            } else {
                throw new AppError(
                    'Booking incident decision is invalid',
                    400,
                    'BOOKING_INCIDENT_DECISION_INVALID'
                );
            }

            booking.operation_status = BOOKING_OPERATION_STATUS.NORMAL;
            booking.active_incident_id = null;
            incident.status = BOOKING_INCIDENT_STATUS.RESOLVED;
            incident.decision = decision;
            incident.decision_source = decisionSource;
            incident.contact_channel = decisionSource === BOOKING_INCIDENT_DECISION_SOURCES.CUSTOMER
                ? BOOKING_INCIDENT_CONTACT_CHANNELS.APP
                : payload.contact_channel;
            incident.customer_note = normalizeText(payload.customer_note);
            incident.new_start_time = [
                BOOKING_INCIDENT_DECISIONS.RESCHEDULE_NEAREST,
                BOOKING_INCIDENT_DECISIONS.RESCHEDULE_CUSTOM,
            ].includes(decision)
                ? booking.start_time
                : null;
            incident.continuation_policy = payload.continuation_policy || null;
            incident.customer_confirmed_at = resolvedAt;
            incident.decision_recorded_by_id = user._id;
            incident.resolved_at = resolvedAt;
            incident.resolved_by_id = user._id;

            await booking.save({ session });
            await incident.save({ session });

            const outcomeAction = decision === BOOKING_INCIDENT_DECISIONS.CANCEL_BY_GARAGE
                ? AUDIT_ACTIONS.BOOKING_CANCELED_BY_GARAGE
                : [
                    BOOKING_INCIDENT_DECISIONS.RESCHEDULE_NEAREST,
                    BOOKING_INCIDENT_DECISIONS.RESCHEDULE_CUSTOM,
                ].includes(decision)
                    ? AUDIT_ACTIONS.BOOKING_RESCHEDULED_BY_GARAGE
                    : AUDIT_ACTIONS.BOOKING_INCIDENT_RESOLVED;

            await auditLogService.recordAuditEvent({
                actorId: user._id,
                action: outcomeAction,
                resourceType: AUDIT_RESOURCE_TYPES.BOOKING_INCIDENT,
                resourceId: incident._id,
                before,
                after: {
                    booking_status: booking.status,
                    operation_status: booking.operation_status,
                    start_time: booking.start_time,
                    end_time: booking.end_time,
                    incident_status: incident.status,
                    decision,
                    decision_source: decisionSource,
                },
                ip: auditContext.ip,
                userAgent: auditContext.userAgent,
                session,
            });
        });
    } finally {
        await session.endSession();
    }

    for (const bookingItemKey of releasedBookingItemKeys) {
        await bookingServiceStepService.markResourceReleasedForBookingItem(
            booking._id,
            bookingItemKey,
            incident.resolved_at
        );
    }

    if (incident.decision === BOOKING_INCIDENT_DECISIONS.CANCEL_BY_GARAGE) {
        await emitBookingCanceledNotification({
            booking,
            incidentId: incident._id,
        });
    }

    await sendBookingIncidentResolvedNotifications({ booking, incident });

    const [populatedBooking, populatedIncident] = await Promise.all([
        getBookingDocumentById(booking._id),
        populateBookingIncidentQuery(BookingIncident.findById(incident._id)),
    ]);

    return {
        data: {
            booking: BookingMapper.toBookingDto(populatedBooking),
            incident: BookingIncidentMapper.toBookingIncidentDto(populatedIncident),
        },
        released_booking_snapshot: shouldOfferWaitlist
            ? incident.reported_schedule_snapshot
            : null,
    };
};

const recordBookingIncidentCustomerDecision = async (
    user,
    bookingId,
    incidentId,
    payload,
    auditContext = {}
) => resolveBookingIncidentDecision(
    user,
    bookingId,
    incidentId,
    payload,
    BOOKING_INCIDENT_DECISION_SOURCES.STAFF_RECORDED,
    auditContext
);

const resolveMyBookingIncident = async (
    user,
    bookingId,
    incidentId,
    payload,
    auditContext = {}
) => resolveBookingIncidentDecision(
    user,
    bookingId,
    incidentId,
    payload,
    BOOKING_INCIDENT_DECISION_SOURCES.CUSTOMER,
    auditContext
);

const createIncidentCompensationVoucher = async (
    user,
    bookingId,
    incidentId,
    payload,
    auditContext = {}
) => {
    const session = await mongoose.startSession();
    let voucher;

    try {
        await session.withTransaction(async () => {
            const booking = await getRawBookingDocumentById(bookingId, session);

            await assertStaffCanAccessBooking(user, booking);

            if (!booking.customer_id || booking.is_walk_in) {
                throw new AppError(
                    'Compensation voucher requires a registered customer booking',
                    400,
                    'BOOKING_INCIDENT_VOUCHER_CUSTOMER_REQUIRED'
                );
            }

            const incident = await getBookingIncidentDocument(booking._id, incidentId, session);
            const expiresAt = parseDateTime(payload.expires_at, 'expires_at');

            if (expiresAt <= new Date()) {
                throw new AppError(
                    'Voucher expiration time must be in the future',
                    400,
                    'CUSTOMER_VOUCHER_EXPIRATION_INVALID'
                );
            }

            voucher = await customerVoucherService.issueCompensationVoucher({
                user,
                customerId: booking.customer_id,
                garageId: booking.garage_id,
                bookingId: booking._id,
                incidentId: incident._id,
                voucherType: payload.voucher_type,
                value: payload.value,
                maxDiscountAmount: payload.max_discount_amount ?? null,
                minOrderAmount: payload.min_order_amount || 0,
                servicePackageId: payload.service_package_id || null,
                expiresAt,
                note: normalizeText(payload.note),
                session,
            });
            incident.compensation_voucher_ids.push(voucher._id);
            await incident.save({ session });

            await auditLogService.recordAuditEvent({
                actorId: user._id,
                action: AUDIT_ACTIONS.COMPENSATION_VOUCHER_ISSUED,
                resourceType: AUDIT_RESOURCE_TYPES.CUSTOMER_VOUCHER,
                resourceId: voucher._id,
                after: {
                    booking_id: booking._id,
                    incident_id: incident._id,
                    customer_id: booking.customer_id,
                    status: voucher.status,
                    voucher_type: voucher.voucher_type,
                    value: voucher.value,
                },
                ip: auditContext.ip,
                userAgent: auditContext.userAgent,
                session,
            });
        });
    } finally {
        await session.endSession();
    }

    if (voucher.status === 'ISSUED') {
        await notificationService.createInAppNotification({
            userId: voucher.customer_id,
            type: NOTIFICATION_TYPES.COMPENSATION_VOUCHER_ISSUED,
            title: 'Compensation voucher issued',
            message: `The garage issued compensation voucher ${voucher.code}.`,
            relatedType: NOTIFICATION_RELATED_TYPES.BOOKING,
            relatedId: bookingId,
            metadata: {
                voucher_id: voucher._id.toString(),
                incident_id: incidentId,
                code: voucher.code,
                expires_at: voucher.expires_at,
            },
        });
    }

    return CustomerVoucherMapper.toCustomerVoucherDto(voucher);
};


const checkInBooking = async (user, bookingId, { note } = {}, auditContext = {}) => {
    const booking = await getRawBookingDocumentById(bookingId);

    await assertStaffCanAccessBooking(user, booking);
    assertBookingHasNoActiveIncident(booking);
    assertBookingStatusIn(booking, [BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED], 'BOOKING_CHECK_IN_NOT_ALLOWED');

    const garage = await getActiveGarage(booking.garage_id);
    const arrivedAt = booking.arrived_at || new Date();
    const scheduledStartTime = booking.arrival_reference_start_time || booking.start_time;
    const classification = getArrivalClassification({
        arrivedAt,
        scheduledStartTime,
        lateGraceMinutes: garage.late_grace_minutes ?? 15,
    });

    booking.arrived_at = arrivedAt;
    booking.arrival_reference_start_time = scheduledStartTime;
    booking.arrival_status = classification.arrivalStatus;
    booking.late_minutes = classification.lateMinutes;
    booking.grace_exceeded_minutes = classification.graceExceededMinutes;

    if (classification.arrivalStatus !== BOOKING_ARRIVAL_STATUS.LATE) {
        booking.status = BOOKING_STATUS.CHECKED_IN;
        booking.checked_in_at = arrivedAt;
    }

    if (note !== undefined) {
        booking.note = normalizeText(note);
    }

    await booking.save();

    const populatedBooking = await getBookingDocumentById(booking._id);
    const result = BookingMapper.toBookingDto(populatedBooking);

    await auditLogService.recordAuditEvent({
        actorId: user._id,
        action: AUDIT_ACTIONS.BOOKING_ARRIVAL_RECORDED,
        resourceType: AUDIT_RESOURCE_TYPES.BOOKING,
        resourceId: booking._id,
        after: {
            status: result.status,
            arrival_status: result.arrival_status,
            arrived_at: result.arrived_at,
            late_minutes: result.late_minutes,
            grace_exceeded_minutes: result.grace_exceeded_minutes,
        },
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
    });

    return result;
};

const getLateArrivalOptions = async (user, bookingId, { days = 1 } = {}) => {
    const booking = await getRawBookingDocumentById(bookingId);

    await assertStaffCanAccessBooking(user, booking);
    assertBookingHasNoActiveIncident(booking);
    assertBookingStatusIn(
        booking,
        [BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED],
        'BOOKING_LATE_ARRIVAL_OPTIONS_NOT_ALLOWED'
    );

    if (booking.arrival_status !== BOOKING_ARRIVAL_STATUS.LATE || !booking.arrived_at) {
        throw new AppError(
            'Booking does not have a recorded late arrival',
            409,
            'BOOKING_LATE_ARRIVAL_NOT_RECORDED'
        );
    }

    const garage = await getActiveGarage(booking.garage_id);
    const searchStartTime = getLateArrivalSearchStartTime({
        booking,
        garage,
        now: new Date(),
    });
    const candidateDays = buildLateArrivalCandidateDays({
        booking,
        garage,
        searchStartTime,
        days,
    });
    const availabilityDays = await evaluateLateArrivalCandidates({
        booking,
        garage,
        candidateDays,
    });

    return {
        booking_id: booking._id.toString(),
        arrival_status: booking.arrival_status,
        arrived_at: booking.arrived_at,
        arrival_reference_start_time: booking.arrival_reference_start_time,
        late_minutes: booking.late_minutes,
        grace_exceeded_minutes: booking.grace_exceeded_minutes,
        search_start_time: searchStartTime,
        days: availabilityDays,
        suggested_slots: availabilityDays[0]?.suggested_slots || [],
    };
};

const applyShiftedTimeline = ({ booking, timeline }) => {
    if (!booking.original_start_time) {
        booking.original_start_time = booking.start_time;
    }

    if (!booking.original_end_time) {
        booking.original_end_time = booking.end_time;
    }

    booking.booking_date = startOfBookingDate(timeline.start_time);
    booking.start_time = timeline.start_time;
    booking.end_time = timeline.end_time;
    booking.booking_items = timeline.booking_items;
    booking.wash_bay_start_time = timeline.wash_bay_start_time;
    booking.wash_bay_end_time = timeline.wash_bay_end_time;
    booking.wash_bay_work_end_time = timeline.wash_bay_work_end_time;
    booking.wash_bay_reserved_until = timeline.wash_bay_reserved_until;
    booking.care_staff_start_time = timeline.care_staff_start_time;
    booking.care_staff_end_time = timeline.care_staff_end_time;
    booking.care_staff_work_end_time = timeline.care_staff_work_end_time;
    booking.care_staff_reserved_until = timeline.care_staff_reserved_until;
    booking.assigned_care_staff_ids = [];

    if (typeof booking.markModified === 'function') {
        booking.markModified('booking_items');
    }
};

const applyRescheduledTimeline = ({ booking, timeline, user, resolvedAt, reason, note }) => {
    applyShiftedTimeline({ booking, timeline });

    booking.late_resolution = BOOKING_LATE_RESOLUTION.RESCHEDULED;
    booking.late_resolution_note = normalizeText(note);
    booking.rescheduled_at = resolvedAt;
    booking.rescheduled_by_id = user._id;
    booking.reschedule_reason = normalizeText(reason) || 'CUSTOMER_LATE';
    booking.reschedule_count = (booking.reschedule_count || 0) + 1;
    booking.status = BOOKING_STATUS.CHECKED_IN;
    booking.checked_in_at = resolvedAt;
};

const applyEarlyStartTimeline = async ({ booking, user, startedAt }) => {
    if (booking.arrival_status !== BOOKING_ARRIVAL_STATUS.EARLY || !booking.arrived_at) {
        throw new AppError(
            'Booking can only start early after an early arrival check-in',
            409,
            'BOOKING_EARLY_START_NOT_ALLOWED'
        );
    }

    const garage = await getActiveGarage(booking.garage_id);
    const timeline = buildShiftedBookingTimeline({
        booking,
        startTime: startedAt,
    });

    assertBookingInsideGarageBusinessHours(garage, timeline.start_time, getLatestPlannedEnd(timeline));
    await assertVehicleNoOverlap({
        vehicleId: booking.vehicle_id,
        normalizedLicensePlate: booking.normalized_license_plate,
        vehicleType: booking.vehicle_type,
        startTime: timeline.start_time,
        endTime: timeline.end_time,
        excludedBookingId: booking._id,
    });

    applyShiftedTimeline({ booking, timeline });

    booking.rescheduled_at = startedAt;
    booking.rescheduled_by_id = user._id;
    booking.reschedule_reason = 'CUSTOMER_EARLY_REQUEST';
    booking.reschedule_count = (booking.reschedule_count || 0) + 1;
};

const LATE_START_CONFLICT_CODES = new Set([
    'BOOKING_OUTSIDE_BUSINESS_HOURS',
    'VEHICLE_BOOKING_OVERLAP',
    'WASH_BAY_CAPACITY_FULL',
    'WASH_BAY_TEMPORARILY_UNAVAILABLE',
    'NO_ACTIVE_WASH_BAY_FOR_VEHICLE_TYPE',
    'NO_AVAILABLE_WASH_BAY',
    'CARE_STAFF_CAPACITY_FULL',
    'NO_ACTIVE_CARE_STAFF',
]);

const buildLateStartConflictError = (error, startedAt) => {
    if (!LATE_START_CONFLICT_CODES.has(error.errorCode)) {
        return error;
    }

    return new AppError(
        'Resources are unavailable at the actual service start time. Reassign resources or reschedule the booking.',
        409,
        'BOOKING_LATE_START_RESOURCE_CONFLICT',
        [
            {
                reason: 'STAFF_DELAY',
                conflict_code: error.errorCode,
                conflict_message: error.message,
                actual_start_time: startedAt,
                options: ['REASSIGN_RESOURCES', 'RESCHEDULE'],
            },
        ]
    );
};

const toBookingTimelineAuditSnapshot = (booking) => ({
    status: booking.status,
    start_time: booking.start_time,
    end_time: booking.end_time,
    booking_items: (booking.booking_items || []).map((item) => (
        item.toObject ? item.toObject() : { ...item }
    )),
    reschedule_reason: booking.reschedule_reason,
    reschedule_count: booking.reschedule_count || 0,
});

const applyLateStartTimeline = async ({ booking, user, startedAt }) => {
    const garage = await getActiveGarage(booking.garage_id);
    const timeline = buildShiftedBookingTimeline({
        booking,
        startTime: startedAt,
    });

    assertBookingInsideGarageBusinessHours(
        garage,
        timeline.start_time,
        getLatestPlannedEnd(timeline)
    );
    await assertVehicleNoOverlap({
        vehicleId: booking.vehicle_id,
        normalizedLicensePlate: booking.normalized_license_plate,
        vehicleType: booking.vehicle_type,
        startTime: timeline.start_time,
        endTime: timeline.end_time,
        excludedBookingId: booking._id,
    });

    applyShiftedTimeline({ booking, timeline });

    booking.rescheduled_at = startedAt;
    booking.rescheduled_by_id = user._id;
    booking.reschedule_reason = 'STAFF_DELAY';
    booking.reschedule_count = (booking.reschedule_count || 0) + 1;
};

const resolveLateArrival = async (
    user,
    bookingId,
    { resolution, new_start_time, reason, note } = {},
    auditContext = {}
) => {
    const session = await mongoose.startSession();
    let result;

    try {
        await session.withTransaction(async () => {
            const booking = await getRawBookingDocumentById(bookingId, session);

            await assertStaffCanAccessBooking(user, booking);
            assertBookingHasNoActiveIncident(booking);
            assertBookingStatusIn(
                booking,
                [BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED],
                'BOOKING_LATE_ARRIVAL_RESOLUTION_NOT_ALLOWED'
            );

            if (booking.arrival_status !== BOOKING_ARRIVAL_STATUS.LATE || !booking.arrived_at) {
                throw new AppError(
                    'Booking does not have a recorded late arrival',
                    409,
                    'BOOKING_LATE_ARRIVAL_NOT_RECORDED'
                );
            }

            if (booking.late_resolution) {
                throw new AppError(
                    'Late arrival has already been resolved',
                    409,
                    'BOOKING_LATE_ARRIVAL_ALREADY_RESOLVED'
                );
            }

            const resolvedAt = new Date();
            const before = {
                status: booking.status,
                start_time: booking.start_time,
                end_time: booking.end_time,
                booking_items: booking.booking_items,
                late_resolution: booking.late_resolution,
            };

            if (resolution === BOOKING_LATE_RESOLUTION.ACCEPT_WITHIN_ORIGINAL_WINDOW) {
                const originalWindowEnd = getLatestPlannedEnd(booking);

                if (resolvedAt >= originalWindowEnd) {
                    throw new AppError(
                        'Original booking window has already expired',
                        409,
                        'BOOKING_ORIGINAL_WINDOW_EXPIRED'
                    );
                }

                booking.late_resolution = BOOKING_LATE_RESOLUTION.ACCEPT_WITHIN_ORIGINAL_WINDOW;
                booking.late_accepted_by_id = user._id;
                booking.late_accepted_at = resolvedAt;
                booking.late_resolution_note = normalizeText(note);
                booking.status = BOOKING_STATUS.CHECKED_IN;
                booking.checked_in_at = resolvedAt;
            } else {
                const requestedStartTime = parseDateTime(new_start_time, 'new_start_time');
                const garage = await getActiveGarage(booking.garage_id);

                assertBookingStartTimeAligned(garage, requestedStartTime);

                const searchStartTime = getLateArrivalSearchStartTime({
                    booking,
                    garage,
                    now: resolvedAt,
                });
                const targetDate = getLocalDateString(requestedStartTime);
                const searchDate = getLocalDateString(searchStartTime);
                const dayDifference = Math.floor(
                    (parseDateOnly(targetDate).getTime() - parseDateOnly(searchDate).getTime())
                    / (24 * 60 * 60 * 1000)
                );

                if (dayDifference < 0 || dayDifference >= 7 || requestedStartTime < searchStartTime) {
                    throw new AppError(
                        'Selected reschedule time is outside the suggested range',
                        400,
                        'BOOKING_RESCHEDULE_TIME_INVALID'
                    );
                }

                const candidateDays = buildLateArrivalCandidateDays({
                    booking,
                    garage,
                    searchStartTime,
                    days: dayDifference + 1,
                });
                const availabilityDays = await evaluateLateArrivalCandidates({
                    booking,
                    garage,
                    candidateDays,
                });
                const selectedSlot = availabilityDays
                    .flatMap((day) => day.suggested_slots)
                    .find((slot) => slot.start_time.getTime() === requestedStartTime.getTime());

                if (!selectedSlot) {
                    throw new AppError(
                        'Selected slot is no longer available',
                        409,
                        'SLOT_NO_LONGER_AVAILABLE'
                    );
                }

                const timeline = buildShiftedBookingTimeline({
                    booking,
                    startTime: requestedStartTime,
                });

                applyRescheduledTimeline({
                    booking,
                    timeline,
                    user,
                    resolvedAt,
                    reason,
                    note,
                });
            }

            await booking.save({ session });

            const action = resolution === BOOKING_LATE_RESOLUTION.ACCEPT_WITHIN_ORIGINAL_WINDOW
                ? AUDIT_ACTIONS.BOOKING_LATE_ACCEPTED
                : AUDIT_ACTIONS.BOOKING_RESCHEDULED;

            await auditLogService.recordAuditEvent({
                actorId: user._id,
                action,
                resourceType: AUDIT_RESOURCE_TYPES.BOOKING,
                resourceId: booking._id,
                before,
                after: {
                    status: booking.status,
                    start_time: booking.start_time,
                    end_time: booking.end_time,
                    booking_items: booking.booking_items,
                    late_resolution: booking.late_resolution,
                    reschedule_count: booking.reschedule_count,
                },
                ip: auditContext.ip,
                userAgent: auditContext.userAgent,
                session,
            });

            result = booking;
        });
    } finally {
        await session.endSession();
    }

    const populatedBooking = await getBookingDocumentById(result._id);

    return BookingMapper.toBookingDto(populatedBooking);
};

const assignWashBay = async (user, bookingId, { wash_bay_id } = {}) => {
    const booking = await getRawBookingDocumentById(bookingId);

    await assertStaffCanAccessBooking(user, booking);
    assertBookingHasNoActiveIncident(booking);
    assertBookingStatusIn(booking, [BOOKING_STATUS.CHECKED_IN, BOOKING_STATUS.IN_PROGRESS], 'BOOKING_ASSIGN_WASH_BAY_NOT_ALLOWED');

    await assignWashBayToBooking(booking, wash_bay_id || null);

    const populatedBooking = await getBookingDocumentById(booking._id);

    return BookingMapper.toBookingDto(populatedBooking);
};

const createReworkBooking = async ({
    user,
    originalBooking,
    customerCaseId,
    resolutionId,
    servicePackageId,
    startTime: rawStartTime,
    note = null,
}) => {
    const existingRework = await Booking.findOne({ customer_case_resolution_id: resolutionId });
    if (existingRework) return existingRework;

    const now = new Date();
    const [garage, servicePackage] = await Promise.all([
        getActiveGarage(originalBooking.garage_id),
        getActiveServicePackage(servicePackageId),
    ]);
    const startTime = parseDateTime(rawStartTime, 'rework_start_time');
    assertServicePackageMatchesVehicleType(servicePackage, originalBooking.vehicle_type);
    const { serviceItems, addOnServices } = await resolveBookingServiceItems({
        servicePackage,
        addOnServiceIds: [],
        vehicleType: originalBooking.vehicle_type,
    });
    const bookingPlan = buildBookingPlan({ startTime, servicePackage, serviceItems, addOnServices, garage });
    const basePayload = buildBookingBasePayload({
        garage,
        servicePackage,
        bookingPlan,
        startTime,
        vehicleType: originalBooking.vehicle_type,
        note: normalizeText(note) || `Rework for customer case ${customerCaseId}`,
    });
    assertBookingStartTimeInFuture(startTime, now);
    assertBookingStartTimeAligned(garage, startTime);
    assertBookingInsideGarageBusinessHours(garage, basePayload.start_time, getLatestPlannedEnd(basePayload));
    await assertVehicleNoOverlap({
        ...(originalBooking.vehicle_id
            ? { vehicleId: originalBooking.vehicle_id }
            : {
                normalizedLicensePlate: originalBooking.normalized_license_plate,
                vehicleType: originalBooking.vehicle_type,
            }),
        startTime: basePayload.start_time,
        endTime: basePayload.end_time,
    });
    await assertGarageCapacityAvailable({
        garageId: garage._id,
        vehicleType: originalBooking.vehicle_type,
        bookingItems: basePayload.booking_items,
    });
    const payload = {
        ...basePayload,
        customer_id: originalBooking.customer_id,
        vehicle_id: originalBooking.vehicle_id,
        is_walk_in: originalBooking.is_walk_in,
        guest_name: originalBooking.guest_name,
        guest_phone: originalBooking.guest_phone,
        normalized_guest_phone: originalBooking.normalized_guest_phone,
        guest_email: originalBooking.guest_email,
        license_plate: originalBooking.license_plate,
        normalized_license_plate: originalBooking.normalized_license_plate,
        created_by_staff_id: user._id,
        is_rework: true,
        original_booking_id: originalBooking._id,
        customer_case_id: customerCaseId,
        customer_case_resolution_id: resolutionId,
        original_price: 0,
        promotion_discount_amount: 0,
        voucher_discount_amount: 0,
        points_discount_amount: 0,
        discount_amount: 0,
        final_price: 0,
        payment_status: BOOKING_PAYMENT_STATUS.PAID,
        paid_at: now,
        reward_processed: true,
        reward_processed_at: now,
    };
    return createBookingDocument(payload);
};

const getEligibleStaffProfileForAssignment = async (
    staffProfileId,
    garageId,
    staffType
) => {
    const staffProfile = await StaffProfile.findOne({
        _id: staffProfileId,
        garage_id: garageId,
        staff_type: staffType,
        is_active: true,
    });

    if (!staffProfile) {
        throw new AppError(
            'Eligible active staff profile not found in this garage',
            400,
            'STAFF_ASSIGNMENT_NOT_ELIGIBLE'
        );
    }

    return staffProfile;
};

const assignInspectionStaff = async (user, bookingId, staffProfileId) => {
    if (user.role !== USER_ROLES.ADMIN) {
        throw new AppError(
            'Only admin can assign inspection staff',
            403,
            'STAFF_ASSIGNMENT_ADMIN_ONLY'
        );
    }

    const booking = await getRawBookingDocumentById(bookingId);

    await assertStaffCanAccessBooking(user, booking);

    const staffProfile = await getEligibleStaffProfileForAssignment(
        staffProfileId,
        booking.garage_id,
        STAFF_TYPES.VEHICLE_INSPECTION_STAFF
    );

    booking.assigned_inspection_staff_id = getStaffProfileUserId(staffProfile);
    await booking.save();

    return BookingMapper.toBookingDto(await getBookingDocumentById(booking._id));
};

const assignServiceItemStaff = async (
    user,
    bookingId,
    bookingItemKey,
    staffProfileId
) => {
    if (user.role !== USER_ROLES.ADMIN) {
        throw new AppError(
            'Only admin can assign service item staff',
            403,
            'STAFF_ASSIGNMENT_ADMIN_ONLY'
        );
    }

    const booking = await getRawBookingDocumentById(bookingId);

    await assertStaffCanAccessBooking(user, booking);

    const bookingItem = getBookingItemByKey(booking, bookingItemKey);

    if (!bookingItem) {
        throw new AppError(
            'Booking service item not found',
            404,
            'BOOKING_SERVICE_ITEM_NOT_FOUND'
        );
    }

    const requiredStaffType = bookingItem.requires_care_staff
        ? bookingItem.care_staff_type || STAFF_TYPES.VEHICLE_CARE_STAFF
        : (bookingItem.requires_wash_bay ? STAFF_TYPES.WASH_OPERATOR : null);

    if (!requiredStaffType) {
        throw new AppError(
            'Booking service item does not require execution staff',
            400,
            'BOOKING_SERVICE_ITEM_STAFF_NOT_REQUIRED'
        );
    }

    const staffProfile = await getEligibleStaffProfileForAssignment(
        staffProfileId,
        booking.garage_id,
        requiredStaffType
    );
    const assignedAt = new Date();

    if (bookingItem.requires_care_staff) {
        const busyProfileIds = await getActiveAssignedCareStaffProfileIds(
            booking.garage_id,
            requiredStaffType,
            booking._id
        );

        if (busyProfileIds.has(toObjectIdString(staffProfile._id))) {
            throw new AppError(
                'Staff is assigned to another active booking',
                409,
                'STAFF_ASSIGNMENT_CONFLICT'
            );
        }

        bookingItem.assigned_care_staff = bookingItem.assigned_care_staff || [];

        for (const assignment of bookingItem.assigned_care_staff) {
            if (!assignment.released_at) {
                assignment.released_at = assignedAt;
            }
        }

        bookingItem.assigned_care_staff.push({
            staff_profile_id: staffProfile._id,
            user_id: getStaffProfileUserId(staffProfile),
            assigned_at: assignedAt,
            released_at: null,
        });
        syncAssignedCareStaffIds(booking);
    }

    bookingItem.assigned_execution_staff = bookingItem.assigned_execution_staff || [];

    for (const assignment of bookingItem.assigned_execution_staff) {
        if (!assignment.released_at) {
            assignment.released_at = assignedAt;
        }
    }

    bookingItem.assigned_execution_staff.push({
        staff_profile_id: staffProfile._id,
        user_id: getStaffProfileUserId(staffProfile),
        assigned_at: assignedAt,
        released_at: null,
    });
    booking.markModified('booking_items');
    await booking.save();

    await bookingServiceStepService.assignStaffForBookingItem(
        booking._id,
        bookingItem.item_key,
        getStaffProfileUserId(staffProfile)
    );

    return getServiceWorkflow(user, booking._id);
};

const startService = async (
    user,
    bookingId,
    { note, allow_early_start = false } = {},
    auditContext = {}
) => {
    const booking = await getRawBookingDocumentById(bookingId);
    const startedAt = new Date();
    const isLateStart = Boolean(booking.start_time && startedAt > booking.start_time);
    const lateStartBefore = isLateStart
        ? toBookingTimelineAuditSnapshot(booking)
        : null;

    await assertStaffCanAccessBooking(user, booking);
    assertBookingHasNoActiveIncident(booking);
    assertBookingStatusIn(booking, [BOOKING_STATUS.CHECKED_IN], 'BOOKING_START_SERVICE_NOT_ALLOWED');

    try {
        if (booking.start_time && startedAt < booking.start_time) {
            if (allow_early_start) {
                await applyEarlyStartTimeline({
                    booking,
                    user,
                    startedAt,
                });
            } else {
                throw new AppError(
                    'Booking service cannot start before its scheduled time',
                    409,
                    'BOOKING_SERVICE_START_TOO_EARLY'
                );
            }
        } else if (isLateStart) {
            await applyLateStartTimeline({
                booking,
                user,
                startedAt,
            });
        }

        const servicePackage = await getServicePackageForBooking(booking);

        await assertGarageCapacityAvailable({
            garageId: booking.garage_id,
            vehicleType: booking.vehicle_type,
            bookingItems: booking.booking_items || [],
            excludedBookingId: booking._id,
        });

        await assignCareStaffToBookingIfNeeded(booking);
        await assignExecutionStaffToBookingItems(booking);
        await assignWashBayToBookingIfNeeded(booking);

        booking.status = BOOKING_STATUS.IN_PROGRESS;
        booking.started_at = startedAt;

        const firstBookingItem = [...(booking.booking_items || [])]
            .sort((firstItem, secondItem) => firstItem.sequence - secondItem.sequence)
            .find((item) => item.status === BOOKING_ITEM_STATUS.PENDING);

        if (firstBookingItem) {
            startBookingItemCountdown(firstBookingItem, startedAt);

            if (typeof booking.markModified === 'function') {
                booking.markModified('booking_items');
            }
        }

        if (note !== undefined) {
            booking.note = normalizeText(note);
        }

        await booking.save();

        const serviceSteps = await bookingServiceStepService.createStepsForBooking(booking, servicePackage);

        if (firstBookingItem) {
            await recordServiceItemAudit({
                booking,
                bookingItem: firstBookingItem,
                actorId: user._id,
                action: AUDIT_ACTIONS.BOOKING_SERVICE_ITEM_STARTED,
                metadata: {
                    started_automatically: false,
                },
                auditContext,
            });
        }

        if (isLateStart) {
            await auditLogService.recordAuditEvent({
                actorId: user._id,
                action: AUDIT_ACTIONS.BOOKING_SERVICE_START_DELAYED,
                resourceType: AUDIT_RESOURCE_TYPES.BOOKING,
                resourceId: booking._id,
                before: lateStartBefore,
                after: toBookingTimelineAuditSnapshot(booking),
                metadata: {
                    reason: 'STAFF_DELAY',
                    actual_start_time: startedAt,
                },
                ip: auditContext.ip,
                userAgent: auditContext.userAgent,
            });
        }

        const populatedBooking = await getBookingDocumentById(booking._id);

        return {
            booking: BookingMapper.toBookingDto(populatedBooking),
            service_steps: serviceSteps,
        };
    } catch (error) {
        if (isLateStart) {
            const lateStartError = buildLateStartConflictError(error, startedAt);

            if (lateStartError !== error) {
                try {
                    await auditLogService.recordAuditEvent({
                        actorId: user._id,
                        action: AUDIT_ACTIONS.BOOKING_SERVICE_START_DELAYED,
                        resourceType: AUDIT_RESOURCE_TYPES.BOOKING,
                        resourceId: booking._id,
                        before: lateStartBefore,
                        after: {
                            status: BOOKING_STATUS.CHECKED_IN,
                        },
                        metadata: {
                            reason: 'STAFF_DELAY',
                            outcome: 'BLOCKED',
                            conflict_code: error.errorCode,
                            actual_start_time: startedAt,
                            options: ['REASSIGN_RESOURCES', 'RESCHEDULE'],
                        },
                        ip: auditContext.ip,
                        userAgent: auditContext.userAgent,
                    });
                } catch (auditError) {
                    console.warn('[bookings] late-start conflict audit failed', {
                        booking_id: booking._id?.toString?.() || booking._id,
                        error: auditError.message,
                    });
                }
            }

            throw lateStartError;
        }

        throw error;
    }
};

const getBookingServiceSteps = async (user, bookingId) => {
    const booking = await getRawBookingDocumentById(bookingId);

    await assertStaffCanAccessBooking(user, booking);

    return bookingServiceStepService.getStepsByBookingId(booking._id);
};

const markBookingServiceStepDone = async (user, bookingId, stepId, { note } = {}) => {
    const booking = await getRawBookingDocumentById(bookingId);

    await assertStaffCanAccessBooking(user, booking);
    assertBookingHasNoActiveIncident(booking);
    assertBookingStatusIn(booking, [BOOKING_STATUS.IN_PROGRESS], 'BOOKING_SERVICE_STEP_DONE_NOT_ALLOWED');

    const currentBookingItem = getCurrentBookingItem(booking);

    if (currentBookingItem) {
        await assertStaffAssignedToBookingItem(user, currentBookingItem);
    }

    const step = await bookingServiceStepService.markStepDone({
        bookingId: booking._id,
        stepId,
        staffId: user._id,
        note,
        currentBookingItemKey: currentBookingItem?.item_key || null,
    });

    await markBookingItemDoneIfReady(booking, step.booking_item_key, {
        staffId: user._id,
        note,
    });

    return step;
};

const getRemainingServiceItemSeconds = (bookingItem, serverTime = new Date()) => {
    if (!bookingItem) {
        return null;
    }

    if (bookingItem.status === BOOKING_ITEM_STATUS.PAUSED) {
        return bookingItem.remaining_seconds_at_pause || 0;
    }

    if (!bookingItem.countdown_ends_at) {
        return 0;
    }

    return Math.max(
        0,
        Math.ceil((new Date(bookingItem.countdown_ends_at).getTime() - serverTime.getTime()) / 1000)
    );
};

const buildServiceWorkflowDto = ({ booking, serviceSteps = [], serverTime = new Date() }) => {
    const bookingDto = BookingMapper.toBookingDto(booking);
    const currentBookingItem = getCurrentBookingItem(booking);
    const currentBookingItemDto = currentBookingItem
        ? bookingDto.booking_items.find((item) => item.item_key === currentBookingItem.item_key)
        : null;
    const nextBookingItem = currentBookingItem
        ? getNextPendingBookingItem(booking, currentBookingItem)
        : [...(booking.booking_items || [])]
            .sort((firstItem, secondItem) => firstItem.sequence - secondItem.sequence)
            .find((item) => item.status === BOOKING_ITEM_STATUS.PENDING) || null;
    const nextBookingItemDto = nextBookingItem
        ? bookingDto.booking_items.find((item) => item.item_key === nextBookingItem.item_key)
        : null;
    const allServiceItemsDone = (booking.booking_items || []).length > 0
        && (booking.booking_items || []).every((item) => (
            item.status === BOOKING_ITEM_STATUS.DONE
            || item.status === BOOKING_ITEM_STATUS.SKIPPED
        ));
    const blockedByIncident = booking.operation_status === BOOKING_OPERATION_STATUS.AWAITING_CUSTOMER_DECISION
        || Boolean(booking.active_incident_id);

    let workflowPhase = 'NOT_STARTED';

    if (blockedByIncident) {
        workflowPhase = 'INCIDENT_HOLD';
    } else if (booking.status === BOOKING_STATUS.COMPLETED) {
        workflowPhase = 'COMPLETED';
    } else if (currentBookingItem) {
        workflowPhase = 'SERVICE';
    } else if (allServiceItemsDone) {
        workflowPhase = 'POST_SERVICE';
    } else if (booking.status === BOOKING_STATUS.IN_PROGRESS) {
        workflowPhase = 'READY';
    }

    return {
        server_time: serverTime,
        booking_id: booking._id?.toString?.() || booking._id,
        booking_status: booking.status,
        operation_status: booking.operation_status || BOOKING_OPERATION_STATUS.NORMAL,
        blocked_by_incident: blockedByIncident,
        active_incident_id: toObjectIdString(booking.active_incident_id),
        workflow_phase: workflowPhase,
        current_item: currentBookingItemDto,
        next_item: nextBookingItemDto,
        remaining_seconds: getRemainingServiceItemSeconds(currentBookingItem, serverTime),
        all_service_items_done: allServiceItemsDone,
        can_pause: !blockedByIncident && currentBookingItem?.status === BOOKING_ITEM_STATUS.IN_PROGRESS,
        can_resume: !blockedByIncident && currentBookingItem?.status === BOOKING_ITEM_STATUS.PAUSED,
        can_complete_early: !blockedByIncident && [
            BOOKING_ITEM_STATUS.IN_PROGRESS,
            BOOKING_ITEM_STATUS.PAUSED,
        ].includes(currentBookingItem?.status),
        requires_confirmation: currentBookingItem?.status === BOOKING_ITEM_STATUS.AWAITING_CONFIRMATION,
        service_steps: serviceSteps,
    };
};

const getServiceWorkflow = async (user, bookingId) => {
    const booking = await getRawBookingDocumentById(bookingId);

    await assertStaffCanAccessBooking(user, booking);

    const [populatedBooking, serviceSteps] = await Promise.all([
        getBookingDocumentById(booking._id),
        bookingServiceStepService.getStepsByBookingId(booking._id),
    ]);

    return buildServiceWorkflowDto({
        booking: populatedBooking,
        serviceSteps,
        serverTime: new Date(),
    });
};

const assertCurrentBookingItem = (booking, bookingItemKey, allowedStatuses, errorCode) => {
    const bookingItem = getBookingItemByKey(booking, bookingItemKey);
    const currentBookingItem = getCurrentBookingItem(booking);

    if (!bookingItem) {
        throw new AppError('Booking service item not found', 404, 'BOOKING_SERVICE_ITEM_NOT_FOUND');
    }

    if (!currentBookingItem || normalizeBookingItemKey(currentBookingItem.item_key) !== normalizeBookingItemKey(bookingItem.item_key)) {
        throw new AppError(
            'Booking service item is not the current item',
            409,
            'BOOKING_SERVICE_ITEM_NOT_CURRENT'
        );
    }

    if (!allowedStatuses.includes(bookingItem.status)) {
        throw new AppError('Booking service item cannot be processed in current status', 409, errorCode);
    }

    return bookingItem;
};

const assignExecutionStaffToBookingItems = async (booking) => {
    let washOperatorProfiles = null;
    const assignedAt = new Date();

    for (const bookingItem of booking.booking_items || []) {
        if (!bookingItem.requires_wash_bay && !bookingItem.requires_care_staff) {
            continue;
        }

        bookingItem.assigned_execution_staff = bookingItem.assigned_execution_staff || [];
        const activeExecutionAssignments = bookingItem.assigned_execution_staff.filter(
            (assignment) => !assignment.released_at
        );

        if (activeExecutionAssignments.length > 0) {
            continue;
        }

        if (bookingItem.requires_care_staff) {
            const careAssignments = getActiveCareStaffAssignments(bookingItem);

            bookingItem.assigned_execution_staff.push(...careAssignments.map((assignment) => ({
                staff_profile_id: getCareStaffAssignmentStaffProfileId(assignment),
                user_id: assignment.user_id?._id || assignment.user_id,
                assigned_at: assignedAt,
                released_at: null,
            })));
            continue;
        }

        if (washOperatorProfiles === null) {
            washOperatorProfiles = await findActiveCareStaffProfiles(
                booking.garage_id,
                STAFF_TYPES.WASH_OPERATOR
            );
        }

        const selectedProfile = washOperatorProfiles[0];

        if (selectedProfile) {
            bookingItem.assigned_execution_staff.push({
                staff_profile_id: selectedProfile._id,
                user_id: getStaffProfileUserId(selectedProfile),
                assigned_at: assignedAt,
                released_at: null,
            });
        }
    }

    if (typeof booking.markModified === 'function') {
        booking.markModified('booking_items');
    }
};

const assertStaffAssignedToBookingItem = async (user, bookingItem) => {
    if (user.role === USER_ROLES.ADMIN) {
        return null;
    }

    const staffProfile = await getActiveStaffProfile(user._id);
    const requiredStaffType = bookingItem.requires_care_staff
        ? bookingItem.care_staff_type || STAFF_TYPES.VEHICLE_CARE_STAFF
        : (bookingItem.requires_wash_bay ? STAFF_TYPES.WASH_OPERATOR : null);

    if (!requiredStaffType || staffProfile.staff_type !== requiredStaffType) {
        throw new AppError(
            'Staff type is not eligible for this service item',
            403,
            'STAFF_SERVICE_ITEM_TYPE_MISMATCH'
        );
    }

    const assignments = [
        ...(bookingItem.assigned_execution_staff || []),
        ...(bookingItem.assigned_care_staff || []),
    ];

    if (!assignments.some((assignment) => assignmentMatchesStaff(
        assignment,
        staffProfile,
        user
    ))) {
        throw new AppError(
            'Staff must be assigned to this service item',
            403,
            'STAFF_SERVICE_ITEM_ASSIGNMENT_REQUIRED'
        );
    }

    return staffProfile;
};

const completeServiceItemEarly = async (
    user,
    bookingId,
    bookingItemKey,
    { note } = {},
    auditContext = {}
) => {
    const booking = await getRawBookingDocumentById(bookingId);

    await assertStaffCanAccessBooking(user, booking);
    assertBookingHasNoActiveIncident(booking);
    assertBookingStatusIn(booking, [BOOKING_STATUS.IN_PROGRESS], 'BOOKING_SERVICE_ITEM_COMPLETE_NOT_ALLOWED');

    const bookingItem = assertCurrentBookingItem(
        booking,
        bookingItemKey,
        [BOOKING_ITEM_STATUS.IN_PROGRESS, BOOKING_ITEM_STATUS.PAUSED],
        'BOOKING_SERVICE_ITEM_EARLY_COMPLETE_NOT_ALLOWED'
    );

    await assertStaffAssignedToBookingItem(user, bookingItem);

    await completeBookingItemAndAdvance({
        booking,
        bookingItem,
        completionSource: BOOKING_ITEM_COMPLETION_SOURCE.STAFF_EARLY,
        completedAt: new Date(),
        staffId: user._id,
        note,
        auditContext,
    });

    return getServiceWorkflow(user, booking._id);
};

const confirmServiceItemComplete = async (
    user,
    bookingId,
    bookingItemKey,
    { note } = {},
    auditContext = {}
) => {
    const booking = await getRawBookingDocumentById(bookingId);

    await assertStaffCanAccessBooking(user, booking);
    assertBookingHasNoActiveIncident(booking);
    assertBookingStatusIn(booking, [BOOKING_STATUS.IN_PROGRESS], 'BOOKING_SERVICE_ITEM_CONFIRM_NOT_ALLOWED');

    const bookingItem = assertCurrentBookingItem(
        booking,
        bookingItemKey,
        [BOOKING_ITEM_STATUS.AWAITING_CONFIRMATION],
        'BOOKING_SERVICE_ITEM_CONFIRM_NOT_ALLOWED'
    );

    await assertStaffAssignedToBookingItem(user, bookingItem);

    await completeBookingItemAndAdvance({
        booking,
        bookingItem,
        completionSource: BOOKING_ITEM_COMPLETION_SOURCE.STAFF_CONFIRM,
        completedAt: new Date(),
        staffId: user._id,
        note,
        auditContext,
    });

    return getServiceWorkflow(user, booking._id);
};

const pauseServiceItem = async (
    user,
    bookingId,
    bookingItemKey,
    { reason } = {},
    auditContext = {}
) => {
    const booking = await getRawBookingDocumentById(bookingId);

    await assertStaffCanAccessBooking(user, booking);
    assertBookingHasNoActiveIncident(booking);
    assertBookingStatusIn(booking, [BOOKING_STATUS.IN_PROGRESS], 'BOOKING_SERVICE_ITEM_PAUSE_NOT_ALLOWED');

    const bookingItem = assertCurrentBookingItem(
        booking,
        bookingItemKey,
        [BOOKING_ITEM_STATUS.IN_PROGRESS],
        'BOOKING_SERVICE_ITEM_PAUSE_NOT_ALLOWED'
    );
    await assertStaffAssignedToBookingItem(user, bookingItem);
    const pausedAt = new Date();
    const remainingSeconds = getRemainingServiceItemSeconds(bookingItem, pausedAt);

    if (remainingSeconds <= 0) {
        throw new AppError(
            'Service item countdown has already elapsed',
            409,
            'BOOKING_SERVICE_ITEM_COUNTDOWN_ELAPSED'
        );
    }

    const before = {
        status: bookingItem.status,
        countdown_ends_at: bookingItem.countdown_ends_at,
    };

    bookingItem.status = BOOKING_ITEM_STATUS.PAUSED;
    bookingItem.remaining_seconds_at_pause = remainingSeconds;
    bookingItem.paused_at = pausedAt;
    bookingItem.paused_by_staff_id = user._id;
    bookingItem.pause_reason = normalizeText(reason);
    bookingItem.countdown_ends_at = null;
    bookingItem.timer_claimed_at = null;
    bookingItem.timer_claim_token = null;
    booking.markModified('booking_items');
    await booking.save();

    await recordServiceItemAudit({
        booking,
        bookingItem,
        actorId: user._id,
        action: AUDIT_ACTIONS.BOOKING_SERVICE_ITEM_PAUSED,
        before,
        metadata: {
            reason: normalizeText(reason),
            remaining_seconds: remainingSeconds,
        },
        auditContext,
    });

    return getServiceWorkflow(user, booking._id);
};

const resumeServiceItem = async (
    user,
    bookingId,
    bookingItemKey,
    auditContext = {}
) => {
    const booking = await getRawBookingDocumentById(bookingId);

    await assertStaffCanAccessBooking(user, booking);
    assertBookingHasNoActiveIncident(booking);
    assertBookingStatusIn(booking, [BOOKING_STATUS.IN_PROGRESS], 'BOOKING_SERVICE_ITEM_RESUME_NOT_ALLOWED');

    const bookingItem = assertCurrentBookingItem(
        booking,
        bookingItemKey,
        [BOOKING_ITEM_STATUS.PAUSED],
        'BOOKING_SERVICE_ITEM_RESUME_NOT_ALLOWED'
    );
    await assertStaffAssignedToBookingItem(user, bookingItem);
    const resumedAt = new Date();
    const remainingSeconds = bookingItem.remaining_seconds_at_pause;

    if (!remainingSeconds || remainingSeconds < 1) {
        throw new AppError(
            'Paused service item has no remaining countdown',
            409,
            'BOOKING_SERVICE_ITEM_REMAINING_TIME_INVALID'
        );
    }

    const pausedSeconds = bookingItem.paused_at
        ? Math.max(0, Math.ceil((resumedAt.getTime() - new Date(bookingItem.paused_at).getTime()) / 1000))
        : 0;
    const before = {
        status: bookingItem.status,
        remaining_seconds_at_pause: remainingSeconds,
        paused_at: bookingItem.paused_at,
    };

    bookingItem.status = BOOKING_ITEM_STATUS.IN_PROGRESS;
    bookingItem.countdown_ends_at = addSeconds(resumedAt, remainingSeconds);
    bookingItem.remaining_seconds_at_pause = null;
    bookingItem.total_paused_seconds = (bookingItem.total_paused_seconds || 0) + pausedSeconds;
    bookingItem.paused_at = null;
    bookingItem.paused_by_staff_id = null;
    bookingItem.timer_claimed_at = null;
    bookingItem.timer_claim_token = null;
    booking.markModified('booking_items');
    await booking.save();

    await recordServiceItemAudit({
        booking,
        bookingItem,
        actorId: user._id,
        action: AUDIT_ACTIONS.BOOKING_SERVICE_ITEM_RESUMED,
        before,
        metadata: {
            paused_seconds: pausedSeconds,
            countdown_ends_at: bookingItem.countdown_ends_at,
        },
        auditContext,
    });

    return getServiceWorkflow(user, booking._id);
};

const claimDueServiceItemTimer = async (now = new Date()) => {
    const timerClaimToken = randomUUID();
    const staleClaimTime = new Date(now.getTime() - SERVICE_ITEM_TIMER_CLAIM_TIMEOUT_MS);
    const booking = await Booking.findOneAndUpdate(
        {
            status: BOOKING_STATUS.IN_PROGRESS,
            booking_items: {
                $elemMatch: {
                    status: BOOKING_ITEM_STATUS.IN_PROGRESS,
                    countdown_ends_at: { $lte: now },
                    $or: [
                        { timer_claimed_at: null },
                        { timer_claimed_at: { $exists: false } },
                        { timer_claimed_at: { $lte: staleClaimTime } },
                    ],
                },
            },
        },
        {
            $set: {
                'booking_items.$.timer_claimed_at': now,
                'booking_items.$.timer_claim_token': timerClaimToken,
            },
        },
        {
            new: true,
            sort: { 'booking_items.countdown_ends_at': 1 },
        }
    );

    if (!booking) {
        return null;
    }

    const bookingItem = (booking.booking_items || []).find((item) => {
        return item.timer_claim_token === timerClaimToken;
    });

    if (!bookingItem) {
        return null;
    }

    return {
        bookingId: booking._id,
        bookingItemKey: bookingItem.item_key,
        timerClaimToken,
    };
};

const processClaimedServiceItemTimer = async ({
    bookingId,
    bookingItemKey,
    timerClaimToken,
    processedAt = new Date(),
}) => {
    const booking = await getRawBookingDocumentById(bookingId);
    const bookingItem = getBookingItemByKey(booking, bookingItemKey);

    if (
        !bookingItem
        || bookingItem.status !== BOOKING_ITEM_STATUS.IN_PROGRESS
        || bookingItem.timer_claim_token !== timerClaimToken
    ) {
        return {
            skipped: true,
            reason: 'SERVICE_ITEM_TIMER_CLAIM_STALE',
        };
    }

    if (
        !bookingItem.countdown_ends_at
        || new Date(bookingItem.countdown_ends_at).getTime() > processedAt.getTime()
    ) {
        bookingItem.timer_claimed_at = null;
        bookingItem.timer_claim_token = null;
        booking.markModified('booking_items');
        await booking.save();

        return {
            skipped: true,
            reason: 'SERVICE_ITEM_TIMER_NOT_DUE',
        };
    }

    if (bookingItem.transition_mode !== SERVICE_TRANSITION_MODES.AUTO) {
        const before = {
            status: bookingItem.status,
            countdown_ends_at: bookingItem.countdown_ends_at,
        };

        bookingItem.status = BOOKING_ITEM_STATUS.AWAITING_CONFIRMATION;
        bookingItem.countdown_ends_at = null;
        bookingItem.timer_claimed_at = null;
        bookingItem.timer_claim_token = null;
        booking.markModified('booking_items');
        await booking.save();

        await recordServiceItemAudit({
            booking,
            bookingItem,
            action: AUDIT_ACTIONS.BOOKING_SERVICE_ITEM_TIMEOUT,
            before,
            metadata: {
                transition_mode: bookingItem.transition_mode,
            },
        });

        return {
            awaiting_confirmation: true,
            booking_id: booking._id,
            booking_item_key: bookingItem.item_key,
        };
    }

    await completeBookingItemAndAdvance({
        booking,
        bookingItem,
        completionSource: BOOKING_ITEM_COMPLETION_SOURCE.TIMER,
        completedAt: processedAt,
    });

    return {
        auto_completed: true,
        booking_id: booking._id,
        booking_item_key: bookingItem.item_key,
    };
};

const processDueServiceItemTimers = async ({ limit = 50 } = {}) => {
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const result = {
        processed: 0,
        auto_completed: 0,
        awaiting_confirmation: 0,
        failed: 0,
    };

    for (let index = 0; index < safeLimit; index += 1) {
        const claimedTimer = await claimDueServiceItemTimer(new Date());

        if (!claimedTimer) {
            break;
        }

        try {
            const processed = await processClaimedServiceItemTimer({
                ...claimedTimer,
                processedAt: new Date(),
            });

            result.processed += 1;

            if (processed.auto_completed) {
                result.auto_completed += 1;
            }

            if (processed.awaiting_confirmation) {
                result.awaiting_confirmation += 1;
            }
        } catch (error) {
            result.failed += 1;
            console.error('[bookings] service item timer processing failed', {
                booking_id: claimedTimer.bookingId?.toString?.() || claimedTimer.bookingId,
                booking_item_key: claimedTimer.bookingItemKey,
                error: error.message,
            });
        }
    }

    return result;
};


const markPaid = async (user, bookingId, { note } = {}) => {
    await paymentService.resolvePendingPayosPaymentForCash(user, bookingId, {
        reason: 'Staff confirmed cash payment',
    });

    const session = await mongoose.startSession();

    try {
        let response;

        await session.withTransaction(async () => {
            const booking = await Booking.findById(bookingId).session(session);

            if (!booking) {
                throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
            }

            await assertStaffCanAccessBooking(user, booking);
            assertBookingHasNoActiveIncident(booking);
            assertBookingStatusIn(booking, [BOOKING_STATUS.COMPLETED], 'BOOKING_MARK_PAID_NOT_ALLOWED');

            if (
                booking.payment_method === BOOKING_PAYMENT_METHOD.PAYOS
                && booking.payment_status === BOOKING_PAYMENT_STATUS.PENDING
            ) {
                throw new AppError(
                    'Pending PayOS payment could not be resolved for cash payment',
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
    assertBookingHasNoActiveIncident(booking);
    assertBookingStatusIn(booking, [BOOKING_STATUS.IN_PROGRESS], 'BOOKING_COMPLETE_SERVICE_NOT_ALLOWED');

    const unfinishedBookingItem = (booking.booking_items || []).find((item) => (
        item.status !== BOOKING_ITEM_STATUS.DONE
        && item.status !== BOOKING_ITEM_STATUS.SKIPPED
    ));

    if (unfinishedBookingItem) {
        throw new AppError(
            'All booking service items must be completed before completing booking',
            400,
            'BOOKING_SERVICE_ITEMS_NOT_DONE'
        );
    }

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

const reopenCompletedBooking = async (user, bookingId, { note } = {}) => {
    if (user.role !== USER_ROLES.ADMIN) {
        throw new AppError(
            'Only admin can reopen completed booking',
            403,
            'BOOKING_REOPEN_ADMIN_ONLY'
        );
    }

    const booking = await getRawBookingDocumentById(bookingId);

    await assertStaffCanAccessBooking(user, booking);
    assertBookingStatusIn(booking, [BOOKING_STATUS.COMPLETED], 'BOOKING_REOPEN_NOT_ALLOWED');

    if (booking.payment_status !== BOOKING_PAYMENT_STATUS.UNPAID) {
        throw new AppError(
            'Only unpaid completed booking can be reopened',
            409,
            'BOOKING_REOPEN_PAYMENT_NOT_ALLOWED'
        );
    }

    if (booking.reward_processed) {
        throw new AppError(
            'Reward processed booking cannot be reopened',
            409,
            'BOOKING_REOPEN_REWARD_PROCESSED'
        );
    }

    if (booking.paid_at) {
        throw new AppError(
            'Paid booking cannot be reopened',
            409,
            'BOOKING_REOPEN_PAID_AT_EXISTS'
        );
    }

    const completedAt = booking.completed_at;
    const restoredBookingItemKeys = await restoreCareStaffAssignmentsReleasedAt(booking, completedAt);

    await reclaimReleasedWashBayForBooking(booking);

    booking.status = BOOKING_STATUS.IN_PROGRESS;
    booking.completed_at = null;

    if (note !== undefined) {
        booking.note = normalizeText(note);
    }

    await booking.save();

    for (const bookingItemKey of restoredBookingItemKeys) {
        await bookingServiceStepService.clearResourceReleasedForBookingItem(
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
    getBookingById,
    createCustomerBooking,
    createWalkInBooking,
    createReworkBooking,
    cancelMyBooking,
    cancelBooking,
    markNoShow,
    reportBookingIncident,
    getAdminActiveBookingIncident,
    getMyActiveBookingIncident,
    getAdminBookingIncidentOptions,
    recordBookingIncidentCustomerDecision,
    resolveMyBookingIncident,
    createIncidentCompensationVoucher,
    checkInBooking,
    getLateArrivalOptions,
    resolveLateArrival,
    assignWashBay,
    assignInspectionStaff,
    assignServiceItemStaff,
    startService,
    getBookingServiceSteps,
    getServiceWorkflow,
    markBookingServiceStepDone,
    completeServiceItemEarly,
    confirmServiceItemComplete,
    pauseServiceItem,
    resumeServiceItem,
    processDueServiceItemTimers,
    completeService,
    reopenCompletedBooking,
    markPaid,
};
