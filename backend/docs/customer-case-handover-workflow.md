# Booking handover and customer case MVP

Base URL: `/api/v1`

## Business boundaries

- `Booking.status` continues to describe service execution and is not reopened
  when a customer reports an issue.
- `BookingHandover` separately records readiness, the customer response, and
  physical release of the vehicle.
- `CustomerCase` is an after-service complaint or damage case. It does not
  replace surveys or operational booking incidents.
- A handover can only be prepared for a `COMPLETED` booking with both
  `BEFORE_WASH` and `AFTER_WASH` inspections, each containing image evidence.
- Registered customers report directly. For a walk-in booking, customer
  service can report on the customer's behalf only after an OTP sent to the
  phone stored on that booking has been verified.

## Handover workflow

Handover state:

```text
PENDING -> READY_FOR_CUSTOMER -> RELEASED
                              -> ON_HOLD -> RELEASED
```

Customer response is stored independently as `PENDING`, `ACCEPTED`, or
`ISSUE_REPORTED`.

- Accepting handover records vehicle receipt and releases the vehicle.
- A paid booking is required before any operation records physical release or
  vehicle receipt.
- Reporting a normal issue records the case without automatically holding or
  reopening the booking.
- Reporting `SAFETY_CONCERN` before receiving the vehicle puts the handover on
  hold until customer service or admin releases it.

## Customer case workflow

```text
SUBMITTED -> ACKNOWLEDGED -> INVESTIGATING -> RESOLVED -> CLOSED
```

- Customer service acknowledgement self-assigns an unassigned case.
- An assigned customer service staff member can communicate and add evidence.
- Only admin can record liability/conclusion and close a resolved case.
- Case events are append-only and are returned as the case timeline.
- Linked evidence cannot be deleted, including by admin.

Categories:

```text
VEHICLE_DAMAGE
MISSING_PROPERTY
SERVICE_QUALITY
SERVICE_INCOMPLETE
BILLING_PAYMENT
STAFF_CONDUCT
SAFETY_CONCERN
OTHER
```

Priority is derived on the server: safety is `CRITICAL`; damage and missing
property are `HIGH`; other categories are `NORMAL`.

`discovered_at` cannot precede service completion or be in the future. The MVP
does not impose a hard claim-expiry window; that remains a configurable policy
for a later phase.

## New upload values

Upload customer case images first through `POST /uploads` with:

```json
{
  "purpose": "CUSTOMER_CASE_EVIDENCE"
}
```

Do not provide `related_type` or `related_id` before the case exists. The case
service atomically links the upload with `related_type: CUSTOMER_CASE`.

Only image uploads owned by the acting user can be linked. Up to 10 upload ids
are accepted per request and each case is capped at 30 evidence images.

## Changed existing behavior

- `POST /uploads` accepts `purpose: CUSTOMER_CASE_EVIDENCE` and related type
  `CUSTOMER_CASE`.
- `DELETE /uploads/:id` now returns `409 CUSTOMER_CASE_EVIDENCE_IMMUTABLE`
  after evidence has been linked to a case.
- The generated `POST_SERVICE_HANDOVER` service step remains compatible by
  code, but its display meaning is now final inspection and preparation for
  handover. Actual customer receipt is recorded by `BookingHandover`.
- `/notifications` can return the new handover and customer case notification
  types listed below.

