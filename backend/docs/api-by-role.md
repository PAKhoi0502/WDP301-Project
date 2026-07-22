# API by role and function

Nguon doi chieu: `backend/src/app.js`, `backend/src/routes/index.js`, cac file `backend/src/modules/**/*.routes.js`, va OpenAPI summary hien co.

Base API path: `/api/v1`. Ngoai base nay co `GET /health` va Swagger UI tai `/api-docs`.

## Legend

| Role | Nghia trong source |
| --- | --- |
| Public | Khong can access token |
| Optional auth | Co the khong gui token; neu co token hop le thi gan `req.user` |
| Authenticated | Can access token hop le, khong filter role |
| CUSTOMER | `authorize(USER_ROLES.CUSTOMER)` |
| STAFF | `authorize(USER_ROLES.STAFF)` |
| ADMIN | `authorize(USER_ROLES.ADMIN)` |

Neu source route cho ca STAFF va ADMIN cung truy cap, tai lieu nay lap lai endpoint thanh hai dong rieng de de filter theo tung role.

## Same-function map

| Chuc nang | Public / optional | Authenticated | CUSTOMER | STAFF | ADMIN |
| --- | --- | --- | --- | --- | --- |
| Auth/session | Register, login, refresh, logout, reset password, phone OTP | `/auth/me`, logout all, change password | Self-session endpoints neu user la CUSTOMER | Self-session endpoints neu user la STAFF | Self-session endpoints neu user la ADMIN |
| User profile | - | `/users/me` | `/auth/me`, `/users/me` | `/auth/me`, `/users/me`, `/staff-profiles/me` | `/auth/me`, `/users/me`; admin quan ly `/users`, `/staff-profiles` |
| Garages | Xem garage active | - | - | - | Quan ly toan bo garage |
| Wash bays | - | - | - | - | Quan ly wash bay va xem wash bay theo garage |
| Vehicles | - | - | Quan ly xe cua minh | - | Quan ly tat ca xe / tao xe cho customer |
| Customers | - | - | - | Tim customer | Tim customer |
| Service packages | Xem goi active | - | - | - | Quan ly tat ca goi dich vu |
| Bookings | Xem slot trong | - | Dat/xem/huy booking cua minh, xem inspection cua booking minh | Van hanh booking, walk-in, check-in, late arrival, thanh toan, inspection | Van hanh booking, walk-in, check-in, late arrival, thanh toan, inspection; reopen completed service |
| Waitlists | - | - | Quan ly waitlist cua minh, accept offer | Quan ly/offer/expire/cancel waitlist | Quan ly/offer/expire/cancel waitlist |
| Promotions | Xem promotion active | - | Validate promotion cho customer | - | Quan ly promotion |
| Loyalty | - | - | Xem diem/hang, transactions, redeem preview, tier rules active | - | Quan ly loyalty, tier rules, expire points |
| Notifications | - | - | Quan ly notification cua minh | - | - |
| Wash histories | - | - | Xem/claim history cua minh | Xem wash histories | Xem wash histories |
| Payments | PayOS webhook | - | Tao/lấy QR và polling payment của booking thuộc sở hữu | Tao/xem/huy/expire payment | Tao/xem/huy/expire payment, analytics theo kênh |
| Uploads | - | Upload/delete owned file | Upload/delete owned file | Upload/delete owned file | Upload/delete owned file; list uploads |
| Surveys | - | - | Xem survey available va submit response | - | Quan ly survey va xem responses |
| Analytics | - | - | - | - | Xem analytics dashboard |
| Research | - | - | - | - | Quan ly/run/retry research report |
| Audit logs | - | - | - | - | Xem audit logs |

## Full API matrix

### System and docs

| Chuc nang | Role | APIs |
| --- | --- | --- |
| Health check | Public | `GET /health` |
| API welcome | Public | `GET /api/v1/` |
| Swagger UI | Public | `GET /api-docs` va cac asset do `swaggerUi.serve` phuc vu |

### Auth and session

| Chuc nang | Role | APIs |
| --- | --- | --- |
| Phone OTP | Optional auth | `POST /api/v1/auth/phone-verifications/request`, `POST /api/v1/auth/phone-verifications/verify` |
| Register/login | Public | `POST /api/v1/auth/register`, `POST /api/v1/auth/login` |
| Refresh/logout current session | Public | `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout` |
| Logout all devices | Authenticated | `POST /api/v1/auth/logout-all` |
| Current auth user | Authenticated | `GET /api/v1/auth/me` |
| Password | Public | `POST /api/v1/auth/forgot-password`, `POST /api/v1/auth/reset-password` |
| Password | Authenticated | `POST /api/v1/auth/change-password` |

