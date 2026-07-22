const validator = require('./bookingArrival.validator');

const id = '507f1f77bcf86cd799439011';

describe('booking arrival API validation', () => {
    it('accepts one MVP photo and a 2-5 frame live batch', () => {
        expect(validator.createScanSchema.safeParse({ body: {
            garage_id: id, upload_ids: [id], mode: 'SINGLE', capture_source: 'STAFF_CAMERA',
        } }).success).toBe(true);
        expect(validator.createScanSchema.safeParse({ body: {
            garage_id: id, upload_ids: [id, '507f1f77bcf86cd799439012'], mode: 'LIVE_BATCH', capture_source: 'LIVE_CAMERA',
        } }).success).toBe(true);
    });

    it('rejects multiple frames in single mode and gate source from staff clients', () => {
        expect(validator.createScanSchema.safeParse({ body: {
            garage_id: id, upload_ids: [id, '507f1f77bcf86cd799439012'], mode: 'SINGLE', capture_source: 'STAFF_CAMERA',
        } }).success).toBe(false);
        expect(validator.createScanSchema.safeParse({ body: {
            garage_id: id, upload_ids: [id], mode: 'SINGLE', capture_source: 'GATE_CAMERA',
        } }).success).toBe(false);
    });

    it('rejects a one-frame live batch and explicit retry mode mismatches', () => {
        expect(validator.createScanSchema.safeParse({ body: {
            garage_id: id, upload_ids: [id], mode: 'LIVE_BATCH', capture_source: 'LIVE_CAMERA',
        } }).success).toBe(false);
        expect(validator.retryScanSchema.safeParse({
            params: { scanId: id },
            body: {
                upload_ids: [id, '507f1f77bcf86cd799439012'],
                mode: 'SINGLE',
                capture_source: 'LIVE_CAMERA',
            },
        }).success).toBe(false);
        expect(validator.retryScanSchema.safeParse({
            params: { scanId: id },
            body: { upload_ids: [id], mode: 'LIVE_BATCH', capture_source: 'LIVE_CAMERA' },
        }).success).toBe(false);
    });

    it('binds an alternate vehicle request to a booking', () => {
        const valid = {
            params: { scanId: id },
            body: {
                booking_id: '507f1f77bcf86cd799439013',
                license_plate: '51H-123.45',
                vehicle_type: 'CAR',
                reason: 'Customer arrived with a replacement vehicle',
            },
        };

        expect(validator.alternateVehicleSchema.safeParse(valid).success).toBe(true);
        expect(validator.alternateVehicleSchema.safeParse({
            ...valid,
            body: { ...valid.body, booking_id: undefined },
        }).success).toBe(false);
    });

    it('requires a stable id and bounded frame list for offline camera events', () => {
        expect(validator.ingestEventsSchema.safeParse({ body: { events: [{
            client_event_id: 'gate-001-42', upload_ids: [id], captured_at: new Date().toISOString(), offline: true,
        }] } }).success).toBe(true);
        expect(validator.ingestEventsSchema.safeParse({ body: { events: [{
            client_event_id: '', upload_ids: [id], captured_at: new Date().toISOString(),
        }] } }).success).toBe(false);
    });
});
