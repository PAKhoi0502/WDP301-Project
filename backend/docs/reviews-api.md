# Reviews API

## Domain boundary

Reviews are verified public feedback tied to one completed and settled booking.
Surveys remain flexible internal research and are never published as reviews
without a new customer submission.

Each review stores:

- One garage rating from 1 to 5.
- One primary service package rating from 1 to 5.
- An optional comment, up to five owned image uploads and anonymous display.
- At most one official garage reply.
- Moderation state and audit metadata.

The API derives `garage_id`, `service_package_id` and `wash_history_id` from the
owned booking. Clients cannot select a different review target.

## Eligibility

A review can be created when:

- The authenticated customer owns the booking or has claimed the walk-in booking.
- The booking status is `COMPLETED`.
- Payment status is `PAID` or `WAIVED`.
- A wash history exists for the customer and booking.
- No review, including a soft-deleted review, already exists for the booking.

## Public

| Method | Path |
| --- | --- |
| `GET` | `/garages/:garageId/reviews` |
| `POST` | `/garages/:garageId/reviews` |
| `GET` | `/garages/:garageId/review-summary` |
| `GET` | `/service-packages/:servicePackageId/reviews` |
| `GET` | `/service-packages/:servicePackageId/review-summary` |

The nested garage `POST` is authenticated and remains compatible with the
existing Mobile contract. A legacy `rating` value is applied to both rating
dimensions when `garage_rating` and `service_rating` are omitted.

Public lists only return non-deleted `PUBLISHED` reviews. Customer ownership,
booking IDs, upload ownership and moderation data are omitted.

## Customer

| Method | Path |
| --- | --- |
| `GET` | `/reviews/eligibility?booking_id=...` |
| `POST` | `/reviews` |
| `GET` | `/reviews/mine` |
| `GET` | `/reviews/by-booking/:bookingId` |
| `PATCH` | `/reviews/:id` |
| `DELETE` | `/reviews/:id` |

Deletion is soft deletion. A deleted review no longer contributes to public
lists or rating summaries and cannot be recreated for the same booking.

## Staff

| Method | Path | Capability |
| --- | --- | --- |
| `GET` | `/staff/reviews` | `review.read_garage` |
| `GET` | `/staff/reviews/:id` | `review.read_garage` |
| `PUT` | `/staff/reviews/:id/reply` | `review.reply_garage` |
| `DELETE` | `/staff/reviews/:id/reply` | `review.reply_garage` |

Only active `CUSTOMER_SERVICE_STAFF` receive these capabilities. The assigned
garage is resolved from StaffProfile and cannot be overridden by a request.

## Admin

| Method | Path |
| --- | --- |
| `GET` | `/admin/reviews` |
| `GET` | `/admin/reviews/:id` |
| `PATCH` | `/admin/reviews/:id/moderation` |
| `GET` | `/admin/reviews/analytics` |

Admin can hide or republish a review but cannot edit customer ratings or
comments. Hiding requires a moderation reason, and `OTHER` also requires a
note. Moderation, customer changes and garage replies are recorded in audit
logs.

## Rating summaries

Public Garage and Service Package responses include:

```json
{
  "rating_average": 4.6,
  "rating_count": 125
}
```

Only non-deleted `PUBLISHED` reviews are included. Dedicated summary endpoints
also return the 1-to-5 distribution.

## Uploads and notifications

Review images must be uploaded with purpose `REVIEW`. On attachment, the upload
is linked with related type `REVIEW`.

Customers receive in-app notifications when:

- A completed settled booking becomes reviewable.
- A claimed walk-in booking becomes reviewable.
- Garage staff create or update an official reply.
- Admin hides or republishes the review.

## Demo data

Use `npm run seed:reviews:dry-run` to validate the current seed dependencies.
Use `npm run seed:reviews` to upsert up to 30 deterministic reviews. The seed
does not overwrite a customer-created review for the same booking.
