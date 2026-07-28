const User = require('../modules/users/user.model');
const Garage = require('../modules/garages/garage.model');
const { USER_ROLES } = require('../shared/constants/roles.constant');
const { STAFF_TYPES } = require('../shared/constants/staff.constant');
const { normalizePhone, isValidPhone } = require('../shared/utils/phone');
const {
    GARAGE_SEEDS,
    buildSeedUsers,
    buildStaffSeedUsers,
    buildCustomerSeedUsers,
    toGaragePayload,
} = require('./seedCatalog');
const { getSeedReferenceDate } = require('./seedTime');

describe('users and garages seed catalog', () => {
    const referenceDate = getSeedReferenceDate({
        value: '2026-07-28',
        timezoneOffset: '+07:00',
    });

    test('builds the agreed user totals with unique canonical identities', () => {
        const users = buildSeedUsers(referenceDate);
        const phones = users.map((user) => normalizePhone(user.phone));
        const emails = users.map((user) => user.email);
        const roleCounts = users.reduce((counts, user) => ({
            ...counts,
            [user.role]: (counts[user.role] || 0) + 1,
        }), {});

        expect(users).toHaveLength(177);
        expect(roleCounts).toEqual({
            [USER_ROLES.ADMIN]: 2,
            [USER_ROLES.STAFF]: 50,
            [USER_ROLES.CUSTOMER]: 125,
        });
        expect(new Set(phones).size).toBe(phones.length);
        expect(new Set(emails).size).toBe(emails.length);
        expect(phones.every(isValidPhone)).toBe(true);
    });

    test('maps ten operational staff roles to every garage', () => {
        const staff = buildStaffSeedUsers(referenceDate);

        for (const garage of GARAGE_SEEDS) {
            const garageStaff = staff.filter(
                (item) => item.garage_code === garage.garage_code
            );
            const typeCounts = garageStaff.reduce((counts, item) => ({
                ...counts,
                [item.staff_type]: (counts[item.staff_type] || 0) + 1,
            }), {});

            expect(garageStaff).toHaveLength(10);
            expect(typeCounts).toEqual({
                [STAFF_TYPES.CUSTOMER_SERVICE_STAFF]: 1,
                [STAFF_TYPES.VEHICLE_INSPECTION_STAFF]: 1,
                [STAFF_TYPES.VEHICLE_CARE_STAFF]: 4,
                [STAFF_TYPES.WASH_OPERATOR]: 4,
            });
        }
    });

    test('distributes 25 customers per garage over the previous 30 days deterministically', () => {
        const first = buildCustomerSeedUsers(referenceDate);
        const second = buildCustomerSeedUsers(referenceDate);
        const dateKeys = new Set(
            first.map((customer) => customer.created_at.toISOString().slice(0, 10))
        );

        expect(first).toHaveLength(125);
        expect(first).toEqual(second);
        expect(dateKeys.size).toBe(30);
        expect(
            first.every((customer) => customer.created_at < referenceDate)
        ).toBe(true);

        for (const garage of GARAGE_SEEDS) {
            expect(
                first.filter(
                    (customer) => customer.preferred_garage_code === garage.garage_code
                )
            ).toHaveLength(25);
        }
    });

    test('produces schema-valid users and garages', () => {
        const users = buildSeedUsers(referenceDate);

        for (const user of users) {
            const error = new User({
                full_name: user.full_name,
                email: user.email,
                phone: normalizePhone(user.phone),
                password_hash: 'valid-seed-password-hash',
                role: user.role,
                phone_verified_at: user.created_at,
                onboarding_status: 'ACTIVE',
                created_at: user.created_at,
                updated_at: user.created_at,
            }).validateSync();

            expect(error).toBeUndefined();
        }

        for (const garage of GARAGE_SEEDS) {
            const error = new Garage(toGaragePayload(garage)).validateSync();

            expect(error).toBeUndefined();
        }
    });
});
