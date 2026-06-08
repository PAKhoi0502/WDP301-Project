const { z } = require('zod');

const { VEHICLE_TYPE_VALUES } = require('../../shared/constants/vehicle.constant');
const { BOOKING_STATUS_VALUES } = require('../../shared/constants/booking.constant');

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

const isoDateTimeField = z
    .string()
    .trim()
    .datetime({ offset: true, message: 'Datetime must be ISO 8601 with timezone offset' });

const dateOnlyField = z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

const paginationQueryFields = {
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
};

const optionalDateTimeFilter = z.preprocess(
    emptyToUndefined,
    isoDateTimeField.optional()
);

const optionalObjectIdField = z.preprocess(
    emptyToUndefined,
    objectIdField.optional()
);

const optionalObjectIdListField = z.preprocess((value) => {
    if (value === undefined || value === null || value === '') {
        return [];
    }

    if (Array.isArray(value)) {
        return value;
    }

    if (typeof value === 'string') {
        return value.split(',').map((item) => item.trim()).filter(Boolean);
    }

    return value;
}, z.array(objectIdField).default([]));

const optionalTextField = (max = 100) => z.preprocess(
    emptyToUndefined,
    z.string().trim().max(max).optional()
);

const optionalPromotionCodeField = z.preprocess(
    emptyToUndefined,
    z
        .string()
        .trim()
        .min(2)
        .max(40)
        .regex(/^[A-Za-z0-9_]+$/, 'Promotion code is invalid')
        .transform((value) => value.toUpperCase())
        .optional()
);

const idParamSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
});

const getAvailableSlotsSchema = z.object({
    query: z
        .object({
            garage_id: objectIdField,
            service_package_id: objectIdField,
            add_on_service_ids: optionalObjectIdListField,
            date: dateOnlyField,
        })
        .strict(),
});

const getMyBookingsSchema = z.object({
    query: z
        .object({
            ...paginationQueryFields,
            status: z.enum(BOOKING_STATUS_VALUES).optional(),
            garage_id: optionalObjectIdField,
            vehicle_id: optionalObjectIdField,
            service_package_id: optionalObjectIdField,
            from: optionalDateTimeFilter,
            to: optionalDateTimeFilter,
        })
        .strict(),
});

const getAdminBookingsSchema = z.object({
    query: z
        .object({
            ...paginationQueryFields,
            search: optionalTextField(100),
            status: z.enum(BOOKING_STATUS_VALUES).optional(),
            garage_id: optionalObjectIdField,
            customer_id: optionalObjectIdField,
            vehicle_id: optionalObjectIdField,
            service_package_id: optionalObjectIdField,
            vehicle_type: z.enum(VEHICLE_TYPE_VALUES).optional(),
            is_walk_in: stringBooleanField.optional(),
            from: optionalDateTimeFilter,
            to: optionalDateTimeFilter,
        })
        .strict(),
});

const createCustomerBookingSchema = z.object({
    body: z
        .object({
            garage_id: objectIdField,
            vehicle_id: objectIdField,
            service_package_id: objectIdField,
            add_on_service_ids: z.array(objectIdField).default([]),
            start_time: isoDateTimeField,
            promotion_code: optionalPromotionCodeField,
            note: optionalTextField(1000),
        })
        .strict(),
});

const createWalkInBookingSchema = z.object({
    body: z
        .object({
            garage_id: objectIdField,
            service_package_id: objectIdField,
            add_on_service_ids: z.array(objectIdField).default([]),
            start_time: isoDateTimeField,
            guest_name: z.string().trim().min(2).max(120),
            guest_phone: z.string().trim().min(8).max(20),
            guest_email: z.preprocess(
                emptyToUndefined,
                z.string().trim().email().max(120).optional()
            ),
            license_plate: z.string().trim().min(3).max(30),
            vehicle_type: z.enum(VEHICLE_TYPE_VALUES),
            promotion_code: optionalPromotionCodeField,
            note: optionalTextField(1000),
        })
        .strict(),
});

const cancelBookingSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
    body: z
        .object({
            reason: optionalTextField(500),
        })
        .strict()
        .default({}),
});

const bookingOperationSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
    body: z
        .object({
            note: optionalTextField(1000),
        })
        .strict()
        .default({}),
});

const assignWashBaySchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
    body: z
        .object({
            wash_bay_id: optionalObjectIdField,
        })
        .strict()
        .default({}),
});

const serviceStepParamSchema = z.object({
    params: z
        .object({
            id: objectIdField,
            stepId: objectIdField,
        })
        .strict(),
    body: z
        .object({
            note: optionalTextField(1000),
        })
        .strict()
        .default({}),
});

module.exports = {
    idParamSchema,
    getAvailableSlotsSchema,
    getMyBookingsSchema,
    getAdminBookingsSchema,
    createCustomerBookingSchema,
    createWalkInBookingSchema,
    cancelBookingSchema,
    bookingOperationSchema,
    assignWashBaySchema,
    serviceStepParamSchema,
};