### Users and staff profiles

| Chuc nang | Role | APIs |
| --- | --- | --- |
| Current user profile | Authenticated | `GET /api/v1/users/me`, `PATCH /api/v1/users/me` |
| User management | ADMIN | `GET /api/v1/users`, `GET /api/v1/users/:id`, `PATCH /api/v1/users/:id`, `PATCH /api/v1/users/:id/status`, `PATCH /api/v1/users/:id/role`, `DELETE /api/v1/users/:id` |
| My staff profile | STAFF | `GET /api/v1/staff-profiles/me` |
| Staff profile management | ADMIN | `GET /api/v1/staff-profiles`, `POST /api/v1/staff-profiles`, `GET /api/v1/staff-profiles/:id`, `PATCH /api/v1/staff-profiles/:id`, `PATCH /api/v1/staff-profiles/:id/status`, `DELETE /api/v1/staff-profiles/:id` |

### Garages and wash bays

| Chuc nang | Role | APIs |
| --- | --- | --- |
| Public garage browsing | Public | `GET /api/v1/garages`, `GET /api/v1/garages/:id` |
| Garage management | ADMIN | `GET /api/v1/admin/garages`, `POST /api/v1/admin/garages`, `GET /api/v1/admin/garages/:id`, `PATCH /api/v1/admin/garages/:id`, `PATCH /api/v1/admin/garages/:id/status`, `DELETE /api/v1/admin/garages/:id` |
| Wash bay management | ADMIN | `GET /api/v1/admin/wash-bays`, `POST /api/v1/admin/wash-bays`, `GET /api/v1/admin/wash-bays/:id`, `PATCH /api/v1/admin/wash-bays/:id`, `PATCH /api/v1/admin/wash-bays/:id/status`, `DELETE /api/v1/admin/wash-bays/:id` |
| Wash bay by garage | ADMIN | `GET /api/v1/admin/garages/:garageId/wash-bays`, `GET /api/v1/admin/garages/:garageId/available-wash-bays` |

### Vehicles and customers

| Chuc nang | Role | APIs |
| --- | --- | --- |
| My vehicles | CUSTOMER | `GET /api/v1/vehicles`, `POST /api/v1/vehicles`, `GET /api/v1/vehicles/:id`, `PATCH /api/v1/vehicles/:id`, `DELETE /api/v1/vehicles/:id` |
| Vehicle management | ADMIN | `GET /api/v1/admin/vehicles`, `POST /api/v1/admin/vehicles`, `GET /api/v1/admin/vehicles/:id`, `PATCH /api/v1/admin/vehicles/:id`, `DELETE /api/v1/admin/vehicles/:id` |
| Customer search | STAFF | `GET /api/v1/admin/customers` |
| Customer search | ADMIN | `GET /api/v1/admin/customers` |

### Service packages

| Chuc nang | Role | APIs |
| --- | --- | --- |
| Public service package browsing | Public | `GET /api/v1/service-packages`, `GET /api/v1/service-packages/:id` |
| Service package management | ADMIN | `GET /api/v1/admin/service-packages`, `POST /api/v1/admin/service-packages`, `GET /api/v1/admin/service-packages/:id`, `PATCH /api/v1/admin/service-packages/:id`, `PATCH /api/v1/admin/service-packages/:id/activate`, `PATCH /api/v1/admin/service-packages/:id/deactivate`, `PATCH /api/v1/admin/service-packages/:id/steps-template`, `PATCH /api/v1/admin/service-packages/:id/included-services`, `DELETE /api/v1/admin/service-packages/:id` |

### Bookings and vehicle inspections

