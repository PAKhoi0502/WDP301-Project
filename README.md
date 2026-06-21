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
npm run migrate:phone-e164
npm run migrate:walk-in-promotions
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

SMS_PROVIDER
OTP_SECRET
OTP_EXPIRES_IN_MINUTES
OTP_MAX_ATTEMPTS
OTP_REQUEST_COOLDOWN_SECONDS
OTP_RATE_LIMIT_WINDOW_MINUTES
OTP_RATE_LIMIT_MAX_REQUESTS
OTP_IP_RATE_LIMIT_MAX_REQUESTS
PHONE_VERIFICATION_TOKEN_EXPIRES_IN_MINUTES

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
WALK_IN_CLAIM_LOOKBACK_MONTHS

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
/admin/customers
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
- Request phone verification OTP
- Verify phone OTP
- Login
- Refresh token
- Logout
- Logout all sessions
- Get current user
- Change password
- Forgot password
- Reset password

Registration requires phone verification:

```txt
POST /api/v1/auth/phone-verifications/request
POST /api/v1/auth/phone-verifications/verify
POST /api/v1/auth/register
```

Phone identity is stored in E.164 format. Inputs such as `0901234567`, `84901234567`, and `+84901234567` are normalized to `+84901234567`.

Use `purpose=REGISTER` before registration. To change the current user's phone, use `purpose=CHANGE_PHONE` with a bearer token, verify the OTP with the same user, then send `phone`, `current_password`, and `phone_verification_token` to `PATCH /api/v1/users/me`.

Development defaults to `SMS_PROVIDER=mock`. The request response includes `debug_otp` outside production. Production startup rejects the mock provider and requires `OTP_SECRET`.

Run `npm run migrate:phone-e164` once before deploying this normalization change to a database that already contains local-format user phones. The migration stops on normalization collisions instead of merging accounts.

Run `npm run migrate:walk-in-promotions` once before deploying walk-in promotion reservations and history claims to an existing database. The migration normalizes valid guest phones, marks legacy promotion usages as consumed, initializes promotion audience fields and synchronizes usage counters.

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
- Garage, service package, license plate and vehicle type are required
- Use `serve_now=true` without `start_time` to create an immediate walk-in at the current minute; successful immediate bookings are checked in automatically
- Scheduled walk-ins use `start_time` and remain aligned with the garage slot interval
- When WashBay or care-staff capacity is unavailable, the error includes `errors.suggested_slots`; no booking is created
- Scheduled walk-ins use the same grace-period, late-arrival suggestions, rescheduling and no-show flow as customer bookings
- Guest name, phone, email, add-ons, promotion code and note are optional
- A valid guest phone is required when the selected promotion uses phone identification
- Walk-in promotion usage is reserved at booking creation, consumed after completed payment and released when the booking is canceled
- One-time walk-in promotions can use `audience=WALK_IN`, `phone_required=true` and `per_phone_limit=1`
- Guest phones are normalized to E.164 before storage and promotion checks
- Completed paid walk-in histories from the configured lookback period are claimed after account registration by verified phone
- History claim links wash history and promotion usage but does not grant loyalty points, visits, spending or tier progress

Customer history claim retry:

```txt
POST /api/v1/wash-histories/claim
```

The endpoint always uses the authenticated customer's verified account phone and is idempotent.

Staff/Admin operations:

- Get all bookings
- Get booking detail by id
- Search registered customers by garage
- Check in booking
- Assign wash bay
- Start service
- View service steps
- Mark service step done
- Complete service
- Reopen completed service by admin when unpaid and reward is not processed
- Mark booking paid by cash
- Cancel booking
- Mark no-show
- View wash histories scoped to assigned garage
- Create and view vehicle inspections

Staff portal lookup endpoints:

```txt
GET /api/v1/admin/bookings/:id
GET /api/v1/admin/customers?garage_id=:garageId&search=:keyword&page=1&limit=20
GET /api/v1/admin/wash-histories?page=1&limit=20
GET /api/v1/admin/wash-histories/:id
```

`GET /api/v1/admin/customers` returns registered customers that have at least one non-walk-in booking at the selected garage. `garage_id` is required; Staff access is scoped to the assigned garage.
`GET /api/v1/admin/wash-histories` returns all histories for Admin, while Staff access is scoped to the assigned garage.

Early arrivals:

- `PATCH /api/v1/admin/bookings/:id/check-in` records `arrival_status=EARLY` when the customer arrives before `start_time`.
- `PATCH /api/v1/admin/bookings/:id/start-service` still rejects early service by default.
- Send `allow_early_start=true` to start an early checked-in booking when the shifted timeline is inside garage business hours and vehicle, wash-bay and care-staff capacity are still available.

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

- Allowed for scheduled customer and walk-in bookings in `PENDING` or `CONFIRMED`.
- Not allowed after check-in or service start.
- Not allowed when booking is `PAID`.
- Not allowed when booking has pending PayOS payment.
- Stores `no_show_at`, `no_show_by_id`, `no_show_reason`.

## Admin Reopen Completed Service

Endpoint:

```txt
PATCH /api/v1/admin/bookings/:id/reopen-service
```

Rules:

- Admin only.
- Allowed only when booking is `COMPLETED`.
- Allowed only when `payment_status=UNPAID`, `reward_processed=false`, and `paid_at=null`.
- Moves booking back to `IN_PROGRESS` and clears `completed_at`.
- Reclaims the released WashBay when the booking uses one.

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

## Analytics

Implemented:

- Admin-only analytics through `/api/v1/admin/analytics`
- Overview, booking, revenue, garage, service, promotion and wash-bay reports
- Survey analytics with rating distribution, NPS and choice distribution
- Shared date, garage, service-package, vehicle-type and grouping filters
- Revenue sourced from paid wash histories
- Promotion metrics sourced from consumed promotion usages
- Estimated wash-bay utilization with explicit data-quality notes
- Idempotent demo data through `npm run seed:analytics-demo`

## Research

Implemented:

- Admin-only research report lifecycle through `/api/v1/admin/research`
- `SURVEY_INSIGHT` reports using aggregated survey analytics and anonymous feedback
- Atomic `DRAFT`, `PROCESSING`, `COMPLETED` and `FAILED` state transitions
- Structured Gemini output validated with Zod
- One structured-output retry before report failure
- PII redaction, feedback limits and verifiable snapshot hashes
- Retry for failed reports using the saved data snapshot
- Audit events for create, update, delete, start, completion and failure

## Testing

Run all backend tests:

```bash
cd backend
npm test -- --runInBand
```

Current verified state:

```txt
42 test suites passed
235 tests passed
```

## Current Gaps

These items are future work. They are not implemented as modules in the current checkout:

- Frontend app
- Advanced job dashboard, distributed locks and retry backoff controls

The backend uses `@google/genai` for structured survey insight reports.
