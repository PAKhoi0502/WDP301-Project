# Frontend handoff: License plate camera and arrival verification

## Scope and current mismatch

This document is the implementation checklist for the FE repository. The BE
contract described here is canonical. No FE source is changed by the backend
task that introduced this document.

The current FE arrival screens cannot call the BE flow correctly yet:

- `StaffArrivalQueuePage.tsx` uploads with purpose `GENERAL`, stores the upload
  URL, and sends `frame_upload_ids`. BE requires purpose
  `BOOKING_PLATE_SCAN`, stores Upload resource IDs, and accepts `upload_ids`.
- The create-scan payload is missing `garage_id`, `mode`, and `capture_source`.
- The page uses a file input only; it does not open a laptop/mobile camera with
  `navigator.mediaDevices.getUserMedia`.
- `plateScan.ts` uses status names and response fields that do not exist in the
  BE response.
- Arrival queue entries are full scan DTOs, not a separate
  `ApiArrivalQueueItem` shape.
- Candidates do not have `id`, per-candidate `confidence`, `status`,
  `expected_plate`, or `detected_plate` fields. The selection key is
  `candidate.booking_id`; recognition confidence is on the scan.
- Confirm does not accept `candidate_id`.
- Retry accepts `upload_ids`, not `frame_upload_ids` or URLs.
- Alternate-vehicle requests accept booking and vehicle snapshot fields, not a
  `vehicle_id`.
- Confirm returns `{ scan, booking }`, not only a scan. A late arrival can be
  recorded without immediately changing the booking to `CHECKED_IN`.

## Files to change

Update at least these FE files:

1. `src/api/upload.api.ts`
2. `src/types/api/plateScan.ts`
3. `src/api/plateScan.api.ts`
4. `src/hooks/api/staff/useStaffPlateScans.ts`
5. `src/pages/staff/arrivals/StaffArrivalQueuePage.tsx`
6. `src/pages/staff/arrivals/StaffPlateScanDetailPage.tsx`
7. Add a reusable component such as
   `src/components/staff/arrivals/CameraCapture.tsx`
8. Add unit/component tests for camera cleanup, payload mapping, action guards,
   late arrival, and API errors.

## Canonical BE types

Use this exact status union:

```ts
export type PlateScanStatus =
  | 'CAPTURED'
  | 'QUALITY_REJECTED'
  | 'RECOGNIZING'
  | 'EXACT_MATCH'
  | 'FUZZY_CANDIDATES'
  | 'AMBIGUOUS'
  | 'NO_MATCH'
  | 'MULTIPLE_PLATES'
  | 'ARRIVAL_DETECTED'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'FAILED'

export type PlateScanMode = 'SINGLE' | 'LIVE_BATCH' | 'GATE'

export type PlateCaptureSource =
  | 'STAFF_CAMERA'
  | 'GALLERY'
  | 'LIVE_CAMERA'
  | 'GATE_CAMERA'
  | 'OFFLINE_GATE'

export type PlateMatchType = 'EXACT' | 'FUZZY' | 'MANUAL' | 'NONE'

export type PlateScanRejectionReason =
  | 'VEHICLE_MISMATCH'
  | 'WRONG_BOOKING'
  | 'POOR_IMAGE'
  | 'CUSTOMER_NOT_PRESENT'
  | 'DUPLICATE_SCAN'
  | 'OTHER'
```

The staff create/retry UI must only expose `STAFF_CAMERA`, `GALLERY`, and
`LIVE_CAMERA`. `GATE_CAMERA`, `OFFLINE_GATE`, and `GATE` belong to registered
camera-device clients.

Important scan DTO fields:

```ts
export interface ApiPlateScanFrame {
  upload_id: string
  url: string
  mime_type: string
  size: number
  width: number | null
  height: number | null
  created_at: string
}

export interface ApiPlateScanCandidate {
  booking_id: string
  booking: ApiBooking | null
  match_type: PlateMatchType
  edit_distance: number
  scheduled_distance_minutes: number
  vehicle_type_mismatch: boolean
}

export interface ApiPlateScan {
  id: string
  garage_id: string
  staff_id: string | null
  camera_device_id: string | null
  mode: PlateScanMode
  capture_source: PlateCaptureSource
  captured_at: string
  server_received_at: string
  status: PlateScanStatus
  upload_ids: string[]
  frames: ApiPlateScanFrame[]
  primary_upload_id: string | null
  plate_crop_url: string | null
  frame_results: ApiPlateFrameResult[]
  raw_plate_text: string | null
  normalized_plate: string | null
  confidence: number
  detected_vehicle_type: 'CAR' | 'MOTORBIKE' | 'UNKNOWN'
  quality_flags: string[]
  candidates: ApiPlateScanCandidate[]
  matched_booking_id: string | null
  match_type: PlateMatchType
  retry_count: number
  alternate_vehicle_status: 'NONE' | 'REQUESTED' | 'APPROVED' | 'REJECTED'
  alternate_vehicle: ApiAlternateVehicle | null
  rejection_reason: PlateScanRejectionReason | null
  rejection_note: string | null
  expires_at: string
  created_at: string
  updated_at: string
}
```

