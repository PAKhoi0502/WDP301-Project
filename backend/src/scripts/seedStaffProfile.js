const StaffProfile = require('../modules/staff-profiles/staffProfile.model');
const User = require('../modules/users/user.model');
const Garage = require('../modules/garages/garage.model');
const { USER_ROLES } = require('../shared/constants/roles.constant');
const { STAFF_TYPES } = require('../shared/constants/staff.constant');

const seedStaffProfiles = [
    {
        phone: '0900000002',
        staff_code: 'STF001',
        staff_type: STAFF_TYPES.CUSTOMER_SERVICE_STAFF,
        garage_code: 'GAR001',
        is_active: true,
    },
    {
        phone: '0900000003',
        staff_code: 'CARE001',
        staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
        garage_code: 'GAR001',
        is_active: true,
    },
    {
        phone: '0900000004',
        staff_code: 'CARE002',
        staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
        garage_code: 'GAR001',
        is_active: true,
    },
    {
        phone: '0900000005',
        staff_code: 'CARE003',
        staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
        garage_code: 'GAR002',
        is_active: true,
    },
    {
        phone: '0900000006',
        staff_code: 'CARE004',
        staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
        garage_code: 'GAR002',
        is_active: true,
    },
    {
        phone: '0900000007',
        staff_code: 'CARE005',
        staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
        garage_code: 'GAR003',
        is_active: true,
    },
    {
        phone: '0900000008',
        staff_code: 'CARE006',
        staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
        garage_code: 'GAR003',
        is_active: true,
    },
    {
        phone: '0900000009',
        staff_code: 'CARE007',
        staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
        garage_code: 'GAR004',
        is_active: true,
    },
    {
        phone: '0900000010',
        staff_code: 'CARE008',
        staff_type: STAFF_TYPES.VEHICLE_CARE_STAFF,
        garage_code: 'GAR004',
        is_active: true,
    },
];

const seedStaffProfile = async () => {
    console.log('== Seeding staff profiles ==');

    for (const staffProfile of seedStaffProfiles) {
        const user = await User.findOne({
            phone: staffProfile.phone,
            role: USER_ROLES.STAFF,
        }).select('_id');

        if (!user) {
            console.log(`Skipped staff profile: ${staffProfile.phone}`);
            continue;
        }

        const garage = await Garage.findOne({
            garage_code: staffProfile.garage_code,
        }).select('_id');

        const payload = {
            user_id: user._id,
            staff_code: staffProfile.staff_code,
            staff_type: staffProfile.staff_type,
            garage_id: garage ? garage._id : null,
            is_active: staffProfile.is_active,
        };

        const existingStaffProfile = await StaffProfile.findOne({
            user_id: user._id,
        }).select('_id');

        if (existingStaffProfile) {
            await StaffProfile.updateOne(
                { _id: existingStaffProfile._id },
                { $set: payload },
                { runValidators: true }
            );

            console.log(`Updated staff profile: ${payload.staff_code}`);
            continue;
        }

        await StaffProfile.create(payload);

        console.log(`Created staff profile: ${payload.staff_code}`);
    }

    console.log('Staff profiles seeding completed');
};

module.exports = seedStaffProfile;
