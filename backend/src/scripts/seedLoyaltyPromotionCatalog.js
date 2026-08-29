const {
    LOYALTY_TIERS,
} = require('../shared/constants/loyalty.constant');
const {
    VEHICLE_TYPES,
} = require('../shared/constants/vehicle.constant');
const {
    PROMOTION_DISCOUNT_TYPES,
    PROMOTION_AUDIENCES,
} = require('../shared/constants/promotion.constant');
const { atLocalDayAndMinute } = require('./seedTime');

const TIER_RULE_BLUEPRINTS = Object.freeze([
    {
        tier_name: LOYALTY_TIERS.BRONZE,
        booking_window_days: 7,
        max_upcoming_bookings: 1,
        point_multiplier: 1,
        priority_level: 1,
        min_total_spent: 0,
        min_total_visits: 0,
        min_total_points: 0,
        is_active: true,
    },
    {
        tier_name: LOYALTY_TIERS.SILVER,
        booking_window_days: 10,
        max_upcoming_bookings: 1,
        point_multiplier: 1.2,
        priority_level: 2,
        min_total_spent: 500000,
        min_total_visits: 3,
        min_total_points: 30,
        is_active: true,
    },
    {
        tier_name: LOYALTY_TIERS.GOLD,
        booking_window_days: 14,
        max_upcoming_bookings: 2,
        point_multiplier: 1.35,
        priority_level: 3,
        min_total_spent: 2000000,
        min_total_visits: 8,
        min_total_points: 120,
        is_active: true,
    },
    {
        tier_name: LOYALTY_TIERS.PLATINUM,
        booking_window_days: 20,
        max_upcoming_bookings: 3,
        point_multiplier: 1.5,
        priority_level: 4,
        min_total_spent: 5000000,
        min_total_visits: 15,
        min_total_points: 300,
        is_active: true,
    },
]);

const REDEEM_RULE_BLUEPRINT = Object.freeze({
    rule_code: 'LOYALTY_REDEEM_STANDARD_V1',
    point_value_amount: 100,
    min_redeem_points: 50,
    redeem_step: 10,
    max_redeem_percent: 30,
    is_active: true,
});

// These are the tiers covered by the default catalog. Runtime tier validation
// and evaluation must use persisted TierRule documents instead of this list.
const DEFAULT_TIER_NAMES = Object.freeze(
    TIER_RULE_BLUEPRINTS.map((definition) => definition.tier_name)
);

const ALL_TIERS = DEFAULT_TIER_NAMES;

