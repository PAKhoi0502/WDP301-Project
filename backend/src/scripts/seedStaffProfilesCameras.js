require('dotenv').config();

const User = require('../modules/users/user.model');
const Garage = require('../modules/garages/garage.model');
const StaffProfile = require('../modules/staff-profiles/staffProfile.model');
const CameraDevice = require('../modules/booking-arrivals/cameraDevice.model');
const { connectDB, disconnectDB } = require('../config/db');
const { USER_ROLES } = require('../shared/constants/roles.constant');
const {
    STAFF_EMPLOYMENT_STATUS,
    STAFF_TYPES,
} = require('../shared/constants/staff.constant');
const seedUser = require('./seedUser');
const seedStaffProfile = require('./seedStaffProfile');
const seedCameraDevice = require('./seedCameraDevice');
const {
    buildStaffProfileDefinitions,
} = require('./seedStaffProfile');
const {
    CAMERA_ADMIN_PHONE,
    buildCameraDeviceDefinitions,
} = require('./seedCameraDevice');
const { verifyUsersGarages } = require('./seedUsersGarages');
const { getSeedReferenceDate } = require('./seedTime');

const EXPECTED_STAFF_TYPES = Object.freeze({
    [STAFF_TYPES.CUSTOMER_SERVICE_STAFF]: 1,
    [STAFF_TYPES.VEHICLE_INSPECTION_STAFF]: 1,
    [STAFF_TYPES.VEHICLE_CARE_STAFF]: 4,
    [STAFF_TYPES.WASH_OPERATOR]: 4,
});

const verifyStaffProfilesCameras = async ({ referenceDate } = {}) => {
    const staffDefinitions = buildStaffProfileDefinitions(referenceDate);
    const cameraDefinitions = buildCameraDeviceDefinitions(referenceDate);
    const garageCodes = [...new Set(
        staffDefinitions.map((definition) => definition.garage_code)
    )];
    const [users, garages, admin] = await Promise.all([
        User.find({
            phone: {
                $in: staffDefinitions.map((definition) => definition.phone),
            },
        }).select('_id phone role').lean(),
        Garage.find({
            garage_code: { $in: garageCodes },
        }).select('_id garage_code').lean(),
        User.findOne({
            phone: CAMERA_ADMIN_PHONE,
            role: USER_ROLES.ADMIN,
        }).select('_id').lean(),
    ]);

    if (users.length !== staffDefinitions.length) {
        throw new Error(
            `Staff user verification failed: expected ${staffDefinitions.length}, found ${users.length}`
        );
    }

    if (!admin) {
        throw new Error('Camera owner verification failed');
    }

    const profiles = await StaffProfile.find({
        user_id: { $in: users.map((user) => user._id) },
    }).select(
        'user_id staff_code staff_type garage_id is_active employment_status'
    ).lean();
    const cameras = await CameraDevice.find({
        device_code: {
            $in: cameraDefinitions.map((definition) => definition.device_code),
        },
    }).select(
        '+api_key_hash device_code name garage_id location status created_by_id last_heartbeat_at last_event_at firmware_version client_version metadata'
    ).lean();

    if (profiles.length !== staffDefinitions.length) {
        throw new Error(
            `Staff profile verification failed: expected ${staffDefinitions.length}, found ${profiles.length}`
        );
    }

    if (cameras.length !== cameraDefinitions.length) {
        throw new Error(
            `Camera verification failed: expected ${cameraDefinitions.length}, found ${cameras.length}`
        );
    }

    const userByPhone = new Map(users.map((user) => [user.phone, user]));
    const profileByUserId = new Map(
        profiles.map((profile) => [String(profile.user_id), profile])
    );
    const garageByCode = new Map(
        garages.map((garage) => [garage.garage_code, garage])
    );
    const staffByGarage = {};

    for (const definition of staffDefinitions) {
        const user = userByPhone.get(definition.phone);
        const profile = user ? profileByUserId.get(String(user._id)) : null;
        const garage = garageByCode.get(definition.garage_code);

        if (!user || user.role !== USER_ROLES.STAFF) {
            throw new Error(`Invalid staff user mapping: ${definition.phone}`);
        }

        if (
            !profile
            || profile.staff_code !== definition.staff_code
            || profile.staff_type !== definition.staff_type
            || String(profile.garage_id) !== String(garage?._id)
        ) {
            throw new Error(`Invalid staff profile mapping: ${definition.staff_code}`);
        }

        const garageSummary = staffByGarage[definition.garage_code] || {
            total: 0,
            active: 0,
            staff_types: {},
        };

        garageSummary.total += 1;
        garageSummary.active += (
            profile.is_active
            && profile.employment_status === STAFF_EMPLOYMENT_STATUS.ACTIVE
        ) ? 1 : 0;
        garageSummary.staff_types[profile.staff_type] = (
            garageSummary.staff_types[profile.staff_type] || 0
        ) + 1;
        staffByGarage[definition.garage_code] = garageSummary;
    }

    for (const [garageCode, garageSummary] of Object.entries(staffByGarage)) {
        if (
            garageSummary.total !== 10
            || JSON.stringify(garageSummary.staff_types) !== JSON.stringify(EXPECTED_STAFF_TYPES)
        ) {
            throw new Error(
                `Staff distribution verification failed for ${garageCode}: ${JSON.stringify(garageSummary)}`
            );
        }
    }

    const cameraByCode = new Map(
        cameras.map((camera) => [camera.device_code, camera])
    );

    for (const definition of cameraDefinitions) {
        const camera = cameraByCode.get(definition.device_code);
        const garage = garageByCode.get(definition.garage_code);

        if (
            !camera
            || String(camera.garage_id) !== String(garage?._id)
            || String(camera.created_by_id) !== String(admin._id)
            || !/^[a-f0-9]{64}$/.test(camera.api_key_hash || '')
            || camera.metadata?.purpose !== definition.metadata.purpose
            || camera.metadata?.direction !== definition.metadata.direction
            || camera.metadata?.lane !== definition.metadata.lane
        ) {
            throw new Error(`Invalid camera mapping: ${definition.device_code}`);
        }
    }

    return {
        staff_profiles: {
            total: profiles.length,
            active: profiles.filter((profile) => (
                profile.is_active
                && profile.employment_status === STAFF_EMPLOYMENT_STATUS.ACTIVE
            )).length,
            by_garage: staffByGarage,
        },
        camera_devices: {
            total: cameras.length,
            active: cameras.filter((camera) => camera.status === 'ACTIVE').length,
            without_heartbeat: cameras.filter(
                (camera) => camera.last_heartbeat_at === null
            ).length,
            without_events: cameras.filter(
                (camera) => camera.last_event_at === null
            ).length,
            device_codes: cameras
                .map((camera) => camera.device_code)
                .sort(),
        },
    };
};

