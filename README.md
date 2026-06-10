# AutoWash Pro Backend

Backend Node.js/Express/MongoDB cho he thong dat lich rua xe, quan ly garage, van hanh dich vu, thanh toan PayOS/CASH va loyalty reward.

Repo hien tai chi co backend. Chua co frontend trong checkout nay.

## Tech Stack

- Node.js + Express 5
- MongoDB + Mongoose
- JWT access token + refresh token cookie
- Zod validation
- Swagger/OpenAPI
- Jest
- PayOS SDK

## Project Structure

```txt
backend/
  src/
    app.js
    server.js
    config/
    docs/swagger/
    routes/
    shared/
    modules/
      auth/
      users/
      staff-profiles/
      garages/
      wash-bays/
      vehicles/
      service-packages/
      bookings/
      booking-waitlists/
      booking-service-steps/
      vehicle-inspections/
      loyalty/
      promotions/
      promotion-usages/
      notifications/
      emails/
      wash-histories/
      payments/
      uploads/
      audit-logs/
      surveys/
    scripts/
      seed.js
      resetDatabase.js
      seedGarage.js
      seedLoyaltyRedeemRule.js
      seedServicePackage.js
      seedStaffProfile.js
      seedTierRule.js
      seedUser.js
      seedVehicle.js
      seedWashBay.js
```

## Run Locally

```bash
cd backend
npm install
npm run dev
```

Default server:

```txt
API: http://localhost:5000/api/v1
Health: http://localhost:5000/health
Swagger: http://localhost:5000/api-docs
```

## Scripts

```bash
npm run dev
npm start
npm test
npm run seed
npm run seed:reset
npm run db:reset
```

`seed:reset` runs seed with reset mode. `db:reset` drops configured collections through `src/scripts/resetDatabase.js`.

## Environment

Create `backend/.env` with the values needed by the runtime:

```txt
PORT
NODE_ENV
MONGO_URI
MONGODB_DB_NAME
CORS_ORIGINS
APP_TIMEZONE_OFFSET

JWT_ACCESS_SECRET
JWT_ACCESS_EXPIRES_IN
JWT_REFRESH_SECRET
JWT_REFRESH_EXPIRES_IN
REFRESH_TOKEN_EXPIRES_IN_DAYS
BCRYPT_SALT_ROUNDS

PASSWORD_RESET_EXPIRES_IN_MINUTES
PASSWORD_RESET_RATE_LIMIT_WINDOW_MINUTES
PASSWORD_RESET_RATE_LIMIT_MAX_REQUESTS
PASSWORD_RESET_RATE_LIMIT_COOLDOWN_SECONDS

PAYOS_CLIENT_ID
PAYOS_API_KEY
PAYOS_CHECKSUM_KEY
PAYOS_RETURN_URL
PAYOS_CANCEL_URL
PAYOS_WEBHOOK_URL
PAYOS_PAYMENT_EXPIRE_MINUTES

WAITLIST_OFFER_EXPIRE_MINUTES
SCHEDULER_ENABLED
WAITLIST_EXPIRE_JOB_INTERVAL_MS
WAITLIST_EXPIRE_BATCH_SIZE
EMAIL_RETRY_JOB_INTERVAL_MS
EMAIL_RETRY_BATCH_SIZE
POINT_EXPIRATION_JOB_INTERVAL_MS

SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_USER
SMTP_PASS
SMTP_FROM_EMAIL
SMTP_FROM_NAME
PASSWORD_RESET_URL
```

Seed scripts also support:

```txt
SEED_ADMIN_PASSWORD
SEED_STAFF_PASSWORD
```

Do not commit real `.env` secrets.

## API Mounts

Main API routes are mounted under `/api/v1`.

Public/customer routes:

```txt
/auth
/users
/staff-profiles
/garages
/vehicles
/service-packages
/bookings
/waitlists
/promotions
/loyalty
/notifications
/wash-histories
/payments
/uploads
/surveys
```

Admin/staff routes:

```txt
/admin/vehicles
/admin/service-packages
/admin/bookings
/admin/waitlists
/admin/payments
/admin/uploads
/admin/audit-logs
/admin/surveys
/admin/promotions
/admin/loyalty
/admin/wash-histories
/admin/wash-bays
/admin/garages
/admin/garages/:garageId/wash-bays
/admin/garages/:garageId/available-wash-bays
```

