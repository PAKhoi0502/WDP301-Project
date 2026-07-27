const { z } = require('zod');

const {
    VEHICLE_TYPE_VALUES,
    ENGINE_TYPE_VALUES,
    MOTORBIKE_CC_GROUP_VALUES,
    CAR_BODY_TYPE_VALUES,
    VEHICLE_TYPES,
} = require('../../shared/constants/vehicle.constant');

const emptyToUndefined = (value) => {
    if (typeof value === 'string' && value.trim() === '') {
        return undefined;
    }

    return value;
};

const nullableEmptyString = z.preprocess((value) => {
    if (typeof value === 'string' && value.trim() === '') {
        return null;
    }

    return value;
}, z.string().trim().max(100).nullable().optional());

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

const licensePlateField = z
    .string()
    .trim()
    .min(3, 'License plate must have at least 3 characters')
    .max(30, 'License plate must have at most 30 characters');

const vehicleTypeField = z.enum(VEHICLE_TYPE_VALUES);
const engineTypeField = z.enum(ENGINE_TYPE_VALUES);
const motorbikeCcGroupField = z.enum(MOTORBIKE_CC_GROUP_VALUES);
const carBodyTypeField = z.enum(CAR_BODY_TYPE_VALUES);

const optionalStringField = z.preprocess(
    emptyToUndefined,
    z.string().trim().max(100).optional()
);

const optionalColorField = z.preprocess(
    emptyToUndefined,
    z.string().trim().max(50).optional()
);

const optionalSeatCountField = z.preprocess(
    (value) => {
        if (value === null) {
            return null;
        }

        if (typeof value === 'string' && value.trim() === '') {
            return null;
        }

        return value;
    },
    z.coerce.number().int().min(2).max(16).nullable().optional()
);

const atLeastOneField = (data) => Object.values(data).some((value) => value !== undefined);

const vehiclePayloadRule = (data) => {
    if (data.vehicle_type === VEHICLE_TYPES.MOTORBIKE) {
        return !!data.motorbike_cc_group && !data.car_body_type && !data.seat_count;
    }

    if (data.vehicle_type === VEHICLE_TYPES.CAR) {
        return !!data.car_body_type && !!data.seat_count && !data.motorbike_cc_group;
    }

    return false;
};

const createVehicleShape = {
    raw_license_plate: licensePlateField,
    vehicle_type: vehicleTypeField,
    engine_type: engineTypeField,
    motorbike_cc_group: motorbikeCcGroupField.optional(),
    car_body_type: carBodyTypeField.optional(),
    seat_count: z.coerce.number().int().min(2).max(16).optional(),
    brand: optionalStringField,
    model: optionalStringField,
    color: optionalColorField,
    is_default: z.boolean().optional(),
};

const updateVehicleShape = {
    raw_license_plate: z.preprocess(emptyToUndefined, licensePlateField.optional()),
    vehicle_type: vehicleTypeField.optional(),
    engine_type: engineTypeField.optional(),
    motorbike_cc_group: motorbikeCcGroupField.nullable().optional(),
    car_body_type: carBodyTypeField.nullable().optional(),
    seat_count: optionalSeatCountField,
    brand: nullableEmptyString,
    model: nullableEmptyString,
    color: z.preprocess((value) => {
        if (typeof value === 'string' && value.trim() === '') {
            return null;
        }

        return value;
    }, z.string().trim().max(50).nullable().optional()),
    is_default: z.boolean().optional(),
    is_active: z.boolean().optional(),
};

const createVehicleBodySchema = z
    .object(createVehicleShape)
    .strict()
    .refine(vehiclePayloadRule, {
        message: 'Vehicle detail does not match vehicle type',
    });

const updateVehicleBodySchema = z
    .object(updateVehicleShape)
    .strict()
    .refine(atLeastOneField, {
        message: 'At least one field is required',
    });

const idParamSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
});

const getMyVehiclesSchema = z.object({
    query: z
        .object({
            page: z.coerce.number().int().min(1).default(1),
            limit: z.coerce.number().int().min(1).max(100).default(20),
            search: z.preprocess(
                emptyToUndefined,
                z.string().trim().max(100).optional()
            ),
            vehicle_type: vehicleTypeField.optional(),
            engine_type: engineTypeField.optional(),
            is_active: stringBooleanField.optional(),
        })
        .strict(),
});

const getAdminVehiclesSchema = z.object({
    query: z
        .object({
            page: z.coerce.number().int().min(1).default(1),
            limit: z.coerce.number().int().min(1).max(100).default(20),
            search: z.preprocess(
                emptyToUndefined,
                z.string().trim().max(100).optional()
            ),
            customer_id: objectIdField.optional(),
            vehicle_type: vehicleTypeField.optional(),
            engine_type: engineTypeField.optional(),
            is_active: stringBooleanField.optional(),
        })
        .strict(),
});

const createMyVehicleSchema = z.object({
    body: createVehicleBodySchema,
});

const updateMyVehicleSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
    body: updateVehicleBodySchema,
});

const createAdminVehicleSchema = z.object({
    body: z
        .object({
            ...createVehicleShape,
            customer_id: objectIdField,
        })
        .strict()
        .refine(vehiclePayloadRule, {
            message: 'Vehicle detail does not match vehicle type',
        }),
});

const updateAdminVehicleSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
    body: z
        .object({
            ...updateVehicleShape,
            customer_id: objectIdField.optional(),
        })
        .strict()
        .refine(atLeastOneField, {
            message: 'At least one field is required',
        }),
});

module.exports = {
    idParamSchema,
    getMyVehiclesSchema,
    getAdminVehiclesSchema,
    createMyVehicleSchema,
    updateMyVehicleSchema,
    createAdminVehicleSchema,
    updateAdminVehicleSchema,
};
