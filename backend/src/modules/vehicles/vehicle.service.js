const Vehicle = require('./vehicle.model');
const VehicleMapper = require('./vehicle.mapper');
const User = require('../users/user.model');
const { AppError } = require('../../shared/utils/appError');
const { USER_ROLES } = require('../../shared/constants/roles.constant');
const {
    VEHICLE_TYPES,
    VEHICLE_TYPE_VALUES,
    ENGINE_TYPE_VALUES,
    MOTORBIKE_CC_GROUP_VALUES,
    CAR_BODY_TYPE_VALUES,
} = require('../../shared/constants/vehicle.constant');

const normalizeText = (value) => {
    if (value === null) {
        return '';
    }

    if (typeof value !== 'string') {
        return value;
    }

    return value.trim();
};

const normalizeNullableText = (value) => {
    if (value === null) {
        return null;
    }

    if (typeof value !== 'string') {
        return value;
    }

    const trimmedValue = value.trim();

    if (!trimmedValue) {
        return null;
    }

    return trimmedValue;
};

const normalizeLicensePlate = (value) => {
    if (typeof value !== 'string') {
        return '';
    }

    return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
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

    if (payload.customer_id !== undefined) {
        createPayload.customer_id = normalizeObjectIdOrNull(payload.customer_id);
    }

    if (payload.raw_license_plate !== undefined) {
        createPayload.raw_license_plate = normalizeText(payload.raw_license_plate);
        createPayload.normalized_license_plate = normalizeLicensePlate(payload.raw_license_plate);
    }

    if (payload.vehicle_type !== undefined) {
        createPayload.vehicle_type = normalizeText(payload.vehicle_type);
    }

    if (payload.engine_type !== undefined) {
        createPayload.engine_type = normalizeText(payload.engine_type);
    }

    if (payload.motorbike_cc_group !== undefined) {
        createPayload.motorbike_cc_group = payload.motorbike_cc_group || null;
    }

    if (payload.car_body_type !== undefined) {
        createPayload.car_body_type = payload.car_body_type || null;
    }

    if (payload.seat_count !== undefined) {
        createPayload.seat_count = payload.seat_count || null;
    }

    if (payload.brand !== undefined) {
        createPayload.brand = normalizeText(payload.brand);
    }

    if (payload.model !== undefined) {
        createPayload.model = normalizeText(payload.model);
    }

    if (payload.color !== undefined) {
        createPayload.color = normalizeText(payload.color);
    }

    if (payload.is_default !== undefined) {
        createPayload.is_default = payload.is_default;
    }

    if (payload.is_active !== undefined) {
        createPayload.is_active = payload.is_active;
    }

    return createPayload;
};

const normalizeUpdatePayload = (payload = {}) => {
    const updatePayload = {};

    if (payload.customer_id !== undefined) {
        updatePayload.customer_id = normalizeObjectIdOrNull(payload.customer_id);
    }

    if (payload.raw_license_plate !== undefined) {
        updatePayload.raw_license_plate = normalizeText(payload.raw_license_plate);
        updatePayload.normalized_license_plate = normalizeLicensePlate(payload.raw_license_plate);
    }

    if (payload.vehicle_type !== undefined) {
        updatePayload.vehicle_type = normalizeText(payload.vehicle_type);
    }

    if (payload.engine_type !== undefined) {
        updatePayload.engine_type = normalizeText(payload.engine_type);
    }

    if (payload.motorbike_cc_group !== undefined) {
        updatePayload.motorbike_cc_group = payload.motorbike_cc_group || null;
    }

    if (payload.car_body_type !== undefined) {
        updatePayload.car_body_type = payload.car_body_type || null;
    }

    if (payload.seat_count !== undefined) {
        updatePayload.seat_count = payload.seat_count || null;
    }

    if (payload.brand !== undefined) {
        updatePayload.brand = normalizeNullableText(payload.brand) || '';
    }

    if (payload.model !== undefined) {
        updatePayload.model = normalizeNullableText(payload.model) || '';
    }

    if (payload.color !== undefined) {
        updatePayload.color = normalizeNullableText(payload.color) || '';
    }

    if (payload.is_default !== undefined) {
        updatePayload.is_default = payload.is_default;
    }

    if (payload.is_active !== undefined) {
        updatePayload.is_active = payload.is_active;
    }

    return updatePayload;
};

