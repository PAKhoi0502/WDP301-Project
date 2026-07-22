# Staff authorization and position changes

For the complete endpoint-by-endpoint change log, see
[`staff-api-changes.md`](./staff-api-changes.md).

## Authorization model

`role=STAFF` identifies the account class. `staff_type` identifies the primary
position. The API derives a workspace group and capabilities from `staff_type`;
capabilities are not duplicated in MongoDB.

| Workspace | Staff types |
| --- | --- |
| `BOOKING_OPERATIONS` | `CUSTOMER_SERVICE_STAFF`, `VEHICLE_INSPECTION_STAFF` |
| `SERVICE_EXECUTION` | `WASH_OPERATOR`, `VEHICLE_CARE_STAFF` |

The workspace is a navigation concept only. Authorization still evaluates the
individual capability, assigned garage, resource assignment, and resource
state. Admin users bypass staff capability checks.

The shared staff booking routes are available at `/api/v1/staff/bookings`.
Wash and care staff also share the focused execution workspace at
`/api/v1/staff/tasks`.
`/api/v1/admin/bookings` remains available for backward compatibility, but the
same staff capability checks apply when the caller has `role=STAFF`.

Clients should use `GET /api/v1/staff-profiles/me/capabilities` as the source for
workspace navigation and action visibility. Hiding a control in the client does
not replace backend authorization.

## Assignment authorization

- Customer service staff can read bookings in their assigned garage.
- Inspection staff can view the same-garage workflow queue and atomically claim
  an unassigned checked-in booking through
  `PATCH /api/v1/staff/workspace/bookings/:bookingId/claim-inspection`.
- Inspection staff can read and create inspections only for bookings whose
  `assigned_inspection_staff_id` is their user id after self-claim or admin
  assignment.
- Wash and care staff can read bookings containing an active assignment for
  their staff profile.
- Service-item mutations require the staff type expected by the item and an
  active `assigned_execution_staff` or `assigned_care_staff` entry.

Admin-only assignment commands:

- `PATCH /api/v1/staff/bookings/:id/assign-inspection-staff`
- `PATCH /api/v1/staff/bookings/:id/service-items/:itemKey/assign-staff`

The inspection assignment command is an override for exceptional reassignment.
Normal queue ownership is established by the inspection staff self-claim API.

Wash execution staff are assigned when service starts when an active wash
operator is available. Existing care-staff capacity assignments are also copied
to the execution assignment for the corresponding item.

## Position change workflow

Normal lifecycle:

```text
REQUESTED -> APPROVED -> APPLIED
                  |
                  +----> SCHEDULED -> APPLIED
REQUESTED -------------------------> REJECTED
REQUESTED/APPROVED/SCHEDULED ------> CANCELLED
SCHEDULED -------------------------> FAILED
```

Requests have one of two initiation sources:

- `STAFF_SELF_REQUEST`: an active staff member requests their own position
  change.
- `ADMIN_DIRECTED`: an administrator initiates an operational reassignment for
  an active staff member.

Both sources enter `REQUESTED`. Admin initiation does not update `staff_type`
and does not bypass approval, impact checks, scheduling, audit or token
revocation. The same admin may initiate and approve in the current operating
model; separation of duties can be introduced later without changing the state
machine.

Admin initiation calculates and stores an initial impact snapshot. If the staff
member has active or future assignments, `handover_note` is mandatory. Approval
and scheduled application still recalculate impact because the initial snapshot
can become stale.

The source staff type and garage are captured from the profile on the server.
The general profile update endpoint rejects `staff_type`; callers must use this
workflow.

Endpoints:

- `POST /api/v1/staff-profiles/me/type-change-requests`
- `GET /api/v1/staff-profiles/me/type-change-requests`
- `POST /api/v1/staff-profiles/:id/type-change-requests` (admin initiation)
- `GET /api/v1/staff-profiles/type-change-requests` (admin)
- `GET /api/v1/staff-profiles/:id/type-change-impact` (admin)
- `PATCH /api/v1/staff-profiles/type-change-requests/:requestId/approve` (admin)
- `PATCH /api/v1/staff-profiles/type-change-requests/:requestId/reject` (admin)
- `PATCH /api/v1/staff-profiles/type-change-requests/:requestId/cancel`
- `GET /api/v1/staff-profiles/:id/type-change-history` (admin)

Impact preview reports active and future assignments plus source and target
capacity. Approval stores a snapshot, but application recalculates the impact
inside the transaction. A due change is deferred when active work exists.
Emergency application requires `emergency_override=true` and a non-empty
`override_reason`.

Staff can cancel only their own `STAFF_SELF_REQUEST` while it is still
`REQUESTED`. They cannot cancel an `ADMIN_DIRECTED` reassignment. Admin can
cancel any open request, but an audit reason is mandatory.

Creating a self-request notifies all active admins. Creating an
admin-directed request notifies the target staff member. Approval, scheduling,
application, rejection, cancellation and terminal scheduler failure notify the
target staff.

The scheduler applies due changes every minute by default. Configure it with:

- `STAFF_TYPE_CHANGE_JOB_INTERVAL_MS`
- `STAFF_TYPE_CHANGE_BATCH_SIZE`

After deploying request-source fields, run:

```text
npm run migrate:staff-type-change-sources:dry-run
npm run migrate:staff-type-change-sources
```

Applying a change updates the staff profile, writes an audit event, creates an
in-app notification, and revokes refresh tokens. Capability middleware reads the
current staff profile, so the new authorization matrix is effective immediately
for subsequent API requests.
