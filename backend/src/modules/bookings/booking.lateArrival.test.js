const mongoose = require('mongoose');

jest.mock('./booking.model', () => ({
    aggregate: jest.fn(),
    findById: jest.fn(),
}));
jest.mock('../users/user.model', () => ({}));
jest.mock('../vehicles/vehicle.model', () => ({}));
jest.mock('../garages/garage.model', () => ({
    findById: jest.fn(),
}));
jest.mock('../wash-bays/washBay.model', () => ({
    countDocuments: jest.fn(),
}));
jest.mock('../wash-bays/washBay.service', () => ({}));
jest.mock('../staff-profiles/staffProfile.model', () => ({
    countDocuments: jest.fn(),
}));
jest.mock('../service-packages/servicePackage.model', () => ({}));
jest.mock('../booking-service-steps/bookingServiceStep.service', () => ({}));
jest.mock('./bookingPayment.service', () => ({}));
jest.mock('../audit-logs/auditLog.service', () => ({
    recordAuditEvent: jest.fn(),
}));
jest.mock('../promotions/promotion.service', () => ({}));
jest.mock('../loyalty/loyalty.service', () => ({}));
jest.mock('../loyalty/customerLoyalty.model', () => ({}));
jest.mock('../loyalty/tierRule.model', () => ({}));

const Booking = require('./booking.model');
const Garage = require('../garages/garage.model');
const StaffProfile = require('../staff-profiles/staffProfile.model');
const auditLogService = require('../audit-logs/auditLog.service');
const bookingService = require('./booking.service');

const createPopulateQuery = (result) => ({
    populate: jest.fn().mockReturnThis(),
    then(resolve, reject) {
        return Promise.resolve(result).then(resolve, reject);
    },
});

