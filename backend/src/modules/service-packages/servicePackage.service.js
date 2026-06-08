const mongoose = require('mongoose');

const ServicePackage = require('./servicePackage.model');
const ServicePackageMapper = require('./servicePackage.mapper');
const washBayService = require('../wash-bays/washBay.service');
const { AppError } = require('../../shared/utils/appError');
const { SERVICE_PACKAGE_TYPES } = require('../../shared/constants/servicePackage.constant');
const { STAFF_TYPES } = require('../../shared/constants/staff.constant');

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

const normalizeCode = (value) => {
    if (typeof value !== 'string') {
        return value;
    }

    return value.trim().toUpperCase();
};

const escapeRegExp = (value) => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const normalizeStepTemplate = (steps = []) => {
    return steps
        .map((step) => ({
            step_code: normalizeCode(step.step_code),
            step_name: normalizeRequiredText(step.step_name),
            order: step.order,
            step_type: step.step_type,
            is_required: step.is_required !== undefined ? step.is_required : true,
            display_staff_type: step.display_staff_type || null,
            instructions: (step.instructions || []).map((item) => normalizeRequiredText(item)),
        }))
        .sort((firstStep, secondStep) => firstStep.order - secondStep.order);
};

const normalizeObjectIdList = (values = []) => {
    const ids = values.map((value) => {
        if (value && value._id) {
            return value._id.toString();
        }

        return value.toString();
    });

    return [...new Set(ids)].map((value) => new mongoose.Types.ObjectId(value));
};

const normalizeBasePayload = (payload = {}) => {
    const normalizedPayload = {};

    if (payload.name !== undefined) {
        normalizedPayload.name = normalizeRequiredText(payload.name);
    }

    if (payload.vehicle_type !== undefined) {
        normalizedPayload.vehicle_type = payload.vehicle_type;
    }

    if (payload.service_type !== undefined) {
        normalizedPayload.service_type = payload.service_type;
    }

    if (payload.description !== undefined) {
        normalizedPayload.description = normalizeText(payload.description);
    }

    if (payload.base_price !== undefined) {
        normalizedPayload.base_price = payload.base_price;
    }

    if (payload.duration_minutes !== undefined) {
        normalizedPayload.duration_minutes = payload.duration_minutes;
    }

    if (payload.wash_bay_duration_minutes !== undefined) {
        normalizedPayload.wash_bay_duration_minutes = payload.wash_bay_duration_minutes;
    }

    if (payload.wash_bay_start_offset_minutes !== undefined) {
        normalizedPayload.wash_bay_start_offset_minutes = payload.wash_bay_start_offset_minutes;
    }

    if (payload.points_earned !== undefined) {
        normalizedPayload.points_earned = payload.points_earned;
    }

    if (payload.requires_wash_bay !== undefined) {
        normalizedPayload.requires_wash_bay = payload.requires_wash_bay;
    }

    if (payload.requires_care_staff !== undefined) {
        normalizedPayload.requires_care_staff = payload.requires_care_staff;
    }

    if (payload.care_staff_type !== undefined) {
        normalizedPayload.care_staff_type = payload.care_staff_type;
    }

    if (payload.care_staff_required_count !== undefined) {
        normalizedPayload.care_staff_required_count = payload.care_staff_required_count;
    }

    if (payload.care_staff_duration_minutes !== undefined) {
        normalizedPayload.care_staff_duration_minutes = payload.care_staff_duration_minutes;
    }

    if (payload.care_staff_start_offset_minutes !== undefined) {
        normalizedPayload.care_staff_start_offset_minutes = payload.care_staff_start_offset_minutes;
    }

    if (payload.allow_duplicate_in_booking !== undefined) {
        normalizedPayload.allow_duplicate_in_booking = payload.allow_duplicate_in_booking;
    }

    if (payload.included_service_ids !== undefined) {
        normalizedPayload.included_service_ids = normalizeObjectIdList(payload.included_service_ids);
    }

    if (payload.steps_template !== undefined) {
        normalizedPayload.steps_template = normalizeStepTemplate(payload.steps_template);
    }

    if (payload.is_active !== undefined) {
        normalizedPayload.is_active = payload.is_active;
    }

    return normalizedPayload;
};

