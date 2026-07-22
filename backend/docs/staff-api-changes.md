# Staff authorization API changes

Base URL: `/api/v1`

## 1. New staff context API

### `GET /staff-profiles/me/capabilities`

Returns the current staff workspace, garage, staff type, and derived
capabilities.

Role: `STAFF`

Example response data:

```json
{
  "is_admin": false,
  "user_id": "...",
  "staff_profile_id": "...",
  "staff_type": "WASH_OPERATOR",
  "staff_group": "SERVICE_EXECUTION",
  "garage_id": "...",
  "capabilities": [
    "booking.read_assigned",
    "service_task.read_assigned",
    "service_task.wash.execute_assigned",
    "incident.read_assigned",
    "incident.report_wash_bay_failure"
  ]
}
```

Frontend should use this endpoint for workspace navigation and action
visibility. The backend remains the authorization source of truth.

## 2. New grouped staff routes

### Booking operations workspace

Canonical prefix: `/staff/bookings`

This is a compatibility alias of the existing booking operations router.
Capabilities still determine which endpoints each staff type can call.

Shared read endpoints:

| Method | Path | Access |
| --- | --- | --- |
| `GET` | `/staff/bookings` | Customer service: garage scope. Other staff: assignment scope |
| `GET` | `/staff/bookings/:id` | Customer service: garage scope. Other staff: assignment scope |

Customer service operations:

| Method | Path | Required capability |
| --- | --- | --- |
| `POST` | `/staff/bookings/walk-in` | `booking.walk_in.create` |
| `PATCH` | `/staff/bookings/:id/cancel` | `booking.cancel_customer_request` |
| `PATCH` | `/staff/bookings/:id/mark-no-show` | `booking.arrival.manage` |
| `PATCH` | `/staff/bookings/:id/check-in` | `booking.check_in` |
| `GET` | `/staff/bookings/:id/late-arrival-options` | `booking.late_arrival.manage` |
| `PATCH` | `/staff/bookings/:id/resolve-late-arrival` | `booking.late_arrival.manage` |
| `PATCH` | `/staff/bookings/:id/assign-wash-bay` | `booking.wash_bay.assign` |
| `PATCH` | `/staff/bookings/:id/start-service` | `booking.service.start` |
| `PATCH` | `/staff/bookings/:id/complete-service` | `booking.service.complete` |
| `PATCH` | `/staff/bookings/:id/mark-paid` | `booking.payment.collect_cash` |

Starting service requires an existing `BEFORE_WASH` inspection for the booking.
If it is missing, the API returns `409 BEFORE_WASH_INSPECTION_REQUIRED`.

Inspection operations:

| Method | Path | Required capability |
| --- | --- | --- |
| `GET` | `/staff/bookings/:id/inspections` | `inspection.read_garage` or `inspection.read_assigned` |
| `POST` | `/staff/bookings/:id/inspections` | `inspection.create_assigned` |

Inspection staff must also match `assigned_inspection_staff_id` for the
booking.

Shared operational workflow visibility:

| Method | Path | Required capability |
| --- | --- | --- |
| `GET` | `/staff/workspace/bookings` | `booking.workflow.read_garage` |
| `GET` | `/staff/workspace/bookings/:bookingId/workflow` | `booking.workflow.read_garage` |

All active staff types receive `booking.workflow.read_garage`. These endpoints
return a same-garage operational DTO without customer contact details, booking
prices, PayOS transaction details or compensation data. The detail response
includes `workflow_phase`, lifecycle `milestones`, `blockers` and
caller-specific `available_actions`. Mutation endpoints continue to enforce
their existing capability, assignment and booking-state requirements.

Incident operations:

| Method | Path | Required capability |
| --- | --- | --- |
| `POST` | `/staff/bookings/:id/incidents` | Capability is selected from `incident_type` |
| `GET` | `/staff/bookings/:id/incidents/active` | `incident.read_garage` or `incident.read_assigned` |
| `GET` | `/staff/bookings/:id/incidents/:incidentId/resolution-options` | `incident.read_garage` |
| `PATCH` | `/staff/bookings/:id/incidents/:incidentId/record-customer-decision` | `incident.record_customer_decision` |
| `POST` | `/staff/bookings/:id/incidents/:incidentId/compensation-vouchers` | `incident.compensation.issue` |

