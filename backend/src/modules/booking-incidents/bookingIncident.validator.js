const { z } = require('zod');

const {
    BOOKING_INCIDENT_TYPES,
    BOOKING_INCIDENT_TYPE_VALUES,
    BOOKING_INCIDENT_DECISIONS,
    BOOKING_INCIDENT_DECISION_VALUES,
    BOOKING_INCIDENT_CONTACT_CHANNELS,
    BOOKING_INCIDENT_CONTACT_CHANNEL_VALUES,
    BOOKING_INCIDENT_CONTINUATION_POLICY_VALUES,
} = require('../../shared/constants/bookingIncident.constant');
const {
    createCompensationVoucherBodySchema,
} = require('../customer-vouchers/customerVoucher.validator');

const objectIdField = z.string().trim().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const optionalTextField = (max) => z.preprocess(
    (value) => value === '' || value === null ? undefined : value,
    z.string().trim().max(max).optional()
);

const bookingParamSchema = z.object({
    params: z.object({ id: objectIdField }).strict(),
});

const incidentParamSchema = z.object({
    params: z.object({
        id: objectIdField,
        incidentId: objectIdField,
    }).strict(),
});

const reportBookingIncidentSchema = z.object({
    params: z.object({ id: objectIdField }).strict(),
    body: z.object({
        incident_type: z.enum(BOOKING_INCIDENT_TYPE_VALUES),
        description: optionalTextField(1000),
        affected_booking_item_key: optionalTextField(100),
        affected_wash_bay_id: objectIdField.nullable().optional(),
        affected_staff_profile_id: objectIdField.nullable().optional(),
    }).strict().superRefine((data, context) => {
        if (
            data.incident_type === BOOKING_INCIDENT_TYPES.OTHER_GARAGE_INCIDENT
            && !data.description
        ) {
            context.addIssue({
                code: 'custom',
                path: ['description'],
                message: 'description is required for other garage incidents',
            });
        }

        if (
            data.incident_type === BOOKING_INCIDENT_TYPES.STAFF_UNAVAILABLE
            && !data.affected_staff_profile_id
        ) {
            context.addIssue({
                code: 'custom',
                path: ['affected_staff_profile_id'],
                message: 'affected_staff_profile_id is required for staff unavailable incidents',
            });
        }
    }),
});

const getIncidentOptionsSchema = z.object({
    params: z.object({
        id: objectIdField,
        incidentId: objectIdField,
    }).strict(),
    query: z.object({
        days: z.coerce.number().int().min(1).max(7).default(3),
    }).strict(),
});

const decisionBodySchema = z.object({
    decision: z.enum(BOOKING_INCIDENT_DECISION_VALUES),
    new_start_time: z.string().datetime({ offset: true }).optional(),
    continuation_policy: z.enum(BOOKING_INCIDENT_CONTINUATION_POLICY_VALUES).optional(),
    customer_note: optionalTextField(1000),
}).strict();

const withDecisionRefinement = (schema) => schema.superRefine((data, context) => {
    if (
        data.decision === BOOKING_INCIDENT_DECISIONS.RESCHEDULE_CUSTOM
        && !data.new_start_time
    ) {
        context.addIssue({
            code: 'custom',
            path: ['new_start_time'],
            message: 'new_start_time is required for custom reschedule decision',
        });
    }

    if (
        data.decision !== BOOKING_INCIDENT_DECISIONS.RESCHEDULE_CUSTOM
        && data.new_start_time
    ) {
        context.addIssue({
            code: 'custom',
            path: ['new_start_time'],
            message: 'new_start_time is only allowed for custom reschedule decision',
        });
    }
});

const customerIncidentDecisionSchema = z.object({
    params: z.object({
        id: objectIdField,
        incidentId: objectIdField,
    }).strict(),
    body: withDecisionRefinement(decisionBodySchema),
});

const staffIncidentDecisionSchema = z.object({
    params: z.object({
        id: objectIdField,
        incidentId: objectIdField,
    }).strict(),
    body: withDecisionRefinement(decisionBodySchema.extend({
        contact_channel: z.enum([
            BOOKING_INCIDENT_CONTACT_CHANNELS.PHONE,
            BOOKING_INCIDENT_CONTACT_CHANNELS.IN_PERSON,
        ]),
    })),
});

const createIncidentCompensationVoucherSchema = z.object({
    params: z.object({
        id: objectIdField,
        incidentId: objectIdField,
    }).strict(),
    body: createCompensationVoucherBodySchema,
});

module.exports = {
    bookingParamSchema,
    incidentParamSchema,
    reportBookingIncidentSchema,
    getIncidentOptionsSchema,
    customerIncidentDecisionSchema,
    staffIncidentDecisionSchema,
    createIncidentCompensationVoucherSchema,
    BOOKING_INCIDENT_CONTACT_CHANNEL_VALUES,
};