## New customer APIs

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/bookings/:id/handover` | Get the owned booking handover and inspection snapshot |
| `POST` | `/bookings/:id/handover/accept` | Confirm receipt without reporting an issue |
| `POST` | `/bookings/:id/handover/report` | Create a case and update the handover atomically |
| `GET` | `/customer-cases` | List owned cases |
| `GET` | `/customer-cases/:id` | Get case, public messages, and customer-visible timeline |
| `POST` | `/customer-cases/:id/evidence` | Add image evidence to an open owned case |
| `POST` | `/customer-cases/:id/messages` | Send a customer message |

Both customer and staff case lists accept `case_code` for exact tracking-code
lookup, in addition to status/category/booking filters.

Example report:

```json
{
  "category": "VEHICLE_DAMAGE",
  "description": "A new scratch is visible on the left front door.",
  "desired_resolution": "Please review the before and after inspection photos.",
  "discovered_at": "2026-07-18T21:30:00+07:00",
  "vehicle_received": false,
  "upload_ids": ["507f1f77bcf86cd799439011"]
}
```

## New customer service and admin APIs

Canonical staff aliases use `/staff`; the same router remains available under
`/admin` for compatibility.

| Method | Canonical path | Capability/role |
| --- | --- | --- |
| `GET` | `/staff/bookings/:id/handover` | `booking_handover.manage_garage` |
| `PATCH` | `/staff/bookings/:id/handover/ready` | `booking_handover.manage_garage` |
| `PATCH` | `/staff/bookings/:id/handover/release` | `booking_handover.manage_garage` |
| `GET` | `/staff/customer-cases` | `customer_case.read_garage` |
| `GET` | `/staff/customer-cases/:id` | `customer_case.read_garage` |
| `PATCH` | `/staff/customer-cases/:id/assign` | `customer_case.assign_garage` |
| `PATCH` | `/staff/customer-cases/:id/acknowledge` | `customer_case.acknowledge` |
| `POST` | `/staff/customer-cases/:id/evidence` | `customer_case.communicate_assigned` and assignment |
| `POST` | `/staff/customer-cases/:id/messages` | `customer_case.communicate_assigned` and assignment |
| `PATCH` | `/admin/customer-cases/:id/conclude` | `ADMIN` |
| `PATCH` | `/admin/customer-cases/:id/close` | `ADMIN` |

Staff access is always restricted to the staff profile garage. Assignment,
acknowledgement, communication, conclusion, and closure all create a domain
timeline event and a security audit log.

## Stage 2: technical assessment and resolution

Technical categories (`VEHICLE_DAMAGE`, `SERVICE_QUALITY`,
`SERVICE_INCOMPLETE`, and `SAFETY_CONCERN`) require a submitted technical
assessment before admin can propose a resolution.

```text
Assessment: ASSIGNED -> IN_PROGRESS -> SUBMITTED

Resolution: PROPOSED -> CUSTOMER_ACCEPTED -> APPLIED
                     -> CUSTOMER_REJECTED -> new proposal version