const seedStaffProfilesCameras = async ({
    dryRun = process.argv.includes('--dry-run'),
} = {}) => {
    const referenceDate = getSeedReferenceDate();

    if (dryRun) {
        return {
            dry_run: true,
            reference_date: referenceDate,
            users: await seedUser({
                referenceDate,
                dryRun: true,
            }),
            staff_profiles: await seedStaffProfile({
                referenceDate,
                dryRun: true,
            }),
            camera_devices: await seedCameraDevice({
                referenceDate,
                dryRun: true,
            }),
        };
    }

    await connectDB();

    const session = await User.startSession();
    const result = {
        dry_run: false,
        reference_date: referenceDate,
    };

    try {
        await session.withTransaction(async () => {
            result.users = await seedUser({
                session,
                referenceDate,
            });
            result.staff_profiles = await seedStaffProfile({
                session,
                referenceDate,
            });
            result.camera_devices = await seedCameraDevice({
                session,
                referenceDate,
            });
        });

        result.verification = {
            users: (
                await verifyUsersGarages({
                    referenceDate,
                    verifyUsers: true,
                    verifyGarages: false,
                })
            ).users,
            ...await verifyStaffProfilesCameras({ referenceDate }),
        };

        return result;
    } finally {
        await session.endSession();
        await disconnectDB();
    }
};

const run = async () => {
    try {
        const result = await seedStaffProfilesCameras();

        console.log('Staff profiles and camera devices seed completed');
        console.dir(result.verification || result, { depth: null });
    } catch (error) {
        console.error('Staff profiles and camera devices seed failed:', error);
        process.exitCode = 1;

        await disconnectDB().catch(() => {});
    }
};

if (require.main === module) {
    run();
}

module.exports = {
    EXPECTED_STAFF_TYPES,
    seedStaffProfilesCameras,
    verifyStaffProfilesCameras,
};
