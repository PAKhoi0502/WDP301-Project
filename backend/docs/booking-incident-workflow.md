# Booking incident and garage cancellation workflow

## Business flow

1. Staff reports a garage-side incident for an active booking.
2. Backend creates one active incident, automatically pauses the current countdown, releases the affected resource when applicable, and changes the booking to `AWAITING_CUSTOMER_DECISION`.
3. Backend notifies garage staff and the registered customer. While the incident is unresolved, booking service operations return `409 BOOKING_INCIDENT_DECISION_REQUIRED`.
4. The customer decides in the app, or staff records a decision received by phone or in person.
5. The selected outcome is applied atomically:
   - `REASSIGN_AND_CONTINUE`: allocate replacement resources and resume the remaining countdown.
   - `RESCHEDULE_NEAREST`: backend selects the first currently available slot.
   - `RESCHEDULE_CUSTOM`: use the customer-selected available slot.
   - `CANCEL_BY_GARAGE`: cancel without a customer violation, refund redeemed points, release a reserved voucher, release resources, and offer the released capacity to the waitlist.
6. Staff can issue compensation. Amounts above the staff limit require admin approval.

Only unpaid bookings can currently be canceled through the incident workflow. A paid booking returns `409 BOOKING_INCIDENT_PAYMENT_REFUND_REQUIRED` because payment-provider refund handling is not part of this flow.

## New customer APIs

### `GET /api/v1/bookings/:id/incidents/active`

Returns the active incident and current resolution options for the booking owner.

### `PATCH /api/v1/bookings/:id/incidents/:incidentId/decision`

Records the customer's decision in the app.

```json
{
  "decision": "RESCHEDULE_CUSTOM",
  "new_start_time": "2026-07-20T09:00:00+07:00",
  "continuation_policy": "RESUME_REMAINING",
  "customer_note": "Please move my booking to this time"
}
```

`new_start_time` is required only for `RESCHEDULE_CUSTOM`. The server chooses the slot for `RESCHEDULE_NEAREST`.

### `GET /api/v1/customer-vouchers`

Lists the authenticated customer's vouchers. Optional query fields: `status`, `garage_id`, `page`, and `limit`.

### `POST /api/v1/customer-vouchers/validate`

Previews a voucher before booking creation.

```json
{
  "code": "CARE_ABC123",
  "service_package_id": "507f1f77bcf86cd799439011",
  "order_amount": 300000
}
```

## New staff and admin APIs

### `POST /api/v1/admin/bookings/:id/incidents`

Reports a garage incident.

```json
{
  "incident_type": "WASH_BAY_FAILURE",
  "description": "The assigned wash bay stopped during service",
  "affected_booking_item_key": "ITEM_1_507F1F77BCF86CD799439011",
  "affected_wash_bay_id": "507f1f77bcf86cd799439012"
}
```

Supported types are `WASH_BAY_FAILURE`, `STAFF_UNAVAILABLE`, and `OTHER_GARAGE_INCIDENT`. `description` is required for `OTHER_GARAGE_INCIDENT`.

### `GET /api/v1/admin/bookings/:id/incidents/active`

Returns the active incident and resolution options.

### `GET /api/v1/admin/bookings/:id/incidents/:incidentId/resolution-options`

Returns replacement feasibility and available reschedule slots. Query `days` accepts `1` to `7`.

### `PATCH /api/v1/admin/bookings/:id/incidents/:incidentId/record-customer-decision`

Records a decision confirmed outside the app. `contact_channel` must be `PHONE` or `IN_PERSON`.

```json
{
  "decision": "CANCEL_BY_GARAGE",
  "contact_channel": "PHONE",
  "customer_note": "Customer selected cancellation"
}
```

### `POST /api/v1/admin/bookings/:id/incidents/:incidentId/compensation-vouchers`

Issues a customer-bound compensation voucher or creates a pending approval request.

```json
{
  "voucher_type": "FIXED_AMOUNT",
  "value": 100000,
  "min_order_amount": 0,
  "expires_at": "2026-10-31T23:59:59+07:00",
  "note": "Compensation for garage incident"
}
```

Voucher types are `FIXED_AMOUNT`, `PERCENTAGE`, and `FREE_SERVICE`. A free-service voucher requires `service_package_id` and uses `value: 0`. A percentage voucher can use a positive `max_discount_amount`.

### `GET /api/v1/admin/customer-vouchers`

Lists compensation vouchers. Staff are restricted to their garage; admin can filter with `garage_id`. Optional query fields: `status`, `garage_id`, `page`, and `limit`.

### `PATCH /api/v1/admin/customer-vouchers/:id/approve`

Admin approves a voucher in `PENDING_APPROVAL`.

### `PATCH /api/v1/admin/customer-vouchers/:id/revoke`

Admin revokes a voucher in `PENDING_APPROVAL` or `ISSUED`.

## Changed APIs and responses

### `POST /api/v1/bookings`

Accepts optional `voucher_code`. Voucher discount is applied after promotion discount and before loyalty points. The voucher is reserved atomically with booking creation.

### Booking response objects

Booking detail and list responses now include:

- `operation_status`
- `active_incident_id`
- `active_incident`
- `cancellation_source`
- `cancellation_incident_id`
- `customer_voucher_id`
- `customer_voucher`
- `voucher_discount_amount`

### `GET /api/v1/admin/bookings/:id/service-workflow`

Now includes `operation_status`, `blocked_by_incident`, `active_incident_id`, and workflow phase `INCIDENT_HOLD`.

### Existing booking operation APIs

Cancel, no-show, check-in, arrival resolution, resource assignment, service start, step completion, countdown pause/resume, early completion, final completion, and mark-paid operations now reject unresolved incidents with `409 BOOKING_INCIDENT_DECISION_REQUIRED`.

Customer and staff cancellation now create `BOOKING_CANCELED` notifications. Reserved compensation vouchers are released on cancellation and consumed on payment or no-show.

### `/api/v1/notifications`

Notification APIs now allow `CUSTOMER`, `STAFF`, and `ADMIN` because incident alerts are sent to garage personnel as well as customers.

## Configuration

`GARAGE_COMPENSATION_STAFF_MAX_AMOUNT` controls the maximum staff-issued compensation amount without admin approval. The default is `100000`.
