const { z } = require('zod');

const {
    VEHICLE_TYPES,
    VEHICLE_TYPE_VALUES,
    ENGINE_TYPE_VALUES,
    MOTORBIKE_CC_GROUP_VALUES,
    CAR_BODY_TYPE_VALUES,
} = require('../../shared/constants/vehicle.constant');

const emptyToNull = (value) => value === '' || value === undefined ? null : value;
const emptyToUndefined = (value) => value === '' ? undefined : value;
const objectIdField = z.string().trim().regex(/^[0-9a-fA-F]{24}$/, 'Invalid resource id');
const nullableObjectIdField = z.preprocess(emptyToNull, objectIdField.nullable());
const nullableEnum = (values) => z.preprocess(emptyToNull, z.enum(values).nullable());
const nullableInteger = (min, max) => z.preprocess(
    emptyToNull,
    z.coerce.number().int().min(min).max(max).nullable()
);
const optionalDate = z.preprocess(
    emptyToUndefined,
    z.string().datetime({ offset: true }).optional()
);
const nullableDate = z.preprocess(
    emptyToNull,
    z.string().datetime({ offset: true }).nullable()
);

const classificationShape = {
    vehicle_type: z.enum(VEHICLE_TYPE_VALUES),
    engine_type: nullableEnum(ENGINE_TYPE_VALUES).default(null),
    motorbike_cc_group: nullableEnum(MOTORBIKE_CC_GROUP_VALUES).default(null),
    car_body_type: nullableEnum(CAR_BODY_TYPE_VALUES).default(null),
    seat_count: nullableInteger(2, 16).default(null),
};

const validateClassification = (data, context) => {
    if (!data.engine_type) {
        context.addIssue({
            code: 'custom',
            path: ['engine_type'],
            message: 'Engine type is required for vehicle pricing',
        });
    }

    if (data.vehicle_type === VEHICLE_TYPES.CAR) {
        if (!data.car_body_type) {
            context.addIssue({
                code: 'custom',
                path: ['car_body_type'],
                message: 'Car body type is required for car',
            });
        }
        if (!data.seat_count) {
            context.addIssue({
                code: 'custom',
                path: ['seat_count'],
                message: 'Seat count is required for car pricing',
            });
        }
        if (data.motorbike_cc_group) {
            context.addIssue({
                code: 'custom',
                path: ['motorbike_cc_group'],
                message: 'Motorbike displacement is not allowed for car',
            });
        }
    }
    if (data.vehicle_type === VEHICLE_TYPES.MOTORBIKE) {
        if (!data.motorbike_cc_group) {
            context.addIssue({
                code: 'custom',
                path: ['motorbike_cc_group'],
                message: 'Motorbike displacement is required for motorbike',
            });
        }
        if (data.car_body_type || data.seat_count) {
            context.addIssue({
                code: 'custom',
                path: ['vehicle_type'],
                message: 'Car classification fields are not allowed for motorbike',
            });
        }
    }
};

const ruleBody = z.object({
    service_package_id: objectIdField,
    garage_id: nullableObjectIdField.default(null),
    vehicle_type: z.enum(VEHICLE_TYPE_VALUES),
    engine_type: nullableEnum(ENGINE_TYPE_VALUES).default(null),
    motorbike_cc_group: nullableEnum(MOTORBIKE_CC_GROUP_VALUES).default(null),
    car_body_type: nullableEnum(CAR_BODY_TYPE_VALUES).default(null),
    seat_min: nullableInteger(2, 16).default(null),
    seat_max: nullableInteger(2, 16).default(null),
    price: z.coerce.number().int().min(0),
    duration_minutes: nullableInteger(1, 1440).default(null),
    wash_bay_duration_minutes: nullableInteger(0, 1440).default(null),
    care_staff_duration_minutes: nullableInteger(0, 1440).default(null),
    effective_from: optionalDate,
    effective_to: nullableDate.default(null),
    is_active: z.boolean().default(true),
    note: z.preprocess(emptyToNull, z.string().trim().max(500).nullable()).default(null),
}).strict();

const createRuleSchema = z.object({
    body: ruleBody,
});

const updateRuleBody = z.object({
    service_package_id: objectIdField.optional(),
    garage_id: nullableObjectIdField.optional(),
    vehicle_type: z.enum(VEHICLE_TYPE_VALUES).optional(),
    engine_type: nullableEnum(ENGINE_TYPE_VALUES).optional(),
    motorbike_cc_group: nullableEnum(MOTORBIKE_CC_GROUP_VALUES).optional(),
    car_body_type: nullableEnum(CAR_BODY_TYPE_VALUES).optional(),
    seat_min: nullableInteger(2, 16).optional(),
    seat_max: nullableInteger(2, 16).optional(),
    price: z.coerce.number().int().min(0).optional(),
    duration_minutes: nullableInteger(1, 1440).optional(),
    wash_bay_duration_minutes: nullableInteger(0, 1440).optional(),
    care_staff_duration_minutes: nullableInteger(0, 1440).optional(),
    effective_from: optionalDate,
    effective_to: nullableDate.optional(),
    is_active: z.boolean().optional(),
    note: z.preprocess(emptyToNull, z.string().trim().max(500).nullable()).optional(),
}).strict();

const updateRuleSchema = z.object({
    params: z.object({ id: objectIdField }).strict(),
    body: updateRuleBody.refine(
        (value) => Object.values(value).some((item) => item !== undefined),
        'At least one field is required'
    ),
});

const idParamSchema = z.object({
    params: z.object({ id: objectIdField }).strict(),
});

const listRulesSchema = z.object({
    query: z.object({
        service_package_id: objectIdField.optional(),
        garage_id: objectIdField.optional(),
        vehicle_type: z.enum(VEHICLE_TYPE_VALUES).optional(),
        is_active: z.preprocess((value) => {
            if (value === 'true') return true;
            if (value === 'false') return false;
            return value;
        }, z.boolean().optional()),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(100),
    }).strict(),
});

const customerQuoteSchema = z.object({
    body: z.object({
        garage_id: objectIdField,
        vehicle_id: objectIdField,
        service_package_id: objectIdField,
        add_on_service_ids: z.array(objectIdField).default([]),
        effective_at: optionalDate,
    }).strict(),
});

const walkInQuoteSchema = z.object({
    body: z.object({
        garage_id: objectIdField,
        service_package_id: objectIdField,
        add_on_service_ids: z.array(objectIdField).default([]),
        effective_at: optionalDate,
        vehicle_snapshot: z.object(classificationShape).strict().superRefine(validateClassification),
    }).strict(),
});

const vehicleClassificationSchema = z.object(classificationShape).strict().superRefine(validateClassification);

module.exports = {
    createRuleSchema,
    updateRuleSchema,
    idParamSchema,
    listRulesSchema,
    customerQuoteSchema,
    walkInQuoteSchema,
    vehicleClassificationSchema,
};