const buildSearchFilter = ({ search, customer_id, vehicle_type, engine_type, is_active } = {}) => {
    const filter = {};

    if (search) {
        const keyword = escapeRegExp(search.trim());

        filter.$or = [
            { raw_license_plate: { $regex: keyword, $options: 'i' } },
            { normalized_license_plate: { $regex: normalizeLicensePlate(keyword), $options: 'i' } },
            { brand: { $regex: keyword, $options: 'i' } },
            { model: { $regex: keyword, $options: 'i' } },
            { color: { $regex: keyword, $options: 'i' } },
        ];
    }

    if (customer_id) {
        filter.customer_id = customer_id;
    }

    if (vehicle_type) {
        filter.vehicle_type = vehicle_type;
    }

    if (engine_type) {
        filter.engine_type = engine_type;
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

const assertNormalizedLicensePlateValid = (normalizedLicensePlate) => {
    if (!normalizedLicensePlate || normalizedLicensePlate.length < 5 || normalizedLicensePlate.length > 20) {
        throw new AppError(
            'License plate is invalid after normalization',
            400,
            'INVALID_LICENSE_PLATE'
        );
    }
};

const assertEnumValue = (value, validValues, message, errorCode) => {
    if (value !== undefined && value !== null && !validValues.includes(value)) {
        throw new AppError(message, 400, errorCode);
    }
};

const assertVehiclePayloadValid = (payload = {}) => {
    assertEnumValue(payload.vehicle_type, VEHICLE_TYPE_VALUES, 'Invalid vehicle type', 'INVALID_VEHICLE_TYPE');
    assertEnumValue(payload.engine_type, ENGINE_TYPE_VALUES, 'Invalid engine type', 'INVALID_ENGINE_TYPE');
    assertEnumValue(payload.motorbike_cc_group, MOTORBIKE_CC_GROUP_VALUES, 'Invalid motorbike cc group', 'INVALID_MOTORBIKE_CC_GROUP');
    assertEnumValue(payload.car_body_type, CAR_BODY_TYPE_VALUES, 'Invalid car body type', 'INVALID_CAR_BODY_TYPE');
    assertNormalizedLicensePlateValid(payload.normalized_license_plate);

    if (payload.vehicle_type === VEHICLE_TYPES.MOTORBIKE) {
        if (!payload.motorbike_cc_group) {
            throw new AppError(
                'Motorbike cc group is required for motorbike',
                400,
                'MOTORBIKE_CC_GROUP_REQUIRED'
            );
        }

        if (payload.car_body_type || payload.seat_count) {
            throw new AppError(
                'Car fields are not allowed for motorbike',
                400,
                'INVALID_MOTORBIKE_FIELDS'
            );
        }
    }

    if (payload.vehicle_type === VEHICLE_TYPES.CAR) {
        if (!payload.car_body_type) {
            throw new AppError(
                'Car body type is required for car',
                400,
                'CAR_BODY_TYPE_REQUIRED'
            );
        }

        if (
            !Number.isInteger(payload.seat_count)
            || payload.seat_count < 2
            || payload.seat_count > 16
        ) {
            throw new AppError(
                'Seat count from 2 to 16 is required for car',
                400,
                'CAR_SEAT_COUNT_REQUIRED'
            );
        }

        if (payload.motorbike_cc_group) {
            throw new AppError(
                'Motorbike fields are not allowed for car',
                400,
                'INVALID_CAR_FIELDS'
            );
        }
    }
};

const normalizeVehicleTypeSpecificFields = (payload = {}) => {
    const nextPayload = { ...payload };

    if (nextPayload.vehicle_type === VEHICLE_TYPES.MOTORBIKE) {
        nextPayload.car_body_type = null;
        nextPayload.seat_count = null;
    }

    if (nextPayload.vehicle_type === VEHICLE_TYPES.CAR) {
        nextPayload.motorbike_cc_group = null;
    }

    return nextPayload;
};

const getCustomerDocument = async (customerId) => {
    const customer = await User.findById(customerId);

    if (!customer) {
        throw new AppError('Customer not found', 404, 'CUSTOMER_NOT_FOUND');
    }

    if (customer.role !== USER_ROLES.CUSTOMER) {
        throw new AppError('User is not a customer', 400, 'USER_IS_NOT_CUSTOMER');
    }

    if (!customer.is_active) {
        throw new AppError('Customer is inactive', 400, 'CUSTOMER_INACTIVE');
    }

    return customer;
};

const getVehicleDocumentById = async (vehicleId) => {
    const vehicle = await Vehicle.findById(vehicleId).populate(
        'customer_id',
        'full_name email phone role is_active'
    );

    if (!vehicle) {
        throw new AppError('Vehicle not found', 404, 'VEHICLE_NOT_FOUND');
    }

    return vehicle;
};

const assertVehicleOwnership = (vehicle, customerId) => {
    const vehicleCustomerId = vehicle.customer_id?._id || vehicle.customer_id;

    if (!vehicleCustomerId || vehicleCustomerId.toString() !== customerId.toString()) {
        throw new AppError('Vehicle not found', 404, 'VEHICLE_NOT_FOUND');
    }
};

const assertLicensePlateAvailable = async (normalizedLicensePlate, vehicleType, ignoredVehicleId = null) => {
    if (!normalizedLicensePlate || !vehicleType) {
        return;
    }

    const filter = {
        normalized_license_plate: normalizedLicensePlate,
        vehicle_type: vehicleType,
        is_active: true,
    };

    if (ignoredVehicleId) {
        filter._id = { $ne: ignoredVehicleId };
    }

    const existed = await Vehicle.exists(filter);

    if (existed) {
        throw new AppError(
            'License plate already exists in the system',
            409,
            'LICENSE_PLATE_ALREADY_EXISTS'
        );
    }
};

const unsetDefaultVehicles = async (customerId, ignoredVehicleId = null) => {
    const filter = {
        customer_id: customerId,
        is_default: true,
    };

    if (ignoredVehicleId) {
        filter._id = { $ne: ignoredVehicleId };
    }

    await Vehicle.updateMany(filter, { $set: { is_default: false } });
};

const ensureCustomerHasDefaultVehicle = async (customerId) => {
    const defaultVehicle = await Vehicle.exists({
        customer_id: customerId,
        is_active: true,
        is_default: true,
    });

    if (defaultVehicle) {
        return;
    }

    const vehicle = await Vehicle.findOne({
        customer_id: customerId,
        is_active: true,
    }).sort({ created_at: 1 });

    if (vehicle) {
        vehicle.is_default = true;
        await vehicle.save();
    }
};

const buildFinalUpdatePayload = (vehicle, updatePayload) => {
    const currentPayload = {
        customer_id: vehicle.customer_id?._id || vehicle.customer_id,
        raw_license_plate: vehicle.raw_license_plate,
        normalized_license_plate: vehicle.normalized_license_plate,
        vehicle_type: vehicle.vehicle_type,
        engine_type: vehicle.engine_type,
        motorbike_cc_group: vehicle.motorbike_cc_group || null,
        car_body_type: vehicle.car_body_type || null,
        seat_count: vehicle.seat_count || null,
        brand: vehicle.brand || '',
        model: vehicle.model || '',
        color: vehicle.color || '',
        is_default: vehicle.is_default,
        is_active: vehicle.is_active,
    };

    const finalPayload = {
        ...currentPayload,
        ...updatePayload,
    };

    if (updatePayload.raw_license_plate !== undefined && updatePayload.normalized_license_plate === undefined) {
        finalPayload.normalized_license_plate = normalizeLicensePlate(updatePayload.raw_license_plate);
    }

    return normalizeVehicleTypeSpecificFields(finalPayload);
};

const getMyVehicles = async (customerId, { page = 1, limit = 20, search, vehicle_type, engine_type, is_active = true } = {}) => {
    const filter = buildSearchFilter({
        search,
        customer_id: customerId,
        vehicle_type,
        engine_type,
        is_active,
    });
    const skip = (page - 1) * limit;

    const [vehicles, total] = await Promise.all([
        Vehicle.find(filter)
            .populate('customer_id', 'full_name email phone role is_active')
            .sort({ is_default: -1, created_at: -1 })
            .skip(skip)
            .limit(limit),
        Vehicle.countDocuments(filter),
    ]);

    return {
        data: VehicleMapper.toVehicleDtoList(vehicles),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

const getAllVehicles = async ({ page = 1, limit = 20, search, customer_id, vehicle_type, engine_type, is_active } = {}) => {
    const filter = buildSearchFilter({ search, customer_id, vehicle_type, engine_type, is_active });
    const skip = (page - 1) * limit;

    const [vehicles, total] = await Promise.all([
        Vehicle.find(filter)
            .populate('customer_id', 'full_name email phone role is_active')
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit),
        Vehicle.countDocuments(filter),
    ]);

    return {
        data: VehicleMapper.toVehicleDtoList(vehicles),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

const getMyVehicleById = async (customerId, vehicleId) => {
    const vehicle = await getVehicleDocumentById(vehicleId);

    assertVehicleOwnership(vehicle, customerId);

    return VehicleMapper.toVehicleDto(vehicle);
};

const getVehicleById = async (vehicleId) => {
    const vehicle = await getVehicleDocumentById(vehicleId);

    return VehicleMapper.toVehicleDto(vehicle);
};

const createVehicle = async (customerId, payload = {}) => {
    await getCustomerDocument(customerId);

    const createPayload = normalizeCreatePayload(
        VehicleMapper.toCreatePayload(payload)
    );

    createPayload.customer_id = customerId;

    const finalPayload = normalizeVehicleTypeSpecificFields(createPayload);

    assertVehiclePayloadValid(finalPayload);
    await assertLicensePlateAvailable(finalPayload.normalized_license_plate, finalPayload.vehicle_type);

    const activeVehicleCount = await Vehicle.countDocuments({
        customer_id: customerId,
        is_active: true,
    });

    if (activeVehicleCount === 0) {
        finalPayload.is_default = true;
    }

    if (finalPayload.is_default) {
        await unsetDefaultVehicles(customerId);
    }

    const vehicle = await Vehicle.create(finalPayload);
    const populatedVehicle = await getVehicleDocumentById(vehicle._id);

    return VehicleMapper.toVehicleDto(populatedVehicle);
};

const createVehicleForCustomer = async (customerId, payload = {}) => {
    return createVehicle(customerId, payload);
};

const createVehicleByAdmin = async (payload = {}) => {
    const createPayload = normalizeCreatePayload(payload);

    if (!createPayload.customer_id) {
        throw new AppError('Customer is required', 400, 'CUSTOMER_REQUIRED');
    }

    return createVehicleForCustomer(createPayload.customer_id, createPayload);
};

const updateVehicleInternal = async (vehicleId, payload = {}, options = {}) => {
    const vehicle = await getVehicleDocumentById(vehicleId);
    const previousCustomerId = vehicle.customer_id?._id || vehicle.customer_id;
    const updatePayload = normalizeUpdatePayload(
        VehicleMapper.toUpdatePayload(payload)
    );

    assertUpdatePayloadNotEmpty(updatePayload);

    if (options.customerId) {
        assertVehicleOwnership(vehicle, options.customerId);
        delete updatePayload.customer_id;
    }

    const nextPayload = buildFinalUpdatePayload(vehicle, updatePayload);

    if (updatePayload.customer_id !== undefined) {
        await getCustomerDocument(updatePayload.customer_id);
    }

    assertVehiclePayloadValid(nextPayload);

    if (nextPayload.is_active) {
        await assertLicensePlateAvailable(
            nextPayload.normalized_license_plate,
            nextPayload.vehicle_type,
            vehicleId
        );
    }

    if (nextPayload.is_default && nextPayload.is_active) {
        await unsetDefaultVehicles(nextPayload.customer_id, vehicleId);
    }

    if (!nextPayload.is_active) {
        nextPayload.is_default = false;
    }

    const updatedVehicle = await Vehicle.findByIdAndUpdate(
        vehicleId,
        { $set: nextPayload },
        { new: true, runValidators: true }
    ).populate('customer_id', 'full_name email phone role is_active');

    const updatedCustomerId = updatedVehicle.customer_id?._id || updatedVehicle.customer_id;

    if (!updatedVehicle.is_default) {
        await ensureCustomerHasDefaultVehicle(updatedCustomerId);
    }

    if (previousCustomerId.toString() !== updatedCustomerId.toString()) {
        await ensureCustomerHasDefaultVehicle(previousCustomerId);
    }

    return VehicleMapper.toVehicleDto(updatedVehicle);
};

const updateMyVehicle = async (customerId, vehicleId, payload = {}) => {
    return updateVehicleInternal(vehicleId, payload, { customerId });
};

const updateVehicle = async (vehicleId, payload = {}) => {
    return updateVehicleInternal(vehicleId, payload);
};

const deactivateVehicleInternal = async (vehicleId, options = {}) => {
    const vehicle = await getVehicleDocumentById(vehicleId);

    if (options.customerId) {
        assertVehicleOwnership(vehicle, options.customerId);
    }

    if (!vehicle.is_active) {
        throw new AppError('Vehicle is already inactive', 400, 'NO_CHANGE');
    }

    const customerId = vehicle.customer_id?._id || vehicle.customer_id;

    const updatedVehicle = await Vehicle.findByIdAndUpdate(
        vehicleId,
        {
            $set: {
                is_active: false,
                is_default: false,
            },
        },
        { new: true, runValidators: true }
    ).populate('customer_id', 'full_name email phone role is_active');

    await ensureCustomerHasDefaultVehicle(customerId);

    return VehicleMapper.toVehicleDto(updatedVehicle);
};

const deactivateMyVehicle = async (customerId, vehicleId) => {
    return deactivateVehicleInternal(vehicleId, { customerId });
};

const deactivateVehicle = async (vehicleId) => {
    return deactivateVehicleInternal(vehicleId);
};

module.exports = {
    normalizeLicensePlate,
    getMyVehicles,
    getAllVehicles,
    getMyVehicleById,
    getVehicleById,
    createVehicle,
    createVehicleByAdmin,
    updateMyVehicle,
    updateVehicle,
    deactivateMyVehicle,
    deactivateVehicle,
};