| Chuc nang | Role | APIs |
| --- | --- | --- |
| Available slots | Optional auth | `GET /api/v1/bookings/available-slots` |
| My bookings | CUSTOMER | `GET /api/v1/bookings`, `POST /api/v1/bookings`, `GET /api/v1/bookings/:id`, `PATCH /api/v1/bookings/:id/cancel` |
| My booking inspections | CUSTOMER | `GET /api/v1/bookings/:id/inspections` |
| Booking operations | STAFF | `GET /api/v1/admin/bookings`, `POST /api/v1/admin/bookings/walk-in`, `GET /api/v1/admin/bookings/:id`, `PATCH /api/v1/admin/bookings/:id/cancel`, `PATCH /api/v1/admin/bookings/:id/mark-no-show`, `PATCH /api/v1/admin/bookings/:id/check-in`, `GET /api/v1/admin/bookings/:id/late-arrival-options`, `PATCH /api/v1/admin/bookings/:id/resolve-late-arrival`, `PATCH /api/v1/admin/bookings/:id/assign-wash-bay`, `PATCH /api/v1/admin/bookings/:id/start-service`, `PATCH /api/v1/admin/bookings/:id/complete-service`, `PATCH /api/v1/admin/bookings/:id/mark-paid` |
| Booking operations | ADMIN | `GET /api/v1/admin/bookings`, `POST /api/v1/admin/bookings/walk-in`, `GET /api/v1/admin/bookings/:id`, `PATCH /api/v1/admin/bookings/:id/cancel`, `PATCH /api/v1/admin/bookings/:id/mark-no-show`, `PATCH /api/v1/admin/bookings/:id/check-in`, `GET /api/v1/admin/bookings/:id/late-arrival-options`, `PATCH /api/v1/admin/bookings/:id/resolve-late-arrival`, `PATCH /api/v1/admin/bookings/:id/assign-wash-bay`, `PATCH /api/v1/admin/bookings/:id/start-service`, `PATCH /api/v1/admin/bookings/:id/complete-service`, `PATCH /api/v1/admin/bookings/:id/mark-paid` |
| Booking service steps | STAFF | `GET /api/v1/admin/bookings/:id/service-steps`, `PATCH /api/v1/admin/bookings/:id/service-steps/:stepId/done` |
| Booking service steps | ADMIN | `GET /api/v1/admin/bookings/:id/service-steps`, `PATCH /api/v1/admin/bookings/:id/service-steps/:stepId/done` |
| Admin-only booking operation | ADMIN | `PATCH /api/v1/admin/bookings/:id/reopen-service` |
| Booking inspections | STAFF | `POST /api/v1/admin/bookings/:id/inspections`, `GET /api/v1/admin/bookings/:id/inspections` |
| Booking inspections | ADMIN | `POST /api/v1/admin/bookings/:id/inspections`, `GET /api/v1/admin/bookings/:id/inspections` |

### Waitlists

| Chuc nang | Role | APIs |
| --- | --- | --- |
| My waitlists | CUSTOMER | `GET /api/v1/waitlists`, `POST /api/v1/waitlists`, `GET /api/v1/waitlists/:id`, `PATCH /api/v1/waitlists/:id/cancel`, `PATCH /api/v1/waitlists/:id/accept` |
| Waitlist operations | STAFF | `GET /api/v1/admin/waitlists`, `PATCH /api/v1/admin/waitlists/:id/offer`, `PATCH /api/v1/admin/waitlists/:id/expire`, `PATCH /api/v1/admin/waitlists/:id/cancel` |
| Waitlist operations | ADMIN | `GET /api/v1/admin/waitlists`, `PATCH /api/v1/admin/waitlists/:id/offer`, `PATCH /api/v1/admin/waitlists/:id/expire`, `PATCH /api/v1/admin/waitlists/:id/cancel` |

### Promotions

| Chuc nang | Role | APIs |
| --- | --- | --- |
| Public promotion browsing | Public | `GET /api/v1/promotions`, `GET /api/v1/promotions/:id` |
| Validate promotion | CUSTOMER | `POST /api/v1/promotions/validate` |
| Promotion management | ADMIN | `GET /api/v1/admin/promotions`, `POST /api/v1/admin/promotions`, `GET /api/v1/admin/promotions/:id`, `PATCH /api/v1/admin/promotions/:id`, `PATCH /api/v1/admin/promotions/:id/activate`, `PATCH /api/v1/admin/promotions/:id/deactivate`, `DELETE /api/v1/admin/promotions/:id` |

### Loyalty

| Chuc nang | Role | APIs |
| --- | --- | --- |
| My loyalty | CUSTOMER | `GET /api/v1/loyalty/me`, `GET /api/v1/loyalty/me/transactions`, `POST /api/v1/loyalty/redeem-preview`, `GET /api/v1/loyalty/tier-rules` |
| Loyalty expiry | ADMIN | `GET /api/v1/admin/loyalty/expiring-points`, `POST /api/v1/admin/loyalty/expire-points` |
| Customer loyalty management | ADMIN | `GET /api/v1/admin/loyalty/customers`, `GET /api/v1/admin/loyalty/customers/:customerId`, `GET /api/v1/admin/loyalty/customers/:customerId/transactions`, `GET /api/v1/admin/loyalty/transactions` |
| Tier rule management | ADMIN | `GET /api/v1/admin/loyalty/tier-rules`, `POST /api/v1/admin/loyalty/tier-rules`, `GET /api/v1/admin/loyalty/tier-rules/:tierRuleId`, `PATCH /api/v1/admin/loyalty/tier-rules/:tierRuleId`, `PATCH /api/v1/admin/loyalty/tier-rules/:tierRuleId/activate`, `PATCH /api/v1/admin/loyalty/tier-rules/:tierRuleId/deactivate`, `DELETE /api/v1/admin/loyalty/tier-rules/:tierRuleId` |