## Auth

Implemented:

- Register
- Login
- Refresh token
- Logout
- Logout all sessions
- Get current user
- Change password
- Forgot password
- Reset password

Roles currently used:

```txt
CUSTOMER
STAFF
ADMIN
```

## Core Domain

Implemented modules:

- Users
- Staff profiles
- Garages
- Wash bays
- Vehicles
- Service packages
- Bookings
- Booking waitlists
- Booking service steps
- Vehicle inspections
- Loyalty
- Promotions
- Promotion usages
- Notifications
- Wash histories
- Payments

## Booking Capabilities

Customer booking:

- Get available slots
- Create booking for registered customer vehicle
- Redeem loyalty points while creating booking
- View own bookings
- Cancel own booking before check-in

Walk-in booking:

- Staff/Admin can create booking for guest customer
- Guest name, phone, optional email, license plate and vehicle type are stored on booking

Staff/Admin operations:

- Get all bookings
- Check in booking
- Assign wash bay
- Start service
- View service steps
- Mark service step done
- Complete service
- Mark booking paid by cash
- Cancel booking
- Mark no-show
- Create and view vehicle inspections

Booking statuses:

```txt
PENDING
CONFIRMED
CHECKED_IN
IN_PROGRESS
COMPLETED
CANCELED
NO_SHOW
```

## Resource Rules

Wash bay:

- Booking only checks WashBay when at least one booking item requires WashBay.
- WashBay capacity is checked per garage, vehicle type and resource time range.
- Combo booking is expanded into child service booking items, then each item is checked independently.
- Maintenance WashBay is not counted as bookable capacity.

Care staff:

- ServicePackage can require care staff through `requires_care_staff`.
- Each booking item stores care staff type, required count, start time and end time.
- Start service assigns concrete active StaffProfile records to each booking item.
- Each booking item stores `assigned_care_staff` with `staff_profile_id`, `user_id`, `assigned_at`, `released_at`.
- Step creation sets `assigned_staff_id` from the first assigned care staff user for UI display.
- Booking item completion releases the assigned care staff for that item.
- Complete service releases any active care staff assignments that remain.

## Service Packages

Supported package types include individual service packages and combo packages.

Current booking behavior:

- Combo packages expand into included child services.
- Add-on services are appended after primary/combo child services.
- Duplicate service items in the same booking are rejected.
- Combo parent package must not define operational service steps; steps come from child service packages.
- Booking service steps are generated at service start.

## Staff/Admin Cancel

Endpoint:

```txt
PATCH /api/v1/admin/bookings/:id/cancel
```

Rules:

- Allowed for `PENDING`, `CONFIRMED`, `CHECKED_IN`, `IN_PROGRESS`.
- Not allowed for `COMPLETED`, `CANCELED`, `NO_SHOW`.
- Not allowed when booking is `PAID`.
- Not allowed when booking has pending PayOS payment.
- Releases WashBay and active care staff assignments when needed.
- Stores `canceled_at`, `canceled_by_id`, `cancel_reason`.

## Staff/Admin No-show

Endpoint:

```txt
PATCH /api/v1/admin/bookings/:id/mark-no-show
```

Rules:

- Allowed for scheduled customer bookings in `PENDING` or `CONFIRMED`.
- Not allowed for walk-in bookings.
- Not allowed after check-in or service start.
- Not allowed when booking is `PAID`.
- Not allowed when booking has pending PayOS payment.
- Stores `no_show_at`, `no_show_by_id`, `no_show_reason`.

## Waitlist

Customer endpoints:

```txt
GET /api/v1/waitlists
POST /api/v1/waitlists
GET /api/v1/waitlists/:id
PATCH /api/v1/waitlists/:id/cancel
PATCH /api/v1/waitlists/:id/accept
```

Staff/Admin endpoints:

```txt
GET /api/v1/admin/waitlists
PATCH /api/v1/admin/waitlists/:id/offer
PATCH /api/v1/admin/waitlists/:id/expire
PATCH /api/v1/admin/waitlists/:id/cancel
```

Waitlist statuses:

```txt
WAITING
OFFERED
ACCEPTED
CANCELED
EXPIRED
```

Rules:

