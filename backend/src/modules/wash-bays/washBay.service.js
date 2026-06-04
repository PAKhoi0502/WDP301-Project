const WashBay = require('./washBay.model');
const WashBayMapper = require('./washBay.mapper');
const Garage = require('../garages/garage.model');
const { AppError } = require('../../shared/utils/appError');
const { VEHICLE_TYPE_VALUES } = require('../../shared/constants/vehicle.constant');
const { WASH_BAY_STATUS, WASH_BAY_MANUAL_STATUS_VALUES } = require('../../shared/constants/washBay.constant');

const normalizeText = (value) => {
    if (typeof value !== 'string') {
        return value;
    }

    return value.trim();
};

const normalizeCode = (value) => {
    if (typeof value !== 'string') {
        return value;
    }

    return value.trim().toUpperCase();
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

const escapeRegExp = (value) => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const normalizeCreatePayload = (payload = {}) => {
    const createPayload = {};

    if (payload.garage_id !== undefined) {
        createPayload.garage_id = normalizeObjectIdOrNull(payload.garage_id);
    }

    if (payload.name !== undefined) {
        createPayload.name = normalizeText(payload.name);
    }

    if (payload.bay_code !== undefined) {
        createPayload.bay_code = normalizeCode(payload.bay_code);
    }

    if (payload.vehicle_type !== undefined) {
        createPayload.vehicle_type = normalizeText(payload.vehicle_type);
    }

    if (payload.status !== undefined) {
        createPayload.status = normalizeText(payload.status);
    }

    if (payload.is_active !== undefined) {
        createPayload.is_active = payload.is_active;
    }

    return createPayload;
};

const normalizeUpdatePayload = (payload = {}) => {
    const updatePayload = {};

    if (payload.garage_id !== undefined) {
        updatePayload.garage_id = normalizeObjectIdOrNull(payload.garage_id);
    }

    if (payload.name !== undefined) {
        updatePayload.name = normalizeText(payload.name);
    }

    if (payload.bay_code !== undefined) {
        updatePayload.bay_code = normalizeCode(payload.bay_code);
    }

    if (payload.vehicle_type !== undefined) {
        updatePayload.vehicle_type = normalizeText(payload.vehicle_type);
    }

    if (payload.is_active !== undefined) {
        updatePayload.is_active = payload.is_active;
    }

    return updatePayload;
};

const buildSearchFilter = ({ search, garage_id, vehicle_type, status, is_active } = {}) => {
    const filter = {};

    if (search) {
        const keyword = escapeRegExp(search.trim());

        filter.$or = [
            { name: { $regex: keyword, $options: 'i' } },
            { bay_code: { $regex: keyword, $options: 'i' } },
        ];
    }

    if (garage_id) {
        filter.garage_id = garage_id;
    }

    if (vehicle_type) {
        filter.vehicle_type = vehicle_type;
    }

    if (status) {
        filter.status = status;
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

const assertVehicleTypeValid = (vehicleType) => {
    if (vehicleType !== undefined && !VEHICLE_TYPE_VALUES.includes(vehicleType)) {
        throw new AppError('Invalid vehicle type', 400, 'INVALID_VEHICLE_TYPE');
    }
};

const assertManualStatusValid = (status) => {
    if (status !== undefined && !WASH_BAY_MANUAL_STATUS_VALUES.includes(status)) {
        throw new AppError('Invalid wash bay status', 400, 'INVALID_WASH_BAY_STATUS');
    }
};

const assertWashBayNotOccupied = (washBay) => {
    if (washBay.status === WASH_BAY_STATUS.OCCUPIED || washBay.current_booking_id) {
        throw new AppError(
            'Wash bay is occupied',
            400,
            'WASH_BAY_OCCUPIED'
        );
    }
};

const getGarageDocument = async (garageId) => {
    const garage = await Garage.findById(garageId);

    if (!garage) {
        throw new AppError('Garage not found', 404, 'GARAGE_NOT_FOUND');
    }

    if (!garage.is_active) {
        throw new AppError('Garage is inactive', 400, 'GARAGE_INACTIVE');
    }

    return garage;
};

const getWashBayDocumentById = async (washBayId) => {
    const washBay = await WashBay.findById(washBayId).populate(
        'garage_id',
        'name garage_code address city is_active'
    );

    if (!washBay) {
        throw new AppError('Wash bay not found', 404, 'WASH_BAY_NOT_FOUND');
    }

    return washBay;
};

const assertBayCodeAvailable = async (garageId, bayCode, ignoredWashBayId = null) => {
    if (!garageId || !bayCode) {
        return;
    }

    const filter = {
        garage_id: garageId,
        bay_code: bayCode,
    };

    if (ignoredWashBayId) {
        filter._id = { $ne: ignoredWashBayId };
    }

    const existed = await WashBay.exists(filter);

    if (existed) {
        throw new AppError(
            'Wash bay code already exists in this garage',
            409,
            'WASH_BAY_CODE_ALREADY_EXISTS'
        );
    }
};

const normalizeStatusByActiveFlag = (payload) => {
    const nextPayload = { ...payload };

    if (nextPayload.is_active === false) {
        nextPayload.status = WASH_BAY_STATUS.INACTIVE;
        nextPayload.current_booking_id = null;
        return nextPayload;
    }

    if (nextPayload.status === WASH_BAY_STATUS.INACTIVE) {
        nextPayload.is_active = false;
        nextPayload.current_booking_id = null;
        return nextPayload;
    }

    if (nextPayload.is_active === true && nextPayload.status === undefined) {
        nextPayload.status = WASH_BAY_STATUS.AVAILABLE;
    }

    if (nextPayload.status === WASH_BAY_STATUS.AVAILABLE || nextPayload.status === WASH_BAY_STATUS.MAINTENANCE) {
        nextPayload.is_active = true;
        nextPayload.current_booking_id = null;
    }

    return nextPayload;
};

const getAllWashBays = async ({ page = 1, limit = 20, search, garage_id, vehicle_type, status, is_active } = {}) => {
    const filter = buildSearchFilter({ search, garage_id, vehicle_type, status, is_active });
    const skip = (page - 1) * limit;

    const [washBays, total] = await Promise.all([
        WashBay.find(filter)
            .populate('garage_id', 'name garage_code address city is_active')
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit),
        WashBay.countDocuments(filter),
    ]);

    return {
        data: WashBayMapper.toWashBayDtoList(washBays),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

const getWashBaysByGarage = async (garageId, { page = 1, limit = 20, search, vehicle_type, status, is_active } = {}) => {
    await getGarageDocument(garageId);

    const filter = buildSearchFilter({
        search,
        garage_id: garageId,
        vehicle_type,
        status,
        is_active,
    });
    const skip = (page - 1) * limit;

    const [washBays, total] = await Promise.all([
        WashBay.find(filter)
            .populate('garage_id', 'name garage_code address city is_active')
            .sort({ bay_code: 1 })
            .skip(skip)
            .limit(limit),
        WashBay.countDocuments(filter),
    ]);

    return {
        data: WashBayMapper.toWashBayDtoList(washBays),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

const getAvailableWashBaysByGarage = async (garageId, { vehicle_type } = {}) => {
    await getGarageDocument(garageId);

    const filter = {
        garage_id: garageId,
        status: WASH_BAY_STATUS.AVAILABLE,
        is_active: true,
        current_booking_id: null,
    };

    if (vehicle_type) {
        filter.vehicle_type = vehicle_type;
    }

    const washBays = await WashBay.find(filter)
        .populate('garage_id', 'name garage_code address city is_active')
        .sort({ vehicle_type: 1, bay_code: 1 });

    return WashBayMapper.toWashBayDtoList(washBays);
};

const getWashBayById = async (washBayId) => {
    const washBay = await getWashBayDocumentById(washBayId);

    return WashBayMapper.toWashBayDto(washBay);
};

const createWashBay = async (payload = {}) => {
    const createPayload = normalizeCreatePayload(
        WashBayMapper.toCreatePayload(payload)
    );

    assertVehicleTypeValid(createPayload.vehicle_type);
    assertManualStatusValid(createPayload.status);
    await getGarageDocument(createPayload.garage_id);
    await assertBayCodeAvailable(createPayload.garage_id, createPayload.bay_code);

    const finalPayload = normalizeStatusByActiveFlag({
        ...createPayload,
        status: createPayload.status || WASH_BAY_STATUS.AVAILABLE,
    });

    const washBay = await WashBay.create(finalPayload);
    const populatedWashBay = await getWashBayDocumentById(washBay._id);

    return WashBayMapper.toWashBayDto(populatedWashBay);
};

const updateWashBay = async (washBayId, payload = {}) => {
    const washBay = await getWashBayDocumentById(washBayId);
    const updatePayload = normalizeUpdatePayload(
        WashBayMapper.toUpdatePayload(payload)
    );

    assertUpdatePayloadNotEmpty(updatePayload);
    assertVehicleTypeValid(updatePayload.vehicle_type);

    const nextGarageId = updatePayload.garage_id || washBay.garage_id._id || washBay.garage_id;
    const nextBayCode = updatePayload.bay_code || washBay.bay_code;

    if (updatePayload.garage_id || updatePayload.vehicle_type || updatePayload.is_active === false) {
        assertWashBayNotOccupied(washBay);
    }

    if (updatePayload.garage_id) {
        await getGarageDocument(updatePayload.garage_id);
    }

    await assertBayCodeAvailable(nextGarageId, nextBayCode, washBayId);

    const finalPayload = normalizeStatusByActiveFlag(updatePayload);

    const updatedWashBay = await WashBay.findByIdAndUpdate(
        washBayId,
        { $set: finalPayload },
        { new: true, runValidators: true }
    ).populate('garage_id', 'name garage_code address city is_active');

    return WashBayMapper.toWashBayDto(updatedWashBay);
};

const updateWashBayStatus = async (washBayId, status) => {
    assertManualStatusValid(status);

    const washBay = await getWashBayDocumentById(washBayId);

    if (washBay.status === status) {
        throw new AppError('Wash bay status is unchanged', 400, 'NO_CHANGE');
    }

    assertWashBayNotOccupied(washBay);

    const finalPayload = normalizeStatusByActiveFlag({ status });

    const updatedWashBay = await WashBay.findByIdAndUpdate(
        washBayId,
        { $set: finalPayload },
        { new: true, runValidators: true }
    ).populate('garage_id', 'name garage_code address city is_active');

    return WashBayMapper.toWashBayDto(updatedWashBay);
};

const deactivateWashBay = async (washBayId) => {
    const washBay = await getWashBayDocumentById(washBayId);

    if (!washBay.is_active && washBay.status === WASH_BAY_STATUS.INACTIVE) {
        throw new AppError('Wash bay is already inactive', 400, 'NO_CHANGE');
    }

    assertWashBayNotOccupied(washBay);

    const updatedWashBay = await WashBay.findByIdAndUpdate(
        washBayId,
        {
            $set: {
                is_active: false,
                status: WASH_BAY_STATUS.INACTIVE,
                current_booking_id: null,
            },
        },
        { new: true, runValidators: true }
    ).populate('garage_id', 'name garage_code address city is_active');

    return WashBayMapper.toWashBayDto(updatedWashBay);
};

module.exports = {
    getAllWashBays,
    getWashBaysByGarage,
    getAvailableWashBaysByGarage,
    getWashBayById,
    createWashBay,
    updateWashBay,
    updateWashBayStatus,
    deactivateWashBay,
};
