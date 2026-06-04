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