const PROMOTION_BLUEPRINTS = Object.freeze([
    {
        code: 'MEMBER5',
        name: 'Ưu đãi thành viên 5%',
        description: 'Ưu đãi cơ bản dành cho tất cả khách hàng thành viên.',
        discount_type: PROMOTION_DISCOUNT_TYPES.PERCENTAGE,
        discount_value: 5,
        max_discount_amount: 30000,
        min_order_amount: 50000,
        audience: PROMOTION_AUDIENCES.CUSTOMER,
        phone_required: false,
        per_phone_limit: null,
        applicable_tiers: ALL_TIERS,
        applicable_vehicle_types: [],
        applicable_service_package_codes: [],
        usage_limit: 500,
        per_customer_limit: 3,
        schedule: 'ACTIVE',
        is_active: true,
    },
    {
        code: 'SILVER10',
        name: 'Ưu đãi Silver 10%',
        description: 'Ưu đãi dành cho thành viên Silver và các hạng cao hơn.',
        discount_type: PROMOTION_DISCOUNT_TYPES.PERCENTAGE,
        discount_value: 10,
        max_discount_amount: 60000,
        min_order_amount: 120000,
        audience: PROMOTION_AUDIENCES.CUSTOMER,
        phone_required: false,
        per_phone_limit: null,
        applicable_tiers: [
            LOYALTY_TIERS.SILVER,
            LOYALTY_TIERS.GOLD,
            LOYALTY_TIERS.PLATINUM,
        ],
        applicable_vehicle_types: [],
        applicable_service_package_codes: [],
        usage_limit: 300,
        per_customer_limit: 2,
        schedule: 'ACTIVE',
        is_active: true,
    },
    {
        code: 'GOLD15',
        name: 'Ưu đãi Gold 15%',
        description: 'Ưu đãi dành cho thành viên Gold và Platinum.',
        discount_type: PROMOTION_DISCOUNT_TYPES.PERCENTAGE,
        discount_value: 15,
        max_discount_amount: 150000,
        min_order_amount: 250000,
        audience: PROMOTION_AUDIENCES.CUSTOMER,
        phone_required: false,
        per_phone_limit: null,
        applicable_tiers: [
            LOYALTY_TIERS.GOLD,
            LOYALTY_TIERS.PLATINUM,
        ],
        applicable_vehicle_types: [],
        applicable_service_package_codes: [],
        usage_limit: 200,
        per_customer_limit: 2,
        schedule: 'ACTIVE',
        is_active: true,
    },
    {
        code: 'PLATINUM20',
        name: 'Đặc quyền Platinum 20%',
        description: 'Ưu đãi riêng dành cho thành viên Platinum.',
        discount_type: PROMOTION_DISCOUNT_TYPES.PERCENTAGE,
        discount_value: 20,
        max_discount_amount: 300000,
        min_order_amount: 500000,
        audience: PROMOTION_AUDIENCES.CUSTOMER,
        phone_required: false,
        per_phone_limit: null,
        applicable_tiers: [
            LOYALTY_TIERS.PLATINUM,
        ],
        applicable_vehicle_types: [],
        applicable_service_package_codes: [],
        usage_limit: 100,
        per_customer_limit: 2,
        schedule: 'ACTIVE',
        is_active: true,
    },
    {
        code: 'MOTORBIKE10',
        name: 'Chăm sóc xe máy giảm 10%',
        description: 'Ưu đãi dành cho dịch vụ xe máy của khách hàng thành viên.',
        discount_type: PROMOTION_DISCOUNT_TYPES.PERCENTAGE,
        discount_value: 10,
        max_discount_amount: 40000,
        min_order_amount: 80000,
        audience: PROMOTION_AUDIENCES.CUSTOMER,
        phone_required: false,
        per_phone_limit: null,
        applicable_tiers: [],
        applicable_vehicle_types: [
            VEHICLE_TYPES.MOTORBIKE,
        ],
        applicable_service_package_codes: [],
        usage_limit: 250,
        per_customer_limit: 1,
        schedule: 'ACTIVE',
        is_active: true,
    },
    {
        code: 'CARCOMBO100',
        name: 'Combo chăm sóc ô tô giảm 100.000đ',
        description: 'Ưu đãi cho các combo bảo vệ và chăm sóc toàn diện ô tô.',
        discount_type: PROMOTION_DISCOUNT_TYPES.FIXED_AMOUNT,
        discount_value: 100000,
        max_discount_amount: null,
        min_order_amount: 600000,
        audience: PROMOTION_AUDIENCES.CUSTOMER,
        phone_required: false,
        per_phone_limit: null,
        applicable_tiers: [],
        applicable_vehicle_types: [],
        applicable_service_package_codes: [
            'CAR_COMBO_PROTECT',
            'CAR_COMBO_NEW_CAR',
            'CAR_COMBO_FULL_DETAIL',
        ],
        usage_limit: 150,
        per_customer_limit: 1,
        schedule: 'ACTIVE',
        is_active: true,
    },
    {
        code: 'WALKIN30',
        name: 'Khách vãng lai giảm 30.000đ',
        description: 'Ưu đãi một lần theo số điện thoại dành cho khách vãng lai.',
        discount_type: PROMOTION_DISCOUNT_TYPES.FIXED_AMOUNT,
        discount_value: 30000,
        max_discount_amount: null,
        min_order_amount: 150000,
        audience: PROMOTION_AUDIENCES.WALK_IN,
        phone_required: true,
        per_phone_limit: 1,
        applicable_tiers: [],
        applicable_vehicle_types: [],
        applicable_service_package_codes: [],
        usage_limit: 200,
        per_customer_limit: null,
        schedule: 'ACTIVE',
        is_active: true,
    },
    {
        code: 'EVWASH12',
        name: 'Rửa ô tô điện giảm 12%',
        description: 'Chương trình sắp diễn ra dành riêng cho gói rửa ô tô điện an toàn.',
        discount_type: PROMOTION_DISCOUNT_TYPES.PERCENTAGE,
        discount_value: 12,
        max_discount_amount: 80000,
        min_order_amount: 250000,
        audience: PROMOTION_AUDIENCES.CUSTOMER,
        phone_required: false,
        per_phone_limit: null,
        applicable_tiers: [],
        applicable_vehicle_types: [],
        applicable_service_package_codes: [
            'CAR_WASH_ELECTRIC',
        ],
        usage_limit: 150,
        per_customer_limit: 1,
        schedule: 'UPCOMING',
        is_active: true,
    },
    {
        code: 'GRANDOPENING15',
        name: 'Ưu đãi khai trương 15%',
        description: 'Chương trình đã kết thúc, được giữ lại để tạo dữ liệu lịch sử.',
        discount_type: PROMOTION_DISCOUNT_TYPES.PERCENTAGE,
        discount_value: 15,
        max_discount_amount: 100000,
        min_order_amount: 150000,
        audience: PROMOTION_AUDIENCES.CUSTOMER,
        phone_required: false,
        per_phone_limit: null,
        applicable_tiers: [],
        applicable_vehicle_types: [],
        applicable_service_package_codes: [],
        usage_limit: 300,
        per_customer_limit: 1,
        schedule: 'EXPIRED',
        is_active: false,
    },
    {
        code: 'WASH15_PAUSED',
        name: 'Ưu đãi rửa xe 15% tạm dừng',
        description: 'Chương trình còn trong thời hạn nhưng đang tạm dừng.',
        discount_type: PROMOTION_DISCOUNT_TYPES.PERCENTAGE,
        discount_value: 15,
        max_discount_amount: 80000,
        min_order_amount: 100000,
        audience: PROMOTION_AUDIENCES.CUSTOMER,
        phone_required: false,
        per_phone_limit: null,
        applicable_tiers: [],
        applicable_vehicle_types: [],
        applicable_service_package_codes: [
            'MOTORBIKE_WASH_BASIC',
            'MOTORBIKE_WASH_PREMIUM',
            'MOTORBIKE_WASH_BIG',
            'MOTORBIKE_WASH_ELECTRIC',
            'CAR_WASH_BASIC',
            'CAR_WASH_STANDARD',
            'CAR_WASH_PREMIUM',
            'CAR_WASH_SUV_PICKUP',
            'CAR_WASH_ELECTRIC',
        ],
        usage_limit: 100,
        per_customer_limit: 1,
        schedule: 'PAUSED',
        is_active: false,
    },
]);

