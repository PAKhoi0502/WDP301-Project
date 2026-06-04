const toId = (value) => {
    if (!value) {
        return null;
    }

    if (value._id) {
        return value._id.toString();
    }

    return value.toString();
};

const toStepTemplateDto = (step = {}) => {
    return {
        step_code: step.step_code,
        step_name: step.step_name,
        order: step.order,
        step_type: step.step_type,
        is_required: step.is_required,
        display_staff_type: step.display_staff_type,
        instructions: step.instructions || [],
    };
};

const toIncludedServiceDto = (service) => {
    if (!service) {
        return null;
    }

    if (!service.name) {
        return toId(service);
    }

    return {
        id: toId(service),
        name: service.name,
        vehicle_type: service.vehicle_type,
        service_type: service.service_type,
        base_price: service.base_price,
        duration_minutes: service.duration_minutes,
        wash_bay_duration_minutes: service.wash_bay_duration_minutes,
        points_earned: service.points_earned,
        requires_wash_bay: service.requires_wash_bay,
        is_active: service.is_active,
    };
};

const toServicePackageDto = (servicePackage) => {
    if (!servicePackage) {
        return null;
    }

    const plainServicePackage = servicePackage.toObject ? servicePackage.toObject() : servicePackage;

    return {
        id: plainServicePackage._id?.toString() || plainServicePackage.id || null,
        name: plainServicePackage.name,
        vehicle_type: plainServicePackage.vehicle_type,
        service_type: plainServicePackage.service_type,
        description: plainServicePackage.description,
        base_price: plainServicePackage.base_price,
        duration_minutes: plainServicePackage.duration_minutes,
        wash_bay_duration_minutes: plainServicePackage.wash_bay_duration_minutes,
        points_earned: plainServicePackage.points_earned,
        requires_wash_bay: plainServicePackage.requires_wash_bay,
        included_service_ids: (plainServicePackage.included_service_ids || []).map((item) => toIncludedServiceDto(item)),
        steps_template: (plainServicePackage.steps_template || []).map((step) => toStepTemplateDto(step)),
        is_active: plainServicePackage.is_active,
        created_at: plainServicePackage.created_at,
        updated_at: plainServicePackage.updated_at,
    };
};

const toServicePackageDtoList = (servicePackages = []) => {
    return servicePackages.map((servicePackage) => toServicePackageDto(servicePackage));
};

const copyDefinedFields = (data = {}, fields = []) => {
    const payload = {};

    fields.forEach((field) => {
        if (data[field] !== undefined) {
            payload[field] = data[field];
        }
    });

    return payload;
};

const baseFields = [
    'name',
    'vehicle_type',
    'service_type',
    'description',
    'base_price',
    'duration_minutes',
    'wash_bay_duration_minutes',
    'points_earned',
    'requires_wash_bay',
    'included_service_ids',
    'steps_template',
    'is_active',
];

const toCreatePayload = (data = {}) => copyDefinedFields(data, baseFields);
const toUpdatePayload = (data = {}) => copyDefinedFields(data, baseFields);

module.exports = {
    toServicePackageDto,
    toServicePackageDtoList,
    toCreatePayload,
    toUpdatePayload,
};