const buildSearchFilter = ({ search, vehicle_type, service_type, requires_wash_bay, requires_care_staff, is_active } = {}) => {
    const filter = {};

    if (search) {
        const keyword = escapeRegExp(search.trim());

        filter.$or = [
            { name: { $regex: keyword, $options: 'i' } },
            { description: { $regex: keyword, $options: 'i' } },
        ];
    }

    if (Array.isArray(vehicle_type)) {
        filter.vehicle_type = { $in: vehicle_type };
    } else if (vehicle_type) {
        filter.vehicle_type = vehicle_type;
    }

    if (service_type) {
        filter.service_type = service_type;
    }

    if (requires_wash_bay !== undefined) {
        filter.requires_wash_bay = requires_wash_bay;
    }

    if (requires_care_staff !== undefined) {
        filter.requires_care_staff = requires_care_staff;
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

const assertDurationRuleValid = (payload, currentServicePackage = null) => {
    const requiresWashBay = payload.requires_wash_bay !== undefined
        ? payload.requires_wash_bay
        : currentServicePackage?.requires_wash_bay;

    const durationMinutes = payload.duration_minutes !== undefined
        ? payload.duration_minutes
        : currentServicePackage?.duration_minutes;

    const washBayDurationMinutes = payload.wash_bay_duration_minutes !== undefined
        ? payload.wash_bay_duration_minutes
        : currentServicePackage?.wash_bay_duration_minutes;

    const washBayStartOffsetMinutes = payload.wash_bay_start_offset_minutes !== undefined
        ? payload.wash_bay_start_offset_minutes
        : currentServicePackage?.wash_bay_start_offset_minutes;

    const requiresCareStaff = payload.requires_care_staff !== undefined
        ? payload.requires_care_staff
        : currentServicePackage?.requires_care_staff;

    const careStaffDurationMinutes = payload.care_staff_duration_minutes !== undefined
        ? payload.care_staff_duration_minutes
        : currentServicePackage?.care_staff_duration_minutes;

    const careStaffStartOffsetMinutes = payload.care_staff_start_offset_minutes !== undefined
        ? payload.care_staff_start_offset_minutes
        : currentServicePackage?.care_staff_start_offset_minutes;

    const careStaffRequiredCount = payload.care_staff_required_count !== undefined
        ? payload.care_staff_required_count
        : currentServicePackage?.care_staff_required_count;

    if (requiresWashBay && (!washBayDurationMinutes || washBayDurationMinutes < 1)) {
        throw new AppError(
            'Wash bay duration is required when service package requires wash bay',
            400,
            'WASH_BAY_DURATION_REQUIRED'
        );
    }

    if (!requiresWashBay && washBayDurationMinutes && washBayDurationMinutes > 0) {
        throw new AppError(
            'Wash bay duration must be 0 when service package does not require wash bay',
            400,
            'INVALID_WASH_BAY_DURATION'
        );
    }

    if (!requiresWashBay && washBayStartOffsetMinutes && washBayStartOffsetMinutes > 0) {
        throw new AppError(
            'Wash bay start offset must be 0 when service package does not require wash bay',
            400,
            'INVALID_WASH_BAY_OFFSET'
        );
    }

    if (durationMinutes && washBayDurationMinutes && washBayDurationMinutes + (washBayStartOffsetMinutes || 0) > durationMinutes) {
        throw new AppError(
            'Wash bay duration must not exceed total duration',
            400,
            'INVALID_WASH_BAY_DURATION'
        );
    }

    if (requiresCareStaff) {
        if (payload.care_staff_type === null) {
            throw new AppError(
                'Care staff type is required when service package requires care staff',
                400,
                'CARE_STAFF_TYPE_REQUIRED'
            );
        }

        if (careStaffRequiredCount !== undefined && careStaffRequiredCount < 1) {
            throw new AppError(
                'Care staff required count must be greater than 0',
                400,
                'INVALID_CARE_STAFF_REQUIRED_COUNT'
            );
        }

        if (careStaffDurationMinutes !== undefined && careStaffDurationMinutes < 1) {
            throw new AppError(
                'Care staff duration must be greater than 0',
                400,
                'INVALID_CARE_STAFF_DURATION'
            );
        }
    }

    if (!requiresCareStaff) {
        if (careStaffRequiredCount && careStaffRequiredCount > 0) {
            throw new AppError(
                'Care staff required count must be 0 when service package does not require care staff',
                400,
                'INVALID_CARE_STAFF_REQUIRED_COUNT'
            );
        }

        if (careStaffDurationMinutes && careStaffDurationMinutes > 0) {
            throw new AppError(
                'Care staff duration must be 0 when service package does not require care staff',
                400,
                'INVALID_CARE_STAFF_DURATION'
            );
        }

        if (careStaffStartOffsetMinutes && careStaffStartOffsetMinutes > 0) {
            throw new AppError(
                'Care staff start offset must be 0 when service package does not require care staff',
                400,
                'INVALID_CARE_STAFF_OFFSET'
            );
        }
    }

    if (durationMinutes && careStaffDurationMinutes && careStaffDurationMinutes + (careStaffStartOffsetMinutes || 0) > durationMinutes) {
        throw new AppError(
            'Care staff duration must not exceed total duration',
            400,
            'INVALID_CARE_STAFF_DURATION'
        );
    }
};

const assertNameAvailable = async (name, vehicleType, ignoredServicePackageId = null) => {
    if (!name || !vehicleType) {
        return;
    }

    const filter = {
        name,
        vehicle_type: vehicleType,
    };

    if (ignoredServicePackageId) {
        filter._id = { $ne: ignoredServicePackageId };
    }

    const existed = await ServicePackage.exists(filter);

    if (existed) {
        throw new AppError(
            'Service package name already exists for this vehicle type',
            409,
            'SERVICE_PACKAGE_NAME_ALREADY_EXISTS'
        );
    }
};

const getServicePackageDocumentById = async (servicePackageId) => {
    const servicePackage = await ServicePackage.findById(servicePackageId).populate(
        'included_service_ids',
        'name vehicle_type service_type base_price duration_minutes wash_bay_duration_minutes wash_bay_start_offset_minutes points_earned requires_wash_bay requires_care_staff care_staff_type care_staff_required_count care_staff_duration_minutes care_staff_start_offset_minutes allow_duplicate_in_booking is_active'
    );

    if (!servicePackage) {
        throw new AppError('Service package not found', 404, 'SERVICE_PACKAGE_NOT_FOUND');
    }

    return servicePackage;
};

const assertIncludedServicesValid = async (includedServiceIds = [], servicePackagePayload = {}, currentServicePackage = null) => {
    const normalizedIncludedServiceIds = normalizeObjectIdList(includedServiceIds);
    const serviceType = servicePackagePayload.service_type || currentServicePackage?.service_type;

    if (!normalizedIncludedServiceIds.length) {
        if (serviceType === SERVICE_PACKAGE_TYPES.COMBO) {
            throw new AppError(
                'Combo service package must include at least one service',
                400,
                'COMBO_INCLUDED_SERVICES_REQUIRED'
            );
        }

        return;
    }

    if (serviceType !== SERVICE_PACKAGE_TYPES.COMBO) {
        throw new AppError(
            'Only combo service packages can include child services',
            400,
            'INVALID_INCLUDED_SERVICES_FOR_SERVICE_TYPE'
        );
    }

    const currentId = currentServicePackage?._id?.toString();

    if (currentId && normalizedIncludedServiceIds.some((id) => id.toString() === currentId)) {
        throw new AppError(
            'Service package cannot include itself',
            400,
            'SERVICE_PACKAGE_CANNOT_INCLUDE_ITSELF'
        );
    }

    const childServices = await ServicePackage.find({
        _id: { $in: normalizedIncludedServiceIds },
        is_active: true,
    });

    if (childServices.length !== normalizedIncludedServiceIds.length) {
        throw new AppError(
            'One or more included services are invalid or inactive',
            400,
            'INVALID_INCLUDED_SERVICES'
        );
    }

    const vehicleType = servicePackagePayload.vehicle_type || currentServicePackage?.vehicle_type;
    const invalidVehicleType = childServices.some((item) => item.vehicle_type !== vehicleType);

    if (invalidVehicleType) {
        throw new AppError(
            'Included services must match combo vehicle type',
            400,
            'INCLUDED_SERVICE_VEHICLE_TYPE_MISMATCH'
        );
    }

    const invalidChildType = childServices.some((item) => item.service_type === SERVICE_PACKAGE_TYPES.COMBO);

    if (invalidChildType) {
        throw new AppError(
            'Included services cannot contain another combo',
            400,
            'NESTED_COMBO_NOT_SUPPORTED'
        );
    }
};

const assertComboStepsTemplateEmpty = (serviceType, stepsTemplate = []) => {
    if (serviceType === SERVICE_PACKAGE_TYPES.COMBO && stepsTemplate.length > 0) {
        throw new AppError(
            'Combo service package must not define operational steps',
            400,
            'COMBO_STEPS_TEMPLATE_NOT_ALLOWED'
        );
    }
};

const mergeFilter = (baseFilter, extraFilter) => {
    if (!extraFilter || Object.keys(extraFilter).length === 0) {
        return baseFilter;
    }

    if (!baseFilter || Object.keys(baseFilter).length === 0) {
        return extraFilter;
    }

    return {
        $and: [
            baseFilter,
            extraFilter,
        ],
    };
};

const buildGarageWashBayServiceFilter = async (garageId, requiresWashBay) => {
    if (!garageId) {
        return {};
    }

    const supportedVehicleTypes = await washBayService.getSupportedVehicleTypesByGarage(garageId);

    if (requiresWashBay === true) {
        return {
            vehicle_type: { $in: supportedVehicleTypes },
        };
    }

    if (requiresWashBay === false) {
        return {};
    }

    return {
        $or: [
            { requires_wash_bay: false },
            {
                requires_wash_bay: true,
                vehicle_type: { $in: supportedVehicleTypes },
            },
        ],
    };
};

const getPublicServicePackages = async ({
    page = 1,
    limit = 20,
    search,
    garage_id,
    vehicle_type,
    service_type,
    requires_wash_bay,
    requires_care_staff,
} = {}) => {
    const garageWashBayFilter = await buildGarageWashBayServiceFilter(
        garage_id,
        requires_wash_bay
    );

    const baseFilter = buildSearchFilter({
        search,
        vehicle_type,
        service_type,
        requires_wash_bay,
        requires_care_staff,
        is_active: true,
    });
    const filter = mergeFilter(baseFilter, garageWashBayFilter);
    const skip = (page - 1) * limit;

    const [servicePackages, total] = await Promise.all([
        ServicePackage.find(filter)
            .populate('included_service_ids', 'name vehicle_type service_type base_price duration_minutes wash_bay_duration_minutes wash_bay_start_offset_minutes points_earned requires_wash_bay requires_care_staff care_staff_type care_staff_required_count care_staff_duration_minutes care_staff_start_offset_minutes allow_duplicate_in_booking is_active')
            .sort({ vehicle_type: 1, service_type: 1, base_price: 1, created_at: -1 })
            .skip(skip)
            .limit(limit),
        ServicePackage.countDocuments(filter),
    ]);

    return {
        data: ServicePackageMapper.toServicePackageDtoList(servicePackages),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

const getPublicServicePackageById = async (servicePackageId) => {
    const servicePackage = await ServicePackage.findOne({
        _id: servicePackageId,
        is_active: true,
    }).populate('included_service_ids', 'name vehicle_type service_type base_price duration_minutes wash_bay_duration_minutes wash_bay_start_offset_minutes points_earned requires_wash_bay requires_care_staff care_staff_type care_staff_required_count care_staff_duration_minutes care_staff_start_offset_minutes allow_duplicate_in_booking is_active');

    if (!servicePackage) {
        throw new AppError('Service package not found', 404, 'SERVICE_PACKAGE_NOT_FOUND');
    }

    return ServicePackageMapper.toServicePackageDto(servicePackage);
};

const getAllServicePackages = async ({ page = 1, limit = 20, search, vehicle_type, service_type, requires_wash_bay, requires_care_staff, is_active } = {}) => {
    const filter = buildSearchFilter({ search, vehicle_type, service_type, requires_wash_bay, requires_care_staff, is_active });
    const skip = (page - 1) * limit;

    const [servicePackages, total] = await Promise.all([
        ServicePackage.find(filter)
            .populate('included_service_ids', 'name vehicle_type service_type base_price duration_minutes wash_bay_duration_minutes wash_bay_start_offset_minutes points_earned requires_wash_bay requires_care_staff care_staff_type care_staff_required_count care_staff_duration_minutes care_staff_start_offset_minutes allow_duplicate_in_booking is_active')
            .sort({ vehicle_type: 1, service_type: 1, base_price: 1, created_at: -1 })
            .skip(skip)
            .limit(limit),
        ServicePackage.countDocuments(filter),
    ]);

    return {
        data: ServicePackageMapper.toServicePackageDtoList(servicePackages),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

const getServicePackageById = async (servicePackageId) => {
    const servicePackage = await getServicePackageDocumentById(servicePackageId);

    return ServicePackageMapper.toServicePackageDto(servicePackage);
};

const createServicePackage = async (payload = {}) => {
    const createPayload = normalizeBasePayload(
        ServicePackageMapper.toCreatePayload(payload)
    );

    if (createPayload.requires_care_staff) {
        createPayload.care_staff_type = createPayload.care_staff_type || STAFF_TYPES.VEHICLE_CARE_STAFF;
        createPayload.care_staff_required_count = createPayload.care_staff_required_count || 1;
        createPayload.care_staff_duration_minutes = createPayload.care_staff_duration_minutes || createPayload.duration_minutes;
    }
    assertDurationRuleValid(createPayload);
    assertComboStepsTemplateEmpty(createPayload.service_type, createPayload.steps_template || []);
    await assertNameAvailable(createPayload.name, createPayload.vehicle_type);
    await assertIncludedServicesValid(createPayload.included_service_ids || [], createPayload);

    const servicePackage = await ServicePackage.create(createPayload);
    const populatedServicePackage = await getServicePackageDocumentById(servicePackage._id);

    return ServicePackageMapper.toServicePackageDto(populatedServicePackage);
};

const updateServicePackage = async (servicePackageId, payload = {}) => {
    const servicePackage = await getServicePackageDocumentById(servicePackageId);
    const updatePayload = normalizeBasePayload(
        ServicePackageMapper.toUpdatePayload(payload)
    );

    assertUpdatePayloadNotEmpty(updatePayload);
    if (updatePayload.requires_care_staff === true) {
        updatePayload.care_staff_type = updatePayload.care_staff_type || servicePackage.care_staff_type || STAFF_TYPES.VEHICLE_CARE_STAFF;
        updatePayload.care_staff_required_count = updatePayload.care_staff_required_count || servicePackage.care_staff_required_count || 1;
        updatePayload.care_staff_duration_minutes = updatePayload.care_staff_duration_minutes || servicePackage.care_staff_duration_minutes || updatePayload.duration_minutes || servicePackage.duration_minutes;
    }

    if (updatePayload.requires_care_staff === false) {
        updatePayload.care_staff_type = null;
        updatePayload.care_staff_required_count = 0;
        updatePayload.care_staff_duration_minutes = 0;
        updatePayload.care_staff_start_offset_minutes = 0;
    }

    if (updatePayload.requires_wash_bay === false) {
        updatePayload.wash_bay_duration_minutes = 0;
        updatePayload.wash_bay_start_offset_minutes = 0;
    }
    assertDurationRuleValid(updatePayload, servicePackage);

    const nextName = updatePayload.name || servicePackage.name;
    const nextVehicleType = updatePayload.vehicle_type || servicePackage.vehicle_type;
    const nextServiceType = updatePayload.service_type || servicePackage.service_type;
    const nextStepsTemplate = updatePayload.steps_template !== undefined
        ? updatePayload.steps_template
        : nextServiceType === SERVICE_PACKAGE_TYPES.COMBO ? [] : servicePackage.steps_template || [];

    assertComboStepsTemplateEmpty(nextServiceType, nextStepsTemplate);
    if (nextServiceType === SERVICE_PACKAGE_TYPES.COMBO) {
        updatePayload.steps_template = [];
    }
    await assertNameAvailable(nextName, nextVehicleType, servicePackageId);

    if (updatePayload.included_service_ids !== undefined || updatePayload.service_type !== undefined || updatePayload.vehicle_type !== undefined) {
        await assertIncludedServicesValid(
            updatePayload.included_service_ids !== undefined ? updatePayload.included_service_ids : servicePackage.included_service_ids,
            updatePayload,
            servicePackage
        );
    }

    const updatedServicePackage = await ServicePackage.findByIdAndUpdate(
        servicePackageId,
        { $set: updatePayload },
        { new: true, runValidators: true }
    ).populate('included_service_ids', 'name vehicle_type service_type base_price duration_minutes wash_bay_duration_minutes wash_bay_start_offset_minutes points_earned requires_wash_bay requires_care_staff care_staff_type care_staff_required_count care_staff_duration_minutes care_staff_start_offset_minutes allow_duplicate_in_booking is_active');

    return ServicePackageMapper.toServicePackageDto(updatedServicePackage);
};

const updateServicePackageStatus = async (servicePackageId, isActive) => {
    const servicePackage = await getServicePackageDocumentById(servicePackageId);

    if (servicePackage.is_active === isActive) {
        throw new AppError('Service package status is unchanged', 400, 'NO_CHANGE');
    }

    const updatedServicePackage = await ServicePackage.findByIdAndUpdate(
        servicePackageId,
        { $set: { is_active: isActive } },
        { new: true, runValidators: true }
    ).populate('included_service_ids', 'name vehicle_type service_type base_price duration_minutes wash_bay_duration_minutes wash_bay_start_offset_minutes points_earned requires_wash_bay requires_care_staff care_staff_type care_staff_required_count care_staff_duration_minutes care_staff_start_offset_minutes allow_duplicate_in_booking is_active');

    return ServicePackageMapper.toServicePackageDto(updatedServicePackage);
};

const updateStepsTemplate = async (servicePackageId, stepsTemplate = []) => {
    const servicePackage = await getServicePackageDocumentById(servicePackageId);
    const normalizedStepsTemplate = normalizeStepTemplate(stepsTemplate);
    assertComboStepsTemplateEmpty(servicePackage.service_type, normalizedStepsTemplate);
    const updatePayload = {
        steps_template: normalizedStepsTemplate,
    };

    const updatedServicePackage = await ServicePackage.findByIdAndUpdate(
        servicePackage._id,
        { $set: updatePayload },
        { new: true, runValidators: true }
    ).populate('included_service_ids', 'name vehicle_type service_type base_price duration_minutes wash_bay_duration_minutes wash_bay_start_offset_minutes points_earned requires_wash_bay requires_care_staff care_staff_type care_staff_required_count care_staff_duration_minutes care_staff_start_offset_minutes allow_duplicate_in_booking is_active');

    return ServicePackageMapper.toServicePackageDto(updatedServicePackage);
};

const updateIncludedServices = async (servicePackageId, includedServiceIds = []) => {
    const servicePackage = await getServicePackageDocumentById(servicePackageId);
    const normalizedIncludedServiceIds = normalizeObjectIdList(includedServiceIds);

    await assertIncludedServicesValid(normalizedIncludedServiceIds, {}, servicePackage);

    const updatePayload = {
        included_service_ids: normalizedIncludedServiceIds,
    };

    if (servicePackage.service_type === SERVICE_PACKAGE_TYPES.COMBO) {
        updatePayload.steps_template = [];
    }

    const updatedServicePackage = await ServicePackage.findByIdAndUpdate(
        servicePackage._id,
        { $set: updatePayload },
        { new: true, runValidators: true }
    ).populate('included_service_ids', 'name vehicle_type service_type base_price duration_minutes wash_bay_duration_minutes wash_bay_start_offset_minutes points_earned requires_wash_bay requires_care_staff care_staff_type care_staff_required_count care_staff_duration_minutes care_staff_start_offset_minutes allow_duplicate_in_booking is_active');

    return ServicePackageMapper.toServicePackageDto(updatedServicePackage);
};

module.exports = {
    getPublicServicePackages,
    getPublicServicePackageById,
    getAllServicePackages,
    getServicePackageById,
    createServicePackage,
    updateServicePackage,
    updateServicePackageStatus,
    updateStepsTemplate,
    updateIncludedServices,
};
