const { STAFF_TYPES } = require('../shared/constants/staff.constant');
const {
    VEHICLE_TYPES,
    ENGINE_TYPES,
    MOTORBIKE_CC_GROUPS,
    CAR_BODY_TYPES,
} = require('../shared/constants/vehicle.constant');
const {
    SERVICE_PACKAGE_TYPES,
    SERVICE_STEP_TYPES,
    SERVICE_TRANSITION_MODES,
} = require('../shared/constants/servicePackage.constant');
const { atLocalDayAndMinute } = require('./seedTime');

const profile = (code, dimensions = {}) => ({
    code,
    engine_type: dimensions.engine_type || null,
    motorbike_cc_group: dimensions.motorbike_cc_group || null,
    car_body_type: dimensions.car_body_type || null,
    seat_min: dimensions.seat_min ?? null,
    seat_max: dimensions.seat_max ?? null,
});

const MOTORBIKE_GAS_UNDER_175 = Object.freeze([
    profile('GAS_UNDER_175CC', {
        engine_type: ENGINE_TYPES.GASOLINE,
        motorbike_cc_group: MOTORBIKE_CC_GROUPS.UNDER_175CC,
    }),
]);
const MOTORBIKE_GAS_OVER_175 = Object.freeze([
    profile('GAS_OVER_175CC', {
        engine_type: ENGINE_TYPES.GASOLINE,
        motorbike_cc_group: MOTORBIKE_CC_GROUPS.OVER_175CC,
    }),
]);
const MOTORBIKE_GAS_ALL_CC = Object.freeze([
    profile('GAS_ALL_CC', {
        engine_type: ENGINE_TYPES.GASOLINE,
    }),
]);
const MOTORBIKE_ELECTRIC = Object.freeze([
    profile('ELECTRIC', {
        engine_type: ENGINE_TYPES.ELECTRIC,
    }),
]);
const ALL_VEHICLES_OF_TYPE = Object.freeze([
    profile('ALL'),
]);
const CAR_GAS_SMALL = Object.freeze([
    profile('GAS_HATCHBACK', {
        engine_type: ENGINE_TYPES.GASOLINE,
        car_body_type: CAR_BODY_TYPES.HATCHBACK,
    }),
    profile('GAS_SEDAN', {
        engine_type: ENGINE_TYPES.GASOLINE,
        car_body_type: CAR_BODY_TYPES.SEDAN,
    }),
]);
const CAR_GAS_LARGE = Object.freeze([
    profile('GAS_SUV', {
        engine_type: ENGINE_TYPES.GASOLINE,
        car_body_type: CAR_BODY_TYPES.SUV,
    }),
    profile('GAS_MPV', {
        engine_type: ENGINE_TYPES.GASOLINE,
        car_body_type: CAR_BODY_TYPES.MPV,
    }),
    profile('GAS_PICKUP', {
        engine_type: ENGINE_TYPES.GASOLINE,
        car_body_type: CAR_BODY_TYPES.PICKUP,
    }),
    profile('GAS_VAN', {
        engine_type: ENGINE_TYPES.GASOLINE,
        car_body_type: CAR_BODY_TYPES.VAN,
    }),
]);
const CAR_ELECTRIC = Object.freeze([
    profile('ELECTRIC', {
        engine_type: ENGINE_TYPES.ELECTRIC,
    }),
]);
const CAR_GAS_ALL = Object.freeze([
    profile('GAS_ALL', {
        engine_type: ENGINE_TYPES.GASOLINE,
    }),
]);

const buildStep = ({
    serviceCode,
    name,
    instructions,
    automated = false,
    staffType,
}) => ({
    step_code: `${serviceCode}_STEP`,
    step_name: name,
    order: 1,
    step_type: automated
        ? SERVICE_STEP_TYPES.AUTOMATED_WASH_STEP
        : SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
    is_required: true,
    display_staff_type: staffType,
    instructions,
});

const buildWashPackage = ({
    serviceCode,
    name,
    description,
    price,
    duration,
    points,
    vehicleType,
    instructions,
    pricingProfiles,
    washBayDuration = duration,
    automated = true,
}) => ({
    service_code: serviceCode,
    name,
    description,
    base_price: price,
    duration_minutes: duration,
    points_earned: points,
    vehicle_type: vehicleType,
    service_type: SERVICE_PACKAGE_TYPES.WASH,
    transition_mode: automated
        ? SERVICE_TRANSITION_MODES.AUTO
        : SERVICE_TRANSITION_MODES.REQUIRE_CONFIRMATION,
    requires_wash_bay: washBayDuration > 0,
    wash_bay_duration_minutes: washBayDuration,
    wash_bay_start_offset_minutes: 0,
    requires_care_staff: !automated,
    care_staff_type: automated ? null : STAFF_TYPES.WASH_OPERATOR,
    care_staff_required_count: automated ? 0 : 1,
    care_staff_duration_minutes: automated ? 0 : duration,
    care_staff_start_offset_minutes: 0,
    steps_template: [
        buildStep({
            serviceCode,
            name,
            instructions,
            automated,
            staffType: STAFF_TYPES.WASH_OPERATOR,
        }),
    ],
    pricing_profiles: pricingProfiles,
    is_active: true,
});