describe('booking late arrival', () => {
    const bookingId = new mongoose.Types.ObjectId();
    const garageId = new mongoose.Types.ObjectId();
    const vehicleId = new mongoose.Types.ObjectId();
    const staffId = new mongoose.Types.ObjectId();
    const adminUser = {
        _id: staffId,
        role: 'ADMIN',
    };
    const garage = {
        _id: garageId,
        is_active: true,
        opening_time: '07:00',
        closing_time: '19:00',
        slot_interval_minutes: 30,
        late_grace_minutes: 15,
    };

    const createLateBooking = (overrides = {}) => ({
        _id: bookingId,
        garage_id: garageId,
        vehicle_id: vehicleId,
        vehicle_type: 'CAR',
        is_walk_in: false,
        status: 'CONFIRMED',
        start_time: new Date('2026-06-11T04:00:00.000Z'),
        end_time: new Date('2026-06-11T05:30:00.000Z'),
        booking_date: new Date('2026-06-10T17:00:00.000Z'),
        arrival_status: 'LATE',
        arrived_at: new Date('2026-06-11T04:45:00.000Z'),
        arrival_reference_start_time: new Date('2026-06-11T04:00:00.000Z'),
        late_minutes: 45,
        grace_exceeded_minutes: 30,
        late_resolution: null,
        checked_in_at: null,
        reschedule_count: 0,
        requires_wash_bay: false,
        requires_care_staff: true,
        care_staff_type: 'VEHICLE_CARE_STAFF',
        care_staff_required_count: 1,
        care_staff_start_time: new Date('2026-06-11T04:00:00.000Z'),
        care_staff_end_time: new Date('2026-06-11T05:30:00.000Z'),
        care_staff_work_end_time: new Date('2026-06-11T05:30:00.000Z'),
        care_staff_reserved_until: new Date('2026-06-11T05:30:00.000Z'),
        assigned_care_staff_ids: [new mongoose.Types.ObjectId()],
        booking_items: [
            {
                item_key: 'ITEM_1',
                service_package_id: new mongoose.Types.ObjectId(),
                source: 'PRIMARY',
                name_snapshot: 'Interior care',
                duration_minutes: 90,
                sequence: 1,
                item_start_time: new Date('2026-06-11T04:00:00.000Z'),
                item_end_time: new Date('2026-06-11T05:30:00.000Z'),
                requires_wash_bay: false,
                requires_care_staff: true,
                care_staff_type: 'VEHICLE_CARE_STAFF',
                care_staff_required_count: 1,
                care_staff_start_time: new Date('2026-06-11T04:00:00.000Z'),
                care_staff_end_time: new Date('2026-06-11T05:30:00.000Z'),
                care_staff_work_end_time: new Date('2026-06-11T05:30:00.000Z'),
                care_staff_reserved_until: new Date('2026-06-11T05:30:00.000Z'),
                assigned_care_staff: [
                    {
                        staff_profile_id: new mongoose.Types.ObjectId(),
                        user_id: new mongoose.Types.ObjectId(),
                    },
                ],
                status: 'PENDING',
            },
        ],
        save: jest.fn().mockResolvedValue(undefined),
        markModified: jest.fn(),
        ...overrides,
    });

    beforeEach(() => {
        jest.resetAllMocks();
        Garage.findById.mockResolvedValue(garage);
        StaffProfile.countDocuments.mockResolvedValue(2);
        Booking.aggregate.mockResolvedValue([]);
        auditLogService.recordAuditEvent.mockResolvedValue(null);
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('checks in normally at the exact grace boundary', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-06-11T04:15:00.000Z'));
        const booking = createLateBooking({
            arrival_status: null,
            arrived_at: null,
            arrival_reference_start_time: null,
            late_minutes: 0,
            grace_exceeded_minutes: 0,
        });
        Booking.findById
            .mockReturnValueOnce(booking)
            .mockReturnValueOnce(createPopulateQuery(booking));

        const result = await bookingService.checkInBooking(adminUser, bookingId, {});

        expect(result).toMatchObject({
            status: 'CHECKED_IN',
            arrival_status: 'ON_TIME',
            late_minutes: 0,
            grace_exceeded_minutes: 0,
            late_resolution_required: false,
        });
        expect(booking.checked_in_at.toISOString()).toBe('2026-06-11T04:15:00.000Z');
    });

    it('records arrival as late immediately after the grace boundary', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-06-11T04:15:01.000Z'));
        const booking = createLateBooking({
            arrival_status: null,
            arrived_at: null,
            arrival_reference_start_time: null,
            late_minutes: 0,
            grace_exceeded_minutes: 0,
        });
        Booking.findById
            .mockReturnValueOnce(booking)
            .mockReturnValueOnce(createPopulateQuery(booking));

        const result = await bookingService.checkInBooking(adminUser, bookingId, {});

        expect(result).toMatchObject({
            status: 'CONFIRMED',
            arrival_status: 'LATE',
            late_minutes: 15,
            grace_exceeded_minutes: 0,
            late_resolution_required: true,
        });
        expect(booking.checked_in_at).toBeNull();
        expect(auditLogService.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
            action: 'BOOKING_ARRIVAL_RECORDED',
        }));
    });

    it('does not allow no-show after the customer has arrived', async () => {
        const booking = createLateBooking();
        Booking.findById.mockReturnValueOnce(booking);

        await expect(bookingService.markNoShow(adminUser, bookingId, {
            reason: 'CUSTOMER_TOO_LATE',
        })).rejects.toMatchObject({
            statusCode: 409,
            errorCode: 'BOOKING_ARRIVED_CANNOT_NO_SHOW',
        });

        expect(booking.save).not.toHaveBeenCalled();
    });

    it('suggests slots from the next garage interval and excludes the current booking', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-06-11T04:45:00.000Z'));
        const booking = createLateBooking();
        Booking.findById.mockReturnValueOnce(booking);

        const result = await bookingService.getLateArrivalOptions(adminUser, bookingId, {
            days: 1,
        });

        expect(result.search_start_time.toISOString()).toBe('2026-06-11T05:00:00.000Z');
        expect(result.suggested_slots[0].start_time.toISOString()).toBe('2026-06-11T05:00:00.000Z');
        expect(result.suggested_slots[0].end_time.toISOString()).toBe('2026-06-11T06:30:00.000Z');
        expect(JSON.stringify(Booking.aggregate.mock.calls)).toContain(bookingId.toString());
        expect(JSON.stringify(Booking.aggregate.mock.calls)).toContain('$ne');
    });

    it('suggests replacement slots for a late scheduled walk-in', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-06-11T04:45:00.000Z'));
        const booking = createLateBooking({
            is_walk_in: true,
            vehicle_id: null,
        });
        Booking.findById.mockReturnValueOnce(booking);

        const result = await bookingService.getLateArrivalOptions(adminUser, bookingId, {
            days: 1,
        });

        expect(result.suggested_slots[0].start_time.toISOString()).toBe('2026-06-11T05:00:00.000Z');
    });

    it('accepts a late customer within the original timeline without shifting it', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-06-11T04:46:00.000Z'));
        const booking = createLateBooking();
        const originalStartTime = booking.start_time;
        const originalEndTime = booking.end_time;
        const session = {
            withTransaction: jest.fn(async (callback) => callback()),
            endSession: jest.fn().mockResolvedValue(undefined),
        };
        jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
        Booking.findById
            .mockReturnValueOnce(booking)
            .mockReturnValueOnce(createPopulateQuery(booking));

        const result = await bookingService.resolveLateArrival(adminUser, bookingId, {
            resolution: 'ACCEPT_WITHIN_ORIGINAL_WINDOW',
            note: 'Garage can still complete the service on time',
        });

        expect(result.status).toBe('CHECKED_IN');
        expect(booking.start_time).toBe(originalStartTime);
        expect(booking.end_time).toBe(originalEndTime);
        expect(booking.late_resolution).toBe('ACCEPT_WITHIN_ORIGINAL_WINDOW');
        expect(booking.late_accepted_by_id).toBe(staffId);
        expect(booking.save).toHaveBeenCalledWith({ session });
        expect(auditLogService.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
            action: 'BOOKING_LATE_ACCEPTED',
            session,
        }));
    });

    it('does not accept the original timeline after its reservation window has expired', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-06-11T05:30:00.000Z'));
        const booking = createLateBooking();
        const session = {
            withTransaction: jest.fn(async (callback) => callback()),
            endSession: jest.fn().mockResolvedValue(undefined),
        };
        jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
        Booking.findById.mockReturnValueOnce(booking);

        await expect(bookingService.resolveLateArrival(adminUser, bookingId, {
            resolution: 'ACCEPT_WITHIN_ORIGINAL_WINDOW',
        })).rejects.toMatchObject({
            statusCode: 409,
            errorCode: 'BOOKING_ORIGINAL_WINDOW_EXPIRED',
        });

        expect(booking.save).not.toHaveBeenCalled();
        expect(session.endSession).toHaveBeenCalled();
    });

    it('reschedules the complete booking timeline and preserves the original schedule', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-06-11T04:45:00.000Z'));
        const booking = createLateBooking();
        const session = {
            withTransaction: jest.fn(async (callback) => callback()),
            endSession: jest.fn().mockResolvedValue(undefined),
        };
        jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
        Booking.findById
            .mockReturnValueOnce(booking)
            .mockReturnValueOnce(createPopulateQuery(booking));

        const result = await bookingService.resolveLateArrival(adminUser, bookingId, {
            resolution: 'RESCHEDULED',
            new_start_time: '2026-06-11T12:00:00+07:00',
            reason: 'CUSTOMER_LATE',
        });

        expect(result.status).toBe('CHECKED_IN');
        expect(booking.original_start_time.toISOString()).toBe('2026-06-11T04:00:00.000Z');
        expect(booking.original_end_time.toISOString()).toBe('2026-06-11T05:30:00.000Z');
        expect(booking.start_time.toISOString()).toBe('2026-06-11T05:00:00.000Z');
        expect(booking.end_time.toISOString()).toBe('2026-06-11T06:30:00.000Z');
        expect(booking.booking_items[0].item_start_time.toISOString()).toBe('2026-06-11T05:00:00.000Z');
        expect(booking.booking_items[0].item_end_time.toISOString()).toBe('2026-06-11T06:30:00.000Z');
        expect(booking.booking_items[0].care_staff_reserved_until.toISOString()).toBe('2026-06-11T06:30:00.000Z');
        expect(booking.booking_items[0].assigned_care_staff).toEqual([]);
        expect(booking.assigned_care_staff_ids).toEqual([]);
        expect(booking.late_resolution).toBe('RESCHEDULED');
        expect(booking.reschedule_count).toBe(1);
        expect(booking.markModified).toHaveBeenCalledWith('booking_items');
        expect(auditLogService.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
            action: 'BOOKING_RESCHEDULED',
            session,
        }));
    });

    it('rejects a selected reschedule slot when capacity is no longer available', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-06-11T04:45:00.000Z'));
        const booking = createLateBooking();
        const session = {
            withTransaction: jest.fn(async (callback) => callback()),
            endSession: jest.fn().mockResolvedValue(undefined),
        };
        jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
        StaffProfile.countDocuments.mockResolvedValue(0);
        Booking.findById.mockReturnValueOnce(booking);

        await expect(bookingService.resolveLateArrival(adminUser, bookingId, {
            resolution: 'RESCHEDULED',
            new_start_time: '2026-06-11T12:00:00+07:00',
        })).rejects.toMatchObject({
            statusCode: 409,
            errorCode: 'SLOT_NO_LONGER_AVAILABLE',
        });

        expect(booking.save).not.toHaveBeenCalled();
        expect(session.endSession).toHaveBeenCalled();
    });
});
