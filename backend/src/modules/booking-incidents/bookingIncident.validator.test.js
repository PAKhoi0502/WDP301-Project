const {
    reportBookingIncidentSchema,
    customerIncidentDecisionSchema,
    staffIncidentDecisionSchema,
} = require('./bookingIncident.validator');

describe('booking incident validator', () => {
    const bookingId = '507f1f77bcf86cd799439011';
    const incidentId = '507f1f77bcf86cd799439012';

    it('requires a description for other garage incidents', () => {
        const result = reportBookingIncidentSchema.safeParse({
            params: { id: bookingId },
            body: {
                incident_type: 'OTHER_GARAGE_INCIDENT',
            },
        });

        expect(result.success).toBe(false);
    });

    it('accepts a wash bay incident without a free-text description', () => {
        const result = reportBookingIncidentSchema.safeParse({
            params: { id: bookingId },
            body: {
                incident_type: 'WASH_BAY_FAILURE',
            },
        });

        expect(result.success).toBe(true);
    });

    it('requires the exact assigned staff profile for a staff incident', () => {
        const missingStaff = reportBookingIncidentSchema.safeParse({
            params: { id: bookingId },
            body: {
                incident_type: 'STAFF_UNAVAILABLE',
                affected_booking_item_key: 'ITEM_1',
            },
        });
        const validIncident = reportBookingIncidentSchema.safeParse({
            params: { id: bookingId },
            body: {
                incident_type: 'STAFF_UNAVAILABLE',
                affected_booking_item_key: 'ITEM_1',
                affected_staff_profile_id: '507f1f77bcf86cd799439099',
            },
        });

        expect(missingStaff.success).toBe(false);
        expect(validIncident.success).toBe(true);
    });

    it('lets the backend select the nearest reschedule slot', () => {
        const result = customerIncidentDecisionSchema.safeParse({
            params: { id: bookingId, incidentId },
            body: {
                decision: 'RESCHEDULE_NEAREST',
            },
        });

        expect(result.success).toBe(true);
    });

    it('requires a selected time for custom rescheduling', () => {
        const result = customerIncidentDecisionSchema.safeParse({
            params: { id: bookingId, incidentId },
            body: {
                decision: 'RESCHEDULE_CUSTOM',
            },
        });

        expect(result.success).toBe(false);
    });

    it('rejects a client-selected time for nearest rescheduling', () => {
        const result = customerIncidentDecisionSchema.safeParse({
            params: { id: bookingId, incidentId },
            body: {
                decision: 'RESCHEDULE_NEAREST',
                new_start_time: '2999-01-01T09:00:00.000Z',
            },
        });

        expect(result.success).toBe(false);
    });

    it('requires staff to record the customer contact channel', () => {
        const missingChannel = staffIncidentDecisionSchema.safeParse({
            params: { id: bookingId, incidentId },
            body: {
                decision: 'CANCEL_BY_GARAGE',
            },
        });
        const validDecision = staffIncidentDecisionSchema.safeParse({
            params: { id: bookingId, incidentId },
            body: {
                decision: 'CANCEL_BY_GARAGE',
                contact_channel: 'PHONE',
            },
        });

        expect(missingChannel.success).toBe(false);
        expect(validDecision.success).toBe(true);
    });
});