const buildAddonPackage = ({
    serviceCode,
    name,
    description,
    price,
    duration,
    points,
    vehicleType,
    instructions,
    pricingProfiles,
    staffCount = 1,
}) => ({
    service_code: serviceCode,
    name,
    description,
    base_price: price,
    duration_minutes: duration,
    points_earned: points,
    vehicle_type: vehicleType,
    service_type: SERVICE_PACKAGE_TYPES.ADDON,
    transition_mode: SERVICE_TRANSITION_MODES.REQUIRE_CONFIRMATION,
    requires_wash_bay: false,
    wash_bay_duration_minutes: 0,
    wash_bay_start_offset_minutes: 0,
    requires_care_staff: true,
    care_staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
    care_staff_required_count: staffCount,
    care_staff_duration_minutes: duration,
    care_staff_start_offset_minutes: 0,
    steps_template: [
        buildStep({
            serviceCode,
            name,
            instructions,
            staffType: STAFF_TYPES.VEHICLE_CARE_STAFF,
        }),
    ],
    pricing_profiles: pricingProfiles,
    is_active: true,
});

const buildComboPackage = ({
    serviceCode,
    name,
    description,
    price,
    points,
    vehicleType,
    includedServiceCodes,
    pricingProfiles,
}) => ({
    service_code: serviceCode,
    name,
    description,
    base_price: price,
    points_earned: points,
    vehicle_type: vehicleType,
    service_type: SERVICE_PACKAGE_TYPES.COMBO,
    transition_mode: SERVICE_TRANSITION_MODES.REQUIRE_CONFIRMATION,
    included_service_codes: includedServiceCodes,
    steps_template: [],
    pricing_profiles: pricingProfiles,
    is_active: true,
});

