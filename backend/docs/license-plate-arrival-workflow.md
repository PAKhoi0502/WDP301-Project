# License Plate Arrival and Check-in Workflow

## Business boundary

Recognition is a verification assistant, not the authority that changes a
booking. A scan can suggest one or more bookings, but only a customer service
staff member (or admin) can confirm the physical vehicle and invoke check-in.
The existing manual booking search/check-in remains the fallback.

The implementation supports cars and motorbikes and normalizes plates by
upper-casing and removing punctuation/whitespace. Candidate search is always
limited to the same garage and the configured check-in window.

## State flow

```text
CAPTURED -> RECOGNIZING
  -> QUALITY_REJECTED | MULTIPLE_PLATES | FAILED
  -> NO_MATCH | FUZZY_CANDIDATES | AMBIGUOUS | EXACT_MATCH
  -> CONFIRMED | REJECTED | EXPIRED

Gate exact match with sufficient confidence:
EXACT_MATCH -> ARRIVAL_DETECTED -> staff CONFIRMED
```

`ARRIVAL_DETECTED` only puts the booking in the customer-service queue. It
does not set the booking to `CHECKED_IN`. Auto-check-in is intentionally not
implemented until pilot data demonstrates an acceptable false-match rate.

## MVP and live-camera APIs

1. Upload each staff image with `POST /api/v1/uploads`, purpose
   `BOOKING_PLATE_SCAN`.
2. Create a single scan or frame batch with
   `POST /api/v1/staff/booking-arrivals/plate-scans`.
3. Render candidates returned by the scan. Exact candidates are distinguished
   from edit-distance-one fuzzy candidates.
4. Require the staff member to visually compare vehicle/customer/booking and
   call `POST .../plate-scans/:scanId/confirm`.
5. If recognition is unusable, use `POST .../:scanId/retry`, reject the scan,
   or continue with the existing manual booking check-in API.

For live camera, send 2-5 sampled frame uploads with `mode=LIVE_BATCH` and
`capture_source=LIVE_CAMERA`. The backend votes by normalized plate, then
confidence. More than one frame must agree; otherwise the scan is
`AMBIGUOUS`. A provider bounding box produces a non-destructive Cloudinary crop
URL.

Fuzzy candidates never auto-select a booking. Confirming fuzzy/manual matches
requires `override_reason`, and the scan plus booking store match type, detected
plate, actor and reason.

## Replacement or different vehicle

Staff submits `POST .../:scanId/alternate-vehicle`; admin approves or rejects
with `PATCH /api/v1/admin/booking-arrivals/plate-scans/:scanId/alternate-vehicle`.
Approval permits the one check-in decision but does not silently overwrite the
customer's master Vehicle record.

## Fixed camera and offline queue

Admin registers a device at
`POST /api/v1/admin/booking-arrivals/camera-devices`. The plaintext API key is
returned once; only its peppered SHA-256 hash is stored. Devices authenticate
with `X-Camera-Device-Code` and `X-Camera-Device-Key`.

Device APIs:

- `POST /api/v1/camera-devices/heartbeat`
- `POST /api/v1/camera-devices/uploads`
- `POST /api/v1/camera-devices/events/batch`

Offline clients persist frames plus a stable `client_event_id`, upload after
connectivity returns, and set `offline=true`. `(device, client_event_id)` is
idempotent. Device health is `ONLINE`, `STALE`, `OFFLINE`, or `DISABLED` based
on registration state and heartbeat age.

Only an exact match above `PLATE_GATE_MIN_CONFIDENCE` writes
`booking.arrival_detected_at` and sends an internal arrival notification.

## Quality, privacy and observability

Basic checks cover file size and known image dimensions. Structured recognition
adds blur, glare, darkness, distance, angle, crop, no-plate, and multiple-plate
flags. Images with multiple plates are never matched automatically.

`GET /api/v1/admin/booking-arrivals/metrics` returns totals, average confidence,
latency, retry/mismatch/confirmation rates, status and quality distributions,
and breakdowns by garage, vehicle type, weather and time of day.

Raw images are retained for `PLATE_SCAN_RETENTION_DAYS` (default 7), then a
scheduler removes Cloudinary assets and Upload records. Recognition metadata,
candidate decision, actors and audit events remain. Linked scan images cannot
be manually deleted before their retention deadline.

## Configuration

See `.env.example` for candidate windows, confirmation expiry, basic quality
thresholds, accepted capture age, provider image limit, gate confidence, device-key pepper and
retention scheduler settings. Gemini configuration is shared with the existing
research module, but plate recognition uses an independent structured schema
and prompt.
