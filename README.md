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
      booking-service-steps/
      vehicle-inspections/
      loyalty/
      promotions/
      promotion-usages/
      notifications/
      wash-histories/
      payments/
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
/promotions
/loyalty
/notifications
/wash-histories
/payments
```

Admin/staff routes:

```txt
/admin/vehicles
/admin/service-packages
/admin/bookings
/admin/payments
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

Not implemented yet:

- Real email sender service
- Email delivery workflow
- Waitlist business flow

## Testing

Run all backend tests:

```bash
cd backend
npm test -- --runInBand
```

Current verified state:

```txt
23 test suites passed
111 tests passed
```

## Current Gaps

These items are future work. They are not implemented as modules in the current checkout:

- Frontend app
- Real waitlist module and offer flow
- Real email sender service
- Analytics/research module
- Survey module
- Upload module
- Audit log module
- Automated background jobs

Some npm dependencies are already installed for future capabilities, such as `multer`, `cloudinary` and `nodemailer`, but the corresponding full modules are not currently implemented.
