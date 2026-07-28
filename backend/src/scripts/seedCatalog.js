const { USER_ROLES } = require('../shared/constants/roles.constant');
const { STAFF_TYPES } = require('../shared/constants/staff.constant');
const {
    CAMERA_DEVICE_STATUSES,
} = require('../shared/constants/bookingArrival.constant');
const { atLocalDayAndMinute } = require('./seedTime');

const CUSTOMER_COUNT_PER_GARAGE = 25;

const GARAGE_SEEDS = Object.freeze([
    {
        garage_code: 'GAR001',
        name: 'AutoWash Pro Thủ Đức',
        address: '12 Võ Văn Ngân',
        ward: 'Linh Chiểu',
        district: 'Thủ Đức',
        city: 'Hồ Chí Minh',
        phone: '0287301001',
        email: 'thuduc@autowash.local',
        latitude: 10.8506,
        longitude: 106.7717,
        opening_time: '07:00',
        closing_time: '19:00',
        slot_interval_minutes: 30,
        late_grace_minutes: 15,
        description: 'Chi nhánh phục vụ ô tô và xe máy tại khu vực Thủ Đức.',
        is_active: true,
        phone_group: '00',
        customer_count: CUSTOMER_COUNT_PER_GARAGE,
    },
    {
        garage_code: 'GAR002',
        name: 'AutoWash Pro Gò Vấp',
        address: '451 Phan Văn Trị',
        ward: 'Phường 5',
        district: 'Gò Vấp',
        city: 'Hồ Chí Minh',
        phone: '0287301002',
        email: 'govap@autowash.local',
        latitude: 10.8276,
        longitude: 106.6899,
        opening_time: '07:00',
        closing_time: '19:00',
        slot_interval_minutes: 30,
        late_grace_minutes: 15,
        description: 'Chi nhánh chuyên phục vụ xe máy tại khu vực Gò Vấp.',
        is_active: true,
        phone_group: '01',
        customer_count: CUSTOMER_COUNT_PER_GARAGE,
    },
    {
        garage_code: 'GAR003',
        name: 'AutoWash Pro Bình Thạnh',
        address: '192 Điện Biên Phủ',
        ward: 'Phường 17',
        district: 'Bình Thạnh',
        city: 'Hồ Chí Minh',
        phone: '0287301003',
        email: 'binhthanh@autowash.local',
        latitude: 10.8004,
        longitude: 106.709,
        opening_time: '07:00',
        closing_time: '19:00',
        slot_interval_minutes: 30,
        late_grace_minutes: 15,
        description: 'Chi nhánh phục vụ ô tô và xe máy tại khu vực Bình Thạnh.',
        is_active: true,
        phone_group: '02',
        customer_count: CUSTOMER_COUNT_PER_GARAGE,
    },
    {
        garage_code: 'GAR004',
        name: 'AutoWash Pro Tân Bình',
        address: '87 Cộng Hòa',
        ward: 'Phường 4',
        district: 'Tân Bình',
        city: 'Hồ Chí Minh',
        phone: '0287301004',
        email: 'tanbinh@autowash.local',
        latitude: 10.8013,
        longitude: 106.6535,
        opening_time: '07:00',
        closing_time: '19:00',
        slot_interval_minutes: 30,
        late_grace_minutes: 15,
        description: 'Chi nhánh phục vụ ô tô và xe máy tại khu vực Tân Bình.',
        is_active: true,
        phone_group: '03',
        customer_count: CUSTOMER_COUNT_PER_GARAGE,
    },
    {
        garage_code: 'GAR005',
        name: 'AutoWash Pro Quận 7',
        address: '105 Nguyễn Thị Thập',
        ward: 'Tân Phú',
        district: 'Quận 7',
        city: 'Hồ Chí Minh',
        phone: '0287301005',
        email: 'quan7@autowash.local',
        latitude: 10.7369,
        longitude: 106.7182,
        opening_time: '07:00',
        closing_time: '19:00',
        slot_interval_minutes: 30,
        late_grace_minutes: 15,
        description: 'Chi nhánh chuyên phục vụ ô tô tại khu vực Quận 7.',
        is_active: true,
        phone_group: '04',
        customer_count: CUSTOMER_COUNT_PER_GARAGE,
    },
]);