```

- Customer service assigns an active `VEHICLE_INSPECTION_STAFF` in the same
  garage. Only that assigned inspector (or admin) can start/submit it.
- Proposals are versioned. A new proposal supersedes an unanswered proposal;
  an accepted proposal must be applied before another version is created.
- Registered customers accept/reject in their own API. For walk-ins, assigned
  customer service records the response only after a fresh booking-phone OTP.
- Admin can conclude a case only after the accepted proposal has status
  `APPLIED`.

Resolution actions can combine one each of:

- `REFUND`: creates an auditable refund ledger entry. The current PayOS adapter
  has no refund operation, so `COMPLETED` must include the real bank/cash/
  provider transaction reference. The system never marks money refunded merely
  because a proposal was accepted.
- `VOUCHER`: creates an account-bound compensation voucher linked to
  `source_customer_case_id`. It is unavailable to an unclaimed walk-in account.
- `REWORK`: creates a zero-price, already-paid booking linked to the original
  booking, case, and resolution. Normal garage hours, vehicle overlap, and
  resource capacity checks still apply.
- `NO_COMPENSATION`: may only appear by itself.

Resolution application is retryable. Already-created action records are reused
instead of duplicated when a previous application attempt partially failed.

## Stage 2: SLA, escalation, and reopen

Default calendar SLA (override through environment variables):

| Priority | First response | Resolution |
| --- | ---: | ---: |
| `CRITICAL` | 15 minutes | 4 hours |
| `HIGH` | 2 hours | 24 hours |
| `NORMAL` | 4 hours | 72 hours |

The `customer-case-sla` scheduler runs every minute by default. It stamps the
first detected breach, writes a private `SLA_ESCALATED` timeline event, and
notifies the assigned handler, customer service, and admins. The dashboard is
garage-scoped for staff and cross-garage for admin.

A customer may reopen a resolved/closed owned case within seven days by
default. Admin may override the time window. Reopen preserves the historical
timeline/resolution versions, creates a new resolution SLA, restores the open
dedupe key, and requires a reason.

Environment variables:

```text
CUSTOMER_CASE_NORMAL_FIRST_RESPONSE_MINUTES
CUSTOMER_CASE_NORMAL_RESOLUTION_MINUTES
CUSTOMER_CASE_HIGH_FIRST_RESPONSE_MINUTES
CUSTOMER_CASE_HIGH_RESOLUTION_MINUTES
CUSTOMER_CASE_CRITICAL_FIRST_RESPONSE_MINUTES
CUSTOMER_CASE_CRITICAL_RESOLUTION_MINUTES
CUSTOMER_CASE_REOPEN_WINDOW_DAYS
CUSTOMER_CASE_SLA_JOB_INTERVAL_MS
CUSTOMER_CASE_SLA_BATCH_SIZE
```

## Stage 2 APIs

| Method | Path | Authorization |
| --- | --- | --- |
| `PATCH` | `/customer-cases/:id/resolution-response` | owning customer |
| `POST` | `/customer-cases/:id/reopen` | owning customer, within window |
| `GET` | `/staff/customer-cases/sla-dashboard` | `customer_case.sla.read_garage` |
| `POST` | `/staff/customer-cases/walk-in/otp/request` | `customer_case.create_walk_in` |
| `POST` | `/staff/customer-cases/walk-in/otp/verify` | `customer_case.create_walk_in` |
| `POST` | `/staff/customer-cases/walk-in` | `customer_case.create_walk_in` |
| `PATCH` | `/staff/customer-cases/:id/technical-assessment/assign` | `customer_case.assign_garage` |
| `GET` | `/staff/customer-cases/:id/technical-assessment` | assigned inspection staff |
| `PATCH` | `/staff/customer-cases/:id/technical-assessment/start` | assigned inspection staff |
| `POST` | `/staff/customer-cases/:id/technical-assessment/submit` | assigned inspection staff |
| `PATCH` | `/staff/customer-cases/:id/walk-in-resolution-response` | assigned customer service + OTP |
| `POST` | `/admin/customer-cases/:id/resolutions` | admin |
| `POST` | `/admin/customer-cases/:id/resolutions/:resolutionId/apply` | admin |
| `PATCH` | `/admin/customer-cases/:id/refunds/:refundId` | admin |
| `POST` | `/admin/customer-cases/:id/reopen` | admin override |

## Notifications

The MVP adds these notification types:

```text
BOOKING_HANDOVER_READY
BOOKING_HANDOVER_ACCEPTED
BOOKING_HANDOVER_RELEASED
CUSTOMER_CASE_SUBMITTED
CUSTOMER_CASE_ASSIGNED
CUSTOMER_CASE_ACKNOWLEDGED
CUSTOMER_CASE_MESSAGE_RECEIVED
CUSTOMER_CASE_RESOLVED
CUSTOMER_CASE_CLOSED
CUSTOMER_CASE_TECHNICAL_ASSESSMENT_ASSIGNED
CUSTOMER_CASE_TECHNICAL_ASSESSMENT_SUBMITTED
CUSTOMER_CASE_RESOLUTION_PROPOSED
CUSTOMER_CASE_RESOLUTION_RESPONDED
CUSTOMER_CASE_RESOLUTION_APPLIED
CUSTOMER_CASE_REFUND_UPDATED
CUSTOMER_CASE_SLA_ESCALATED
CUSTOMER_CASE_REOPENED
```

Submission notifies the customer, active customer service staff in the garage,
and active admins. Subsequent notifications are sent to the relevant customer
or assigned handler.