const getPromotionSchedule = (referenceDate, schedule) => {
    const values = {
        ACTIVE: {
            startOffset: -7,
            endOffset: 90,
            createdOffset: -10,
        },
        UPCOMING: {
            startOffset: 10,
            endOffset: 70,
            createdOffset: -2,
        },
        EXPIRED: {
            startOffset: -60,
            endOffset: -5,
            createdOffset: -65,
        },
        PAUSED: {
            startOffset: -7,
            endOffset: 90,
            createdOffset: -10,
        },
    }[schedule];

    if (!values) {
        throw new Error(`Invalid promotion schedule: ${schedule}`);
    }

    return {
        start_at: atLocalDayAndMinute({
            referenceDate,
            dayOffset: values.startOffset,
            minuteOfDay: 0,
        }),
        end_at: atLocalDayAndMinute({
            referenceDate,
            dayOffset: values.endOffset,
            minuteOfDay: 23 * 60 + 59,
        }),
        created_at: atLocalDayAndMinute({
            referenceDate,
            dayOffset: values.createdOffset,
            minuteOfDay: 9 * 60,
        }),
    };
};

const buildTierRuleDefinitions = (referenceDate) => {
    const createdAt = atLocalDayAndMinute({
        referenceDate,
        dayOffset: -70,
        minuteOfDay: 9 * 60,
    });

    return TIER_RULE_BLUEPRINTS.map((definition) => ({
        ...definition,
        created_at: createdAt,
    }));
};

const buildRedeemRuleDefinition = (referenceDate) => {
    const createdAt = atLocalDayAndMinute({
        referenceDate,
        dayOffset: -70,
        minuteOfDay: 9 * 60 + 15,
    });

    return {
        ...REDEEM_RULE_BLUEPRINT,
        created_at: createdAt,
    };
};

const buildPromotionDefinitions = (referenceDate) => (
    PROMOTION_BLUEPRINTS.map((definition) => ({
        ...definition,
        applicable_tiers: [...definition.applicable_tiers],
        applicable_vehicle_types: [
            ...definition.applicable_vehicle_types,
        ],
        applicable_service_package_codes: [
            ...definition.applicable_service_package_codes,
        ],
        ...getPromotionSchedule(referenceDate, definition.schedule),
        used_count: 0,
        reserved_count: 0,
    }))
);

module.exports = {
    TIER_RULE_BLUEPRINTS,
    DEFAULT_TIER_NAMES,
    REDEEM_RULE_BLUEPRINT,
    PROMOTION_BLUEPRINTS,
    buildTierRuleDefinitions,
    buildRedeemRuleDefinition,
    buildPromotionDefinitions,
};