const STAFF_ROLE_SEEDS = Object.freeze([
    {
        role_key: 'checkin',
        phone_suffix: '02',
        staff_type: STAFF_TYPES.CUSTOMER_SERVICE_STAFF,
        staff_code_prefix: 'CHECKIN',
    },
    {
        role_key: 'inspection',
        phone_suffix: '03',
        staff_type: STAFF_TYPES.VEHICLE_INSPECTION_STAFF,
        staff_code_prefix: 'INSPECT',
    },
    {
        role_key: 'care01',
        phone_suffix: '04',
        staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
        staff_code_prefix: 'CARE',
        staff_sequence: 1,
    },
    {
        role_key: 'wash',
        phone_suffix: '05',
        staff_type: STAFF_TYPES.WASH_OPERATOR,
        staff_code_prefix: 'WASH',
        staff_sequence: 1,
    },
    {
        role_key: 'care02',
        phone_suffix: '06',
        staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
        staff_code_prefix: 'CARE',
        staff_sequence: 2,
    },
    {
        role_key: 'wash02',
        phone_suffix: '07',
        staff_type: STAFF_TYPES.WASH_OPERATOR,
        staff_code_prefix: 'WASH',
        staff_sequence: 2,
    },
    {
        role_key: 'care03',
        phone_suffix: '08',
        staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
        staff_code_prefix: 'CARE',
        staff_sequence: 3,
    },
    {
        role_key: 'wash03',
        phone_suffix: '09',
        staff_type: STAFF_TYPES.WASH_OPERATOR,
        staff_code_prefix: 'WASH',
        staff_sequence: 3,
    },
    {
        role_key: 'care04',
        phone_suffix: '10',
        staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
        staff_code_prefix: 'CARE',
        staff_sequence: 4,
    },
    {
        role_key: 'wash04',
        phone_suffix: '11',
        staff_type: STAFF_TYPES.WASH_OPERATOR,
        staff_code_prefix: 'WASH',
        staff_sequence: 4,
    },
]);

const STAFF_NAMES_BY_GARAGE = Object.freeze({
    GAR001: Object.freeze([
        'Nguyễn Minh Quân',
        'Trần Thảo Vy',
        'Lê Quốc Bảo',
        'Phạm Hoàng Nam',
        'Võ Ngọc Linh',
        'Đỗ Gia Huy',
        'Bùi Thanh Tâm',
        'Hồ Đức Anh',
        'Dương Khánh Toàn',
        'Ngô Bảo Trân',
    ]),
    GAR002: Object.freeze([
        'Đặng Thanh Tùng',
        'Nguyễn Thu Trang',
        'Trần Đức Long',
        'Huỳnh Gia Hân',
        'Lê Minh Khoa',
        'Phạm Quốc Việt',
        'Võ Hoàng Yến',
        'Bùi Anh Tuấn',
        'Đỗ Thùy Dung',
        'Phan Nhật Minh',
    ]),
    GAR003: Object.freeze([
        'Phan Nhật Anh',
        'Vũ Khánh Ngân',
        'Nguyễn Hoài Phúc',
        'Trần Tuấn Kiệt',
        'Phạm Thùy Chi',
        'Lê Thanh Phong',
        'Đặng Mỹ Linh',
        'Võ Đức Huy',
        'Huỳnh Quang Vinh',
        'Bùi Ngọc Mai',
    ]),
    GAR004: Object.freeze([
        'Lê Anh Dũng',
        'Võ Thanh Mai',
        'Nguyễn Quốc Huy',
        'Đặng Minh Sơn',
        'Trần Ngọc Trâm',
        'Phan Gia Bảo',
        'Huỳnh Thu Hà',
        'Bùi Minh Đức',
        'Đỗ Hải Nam',
        'Ngô Kim Ngân',
    ]),
    GAR005: Object.freeze([
        'Huỳnh Văn Khải',
        'Phạm Như Quỳnh',
        'Lê Đức Thịnh',
        'Nguyễn Thành Đạt',
        'Vũ Yến Nhi',
        'Trần Quốc Khánh',
        'Võ Diễm My',
        'Đặng Anh Khoa',
        'Phan Thanh Bình',
        'Hồ Ngọc Anh',
    ]),
});

const CAMERA_DEVICE_SEEDS = Object.freeze(GARAGE_SEEDS.map((garage) => Object.freeze({
    device_code: `CAM-${garage.garage_code}-ENTRY-01`,
    name: `Camera cổng vào ${garage.name}`,
    garage_code: garage.garage_code,
    location: 'Cổng vào - làn tiếp nhận 01',
    status: CAMERA_DEVICE_STATUSES.ACTIVE,
    metadata: Object.freeze({
        purpose: 'ARRIVAL_PLATE_SCAN',
        direction: 'ENTRY',
        lane: '01',
    }),
})));

const CUSTOMER_SURNAMES = Object.freeze([
    'Nguyễn',
    'Trần',
    'Lê',
    'Phạm',
    'Hoàng',
    'Huỳnh',
    'Phan',
    'Vũ',
    'Võ',
    'Đặng',
]);

const CUSTOMER_MIDDLE_NAMES = Object.freeze([
    'Văn',
    'Thị',
    'Minh',
    'Ngọc',
    'Quốc',
    'Thanh',
    'Đức',
    'Hoài',
    'Gia',
    'Khánh',
]);

const CUSTOMER_GIVEN_NAMES = Object.freeze([
    'An',
    'Bình',
    'Chi',
    'Dũng',
    'Hà',
    'Hân',
    'Hòa',
    'Hùng',
    'Lan',
    'Linh',
    'Long',
    'Mai',
    'Nam',
    'Ngân',
    'Ngọc',
    'Như',
    'Phong',
    'Phúc',
    'Quân',
    'Quỳnh',
    'Sơn',
    'Thảo',
    'Trang',
    'Trâm',
    'Tuấn',
    'Vy',
    'Yến',
    'Khoa',
    'Bảo',
    'My',
]);

