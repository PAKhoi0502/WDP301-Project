const ServicePackage = require('../modules/service-packages/servicePackage.model');
const { VEHICLE_TYPES } = require('../shared/constants/vehicle.constant');
const { STAFF_TYPES } = require('../shared/constants/staff.constant');
const {
    SERVICE_PACKAGE_TYPES,
    SERVICE_STEP_TYPES,
    SERVICE_TRANSITION_MODES,
} = require('../shared/constants/servicePackage.constant');

const packageDefinitions = [
    {
        key: 'MOTORBIKE_STANDARD_WASH',
        name: 'Rửa xe máy tiêu chuẩn',
        vehicle_type: VEHICLE_TYPES.MOTORBIKE,
        service_type: SERVICE_PACKAGE_TYPES.WASH,
        description: 'Standard wash service for motorbikes.',
        base_price: 30000,
        duration_minutes: 15,
        wash_bay_duration_minutes: 15,
        points_earned: 5,
        requires_wash_bay: true,
        steps_template: [
            {
                step_code: 'MOTORBIKE_STANDARD_WASH',
                step_name: 'Quy trình rửa xe máy tiêu chuẩn',
                order: 1,
                step_type: SERVICE_STEP_TYPES.AUTOMATED_WASH_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.WASH_OPERATOR,
                instructions: [
                    'Xác nhận thông tin đặt lịch và xe',
                    'Kiểm tra tình trạng bên ngoài dễ thấy trước khi rửa',
                    'Xịt nước sơ bộ để loại bỏ bụi bẩn rời',
                    'Phủ bọt trung tính và rửa thân xe',
                    'Vệ sinh bánh xe và phần thân dưới',
                    'Xả sạch và lau khô xe',
                    'Kiểm tra trực quan lần cuối trước khi bàn giao',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'MOTORBIKE_PREMIUM_WASH',
        name: 'Rửa xe máy cao cấp',
        vehicle_type: VEHICLE_TYPES.MOTORBIKE,
        service_type: SERVICE_PACKAGE_TYPES.WASH,
        description: 'Premium wash service for motorbikes with more detailed cleaning.',
        base_price: 50000,
        duration_minutes: 30,
        wash_bay_duration_minutes: 30,
        points_earned: 8,
        requires_wash_bay: true,
        steps_template: [
            {
                step_code: 'MOTORBIKE_PREMIUM_WASH',
                step_name: 'Quy trình rửa xe máy cao cấp',
                order: 1,
                step_type: SERVICE_STEP_TYPES.AUTOMATED_WASH_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.WASH_OPERATOR,
                instructions: [
                    'Xác nhận thông tin đặt lịch và xe',
                    'Kiểm tra tình trạng bên ngoài dễ thấy trước khi rửa',
                    'Che chắn khu vực nhạy cảm của xe nếu cần',
                    'Xịt nước sơ bộ để loại bỏ bụi bẩn rời',
                    'Phủ bọt trung tính và vệ sinh các mảng thân xe',
                    'Vệ sinh bánh xe, phần thân dưới và các khe nhỏ',
                    'Xả sạch và lau khô xe',
                    'Lau nhanh bề mặt và kiểm tra trực quan lần cuối',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'MOTORBIKE_OIL_CHANGE',
        name: 'Thay dầu xe máy',
        vehicle_type: VEHICLE_TYPES.MOTORBIKE,
        service_type: SERVICE_PACKAGE_TYPES.ADDON,
        description: 'Manual motorbike oil change service.',
        base_price: 120000,
        duration_minutes: 20,
        wash_bay_duration_minutes: 0,
        points_earned: 10,
        requires_wash_bay: false,
        steps_template: [
            {
                step_code: 'MOTORBIKE_OIL_CHANGE',
                step_name: 'Quy trình thay dầu xe máy',
                order: 1,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Xác nhận loại dầu và yêu cầu của khách hàng',
                    'Xả dầu cũ an toàn',
                    'Châm dầu mới theo yêu cầu của xe',
                    'Kiểm tra rò rỉ sau khi châm dầu',
                    'Ghi chú dịch vụ nếu cần',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'CAR_STANDARD_WASH',
        name: 'Rửa ô tô tiêu chuẩn',
        vehicle_type: VEHICLE_TYPES.CAR,
        service_type: SERVICE_PACKAGE_TYPES.WASH,
        description: 'Standard exterior wash service for cars.',
        base_price: 80000,
        duration_minutes: 30,
        wash_bay_duration_minutes: 30,
        points_earned: 10,
        requires_wash_bay: true,
        steps_template: [
            {
                step_code: 'CAR_STANDARD_WASH',
                step_name: 'Quy trình rửa ô tô tiêu chuẩn',
                order: 1,
                step_type: SERVICE_STEP_TYPES.AUTOMATED_WASH_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.WASH_OPERATOR,
                instructions: [
                    'Xác nhận thông tin đặt lịch và xe',
                    'Kiểm tra tình trạng bên ngoài dễ thấy trước khi rửa',
                    'Che chắn khu vực nhạy cảm nếu cần',
                    'Xịt nước sơ bộ để loại bỏ bụi bẩn rời',
                    'Phủ bọt trung tính và rửa thân xe bên ngoài',
                    'Vệ sinh bánh xe và phần thân dưới',
                    'Xả sạch và lau khô xe',
                    'Kiểm tra trực quan lần cuối trước khi bàn giao',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'CAR_PREMIUM_WASH',
        name: 'Rửa ô tô cao cấp',
        vehicle_type: VEHICLE_TYPES.CAR,
        service_type: SERVICE_PACKAGE_TYPES.WASH,
        description: 'Premium exterior wash service for cars with detailed exterior cleaning.',
        base_price: 120000,
        duration_minutes: 35,
        wash_bay_duration_minutes: 35,
        points_earned: 15,
        requires_wash_bay: true,
        steps_template: [
            {
                step_code: 'CAR_PREMIUM_WASH',
                step_name: 'Quy trình rửa ô tô cao cấp',
                order: 1,
                step_type: SERVICE_STEP_TYPES.AUTOMATED_WASH_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.WASH_OPERATOR,
                instructions: [
                    'Xác nhận thông tin đặt lịch và xe',
                    'Kiểm tra tình trạng bên ngoài dễ thấy trước khi rửa',
                    'Che chắn cổng sạc xe điện nếu có',
                    'Xịt nước sơ bộ để loại bỏ bụi bẩn rời',
                    'Phủ bọt trung tính và vệ sinh thân xe bên ngoài',
                    'Vệ sinh lưới tản nhiệt, khe thân xe, bánh xe và phần thân dưới',
                    'Xả sạch và lau khô xe',
                    'Kiểm tra kính, cổng sạc và bề mặt bên ngoài trước khi bàn giao',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'CAR_INTERIOR_VACUUM_CLEANING',
        name: 'Hút bụi và vệ sinh nội thất',
        vehicle_type: VEHICLE_TYPES.CAR,
        service_type: SERVICE_PACKAGE_TYPES.ADDON,
        description: 'Manual interior vacuuming and basic cabin cleaning service.',
        base_price: 100000,
        duration_minutes: 105,
        wash_bay_duration_minutes: 0,
        points_earned: 8,
        requires_wash_bay: false,
        steps_template: [
            {
                step_code: 'INTERIOR_VACUUM_CLEANING',
                step_name: 'Quy trình hút bụi và vệ sinh nội thất',
                order: 1,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Tháo thảm sàn cẩn thận',
                    'Hút bụi ghế, sàn xe và khoang hành lý',
                    'Vệ sinh bảng điều khiển và các bề mặt thường chạm',
                    'Vệ sinh thảm sàn và đặt lại đúng vị trí',
                    'Kiểm tra nội thất lần cuối',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'CAR_GLASS_STAIN_REMOVAL',
        name: 'Tẩy mốc và vết ố kính',
        vehicle_type: VEHICLE_TYPES.CAR,
        service_type: SERVICE_PACKAGE_TYPES.ADDON,
        description: 'Manual glass mold and stain removal service for cars.',
        base_price: 150000,
        duration_minutes: 30,
        wash_bay_duration_minutes: 0,
        points_earned: 12,
        requires_wash_bay: false,
        steps_template: [
            {
                step_code: 'GLASS_STAIN_REMOVAL',
                step_name: 'Quy trình tẩy mốc và vết ố kính',
                order: 1,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Kiểm tra tình trạng bề mặt kính',
                    'Sử dụng dung dịch vệ sinh kính phù hợp',
                    'Tẩy mốc và vết ố nước cẩn thận',
                    'Lau sạch bề mặt kính',
                    'Kiểm tra độ trong của kính lần cuối',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'CAR_HEADLIGHT_POLISHING',
        name: 'Đánh bóng đèn pha',
        vehicle_type: VEHICLE_TYPES.CAR,
        service_type: SERVICE_PACKAGE_TYPES.ADDON,
        description: 'Manual headlight polishing service for cars.',
        base_price: 180000,
        duration_minutes: 35,
        wash_bay_duration_minutes: 0,
        points_earned: 14,
        requires_wash_bay: false,
        steps_template: [
            {
                step_code: 'HEADLIGHT_POLISHING',
                step_name: 'Quy trình đánh bóng đèn pha',
                order: 1,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Kiểm tra tình trạng bề mặt đèn pha',
                    'Vệ sinh bề mặt đèn pha trước khi đánh bóng',
                    'Đánh bóng đều bề mặt đèn pha',
                    'Lau sạch phần dư và kiểm tra độ trong',
                    'Ghi chú nếu phát hiện hư hỏng',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'CAR_WINDSHIELD_POLISHING_WATER_REPELLENT',
        name: 'Đánh bóng kính lái và phủ chống bám nước',
        vehicle_type: VEHICLE_TYPES.CAR,
        service_type: SERVICE_PACKAGE_TYPES.ADDON,
        description: 'Manual windshield polishing and water repellent coating service.',
        base_price: 250000,
        duration_minutes: 45,
        wash_bay_duration_minutes: 0,
        points_earned: 20,
        requires_wash_bay: false,
        steps_template: [
            {
                step_code: 'WINDSHIELD_POLISHING_WATER_REPELLENT',
                step_name: 'Quy trình đánh bóng kính lái và phủ chống bám nước',
                order: 1,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Kiểm tra tình trạng bề mặt kính lái',
                    'Vệ sinh kính lái trước khi đánh bóng',
                    'Đánh bóng đều kính lái',
                    'Phủ lớp chống bám nước',
                    'Kiểm tra độ trong và khả năng thoát nước lần cuối',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'CAR_TAR_ADHESIVE_REMOVAL',
        name: 'Tẩy nhựa đường và keo dính',
        vehicle_type: VEHICLE_TYPES.CAR,
        service_type: SERVICE_PACKAGE_TYPES.ADDON,
        description: 'Manual tar, adhesive, and road grime removal service.',
        base_price: 200000,
        duration_minutes: 40,
        wash_bay_duration_minutes: 0,
        points_earned: 16,
        requires_wash_bay: false,
        steps_template: [
            {
                step_code: 'TAR_ADHESIVE_REMOVAL',
                step_name: 'Quy trình tẩy nhựa đường và keo dính',
                order: 1,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Kiểm tra các khu vực bên ngoài bị bám bẩn',
                    'Sử dụng dung dịch tẩy phù hợp lên vết nhựa đường và keo dính',
                    'Loại bỏ cặn bám cẩn thận để không làm hỏng sơn',
                    'Lau sạch các khu vực đã xử lý',
                    'Kiểm tra bề mặt bên ngoài lần cuối',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'CAR_IRON_FALLOUT_REMOVAL',
        name: 'Tẩy bụi sắt bám sơn',
        vehicle_type: VEHICLE_TYPES.CAR,
        service_type: SERVICE_PACKAGE_TYPES.ADDON,
        description: 'Manual iron fallout and metal particle removal service.',
        base_price: 220000,
        duration_minutes: 45,
        wash_bay_duration_minutes: 0,
        points_earned: 18,
        requires_wash_bay: false,
        steps_template: [
            {
                step_code: 'IRON_FALLOUT_REMOVAL',
                step_name: 'Quy trình tẩy bụi sắt bám sơn',
                order: 1,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Kiểm tra bề mặt bên ngoài để phát hiện hạt kim loại',
                    'Sử dụng dung dịch tẩy bụi sắt an toàn',
                    'Chờ phản ứng hóa chất theo hướng dẫn sản phẩm',
                    'Lau và xả sạch các bề mặt đã xử lý cẩn thận',
                    'Kiểm tra bề mặt bên ngoài lần cuối',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'CAR_ENGINE_BAY_CLEANING',
        name: 'Vệ sinh khoang động cơ',
        vehicle_type: VEHICLE_TYPES.CAR,
        service_type: SERVICE_PACKAGE_TYPES.ADDON,
        description: 'Manual engine bay cleaning service.',
        base_price: 300000,
        duration_minutes: 120,
        wash_bay_duration_minutes: 0,
        points_earned: 25,
        requires_wash_bay: false,
        steps_template: [
            {
                step_code: 'ENGINE_BAY_CLEANING',
                step_name: 'Quy trình vệ sinh khoang động cơ',
                order: 1,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Kiểm tra tình trạng khoang động cơ trước khi vệ sinh',
                    'Che chắn các bộ phận điện nhạy cảm',
                    'Sử dụng dung dịch vệ sinh phù hợp',
                    'Vệ sinh cẩn thận các bề mặt nhìn thấy trong khoang động cơ',
                    'Làm khô khu vực đã xử lý và kiểm tra an toàn lần cuối',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'CAR_AC_SYSTEM_CLEANING',
        name: 'Vệ sinh hệ thống điều hòa',
        vehicle_type: VEHICLE_TYPES.CAR,
        service_type: SERVICE_PACKAGE_TYPES.ADDON,
        description: 'Manual AC system cleaning support service.',
        base_price: 350000,
        duration_minutes: 60,
        wash_bay_duration_minutes: 0,
        points_earned: 28,
        requires_wash_bay: false,
        steps_template: [
            {
                step_code: 'AC_SYSTEM_CLEANING',
                step_name: 'Quy trình vệ sinh hệ thống điều hòa',
                order: 1,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Xác nhận yêu cầu khách hàng và ghi chú tình trạng điều hòa',
                    'Chuẩn bị thiết bị và vật tư vệ sinh điều hòa',
                    'Vệ sinh các khu vực có thể tiếp cận theo quy trình',
                    'Chạy kiểm tra điều hòa sau khi vệ sinh',
                    'Ghi chú dịch vụ cuối cùng nếu cần',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'CAR_UVC_SANITIZING',
        name: 'Khử khuẩn bề mặt nội thất bằng UVC',
        vehicle_type: VEHICLE_TYPES.CAR,
        service_type: SERVICE_PACKAGE_TYPES.ADDON,
        description: 'Manual UVC interior surface sanitizing service.',
        base_price: 180000,
        duration_minutes: 25,
        wash_bay_duration_minutes: 0,
        points_earned: 14,
        requires_wash_bay: false,
        steps_template: [
            {
                step_code: 'UVC_INTERIOR_SANITIZING',
                step_name: 'Quy trình khử khuẩn bề mặt nội thất bằng UVC',
                order: 1,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Xác nhận khoang xe đã được dọn trống',
                    'Đặt thiết bị UVC theo quy trình an toàn',
                    'Chạy chu trình khử khuẩn đủ thời lượng yêu cầu',
                    'Thu dọn thiết bị an toàn',
                    'Ghi nhận hoàn tất',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'CAR_OZONE_ODOR_TREATMENT',
        name: 'Khử mùi và diệt khuẩn bằng ozone',
        vehicle_type: VEHICLE_TYPES.CAR,
        service_type: SERVICE_PACKAGE_TYPES.ADDON,
        description: 'Manual ozone odor and bacteria treatment service.',
        base_price: 200000,
        duration_minutes: 30,
        wash_bay_duration_minutes: 0,
        points_earned: 16,
        requires_wash_bay: false,
        steps_template: [
            {
                step_code: 'OZONE_ODOR_TREATMENT',
                step_name: 'Quy trình khử mùi và diệt khuẩn bằng ozone',
                order: 1,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Xác nhận khoang xe đã được dọn trống',
                    'Đặt thiết bị ozone theo quy trình an toàn',
                    'Chạy chu trình xử lý ozone đủ thời lượng yêu cầu',
                    'Thông gió khoang xe sau khi xử lý',
                    'Ghi nhận hoàn tất',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'MOTORBIKE_WASH_OIL_COMBO',
        name: 'Motorbike Wash And Oil Change Combo',
        vehicle_type: VEHICLE_TYPES.MOTORBIKE,
        service_type: SERVICE_PACKAGE_TYPES.COMBO,
        description: 'Motorbike wash combined with oil change.',
        base_price: 140000,
        points_earned: 14,
        included_service_keys: [
            'MOTORBIKE_STANDARD_WASH',
            'MOTORBIKE_OIL_CHANGE',
        ],
        steps_template: [
            {
                step_code: 'MOTORBIKE_COMBO_WASH',
                step_name: 'Quy trình rửa xe máy',
                order: 1,
                step_type: SERVICE_STEP_TYPES.AUTOMATED_WASH_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.WASH_OPERATOR,
                instructions: [
                    'Xác nhận thông tin đặt lịch và xe',
                    'Thực hiện quy trình rửa xe máy tiêu chuẩn',
                    'Lau khô xe trước bước dịch vụ thủ công',
                    'Kiểm tra bên ngoài lần cuối',
                ],
            },
            {
                step_code: 'MOTORBIKE_COMBO_OIL_CHANGE',
                step_name: 'Quy trình thay dầu xe máy',
                order: 2,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Xác nhận loại dầu và yêu cầu của khách hàng',
                    'Xả dầu cũ an toàn',
                    'Châm dầu mới theo yêu cầu của xe',
                    'Kiểm tra rò rỉ sau khi châm dầu',
                    'Ghi chú dịch vụ nếu cần',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'CAR_BASIC_CLEAN',
        name: 'Basic Clean',
        vehicle_type: VEHICLE_TYPES.CAR,
        service_type: SERVICE_PACKAGE_TYPES.COMBO,
        description: 'Premium wash, glass stain removal, headlight polishing, and interior cleaning.',
        base_price: 500000,
        points_earned: 45,
        included_service_keys: [
            'CAR_PREMIUM_WASH',
            'CAR_GLASS_STAIN_REMOVAL',
            'CAR_HEADLIGHT_POLISHING',
            'CAR_INTERIOR_VACUUM_CLEANING',
        ],
        steps_template: [
            {
                step_code: 'BASIC_CLEAN_WASH',
                step_name: 'Quy trình rửa ô tô cao cấp',
                order: 1,
                step_type: SERVICE_STEP_TYPES.AUTOMATED_WASH_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.WASH_OPERATOR,
                instructions: [
                    'Xác nhận thông tin đặt lịch và xe',
                    'Thực hiện quy trình rửa ô tô cao cấp',
                    'Giải phóng buồng rửa sau khi hoàn tất bước rửa',
                    'Kiểm tra rửa ngoại thất lần cuối',
                ],
            },
            {
                step_code: 'BASIC_CLEAN_GLASS_STAIN',
                step_name: 'Quy trình tẩy mốc và vết ố kính',
                order: 2,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Kiểm tra tình trạng bề mặt kính',
                    'Tẩy mốc và vết ố nước cẩn thận',
                    'Lau sạch bề mặt kính',
                    'Kiểm tra độ trong của kính lần cuối',
                ],
            },
            {
                step_code: 'BASIC_CLEAN_HEADLIGHT',
                step_name: 'Quy trình đánh bóng đèn pha',
                order: 3,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Kiểm tra tình trạng bề mặt đèn pha',
                    'Đánh bóng đều bề mặt đèn pha',
                    'Lau sạch phần dư và kiểm tra độ trong',
                    'Ghi chú nếu phát hiện hư hỏng',
                ],
            },
            {
                step_code: 'BASIC_CLEAN_INTERIOR',
                step_name: 'Quy trình hút bụi và vệ sinh nội thất',
                order: 4,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Tháo thảm sàn cẩn thận',
                    'Hút bụi ghế, sàn xe và khoang hành lý',
                    'Vệ sinh bảng điều khiển và các bề mặt thường chạm',
                    'Vệ sinh thảm sàn và kiểm tra nội thất lần cuối',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'CAR_DETAIL_CLEAN',
        name: 'Detail Clean',
        vehicle_type: VEHICLE_TYPES.CAR,
        service_type: SERVICE_PACKAGE_TYPES.COMBO,
        description: 'Basic Clean plus windshield polishing, tar removal, and iron fallout removal.',
        base_price: 950000,
        points_earned: 85,
        included_service_keys: [
            'CAR_PREMIUM_WASH',
            'CAR_GLASS_STAIN_REMOVAL',
            'CAR_HEADLIGHT_POLISHING',
            'CAR_INTERIOR_VACUUM_CLEANING',
            'CAR_WINDSHIELD_POLISHING_WATER_REPELLENT',
            'CAR_TAR_ADHESIVE_REMOVAL',
            'CAR_IRON_FALLOUT_REMOVAL',
        ],
        steps_template: [
            {
                step_code: 'DETAIL_CLEAN_WASH',
                step_name: 'Quy trình rửa ô tô cao cấp',
                order: 1,
                step_type: SERVICE_STEP_TYPES.AUTOMATED_WASH_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.WASH_OPERATOR,
                instructions: [
                    'Xác nhận thông tin đặt lịch và xe',
                    'Thực hiện quy trình rửa ô tô cao cấp',
                    'Giải phóng buồng rửa sau khi hoàn tất bước rửa',
                    'Kiểm tra rửa ngoại thất lần cuối',
                ],
            },
            {
                step_code: 'DETAIL_CLEAN_BASIC_MANUAL',
                step_name: 'Quy trình chăm sóc thủ công cơ bản',
                order: 2,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Tẩy mốc kính và vết ố nước',
                    'Đánh bóng đều đèn pha',
                    'Hút bụi và vệ sinh khoang nội thất',
                    'Kiểm tra chất lượng trực quan cho các hạng mục cơ bản',
                ],
            },
            {
                step_code: 'DETAIL_CLEAN_ADVANCED_MANUAL',
                step_name: 'Quy trình chăm sóc ngoại thất nâng cao',
                order: 3,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Đánh bóng kính lái và phủ chống bám nước',
                    'Tẩy cặn nhựa đường và keo dính cẩn thận',
                    'Tẩy bụi sắt và hạt kim loại',
                    'Kiểm tra bề mặt bên ngoài lần cuối',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'CAR_ULTIMATE_CLEAN',
        name: 'Ultimate Clean',
        vehicle_type: VEHICLE_TYPES.CAR,
        service_type: SERVICE_PACKAGE_TYPES.COMBO,
        description: 'Detail Clean plus engine bay cleaning and AC system cleaning.',
        base_price: 1500000,
        points_earned: 140,
        included_service_keys: [
            'CAR_PREMIUM_WASH',
            'CAR_GLASS_STAIN_REMOVAL',
            'CAR_HEADLIGHT_POLISHING',
            'CAR_INTERIOR_VACUUM_CLEANING',
            'CAR_WINDSHIELD_POLISHING_WATER_REPELLENT',
            'CAR_TAR_ADHESIVE_REMOVAL',
            'CAR_IRON_FALLOUT_REMOVAL',
            'CAR_ENGINE_BAY_CLEANING',
            'CAR_AC_SYSTEM_CLEANING',
        ],
        steps_template: [
            {
                step_code: 'ULTIMATE_CLEAN_WASH',
                step_name: 'Quy trình rửa ô tô cao cấp',
                order: 1,
                step_type: SERVICE_STEP_TYPES.AUTOMATED_WASH_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.WASH_OPERATOR,
                instructions: [
                    'Xác nhận thông tin đặt lịch và xe',
                    'Thực hiện quy trình rửa ô tô cao cấp',
                    'Giải phóng buồng rửa sau khi hoàn tất bước rửa',
                    'Kiểm tra rửa ngoại thất lần cuối',
                ],
            },
            {
                step_code: 'ULTIMATE_CLEAN_DETAIL_MANUAL',
                step_name: 'Quy trình chăm sóc thủ công chi tiết',
                order: 2,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Hoàn tất các hạng mục kính, đèn pha, nội thất và ngoại thất nâng cao',
                    'Kiểm tra các bề mặt đã xử lý trước khi chuyển sang khoang động cơ và điều hòa',
                    'Ghi chú dịch vụ nếu phát hiện tình trạng bất thường',
                ],
            },
            {
                step_code: 'ULTIMATE_CLEAN_ENGINE_AC',
                step_name: 'Quy trình vệ sinh khoang động cơ và hệ thống điều hòa',
                order: 3,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Che chắn các bộ phận nhạy cảm trước khi vệ sinh khoang động cơ',
                    'Vệ sinh cẩn thận các bề mặt nhìn thấy trong khoang động cơ',
                    'Vệ sinh các khu vực hệ thống điều hòa theo quy trình',
                    'Kiểm tra an toàn và chức năng lần cuối',
                ],
            },
        ],
        is_active: true,
    },
    {
        key: 'CAR_SUPER_CLEAN',
        name: 'Super Clean',
        vehicle_type: VEHICLE_TYPES.CAR,
        service_type: SERVICE_PACKAGE_TYPES.COMBO,
        description: 'Ultimate Clean plus UVC sanitizing and ozone odor treatment.',
        base_price: 1850000,
        points_earned: 180,
        included_service_keys: [
            'CAR_PREMIUM_WASH',
            'CAR_GLASS_STAIN_REMOVAL',
            'CAR_HEADLIGHT_POLISHING',
            'CAR_INTERIOR_VACUUM_CLEANING',
            'CAR_WINDSHIELD_POLISHING_WATER_REPELLENT',
            'CAR_TAR_ADHESIVE_REMOVAL',
            'CAR_IRON_FALLOUT_REMOVAL',
            'CAR_ENGINE_BAY_CLEANING',
            'CAR_AC_SYSTEM_CLEANING',
            'CAR_UVC_SANITIZING',
            'CAR_OZONE_ODOR_TREATMENT',
        ],
        steps_template: [
            {
                step_code: 'SUPER_CLEAN_WASH',
                step_name: 'Quy trình rửa ô tô cao cấp',
                order: 1,
                step_type: SERVICE_STEP_TYPES.AUTOMATED_WASH_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.WASH_OPERATOR,
                instructions: [
                    'Xác nhận thông tin đặt lịch và xe',
                    'Thực hiện quy trình rửa ô tô cao cấp',
                    'Giải phóng buồng rửa sau khi hoàn tất bước rửa',
                    'Kiểm tra rửa ngoại thất lần cuối',
                ],
            },
            {
                step_code: 'SUPER_CLEAN_ULTIMATE_MANUAL',
                step_name: 'Quy trình chăm sóc thủ công Ultimate',
                order: 2,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Hoàn tất các hạng mục chăm sóc thủ công chi tiết',
                    'Hoàn tất hạng mục vệ sinh khoang động cơ',
                    'Hoàn tất hạng mục vệ sinh hệ thống điều hòa',
                    'Ghi chú dịch vụ nếu phát hiện tình trạng bất thường',
                ],
            },
            {
                step_code: 'SUPER_CLEAN_SANITIZING',
                step_name: 'Quy trình khử khuẩn nội thất và xử lý mùi',
                order: 3,
                step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
                is_required: true,
                display_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
                instructions: [
                    'Xác nhận khoang xe đã được dọn trống',
                    'Chạy chu trình khử khuẩn UVC an toàn',
                    'Chạy chu trình xử lý mùi bằng ozone an toàn',
                    'Thông gió khoang xe sau khi xử lý',
                    'Kiểm tra khoang xe lần cuối trước khi bàn giao',
                ],
            },
        ],
        is_active: true,
    },
];

const hasVehicleCareStaffStep = (definition) => {
    return (definition.steps_template || []).some((step) => {
        return step.display_staff_type === STAFF_TYPES.VEHICLE_CARE_STAFF;
    });
};

const getDefinitionTransitionMode = (definition) => {
    if (definition.service_type === SERVICE_PACKAGE_TYPES.COMBO) {
        return SERVICE_TRANSITION_MODES.REQUIRE_CONFIRMATION;
    }

    const requiredSteps = (definition.steps_template || []).filter((step) => step.is_required !== false);
    const isAutomated = requiredSteps.length > 0
        ? requiredSteps.every((step) => step.step_type === SERVICE_STEP_TYPES.AUTOMATED_WASH_STEP)
        : definition.requires_wash_bay && !getDefinitionRequiresCareStaff(definition);

    return isAutomated
        ? SERVICE_TRANSITION_MODES.AUTO
        : SERVICE_TRANSITION_MODES.REQUIRE_CONFIRMATION;
};

const getDefinitionRequiresCareStaff = (definition) => {
    return definition.requires_care_staff !== undefined
        ? definition.requires_care_staff
        : hasVehicleCareStaffStep(definition);
};

const buildDefinitionResourceWindow = (definitions, resourcePrefix) => {
    let elapsedMinutes = 0;
    let startOffsetMinutes = null;
    let endOffsetMinutes = null;

    for (const definition of definitions) {
        const requiresResource = resourcePrefix === 'wash_bay'
            ? Boolean(definition.requires_wash_bay)
            : getDefinitionRequiresCareStaff(definition);

        if (requiresResource) {
            const resourceStartOffset = elapsedMinutes + (definition[`${resourcePrefix}_start_offset_minutes`] || 0);
            const resourceEndOffset = resourceStartOffset
                + (definition[`${resourcePrefix}_duration_minutes`] || definition.duration_minutes);

            startOffsetMinutes = startOffsetMinutes === null
                ? resourceStartOffset
                : Math.min(startOffsetMinutes, resourceStartOffset);
            endOffsetMinutes = endOffsetMinutes === null
                ? resourceEndOffset
                : Math.max(endOffsetMinutes, resourceEndOffset);
        }

        elapsedMinutes += definition.duration_minutes;
    }

    return {
        startOffsetMinutes: startOffsetMinutes || 0,
        durationMinutes: startOffsetMinutes === null ? 0 : endOffsetMinutes - startOffsetMinutes,
    };
};

const synchronizeComboDefinitions = () => {
    const definitionByKey = new Map(packageDefinitions.map((item) => [item.key, item]));

    for (const definition of packageDefinitions) {
        if (definition.service_type !== SERVICE_PACKAGE_TYPES.COMBO) {
            continue;
        }

        const childDefinitions = (definition.included_service_keys || []).map((key) => {
            const childDefinition = definitionByKey.get(key);

            if (!childDefinition) {
                throw new Error(`Missing included service definition for key: ${key}`);
            }

            return childDefinition;
        });
        const washBayWindow = buildDefinitionResourceWindow(childDefinitions, 'wash_bay');
        const careStaffWindow = buildDefinitionResourceWindow(childDefinitions, 'care_staff');
        const careStaffDefinitions = childDefinitions.filter((item) => getDefinitionRequiresCareStaff(item));

        definition.duration_minutes = childDefinitions.reduce((total, item) => total + item.duration_minutes, 0);
        definition.requires_wash_bay = washBayWindow.durationMinutes > 0;
        definition.wash_bay_start_offset_minutes = washBayWindow.startOffsetMinutes;
        definition.wash_bay_duration_minutes = washBayWindow.durationMinutes;
        definition.requires_care_staff = careStaffWindow.durationMinutes > 0;
        definition.care_staff_type = careStaffDefinitions[0]?.care_staff_type || STAFF_TYPES.VEHICLE_CARE_STAFF;
        definition.care_staff_required_count = careStaffDefinitions.length > 0
            ? Math.max(...careStaffDefinitions.map((item) => item.care_staff_required_count || 1))
            : 0;
        definition.care_staff_start_offset_minutes = careStaffWindow.startOffsetMinutes;
        definition.care_staff_duration_minutes = careStaffWindow.durationMinutes;
    }
};

const toSeedPayload = (definition, idByKey) => {
    const includedServiceIds = (definition.included_service_keys || []).map((key) => {
        const serviceId = idByKey.get(key);

        if (!serviceId) {
            throw new Error(`Missing included service for key: ${key}`);
        }

        return serviceId;
    });
    const requiresCareStaff = definition.requires_care_staff !== undefined
        ? definition.requires_care_staff
        : hasVehicleCareStaffStep(definition);
    const requiresWashBay = Boolean(definition.requires_wash_bay);

    return {
        name: definition.name,
        vehicle_type: definition.vehicle_type,
        service_type: definition.service_type,
        description: definition.description,
        base_price: definition.base_price,
        duration_minutes: definition.duration_minutes,
        countdown_duration_seconds: definition.countdown_duration_seconds || definition.duration_minutes * 60,
        transition_mode: definition.transition_mode || getDefinitionTransitionMode(definition),
        wash_bay_duration_minutes: definition.wash_bay_duration_minutes,
        wash_bay_start_offset_minutes: requiresWashBay
            ? definition.wash_bay_start_offset_minutes || 0
            : 0,
        points_earned: definition.points_earned,
        requires_wash_bay: requiresWashBay,
        requires_care_staff: requiresCareStaff,
        care_staff_type: requiresCareStaff
            ? definition.care_staff_type || STAFF_TYPES.VEHICLE_CARE_STAFF
            : null,
        care_staff_required_count: requiresCareStaff
            ? definition.care_staff_required_count || 1
            : 0,
        care_staff_duration_minutes: requiresCareStaff
            ? definition.care_staff_duration_minutes || definition.duration_minutes
            : 0,
        care_staff_start_offset_minutes: requiresCareStaff
            ? definition.care_staff_start_offset_minutes || 0
            : 0,
        allow_duplicate_in_booking: definition.allow_duplicate_in_booking || false,
        included_service_ids: includedServiceIds,
        steps_template: definition.service_type === SERVICE_PACKAGE_TYPES.COMBO
            ? []
            : definition.steps_template,
        is_active: definition.is_active,
    };
};

const upsertPackage = async (definition, idByKey) => {
    const payload = toSeedPayload(definition, idByKey);

    const servicePackage = await ServicePackage.findOneAndUpdate(
        {
            name: payload.name,
            vehicle_type: payload.vehicle_type,
        },
        {
            $set: payload,
        },
        {
            new: true,
            upsert: true,
            runValidators: true,
            setDefaultsOnInsert: true,
        }
    );

    idByKey.set(definition.key, servicePackage._id);

    console.log(`Seeded service package: ${servicePackage.name}`);

    return servicePackage;
};

const seedServicePackage = async () => {
    console.log('== Seeding service packages ==');

    synchronizeComboDefinitions();

    const idByKey = new Map();
    const basePackages = packageDefinitions.filter(
        (item) => item.service_type !== SERVICE_PACKAGE_TYPES.COMBO
    );
    const comboPackages = packageDefinitions.filter(
        (item) => item.service_type === SERVICE_PACKAGE_TYPES.COMBO
    );

    for (const definition of basePackages) {
        await upsertPackage(definition, idByKey);
    }

    for (const definition of comboPackages) {
        await upsertPackage(definition, idByKey);
    }

    console.log('Service packages seeding completed');
};

module.exports = seedServicePackage;