Do not keep the old FE aliases `detected_plate`, `best_confidence`, or
`frames[].id`. Render `normalized_plate`, `confidence`, and
`frames[].upload_id` instead.

Candidate UI should read booking information from `candidate.booking`, for
example:

- plate: `candidate.booking.normalized_license_plate`
- customer: `candidate.booking.customer?.full_name`, or guest fields for a
  walk-in booking
- vehicle: `candidate.booking.vehicle`
- scheduled time: `candidate.booking.start_time`
- booking key: `candidate.booking_id`

## Upload and scan creation

Add `BOOKING_PLATE_SCAN` to the `UploadPurpose` union. Upload each captured file
as multipart form data:

```http
POST /api/v1/uploads
Authorization: Bearer <token>
Content-Type: multipart/form-data

file=<binary>
purpose=BOOKING_PLATE_SCAN
```

Save `response.data.id`. Do not send `response.data.url` as an upload ID.

Get `garage_id` from the current staff profile/capabilities response. Block the
capture action with a clear message if an active staff garage is unavailable.

For one laptop/mobile camera snapshot:

```json
{
  "garage_id": "<current staff garage id>",
  "upload_ids": ["<upload resource id>"],
  "mode": "SINGLE",
  "capture_source": "LIVE_CAMERA",
  "captured_at": "2026-07-23T03:00:00.000Z"
}
```

For one selected gallery file, use `SINGLE` plus `GALLERY`. For sampled live
capture, upload 2-5 distinct frames and use:

```json
{
  "garage_id": "<current staff garage id>",
  "upload_ids": ["<id 1>", "<id 2>", "<id 3>"],
  "mode": "LIVE_BATCH",
  "capture_source": "LIVE_CAMERA",
  "captured_at": "2026-07-23T03:00:00.000Z"
}
```

`SINGLE` with multiple frames and `LIVE_BATCH` with fewer than two frames are
validation errors. Start with one-shot `SINGLE` capture for the MVP; it has
lower latency, cost, and UI complexity. Add 2-5 frame sampling only when the
single-shot flow is stable.

## Opening the laptop or mobile camera

Use `navigator.mediaDevices.getUserMedia`. It works only in a secure context:
HTTPS in deployed environments or `localhost` during development.

Recommended sequence:

1. Check `window.isSecureContext`, `navigator.mediaDevices`, and
   `navigator.mediaDevices.getUserMedia`.
2. Request `{ audio: false, video: { facingMode: { ideal: 'environment' },
   width: { ideal: 1280 }, height: { ideal: 720 } } }`.
3. Set the returned stream on `videoRef.current.srcObject` and call `play()`.
4. Capture the current video frame into a canvas.
5. Use `canvas.toBlob(..., 'image/jpeg', 0.9)` and create a `File` from the
   blob.
6. Show the captured preview and require staff to accept or retake it before
   upload.
7. Stop every media track when the modal closes, after a successful capture if
   preview is no longer needed, and in the component cleanup function.
8. Clear object URLs with `URL.revokeObjectURL`.

Handle at least `NotAllowedError`, `NotFoundError`, `NotReadableError`, and
unsupported/insecure browser cases. Provide a fallback input:

```html
<input type="file" accept="image/*" capture="environment" />
```

The `capture` attribute is mainly useful on mobile browsers; desktop browsers
usually open a file picker. Do not send a continuous webcam stream to BE. BE
accepts uploaded image files, not WebRTC or video streams.

## Query and response mapping

Use these calls:

```text
GET  /api/v1/staff/booking-arrivals/plate-scans
GET  /api/v1/staff/booking-arrivals/arrival-queue
GET  /api/v1/staff/booking-arrivals/plate-scans/:scanId
POST /api/v1/staff/booking-arrivals/plate-scans
POST /api/v1/staff/booking-arrivals/plate-scans/:scanId/retry
POST /api/v1/staff/booking-arrivals/plate-scans/:scanId/confirm
POST /api/v1/staff/booking-arrivals/plate-scans/:scanId/reject
POST /api/v1/staff/booking-arrivals/plate-scans/:scanId/alternate-vehicle
```

The list and arrival queue both return `data: ApiPlateScan[]` plus pagination
`meta`. Type the queue call as the same list response, filtered by BE to
`ARRIVAL_DETECTED`. Use `scan.id` for row keys and navigation.

Show `scan.frames` in the detail page. The response is already protected by
authentication, capability, and garage scope. Treat image URLs as operational
personal data: do not persist them in local storage, analytics, or client logs.

## Confirm, reject, retry, and alternate vehicle

Confirm a selected candidate with:

```json
{
  "booking_id": "<candidate.booking_id>",
  "note": "Optional staff note",
  "override_reason": "Required for fuzzy/manual mismatch"
}
```

