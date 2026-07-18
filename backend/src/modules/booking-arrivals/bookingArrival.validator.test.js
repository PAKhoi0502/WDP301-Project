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

    it('requires a stable id and bounded frame list for offline camera events', () => {
        expect(validator.ingestEventsSchema.safeParse({ body: { events: [{
            client_event_id: 'gate-001-42', upload_ids: [id], captured_at: new Date().toISOString(), offline: true,
        }] } }).success).toBe(true);
        expect(validator.ingestEventsSchema.safeParse({ body: { events: [{
            client_event_id: '', upload_ids: [id], captured_at: new Date().toISOString(),
        }] } }).success).toBe(false);
    });
});
