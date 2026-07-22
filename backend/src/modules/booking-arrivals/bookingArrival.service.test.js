const mongoose = require('mongoose');

const Booking = require('../bookings/booking.model');
const BookingPlateScan = require('./bookingPlateScan.model');
const service = require('./bookingArrival.service');
const mapper = require('./bookingArrival.mapper');
const { hashDeviceKey } = require('./cameraDevice.middleware');
const { normalizeLicensePlate } = require('../../shared/constants/bookingArrival.constant');

describe('booking arrival recognition rules', () => {
    afterEach(() => jest.restoreAllMocks());

    it('normalizes Vietnamese car and motorbike plate formatting', () => {
        expect(normalizeLicensePlate('51H-123.45')).toBe('51H12345');
        expect(normalizeLicensePlate('59-X1 234.56')).toBe('59X123456');
    });

    it('uses exact and one-character edit distance without widening authority', () => {
        expect(service.editDistance('51H12345', '51H12345')).toBe(0);
        expect(service.editDistance('51H12345', '51H1234S')).toBe(1);
        expect(service.editDistance('51H12345', '59X12345')).toBe(2);
    });

    it('requires frame consensus and averages confidence for live capture', () => {
        const winner = service.voteFrameResults([
            { normalized_plate: '51H12345', confidence: 0.9, processing_time_ms: 100 },
            { normalized_plate: '51H12345', confidence: 0.8, processing_time_ms: 120 },
            { normalized_plate: '51H1234S', confidence: 0.99, processing_time_ms: 80 },
        ]);

        expect(winner.normalized_plate).toBe('51H12345');
        expect(winner.confidence).toBeCloseTo(0.85);
        expect(winner.processing_time_ms).toBe(300);
        expect(service.voteFrameResults([
            { normalized_plate: '51H12345', confidence: 0.9 },
            { normalized_plate: '51H1234S', confidence: 0.9 },
        ])).toEqual({ ambiguous: true });
    });

    it('limits candidates to the same garage and check-in window', async () => {
        const garageId = new mongoose.Types.ObjectId();
        const bookingId = new mongoose.Types.ObjectId();
        const capturedAt = new Date('2026-07-19T03:00:00.000Z');
        const sort = jest.fn().mockResolvedValue([{
            _id: bookingId,
            normalized_license_plate: '51H1234S',
            vehicle_type: 'CAR',
            start_time: new Date('2026-07-19T03:15:00.000Z'),
        }]);
        const find = jest.spyOn(Booking, 'find').mockReturnValue({ sort });

        const result = await service.findCandidates({
            garageId,
            plate: '51H12345',
            vehicleType: 'CAR',
            capturedAt,
        });

        expect(find).toHaveBeenCalledWith(expect.objectContaining({
            garage_id: garageId,
            status: { $in: ['PENDING', 'CONFIRMED'] },
            arrived_at: null,
            start_time: { $gte: expect.any(Date), $lte: expect.any(Date) },
        }));
        expect(result).toEqual([expect.objectContaining({
            booking_id: bookingId,
            match_type: 'FUZZY',
            edit_distance: 1,
            scheduled_distance_minutes: 15,
        })]);
    });

    it('enforces staff confirmation and manual override audit fields in the scan model', async () => {
        const base = {
            garage_id: new mongoose.Types.ObjectId(),
            mode: 'SINGLE',
            capture_source: 'STAFF_CAMERA',
            captured_at: new Date(),
            server_received_at: new Date(),
            upload_ids: [new mongoose.Types.ObjectId()],
            retain_until: new Date(Date.now() + 86400000),
            expires_at: new Date(Date.now() + 1800000),
        };
        const incompleteConfirmation = new BookingPlateScan({ ...base, status: 'CONFIRMED' });
        await expect(incompleteConfirmation.validate()).rejects.toThrow('Confirmed scan requires booking and staff confirmation audit');

        const manual = new BookingPlateScan({ ...base, manual_override: true });
        await expect(manual.validate()).rejects.toThrow('Manual override reason is required');
    });

    it('exposes authorized populated frame metadata without changing upload id fields', () => {
        const uploadId = new mongoose.Types.ObjectId();
        const dto = mapper.toScanDto({
            _id: new mongoose.Types.ObjectId(),
            upload_ids: [{
                _id: uploadId,
                url: 'https://res.cloudinary.com/example/frame.jpg',
                mime_type: 'image/jpeg',
                size: 20480,
                width: 1280,
                height: 720,
                created_at: new Date('2026-07-23T03:00:00.000Z'),
            }],
        });

        expect(dto.upload_ids).toEqual([uploadId.toString()]);
        expect(dto.frames).toEqual([expect.objectContaining({
            upload_id: uploadId.toString(),
            url: 'https://res.cloudinary.com/example/frame.jpg',
            width: 1280,
            height: 720,
        })]);
    });

    it('hashes device keys with the configured pepper and reports health', () => {
        process.env.CAMERA_DEVICE_KEY_PEPPER = 'test-pepper';
        expect(hashDeviceKey('secret')).toBe(hashDeviceKey('secret'));
        expect(hashDeviceKey('secret')).not.toBe(hashDeviceKey('different'));
        expect(mapper.getHealthStatus({ status: 'ACTIVE', last_heartbeat_at: new Date() })).toBe('ONLINE');
        expect(mapper.getHealthStatus({ status: 'REVOKED', last_heartbeat_at: new Date() })).toBe('DISABLED');
        delete process.env.CAMERA_DEVICE_KEY_PEPPER;
    });
});