### Notifications

| Chuc nang | Role | APIs |
| --- | --- | --- |
| My notifications | CUSTOMER, STAFF, ADMIN | `GET /api/v1/notifications`, `GET /api/v1/notifications/unread-count`, `PATCH /api/v1/notifications/mark-all-read`, `PATCH /api/v1/notifications/:id/read`, `DELETE /api/v1/notifications`, `DELETE /api/v1/notifications/:id` |

### Vehicle handover and customer cases

| Chuc nang | Role | APIs |
| --- | --- | --- |
| Review handover and report issue | CUSTOMER | `GET /api/v1/bookings/:id/handover`, `POST /api/v1/bookings/:id/handover/accept`, `POST /api/v1/bookings/:id/handover/report` |
| My customer cases | CUSTOMER | `GET /api/v1/customer-cases`, `GET /api/v1/customer-cases/:id`, `POST /api/v1/customer-cases/:id/evidence`, `POST /api/v1/customer-cases/:id/messages`, `PATCH /api/v1/customer-cases/:id/resolution-response`, `POST /api/v1/customer-cases/:id/reopen` |
| Handover operations | CUSTOMER_SERVICE_STAFF, ADMIN | `GET /api/v1/staff/bookings/:id/handover`, `PATCH /api/v1/staff/bookings/:id/handover/ready`, `PATCH /api/v1/staff/bookings/:id/handover/release` |
| Customer case handling | CUSTOMER_SERVICE_STAFF, ADMIN | `GET /api/v1/staff/customer-cases`, `GET /api/v1/staff/customer-cases/:id`, `PATCH /api/v1/staff/customer-cases/:id/assign`, `PATCH /api/v1/staff/customer-cases/:id/acknowledge`, `POST /api/v1/staff/customer-cases/:id/evidence`, `POST /api/v1/staff/customer-cases/:id/messages` |
| Walk-in case + SLA | CUSTOMER_SERVICE_STAFF, ADMIN | `GET /api/v1/staff/customer-cases/sla-dashboard`, `POST /api/v1/staff/customer-cases/walk-in/otp/request`, `POST /api/v1/staff/customer-cases/walk-in/otp/verify`, `POST /api/v1/staff/customer-cases/walk-in`, `PATCH /api/v1/staff/customer-cases/:id/walk-in-resolution-response` |
| Technical case assessment | VEHICLE_INSPECTION_STAFF (assigned), ADMIN | `GET /api/v1/staff/customer-cases/:id/technical-assessment`, `PATCH /api/v1/staff/customer-cases/:id/technical-assessment/start`, `POST /api/v1/staff/customer-cases/:id/technical-assessment/submit` |
| Assign technical assessment | CUSTOMER_SERVICE_STAFF, ADMIN | `PATCH /api/v1/staff/customer-cases/:id/technical-assessment/assign` |
| Resolution, refund, rework and conclusion | ADMIN | `POST /api/v1/admin/customer-cases/:id/resolutions`, `POST /api/v1/admin/customer-cases/:id/resolutions/:resolutionId/apply`, `PATCH /api/v1/admin/customer-cases/:id/refunds/:refundId`, `POST /api/v1/admin/customer-cases/:id/reopen`, `PATCH /api/v1/admin/customer-cases/:id/conclude`, `PATCH /api/v1/admin/customer-cases/:id/close` |

### License plate arrival and check-in