const getGarageNumber = (garageCode) => Number(garageCode.slice(-3));

const buildAdminSeedUsers = (referenceDate) => [
    {
        full_name: 'Nguyễn Minh Khôi',
        email: 'admin.primary@autowash.local',
        phone: '0900000001',
        role: USER_ROLES.ADMIN,
        password_group: 'ADMIN',
        created_at: atLocalDayAndMinute({
            referenceDate,
            dayOffset: -90,
            minuteOfDay: 9 * 60 + 15,
        }),
    },
    {
        full_name: 'Trần Thu Hà',
        email: 'admin.operations@autowash.local',
        phone: '0900000101',
        role: USER_ROLES.ADMIN,
        password_group: 'ADMIN',
        created_at: atLocalDayAndMinute({
            referenceDate,
            dayOffset: -82,
            minuteOfDay: 10 * 60 + 20,
        }),
    },
];

const buildStaffSeedUsers = (referenceDate) => GARAGE_SEEDS.flatMap(
    (garage, garageIndex) => STAFF_ROLE_SEEDS.map((role, roleIndex) => {
        const garageNumber = getGarageNumber(garage.garage_code);
        const sequenceSuffix = role.staff_sequence
            ? `-${String(role.staff_sequence).padStart(2, '0')}`
            : '';

        return {
            full_name: STAFF_NAMES_BY_GARAGE[garage.garage_code][roleIndex],
            email: `${role.role_key}.${garage.garage_code.toLowerCase()}@autowash.local`,
            phone: `090000${garage.phone_group}${role.phone_suffix}`,
            role: USER_ROLES.STAFF,
            password_group: 'STAFF',
            garage_code: garage.garage_code,
            staff_type: role.staff_type,
            staff_code: `${role.staff_code_prefix}-${garage.garage_code}${sequenceSuffix}`,
            created_at: atLocalDayAndMinute({
                referenceDate,
                dayOffset: -60 + garageIndex * 2 + roleIndex,
                minuteOfDay: 8 * 60 + 30 + roleIndex * 47,
            }),
            garage_number: garageNumber,
        };
    })
);

const buildCustomerName = (globalIndex, garageIndex) => {
    const surname = CUSTOMER_SURNAMES[globalIndex % CUSTOMER_SURNAMES.length];
    const middleName = CUSTOMER_MIDDLE_NAMES[
        Math.floor(globalIndex / CUSTOMER_SURNAMES.length) % CUSTOMER_MIDDLE_NAMES.length
    ];
    const givenName = CUSTOMER_GIVEN_NAMES[
        (globalIndex * 7 + garageIndex * 3) % CUSTOMER_GIVEN_NAMES.length
    ];

    return `${surname} ${middleName} ${givenName}`;
};

const buildCustomerSeedUsers = (referenceDate) => GARAGE_SEEDS.flatMap(
    (garage, garageIndex) => Array.from(
        { length: garage.customer_count },
        (_, customerIndex) => {
            const globalIndex = garageIndex * CUSTOMER_COUNT_PER_GARAGE + customerIndex;
            const customerSequence = String(customerIndex + 1).padStart(4, '0');
            const garageSequence = String(garageIndex + 1).padStart(2, '0');
            const dayOffset = 1 + ((globalIndex * 7 + garageIndex * 3) % 30);
            const minuteOfDay = 8 * 60 + (
                (globalIndex * 47 + garageIndex * 19) % (13 * 60)
            );

            return {
                full_name: buildCustomerName(globalIndex, garageIndex),
                email: `customer.${garage.garage_code.toLowerCase()}.${String(customerIndex + 1).padStart(3, '0')}@autowash.local`,
                phone: `0911${garageSequence}${customerSequence}`,
                role: USER_ROLES.CUSTOMER,
                password_group: 'CUSTOMER',
                preferred_garage_code: garage.garage_code,
                created_at: atLocalDayAndMinute({
                    referenceDate,
                    dayOffset: -dayOffset,
                    minuteOfDay,
                }),
            };
        }
    )
);

const buildSeedUsers = (referenceDate) => [
    ...buildAdminSeedUsers(referenceDate),
    ...buildStaffSeedUsers(referenceDate),
    ...buildCustomerSeedUsers(referenceDate),
];

const toGaragePayload = (garage) => ({
    name: garage.name,
    garage_code: garage.garage_code,
    address: garage.address,
    ward: garage.ward,
    district: garage.district,
    city: garage.city,
    phone: garage.phone,
    email: garage.email,
    latitude: garage.latitude,
    longitude: garage.longitude,
    opening_time: garage.opening_time,
    closing_time: garage.closing_time,
    slot_interval_minutes: garage.slot_interval_minutes,
    late_grace_minutes: garage.late_grace_minutes,
    description: garage.description,
    is_active: garage.is_active,
});

module.exports = {
    CUSTOMER_COUNT_PER_GARAGE,
    GARAGE_SEEDS,
    STAFF_ROLE_SEEDS,
    CAMERA_DEVICE_SEEDS,
    buildAdminSeedUsers,
    buildStaffSeedUsers,
    buildCustomerSeedUsers,
    buildSeedUsers,
    toGaragePayload,
};
