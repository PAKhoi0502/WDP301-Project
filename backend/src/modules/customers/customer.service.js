const mongoose = require('mongoose');

const Booking = require('../bookings/booking.model');
const StaffProfile = require('../staff-profiles/staffProfile.model');
const CustomerMapper = require('./customer.mapper');
const { AppError } = require('../../shared/utils/appError');
const { USER_ROLES } = require('../../shared/constants/roles.constant');
const { normalizePhone } = require('../../shared/utils/phone');

const toObjectId = (value) => {
    if (value instanceof mongoose.Types.ObjectId) {
        return value;
    }

    return new mongoose.Types.ObjectId(value);
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

const resolveGarageId = async (user, requestedGarageId) => {
    if (user.role === USER_ROLES.ADMIN) {
        if (!requestedGarageId) {
            throw new AppError('garage_id is required', 400, 'GARAGE_ID_REQUIRED');
        }

        return requestedGarageId;
    }

    const staffProfile = await getActiveStaffProfile(user._id);

    if (!staffProfile.garage_id) {
        throw new AppError('Staff is not assigned to any garage', 403, 'STAFF_GARAGE_NOT_ASSIGNED');
    }

    if (requestedGarageId && staffProfile.garage_id.toString() !== requestedGarageId.toString()) {
        throw new AppError('Staff cannot access customers outside assigned garage', 403, 'STAFF_GARAGE_ACCESS_DENIED');
    }

    return staffProfile.garage_id;
};

const buildCustomerSearchMatch = (search) => {
    if (!search) {
        return null;
    }

    const trimmedSearch = search.trim();

    if (!trimmedSearch) {
        return null;
    }

    const keyword = escapeRegExp(trimmedSearch);
    const normalizedPlate = normalizeLicensePlate(trimmedSearch);
    const normalizedPhone = normalizePhone(trimmedSearch);
    const conditions = [
        { 'customer.full_name': { $regex: keyword, $options: 'i' } },
        { 'customer.email': { $regex: keyword, $options: 'i' } },
        { 'customer.phone': { $regex: keyword, $options: 'i' } },
        { 'vehicles.raw_license_plate': { $regex: keyword, $options: 'i' } },
    ];

    if (normalizedPhone && normalizedPhone !== trimmedSearch) {
        conditions.push({
            'customer.phone': { $regex: escapeRegExp(normalizedPhone), $options: 'i' },
        });
    }

    if (normalizedPlate) {
        conditions.push({
            'vehicles.normalized_license_plate': { $regex: escapeRegExp(normalizedPlate), $options: 'i' },
        });
    }

    return {
        $match: {
            $or: conditions,
        },
    };
};

const buildCustomerAggregationPipeline = ({ garageId, search } = {}) => {
    const pipeline = [
        {
            $match: {
                garage_id: toObjectId(garageId),
                customer_id: { $ne: null },
                is_walk_in: false,
            },
        },
        {
            $group: {
                _id: '$customer_id',
                last_booking_at: { $max: '$start_time' },
                total_bookings_at_garage: { $sum: 1 },
            },
        },
        {
            $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: '_id',
                as: 'customer',
            },
        },
        { $unwind: '$customer' },
        {
            $match: {
                'customer.role': USER_ROLES.CUSTOMER,
                'customer.is_active': true,
            },
        },
        {
            $lookup: {
                from: 'vehicles',
                let: { customerId: '$_id' },
                pipeline: [
                    {
                        $match: {
                            $expr: { $eq: ['$customer_id', '$$customerId'] },
                            is_active: true,
                        },
                    },
                    {
                        $project: {
                            raw_license_plate: 1,
                            normalized_license_plate: 1,
                            vehicle_type: 1,
                        },
                    },
                ],
                as: 'vehicles',
            },
        },
    ];
    const searchMatch = buildCustomerSearchMatch(search);

    if (searchMatch) {
        pipeline.push(searchMatch);
    }

    return pipeline;
};

const searchAdminCustomers = async (user, query = {}) => {
    const { page = 1, limit = 20, search } = query;
    const garageId = await resolveGarageId(user, query.garage_id);
    const skip = (page - 1) * limit;
    const basePipeline = buildCustomerAggregationPipeline({ garageId, search });

    const [customers, totalResult] = await Promise.all([
        Booking.aggregate([
            ...basePipeline,
            { $sort: { last_booking_at: -1, _id: 1 } },
            { $skip: skip },
            { $limit: limit },
            {
                $project: {
                    customer_id: '$_id',
                    customer: {
                        full_name: '$customer.full_name',
                        phone: '$customer.phone',
                        email: '$customer.email',
                    },
                    vehicles: 1,
                    last_booking_at: 1,
                    total_bookings_at_garage: 1,
                },
            },
        ]),
        Booking.aggregate([
            ...basePipeline,
            { $count: 'total' },
        ]),
    ]);
    const total = totalResult[0]?.total || 0;

    return {
        data: CustomerMapper.toAdminCustomerSuggestionDtoList(customers),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

module.exports = {
    searchAdminCustomers,
};