| Chuc nang | Role | APIs |
| --- | --- | --- |
| Scan, candidate, retry, confirm and fallback | CUSTOMER_SERVICE_STAFF, ADMIN | `GET/POST /api/v1/staff/booking-arrivals/plate-scans`, `GET /api/v1/staff/booking-arrivals/plate-scans/:scanId`, `POST .../:scanId/retry`, `POST .../:scanId/confirm`, `POST .../:scanId/reject` |
| Arrival queue | CUSTOMER_SERVICE_STAFF, ADMIN | `GET /api/v1/staff/booking-arrivals/arrival-queue` |
| Alternate vehicle request | CUSTOMER_SERVICE_STAFF, ADMIN | `POST /api/v1/staff/booking-arrivals/plate-scans/:scanId/alternate-vehicle` |
| Metrics, alternate approval and devices | ADMIN | `GET /api/v1/admin/booking-arrivals/plate-scans`, `GET /api/v1/admin/booking-arrivals/metrics`, `PATCH /api/v1/admin/booking-arrivals/plate-scans/:scanId/alternate-vehicle`, `/api/v1/admin/booking-arrivals/camera-devices...` |
| Heartbeat, frame upload and offline event batch | Registered camera | `POST /api/v1/camera-devices/heartbeat`, `POST /api/v1/camera-devices/uploads`, `POST /api/v1/camera-devices/events/batch` |

### Wash histories

| Chuc nang | Role | APIs |
| --- | --- | --- |
| My wash histories | CUSTOMER | `GET /api/v1/wash-histories`, `GET /api/v1/wash-histories/:id`, `POST /api/v1/wash-histories/claim` |
| Wash history operations | STAFF | `GET /api/v1/admin/wash-histories`, `GET /api/v1/admin/wash-histories/:id` |
| Wash history operations | ADMIN | `GET /api/v1/admin/wash-histories`, `GET /api/v1/admin/wash-histories/:id` |

### Payments

| Chuc nang | Role | APIs |
| --- | --- | --- |
| PayOS webhook | Public | `POST /api/v1/payments/payos/webhook` |
| My PayOS payment | CUSTOMER | `POST /api/v1/payments/bookings/:bookingId/payos`, `GET /api/v1/payments/bookings/:bookingId/payos` |
| PayOS payment operations | STAFF | `POST /api/v1/admin/payments/bookings/:bookingId/payos`, `GET /api/v1/admin/payments/bookings/:bookingId/payos`, `GET /api/v1/admin/payments/:paymentId`, `PATCH /api/v1/admin/payments/:paymentId/cancel`, `PATCH /api/v1/admin/payments/:paymentId/expire` |
| PayOS payment operations | ADMIN | `POST /api/v1/admin/payments/bookings/:bookingId/payos`, `GET /api/v1/admin/payments/bookings/:bookingId/payos`, `GET /api/v1/admin/payments/:paymentId`, `PATCH /api/v1/admin/payments/:paymentId/cancel`, `PATCH /api/v1/admin/payments/:paymentId/expire` |

### Uploads

| Chuc nang | Role | APIs |
| --- | --- | --- |
| Owned upload operations | Authenticated | `POST /api/v1/uploads`, `DELETE /api/v1/uploads/:id` |
| Upload management | ADMIN | `GET /api/v1/admin/uploads` |

### Surveys

| Chuc nang | Role | APIs |
| --- | --- | --- |
| Customer surveys | CUSTOMER | `GET /api/v1/surveys/available`, `POST /api/v1/surveys/:id/responses` |
| Survey management | ADMIN | `GET /api/v1/admin/surveys`, `POST /api/v1/admin/surveys`, `GET /api/v1/admin/surveys/:id`, `PATCH /api/v1/admin/surveys/:id`, `PATCH /api/v1/admin/surveys/:id/publish`, `PATCH /api/v1/admin/surveys/:id/close`, `DELETE /api/v1/admin/surveys/:id` |
| Survey responses | ADMIN | `GET /api/v1/admin/surveys/:id/responses` |

### Analytics, research, and audit

| Chuc nang | Role | APIs |
| --- | --- | --- |
| Analytics | ADMIN | `GET /api/v1/admin/analytics/overview`, `GET /api/v1/admin/analytics/bookings`, `GET /api/v1/admin/analytics/revenue`, `GET /api/v1/admin/analytics/garages`, `GET /api/v1/admin/analytics/services`, `GET /api/v1/admin/analytics/promotions`, `GET /api/v1/admin/analytics/wash-bays`, `GET /api/v1/admin/analytics/payments`, `GET /api/v1/admin/analytics/surveys/:surveyId` |
| Research reports | ADMIN | `GET /api/v1/admin/research`, `POST /api/v1/admin/research`, `GET /api/v1/admin/research/:id`, `PATCH /api/v1/admin/research/:id`, `DELETE /api/v1/admin/research/:id`, `POST /api/v1/admin/research/:id/run`, `POST /api/v1/admin/research/:id/retry` |
| Audit logs | ADMIN | `GET /api/v1/admin/audit-logs` |