Incident type mapping:

| Incident type | Allowed staff capability |
| --- | --- |
| `WASH_BAY_FAILURE` | `incident.report_wash_bay_failure` |
| `STAFF_UNAVAILABLE` | `incident.report_staff_unavailable` |
| `OTHER_GARAGE_INCIDENT` | `incident.report_other_garage` |

### Service execution workspace

Canonical prefix: `/staff/tasks`

These endpoints are shared by `WASH_OPERATOR` and `VEHICLE_CARE_STAFF`.

| Method | Path | Access |
| --- | --- | --- |
| `GET` | `/staff/tasks` | Assigned tasks only |
| `GET` | `/staff/tasks/:id` | Assigned booking only |
| `GET` | `/staff/tasks/:id/service-steps` | `service_task.read_assigned` |
| `GET` | `/staff/tasks/:id/service-workflow` | `service_task.read_assigned` |
| `PATCH` | `/staff/tasks/:id/service-steps/:stepId/done` | Assigned wash/care execution capability |
| `PATCH` | `/staff/tasks/:id/service-items/:itemKey/complete-early` | Assigned wash/care execution capability |
| `PATCH` | `/staff/tasks/:id/service-items/:itemKey/confirm-complete` | Assigned wash/care execution capability |
| `PATCH` | `/staff/tasks/:id/service-items/:itemKey/pause` | Assigned wash/care execution capability |
| `PATCH` | `/staff/tasks/:id/service-items/:itemKey/resume` | Assigned wash/care execution capability |
| `POST` | `/staff/tasks/:id/incidents` | Incident-type capability and assignment required |
| `GET` | `/staff/tasks/:id/incidents/active` | `incident.read_assigned` |

In addition to capability checks, every service-item mutation verifies:

1. The booking belongs to the staff garage.
2. The staff member is assigned to the booking and item.
3. The staff type matches the item type.
4. The item is in a valid state for the operation.

## 3. New admin assignment APIs

These APIs are available under both `/staff/bookings` and the legacy
`/admin/bookings` prefix. They remain `ADMIN` only.

### `PATCH /staff/bookings/:id/assign-inspection-staff`

Assigns an active `VEHICLE_INSPECTION_STAFF` in the same garage.

Request body:

```json
{
  "staff_profile_id": "665f1b7b2a5f9d0012a22222"
}
```

### `PATCH /staff/bookings/:id/service-items/:itemKey/assign-staff`

Assigns or reassigns an eligible wash/care execution staff member to a service
item.

Request body:

```json
{
  "staff_profile_id": "665f1b7b2a5f9d0012a22222"
}
```

For care items, the API also updates the care-capacity assignment. Existing
service steps for the item are updated to the selected user.

## 4. New staff type change APIs

### Staff self-service

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/staff-profiles/me/type-change-requests` | Request a position change |
| `GET` | `/staff-profiles/me/type-change-requests` | List the current staff member's requests |
| `PATCH` | `/staff-profiles/type-change-requests/:requestId/cancel` | Staff can cancel their own `REQUESTED` request |

Create request body:

```json
{
  "to_staff_type": "WASH_OPERATOR",
  "reason": "Request transfer to wash bay operations",
  "effective_at": "2026-07-20T01:00:00.000Z",
  "handover_note": "Handover current care work before the next shift"
}
```

`from_staff_type`, `from_garage_id`, and `requested_by` are derived by the
backend and cannot be supplied by the client.

### Admin workflow

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/staff-profiles/type-change-requests` | List and filter requests |
| `GET` | `/staff-profiles/:id/type-change-impact` | Preview assignments and capacity impact |
| `PATCH` | `/staff-profiles/type-change-requests/:requestId/approve` | Approve, schedule, or immediately apply |
| `PATCH` | `/staff-profiles/type-change-requests/:requestId/reject` | Reject a pending request |
| `PATCH` | `/staff-profiles/type-change-requests/:requestId/cancel` | Cancel any open request |
| `GET` | `/staff-profiles/:id/type-change-history` | List applied position changes |

Impact preview query:

```text
GET /staff-profiles/:id/type-change-impact
    ?to_staff_type=WASH_OPERATOR
    &effective_at=2026-07-20T01:00:00.000Z
```

