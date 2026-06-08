const mongoose = require('mongoose');

const Booking = require('./booking.model');

describe('booking module', () => {
    const createBooking = (overrides = {}) => new Booking({
        customer_id: new mongoose.Types.ObjectId(),
        vehicle_id: new mongoose.Types.ObjectId(),
        is_walk_in: false,
        vehicle_type: 'CAR',
        garage_id: new mongoose.Types.ObjectId(),
        service_package_id: new mongoose.Types.ObjectId(),
        booking_date: new Date('2999-01-01T00:00:00.000Z'),
        start_time: new Date('2999-01-01T06:00:00.000Z'),
        end_time: new Date('2999-01-01T07:30:00.000Z'),
        original_price: 250000,
        final_price: 250000,
        ...overrides,
    });

    it('allows booking with valid care staff snapshot', async () => {
        const booking = createBooking({
            requires_care_staff: true,
            care_staff_type: 'VEHICLE_CARE_STAFF',
            care_staff_required_count: 1,
            care_staff_start_time: new Date('2999-01-01T06:00:00.000Z'),
            care_staff_end_time: new Date('2999-01-01T07:30:00.000Z'),
        });

        await expect(booking.validate()).resolves.toBeUndefined();
    });

    it('rejects booking that requires care staff without care staff time', async () => {
        const booking = createBooking({
            requires_care_staff: true,
            care_staff_type: 'VEHICLE_CARE_STAFF',
            care_staff_required_count: 1,
        });

        await expect(booking.validate()).rejects.toMatchObject({
            errors: {
                care_staff_start_time: expect.anything(),
            },
        });
    });

    it('clears care staff snapshot when booking does not require care staff', async () => {
        const booking = createBooking({
            requires_care_staff: false,
            care_staff_type: 'VEHICLE_CARE_STAFF',
            care_staff_required_count: 1,
            care_staff_start_time: new Date('2999-01-01T06:00:00.000Z'),
            care_staff_end_time: new Date('2999-01-01T07:30:00.000Z'),
            assigned_care_staff_ids: [new mongoose.Types.ObjectId()],
        });

        await expect(booking.validate()).resolves.toBeUndefined();

        expect(booking.care_staff_type).toBeNull();
        expect(booking.care_staff_required_count).toBe(0);
        expect(booking.care_staff_start_time).toBeNull();
        expect(booking.care_staff_end_time).toBeNull();
        expect(booking.assigned_care_staff_ids).toHaveLength(0);
    });
});
