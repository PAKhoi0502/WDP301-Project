const { z } = require('zod');

const { VEHICLE_TYPE_VALUES } = require('../../shared/constants/vehicle.constant');
const { WASH_BAY_MANUAL_STATUS_VALUES, WASH_BAY_STATUS_VALUES } = require('../../shared/constants/washBay.constant');

const emptyToUndefined = (value) => {
    if (typeof value === 'string' && value.trim() === '') {
        return undefined;
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

const bayCodeField = z
    .string()
    .trim()
    .min(2, 'Wash bay code must have at least 2 characters')
    .max(30, 'Wash bay code must have at most 30 characters')
    .regex(/^[A-Za-z0-9_-]+$/, 'Wash bay code is invalid');

const vehicleTypeField = z.enum(VEHICLE_TYPE_VALUES);
const washBayStatusField = z.enum(WASH_BAY_STATUS_VALUES);
const manualWashBayStatusField = z.enum(WASH_BAY_MANUAL_STATUS_VALUES);

const atLeastOneField = (data) => Object.values(data).some((value) => value !== undefined);

const idParamSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
});

const garageIdParamSchema = z.object({
    params: z
        .object({
            garageId: objectIdField,
        })
        .strict(),
    query: z
        .object({
            page: z.coerce.number().int().min(1).default(1),
            limit: z.coerce.number().int().min(1).max(100).default(20),
            search: z.preprocess(
                emptyToUndefined,
                z.string().trim().max(100).optional()
            ),
            vehicle_type: vehicleTypeField.optional(),
            status: washBayStatusField.optional(),
            is_active: stringBooleanField.optional(),
        })
        .strict(),
});

const availableWashBaysByGarageSchema = z.object({
    params: z
        .object({
            garageId: objectIdField,
        })
        .strict(),
    query: z
        .object({
            vehicle_type: vehicleTypeField.optional(),
        })
        .strict(),
});

const getWashBaysSchema = z.object({
    query: z
        .object({
            page: z.coerce.number().int().min(1).default(1),
            limit: z.coerce.number().int().min(1).max(100).default(20),
            search: z.preprocess(
                emptyToUndefined,
                z.string().trim().max(100).optional()
            ),
            garage_id: objectIdField.optional(),
            vehicle_type: vehicleTypeField.optional(),
            status: washBayStatusField.optional(),
            is_active: stringBooleanField.optional(),
        })
        .strict(),
});

const createWashBaySchema = z.object({
    body: z
        .object({
            garage_id: objectIdField,
            name: z.string().trim().min(2).max(100),
            bay_code: bayCodeField,
            vehicle_type: vehicleTypeField,
            status: manualWashBayStatusField.optional(),
            is_active: z.boolean().optional(),
        })
        .strict(),
});

const updateWashBaySchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
    body: z
        .object({
            garage_id: objectIdField.optional(),
            name: z.preprocess(
                emptyToUndefined,
                z.string().trim().min(2).max(100).optional()
            ),
            bay_code: z.preprocess(emptyToUndefined, bayCodeField.optional()),
            vehicle_type: vehicleTypeField.optional(),
            is_active: z.boolean().optional(),
        })
        .strict()
        .refine(atLeastOneField, {
            message: 'At least one field is required',
        }),
});

const updateWashBayStatusSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
    body: z
        .object({
            status: manualWashBayStatusField,
        })
        .strict(),
});

module.exports = {
    idParamSchema,
    garageIdParamSchema,
    availableWashBaysByGarageSchema,
    getWashBaysSchema,
    createWashBaySchema,
    updateWashBaySchema,
    updateWashBayStatusSchema,
};
