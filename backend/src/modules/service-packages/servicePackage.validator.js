const { z } = require('zod');

const { VEHICLE_TYPE_VALUES } = require('../../shared/constants/vehicle.constant');
const { STAFF_TYPES, STAFF_TYPE_VALUES } = require('../../shared/constants/staff.constant');
const {
    SERVICE_PACKAGE_TYPE_VALUES,
    SERVICE_STEP_TYPE_VALUES,
    SERVICE_PACKAGE_TYPES,
} = require('../../shared/constants/servicePackage.constant');

const emptyToUndefined = (value) => {
    if (typeof value === 'string' && value.trim() === '') {
        return undefined;
    }

    return value;
};

const emptyToNull = (value) => {
    if (typeof value === 'string' && value.trim() === '') {
        return null;
    }

    return value;
};

const stringBooleanField = z.preprocess((value) => {
    if (value === 'true') {
        return true;
    }

    if (value === 'false') {
        return false;
    }

    return value;
}, z.boolean());

const objectIdField = z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid resource id');

const nameField = z.string().trim().min(2).max(150);
const vehicleTypeField = z.enum(VEHICLE_TYPE_VALUES);
const serviceTypeField = z.enum(SERVICE_PACKAGE_TYPE_VALUES);
const stepTypeField = z.enum(SERVICE_STEP_TYPE_VALUES);
const staffTypeField = z.enum(STAFF_TYPE_VALUES);

const descriptionField = z.preprocess(
    emptyToNull,
    z.string().trim().max(2000).nullable().optional()
);

const stepTemplateField = z.object({
    step_code: z
        .string()
        .trim()
        .min(2)
        .max(80)
        .regex(/^[A-Za-z0-9_]+$/, 'Step code is invalid'),
    step_name: z.string().trim().min(2).max(150),
    order: z.coerce.number().int().min(1),
    step_type: stepTypeField,
    is_required: z.boolean().optional(),
    display_staff_type: staffTypeField.nullable().optional(),
    instructions: z.array(z.string().trim().min(1).max(500)).default([]),
}).strict();

const includedServiceIdsField = z.array(objectIdField).default([]);
const stepsTemplateField = z.array(stepTemplateField).default([]);

const atLeastOneField = (data) => Object.values(data).some((value) => value !== undefined);

const hasUniqueValues = (values) => new Set(values).size === values.length;

const servicePackageBusinessRule = (data) => {
    if (data.requires_wash_bay && (!data.wash_bay_duration_minutes || data.wash_bay_duration_minutes < 1)) {
        return false;
    }

    if (!data.requires_wash_bay && data.wash_bay_duration_minutes && data.wash_bay_duration_minutes > 0) {
        return false;
    }

    if (!data.requires_wash_bay && data.wash_bay_start_offset_minutes && data.wash_bay_start_offset_minutes > 0) {
        return false;
    }

    if (data.wash_bay_duration_minutes && data.duration_minutes && data.wash_bay_duration_minutes + (data.wash_bay_start_offset_minutes || 0) > data.duration_minutes) {
        return false;
    }

    if (!data.requires_care_staff) {
        if (data.care_staff_required_count && data.care_staff_required_count > 0) {
            return false;
        }

        if (data.care_staff_duration_minutes && data.care_staff_duration_minutes > 0) {
            return false;
        }

        if (data.care_staff_start_offset_minutes && data.care_staff_start_offset_minutes > 0) {
            return false;
        }
    }

    if (data.requires_care_staff && data.care_staff_duration_minutes && data.duration_minutes && data.care_staff_duration_minutes + (data.care_staff_start_offset_minutes || 0) > data.duration_minutes) {
        return false;
    }

    if (data.service_type !== SERVICE_PACKAGE_TYPES.COMBO && data.included_service_ids && data.included_service_ids.length > 0) {
        return false;
    }

    if (data.service_type === SERVICE_PACKAGE_TYPES.COMBO && (!data.included_service_ids || data.included_service_ids.length === 0)) {
        return false;
    }

    if (data.service_type === SERVICE_PACKAGE_TYPES.COMBO && data.steps_template && data.steps_template.length > 0) {
        return false;
    }

    if (data.steps_template) {
        const orders = data.steps_template.map((step) => step.order);
        const codes = data.steps_template.map((step) => step.step_code.trim().toUpperCase());

        if (!hasUniqueValues(orders) || !hasUniqueValues(codes)) {
            return false;
        }
    }

    return true;
};

const updateServicePackageBusinessRule = (data) => {
    if (data.service_type === SERVICE_PACKAGE_TYPES.COMBO && data.included_service_ids && data.included_service_ids.length === 0) {
        return false;
    }

    if (data.service_type === SERVICE_PACKAGE_TYPES.COMBO && data.steps_template && data.steps_template.length > 0) {
        return false;
    }

    if (data.steps_template) {
        const orders = data.steps_template.map((step) => step.order);
        const codes = data.steps_template.map((step) => step.step_code.trim().toUpperCase());

        if (!hasUniqueValues(orders) || !hasUniqueValues(codes)) {
            return false;
        }
    }

    return true;
};

const idParamSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
});

const getServicePackagesSchema = z.object({
    query: z
        .object({
            page: z.coerce.number().int().min(1).default(1),
            limit: z.coerce.number().int().min(1).max(100).default(20),
            search: z.preprocess(
                emptyToUndefined,
                z.string().trim().max(100).optional()
            ),
            garage_id: z.preprocess(emptyToUndefined, objectIdField.optional()),
            vehicle_type: vehicleTypeField.optional(),
            service_type: serviceTypeField.optional(),
            requires_wash_bay: stringBooleanField.optional(),
            requires_care_staff: stringBooleanField.optional(),
        })
        .strict(),
});

const getAdminServicePackagesSchema = z.object({
    query: z
        .object({
            page: z.coerce.number().int().min(1).default(1),
            limit: z.coerce.number().int().min(1).max(100).default(20),
            search: z.preprocess(
                emptyToUndefined,
                z.string().trim().max(100).optional()
            ),
            vehicle_type: vehicleTypeField.optional(),
            service_type: serviceTypeField.optional(),
            requires_wash_bay: stringBooleanField.optional(),
            requires_care_staff: stringBooleanField.optional(),
            is_active: stringBooleanField.optional(),
        })
        .strict(),
});

const createServicePackageSchema = z.object({
    body: z
        .object({
            name: nameField,
            vehicle_type: vehicleTypeField,
            service_type: serviceTypeField,
            description: descriptionField,
            base_price: z.coerce.number().min(0),
            duration_minutes: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(1440).optional()),
            wash_bay_duration_minutes: z.coerce.number().int().min(0).max(1440).default(0),
            wash_bay_start_offset_minutes: z.coerce.number().int().min(0).max(1440).default(0),
            points_earned: z.coerce.number().int().min(0).default(0),
            requires_wash_bay: z.boolean().default(false),
            requires_care_staff: z.boolean().default(false),
            care_staff_type: staffTypeField.default(STAFF_TYPES.VEHICLE_CARE_STAFF).nullable().optional(),
            care_staff_required_count: z.coerce.number().int().min(0).max(50).default(0),
            care_staff_duration_minutes: z.coerce.number().int().min(0).max(1440).default(0),
            care_staff_start_offset_minutes: z.coerce.number().int().min(0).max(1440).default(0),
            allow_duplicate_in_booking: z.boolean().default(false),
            included_service_ids: includedServiceIdsField,
            steps_template: stepsTemplateField,
            is_active: z.boolean().optional(),
        })
        .strict()
        .refine((data) => data.service_type === SERVICE_PACKAGE_TYPES.COMBO || data.duration_minutes !== undefined, {
            message: 'Duration is required for non-combo service packages',
        })
        .refine(servicePackageBusinessRule, {
            message: 'Service package business rule is invalid',
        }),
});

const updateServicePackageSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
    body: z
        .object({
            name: z.preprocess(emptyToUndefined, nameField.optional()),
            vehicle_type: vehicleTypeField.optional(),
            service_type: serviceTypeField.optional(),
            description: descriptionField,
            base_price: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional()),
            duration_minutes: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(1440).optional()),
            wash_bay_duration_minutes: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(1440).optional()),
            wash_bay_start_offset_minutes: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(1440).optional()),
            points_earned: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional()),
            requires_wash_bay: z.boolean().optional(),
            requires_care_staff: z.boolean().optional(),
            care_staff_type: z.preprocess(emptyToUndefined, staffTypeField.nullable().optional()),
            care_staff_required_count: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(50).optional()),
            care_staff_duration_minutes: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(1440).optional()),
            care_staff_start_offset_minutes: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(1440).optional()),
            allow_duplicate_in_booking: z.boolean().optional(),
            included_service_ids: z.array(objectIdField).optional(),
            steps_template: z.array(stepTemplateField).optional(),
            is_active: z.boolean().optional(),
        })
        .strict()
        .refine(atLeastOneField, {
            message: 'At least one field is required',
        })
        .refine(updateServicePackageBusinessRule, {
            message: 'Service package business rule is invalid',
        }),
});

const updateServicePackageStatusSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
});

const updateStepsTemplateSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
    body: z
        .object({
            steps_template: z.array(stepTemplateField),
        })
        .strict()
        .refine((data) => updateServicePackageBusinessRule(data), {
            message: 'Steps template is invalid',
        }),
});

const updateIncludedServicesSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
    body: z
        .object({
            included_service_ids: z.array(objectIdField),
        })
        .strict(),
});

module.exports = {
    idParamSchema,
    getServicePackagesSchema,
    getAdminServicePackagesSchema,
    createServicePackageSchema,
    updateServicePackageSchema,
    updateServicePackageStatusSchema,
    updateStepsTemplateSchema,
    updateIncludedServicesSchema,
};