Do not send `candidate_id`. Exact matches do not need `override_reason`.
Non-exact matches require a 5-1000 character reason unless an admin-approved
alternate-vehicle request exists for the same scan and same booking.

Type the response as:

```ts
interface ApiConfirmPlateScanResponse {
  scan: ApiPlateScan
  booking: ApiBooking
}
```

Do not always show “checked in successfully”. Inspect the returned booking:

- `booking.status === 'CHECKED_IN'`: normal check-in completed.
- `booking.late_resolution_required === true`: arrival was recorded as late;
  open the existing late-arrival resolution flow.

Reject with an enum value, plus optional note:

```json
{
  "reason": "POOR_IMAGE",
  "note": "Plate is obscured by glare"
}
```

Do not use a free-text string as `reason`. Use a select/radio control and put
free text in `note`.

Retry only after uploading new files:

```json
{
  "upload_ids": ["<new upload id>"],
  "mode": "SINGLE",
  "capture_source": "LIVE_CAMERA",
  "captured_at": "2026-07-23T03:05:00.000Z"
}
```

If `mode` is omitted, BE derives `SINGLE` for one upload and `LIVE_BATCH` for
2-5 uploads. Retry is rejected for terminal or expired scans.

Request an alternate vehicle with the selected booking and a vehicle snapshot:

```json
{
  "booking_id": "<candidate.booking_id>",
  "license_plate": "51H-123.45",
  "vehicle_type": "CAR",
  "brand": "Toyota",
  "model": "Vios",
  "color": "White",
  "reason": "Customer arrived with a temporary replacement vehicle"
}
```

`license_plate` must normalize to `scan.normalized_plate`. Do not ask for or
send `vehicle_id`; approving this request must not mutate the customer's saved
Vehicle record.

## Capability and action guards

Read canonical capabilities from
`GET /api/v1/staff-profiles/me/capabilities` and gate navigation/buttons as
follows:

- scan list/detail/create/retry/reject: `booking.plate_scan`
- fixed-camera arrival queue: `booking.arrival_queue`
- confirm and alternate-vehicle request: `booking.check_in`

FE guards are presentation only. Always handle BE `403` responses because BE
remains the authorization authority.

Disable terminal actions for `CONFIRMED`, `REJECTED`, and `EXPIRED`. Also
disable confirmation, retry, and alternate requests when `expires_at` is in the
past. Keep BE error handling because client clocks and concurrent actions can
still disagree.

## Error handling checklist

Map these error codes to actionable messages:

- `PLATE_SCAN_UPLOAD_PURPOSE_INVALID`: re-upload with
  `BOOKING_PLATE_SCAN`.
- `PLATE_SCAN_UPLOAD_ALREADY_LINKED`: the frame was already used; capture a new
  frame.
- `PLATE_SCAN_SINGLE_FRAME_REQUIRED`: keep exactly one frame in `SINGLE`.
- `PLATE_SCAN_LIVE_BATCH_FRAMES_REQUIRED`: provide 2-5 frames.
- `BOOKING_PLATE_SCAN_EXPIRED`: capture a new scan.
- `BOOKING_PLATE_SCAN_FINALIZED`: refresh detail and disable actions.
- `PLATE_SCAN_OVERRIDE_REASON_REQUIRED`: show the override reason field.
- `PLATE_SCAN_BOOKING_OUTSIDE_CHECK_IN_WINDOW`: use the manual fallback after
  staff verification.
- `BOOKING_CHECK_IN_NOT_ALLOWED`: refresh the booking because it was already
  processed or changed state.
- `ALTERNATE_VEHICLE_PLATE_SCAN_MISMATCH`: use the recognized plate or retake
  the scan.
- `ALTERNATE_VEHICLE_REQUEST_ALREADY_EXISTS`: show the pending/approved state.
- `STAFF_CAPABILITY_REQUIRED` and garage-forbidden errors: hide the action after
  refreshing staff capabilities/profile.

## FE acceptance tests

Before merging FE, verify:

1. Camera permission accepted, denied, unavailable, and busy-device cases.
2. Camera tracks stop on close, route change, success, and component unmount.
3. One captured frame uploads with `BOOKING_PLATE_SCAN` and the create request
   sends the returned Upload `id`.
4. Gallery fallback sends `SINGLE/GALLERY`.
5. Optional batch mode accepts 2-5 frames and rejects invalid counts before the
   request.
6. Queue/detail map `ApiPlateScan` without old aliases.
7. Candidate selection uses `booking_id` and nested booking data.
8. Exact confirm, fuzzy confirm with reason, and late-arrival response handling.
9. Reject uses the reason enum and optional note.
10. Retry uploads new files and sends `upload_ids`.
11. Alternate vehicle sends the new snapshot contract and shows admin review
    status.
12. Terminal/expired/capability-forbidden actions are disabled, while BE errors
    are still surfaced if state changes concurrently.
