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

    it('clears booking item care staff assignments when item does not require care staff', async () => {
        const booking = createBooking({
            booking_items: [
                {
                    item_key: 'ITEM_1',
                    service_package_id: new mongoose.Types.ObjectId(),
                    source: 'PRIMARY',
                    name_snapshot: 'Manual inspection',
                    duration_minutes: 30,
                    sequence: 1,
                    requires_care_staff: false,
                    care_staff_type: 'VEHICLE_CARE_STAFF',
                    care_staff_required_count: 1,
                    care_staff_start_time: new Date('2999-01-01T06:00:00.000Z'),
                    care_staff_end_time: new Date('2999-01-01T06:30:00.000Z'),
                    assigned_care_staff: [
                        {
                            staff_profile_id: new mongoose.Types.ObjectId(),
                            user_id: new mongoose.Types.ObjectId(),
                            assigned_at: new Date('2999-01-01T06:00:00.000Z'),
                        },
                    ],
                },
            ],
        });

        await expect(booking.validate()).resolves.toBeUndefined();

        expect(booking.booking_items[0].care_staff_type).toBeNull();
        expect(booking.booking_items[0].care_staff_required_count).toBe(0);
        expect(booking.booking_items[0].care_staff_start_time).toBeNull();
        expect(booking.booking_items[0].care_staff_end_time).toBeNull();
        expect(booking.booking_items[0].assigned_care_staff).toHaveLength(0);
    });

    it('accepts late arrival and reschedule metadata', async () => {
        const staffId = new mongoose.Types.ObjectId();
        const booking = createBooking({
            arrival_status: 'LATE',
            arrived_at: new Date('2999-01-01T06:45:00.000Z'),
            arrival_reference_start_time: new Date('2999-01-01T06:00:00.000Z'),
            late_minutes: 45,
            grace_exceeded_minutes: 30,
            late_resolution: 'RESCHEDULED',
            original_start_time: new Date('2999-01-01T06:00:00.000Z'),
            original_end_time: new Date('2999-01-01T07:30:00.000Z'),
            rescheduled_at: new Date('2999-01-01T06:46:00.000Z'),
            rescheduled_by_id: staffId,
            reschedule_reason: 'CUSTOMER_LATE',
            reschedule_count: 1,
        });

        await expect(booking.validate()).resolves.toBeUndefined();
    });

    it('requires an active incident while awaiting customer decision', async () => {
        const booking = createBooking({
            operation_status: 'AWAITING_CUSTOMER_DECISION',
        });

        await expect(booking.validate()).rejects.toMatchObject({
            errors: {
                active_incident_id: expect.anything(),
            },
        });
    });

    it('requires an incident reference for garage cancellation', async () => {
        const booking = createBooking({
            cancellation_source: 'GARAGE_INCIDENT',
        });

        await expect(booking.validate()).rejects.toMatchObject({
            errors: {
                cancellation_incident_id: expect.anything(),
            },
        });
    });

    it('accepts a fully waived booking with complete audit information', async () => {
        const booking = createBooking({
            final_price: 0,
            payment_status: 'WAIVED',
            pre_waiver_final_price: 250000,
            waived_amount: 250000,
            payment_waived_at: new Date(),
            payment_waived_by_id: new mongoose.Types.ObjectId(),
            payment_waiver_case_id: new mongoose.Types.ObjectId(),
            payment_waiver_reason: 'Garage accepts responsibility for vehicle damage.',
        });

        await expect(booking.validate()).resolves.toBeUndefined();
    });

    it('rejects waiver amounts that do not reconcile with final price', async () => {
        const booking = createBooking({
            final_price: 150000,
            pre_waiver_final_price: 250000,
            waived_amount: 50000,
        });

        await expect(booking.validate()).rejects.toMatchObject({
            errors: {
                waived_amount: expect.anything(),
            },
        });
    });
});
