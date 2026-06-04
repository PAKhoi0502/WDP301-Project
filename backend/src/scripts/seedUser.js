const bcrypt = require('bcryptjs');

const User = require('../modules/users/user.model');
const { USER_ROLES } = require('../shared/constants/roles.constant');

const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);

const seedUsers = [
    {
        full_name: 'System Admin',
        email: 'admin@autowash.local',
        phone: '0900000001',
        password: process.env.SEED_ADMIN_PASSWORD || 'Admin@123',
        role: USER_ROLES.ADMIN,
        avatar_url: '',
        is_active: true,
    },
    {
        full_name: 'Garage Staff',
        email: 'staff@autowash.local',
        phone: '0900000002',
        password: process.env.SEED_STAFF_PASSWORD || 'Staff@123',
        role: USER_ROLES.STAFF,
        avatar_url: '',
        is_active: true,
    },
    {
        full_name: 'Nguyen Van An',
        email: 'customer01@autowash.local',
        phone: '0901000001',
        password: 'Customer@123',
        role: USER_ROLES.CUSTOMER,
        avatar_url: '',
        is_active: true,
    },
    {
        full_name: 'Tran Thi Bich',
        email: 'customer02@autowash.local',
        phone: '0901000002',
        password: 'Customer@123',
        role: USER_ROLES.CUSTOMER,
        avatar_url: '',
        is_active: true,
    },
    {
        full_name: 'Le Van Binh',
        email: 'customer03@autowash.local',
        phone: '0901000003',
        password: 'Customer@123',
        role: USER_ROLES.CUSTOMER,
        avatar_url: '',
        is_active: true,
    },
    {
        full_name: 'Pham Thi Cam',
        email: 'customer04@autowash.local',
        phone: '0901000004',
        password: 'Customer@123',
        role: USER_ROLES.CUSTOMER,
        avatar_url: '',
        is_active: true,
    },
    {
        full_name: 'Huynh Van Cuong',
        email: 'customer05@autowash.local',
        phone: '0901000005',
        password: 'Customer@123',
        role: USER_ROLES.CUSTOMER,
        avatar_url: '',
        is_active: true,
    },
    {
        full_name: 'Dang Thi Diem',
        email: 'customer06@autowash.local',
        phone: '0901000006',
        password: 'Customer@123',
        role: USER_ROLES.CUSTOMER,
        avatar_url: '',
        is_active: true,
    },
    {
        full_name: 'Bui Truong Giang',
        email: 'customer07@autowash.local',
        phone: '0901000007',
        password: 'Customer@123',
        role: USER_ROLES.CUSTOMER,
        avatar_url: '',
        is_active: true,
    },
    {
        full_name: 'Vo Thi Han',
        email: 'customer08@autowash.local',
        phone: '0901000008',
        password: 'Customer@123',
        role: USER_ROLES.CUSTOMER,
        avatar_url: '',
        is_active: true,
    },
    {
        full_name: 'Ngo Thu Hoai',
        email: 'customer09@autowash.local',
        phone: '0901000009',
        password: 'Customer@123',
        role: USER_ROLES.CUSTOMER,
        avatar_url: '',
        is_active: true,
    },
    {
        full_name: 'Do Van Hung',
        email: 'customer10@autowash.local',
        phone: '0901000010',
        password: 'Customer@123',
        role: USER_ROLES.CUSTOMER,
        avatar_url: '',
        is_active: true,
    },
];

const seedUser = async () => {
    console.log('== Seeding users ==');

    for (const user of seedUsers) {
        const password_hash = await bcrypt.hash(user.password, BCRYPT_SALT_ROUNDS);

        const payload = {
            full_name: user.full_name,
            email: user.email.trim().toLowerCase(),
            phone: user.phone.trim(),
            password_hash,
            role: user.role,
            avatar_url: user.avatar_url,
            is_active: user.is_active,
        };

        const existingUser = await User.findOne({ phone: payload.phone }).select('_id');

        if (existingUser) {
            await User.updateOne(
                { _id: existingUser._id },
                { $set: payload },
                { runValidators: true }
            );

            console.log(`Updated user: ${payload.phone}`);
            continue;
        }

        await User.create(payload);

        console.log(`Created user: ${payload.phone}`);
    }

    console.log('Users seeding completed');
};

module.exports = seedUser;