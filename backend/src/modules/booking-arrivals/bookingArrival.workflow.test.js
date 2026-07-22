const mongoose = require('mongoose');

jest.mock('./bookingPlateScan.model', () => ({
    findById: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
}));
jest.mock('../bookings/booking.model', () => ({
    findById: jest.fn(),
    updateOne: jest.fn(),
}));
jest.mock('../uploads/upload.model', () => ({}));
jest.mock('../staff-profiles/staffProfile.model', () => ({}));
jest.mock('../users/user.model', () => ({}));
jest.mock('./bookingArrival.mapper', () => ({
    toScanDto: jest.fn((scan) => ({ id: scan._id.toString(), status: scan.status })),
}));
jest.mock('./plateRecognition.service', () => ({}));
jest.mock('../bookings/booking.service', () => ({
    checkInBooking: jest.fn(),
}));
jest.mock('../audit-logs/auditLog.service', () => ({
    recordAuditEvent: jest.fn(),
}));
jest.mock('../notifications/notification.service', () => ({}));
jest.mock('../uploads/upload.service', () => ({}));

const BookingPlateScan = require('./bookingPlateScan.model');
const Booking = require('../bookings/booking.model');
const bookingService = require('../bookings/booking.service');
const auditLogService = require('../audit-logs/auditLog.service');
const service = require('./bookingArrival.service');

const createSession = () => ({
    withTransaction: jest.fn(async (callback) => callback()),
    endSession: jest.fn().mockResolvedValue(undefined),
});

const createScanQuery = (scan) => ({
    session: jest.fn().mockReturnThis(),
    populate: jest.fn().mockResolvedValue(scan),
});

describe('booking arrival workflow consistency', () => {
    const userId = new mongoose.Types.ObjectId();
    const garageId = new mongoose.Types.ObjectId();
    const bookingId = new mongoose.Types.ObjectId();
    const scanId = new mongoose.Types.ObjectId();
    const user = { _id: userId, role: 'ADMIN' };

    const createScan = (overrides = {}) => ({
        _id: scanId,
        garage_id: garageId,
        status: 'EXACT_MATCH',
        captured_at: new Date('2026-07-23T03:00:00.000Z'),
        expires_at: new Date('2026-07-23T03:30:00.000Z'),
        normalized_plate: '51H12345',
        candidates: [],
        alternate_vehicle_status: 'NONE',
        alternate_vehicle: null,
        matched_booking_id: null,
        save: jest.fn().mockResolvedValue(undefined),
        ...overrides,
    });

    const createBooking = (overrides = {}) => ({
        _id: bookingId,
        garage_id: garageId,
        status: 'CONFIRMED',
        arrived_at: null,
        start_time: new Date('2026-07-23T03:15:00.000Z'),
        normalized_license_plate: '51H12345',
        ...overrides,
    });

    beforeEach(() => {
        jest.resetAllMocks();
        jest.useFakeTimers().setSystemTime(new Date('2026-07-23T03:05:00.000Z'));
        auditLogService.recordAuditEvent.mockResolvedValue(null);
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('confirms the scan and booking check-in in the same transaction', async () => {
        const session = createSession();
        const scan = createScan();
        const booking = createBooking();
        jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
        BookingPlateScan.findById.mockReturnValue(createScanQuery(scan));
        Booking.findById.mockReturnValue({ session: jest.fn().mockResolvedValue(booking) });
        bookingService.checkInBooking.mockResolvedValue({ id: bookingId.toString(), status: 'CHECKED_IN' });

        const result = await service.confirmScan(user, scanId, { booking_id: bookingId }, {});

        expect(result.booking.status).toBe('CHECKED_IN');
        expect(bookingService.checkInBooking).toHaveBeenCalledWith(
            user,
            bookingId,
            expect.objectContaining({
                verification: expect.objectContaining({
                    scan_id: scanId,
                    match_type: 'EXACT',
                    manual_override: false,
                }),
            }),
            {},
            { session }
        );
        expect(scan.save).toHaveBeenCalledWith({ session });
        expect(auditLogService.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
            action: 'BOOKING_PLATE_SCAN_CONFIRMED',
            session,
        }));
        expect(session.endSession).toHaveBeenCalled();
    });

    it('does not apply an alternate-vehicle approval to another booking', async () => {
        const session = createSession();
        const scan = createScan({
            alternate_vehicle_status: 'APPROVED',
            alternate_vehicle: {
                booking_id: new mongoose.Types.ObjectId(),
                normalized_license_plate: '51H12345',
                reason: 'Replacement vehicle approved',
            },
        });
        const booking = createBooking({ normalized_license_plate: '59X99999' });
        jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
        BookingPlateScan.findById.mockReturnValue(createScanQuery(scan));
        Booking.findById.mockReturnValue({ session: jest.fn().mockResolvedValue(booking) });

        await expect(service.confirmScan(user, scanId, { booking_id: bookingId }, {})).rejects.toMatchObject({
            statusCode: 400,
            errorCode: 'PLATE_SCAN_OVERRIDE_REASON_REQUIRED',
        });

        expect(bookingService.checkInBooking).not.toHaveBeenCalled();
        expect(scan.save).not.toHaveBeenCalled();
        expect(session.endSession).toHaveBeenCalled();
    });

    it('stores an alternate vehicle request against the selected eligible booking', async () => {
        const session = createSession();
        const scan = createScan();
        const booking = createBooking();
        jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
        BookingPlateScan.findById.mockReturnValue(createScanQuery(scan));
        Booking.findById.mockReturnValue({ session: jest.fn().mockResolvedValue(booking) });

        await service.requestAlternateVehicle(user, scanId, {
            booking_id: bookingId,
            license_plate: '51H-123.45',
            vehicle_type: 'CAR',
            reason: 'Customer arrived with a replacement vehicle',
        }, {});

        expect(scan.alternate_vehicle).toMatchObject({
            booking_id: bookingId,
            normalized_license_plate: '51H12345',
        });
        expect(scan.save).toHaveBeenCalledWith({ session });
        expect(auditLogService.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
            action: 'BOOKING_ALTERNATE_VEHICLE_REQUESTED',
            session,
        }));
    });

    it('expires every non-terminal scan state through a guarded transaction', async () => {
        const session = createSession();
        const scan = createScan({
            status: 'ARRIVAL_DETECTED',
            matched_booking_id: bookingId,
            expires_at: new Date('2026-07-23T03:00:00.000Z'),
        });
        jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
        BookingPlateScan.find.mockReturnValue({
            sort: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue([{ _id: scanId }]),
            }),
        });
        BookingPlateScan.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue(scan) });
        Booking.updateOne.mockResolvedValue({ modifiedCount: 1 });

        const result = await service.expirePendingScans();

        expect(BookingPlateScan.find).toHaveBeenCalledWith(expect.objectContaining({
            status: { $in: expect.arrayContaining([
                'CAPTURED',
                'QUALITY_REJECTED',
                'RECOGNIZING',
                'FAILED',
                'ARRIVAL_DETECTED',
            ]) },
        }));
        expect(Booking.updateOne).toHaveBeenCalledWith(
            { _id: bookingId, arrival_detection_scan_id: scanId },
            { $set: { arrival_detected_at: null, arrival_detection_scan_id: null } },
            { session }
        );
        expect(scan.status).toBe('EXPIRED');
        expect(scan.save).toHaveBeenCalledWith({ session });
        expect(result).toEqual({ processed: 1, expired: 1 });
    });
});