- Customer can join waitlist only for an existing future slot that is currently unavailable.
- Customer cannot create duplicate active waitlist entries for the same vehicle, garage, service package, add-ons and start time.
- When a customer/staff/admin cancel or staff/admin mark no-show releases a slot, the system offers the slot to the oldest matching `WAITING` waitlist entry.
- Matching uses garage, service package, vehicle type, start time and add-on set.
- If the released booking has a customer, that same customer is skipped for the offer.
- Staff/Admin can manually offer a `WAITING` waitlist entry when its desired slot is currently available.
- Staff/Admin can manually expire an `OFFERED` waitlist entry.
- Accepting an offer creates a real booking through the normal customer booking flow, so capacity is rechecked.
- Waitlist notifications are in-app notifications.
- Offer expiration is checked when the customer accepts or cancels the waitlist entry.

## Payment

Implemented payment flows:

- Cash mark paid by Staff/Admin after booking is completed
- PayOS payment link/QR creation
- Reuse existing active PayOS transaction
- Cancel pending PayOS payment
- Expire overdue PayOS payment
- PayOS webhook verification and processing

PayOS transaction lifecycle:

```txt
INITIATED -> PENDING -> PAID
INITIATED -> FAILED
PENDING -> CANCELING -> CANCELED
PENDING -> EXPIRED
PENDING -> FAILED
```

Reward processing happens only after booking is both:

```txt
COMPLETED + PAID
```

`confirmBookingPaid()` owns the paid-state invariant and triggers:

- WashHistory creation
- Loyalty point earning
- Loyalty point redeem/refund transactions
- PointTransaction creation
- PromotionUsage creation
- Payment/reward notification
- `reward_processed` guard against duplicate reward handling

## Notifications

Implemented:

- In-app notifications
- Read/unread management
- Delete notifications
- Notification constants for booking, loyalty, promotion and waitlist-related events
- Email sender through SMTP/nodemailer
- Email notification delivery with `PENDING`, `SENT` and `FAILED` statuses
- Forgot password email with reset token when the user account has email

Background jobs:

- Automatic waitlist offer expiration
- Automatic email retry for `PENDING` and `FAILED` email notifications
- Automatic loyalty point expiration

## Uploads

Implemented:

- Authenticated multipart upload through `POST /api/v1/uploads`
- Cloudinary-backed storage through `multer` memory upload
- Upload metadata stored with `url`, `public_id`, `mime_type`, `size`, `purpose`, `owner_id`, `related_type` and `related_id`
- Owner or Admin delete through `DELETE /api/v1/uploads/:id`
- Admin upload listing through `GET /api/v1/admin/uploads`

## Audit Logs

Implemented:

- Immutable audit event storage with actor, action, resource, snapshots and request context
- Shared `recordAuditEvent()` service for feature modules
- Sensitive values are redacted before audit persistence
- Upload create and delete audit events
- Admin-only listing through `GET /api/v1/admin/audit-logs`
- Filters for actor, action, resource, IP and created time range

## Surveys

Implemented:

- Admin survey CRUD through `/api/v1/admin/surveys`
- Draft, published and closed survey lifecycle
- Question types: `RATING`, `NPS`, `SINGLE_CHOICE`, `MULTI_CHOICE` and `TEXT`
- Customer available survey lookup through `GET /api/v1/surveys/available?booking_id=...`
- Customer response submission through `POST /api/v1/surveys/:id/responses`
- Survey response is optional and only allowed after customer-owned booking is `COMPLETED + PAID`
- WashHistory is required before survey submission
- One response per survey and booking
- Configurable response window with a default of 7 days
- Optional customer-owned image uploads with purpose `SURVEY_RESPONSE`
- Admin response listing through `GET /api/v1/admin/surveys/:id/responses`
- Audit events for survey lifecycle and customer response submission

## Testing

Run all backend tests:

```bash
cd backend
npm test -- --runInBand
```

Current verified state:

```txt
30 test suites passed
155 tests passed
```

## Current Gaps

These items are future work. They are not implemented as modules in the current checkout:

- Frontend app
- Analytics/research module
- Advanced job dashboard, distributed locks and retry backoff controls

Some npm dependencies are already installed for future capabilities, such as `@google/generative-ai`, but the corresponding full modules are not currently implemented.