const SERVICE_PACKAGE_BLUEPRINTS = Object.freeze([
    buildWashPackage({
        serviceCode: 'MOTORBIKE_WASH_BASIC',
        name: 'Rửa xe máy tiêu chuẩn',
        description: 'Rửa ngoại thất cơ bản dành cho xe máy xăng dưới 175cc.',
        price: 30000,
        duration: 15,
        points: 5,
        vehicleType: VEHICLE_TYPES.MOTORBIKE,
        pricingProfiles: MOTORBIKE_GAS_UNDER_175,
        instructions: [
            'Xác nhận thông tin đặt lịch và xe',
            'Xịt nước sơ bộ để loại bỏ bụi bẩn rời',
            'Phủ bọt trung tính và vệ sinh thân xe',
            'Vệ sinh bánh xe và phần thân dưới',
            'Xả sạch và lau khô xe',
            'Kiểm tra trực quan trước khi bàn giao',
        ],
    }),
    buildWashPackage({
        serviceCode: 'MOTORBIKE_WASH_PREMIUM',
        name: 'Rửa xe máy cao cấp',
        description: 'Rửa chi tiết dành cho xe máy xăng dưới 175cc.',
        price: 55000,
        duration: 30,
        points: 8,
        vehicleType: VEHICLE_TYPES.MOTORBIKE,
        pricingProfiles: MOTORBIKE_GAS_UNDER_175,
        instructions: [
            'Che chắn khu vực nhạy cảm nếu cần',
            'Xịt nước sơ bộ để loại bỏ bụi bẩn rời',
            'Phủ bọt trung tính và vệ sinh các khe nhỏ',
            'Vệ sinh kỹ bánh xe và phần thân dưới',
            'Xả sạch và lau khô chi tiết',
            'Kiểm tra trực quan lần cuối',
        ],
    }),
    buildWashPackage({
        serviceCode: 'MOTORBIKE_WASH_BIG',
        name: 'Rửa xe máy phân khối lớn',
        description: 'Rửa thủ công cẩn thận dành cho xe máy xăng từ 175cc trở lên.',
        price: 120000,
        duration: 45,
        points: 15,
        vehicleType: VEHICLE_TYPES.MOTORBIKE,
        pricingProfiles: MOTORBIKE_GAS_OVER_175,
        automated: false,
        instructions: [
            'Che chắn cổng sạc và lỗ thoát khí nếu có',
            'Xịt nước sơ bộ với áp lực phù hợp',
            'Phủ bọt trung tính và vệ sinh chi tiết từng bộ phận',
            'Vệ sinh vành, phanh, xích và phuộc',
            'Xả sạch và thổi khô từng khe',
            'Kiểm tra trực quan trước khi bàn giao',
        ],
    }),
    buildWashPackage({
        serviceCode: 'MOTORBIKE_WASH_ELECTRIC',
        name: 'Rửa xe máy điện',
        description: 'Rửa thủ công an toàn dành riêng cho xe máy điện.',
        price: 45000,
        duration: 20,
        points: 7,
        vehicleType: VEHICLE_TYPES.MOTORBIKE,
        pricingProfiles: MOTORBIKE_ELECTRIC,
        washBayDuration: 0,
        automated: false,
        instructions: [
            'Che chắn cổng sạc, cổng USB và màn hình',
            'Không xịt trực tiếp vào các cổng điện',
            'Vệ sinh thân xe bằng vải ẩm và tia nước nhẹ',
            'Vệ sinh bánh xe và vành',
            'Thổi khô và kiểm tra an toàn điện lần cuối',
        ],
    }),
    buildAddonPackage({
        serviceCode: 'MOTORBIKE_OIL_CHANGE',
        name: 'Thay dầu nhớt xe máy',
        description: 'Bảo dưỡng nhẹ do nhân viên chăm sóc xe đã được đào tạo thực hiện.',
        price: 120000,
        duration: 20,
        points: 10,
        vehicleType: VEHICLE_TYPES.MOTORBIKE,
        pricingProfiles: MOTORBIKE_GAS_ALL_CC,
        instructions: [
            'Xác nhận loại dầu và yêu cầu của khách',
            'Xả dầu cũ đúng quy trình an toàn',
            'Châm dầu mới đúng chủng loại và dung tích',
            'Kiểm tra rò rỉ sau khi châm',
            'Ghi nhận nếu phát hiện bất thường',
        ],
    }),
    buildAddonPackage({
        serviceCode: 'MOTORBIKE_OIL_FILTER',
        name: 'Thay dầu và lọc nhớt xe máy',
        description: 'Thay dầu và lọc nhớt do nhân viên chăm sóc xe đã được đào tạo thực hiện.',
        price: 180000,
        duration: 30,
        points: 14,
        vehicleType: VEHICLE_TYPES.MOTORBIKE,
        pricingProfiles: MOTORBIKE_GAS_ALL_CC,
        instructions: [
            'Xác nhận loại dầu và loại lọc phù hợp',
            'Xả dầu cũ và tháo lọc nhớt cũ',
            'Lắp lọc nhớt mới và châm dầu mới',
            'Kiểm tra rò rỉ sau khi hoàn tất',
            'Ghi nhận nếu cần tư vấn thêm',
        ],
    }),
    buildAddonPackage({
        serviceCode: 'MOTORBIKE_CHAIN_CARE',
        name: 'Vệ sinh và bôi trơn xích',
        description: 'Làm sạch, bôi trơn và kiểm tra độ căng xích xe máy xăng.',
        price: 80000,
        duration: 20,
        points: 6,
        vehicleType: VEHICLE_TYPES.MOTORBIKE,
        pricingProfiles: MOTORBIKE_GAS_ALL_CC,
        instructions: [
            'Làm sạch bụi bẩn bám trên xích',
            'Làm khô xích hoàn toàn',
            'Bôi trơn đều các mắt xích',
            'Lau sạch phần dung dịch dư',
            'Kiểm tra và ghi nhận độ căng xích',
        ],
    }),
    buildAddonPackage({
        serviceCode: 'MOTORBIKE_BRAKE_CHECK',
        name: 'Kiểm tra phanh xe máy',
        description: 'Kiểm tra trực quan hệ thống phanh cho xe máy xăng và xe máy điện.',
        price: 60000,
        duration: 15,
        points: 5,
        vehicleType: VEHICLE_TYPES.MOTORBIKE,
        pricingProfiles: ALL_VEHICLES_OF_TYPE,
        instructions: [
            'Kiểm tra má phanh trước và sau',
            'Kiểm tra tay phanh hoặc chân phanh',
            'Kiểm tra độ căng cáp phanh nếu có',
            'Ghi nhận tình trạng và tư vấn khách',
        ],
    }),
    buildAddonPackage({
        serviceCode: 'MOTORBIKE_FULL_DETAIL',
        name: 'Dọn dẹp toàn diện xe máy',
        description: 'Vệ sinh chi tiết và chăm sóc xích dành cho xe máy xăng.',
        price: 200000,
        duration: 60,
        points: 16,
        vehicleType: VEHICLE_TYPES.MOTORBIKE,
        pricingProfiles: MOTORBIKE_GAS_ALL_CC,
        instructions: [
            'Hút bụi yên xe và cốp xe',
            'Vệ sinh tay lái, công tơ mét và gương',
            'Vệ sinh các tấm che và lỗ thông gió',
            'Vệ sinh và bôi trơn xích',
            'Kiểm tra tổng quát trước khi bàn giao',
        ],
    }),
    buildAddonPackage({
        serviceCode: 'MOTORBIKE_TIRE_CHECK',
        name: 'Kiểm tra và bơm lốp xe máy',
        description: 'Kiểm tra áp suất và độ mòn lốp cho xe máy xăng và xe máy điện.',
        price: 30000,
        duration: 10,
        points: 3,
        vehicleType: VEHICLE_TYPES.MOTORBIKE,
        pricingProfiles: ALL_VEHICLES_OF_TYPE,
        instructions: [
            'Đo áp suất lốp trước và sau',
            'Bơm lốp đúng áp suất tiêu chuẩn',
            'Kiểm tra độ mòn gai lốp',
            'Ghi nhận nếu lốp cần sửa chữa hoặc thay thế',
        ],
    }),
    buildWashPackage({
        serviceCode: 'CAR_WASH_BASIC',
        name: 'Rửa ô tô nhanh',
        description: 'Rửa ngoại thất nhanh dành cho hatchback và sedan chạy xăng.',
        price: 80000,
        duration: 20,
        points: 8,
        vehicleType: VEHICLE_TYPES.CAR,
        pricingProfiles: CAR_GAS_SMALL,
        instructions: [
            'Xác nhận thông tin đặt lịch',
            'Kiểm tra tình trạng sơn trước khi rửa',
            'Xịt nước sơ bộ để loại bỏ bụi bẩn rời',
            'Phủ bọt trung tính toàn thân xe',
            'Vệ sinh bánh xe và phần dưới gầm',
            'Xả sạch và lau khô xe',
            'Kiểm tra trực quan trước khi bàn giao',
        ],
    }),
    buildWashPackage({
        serviceCode: 'CAR_WASH_STANDARD',
        name: 'Rửa ô tô tiêu chuẩn',
        description: 'Rửa ngoại thất chi tiết dành cho hatchback và sedan chạy xăng.',
        price: 120000,
        duration: 30,
        points: 12,
        vehicleType: VEHICLE_TYPES.CAR,
        pricingProfiles: CAR_GAS_SMALL,
        instructions: [
            'Xác nhận thông tin đặt lịch',
            'Che chắn khu vực nhạy cảm nếu cần',
            'Xịt nước sơ bộ để loại bỏ bụi bẩn rời',
            'Phủ bọt trung tính và vệ sinh kỹ thân xe',
            'Vệ sinh bánh xe, lưới tản nhiệt và khe cửa',
            'Xả sạch và lau khô tỉ mỉ',
            'Kiểm tra trực quan lần cuối',
        ],
    }),
    buildWashPackage({
        serviceCode: 'CAR_WASH_PREMIUM',
        name: 'Rửa ô tô cao cấp',
        description: 'Rửa và chăm sóc ngoại thất cao cấp dành cho hatchback và sedan chạy xăng.',
        price: 180000,
        duration: 45,
        points: 18,
        vehicleType: VEHICLE_TYPES.CAR,
        pricingProfiles: CAR_GAS_SMALL,
        instructions: [
            'Xác nhận thông tin đặt lịch',
            'Kiểm tra chi tiết tình trạng sơn',
            'Xịt nước sơ bộ và phủ bọt hai lần',
            'Vệ sinh lưới tản nhiệt, khe cửa và bánh xe',
            'Xả sạch và lau khô bằng vải microfiber',
            'Đánh bóng nhẹ các vết xước nhỏ nếu phù hợp',
            'Kiểm tra kính, đèn và gương trước khi bàn giao',
        ],
    }),
    buildWashPackage({
        serviceCode: 'CAR_WASH_SUV_PICKUP',
        name: 'Rửa ô tô cỡ lớn',
        description: 'Rửa ngoại thất dành cho SUV, MPV, bán tải và van chạy xăng.',
        price: 220000,
        duration: 60,
        points: 22,
        vehicleType: VEHICLE_TYPES.CAR,
        pricingProfiles: CAR_GAS_LARGE,
        instructions: [
            'Kiểm tra thùng xe, giá nóc và phụ kiện bên ngoài',
            'Xịt nước sơ bộ toàn thân',
            'Phủ bọt trung tính và vệ sinh thân xe',
            'Vệ sinh thùng xe nếu có',
            'Vệ sinh bánh xe lớn và khu vực phanh',
            'Xả sạch và lau khô toàn bộ',
            'Kiểm tra trực quan lần cuối',
        ],
    }),
    buildWashPackage({
        serviceCode: 'CAR_WASH_ELECTRIC',
        name: 'Rửa ô tô điện an toàn',
        description: 'Rửa thủ công an toàn dành riêng cho ô tô điện.',
        price: 250000,
        duration: 60,
        points: 25,
        vehicleType: VEHICLE_TYPES.CAR,
        pricingProfiles: CAR_ELECTRIC,
        washBayDuration: 0,
        automated: false,
        instructions: [
            'Che chắn cổng sạc, cổng USB và màn hình trung tâm',
            'Không xịt trực tiếp áp lực cao vào các cổng điện',
            'Vệ sinh thân xe bằng vải ẩm và tia nước nhẹ',
            'Vệ sinh bánh xe và vành',
            'Thổi khô và lau khô chi tiết',
            'Kiểm tra an toàn khu vực điện trước khi bàn giao',
        ],
    }),
    buildAddonPackage({
        serviceCode: 'CAR_INTERIOR_VACUUM',
        name: 'Hút bụi nội thất',
        description: 'Hút bụi ghế, sàn, các khe nội thất và khoang hành lý.',
        price: 100000,
        duration: 45,
        points: 8,
        vehicleType: VEHICLE_TYPES.CAR,
        pricingProfiles: ALL_VEHICLES_OF_TYPE,
        instructions: [
            'Tháo thảm sàn cẩn thận',
            'Hút bụi ghế, sàn và khoang hành lý',
            'Hút bụi các khe nhỏ trên bảng điều khiển và cửa',
            'Vệ sinh thảm sàn',
            'Đặt lại thảm và kiểm tra nội thất lần cuối',
        ],
    }),
    buildAddonPackage({
        serviceCode: 'CAR_INTERIOR_DEEP',
        name: 'Vệ sinh nội thất chuyên sâu',
        description: 'Vệ sinh toàn diện nội thất theo đúng vật liệu ghế và bề mặt.',
        price: 280000,
        duration: 90,
        points: 22,
        vehicleType: VEHICLE_TYPES.CAR,
        pricingProfiles: ALL_VEHICLES_OF_TYPE,
        instructions: [
            'Hút bụi toàn bộ ghế, sàn và khoang hành lý',
            'Vệ sinh bảng điều khiển, màn hình và taplo',
            'Vệ sinh ghế da hoặc nỉ theo đúng vật liệu',
            'Vệ sinh khe cửa và gioăng cao su',
            'Vệ sinh khoang hành lý',
            'Khử mùi nhẹ nếu cần',
            'Kiểm tra tổng quát nội thất',
        ],
    }),
    buildAddonPackage({
        serviceCode: 'CAR_LEATHER_CARE',
        name: 'Chăm sóc ghế da',
        description: 'Làm sạch và dưỡng bề mặt ghế da bằng sản phẩm chuyên dụng.',
        price: 350000,
        duration: 60,
        points: 28,
        vehicleType: VEHICLE_TYPES.CAR,
        pricingProfiles: ALL_VEHICLES_OF_TYPE,
        instructions: [
            'Hút bụi bề mặt và khe ghế da',
            'Vệ sinh bề mặt da bằng dung dịch chuyên dụng',
            'Phủ dưỡng da đều các bề mặt ghế',
            'Lau sạch phần dung dịch dư',
            'Để khô tự nhiên và kiểm tra độ mềm của da',
        ],
    }),
    buildAddonPackage({
        serviceCode: 'CAR_EXTERIOR_WAX',
        name: 'Phủ sáp bảo vệ sơn',
        description: 'Yêu cầu thân xe sạch và khô; khách cần mua thêm dịch vụ rửa nếu xe chưa được làm sạch.',
        price: 350000,
        duration: 60,
        points: 28,
        vehicleType: VEHICLE_TYPES.CAR,
        pricingProfiles: ALL_VEHICLES_OF_TYPE,
        instructions: [
            'Xác nhận thân xe đã sạch và khô',
            'Làm sạch bề mặt sơn bằng clay bar',
            'Phủ sáp đều toàn thân xe',
            'Chờ khô theo hướng dẫn của sản phẩm',
            'Lau bóng bề mặt sơn',
            'Kiểm tra độ bóng trước khi bàn giao',
        ],
    }),
    buildAddonPackage({
        serviceCode: 'CAR_EXTERIOR_CERAMIC',
        name: 'Phủ ceramic 1 lớp',
        description: 'Yêu cầu thân xe sạch và khô; tránh nước và hóa chất trong 24 đến 48 giờ sau khi bàn giao.',
        price: 1200000,
        duration: 120,
        points: 80,
        vehicleType: VEHICLE_TYPES.CAR,
        pricingProfiles: ALL_VEHICLES_OF_TYPE,
        staffCount: 2,
        instructions: [
            'Xác nhận thân xe đã sạch và khô',
            'Làm sạch dầu bám bằng dung dịch degreaser',
            'Kiểm tra tình trạng và độ bám bề mặt sơn',
            'Phủ ceramic đều theo từng panel',
            'Chờ phản ứng và lau sạch phần dư',
            'Hướng dẫn khách tránh nước và hóa chất trong 24 đến 48 giờ',
        ],
    }),
    buildAddonPackage({
        serviceCode: 'CAR_EXTERIOR_NANO',
        name: 'Phủ nano ceramic 9H',
        description: 'Yêu cầu thân xe sạch và khô; tránh nước và hóa chất trong 24 đến 48 giờ sau khi bàn giao.',
        price: 2500000,
        duration: 180,
        points: 150,
        vehicleType: VEHICLE_TYPES.CAR,
        pricingProfiles: ALL_VEHICLES_OF_TYPE,
        staffCount: 2,
        instructions: [
            'Xác nhận thân xe đã được rửa sạch và làm khô',
            'Làm sạch sâu bằng iron remover và clay bar',
            'Hiệu chỉnh bề mặt sơn nếu cần',
            'Phủ ceramic theo từng panel',
            'Chờ phản ứng và lau sạch phần dư',
            'Hướng dẫn khách tránh nước và hóa chất trong 24 đến 48 giờ',
        ],
    }),
    buildAddonPackage({
        serviceCode: 'CAR_EXTERIOR_PAINT_CORRECTION',
        name: 'Hiệu chỉnh sơn',
        description: 'Yêu cầu thân xe sạch và khô trước khi đánh giá và hiệu chỉnh bề mặt sơn.',
        price: 1500000,
        duration: 180,
        points: 100,
        vehicleType: VEHICLE_TYPES.CAR,
        pricingProfiles: ALL_VEHICLES_OF_TYPE,
        staffCount: 2,
        instructions: [
            'Xác nhận thân xe đã được rửa sạch và làm khô',
            'Đánh giá tình trạng sơn bằng đèn chuyên dụng',
            'Hiệu chỉnh theo các cấp compound, polishing và finishing',
            'Lau sạch cặn hợp chất đánh bóng',
            'Kiểm tra độ bóng và khuyết điểm còn lại',
        ],
    }),
    buildAddonPackage({
        serviceCode: 'CAR_GLASS_CLEAN',
        name: 'Vệ sinh kính xe',
        description: 'Làm sạch mặt trong, mặt ngoài và gờ cao su của kính xe.',
        price: 80000,
        duration: 20,
        points: 6,
        vehicleType: VEHICLE_TYPES.CAR,
        pricingProfiles: ALL_VEHICLES_OF_TYPE,
        instructions: [
            'Phun dung dịch vệ sinh lên kính trước và sau',
            'Lau sạch mặt trong và mặt ngoài kính',
            'Vệ sinh gờ cao su kính',
            'Kiểm tra độ trong và vệt bám trên kính',
        ],
    }),
    buildAddonPackage({
        serviceCode: 'CAR_GLASS_COATING',
        name: 'Phủ kính chống bám nước',
        description: 'Làm sạch và phủ dung dịch chống bám nước lên kính xe.',
        price: 280000,
        duration: 45,
        points: 22,
        vehicleType: VEHICLE_TYPES.CAR,
        pricingProfiles: ALL_VEHICLES_OF_TYPE,
        instructions: [
            'Làm sạch kính trước và sau bằng dung dịch chuyên dụng',
            'Lau khô hoàn toàn bề mặt kính',
            'Phủ đều dung dịch chống bám nước',
            'Chờ khô và lau sạch phần dư',
            'Kiểm tra độ trong và khả năng thoát nước',
        ],
    }),
    buildAddonPackage({
        serviceCode: 'CAR_HEADLIGHT_RESTORE',
        name: 'Phục hồi đèn pha',
        description: 'Làm sạch, xử lý xước nhẹ và đánh bóng bề mặt đèn pha.',
        price: 250000,
        duration: 45,
        points: 20,
        vehicleType: VEHICLE_TYPES.CAR,
        pricingProfiles: ALL_VEHICLES_OF_TYPE,
        instructions: [
            'Kiểm tra tình trạng bề mặt đèn pha',
            'Mài nhẹ lớp trầy xước bằng giấy nhám ướt phù hợp',
            'Đánh bóng đều bề mặt đèn',
            'Lau sạch phần hợp chất dư',
            'Kiểm tra độ trong của đèn pha',
        ],
    }),
    buildAddonPackage({
        serviceCode: 'CAR_TAR_REMOVAL',
        name: 'Tẩy nhựa đường và keo dính',
        description: 'Loại bỏ nhựa đường và keo dính bằng hóa chất phù hợp với bề mặt sơn.',
        price: 200000,
        duration: 40,
        points: 16,
        vehicleType: VEHICLE_TYPES.CAR,
        pricingProfiles: ALL_VEHICLES_OF_TYPE,
        instructions: [
            'Xác định và kiểm tra các vết nhựa đường hoặc keo dính',
            'Phun dung dịch tẩy lên từng khu vực',
            'Chờ hóa chất phản ứng theo hướng dẫn',
            'Lau sạch từng vết bằng khăn phù hợp',
            'Kiểm tra bề mặt sơn sau khi tẩy',
        ],
    }),
    buildAddonPackage({
        serviceCode: 'CAR_IRON_REMOVAL',
        name: 'Tẩy bụi sắt bám sơn',
        description: 'Loại bỏ bụi sắt bám trên bề mặt sơn bằng hóa chất chuyên dụng.',
        price: 220000,
        duration: 40,
        points: 18,
        vehicleType: VEHICLE_TYPES.CAR,
        pricingProfiles: ALL_VEHICLES_OF_TYPE,
        instructions: [
            'Phun dung dịch tẩy bụi sắt lên thân xe',
            'Chờ hóa chất phản ứng và chuyển màu',
            'Xả sạch bằng nước áp lực thấp',
            'Lau khô và kiểm tra bề mặt sơn',
        ],
    }),
    buildAddonPackage({
        serviceCode: 'CAR_ENGINE_CLEAN',
        name: 'Vệ sinh khoang động cơ',
        description: 'Vệ sinh khoang động cơ dành cho ô tô chạy xăng.',
        price: 300000,
        duration: 60,
        points: 25,
        vehicleType: VEHICLE_TYPES.CAR,
        pricingProfiles: CAR_GAS_ALL,
        instructions: [
            'Che chắn các bộ phận điện nhạy cảm',
            'Phun dung dịch vệ sinh khoang động cơ',
            'Chải nhẹ các bề mặt nhìn thấy',
            'Xả bằng nước áp lực thấp',
            'Thổi khô bằng khí nén',
            'Kiểm tra an toàn trước khi bàn giao',
        ],
    }),
    buildAddonPackage({
        serviceCode: 'CAR_AC_CLEAN',
        name: 'Vệ sinh điều hòa không khí',
        description: 'Vệ sinh lưới lọc và cửa gió, không bao gồm sửa chữa hệ thống điều hòa.',
        price: 280000,
        duration: 45,
        points: 22,
        vehicleType: VEHICLE_TYPES.CAR,
        pricingProfiles: ALL_VEHICLES_OF_TYPE,
        instructions: [
            'Xác nhận yêu cầu và tình trạng điều hòa',
            'Vệ sinh lưới lọc gió nếu có thể tháo',
            'Phun dung dịch vệ sinh vào cửa gió',
            'Chạy quạt để làm khô hệ thống',
            'Ghi nhận tình trạng sau khi vệ sinh',
        ],
    }),
    buildAddonPackage({
        serviceCode: 'CAR_ODOR_TREATMENT',
        name: 'Khử mùi nội thất bằng ozone',
        description: 'Khử mùi bằng ozone trong khoang xe trống và thông gió đầy đủ sau xử lý.',
        price: 200000,
        duration: 30,
        points: 16,
        vehicleType: VEHICLE_TYPES.CAR,
        pricingProfiles: ALL_VEHICLES_OF_TYPE,
        instructions: [
            'Dọn khoang xe và xác nhận không có người hoặc vật nuôi bên trong',
            'Đặt máy ozone đúng vị trí',
            'Chạy chu trình ozone đúng thời gian quy định',
            'Thông gió đầy đủ sau khi xử lý',
            'Kiểm tra khoang xe trước khi bàn giao',
        ],
    }),
    buildComboPackage({
        serviceCode: 'MOTORBIKE_COMBO_WASH_OIL',
        name: 'Combo rửa xe máy và thay dầu',
        description: 'Kết hợp rửa tiêu chuẩn và thay dầu cho xe máy xăng dưới 175cc.',
        price: 140000,
        points: 14,
        vehicleType: VEHICLE_TYPES.MOTORBIKE,
        includedServiceCodes: [
            'MOTORBIKE_WASH_BASIC',
            'MOTORBIKE_OIL_CHANGE',
        ],
        pricingProfiles: MOTORBIKE_GAS_UNDER_175,
    }),
    buildComboPackage({
        serviceCode: 'MOTORBIKE_COMBO_FULL_SERVICE',
        name: 'Combo dọn dẹp toàn diện xe máy',
        description: 'Kết hợp rửa cao cấp, chăm sóc xích và kiểm tra lốp cho xe máy xăng dưới 175cc.',
        price: 150000,
        points: 15,
        vehicleType: VEHICLE_TYPES.MOTORBIKE,
        includedServiceCodes: [
            'MOTORBIKE_WASH_PREMIUM',
            'MOTORBIKE_CHAIN_CARE',
            'MOTORBIKE_TIRE_CHECK',
        ],
        pricingProfiles: MOTORBIKE_GAS_UNDER_175,
    }),
    buildComboPackage({
        serviceCode: 'CAR_COMBO_EXPRESS',
        name: 'Combo rửa nhanh và hút bụi',
        description: 'Kết hợp rửa nhanh và hút bụi nội thất cho hatchback hoặc sedan chạy xăng.',
        price: 160000,
        points: 14,
        vehicleType: VEHICLE_TYPES.CAR,
        includedServiceCodes: [
            'CAR_WASH_BASIC',
            'CAR_INTERIOR_VACUUM',
        ],
        pricingProfiles: CAR_GAS_SMALL,
    }),
    buildComboPackage({
        serviceCode: 'CAR_COMBO_STANDARD',
        name: 'Combo rửa tiêu chuẩn và vệ sinh nội thất',
        description: 'Kết hợp rửa tiêu chuẩn và vệ sinh nội thất chuyên sâu cho hatchback hoặc sedan chạy xăng.',
        price: 370000,
        points: 31,
        vehicleType: VEHICLE_TYPES.CAR,
        includedServiceCodes: [
            'CAR_WASH_STANDARD',
            'CAR_INTERIOR_DEEP',
        ],
        pricingProfiles: CAR_GAS_SMALL,
    }),
    buildComboPackage({
        serviceCode: 'CAR_COMBO_PREMIUM',
        name: 'Combo rửa cao cấp và vệ sinh nội thất',
        description: 'Kết hợp rửa cao cấp và vệ sinh nội thất chuyên sâu cho hatchback hoặc sedan chạy xăng.',
        price: 430000,
        points: 37,
        vehicleType: VEHICLE_TYPES.CAR,
        includedServiceCodes: [
            'CAR_WASH_PREMIUM',
            'CAR_INTERIOR_DEEP',
        ],
        pricingProfiles: CAR_GAS_SMALL,
    }),
    buildComboPackage({
        serviceCode: 'CAR_COMBO_PROTECT',
        name: 'Combo rửa cao cấp và phủ ceramic',
        description: 'Kết hợp rửa cao cấp và phủ ceramic cho hatchback hoặc sedan chạy xăng.',
        price: 1300000,
        points: 92,
        vehicleType: VEHICLE_TYPES.CAR,
        includedServiceCodes: [
            'CAR_WASH_PREMIUM',
            'CAR_EXTERIOR_CERAMIC',
        ],
        pricingProfiles: CAR_GAS_SMALL,
    }),
    buildComboPackage({
        serviceCode: 'CAR_COMBO_GLASS',
        name: 'Combo phục hồi đèn và phủ kính',
        description: 'Kết hợp phục hồi đèn pha và phủ kính chống bám nước cho mọi loại ô tô.',
        price: 500000,
        points: 39,
        vehicleType: VEHICLE_TYPES.CAR,
        includedServiceCodes: [
            'CAR_HEADLIGHT_RESTORE',
            'CAR_GLASS_COATING',
        ],
        pricingProfiles: ALL_VEHICLES_OF_TYPE,
    }),
    buildComboPackage({
        serviceCode: 'CAR_COMBO_NEW_CAR',
        name: 'Combo chăm sóc xe mới',
        description: 'Kết hợp rửa cao cấp, phủ sáp và phủ kính cho hatchback hoặc sedan chạy xăng.',
        price: 780000,
        points: 65,
        vehicleType: VEHICLE_TYPES.CAR,
        includedServiceCodes: [
            'CAR_WASH_PREMIUM',
            'CAR_EXTERIOR_WAX',
            'CAR_GLASS_COATING',
        ],
        pricingProfiles: CAR_GAS_SMALL,
    }),
    buildComboPackage({
        serviceCode: 'CAR_COMBO_FULL_DETAIL',
        name: 'Combo dọn dẹp toàn diện ô tô',
        description: 'Kết hợp rửa cao cấp, vệ sinh nội thất, phủ sáp và phủ kính cho hatchback hoặc sedan chạy xăng.',
        price: 1080000,
        points: 89,
        vehicleType: VEHICLE_TYPES.CAR,
        includedServiceCodes: [
            'CAR_WASH_PREMIUM',
            'CAR_INTERIOR_DEEP',
            'CAR_EXTERIOR_WAX',
            'CAR_GLASS_COATING',
        ],
        pricingProfiles: CAR_GAS_SMALL,
    }),
]);

