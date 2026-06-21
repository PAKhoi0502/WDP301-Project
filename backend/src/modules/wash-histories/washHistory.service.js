const WashHistory = require('./washHistory.model');
const StaffProfile = require('../staff-profiles/staffProfile.model');
const WashHistoryMapper = require('./washHistory.mapper');
const { AppError } = require('../../shared/utils/appError');
const { USER_ROLES } = require('../../shared/constants/roles.constant');

const buildDateRangeFilter = ({ from, to } = {}) => {
    if (!from && !to) {
        return null;
    }

    const range = {};

    if (from) {
        range.$gte = new Date(from);
    }

    if (to) {
        range.$lte = new Date(to);
    }

    return range;
};

const buildWashHistoryFilter = ({ customer_id, vehicle_id, garage_id, service_package_id, vehicle_type, from, to } = {}) => {
    const filter = {};
    const paidAtRange = buildDateRangeFilter({ from, to });

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

    if (paidAtRange) {
        filter.paid_at = paidAtRange;
    }

    return filter;
};

const populateWashHistoryQuery = (query) => {
    return query
        .populate('booking_id', 'booking_date start_time end_time status payment_status')
        .populate('customer_id', 'full_name email phone role is_active')
        .populate('vehicle_id', 'raw_license_plate normalized_license_plate vehicle_type engine_type brand model color is_active')
        .populate('garage_id', 'name garage_code address city is_active')
        .populate('wash_bay_id', 'name bay_code vehicle_type status is_active')
        .populate('service_package_id', 'name vehicle_type service_type base_price duration_minutes requires_wash_bay is_active');
};

const getWashHistoryDocumentById = async (washHistoryId) => {
    const washHistory = await populateWashHistoryQuery(WashHistory.findById(washHistoryId));

    if (!washHistory) {
        throw new AppError('Wash history not found', 404, 'WASH_HISTORY_NOT_FOUND');
    }

    return washHistory;
};

const getActiveStaffProfile = async (staffUserId) => {
    const staffProfile = await StaffProfile.findOne({
        user_id: staffUserId,
        is_active: true,
    });

    if (!staffProfile) {
        throw new AppError('Staff profile not found', 403, 'STAFF_PROFILE_NOT_FOUND');
    }

    return staffProfile;
};

const getAdminGarageFilter = async (user, requestedGarageId) => {
    if (!user || user.role === USER_ROLES.ADMIN) {
        return requestedGarageId || undefined;
    }

    const staffProfile = await getActiveStaffProfile(user._id);

    if (!staffProfile.garage_id) {
        throw new AppError('Staff is not assigned to any garage', 403, 'STAFF_GARAGE_NOT_ASSIGNED');
    }

    if (requestedGarageId && staffProfile.garage_id.toString() !== requestedGarageId.toString()) {
        throw new AppError('Staff cannot access wash histories outside assigned garage', 403, 'STAFF_GARAGE_ACCESS_DENIED');
    }

    return staffProfile.garage_id;
};

const getAdminWashHistoryDocumentById = async (user, washHistoryId) => {
    if (!user || user.role === USER_ROLES.ADMIN) {
        return getWashHistoryDocumentById(washHistoryId);
    }

    const garageId = await getAdminGarageFilter(user);
    const washHistory = await populateWashHistoryQuery(WashHistory.findOne({
        _id: washHistoryId,
        garage_id: garageId,
    }));

    if (!washHistory) {
        throw new AppError('Wash history not found', 404, 'WASH_HISTORY_NOT_FOUND');
    }

    return washHistory;
};

const getMyWashHistories = async (customerId, { page = 1, limit = 20, vehicle_id, garage_id, service_package_id, vehicle_type, from, to } = {}) => {
    const filter = buildWashHistoryFilter({
        customer_id: customerId,
        vehicle_id,
        garage_id,
        service_package_id,
        vehicle_type,
        from,
        to,
    });
    const skip = (page - 1) * limit;

    const [washHistories, total] = await Promise.all([
        populateWashHistoryQuery(WashHistory.find(filter))
            .sort({ paid_at: -1, created_at: -1 })
            .skip(skip)
            .limit(limit),
        WashHistory.countDocuments(filter),
    ]);

    return {
        data: WashHistoryMapper.toWashHistoryDtoList(washHistories),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

const getMyWashHistoryById = async (customerId, washHistoryId) => {
    const washHistory = await populateWashHistoryQuery(WashHistory.findOne({
        _id: washHistoryId,
        customer_id: customerId,
    }));

    if (!washHistory) {
        throw new AppError('Wash history not found', 404, 'WASH_HISTORY_NOT_FOUND');
    }

    return WashHistoryMapper.toWashHistoryDto(washHistory);
};

const getAllWashHistories = async (userOrQuery = {}, queryArg = null) => {
    const hasUserContext = userOrQuery && userOrQuery.role;
    const user = hasUserContext ? userOrQuery : null;
    const query = hasUserContext ? queryArg || {} : userOrQuery || {};
    const { page = 1, limit = 20, customer_id, vehicle_id, service_package_id, vehicle_type, from, to } = query;
    const garage_id = await getAdminGarageFilter(user, query.garage_id);
    const filter = buildWashHistoryFilter({
        customer_id,
        vehicle_id,
        garage_id,
        service_package_id,
        vehicle_type,
        from,
        to,
    });
    const skip = (page - 1) * limit;

    const [washHistories, total] = await Promise.all([
        populateWashHistoryQuery(WashHistory.find(filter))
            .sort({ paid_at: -1, created_at: -1 })
            .skip(skip)
            .limit(limit),
        WashHistory.countDocuments(filter),
    ]);

    return {
        data: WashHistoryMapper.toWashHistoryDtoList(washHistories),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

const getWashHistoryById = async (userOrWashHistoryId, washHistoryIdArg = null) => {
    const hasUserContext = userOrWashHistoryId && userOrWashHistoryId.role;
    const user = hasUserContext ? userOrWashHistoryId : null;
    const washHistoryId = hasUserContext ? washHistoryIdArg : userOrWashHistoryId;
    const washHistory = await getAdminWashHistoryDocumentById(user, washHistoryId);

    return WashHistoryMapper.toWashHistoryDto(washHistory);
};

const createWashHistoryFromBooking = async ({ booking, earnedPoints = 0, session = null }) => {
    const existingQuery = WashHistory.findOne({ booking_id: booking._id });

    if (session) {
        existingQuery.session(session);
    }

    const existingWashHistory = await existingQuery;

    if (existingWashHistory) {
        return WashHistoryMapper.toWashHistoryDto(existingWashHistory);
    }

    const documents = await WashHistory.create(
        [
            {
                booking_id: booking._id,
                customer_id: booking.customer_id || booking.claimed_customer_id || null,
                vehicle_id: booking.vehicle_id || null,
                garage_id: booking.garage_id,
                wash_bay_id: booking.wash_bay_id || null,
                service_package_id: booking.service_package_id,
                vehicle_type: booking.vehicle_type,
                amount_paid: booking.final_price,
                original_price: booking.original_price,
                discount_amount: booking.discount_amount,
                points_earned: earnedPoints,
                points_used: booking.used_points || 0,
                payment_method: booking.payment_method,
                paid_at: booking.paid_at || new Date(),
                service_started_at: booking.started_at || null,
                service_completed_at: booking.completed_at,
            },
        ],
        session ? { session } : undefined
    );

    return WashHistoryMapper.toWashHistoryDto(documents[0]);
};

module.exports = {
    getMyWashHistories,
    getMyWashHistoryById,
    getAllWashHistories,
    getWashHistoryById,
    createWashHistoryFromBooking,
};