Approve request body:

```json
{
  "effective_at": "2026-07-20T01:00:00.000Z",
  "handover_note": "All future work must be reassigned before application",
  "emergency_override": false
}
```

Emergency application requires both fields:

```json
{
  "emergency_override": true,
  "override_reason": "Garage emergency staffing change"
}
```

Lifecycle:

```text
REQUESTED -> APPROVED -> APPLIED
                  |
                  +-> SCHEDULED -> APPLIED
REQUESTED -> REJECTED
OPEN REQUEST -> CANCELLED
SCHEDULED -> FAILED
```

Scheduled requests are processed by the staff-type-change scheduler. Active or
future assignments are recalculated at application time, not trusted from the
earlier preview.

## 5. Existing APIs with changed behavior

### `PATCH /staff-profiles/:id`

`staff_type` is no longer accepted. Supplying it returns validation failure or
`STAFF_TYPE_CHANGE_WORKFLOW_REQUIRED` when the service is called directly.

Still accepted fields:

```json
{
  "staff_code": "STF001",
  "garage_id": "665f1b7b2a5f9d0012a54321"
}
```

### `GET /staff-profiles/me`

### `GET /staff-profiles/:id`

Staff profile responses now include:

```json
{
  "staff_type": "CUSTOMER_SERVICE_STAFF",
  "staff_group": "BOOKING_OPERATIONS",
  "capabilities": ["booking.read_garage", "booking.check_in"]
}
```

### Existing `/admin/bookings` routes

The prefix remains available for backward compatibility. Calls made by
`role=STAFF` now pass through the same capability and assignment policies as
the new staff routes. `ADMIN` retains full access.

### Other existing staff/admin routes

The following previously accepted every `STAFF` account. Staff access is now
limited to `CUSTOMER_SERVICE_STAFF` through capabilities; admin access is
unchanged.

| Existing prefix | Required staff capability |
| --- | --- |
| `/admin/customers` | `customer.read_garage` |
| `/admin/waitlists` | `waitlist.manage_garage` |
| `/admin/payments` | `payment.manage_garage` |
| `/admin/customer-vouchers` read operation | `voucher.read_garage` |
| `/admin/wash-histories` | `wash_history.read_garage` |

### Vehicle handover and customer case workspace

Customer service staff now receive these capabilities:

```text
booking_handover.manage_garage
customer_case.read_garage
customer_case.assign_garage
customer_case.acknowledge
customer_case.communicate_assigned
customer_case.create_walk_in
customer_case.sla.read_garage
```

Canonical routes are `/staff/bookings/:id/handover...` and
`/staff/customer-cases...`. The equivalent `/admin` prefixes remain available
for compatibility. Case reads are garage-scoped; evidence and messages also
require the case to be assigned to the acting customer service staff member.

See `docs/customer-case-handover-workflow.md` for the full workflow and API
payloads.

### License plate arrival workspace

Customer service staff additionally receive `booking.plate_scan` and
`booking.arrival_queue`. Canonical routes are under
`/staff/booking-arrivals`. Scan reads and candidate searches are garage-scoped;
only the confirm endpoint invokes the existing check-in service. Fuzzy/manual
confirmation requires an audited override reason. See
`docs/license-plate-arrival-workflow.md` for staff, admin and fixed-camera APIs.

Inspection staff additionally receive
`customer_case.technical_assess_assigned`. This capability does not grant a
garage-wide case list: assessment detail/start/submit still verify that the
case is assigned to the current inspector.

## 6. New response and persistence fields

Booking responses may now contain:

- `assigned_inspection_staff_id`
- `assigned_inspection_staff`
- `booking_items[].assigned_execution_staff`

The new persistence collection is:

```text
staff_type_change_requests
```

It stores request state, source/target position, effective time, approval,
handover, impact snapshot, emergency override, failure details, and audit
timestamps.

## 7. Compatibility summary

- Customer booking APIs under `/bookings` are unchanged.
- Admin callers keep full access.
- `/admin/bookings` is not removed.
- Staff clients should migrate navigation to `/staff/bookings` and
  `/staff/tasks`.
- Staff clients must handle `403 STAFF_CAPABILITY_REQUIRED` and assignment-level
  `403` errors.