const getResourceWindow = (definitions, resource) => {
    let elapsed = 0;
    let start = null;
    let end = null;

    for (const definition of definitions) {
        const required = resource === 'wash_bay'
            ? definition.requires_wash_bay
            : definition.requires_care_staff;

        if (required) {
            const resourceStart = elapsed
                + (definition[`${resource}_start_offset_minutes`] || 0);
            const resourceEnd = resourceStart
                + (definition[`${resource}_duration_minutes`]
                    || definition.duration_minutes);

            start = start === null ? resourceStart : Math.min(start, resourceStart);
            end = end === null ? resourceEnd : Math.max(end, resourceEnd);
        }

        elapsed += definition.duration_minutes;
    }

    return {
        start: start ?? 0,
        duration: start === null ? 0 : end - start,
    };
};

const cloneBlueprints = () => SERVICE_PACKAGE_BLUEPRINTS.map((definition) => ({
    ...definition,
    included_service_codes: [...(definition.included_service_codes || [])],
    steps_template: (definition.steps_template || []).map((step) => ({
        ...step,
        instructions: [...step.instructions],
    })),
    pricing_profiles: definition.pricing_profiles.map((item) => ({
        ...item,
    })),
}));

const buildServicePackageDefinitions = (referenceDate) => {
    const definitions = cloneBlueprints();
    const definitionByCode = new Map(
        definitions.map((definition) => [
            definition.service_code,
            definition,
        ])
    );
    const createdAt = atLocalDayAndMinute({
        referenceDate,
        dayOffset: -65,
        minuteOfDay: 9 * 60,
    });

    for (const definition of definitions) {
        definition.created_at = createdAt;

        if (definition.service_type !== SERVICE_PACKAGE_TYPES.COMBO) {
            continue;
        }

        const children = definition.included_service_codes.map((serviceCode) => {
            const child = definitionByCode.get(serviceCode);

            if (!child || child.service_type === SERVICE_PACKAGE_TYPES.COMBO) {
                throw new Error(
                    `Invalid combo child service: ${definition.service_code}:${serviceCode}`
                );
            }

            if (child.vehicle_type !== definition.vehicle_type) {
                throw new Error(
                    `Combo child vehicle type mismatch: ${definition.service_code}:${serviceCode}`
                );
            }

            return child;
        });
        const washBayWindow = getResourceWindow(children, 'wash_bay');
        const careStaffWindow = getResourceWindow(children, 'care_staff');
        const careStaffChildren = children.filter(
            (child) => child.requires_care_staff
        );
        const careStaffTypes = new Set(
            careStaffChildren.map((child) => child.care_staff_type)
        );

        if (careStaffTypes.size > 1) {
            throw new Error(
                `Combo requires incompatible staff types: ${definition.service_code}`
            );
        }

        definition.duration_minutes = children.reduce(
            (total, child) => total + child.duration_minutes,
            0
        );
        definition.requires_wash_bay = washBayWindow.duration > 0;
        definition.wash_bay_start_offset_minutes = washBayWindow.start;
        definition.wash_bay_duration_minutes = washBayWindow.duration;
        definition.requires_care_staff = careStaffWindow.duration > 0;
        definition.care_staff_type = careStaffChildren[0]?.care_staff_type || null;
        definition.care_staff_required_count = careStaffChildren.length > 0
            ? Math.max(...careStaffChildren.map(
                (child) => child.care_staff_required_count
            ))
            : 0;
        definition.care_staff_start_offset_minutes = careStaffWindow.start;
        definition.care_staff_duration_minutes = careStaffWindow.duration;
    }

    return definitions;
};

