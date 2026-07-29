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
        service_code: service.service_code || null,
        name: service.name,
        vehicle_type: service.vehicle_type,
        service_type: service.service_type,
        base_price: service.base_price,
        duration_minutes: service.duration_minutes,
        countdown_duration_seconds: service.countdown_duration_seconds || service.duration_minutes * 60,
        transition_mode: service.transition_mode || 'REQUIRE_CONFIRMATION',
        wash_bay_duration_minutes: service.wash_bay_duration_minutes,
        wash_bay_start_offset_minutes: service.wash_bay_start_offset_minutes,
        points_earned: service.points_earned,
        requires_wash_bay: service.requires_wash_bay,
        requires_care_staff: service.requires_care_staff,
        care_staff_type: service.care_staff_type,
        care_staff_required_count: service.care_staff_required_count,
        care_staff_duration_minutes: service.care_staff_duration_minutes,
        care_staff_start_offset_minutes: service.care_staff_start_offset_minutes,
        allow_duplicate_in_booking: service.allow_duplicate_in_booking,
        is_active: service.is_active,
    };
};

const toServicePackageDto = (servicePackage, ratingSummary = null) => {
    if (!servicePackage) {
        return null;
    }

    const plainServicePackage = servicePackage.toObject ? servicePackage.toObject() : servicePackage;

    return {
        id: plainServicePackage._id?.toString() || plainServicePackage.id || null,
        service_code: plainServicePackage.service_code || null,
        name: plainServicePackage.name,
        vehicle_type: plainServicePackage.vehicle_type,
        service_type: plainServicePackage.service_type,
        description: plainServicePackage.description,
        base_price: plainServicePackage.base_price,
        duration_minutes: plainServicePackage.duration_minutes,
        countdown_duration_seconds: plainServicePackage.countdown_duration_seconds || plainServicePackage.duration_minutes * 60,
        transition_mode: plainServicePackage.transition_mode || 'REQUIRE_CONFIRMATION',
        wash_bay_duration_minutes: plainServicePackage.wash_bay_duration_minutes,
        wash_bay_start_offset_minutes: plainServicePackage.wash_bay_start_offset_minutes,
        points_earned: plainServicePackage.points_earned,
        requires_wash_bay: plainServicePackage.requires_wash_bay,
        requires_care_staff: plainServicePackage.requires_care_staff,
        care_staff_type: plainServicePackage.care_staff_type,
        care_staff_required_count: plainServicePackage.care_staff_required_count,
        care_staff_duration_minutes: plainServicePackage.care_staff_duration_minutes,
        care_staff_start_offset_minutes: plainServicePackage.care_staff_start_offset_minutes,
        allow_duplicate_in_booking: plainServicePackage.allow_duplicate_in_booking,
        included_service_ids: (plainServicePackage.included_service_ids || []).map((item) => toIncludedServiceDto(item)),
        steps_template: (plainServicePackage.steps_template || []).map((step) => toStepTemplateDto(step)),
        is_active: plainServicePackage.is_active,
        ...(ratingSummary ? {
            rating_average: ratingSummary.rating_average,
            rating_count: ratingSummary.rating_count,
        } : {}),
        created_at: plainServicePackage.created_at,
        updated_at: plainServicePackage.updated_at,
    };
};

const toServicePackageDtoList = (servicePackages = [], ratingSummaryMap = null) => {
    return servicePackages.map((servicePackage) => {
        const servicePackageId = servicePackage?._id?.toString?.()
            || servicePackage?.id?.toString?.();
        const ratingSummary = ratingSummaryMap?.get(servicePackageId) || null;

        return toServicePackageDto(servicePackage, ratingSummary);
    });
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
    'countdown_duration_seconds',
    'transition_mode',
    'wash_bay_duration_minutes',
    'wash_bay_start_offset_minutes',
    'points_earned',
    'requires_wash_bay',
    'requires_care_staff',
    'care_staff_type',
    'care_staff_required_count',
    'care_staff_duration_minutes',
    'care_staff_start_offset_minutes',
    'allow_duplicate_in_booking',
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
