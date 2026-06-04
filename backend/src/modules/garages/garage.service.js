const Garage = require('./garage.model');
const GarageMapper = require('./garage.mapper');
const { AppError } = require('../../shared/utils/appError');

const normalizeText = (value) => {
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

const normalizeGarageCode = (garageCode) => {
    if (typeof garageCode !== 'string') {
        return garageCode;
    }

    return garageCode.trim().toUpperCase();
};

const normalizeEmail = (email) => {
    if (typeof email !== 'string') {
        return email;
    }

    const trimmedEmail = email.trim().toLowerCase();

    return trimmedEmail || null;
};

const escapeRegExp = (value) => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const normalizeNumberOrNull = (value) => {
    if (value === undefined) {
        return undefined;
    }

    if (value === null || value === '') {
        return null;
    }

    return value;
};

const normalizeCreatePayload = (payload = {}) => {
    const createPayload = {};

    if (payload.name !== undefined) {
        createPayload.name = normalizeRequiredText(payload.name);
    }

    if (payload.garage_code !== undefined) {
        createPayload.garage_code = normalizeGarageCode(payload.garage_code);
    }

    if (payload.address !== undefined) {
        createPayload.address = normalizeRequiredText(payload.address);
    }

    if (payload.ward !== undefined) {
        createPayload.ward = normalizeText(payload.ward);
    }

    if (payload.district !== undefined) {
        createPayload.district = normalizeText(payload.district);
    }

    if (payload.city !== undefined) {
        createPayload.city = normalizeText(payload.city);
    }

    if (payload.phone !== undefined) {
        createPayload.phone = normalizeText(payload.phone);
    }

    if (payload.email !== undefined) {
        createPayload.email = normalizeEmail(payload.email);
    }

    if (payload.latitude !== undefined) {
        createPayload.latitude = normalizeNumberOrNull(payload.latitude);
    }

    if (payload.longitude !== undefined) {
        createPayload.longitude = normalizeNumberOrNull(payload.longitude);
    }

    if (payload.opening_time !== undefined) {
        createPayload.opening_time = normalizeRequiredText(payload.opening_time);
    }

    if (payload.closing_time !== undefined) {
        createPayload.closing_time = normalizeRequiredText(payload.closing_time);
    }

    if (payload.slot_interval_minutes !== undefined) {
        createPayload.slot_interval_minutes = payload.slot_interval_minutes;
    }

    if (payload.description !== undefined) {
        createPayload.description = normalizeText(payload.description);
    }

    if (payload.is_active !== undefined) {
        createPayload.is_active = payload.is_active;
    }

    return createPayload;
};

const normalizeUpdatePayload = (payload = {}) => {
    const updatePayload = {};

    if (payload.name !== undefined) {
        updatePayload.name = normalizeRequiredText(payload.name);
    }

    if (payload.garage_code !== undefined) {
        updatePayload.garage_code = normalizeGarageCode(payload.garage_code);
    }

    if (payload.address !== undefined) {
        updatePayload.address = normalizeRequiredText(payload.address);
    }

    if (payload.ward !== undefined) {
        updatePayload.ward = normalizeText(payload.ward);
    }

    if (payload.district !== undefined) {
        updatePayload.district = normalizeText(payload.district);
    }

    if (payload.city !== undefined) {
        updatePayload.city = normalizeText(payload.city);
    }

    if (payload.phone !== undefined) {
        updatePayload.phone = normalizeText(payload.phone);
    }

    if (payload.email !== undefined) {
        updatePayload.email = normalizeEmail(payload.email);
    }

    if (payload.latitude !== undefined) {
        updatePayload.latitude = normalizeNumberOrNull(payload.latitude);
    }

    if (payload.longitude !== undefined) {
        updatePayload.longitude = normalizeNumberOrNull(payload.longitude);
    }

    if (payload.opening_time !== undefined) {
        updatePayload.opening_time = normalizeRequiredText(payload.opening_time);
    }

    if (payload.closing_time !== undefined) {
        updatePayload.closing_time = normalizeRequiredText(payload.closing_time);
    }

    if (payload.slot_interval_minutes !== undefined) {
        updatePayload.slot_interval_minutes = payload.slot_interval_minutes;
    }

    if (payload.description !== undefined) {
        updatePayload.description = normalizeText(payload.description);
    }

    if (payload.is_active !== undefined) {
        updatePayload.is_active = payload.is_active;
    }

    return updatePayload;
};

const timeToMinutes = (time) => {
    const [hour, minute] = time.split(':').map(Number);

    return hour * 60 + minute;
};

const assertBusinessHourRangeValid = (openingTime, closingTime) => {
    if (!openingTime || !closingTime) {
        return;
    }

    if (timeToMinutes(openingTime) >= timeToMinutes(closingTime)) {
        throw new AppError(
            'Opening time must be before closing time',
            400,
            'INVALID_BUSINESS_HOUR_RANGE'
        );
    }
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

const buildSearchFilter = ({ search, city, district, is_active } = {}) => {
    const filter = {};

    if (search) {
        const keyword = escapeRegExp(search.trim());

        filter.$or = [
            { name: { $regex: keyword, $options: 'i' } },
            { garage_code: { $regex: keyword, $options: 'i' } },
            { address: { $regex: keyword, $options: 'i' } },
            { phone: { $regex: keyword, $options: 'i' } },
        ];
    }

    if (city) {
        filter.city = { $regex: `^${escapeRegExp(city.trim())}$`, $options: 'i' };
    }

    if (district) {
        filter.district = { $regex: `^${escapeRegExp(district.trim())}$`, $options: 'i' };
    }

    if (is_active !== undefined) {
        filter.is_active = is_active;
    }

    return filter;
};

const getGarageDocumentById = async (garageId) => {
    const garage = await Garage.findById(garageId);

    if (!garage) {
        throw new AppError('Garage not found', 404, 'GARAGE_NOT_FOUND');
    }

    return garage;
};

const assertGarageCodeAvailable = async (garageCode, ignoredGarageId = null) => {
    if (!garageCode) {
        return;
    }

    const filter = { garage_code: garageCode };

    if (ignoredGarageId) {
        filter._id = { $ne: ignoredGarageId };
    }

    const existed = await Garage.exists(filter);

    if (existed) {
        throw new AppError(
            'Garage code already exists',
            409,
            'GARAGE_CODE_ALREADY_EXISTS'
        );
    }
};

const getPublicGarages = async ({ page = 1, limit = 20, search, city, district } = {}) => {
    const filter = buildSearchFilter({ search, city, district, is_active: true });
    const skip = (page - 1) * limit;

    const [garages, total] = await Promise.all([
        Garage.find(filter)
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit),
        Garage.countDocuments(filter),
    ]);

    return {
        data: GarageMapper.toGarageDtoList(garages),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

const getPublicGarageById = async (garageId) => {
    const garage = await Garage.findOne({ _id: garageId, is_active: true });

    if (!garage) {
        throw new AppError('Garage not found', 404, 'GARAGE_NOT_FOUND');
    }

    return GarageMapper.toGarageDto(garage);
};

const getAllGarages = async ({ page = 1, limit = 20, search, city, district, is_active } = {}) => {
    const filter = buildSearchFilter({ search, city, district, is_active });
    const skip = (page - 1) * limit;

    const [garages, total] = await Promise.all([
        Garage.find(filter)
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit),
        Garage.countDocuments(filter),
    ]);

    return {
        data: GarageMapper.toGarageDtoList(garages),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

const getGarageById = async (garageId) => {
    const garage = await getGarageDocumentById(garageId);

    return GarageMapper.toGarageDto(garage);
};

const createGarage = async (payload = {}) => {
    const createPayload = normalizeCreatePayload(
        GarageMapper.toCreatePayload(payload)
    );

    assertBusinessHourRangeValid(
        createPayload.opening_time || '07:00',
        createPayload.closing_time || '18:00'
    );
    await assertGarageCodeAvailable(createPayload.garage_code);

    const garage = await Garage.create(createPayload);

    return GarageMapper.toGarageDto(garage);
};

const updateGarage = async (garageId, payload = {}) => {
    const garage = await getGarageDocumentById(garageId);
    const updatePayload = normalizeUpdatePayload(
        GarageMapper.toUpdatePayload(payload)
    );

    assertUpdatePayloadNotEmpty(updatePayload);

    const nextOpeningTime = updatePayload.opening_time || garage.opening_time;
    const nextClosingTime = updatePayload.closing_time || garage.closing_time;

    assertBusinessHourRangeValid(nextOpeningTime, nextClosingTime);
    await assertGarageCodeAvailable(updatePayload.garage_code, garageId);

    const updatedGarage = await Garage.findByIdAndUpdate(
        garageId,
        { $set: updatePayload },
        { new: true, runValidators: true }
    );

    return GarageMapper.toGarageDto(updatedGarage);
};

const updateGarageStatus = async (garageId, isActive) => {
    const garage = await getGarageDocumentById(garageId);

    if (garage.is_active === isActive) {
        throw new AppError('Garage status is unchanged', 400, 'NO_CHANGE');
    }

    const updatedGarage = await Garage.findByIdAndUpdate(
        garageId,
        { $set: { is_active: isActive } },
        { new: true, runValidators: true }
    );

    return GarageMapper.toGarageDto(updatedGarage);
};

module.exports = {
    getPublicGarages,
    getPublicGarageById,
    getAllGarages,
    getGarageById,
    createGarage,
    updateGarage,
    updateGarageStatus,
};