const buildServicePriceRuleDefinitions = (referenceDate) => {
    const effectiveFrom = atLocalDayAndMinute({
        referenceDate,
        dayOffset: -60,
        minuteOfDay: 0,
    });

    return buildServicePackageDefinitions(referenceDate).flatMap(
        (definition) => definition.pricing_profiles.map((pricingProfile) => ({
            rule_code: `PRICE_${definition.service_code}_${pricingProfile.code}_GLOBAL_V1`,
            service_code: definition.service_code,
            garage_code: null,
            vehicle_type: definition.vehicle_type,
            engine_type: pricingProfile.engine_type,
            motorbike_cc_group: pricingProfile.motorbike_cc_group,
            car_body_type: pricingProfile.car_body_type,
            seat_min: pricingProfile.seat_min,
            seat_max: pricingProfile.seat_max,
            price: definition.base_price,
            duration_minutes: null,
            wash_bay_duration_minutes: null,
            care_staff_duration_minutes: null,
            effective_from: effectiveFrom,
            effective_to: null,
            version: 1,
            is_active: true,
            note: `Giá niêm yết toàn hệ thống cho ${definition.name}`,
        }))
    );
};

const servicePriceRuleMatchesVehicle = (rule, vehicle) => {
    if (rule.vehicle_type !== vehicle.vehicle_type) {
        return false;
    }

    if (rule.engine_type && rule.engine_type !== vehicle.engine_type) {
        return false;
    }

    if (
        rule.motorbike_cc_group
        && rule.motorbike_cc_group !== vehicle.motorbike_cc_group
    ) {
        return false;
    }

    if (
        rule.car_body_type
        && rule.car_body_type !== vehicle.car_body_type
    ) {
        return false;
    }

    if (
        rule.seat_min !== null
        && (
            !Number.isInteger(vehicle.seat_count)
            || vehicle.seat_count < rule.seat_min
            || vehicle.seat_count > rule.seat_max
        )
    ) {
        return false;
    }

    return true;
};

module.exports = {
    SERVICE_PACKAGE_BLUEPRINTS,
    buildServicePackageDefinitions,
    buildServicePriceRuleDefinitions,
    servicePriceRuleMatchesVehicle,
};
