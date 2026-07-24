const { z } = require('zod');

const {
    VEHICLE_INSPECTION_TYPES,
    VEHICLE_INSPECTION_TYPE_VALUES,
} = require('../../shared/constants/vehicleInspection.constant');

const emptyToUndefined = (value) => {
    if (typeof value === 'string' && value.trim() === '') {
        return undefined;
    }

    return value;
};

const objectIdField = z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid resource id');

const optionalTextField = (max = 100) => z.preprocess(
    emptyToUndefined,
    z.string().trim().max(max).optional()
);

const imageSchema = z.object({
    image_url: z.string().trim().min(1).max(1000),
    public_id: optionalTextField(255),
    caption: optionalTextField(255),
}).strict();

const createVehicleInspectionBodySchema = z
    .object({
        type: z.enum(VEHICLE_INSPECTION_TYPE_VALUES),
        note: optionalTextField(2000),
        images: z.array(imageSchema).max(20).default([]),
    })
    .strict()
    .superRefine((value, context) => {
        if (
            value.type === VEHICLE_INSPECTION_TYPES.AFTER_WASH
            && value.images.length === 0
        ) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['images'],
                message: 'After-wash inspection requires at least one image',
            });
        }
    });

const createVehicleInspectionSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
    body: createVehicleInspectionBodySchema,
});

const getVehicleInspectionsSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
});

module.exports = {
    createVehicleInspectionSchema,
    getVehicleInspectionsSchema,
};
