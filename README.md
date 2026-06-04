

```txt
backend/
├─ src/
│  ├─ app.js
│  ├─ server.js
│
│  ├─ config/
│  │  ├─ env.js
│  │  ├─ db.js
│  │  ├─ cloudinary.js
│  │  ├─ mail.js
│  │  └─ swagger.js
│
│  ├─ shared/
│  │  ├─ constants/
│  │  │  ├─ roles.constant.js
│  │  │  ├─ staffType.constant.js
│  │  │  ├─ bookingStatus.constant.js
│  │  │  ├─ paymentMethod.constant.js
│  │  │  ├─ paymentStatus.constant.js
│  │  │  ├─ loyaltyTier.constant.js
│  │  │  ├─ vehicleType.constant.js
│  │  │  ├─ vehicleEngineType.constant.js
│  │  │  ├─ motorbikeCcGroup.constant.js
│  │  │  ├─ carBodyType.constant.js
│  │  │  ├─ inspectionType.constant.js
│  │  │  ├─ serviceType.constant.js
│  │  │  ├─ bookingServiceStepStatus.constant.js
│  │  │  ├─ bookingServiceStepType.constant.js
│  │  │  ├─ washBayStatus.constant.js
│  │  │  ├─ washBayUsageStatus.constant.js
│  │  │  ├─ washBayReleaseReason.constant.js
│  │  │  ├─ pointTransactionType.constant.js
│  │  │  ├─ promotionType.constant.js
│  │  │  ├─ notificationEventType.constant.js
│  │  │  ├─ notificationChannel.constant.js
│  │  │  ├─ notificationStatus.constant.js
│  │  │  ├─ emailStatus.constant.js
│  │  │  ├─ waitlistStatus.constant.js
│  │  │  ├─ auditAction.constant.js
│  │  │  └─ behaviorEventType.constant.js
│  │  │
│  │  ├─ middlewares/
│  │  │  ├─ auth.middleware.js
│  │  │  ├─ role.middleware.js
│  │  │  ├─ garageScope.middleware.js
│  │  │  ├─ validate.middleware.js
│  │  │  ├─ upload.middleware.js
│  │  │  ├─ rateLimit.middleware.js
│  │  │  ├─ error.middleware.js
│  │  │  └─ notFound.middleware.js
│  │  │
│  │  ├─ utils/
│  │  │  ├─ asyncHandler.js
│  │  │  ├─ apiResponse.js
│  │  │  ├─ appError.js
│  │  │  ├─ jwt.js
│  │  │  ├─ password.js
│  │  │  ├─ pagination.js
│  │  │  ├─ dateTime.js
│  │  │  ├─ normalizePhone.js
│  │  │  ├─ normalizeLicensePlate.js
│  │  │  ├─ price.js
│  │  │  ├─ csv.js
│  │  │  └─ crypto.js
│  │  │
│  │  └─ validators/
│  │     ├─ objectId.validator.js
│  │     ├─ pagination.validator.js
│  │     └─ common.validator.js
│
│  ├─ modules/
│  │  ├─ auth/
│  │  │  ├─ models/
│  │  │  │  ├─ refreshToken.model.js
│  │  │  │  ├─ passwordResetToken.model.js
│  │  │  │  └─ passwordResetRateLimit.model.js
│  │  │  │
│  │  │  ├─ security/
│  │  │  │  ├─ token.hash.js
│  │  │  │  └─ token.security.js
│  │  │  │
│  │  │  ├─ services/
│  │  │  │  ├─ auth.core.service.js
│  │  │  │  ├─ auth.session.service.js
│  │  │  │  └─ token.service.js
│  │  │  │
│  │  │  ├─ auth.routes.js
│  │  │  ├─ auth.controller.js
│  │  │  ├─ auth.service.js
│  │  │  ├─ auth.validator.js
│  │  │  ├─ auth.mapper.js
│  │  │  ├─ auth.swagger.js
│  │  │  └─ auth.test.js
│  │  │
│  │  ├─ users/
│  │  │  ├─ user.routes.js
│  │  │  ├─ user.controller.js
│  │  │  ├─ user.service.js
│  │  │  ├─ user.model.js
│  │  │  ├─ user.validator.js
│  │  │  ├─ user.mapper.js
│  │  │  ├─ user.swagger.js
│  │  │  └─ user.test.js
│  │  │
│  │  ├─ staff-profiles/
│  │  │  ├─ staffProfile.routes.js
│  │  │  ├─ staffProfile.controller.js
│  │  │  ├─ staffProfile.service.js
│  │  │  ├─ staffProfile.model.js
│  │  │  ├─ staffProfile.validator.js
│  │  │  ├─ staffProfile.mapper.js
│  │  │  ├─ staffProfile.swagger.js
│  │  │  └─ staffProfile.test.js
│  │  │
│  │  ├─ garages/
│  │  │  ├─ garage.routes.js
│  │  │  ├─ garage.controller.js
│  │  │  ├─ garage.service.js
│  │  │  ├─ garage.model.js
│  │  │  ├─ garage.validator.js
│  │  │  ├─ garage.mapper.js
│  │  │  ├─ garage.swagger.js
│  │  │  └─ garage.test.js
│  │  │
│  │  ├─ wash-bays/
│  │  │  ├─ washBay.routes.js
│  │  │  ├─ washBay.controller.js
│  │  │  ├─ washBay.service.js
│  │  │  ├─ washBay.model.js
│  │  │  ├─ washBayUsageLog.model.js
│  │  │  ├─ washBay.validator.js
│  │  │  ├─ washBay.mapper.js
│  │  │  ├─ washBay.swagger.js
│  │  │  └─ washBay.test.js
│  │  │
│  │  ├─ vehicles/
│  │  │  ├─ vehicle.routes.js
│  │  │  ├─ vehicle.controller.js
│  │  │  ├─ vehicle.service.js
│  │  │  ├─ vehicle.model.js
│  │  │  ├─ vehicle.validator.js
│  │  │  ├─ vehicle.mapper.js
│  │  │  ├─ vehicle.swagger.js
│  │  │  └─ vehicle.test.js
│  │  │
│  │  ├─ service-packages/
│  │  │  ├─ servicePackage.routes.js
│  │  │  ├─ servicePackage.controller.js
│  │  │  ├─ servicePackage.service.js
│  │  │  ├─ servicePackage.model.js
│  │  │  ├─ servicePackage.validator.js
│  │  │  ├─ servicePackage.mapper.js
│  │  │  ├─ servicePackage.swagger.js
│  │  │  └─ servicePackage.test.js
│  │  │
│  │  ├─ bookings/
│  │  │  ├─ booking.routes.js
│  │  │  ├─ booking.controller.js
│  │  │  ├─ booking.service.js
│  │  │  ├─ booking.model.js
│  │  │  ├─ booking.validator.js
│  │  │  ├─ booking.mapper.js
│  │  │  ├─ booking.swagger.js
│  │  │  └─ booking.test.js
│  │  │
│  │  ├─ booking-service-steps/
│  │  │  ├─ bookingServiceStep.routes.js
│  │  │  ├─ bookingServiceStep.controller.js
│  │  │  ├─ bookingServiceStep.service.js
│  │  │  ├─ bookingServiceStep.model.js
│  │  │  ├─ bookingServiceStep.validator.js
│  │  │  ├─ bookingServiceStep.mapper.js
│  │  │  ├─ bookingServiceStep.swagger.js
│  │  │  └─ bookingServiceStep.test.js
│  │  │
│  │  ├─ booking-waitlists/
│  │  │  ├─ bookingWaitlist.routes.js
│  │  │  ├─ bookingWaitlist.controller.js
│  │  │  ├─ bookingWaitlist.service.js
│  │  │  ├─ bookingWaitlist.model.js
│  │  │  ├─ bookingWaitlist.validator.js
│  │  │  ├─ bookingWaitlist.mapper.js
│  │  │  ├─ bookingWaitlist.swagger.js
│  │  │  └─ bookingWaitlist.test.js
│  │  │
│  │  ├─ vehicle-inspections/
│  │  │  ├─ vehicleInspection.routes.js
│  │  │  ├─ vehicleInspection.controller.js
│  │  │  ├─ vehicleInspection.service.js
│  │  │  ├─ vehicleInspection.model.js
│  │  │  ├─ vehicleInspection.validator.js
│  │  │  ├─ vehicleInspection.mapper.js
│  │  │  ├─ vehicleInspection.swagger.js
│  │  │  └─ vehicleInspection.test.js
│  │  │
│  │  ├─ loyalty/
│  │  │  ├─ loyalty.routes.js
│  │  │  ├─ loyalty.controller.js
│  │  │  ├─ loyalty.service.js
│  │  │  ├─ customerLoyalty.model.js
│  │  │  ├─ pointTransaction.model.js
│  │  │  ├─ tierRule.model.js
│  │  │  ├─ tierHistory.model.js
│  │  │  ├─ loyaltyRedeemRule.model.js
│  │  │  ├─ loyalty.validator.js
│  │  │  ├─ loyalty.mapper.js
│  │  │  ├─ loyalty.swagger.js
│  │  │  └─ loyalty.test.js
│  │  │
│  │  ├─ promotions/
│  │  │  ├─ promotion.routes.js
│  │  │  ├─ promotion.controller.js
│  │  │  ├─ promotion.service.js
│  │  │  ├─ promotion.model.js
│  │  │  ├─ promotionUsage.model.js
│  │  │  ├─ promotion.validator.js
│  │  │  ├─ promotion.mapper.js
│  │  │  ├─ promotion.swagger.js
│  │  │  └─ promotion.test.js
│  │  │
│  │  ├─ wash-histories/
│  │  │  ├─ washHistory.routes.js
│  │  │  ├─ washHistory.controller.js
│  │  │  ├─ washHistory.service.js
│  │  │  ├─ washHistory.model.js
│  │  │  ├─ washHistory.validator.js
│  │  │  ├─ washHistory.mapper.js
│  │  │  ├─ washHistory.swagger.js
│  │  │  └─ washHistory.test.js
│  │  │
│  │  ├─ notifications/
│  │  │  ├─ notification.routes.js
│  │  │  ├─ notification.controller.js
│  │  │  ├─ notification.service.js
│  │  │  ├─ notification.model.js
│  │  │  ├─ notification.validator.js
│  │  │  ├─ notification.mapper.js
│  │  │  ├─ notification.swagger.js
│  │  │  └─ notification.test.js
│  │  │
│  │  ├─ email/
│  │  │  ├─ email.service.js
│  │  │  ├─ emailTemplate.service.js
│  │  │  ├─ emailDeliveryLog.model.js
│  │  │  └─ templates/
│  │  │     ├─ bookingConfirmed.template.js
│  │  │     ├─ bookingReminder.template.js
│  │  │     └─ waitlistOffered.template.js
│  │  │
│  │  ├─ surveys/
│  │  │  ├─ survey.routes.js
│  │  │  ├─ survey.controller.js
│  │  │  ├─ survey.service.js
│  │  │  ├─ surveyResponse.model.js
│  │  │  ├─ survey.validator.js
│  │  │  ├─ survey.mapper.js
│  │  │  ├─ survey.swagger.js
│  │  │  └─ survey.test.js
│  │  │
│  │  ├─ analytics/
│  │  │  ├─ analytics.routes.js
│  │  │  ├─ analytics.controller.js
│  │  │  ├─ analytics.service.js
│  │  │  ├─ analytics.validator.js
│  │  │  ├─ analytics.mapper.js
│  │  │  ├─ analytics.swagger.js
│  │  │  └─ analytics.test.js
│  │  │
│  │  ├─ research/
│  │  │  ├─ research.routes.js
│  │  │  ├─ research.controller.js
│  │  │  ├─ research.service.js
│  │  │  ├─ behaviorLog.model.js
│  │  │  ├─ research.validator.js
│  │  │  ├─ research.mapper.js
│  │  │  ├─ research.swagger.js
│  │  │  └─ research.test.js
│  │  │
│  │  ├─ uploads/
│  │  │  ├─ upload.routes.js
│  │  │  ├─ upload.controller.js
│  │  │  ├─ upload.service.js
│  │  │  ├─ upload.validator.js
│  │  │  ├─ upload.mapper.js
│  │  │  ├─ upload.swagger.js
│  │  │  └─ upload.test.js
│  │  │
│  │  └─ audit-logs/
│  │     ├─ auditLog.routes.js
│  │     ├─ auditLog.controller.js
│  │     ├─ auditLog.service.js
│  │     ├─ auditLog.model.js
│  │     ├─ auditLog.validator.js
│  │     ├─ auditLog.mapper.js
│  │     ├─ auditLog.swagger.js
│  │     └─ auditLog.test.js
│  │
│  ├─ routes/
│  │  └─ index.js
│  │
│  ├─ docs/
│  │  ├─ swagger/
│  │  │  ├─ index.js
│  │  │  ├─ components.js
│  │  │  └─ paths.js
│  │  └─ openapi.js
│  │
│  ├─ jobs/
│  │  ├─ tierReview.job.js
│  │  ├─ pointExpiry.job.js
│  │  ├─ bookingReminder.job.js
│  │  ├─ bookingWaitlist.job.js
│  │  ├─ waitlistOfferExpiry.job.js
│  │  ├─ noShowBooking.job.js
│  │  └─ emailRetry.job.js
│  │
│  ├─ scripts/
│  │  ├─ seedUsers.js
│  │  ├─ seedStaffProfiles.js
│  │  ├─ seedGarages.js
│  │  ├─ seedWashBays.js
│  │  ├─ seedServicePackages.js
│  │  ├─ seedTierRules.js
│  │  ├─ seedLoyaltyRedeemRules.js
│  │  ├─ seedPromotions.js
│  │  ├─ seedSyntheticBookings.js
│  │  ├─ seedSyntheticBehaviorLogs.js
│  │  └─ seedAll.js
│  │
│  └─ tests/
│     ├─ setup.js
│     ├─ helpers/
│     │  ├─ auth.helper.js
│     │  ├─ user.helper.js
│     │  ├─ staff.helper.js
│     │  ├─ garage.helper.js
│     │  ├─ washBay.helper.js
│     │  ├─ vehicle.helper.js
│     │  ├─ servicePackage.helper.js
│     │  ├─ booking.helper.js
│     │  └─ loyalty.helper.js
│     │
│     └─ flows/
│        ├─ customer-booking.flow.test.js
│        ├─ walk-in-booking.flow.test.js
│        ├─ booking-service-execution.flow.test.js
│        ├─ booking-loyalty.flow.test.js
│        ├─ promotion-booking.flow.test.js
│        ├─ wash-bay-assignment.flow.test.js
│        └─ waitlist.flow.test.js
│
├─ .env
├─ .env.example
├─ .gitignore
├─ package.json
├─ jest.config.js
└─ README.md


module:
___.routes.js — Định nghĩa endpoint
___.controller.js — Nhận req/res, gọi service
___.service.js — Chứa logic nghiệp vụ
___.model.js — Mongoose schema
___.validator.js — Zod schema
___.swagger.js — Tài liệu API 
___.test.js — Test riêng module promotion 

Smart Automated Car Wash Management System with Advance Booking & Loyalty Program

Autowash Pro
1. Tổng quan hệ thống
Hệ thống quản lý rửa xe tự động thông minh (Web, mobile app) hỗ trợ khách hàng đặt lịch trước, quản lý phương tiện, sử dụng dịch vụ rửa xe, tích điểm khách hàng thân thiết, áp dụng khuyến mãi và theo dõi lịch sử sử dụng dịch vụ.
Trọng tâm của hệ thống là:
Quản lý đặt lịch rửa xe theo garage.
Quản lý buồng rửa xe theo loại phương tiện.
Quản lý dịch vụ rửa xe, dịch vụ lẻ và gói combo theo hướng data-driven.
Quản lý tiến độ dịch vụ bằng BookingServiceStep.
Tích điểm, nâng hạng thành viên và áp dụng promotion.
Ghi nhận lịch sử rửa xe và dữ liệu phục vụ thống kê / nghiên cứu.
Hệ thống không tích hợp cổng thanh toán online. Thanh toán được ghi nhận thủ công tại garage bởi Staff hoặc Admin.
Trong phạm vi prototype, hệ thống chưa triển khai nhận diện biển số bằng AI/LPR production. Biển số xe được nhập thủ công và được backend chuẩn hóa, validate, kiểm tra trùng. AI/LPR được định hướng là chức năng mở rộng trong tương lai.
2. Actor chính
Guest vẫn có thể book được lịch: khi nhập đầy đủ thông tin về: họ và tên, số điện thoại, email, 
Đăng ký tài khoản bằng số điện thoại, 
Customer
Customer là khách hàng có tài khoản trên hệ thống. Customer có thể:
Đăng ký / đăng nhập.
Quản lý thông tin cá nhân.
Thêm và quản lý xe.
Chọn garage.
Chọn gói dịch vụ.
Đặt lịch rửa xe.
Áp dụng promotion hoặc dùng điểm nếu có.
Theo dõi trạng thái booking.
Xem lịch sử rửa xe.
Xem điểm loyalty và hạng thành viên.
Staff
Staff là nhân viên vận hành tại garage. Staff vẫn giữ role chung là STAFF, nhưng được phân loại bằng staff_type.
Staff có thể:
Xem booking thuộc garage của mình.
Tạo walk-in booking cho khách vãng lai.
Check-in xe.
Tạo VehicleInspection.
Assign WashBay.
Start service.
Xác nhận BookingServiceStep hoàn tất.
Complete service.
Mark paid.
Staff không được:
Thao tác booking ngoài garage của mình.
Mark paid khi booking chưa COMPLETED.
Tự sửa trạng thái lùi tùy tiện.
Chỉnh điểm loyalty thủ công.
Xóa WashHistory.
Admin
Admin có quyền quản trị toàn hệ thống.
Admin có thể:
Quản lý user, staff, garage, service package.
Xem toàn bộ booking ở tất cả garage.
Can thiệp booking lỗi trạng thái.
Xác nhận payment.
Quản lý loyalty tier rule.
Quản lý promotion.
Xem audit log.
Xem dashboard / analytics.
3. StaffProfile
StaffProfile {
    user_id
    staff_code
    staff_type
    garage_id
    is_active
    created_at
    updated_at
}

staff_type gồm:
CUSTOMER_SERVICE_STAFF: Nhân viên chăm sóc khách hàng
VEHICLE_INSPECTION_STAFF: Nhân viên kiểm tra xe
WASH_OPERATOR: Nhân viên rửa xe
VEHICLE_CARE_STAFF: Nhân viên chăm sóc xe

Ý nghĩa:
CUSTOMER_SERVICE_STAFF: tiếp nhận khách, tạo walk-in booking, hỗ trợ check-in.
VEHICLE_INSPECTION_STAFF: kiểm tra xe trước / sau dịch vụ.
WASH_OPERATOR: điều khiển và quan sát buồng rửa tự động.
VEHICLE_CARE_STAFF: thực hiện các dịch vụ thủ công như thay dầu, hút bụi, tẩy ố kính, phủ ceramic, vệ sinh khoang máy.
4. WashBay
Một garage có thể có nhiều buồng rửa xe. Hệ thống chỉ giữ slot khi tạo booking, chưa gán buồng cụ thể. wash_bay_id chỉ được gán khi khách check-in hoặc khi bắt đầu dịch vụ.
WashBay chỉ phân theo 2 loại phương tiện:
MOTORBIKE
CAR

WashBay {
    garage_id
    name
    bay_code

    vehicle_type // MOTORBIKE, CAR

    status // AVAILABLE, OCCUPIED, MAINTENANCE, INACTIVE
    current_booking_id

    is_active
    created_at
    updated_at
}

Rule:
Customer đặt lịch theo garage
→ System kiểm tra số WashBay active phù hợp trong garage
→ Số booking giữ slot trong khung giờ đó không được vượt quá số WashBay active phù hợp
→ Booking được tạo với wash_bay_id = null

Customer đến garage
→ Staff check-in
→ Khi start service, nếu ServicePackage.requires_wash_bay = true
→ System tìm WashBay AVAILABLE theo garage_id + vehicle_type
→ Gán wash_bay_id cho booking
→ WashBay.status = OCCUPIED
→ WashBay.current_booking_id = booking_id

Hoàn tất dịch vụ
→ Booking.status = COMPLETED
→ WashBay.status = AVAILABLE
→ WashBay.current_booking_id = null

Nếu booking đã được gán wash_bay_id nhưng bị CANCELED / NO_SHOW / lỗi dừng dịch vụ
→ WashBay.status = AVAILABLE
→ WashBay.current_booking_id = null

5. Biển số xe
Hệ thống không làm AI nhận diện biển số trong scope chính. Biển số được nhập thủ công và backend chịu trách nhiệm chuẩn hóa, validate và kiểm tra trùng.
Một normalized_license_plate + vehicle_type chỉ được thuộc về một vehicle active.
Nếu customer khác nhập trùng biển số đã tồn tại, hệ thống báo lỗi:
Biển số xe này đã được đăng ký trong hệ thống.

Staff/Admin có thể hỗ trợ xử lý nếu khách nhập sai, xe đổi chủ hoặc cần vô hiệu hóa dữ liệu cũ.
Quy tắc chuẩn hóa:
- Viết hoa toàn bộ chữ cái.
- Loại bỏ dấu chấm, dấu gạch ngang, khoảng trắng và ký tự đặc biệt.
- Ví dụ: 51G-123.45, 51g 12345, 51G123.45 đều được chuẩn hóa thành 51G12345.

Field nên có trong Vehicle:
Vehicle {
    customer_id
    raw_license_plate
    normalized_license_plate
    vehicle_type // MOTORBIKE, CAR

    engine_type // GASOLINE, ELECTRIC
    motorbike_cc_group // UNDER_175CC, OVER_175CC
    car_body_type // HATCHBACK, SEDAN, SUV, MPV, PICKUP, VAN
    seat_count

    brand
    model
    color

    is_default
    is_active
    created_at
    updated_at
}

Unique index:
VehicleSchema.index(
    {
        normalized_license_plate: 1,
        vehicle_type: 1,
    },
    {
        unique: true,
        partialFilterExpression: {
            is_active: true,
        },
    }
);

6. Booking rules
Các booking giữ slot gồm:
PENDING
CONFIRMED
CHECKED_IN
IN_PROGRESS

Các booking không còn giữ slot:
COMPLETED
CANCELED
NO_SHOW

Rule chính:
Mỗi customer được giữ tối đa:
- BRONZE: 1 booking sắp tới
- SILVER: 1 booking sắp tới
- GOLD: 2 booking sắp tới
- PLATINUM: 3 booking sắp tới

Mỗi vehicle không được có nhiều booking bị overlap thời gian.

Không cho tạo booking mới nếu vehicle đó đã có booking overlap trong các trạng thái:
PENDING, CONFIRMED, CHECKED_IN, IN_PROGRESS.

Hệ thống kiểm tra overlap theo:
- cùng garage để tránh vượt sức chứa WashBay
- cùng vehicle để tránh một xe có nhiều lịch trùng nhau
- cùng customer để đảm bảo không vượt giới hạn booking sắp tới theo tier

7. Loyalty tier
Tier gồm:
BRONZE
SILVER
GOLD
PLATINUM

Tier được nâng/hạ dựa trên tổng chi tiêu, tổng lượt sử dụng dịch vụ hoặc điểm tích lũy trong kỳ đánh giá.
Chỉ các booking đã COMPLETED và PAID mới được tính vào điều kiện nâng/hạ hạng.
BRONZE / Thành viên thường:
- Được đặt lịch trước 7 ngày
- Được giữ tối đa 1 booking sắp tới
- Hệ số điểm x1
- Priority level 1

SILVER / Bạc:
- Được đặt lịch trước 10 ngày
- Được giữ tối đa 1 booking sắp tới
- Hệ số điểm x1.2
- Priority level 2

GOLD / Vàng:
- Được đặt lịch trước 12 ngày
- Được giữ tối đa 2 booking sắp tới
- Hệ số điểm x1.35
- Priority level 3

PLATINUM / Bạch Kim:
- Được đặt lịch trước 14 ngày
- Được giữ tối đa 3 booking sắp tới
- Hệ số điểm x1.5
- Priority level 4 
8. BookingWaitlist
Nếu slot rửa xe tại một garage đã đầy, customer có thể đăng ký vào waitlist. BookingWaitlist chỉ áp dụng cho các ServicePackage có sử dụng quy trình rửa xe hoặc có requires_wash_bay = true.
Hệ thống không kiểm tra waitlist cho các dịch vụ không sử dụng WashBay, ví dụ vệ sinh khoang máy ô tô, phủ ceramic, tẩy ố kính hoặc các dịch vụ chăm sóc xe thủ công riêng lẻ.
BookingWaitlist {
    _id

    garage_id
    customer_id
    vehicle_id
    service_package_id

    desired_start_time
    desired_end_time

    desired_wash_bay_start_time
    desired_wash_bay_end_time

    vehicle_type
    priority_level
    customer_tier

    status // WAITING, OFFERED, ACCEPTED, EXPIRED, CANCELED

    offered_booking_id
    offered_at
    offer_expires_at
    accepted_at
    canceled_at
    expired_at

    note

    created_at
    updated_at
}

Flow
Customer chọn garage, vehicle, service package và thời gian mong muốn
→ Hệ thống kiểm tra ServicePackage.requires_wash_bay
→ Nếu requires_wash_bay = false, hệ thống không xử lý waitlist theo slot rửa xe
→ Nếu requires_wash_bay = true, hệ thống tính thời gian chiếm WashBay dựa trên wash_bay_duration_minutes
→ Hệ thống kiểm tra slot WashBay theo desired_wash_bay_start_time và desired_wash_bay_end_time
→ Nếu slot WashBay đã đầy, customer có thể đăng ký waitlist
→ Khi có slot trống do một booking bị CANCELED
→ Hệ thống tìm customer phù hợp nhất trong waitlist
→ Hệ thống chọn waitlist theo độ ưu tiên hạng thành viên và khả năng fit vào khoảng WashBay trống
→ Gửi notification mời customer nhận lịch
→ Customer xác nhận trong thời gian giới hạn
→ Hệ thống tạo booking chính thức
Rule kiểm tra slot đầy
Slot chỉ được xem là đầy khi thỏa các điều kiện:
ServicePackage.requires_wash_bay = true
và
wash_bay_start_time / wash_bay_end_time bị overlap với booking khác đang giữ slot
và
số booking overlap >= số WashBay active phù hợp trong garage

Các booking đang giữ slot gồm:
PENDING
CONFIRMED
CHECKED_IN
IN_PROGRESS

Các booking không giữ slot:
COMPLETED
CANCELED
NO_SHOW

Overlap WashBay được tính theo:
existing.wash_bay_start_time < new.wash_bay_end_time
và
existing.wash_bay_end_time > new.wash_bay_start_time

Không dùng toàn bộ start_time → end_time của booking để check slot WashBay, vì combo có thể kéo dài hơn thời gian thật sự chiếm WashBay.
Rule chọn waitlist khi có booking bị CANCELED
Khi một booking bị CANCELED, hệ thống kiểm tra khoảng WashBay vừa được giải phóng. Sau đó hệ thống tìm các BookingWaitlist phù hợp:
- Cùng garage_id
- Cùng vehicle_type
- ServicePackage.requires_wash_bay = true
- status = WAITING
- desired_wash_bay_start_time và desired_wash_bay_end_time fit được vào khoảng WashBay trống
- Không làm vượt capacity WashBay trong khoảng thời gian đó

Sau khi lọc được danh sách phù hợp, hệ thống sắp xếp theo:
priority_level DESC
created_at ASC

Nghĩa là hạng thành viên cao hơn được ưu tiên trước. Nếu cùng hạng, customer đăng ký waitlist sớm hơn được ưu tiên.
Ví dụ
Giả sử WashBay ô tô tại garage đã đầy lúc:
10:00 → 10:30

Booking ở khung này bị CANCELED, nên WashBay trống lại từ 10:00 đến 10:30.
Trong waitlist có:
Customer A:
- Tier: SILVER
- Dịch vụ: Rửa xe ô tô
- Tổng duration: 30 phút
- Desired service time: 10:00 → 10:30
- Desired WashBay time: 10:00 → 10:30

Customer B:
- Tier: PLATINUM
- Dịch vụ: Basic Clean
- Tổng duration: 60 phút
- Desired service time: 10:00 → 11:00
- Desired WashBay time: 10:00 → 10:30

Cả A và B đều fit vào khoảng WashBay trống 10:00 → 10:30. Vì B có tier PLATINUM cao hơn A, hệ thống offer slot cho B trước.
Khi B xác nhận, hệ thống tạo booking:
Booking Basic Clean:
- start_time = 10:00
- end_time = 11:00
- wash_bay_start_time = 10:00
- wash_bay_end_time = 10:30

Sau 10:30, WashBay được release để phục vụ booking khác. Các bước còn lại của Basic Clean tiếp tục được xử lý trong quy trình dịch vụ, nhưng không chiếm WashBay.
Status
WAITING:
Customer đang chờ slot.
OFFERED:
Hệ thống đã gửi lời mời vì có slot WashBay trống.
ACCEPTED:
Customer đã nhận slot và hệ thống đã tạo booking.
EXPIRED:
Customer không phản hồi offer đúng hạn.
CANCELED:
Customer tự hủy waitlist hoặc Admin/Staff hủy.
Mỗi garage có cấu hình:
garage {
opening_time: '07:00',
closing_time: '18:00',
slot_interval_minutes: 30
} 
9. ServicePackage
Tất cả dịch vụ lẻ, dịch vụ rửa chính và combo đều được quản lý bằng ServicePackage.
Không hard-code dịch vụ trong source code.
ServicePackage {
    name
    vehicle_type // MOTORBIKE, CAR
    service_type // WASH, ADDON, COMBO
    description

    base_price
    duration_minutes
    points_earned

    requires_wash_bay // true/false

    included_service_ids // optional, dùng cho COMBO
    steps_template

    is_active
    created_at
    updated_at
}

Ý nghĩa:
WASH:
- Dịch vụ rửa chính như rửa xe máy, rửa ô tô cơ bản, rửa ô tô cao cấp.

ADDON:
- Dịch vụ lẻ như thay dầu, hút bụi nội thất, tẩy ố kính, phủ ceramic, vệ sinh khoang máy.

COMBO:
- Gói combo gồm nhiều ServicePackage con.

Ví dụ combo:
Gói xe máy:
- Rửa xe + Thay dầu

Gói Basic Clean:
- Rửa xe cao cấp
- Tẩy ố mốc kính xe hơi
- Đánh bóng đèn pha ô tô
- Hút bụi & lau dọn nội thất

Gói Detail Clean:
- Basic Clean
- Đánh bóng kính ô tô và tạo hiệu ứng trượt nước
- Tẩy keo & nhựa đường
- Loại bỏ bụi sắt, kim loại trên xe

Gói Ultimate Clean:
- Detail Clean
- Vệ sinh khoang máy ô tô
- Vệ sinh dàn lạnh

Gói Super Clean:
- Ultimate Clean
- Khử trùng bề mặt nội thất bằng tia UVC
- Khử mùi, diệt khuẩn bằng Ozone

10. Booking
Booking hỗ trợ cả customer có tài khoản và khách vãng lai.
Booking {
    customer_id // nullable nếu khách vãng lai
    vehicle_id // nullable nếu khách vãng lai

    is_walk_in
    guest_name
    guest_phone
    license_plate
    normalized_license_plate
    created_by_staff_id

    garage_id
    wash_bay_id
    service_package_id

    booking_date

    start_time // thời gian bắt đầu toàn bộ dịch vụ
    end_time // thời gian kết thúc toàn bộ dịch vụ

    wash_bay_start_time // thời gian bắt đầu chiếm WashBay
    wash_bay_end_time // thời gian kết thúc chiếm WashBay 

    original_price
    discount_amount
    final_price

    payment_method // CASH
    payment_status // UNPAID, PAID

    used_points
    earned_points
    promotion_id

    requires_wash_bay
    status // PENDING, CONFIRMED, CHECKED_IN, IN_PROGRESS, COMPLETED, CANCELED, NO_SHOW

    checked_in_at
    started_at
    completed_at
    paid_at

    reward_processed
    reward_processed_at

    note
    created_at
    updated_at
}

Khách có tài khoản:
{
    is_walk_in: false,
    customer_id: customerId,
    vehicle_id: vehicleId,
    guest_name: null,
    guest_phone: null,
    created_by_staff_id: null
}

Khách vãng lai:
{
    is_walk_in: true,
    customer_id: null,
    vehicle_id: null,
    guest_name: 'Nguyễn Văn A',
    guest_phone: '090xxxxxxx',
    license_plate: '59A12345',
    normalized_license_plate: '59A12345',
    created_by_staff_id: staffId
}

11. BookingServiceStep
Khi booking bắt đầu dịch vụ, hệ thống tạo danh sách BookingServiceStep từ steps_template của ServicePackage.
Staff không cần tick từng thao tác nhỏ. Mỗi step là một quy trình lớn. Các thao tác chi tiết nằm trong instructions.
BookingServiceStep {
    booking_id
    service_package_id

    step_code
    step_name
    order

    step_type // AUTOMATED_WASH_STEP, MANUAL_SERVICE_STEP
    is_required

    display_staff_type
    assigned_staff_id
    confirmed_by_staff_id

    status // PENDING, IN_PROGRESS, DONE, SKIPPED

    instructions

    started_at
    completed_at
    note
}

Ví dụ combo Basic Clean có thể tạo các step lớn:
Step 1: Rửa xe ô tô cao cấp
Step 2: Tẩy ố mốc kính xe hơi
Step 3: Đánh bóng đèn pha ô tô
Step 4: Hút bụi & lau dọn nội thất

Mỗi step chứa instructions chi tiết. Ví dụ step “Rửa xe ô tô cao cấp” có instructions:
- Kiểm tra thông tin xe
- Kiểm tra xe trước dịch vụ
- Bảo vệ thiết bị nhạy cảm nếu có
- Bảo vệ xe điện nếu có
- Xịt nước làm mềm bụi bẩn
- Rửa gầm
- Phun bọt tuyết
- Rửa thân xe
- Vệ sinh kính ngoài
- Vệ sinh bánh xe chi tiết
- Xả nước
- Sấy khô + lau khô kỹ
- Kiểm tra lại cổng sạc nếu là xe điện

12. VehicleInspection
Dùng để lưu tình trạng xe trước và sau dịch vụ.
VehicleInspection {
    booking_id
    type // BEFORE_WASH, AFTER_WASH
    note
    images
    inspected_by
    inspected_at
    created_at
    updated_at
}

Flow:
Customer đến garage
→ Staff check-in
→ Staff kiểm tra xe trước dịch vụ
→ Tạo VehicleInspection BEFORE_WASH
→ Thực hiện dịch vụ
→ Nếu cần, Staff kiểm tra sau dịch vụ
→ Tạo VehicleInspection AFTER_WASH

13. Reward processing
Hệ thống chỉ tạo WashHistory và cộng điểm khi đủ cả 2 điều kiện:
booking.status = COMPLETED
booking.payment_status = PAID

Để chống Staff/Admin bấm mark-paid nhiều lần, cần có:
reward_processed: Boolean
reward_processed_at: Date

Và trong WashHistory cần unique index:
WashHistory {
    booking_id // unique
}

Rule:
Nếu booking chưa COMPLETED
→ Không cho mark-paid.

Nếu booking đã PAID hoặc reward_processed = true
→ Không xử lý cộng điểm lần nữa.

Nếu booking COMPLETED và payment_status = UNPAID
→ Staff/Admin mark-paid
→ payment_status = PAID
→ Tạo WashHistory
→ Tính earned_points
→ Cập nhật CustomerLoyalty
→ Tạo PointTransaction
→ Ghi nhận PromotionUsage nếu có promotion
→ reward_processed = true
→ reward_processed_at = now

14. Main Staff Flow
Customer đặt booking theo ServicePackage
→ Staff check-in xe
→ Booking status = CHECKED_IN
→ Staff kiểm tra xe trước dịch vụ
→ Tạo VehicleInspection BEFORE_WASH
→ Staff bảo vệ xe điện / thiết bị nhạy cảm nếu có
→ Staff bấm bắt đầu dịch vụ
→ Booking status = IN_PROGRESS
→ Nếu ServicePackage.requires_wash_bay = true, hệ thống gán WashBay phù hợp
→ Hệ thống tạo BookingServiceStep theo từng quy trình lớn của ServicePackage
→ Mỗi step lớn chứa instructions chi tiết
→ Staff thực hiện / quan sát / xác nhận từng step lớn
→ Customer có thể theo dõi tiến độ
→ Staff hoàn tất dịch vụ
→ Booking status = COMPLETED
→ Staff/Admin xác nhận thanh toán
→ payment_status = PAID
→ Nếu COMPLETED + PAID
→ Tạo WashHistory
→ Cộng điểm
→ Cập nhật CustomerLoyalty
→ Tạo PointTransaction

15. Main Customer Booking Flow
Customer đăng nhập
→ Customer chọn garage
→ Customer chọn xe hoặc tạo xe mới
→ Customer chọn ServicePackage
→ Customer chọn ngày/giờ
→ Customer áp dụng promotion / dùng điểm nếu có
→ Hệ thống lấy CustomerLoyalty.current_tier
→ Hệ thống lấy TierRule tương ứng
→ Hệ thống kiểm tra booking_window_days theo tier: 
- BRONZE / Thành viên thường: 7 ngày
- SILVER / Bạc: 10 ngày
- GOLD / Vàng: 12 ngày
- PLATINUM / Bạch Kim: 14 ngày
→ Hệ thống kiểm tra slot trống
→ Hệ thống kiểm tra số booking sắp tới tối đa theo tier 
→ Customer xác nhận đặt lịch
→ Booking status = CONFIRMED hoặc PENDING
→ payment_status = UNPAID
→ Customer nhận thông báo đặt lịch thành công
	- Qua thông báo web
	-  Qua email nếu customer đăng ký email
→ Customer đến garage đúng giờ
→ Staff check-in xe
→ Customer theo dõi trạng thái booking
→ Customer nhận xe sau khi Staff hoàn tất dịch vụ
→ Customer thanh toán trực tiếp tại garage
→ Sau khi Staff/Admin xác nhận PAID
→ Customer nhận WashHistory + điểm thưởng
→ Customer xem lịch sử rửa xe và điểm loyalty



16. API chính
Auth
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/users/me
PATCH /api/v1/users/me

Vehicles
GET    /api/v1/vehicles
POST   /api/v1/vehicles
PATCH  /api/v1/vehicles/:id
DELETE /api/v1/vehicles/:id

Garages
GET    /api/v1/garages
POST   /api/v1/admin/garages
PATCH  /api/v1/admin/garages/:id
DELETE /api/v1/admin/garages/:id

WashBays
GET    /api/v1/admin/wash-bays
POST   /api/v1/admin/wash-bays
PATCH  /api/v1/admin/wash-bays/:id
DELETE /api/v1/admin/wash-bays/:id
GET    /api/v1/admin/garages/:garageId/wash-bays
GET    /api/v1/admin/garages/:garageId/available-wash-bays

Service Packages
GET    /api/v1/service-packages
GET    /api/v1/service-packages/:id
GET    /api/v1/service-packages?vehicle_type=MOTORBIKE
GET    /api/v1/service-packages?vehicle_type=CAR

POST   /api/v1/admin/service-packages
PATCH  /api/v1/admin/service-packages/:id
DELETE /api/v1/admin/service-packages/:id
PATCH  /api/v1/admin/service-packages/:id/activate
PATCH  /api/v1/admin/service-packages/:id/deactivate
PATCH  /api/v1/admin/service-packages/:id/steps-template
PATCH  /api/v1/admin/service-packages/:id/included-services

Bookings
GET   /api/v1/bookings/available-slots
GET   /api/v1/bookings
POST  /api/v1/bookings
GET   /api/v1/bookings/:id
PATCH /api/v1/bookings/:id/cancel

GET   /api/v1/admin/bookings
POST  /api/v1/admin/bookings/walk-in
PATCH /api/v1/admin/bookings/:id/check-in
POST  /api/v1/admin/bookings/:id/inspections
PATCH /api/v1/admin/bookings/:id/assign-wash-bay
PATCH /api/v1/admin/bookings/:id/start-service
GET   /api/v1/admin/bookings/:id/service-steps
PATCH /api/v1/admin/bookings/:id/service-steps/:stepId/done
PATCH /api/v1/admin/bookings/:id/complete-service
PATCH /api/v1/admin/bookings/:id/mark-paid

Loyalty
GET  /api/v1/loyalty/me
GET  /api/v1/loyalty/points/history
POST /api/v1/loyalty/redeem-preview

GET   /api/v1/admin/loyalty/tier-rules
POST  /api/v1/admin/loyalty/tier-rules
PATCH /api/v1/admin/loyalty/tier-rules/:id
POST  /api/v1/admin/loyalty/review-tiers

Promotions
GET    /api/v1/promotions/available
POST   /api/v1/admin/promotions
PATCH  /api/v1/admin/promotions/:id
DELETE /api/v1/admin/promotions/:id

VehicleInspection
POST /api/v1/admin/bookings/:id/inspections
GET  /api/v1/admin/bookings/:id/inspections
GET  /api/v1/bookings/:id/inspections

Survey
POST /api/v1/surveys/responses
GET  /api/v1/admin/surveys/responses

Analytics
GET /api/v1/admin/analytics/overview
GET /api/v1/admin/analytics/loyalty
GET /api/v1/admin/analytics/bookings
GET /api/v1/admin/analytics/revenue
GET /api/v1/admin/analytics/promotions

17. Collections chính
users
staff_profiles
garages
wash_bays
vehicles

service_packages
bookings
booking_service_steps
vehicle_inspections

customer_loyalties
point_transactions
tier_rules
tier_histories

promotions
promotion_usages
wash_histories

notifications
survey_responses
audit_logs

18. Module backend nên có
auth
users
staff-profiles
garages
wash-bays
vehicles
service-packages
bookings
booking-service-steps
vehicle-inspections
loyalty
promotions
wash-histories
notifications
surveys
analytics
audit-logs
uploads

19. Tech stack chính
Backend: Node.js + Express
Database: MongoDB + Mongoose
Database GUI: MongoDB Compass
Validation: Zod
API Documentation: Swagger / OpenAPI
Image Storage: Cloudinary
API Testing: Postman
Unit / Integration Test: Jest + Supertest
Authentication: JWT + bcryptjs
Security: cors + helmet
Environment: dotenv
Architecture: Feature-based architecture + Layered Architecture
Pattern: Controller - Service - Model
Payment: Cash payment tracking only

20. Project scope nên chốt
Nên làm trong scope chính:
- Auth / Users
- Staff profile
- Garage
- WashBay
- Vehicle management
- ServicePackage data-driven
- Booking + walk-in booking
- Vehicle inspection
- BookingServiceStep
- Cash payment tracking
- WashHistory
- Loyalty points
- Tier system
- Promotion
- Notification, email
- Survey / dataset support
- Analytics
- Audit log
21. Main Flow Check-in
Customer đến garage
→ Staff tìm booking bằng biển số xe hoặc số điện thoại
→ Nếu khách đã đặt lịch, hệ thống hiển thị booking tương ứng
→ Nếu khách vãng lai, Staff nhập thông tin khách và biển số thủ công
→ Backend chuẩn hóa biển số và kiểm tra dữ liệu liên quan
→ Staff xác nhận check-in
→ Booking status = CHECKED_IN
22. Point Expiry Rule
Hệ thống áp dụng quy tắc điểm thưởng hết hạn sau 12 tháng. Điểm thưởng chỉ được cộng khi booking đã hoàn tất dịch vụ và đã thanh toán, tức là khi booking.status = COMPLETED và payment_status = PAID.
Khi hệ thống cộng điểm cho Customer, hệ thống tạo một PointTransaction với type = EARN. Mỗi giao dịch cộng điểm có ngày hết hạn riêng, được tính bằng:
expires_at = earned_at + 12 tháng

Điểm hết hạn theo từng lần cộng điểm, không hết hạn theo tổng điểm của Customer. Điều này giúp hệ thống biết chính xác điểm nào còn dùng được, điểm nào đã dùng và điểm nào đã quá hạn.
Ví dụ:
01/01/2026: Customer nhận 100 điểm
→ 100 điểm này hết hạn vào 01/01/2027

15/03/2026: Customer nhận thêm 50 điểm
→ 50 điểm này hết hạn vào 15/03/2027

Nếu đến ngày hết hạn mà điểm vẫn chưa được sử dụng, hệ thống sẽ trừ số điểm còn lại khỏi available_points của Customer. Sau đó hệ thống tạo thêm một PointTransaction với type = EXPIRE để ghi nhận lịch sử điểm hết hạn.
Point expiry chỉ ảnh hưởng đến số điểm có thể sử dụng, không xóa lịch sử điểm, không xóa WashHistory và không làm mất dữ liệu thống kê.
PointTransaction
PointTransaction {
    _id

    customer_id
    booking_id // nullable nếu không liên quan trực tiếp đến booking

    type // EARN, REDEEM, REFUND, EXPIRE, ADJUST

    points
    remaining_points

    balance_before
    balance_after

    description

    earned_at
    expires_at
    expired_at

    source_transaction_ids

    created_by // nullable
    created_at
    updated_at
}

Ý nghĩa các field chính:
points:
Số điểm của giao dịch. EARN và REFUND là số dương. REDEEM và EXPIRE là số âm.

remaining_points:
Chỉ dùng cho giao dịch EARN hoặc REFUND. Đây là số điểm còn lại chưa dùng và chưa hết hạn.

expires_at:
Ngày hết hạn của điểm. Thường dùng cho EARN hoặc REFUND.

expired_at:
Thời điểm hệ thống thực sự xử lý hết hạn điểm.

balance_before:
Số điểm khả dụng trước khi giao dịch xảy ra.

balance_after:
Số điểm khả dụng sau khi giao dịch xảy ra.

source_transaction_ids:
Danh sách giao dịch nguồn bị ảnh hưởng. Ví dụ giao dịch EXPIRE có thể tham chiếu tới các EARN transaction bị hết hạn.

CustomerLoyalty
CustomerLoyalty {
    customer_id

    current_tier

    total_points
    available_points
    redeemed_points
    expired_points

    total_spent
    total_visits

    last_visit_at
    last_tier_review_at
    last_point_expiry_check_at

    created_at
    updated_at
}

Ý nghĩa:
total_points:
Tổng điểm từng được cộng trong lịch sử. Không giảm khi redeem hoặc expire.

available_points:
Số điểm Customer hiện có thể sử dụng.

redeemed_points:
Tổng điểm Customer đã sử dụng.

expired_points:
Tổng điểm đã bị hết hạn.

total_spent:
Tổng chi tiêu từ các booking COMPLETED + PAID.

total_visits:
Tổng số lần sử dụng dịch vụ đã COMPLETED + PAID.

Earn Points Flow
Booking status = COMPLETED
→ Staff/Admin xác nhận PAID
→ System tính earned_points
→ Create PointTransaction type = EARN
→ expires_at = now + 12 tháng
→ remaining_points = earned_points
→ CustomerLoyalty.available_points += earned_points
→ CustomerLoyalty.total_points += earned_points

Redeem Points Flow
Khi Customer dùng điểm, hệ thống trừ điểm theo nguyên tắc điểm hết hạn sớm được dùng trước.
Customer dùng điểm
→ System kiểm tra available_points
→ System tìm các EARN transaction còn remaining_points > 0
→ Sắp xếp theo expires_at tăng dần
→ Trừ điểm từ các giao dịch sắp hết hạn trước
→ Create PointTransaction type = REDEEM
→ CustomerLoyalty.available_points -= used_points
→ CustomerLoyalty.redeemed_points += used_points

Ví dụ:
Customer có:
- 100 điểm hết hạn ngày 01/01/2027
- 50 điểm hết hạn ngày 15/03/2027

Customer dùng 120 điểm
→ Trừ 100 điểm từ giao dịch hết hạn 01/01/2027
→ Trừ tiếp 20 điểm từ giao dịch hết hạn 15/03/2027
→ Còn lại 30 điểm có hạn đến 15/03/2027

Point Expiry Flow
Hệ thống có một job định kỳ để xử lý điểm hết hạn.
System Scheduler chạy PointExpiryJob
→ Tìm PointTransaction type = EARN hoặc REFUND
→ Điều kiện:
   remaining_points > 0
   expires_at <= now
→ Gom điểm hết hạn theo customer
→ Trừ điểm khỏi CustomerLoyalty.available_points
→ Cộng vào CustomerLoyalty.expired_points
→ Tạo PointTransaction type = EXPIRE
→ Set remaining_points = 0 cho các giao dịch nguồn
→ Lưu expired_at = now

Rule quan trọng
Không xóa PointTransaction cũ.
Không xóa WashHistory.
Không cộng/trừ điểm trực tiếp mà không tạo PointTransaction.
Không để available_points bị âm.
Điểm đã redeem trước ngày hết hạn thì không bị expire nữa.
Điểm hết hạn chỉ trừ phần remaining_points còn lại.

API liên quan
GET  /api/v1/loyalty/me
GET  /api/v1/loyalty/points/history
POST /api/v1/loyalty/redeem-preview

GET  /api/v1/admin/loyalty/expiring-points
POST /api/v1/admin/loyalty/expire-points

Trong đó:
GET /api/v1/loyalty/me

nên trả về thêm thông tin điểm sắp hết hạn:
{
    current_tier: "GOLD",
    available_points: 350,
    total_points: 1200,
    redeemed_points: 700,
    expired_points: 150,
    expiring_points: [
        {
            points: 80,
            expires_at: "2027-01-01"
        },
        {
            points: 120,
            expires_at: "2027-02-15"
        }
    ]
}

23. Redeem Point Rule
Redeem point là chức năng cho phép Customer sử dụng điểm thưởng để giảm giá khi tạo booking. Trong phạm vi prototype, hệ thống hỗ trợ đổi điểm thành số tiền giảm trực tiếp trên booking. Nếu Customer có đủ điểm để giảm toàn bộ số tiền cần thanh toán, booking có thể có final_price = 0.
Redeem configuration
Quy tắc quy đổi điểm không hard-code trong source code. Hệ thống lưu rule trong database để Admin có thể thay đổi sau này.
LoyaltyRedeemRule {
    point_value_amount // ví dụ: 1 điểm = 1000 VND
    min_redeem_points
    redeem_step
    max_redeem_percent
    is_active
    created_at
    updated_at
}

Ví dụ rule mặc định:
{
    point_value_amount: 1000,
    min_redeem_points: 10,
    redeem_step: 10,
    max_redeem_percent: 100,
    is_active: true
}

Ý nghĩa:
1 điểm = 1.000 VND
Customer phải dùng tối thiểu 10 điểm
Số điểm dùng phải là bội số của 10
Có thể dùng điểm để giảm tối đa 100% số tiền cần thanh toán

Price calculation order
Khi Customer tạo booking, hệ thống tính giá theo thứ tự:
original_price
→ trừ promotion discount nếu có
→ trừ point discount nếu Customer dùng điểm
→ final_price

Công thức:
price_after_promotion = original_price - promotion_discount_amount

point_discount_amount = used_points * point_value_amount

final_price = price_after_promotion - point_discount_amount

Rule bắt buộc:
final_price không được nhỏ hơn 0
used_points không được vượt available_points
point_discount_amount không được vượt price_after_promotion
used_points phải thỏa min_redeem_points và redeem_step

Booking fields
Booking cần lưu rõ điểm đã dùng và số tiền được giảm từ điểm.
Booking {
    original_price
    promotion_discount_amount
    points_discount_amount
    discount_amount
    final_price

    used_points
    earned_points

    promotion_id
    payment_status
    status
}

Trong đó:
promotion_discount_amount:
Số tiền giảm từ promotion.

points_discount_amount:
Số tiền giảm từ điểm thưởng.

discount_amount:
Tổng giảm giá = promotion_discount_amount + points_discount_amount.

used_points:
Số điểm Customer đã dùng cho booking.

final_price:
Số tiền cuối cùng Customer cần thanh toán tại garage.

Redeem preview flow
Trước khi tạo booking, Customer có thể xem trước số tiền được giảm.
Customer nhập số điểm muốn dùng
→ System lấy CustomerLoyalty.available_points
→ System lấy LoyaltyRedeemRule đang active
→ System kiểm tra số điểm hợp lệ
→ System tính points_discount_amount
→ System tính final_price
→ System trả về preview cho Customer

API:
POST /api/v1/loyalty/redeem-preview

Request ví dụ:
{
    "service_package_id": "servicePackageId",
    "promotion_id": "promotionId",
    "used_points": 50
}

Response ví dụ:
{
    "original_price": 150000,
    "promotion_discount_amount": 20000,
    "price_after_promotion": 130000,
    "used_points": 50,
    "point_value_amount": 1000,
    "points_discount_amount": 50000,
    "final_price": 80000
}

Redeem during booking
Khi Customer xác nhận tạo booking có dùng điểm:
Customer tạo booking
→ System validate available_points
→ System validate redeem rule
→ System tính points_discount_amount
→ System tạo Booking với used_points và final_price
→ System trừ điểm ngay khỏi CustomerLoyalty.available_points
→ System tạo PointTransaction type = REDEEM

Lý do trừ điểm ngay khi tạo booking: tránh trường hợp Customer dùng cùng một lượng điểm để đặt nhiều booking khác nhau.
PointTransaction for redeem
Khi Customer dùng điểm, hệ thống tạo giao dịch điểm:
PointTransaction {
    customer_id
    booking_id
    type: 'REDEEM'
    points: -used_points
    balance_before
    balance_after
    description
    source_transaction_ids
    created_at
}

Hệ thống nên trừ điểm theo nguyên tắc điểm sắp hết hạn trước được dùng trước.
Ưu tiên trừ điểm từ các EARN transaction có expires_at gần nhất
→ Nếu chưa đủ thì trừ tiếp transaction tiếp theo
→ Cập nhật remaining_points của các EARN transaction liên quan

Cancel and refund rule
Nếu booking đã dùng điểm nhưng bị hủy, hệ thống xử lý hoàn điểm theo rule:
Booking CANCELED trước khi CHECKED_IN:
→ Hoàn lại điểm cho Customer
→ Tạo PointTransaction type = REFUND

Booking CANCELED bởi Staff/Admin do lỗi vận hành garage:
→ Hoàn lại điểm cho Customer
→ Tạo PointTransaction type = REFUND

Booking NO_SHOW:
→ Không tự động hoàn điểm
→ Admin có thể hoàn điểm thủ công nếu có lý do hợp lệ

Booking COMPLETED:
→ Không hoàn điểm

PointTransaction khi hoàn điểm:
PointTransaction {
    customer_id
    booking_id
    type: 'REFUND'
    points: refunded_points
    balance_before
    balance_after
    description
    created_at
}

Earn point after using points
Customer chỉ được cộng điểm sau khi booking đã COMPLETED + PAID.
Điểm thưởng nên tính theo số tiền thực tế còn lại sau promotion và redeem point, để tránh việc dùng điểm nhưng vẫn nhận đủ điểm như thanh toán toàn bộ bằng tiền mặt.
Công thức đề xuất:
earned_points = service_package.points_earned * tier_multiplier * (final_price / original_price)

Sau đó làm tròn xuống:
earned_points = floor(earned_points)

Ví dụ:
original_price = 150.000 VND
final_price = 75.000 VND
service_package.points_earned = 30
tier_multiplier = 1.2

earned_points = 30 * 1.2 * (75.000 / 150.000)
earned_points = 18 điểm

Nếu final_price = 0, Customer không nhận thêm điểm thưởng cho booking đó.
Important rules
Không cho used_points > available_points.
Không cho final_price < 0.
Không cho redeem point cho booking walk-in của khách vãng lai vì khách vãng lai không có CustomerLoyalty.
Không cho Customer tự chỉnh used_points sau khi booking đã CHECKED_IN.
Nếu muốn đổi số điểm đã dùng, Customer phải hủy booking cũ và tạo booking mới.
Không xóa PointTransaction khi refund, chỉ tạo transaction REFUND mới.
24. Research Dataset & Behavior Logs
Để hỗ trợ mục tiêu nghiên cứu của đề tài, hệ thống bổ sung chức năng ghi nhận dữ liệu hành vi và export dataset phục vụ phân tích. Phần này không triển khai mô hình Machine Learning production, mà tập trung vào việc thu thập, chuẩn hóa và xuất dữ liệu từ các hoạt động thực tế trong hệ thống.
Dữ liệu nghiên cứu được tổng hợp từ các collection chính như:
bookings
wash_histories
customer_loyalties
point_transactions
promotions
promotion_usages
survey_responses
vehicles
service_packages
garages

Mục tiêu của dataset là hỗ trợ phân tích các yếu tố ảnh hưởng đến việc nâng hạng thành viên, giữ chân khách hàng và mức độ tương tác lâu dài với dịch vụ.
Dataset fields
Dataset export nên bao gồm các nhóm dữ liệu sau:
ResearchDatasetRecord {
    record_id

    customer_anonymous_id
    customer_tier
    total_visits
    total_spent
    available_points
    total_points
    redeemed_points
    expired_points

    booking_id
    booking_date
    booking_hour
    booking_day_of_week
    garage_id

    vehicle_type
    engine_type
    service_package_id
    service_type
    service_duration_minutes

    original_price
    promotion_discount_amount
    points_discount_amount
    final_price
    payment_status

    used_promotion // true / false
    promotion_id
    used_points // true / false
    used_points_amount
    earned_points

    booking_status
    is_walk_in
    is_no_show
    is_canceled
    is_completed_paid

    tier_before_booking
    tier_after_review
    upgraded_tier // true / false
    downgraded_tier // true / false

    survey_wash_frequency
    survey_average_spending
    survey_interested_in_loyalty
    survey_factors_affecting_loyalty

    created_at
}

Lưu ý: Dataset phục vụ nghiên cứu không nên export trực tiếp thông tin định danh cá nhân như email, số điện thoại, tên khách hàng hoặc biển số xe thật. Thay vào đó, hệ thống dùng customer_anonymous_id để ẩn danh dữ liệu Customer.
BehaviorLog
Ngoài dataset tổng hợp, hệ thống có thể ghi nhận behavior logs để phân tích hành vi người dùng trong quá trình sử dụng hệ thống.
BehaviorLog {
    _id

    user_id // nullable nếu khách vãng lai
    anonymous_user_id

    event_type
    // REGISTER
    // LOGIN
    // VIEW_SERVICE_PACKAGE
    // VIEW_AVAILABLE_SLOT
    // CREATE_BOOKING
    // CANCEL_BOOKING
    // JOIN_WAITLIST
    // ACCEPT_WAITLIST_OFFER
    // APPLY_PROMOTION
    // REDEEM_POINTS
    // COMPLETE_SERVICE
    // MARK_PAID
    // EARN_POINTS
    // TIER_UPGRADED
    // TIER_DOWNGRADED
    // SUBMIT_SURVEY

    entity_type
    entity_id

    garage_id
    booking_id
    service_package_id
    vehicle_type
    customer_tier

    metadata

    occurred_at
    created_at
}

metadata dùng để lưu các thông tin phụ theo từng event, ví dụ:
{
    "selected_time": "2026-06-04T10:00:00",
    "final_price": 80000,
    "used_points": 50,
    "promotion_code": "SILVER20",
    "old_tier": "SILVER",
    "new_tier": "GOLD"
}

BehaviorLog giúp hệ thống phân tích các hành vi như customer xem slot nhưng không đặt lịch, customer dùng promotion, customer redeem point, customer quay lại nhiều lần hoặc customer được nâng hạng.
Export dataset API
Admin có thể export dataset để phục vụ báo cáo, phân tích hoặc xử lý dữ liệu bên ngoài.
GET /api/v1/admin/research/export-dataset
GET /api/v1/admin/research/behavior-logs
GET /api/v1/admin/research/dataset-summary

Query params gợi ý:
GET /api/v1/admin/research/export-dataset
?from=2026-06-01
&to=2026-06-30
&format=csv
&garage_id=...
&vehicle_type=CAR
&anonymized=true

Hệ thống nên hỗ trợ ít nhất hai định dạng:
CSV: dùng cho Excel, Google Sheets, Python, Power BI
JSON: dùng cho API hoặc xử lý bằng script

Export dataset flow
Admin chọn khoảng thời gian cần export
→ System lấy dữ liệu từ bookings, wash_histories, customer_loyalties, point_transactions, promotion_usages và survey_responses
→ System join dữ liệu cần thiết
→ System ẩn danh thông tin nhạy cảm
→ System chuẩn hóa dữ liệu thành ResearchDatasetRecord
→ System export file CSV hoặc JSON
→ Admin tải dataset về để phân tích

Privacy rule
Dataset dùng cho nghiên cứu phải tuân thủ nguyên tắc tối thiểu hóa dữ liệu cá nhân.
Không export trực tiếp:
customer full_name
email
phone
raw_license_plate
normalized_license_plate
guest_phone
guest_name
exact address

Có thể export dạng ẩn danh:
customer_anonymous_id
vehicle_type
customer_tier
booking date/hour
service package type
final_price
earned_points
used_points
promotion usage
survey answers

Synthetic dataset support
Để hỗ trợ giai đoạn tạo dữ liệu hành vi mô phỏng, hệ thống có thể có script seed dữ liệu.
src/scripts/seedResearchDataset.js
src/scripts/seedSyntheticBookings.js
src/scripts/seedSyntheticBehaviorLogs.js

Dữ liệu synthetic có thể mô phỏng:
- Customer ở nhiều tier khác nhau
- Booking ở nhiều khung giờ khác nhau
- Dịch vụ thường và combo
- Booking có dùng promotion
- Booking có redeem points
- Booking bị canceled
- Booking completed + paid
- Customer được nâng/hạ tier

Synthetic data chỉ dùng cho nghiên cứu và demo dashboard, không đại diện hoàn toàn cho dữ liệu thực tế.
Scope note
Trong phạm vi prototype, hệ thống chỉ hỗ trợ thu thập, lưu trữ, thống kê và export dataset. Hệ thống chưa triển khai mô hình Machine Learning production. Việc phân tích chuyên sâu hoặc huấn luyện mô hình có thể được thực hiện bên ngoài hệ thống bằng dataset đã export.
src/modules/research/
├─ research.routes.js
├─ research.controller.js
├─ research.service.js
├─ behaviorLog.model.js
├─ research.validator.js
├─ research.mapper.js
├─ research.swagger.js
└─ research.test.js
25. Email Notification Events
Hệ thống hỗ trợ hai kênh thông báo:
IN_APP
EMAIL

Trong phạm vi prototype, hệ thống không gửi email cho mọi thay đổi trạng thái nhỏ. Email chỉ được gửi cho các event có giá trị rõ ràng với Customer, gồm: đặt lịch thành công, nhắc lịch trước giờ hẹn và offer slot từ waitlist. Các event còn lại chỉ hiển thị trên web notification.
Notification channels
IN_APP
EMAIL

Ý nghĩa:
IN_APP:
Thông báo hiển thị trong hệ thống.

EMAIL:
Thông báo gửi đến email của Customer nếu tài khoản có email hợp lệ.

Nếu khách là walk-in không có tài khoản, hệ thống chỉ gửi email nếu Staff có nhập guest_email. Nếu không có email, hệ thống chỉ lưu thông tin trong booking và không gửi email.
Notification event types
NotificationEventType {
    AUTH_REGISTER_SUCCESS

    BOOKING_CONFIRMED
    BOOKING_REMINDER
    BOOKING_CANCELED

    WAITLIST_JOINED
    WAITLIST_OFFERED
    WAITLIST_OFFER_ACCEPTED
    WAITLIST_OFFER_EXPIRED
    WAITLIST_CANCELED

    CHECKED_IN
    SERVICE_STARTED
    SERVICE_STEP_DONE
    SERVICE_COMPLETED

    PAYMENT_CONFIRMED
    REWARD_EARNED

    POINTS_EXPIRING
    TIER_UPGRADED
    TIER_DOWNGRADED

    PROMOTION_AVAILABLE
    SURVEY_REQUEST
}

Events gửi cả IN_APP và EMAIL
BOOKING_CONFIRMED:
Gửi khi Customer đặt lịch thành công.

BOOKING_REMINDER:
Gửi trước giờ hẹn, ví dụ trước 3 giờ.

WAITLIST_OFFERED:
Gửi khi có slot trống và hệ thống offer cho Customer trong waitlist.

Events chỉ gửi IN_APP
Các event còn lại chỉ gửi thông báo trên hệ thống, không gửi email.
AUTH_REGISTER_SUCCESS
BOOKING_CANCELED

WAITLIST_JOINED
WAITLIST_OFFER_ACCEPTED
WAITLIST_OFFER_EXPIRED
WAITLIST_CANCELED

CHECKED_IN
SERVICE_STARTED
SERVICE_STEP_DONE
SERVICE_COMPLETED

PAYMENT_CONFIRMED
REWARD_EARNED

POINTS_EXPIRING
TIER_UPGRADED
TIER_DOWNGRADED

PROMOTION_AVAILABLE
SURVEY_REQUEST

Booking guest email
Để hỗ trợ gửi email cho khách walk-in nếu Staff có nhập email, Booking nên có thêm field:
Booking {
    customer_id // nullable nếu khách vãng lai
    vehicle_id // nullable nếu khách vãng lai

    is_walk_in
    guest_name
    guest_phone
    guest_email

    license_plate
    normalized_license_plate

    created_by_staff_id

    garage_id
    service_package_id

    start_time
    end_time

    status
    payment_status

    created_at
    updated_at
}

Notification model
Notification {
    _id

    user_id // nullable nếu là guest
    recipient_email // dùng cho email, nullable nếu không gửi email

    type
    title
    message

    channels // ['IN_APP'] hoặc ['IN_APP', 'EMAIL']

    related_type // BOOKING, WAITLIST, LOYALTY, PROMOTION, SURVEY
    related_id

    in_app_status // UNREAD, READ
    read_at

    email_status // NOT_REQUIRED, PENDING, SENT, FAILED
    email_sent_at
    email_failed_reason

    metadata

    created_at
    updated_at
}

Email delivery log
Nếu muốn theo dõi gửi email rõ hơn, có thể thêm collection riêng:
EmailDeliveryLog {
    _id

    notification_id
    user_id // nullable nếu là guest
    recipient_email

    event_type
    subject

    status // PENDING, SENT, FAILED
    provider_message_id
    failed_reason

    sent_at
    created_at
    updated_at
}

Trong prototype, EmailDeliveryLog là optional. Nếu muốn làm nhanh, chỉ cần lưu email_status, email_sent_at và email_failed_reason trong Notification.
User notification preferences
Customer có thể cấu hình có nhận email cho booking/waitlist hay không.
User {
    email
    email_verified

    notification_preferences: {
        booking_email: true,
        waitlist_email: true
    }
}

Ý nghĩa:
booking_email:
Áp dụng cho BOOKING_CONFIRMED và BOOKING_REMINDER.

waitlist_email:
Áp dụng cho WAITLIST_OFFERED.

Các event loyalty, promotion, survey trong prototype chỉ gửi web notification nên không cần preference email riêng.
Email sending rule
Nếu event thuộc nhóm:
BOOKING_CONFIRMED
BOOKING_REMINDER
WAITLIST_OFFERED

và Customer có email hợp lệ:
→ Hệ thống tạo IN_APP notification
→ Hệ thống gửi email
→ email_status = SENT nếu gửi thành công
→ email_status = FAILED nếu gửi lỗi

Nếu event không thuộc nhóm gửi email:
→ Hệ thống chỉ tạo IN_APP notification
→ email_status = NOT_REQUIRED

Email service flow
Business event xảy ra
→ Service tương ứng gọi NotificationService
→ NotificationService xác định channels theo event type
→ Tạo Notification
→ Nếu channels có EMAIL thì gọi EmailService
→ EmailService gửi mail theo template tương ứng
→ Cập nhật email_status

Ví dụ:
Customer đặt booking thành công
→ BookingService tạo booking
→ NotificationService.emit(BOOKING_CONFIRMED)
→ Tạo web notification
→ Gửi email xác nhận đặt lịch

Ví dụ:
BookingReminderJob chạy trước giờ hẹn 3 giờ
→ Tìm booking sắp đến giờ
→ NotificationService.emit(BOOKING_REMINDER)
→ Tạo web notification
→ Gửi email nhắc lịch

Ví dụ:
Một booking bị CANCELED
→ Hệ thống tìm waitlist phù hợp
→ Offer slot cho Customer
→ NotificationService.emit(WAITLIST_OFFERED)
→ Tạo web notification
→ Gửi email offer slot

API liên quan
GET   /api/v1/notifications
PATCH /api/v1/notifications/:id/read
PATCH /api/v1/notifications/mark-all-read
DELETE /api/v1/notifications/:id
DELETE /api/v1/notifications

API cấu hình preference:
GET   /api/v1/users/me/notification-preferences
PATCH /api/v1/users/me/notification-preferences

Admin test email, optional:
POST /api/v1/admin/notifications/test-email

Backend modules
notifications
email

Cấu trúc gợi ý:
src/modules/notifications/
├─ notification.routes.js
├─ notification.controller.js
├─ notification.service.js
├─ notification.model.js
├─ notification.validator.js
├─ notification.mapper.js
└─ notification.swagger.js

src/modules/email/
├─ email.service.js
├─ emailTemplate.service.js
└─ templates/
   ├─ bookingConfirmed.template.js
   ├─ bookingReminder.template.js
   └─ waitlistOffered.template.js

Scope note
Trong phạm vi prototype, email notification chỉ áp dụng cho ba sự kiện: đặt lịch thành công, nhắc lịch trước giờ hẹn và offer slot từ waitlist. Các sự kiện vận hành khác như hủy booking, check-in, bắt đầu dịch vụ, hoàn tất dịch vụ, xác nhận thanh toán, cộng điểm, nâng hạng hoặc promotion mới chỉ hiển thị trong web notification.
26. WashBay Performance Dashboard
WashBay Performance Dashboard dùng để giúp Admin theo dõi hiệu suất sử dụng các buồng rửa tại từng garage. Dashboard này chỉ áp dụng cho các booking có sử dụng dịch vụ rửa xe hoặc ServicePackage.requires_wash_bay = true.
Mục tiêu của dashboard là trả lời các câu hỏi:
garage nào đang có nhiều booking nhất?
WashBay nào đang được sử dụng nhiều nhất?
Khung giờ nào thường bị đầy slot?
Tỷ lệ sử dụng WashBay là bao nhiêu?
WashBay nào hay bị maintenance?
Số booking bị canceled ảnh hưởng đến slot như thế nào?
Waitlist có giúp lấp slot bị hủy không?

Data source
Dashboard lấy dữ liệu từ các collection:
wash_bays
bookings
booking_waitlists
garages
service_packages

Nếu muốn tính chính xác thời gian sử dụng WashBay, nên thêm collection:
WashBayUsageLog {
    _id

    wash_bay_id
    booking_id
    garage_id

    vehicle_type // MOTORBIKE, CAR

    planned_start_time
    planned_end_time

    actual_start_time
    actual_end_time

    duration_minutes

    status // COMPLETED, RELEASED, CANCELED, INTERRUPTED

    release_reason // COMPLETED_WASH_STEP, BOOKING_CANCELED, SYSTEM_RELEASED

    created_at
    updated_at
}

Ý nghĩa:
planned_start_time / planned_end_time:
Khoảng thời gian dự kiến chiếm WashBay.

actual_start_time / actual_end_time:
Khoảng thời gian thực tế WashBay bị chiếm.

duration_minutes:
Số phút thực tế WashBay được sử dụng.

release_reason:
Lý do WashBay được trả về AVAILABLE.

Nếu muốn làm nhanh trong prototype, có thể chưa cần WashBayUsageLog, mà dùng trực tiếp các field trong Booking:
Booking {
    wash_bay_id

    wash_bay_start_time
    wash_bay_end_time

    actual_wash_bay_started_at
    actual_wash_bay_released_at

    requires_wash_bay
}

Tuy nhiên, dùng WashBayUsageLog sẽ tốt hơn cho dashboard vì lưu được lịch sử sử dụng của từng WashBay rõ ràng hơn.
Main metrics
1. Total WashBays
Tổng số WashBay trong garage.
total_wash_bays = count(wash_bays)

Có thể chia theo loại xe:
MOTORBIKE
CAR

2. Active WashBays
Số WashBay đang hoạt động.
active_wash_bays = count(wash_bays where is_active = true and status != INACTIVE)

3. Current WashBay Status
Hiển thị trạng thái hiện tại của từng WashBay.
AVAILABLE
OCCUPIED
MAINTENANCE
INACTIVE

Ví dụ UI:
MB-01: AVAILABLE
MB-02: OCCUPIED
CAR-01: MAINTENANCE

4. WashBay Utilization Rate
Tỷ lệ sử dụng WashBay trong khoảng thời gian được chọn.
utilization_rate = used_minutes / available_minutes * 100

Trong đó:
used_minutes:
Tổng số phút WashBay thực tế được sử dụng.

available_minutes:
Số phút WashBay có thể hoạt động trong khoảng thời gian đó.

Ví dụ:
garage mở cửa 8 giờ/ngày = 480 phút
Có 2 WashBay active
available_minutes = 480 * 2 = 960 phút

Tổng thời gian WashBay được dùng = 600 phút

utilization_rate = 600 / 960 * 100 = 62.5%

5. Completed WashBay Bookings
Số booking có dùng WashBay và đã hoàn tất.
completed_wash_bay_bookings = count(bookings where requires_wash_bay = true and status = COMPLETED)

6. Average WashBay Usage Duration
Thời gian trung bình mỗi booking chiếm WashBay.
avg_wash_bay_duration = total_used_minutes / number_of_completed_wash_bay_bookings

Ví dụ:
Tổng used_minutes = 600
Số booking hoàn tất = 20

avg_wash_bay_duration = 30 phút

7. Peak Hours
Khung giờ có nhiều booking dùng WashBay nhất.
Ví dụ:
09:00 - 10:00: 12 bookings
10:00 - 11:00: 18 bookings
15:00 - 16:00: 20 bookings

Dữ liệu này giúp Admin biết khung giờ nào thường đầy slot.
8. Maintenance Time
Tổng thời gian WashBay ở trạng thái MAINTENANCE.
maintenance_minutes = tổng thời gian WashBay status = MAINTENANCE

Nếu chưa lưu log maintenance, chỉ hiển thị trạng thái hiện tại. Nếu muốn tính thời gian maintenance chính xác, sau này có thể thêm WashBayStatusLog.
9. Canceled Slot Count
Số booking có dùng WashBay bị hủy.
canceled_wash_bay_bookings = count(bookings where requires_wash_bay = true and status = CANCELED)

Dữ liệu này giúp đánh giá số slot bị mất do hủy lịch.
10. Waitlist Recovery Rate
Tỷ lệ slot bị hủy được lấp lại bằng waitlist.
waitlist_recovery_rate = accepted_waitlist_offers / canceled_wash_bay_bookings * 100

Ví dụ:
Có 20 booking bị canceled
Có 8 waitlist offer được accepted

waitlist_recovery_rate = 8 / 20 * 100 = 40%

Dashboard filters
Admin nên lọc dashboard theo:
garage_id
vehicle_type // MOTORBIKE, CAR
wash_bay_id
date_from
date_to
time_range

Ví dụ:
Xem hiệu suất WashBay ô tô tại garage FPT Hòa Lạc trong tháng 06/2026.

API đề xuất
GET /api/v1/admin/analytics/wash-bays/overview
GET /api/v1/admin/analytics/wash-bays/utilization
GET /api/v1/admin/analytics/wash-bays/peak-hours
GET /api/v1/admin/analytics/wash-bays/:washBayId

Ví dụ:
GET /api/v1/admin/analytics/wash-bays/overview
?garage_id=...
&vehicle_type=CAR
&from=2026-06-01
&to=2026-06-30

Response gợi ý:
{
    "total_wash_bays": 5,
    "active_wash_bays": 4,
    "available_now": 2,
    "occupied_now": 1,
    "maintenance_now": 1,
    "completed_wash_bay_bookings": 320,
    "canceled_wash_bay_bookings": 28,
    "total_used_minutes": 9600,
    "average_usage_minutes": 30,
    "utilization_rate": 72.5,
    "waitlist_recovery_rate": 35.7
}

API chi tiết từng WashBay:
GET /api/v1/admin/analytics/wash-bays/:washBayId
?from=2026-06-01
&to=2026-06-30

Response gợi ý:
{
    "wash_bay_id": "washBayId",
    "name": "CAR-01",
    "vehicle_type": "CAR",
    "status": "AVAILABLE",
    "completed_bookings": 85,
    "total_used_minutes": 2550,
    "average_usage_minutes": 30,
    "utilization_rate": 68.2,
    "maintenance_minutes": 240,
    "canceled_bookings": 6
}

UI gợi ý
Dashboard nên có các card:
Total WashBays
Active WashBays
Currently Occupied
Currently Available
Maintenance
Utilization Rate
Completed Bookings
Average Usage Time
Canceled Slots
Waitlist Recovery Rate

Nên có biểu đồ:
Utilization by day
Peak hours heatmap
Bookings by vehicle type
WashBay status distribution
Top used WashBays

Trong prototype, chỉ cần làm card + bảng là đủ. Biểu đồ có thể để sau.
Scope
P0 - Nên làm nếu có dashboard cơ bản:
- Overview card cho WashBay.
- Current status của từng WashBay.
- Số booking completed/canceled có dùng WashBay.
- Utilization rate tính từ wash_bay_start_time và wash_bay_end_time.

P1 - Nếu còn thời gian:
- Peak hours.
- Waitlist recovery rate.
- Chi tiết từng WashBay.

P2 - Future work:
- WashBayUsageLog.
- WashBayStatusLog.
- Heatmap theo giờ/ngày.
- Dự đoán khung giờ cao điểm.

Scope note
Trong phạm vi prototype, WashBay Performance Dashboard chỉ đo hiệu suất buồng rửa dựa trên các booking có requires_wash_bay = true. Dashboard không đo hiệu suất từng nhân viên và không phân tích sâu các dịch vụ chăm sóc xe thủ công không sử dụng WashBay.
27. Walk-in Customer Conversion & Historical Link
Hệ thống hỗ trợ khách vãng lai chuyển thành Customer có tài khoản và liên kết lại lịch sử sử dụng dịch vụ cũ. Chức năng này giúp khách đã từng rửa xe trực tiếp tại garage có thể đăng ký tài khoản sau đó và tiếp tục theo dõi lịch sử rửa xe, điểm loyalty và hạng thành viên.
Trong phạm vi prototype, việc liên kết lịch sử khách vãng lai cần được kiểm soát để tránh gán nhầm lịch sử của người khác.
Walk-in booking data
Khi Staff tạo booking cho khách vãng lai, hệ thống nên lưu đủ thông tin để sau này có thể liên kết:
Booking {
    customer_id // null nếu là khách vãng lai
    vehicle_id // null nếu là khách vãng lai

    is_walk_in
    guest_name
    guest_phone
    guest_email

    license_plate
    normalized_license_plate
    vehicle_type

    created_by_staff_id

    status
    payment_status

    converted_customer_id
    converted_vehicle_id
    converted_at
    converted_by
    conversion_note

    created_at
    updated_at
}

Ý nghĩa:
guest_phone:
Số điện thoại khách vãng lai cung cấp tại garage.

guest_email:
Email khách vãng lai, optional.

normalized_license_plate:
Biển số đã được chuẩn hóa để match dữ liệu.

converted_customer_id:
Customer account được liên kết sau này.

converted_vehicle_id:
Vehicle được liên kết hoặc tạo mới cho Customer.

converted_at:
Thời điểm liên kết lịch sử.

converted_by:
Người thực hiện liên kết, có thể là Customer tự claim hoặc Staff/Admin xác nhận.

Conversion rule
Không tự động liên kết lịch sử chỉ bằng biển số xe, vì xe có thể đổi chủ hoặc Staff có thể nhập nhầm. Hệ thống chỉ nên liên kết khi thỏa điều kiện:
- Booking là walk-in booking
- customer_id hiện tại đang null
- guest_phone trùng với số điện thoại Customer đã xác minh
- normalized_license_plate trùng với xe Customer đã thêm hoặc Customer xác nhận muốn thêm xe đó
- Booking đã COMPLETED + PAID nếu muốn tính vào lịch sử loyalty

Nếu chỉ trùng biển số nhưng khác số điện thoại, hệ thống không tự liên kết. Trường hợp này cần Staff/Admin kiểm tra thủ công.
Main flow: Customer tự liên kết lịch sử cũ
Walk-in customer từng rửa xe tại garage
→ Sau này Customer đăng ký tài khoản
→ Customer xác minh số điện thoại
→ Hệ thống tìm walk-in bookings có guest_phone trùng số điện thoại
→ Hệ thống hiển thị danh sách lịch sử có thể liên kết
→ Customer xác nhận các booking thuộc về mình
→ Hệ thống kiểm tra biển số và vehicle_type
→ Nếu Customer chưa có vehicle tương ứng, hệ thống tạo Vehicle mới
→ Hệ thống cập nhật Booking.customer_id và Booking.vehicle_id
→ Hệ thống cập nhật WashHistory nếu có
→ Nếu booking COMPLETED + PAID và chưa reward_processed, hệ thống xử lý điểm loyalty

Main flow: Staff/Admin hỗ trợ liên kết
Customer đến garage và yêu cầu liên kết lịch sử cũ
→ Staff/Admin tìm walk-in booking bằng số điện thoại hoặc biển số
→ Staff/Admin kiểm tra thông tin khách
→ Staff/Admin chọn Customer account cần liên kết
→ Hệ thống kiểm tra điều kiện liên kết
→ Hệ thống liên kết booking cũ với Customer
→ Hệ thống cập nhật vehicle_id nếu phù hợp
→ Hệ thống ghi audit log

Loyalty handling
Khi liên kết lịch sử cũ, hệ thống có thể xử lý loyalty theo rule sau:
Nếu booking đã COMPLETED + PAID và reward_processed = false:
→ Tạo hoặc cập nhật WashHistory với customer_id mới
→ Tính earned_points theo ServicePackage và TierRule tại thời điểm xử lý
→ Tạo PointTransaction type = RETROACTIVE_EARN hoặc ADJUST
→ Cập nhật CustomerLoyalty
→ Set booking.reward_processed = true

Nếu booking chưa COMPLETED hoặc chưa PAID:
→ Chỉ liên kết dữ liệu booking
→ Không cộng điểm

Nếu booking đã reward_processed = true:
→ Không cộng điểm lần nữa

Có thể dùng type riêng để dễ audit:
RETROACTIVE_EARN:
Điểm được cộng khi Customer liên kết lịch sử walk-in cũ.

Nếu muốn giữ enum đơn giản, có thể dùng:
ADJUST

với description:
Cộng điểm từ lịch sử walk-in được liên kết.

WashHistory update
Nếu WashHistory đã được tạo trước đó cho walk-in booking nhưng chưa có customer:
WashHistory {
    customer_id // cập nhật từ null sang customerId
    vehicle_id // cập nhật nếu tạo/match được Vehicle
    booking_id
    garage_id
    service_package_id
    amount_paid
    points_earned
    points_used
    created_at
    updated_at
}

Nếu chưa có WashHistory, hệ thống tạo mới khi đủ điều kiện:
booking.status = COMPLETED
payment_status = PAID

API đề xuất
Customer API:
GET  /api/v1/users/me/claimable-walk-in-history
POST /api/v1/users/me/claim-walk-in-history

Ví dụ request:
{
    "booking_ids": ["bookingId1", "bookingId2"]
}

Admin/Staff API:
GET  /api/v1/admin/walk-in-bookings/link-candidates
POST /api/v1/admin/walk-in-bookings/link-to-customer

Ví dụ request:
{
    "customer_id": "customerId",
    "booking_ids": ["bookingId1", "bookingId2"],
    "note": "Customer verified phone number and license plate at garage."
}

Audit log
Vì đây là thao tác ảnh hưởng lịch sử và điểm loyalty, nên cần ghi audit log.
AuditLog {
    actor_id
    actor_role
    action // LINK_WALK_IN_HISTORY
    entity // Booking
    entity_id
    old_value
    new_value
    created_at
}

Important rules
Không link lịch sử cũ chỉ bằng biển số xe.
Không link booking đã thuộc về Customer khác.
Không cộng điểm lại nếu reward_processed = true.
Không cho Customer claim booking có guest_phone khác số điện thoại đã xác minh.
Không xóa dữ liệu guest cũ; chỉ bổ sung customer_id, vehicle_id và conversion metadata.
Nếu có tranh chấp, Staff/Admin xử lý thủ công.

Scope note
Trong phạm vi prototype, chức năng convert khách vãng lai thành Customer và liên kết lịch sử cũ là optional. Nếu triển khai, hệ thống nên ưu tiên liên kết dựa trên số điện thoại đã xác minh và biển số xe đã chuẩn hóa. Việc cộng điểm từ lịch sử cũ chỉ được thực hiện một lần và cần kiểm tra COMPLETED + PAID cùng reward_processed = false.