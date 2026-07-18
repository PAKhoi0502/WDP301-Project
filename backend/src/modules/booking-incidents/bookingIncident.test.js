const mongoose = require('mongoose');

const BookingIncident = require('./bookingIncident.model');

describe('booking incident model', () => {
    const createIncident = (overrides = {}) => new BookingIncident({
        booking_id: new mongoose.Types.ObjectId(),
        garage_id: new mongoose.Types.ObjectId(),
        customer_id: new mongoose.Types.ObjectId(),
        incident_type: 'WASH_BAY_FAILURE',
        reported_by_id: new mongoose.Types.ObjectId(),
        reported_booking_status: 'IN_PROGRESS',
        reported_schedule_snapshot: {
            start_time: new Date('2999-01-01T06:00:00.000Z'),
            end_time: new Date('2999-01-01T07:00:00.000Z'),
        },
        ...overrides,
    });

    it('accepts a structured wash bay incident', async () => {
        const incident = createIncident({
            affected_wash_bay_id: new mongoose.Types.ObjectId(),
        });

        await expect(incident.validate()).resolves.toBeUndefined();
    });

    it('rejects another garage incident without a description', async () => {
        const incident = createIncident({
            incident_type: 'OTHER_GARAGE_INCIDENT',
        });

        await expect(incident.validate()).rejects.toMatchObject({
            errors: {
                description: expect.anything(),
            },
        });
    });
});
