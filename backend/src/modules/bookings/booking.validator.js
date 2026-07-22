const { z } = require('zod');

const { VEHICLE_TYPE_VALUES } = require('../../shared/constants/vehicle.constant');
const { normalizePhone, isValidPhone } = require('../../shared/utils/phone');
const {
    BOOKING_STATUS_VALUES,
    BOOKING_LATE_RESOLUTION_VALUES,
    BOOKING_LATE_RESOLUTION,
} = require('../../shared/constants/booking.constant');

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

const optionalDateOnlyField = z.preprocess(
    emptyToUndefined,
    dateOnlyField.optional()
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

const optionalVoucherCodeField = z.preprocess(
    emptyToUndefined,
    z
        .string()
        .trim()
        .min(6)
        .max(40)
        .regex(/^[A-Za-z0-9_]+$/, 'Voucher code is invalid')
        .transform((value) => value.toUpperCase())
        .optional()
);

const optionalGuestPhoneField = z.preprocess(
    emptyToUndefined,
    z
        .string()
        .trim()
        .transform(normalizePhone)
        .refine(isValidPhone, 'Phone number is invalid')
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
            vehicle_id: optionalObjectIdField,
            service_package_id: objectIdField,
            add_on_service_ids: optionalObjectIdListField,
            date: optionalDateOnlyField,
            start_date: optionalDateOnlyField,
            days: z.preprocess(
                emptyToUndefined,
                z.coerce.number().int().min(1).max(7).optional()
            ),
        })
        .strict()
        .superRefine((data, context) => {
            if (!data.date && !data.start_date) {
                context.addIssue({
                    code: 'custom',
                    path: ['date'],
                    message: 'date or start_date is required',
                });
            }

            if (data.date && data.start_date) {
                context.addIssue({
                    code: 'custom',
                    path: ['start_date'],
                    message: 'Use either date or start_date, not both',
                });
            }
        }),
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
            voucher_code: optionalVoucherCodeField,
            used_points: z.coerce.number().int().min(0).default(0),
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
            start_time: z.preprocess(emptyToUndefined, isoDateTimeField.optional()),
            serve_now: z.boolean().default(false),
            suggestion_days: z.coerce.number().int().min(1).max(7).default(1),
            guest_name: optionalTextField(120),
            guest_phone: optionalGuestPhoneField,
            guest_email: z.preprocess(
                emptyToUndefined,
                z.string().trim().email().max(120).optional()
            ),
            license_plate: z.string().trim().min(3).max(30),
            vehicle_type: z.enum(VEHICLE_TYPE_VALUES),
            promotion_code: optionalPromotionCodeField,
            note: optionalTextField(1000),
        })
        .strict()
        .superRefine((data, context) => {
            if (!data.serve_now && !data.start_time) {
                context.addIssue({
                    code: 'custom',
                    path: ['start_time'],
                    message: 'start_time is required unless serve_now is true',
                });
            }

            if (data.serve_now && data.start_time) {
                context.addIssue({
                    code: 'custom',
                    path: ['start_time'],
                    message: 'Do not provide start_time when serve_now is true',
                });
            }
        }),
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

const markNoShowSchema = z.object({
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

const startServiceSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
    body: z
        .object({
            note: optionalTextField(1000),
            allow_early_start: z.boolean().default(false),
        })
        .strict()
        .default({}),
});

const getLateArrivalOptionsSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
    query: z
        .object({
            days: z.coerce.number().int().min(1).max(7).default(1),
        })
        .strict(),
});

const resolveLateArrivalSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
    body: z
        .object({
            resolution: z.enum(BOOKING_LATE_RESOLUTION_VALUES),
            new_start_time: z.preprocess(
                emptyToUndefined,
                isoDateTimeField.optional()
            ),
            reason: optionalTextField(500),
            note: optionalTextField(1000),
        })
        .strict()
        .superRefine((data, context) => {
            if (
                data.resolution === BOOKING_LATE_RESOLUTION.RESCHEDULED
                && !data.new_start_time
            ) {
                context.addIssue({
                    code: 'custom',
                    path: ['new_start_time'],
                    message: 'new_start_time is required for reschedule',
                });
            }

            if (
                data.resolution === BOOKING_LATE_RESOLUTION.ACCEPT_WITHIN_ORIGINAL_WINDOW
                && data.new_start_time
            ) {
                context.addIssue({
                    code: 'custom',
                    path: ['new_start_time'],
                    message: 'new_start_time is not allowed when accepting the original window',
                });
            }
        }),
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

const bookingItemKeyField = z
    .string()
    .trim()
    .min(3)
    .max(100)
    .regex(/^[A-Za-z0-9_]+$/, 'Invalid booking service item key');

const serviceItemParamSchema = z.object({
    params: z
        .object({
            id: objectIdField,
            itemKey: bookingItemKeyField,
        })
        .strict(),
    body: z.object({}).strict().default({}),
});

const serviceItemOperationSchema = z.object({
    params: z
        .object({
            id: objectIdField,
            itemKey: bookingItemKeyField,
        })
        .strict(),
    body: z
        .object({
            note: optionalTextField(1000),
        })
        .strict()
        .default({}),
});

const pauseServiceItemSchema = z.object({
    params: z
        .object({
            id: objectIdField,
            itemKey: bookingItemKeyField,
        })
        .strict(),
    body: z
        .object({
            reason: z.string().trim().min(2).max(500),
        })
        .strict(),
});

const assignInspectionStaffSchema = z.object({
    params: z
        .object({
            id: objectIdField,
        })
        .strict(),
    body: z
        .object({
            staff_profile_id: objectIdField,
        })
        .strict(),
});

const assignServiceItemStaffSchema = z.object({
    params: z
        .object({
            id: objectIdField,
            itemKey: bookingItemKeyField,
        })
        .strict(),
    body: z
        .object({
            staff_profile_id: objectIdField,
        })
        .strict(),
});

module.exports = {
    idParamSchema,
    getAvailableSlotsSchema,
    getMyBookingsSchema,
    getAdminBookingsSchema,
    createCustomerBookingSchema,
    createWalkInBookingSchema,
    cancelBookingSchema,
    markNoShowSchema,
    bookingOperationSchema,
    startServiceSchema,
    getLateArrivalOptionsSchema,
    resolveLateArrivalSchema,
    assignWashBaySchema,
    serviceStepParamSchema,
    serviceItemParamSchema,
    serviceItemOperationSchema,
    pauseServiceItemSchema,
    assignInspectionStaffSchema,
    assignServiceItemStaffSchema,
};
