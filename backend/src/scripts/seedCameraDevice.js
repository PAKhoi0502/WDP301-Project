const crypto = require('crypto');

const CameraDevice = require('../modules/booking-arrivals/cameraDevice.model');
const Garage = require('../modules/garages/garage.model');
const User = require('../modules/users/user.model');
const { USER_ROLES } = require('../shared/constants/roles.constant');
const { normalizePhone } = require('../shared/utils/phone');
const { hashDeviceKey } = require('../modules/booking-arrivals/cameraDevice.middleware');
const { CAMERA_DEVICE_SEEDS } = require('./seedCatalog');
const { atLocalDayAndMinute, getSeedReferenceDate } = require('./seedTime');

const CAMERA_ADMIN_PHONE = normalizePhone('0900000001');

const getCameraSeedMasterKey = () => {
    const configuredMasterKey = process.env.SEED_CAMERA_DEVICE_MASTER_KEY?.trim();

    if (configuredMasterKey) {
        return {
            value: configuredMasterKey,
            source: 'SEED_CAMERA_DEVICE_MASTER_KEY',
        };
    }

    const staffPassword = process.env.SEED_STAFF_PASSWORD?.trim();

    if (staffPassword) {
        return {
            value: staffPassword,
            source: 'SEED_STAFF_PASSWORD',
        };
    }

    throw new Error(
        'Missing camera seed key source: SEED_CAMERA_DEVICE_MASTER_KEY or SEED_STAFF_PASSWORD'
    );
};

const deriveCameraDeviceKey = (masterKey, deviceCode) => crypto
    .createHmac('sha256', masterKey)
    .update(`seed-camera-device:${deviceCode}`)
    .digest('hex');

const buildCameraDeviceDefinitions = (
    referenceDate = getSeedReferenceDate()
) => CAMERA_DEVICE_SEEDS.map((camera, index) => ({
    ...camera,
    created_at: atLocalDayAndMinute({
        referenceDate,
        dayOffset: -40 + index * 3,
        minuteOfDay: 9 * 60 + 20 + index * 31,
    }),
}));

const assertUniqueCameraDeviceDefinitions = (definitions) => {
    const deviceCodes = new Set();
    const garages = new Set();

    for (const definition of definitions) {
        if (deviceCodes.has(definition.device_code)) {
            throw new Error(`Duplicate camera device code: ${definition.device_code}`);
        }

        if (garages.has(definition.garage_code)) {
            throw new Error(`Duplicate entry camera garage: ${definition.garage_code}`);
        }

        deviceCodes.add(definition.device_code);
        garages.add(definition.garage_code);
    }
};

const seedCameraDevice = async ({
    session = null,
    referenceDate = getSeedReferenceDate(),
    dryRun = false,
} = {}) => {
    console.log('== Seeding camera devices ==');

    const definitions = buildCameraDeviceDefinitions(referenceDate);
    const masterKey = getCameraSeedMasterKey();

    assertUniqueCameraDeviceDefinitions(definitions);

    if (dryRun) {
        const summary = {
            dry_run: true,
            planned: definitions.length,
            key_source: masterKey.source,
            device_codes: definitions.map((definition) => definition.device_code),
        };

        console.table(definitions.map((definition) => ({
            device_code: definition.device_code,
            garage_code: definition.garage_code,
            status: definition.status,
            direction: definition.metadata.direction,
        })));

        return summary;
    }

    const garageQuery = Garage.find({
        garage_code: {
            $in: definitions.map((definition) => definition.garage_code),
        },
    }).select('_id garage_code');
    const adminQuery = User.findOne({
        phone: CAMERA_ADMIN_PHONE,
        role: USER_ROLES.ADMIN,
    }).select('_id role');

    if (session) {
        garageQuery.session(session);
        adminQuery.session(session);
    }

    const [garages, admin] = await Promise.all([
        garageQuery.lean(),
        adminQuery.lean(),
    ]);

    if (!admin) {
        throw new Error(`Camera seed admin not found: ${CAMERA_ADMIN_PHONE}`);
    }

    const garageByCode = new Map(
        garages.map((garage) => [garage.garage_code, garage])
    );
    const records = definitions.map((definition) => {
        const garage = garageByCode.get(definition.garage_code);

        if (!garage) {
            throw new Error(`Camera garage not found: ${definition.garage_code}`);
        }

        const apiKeyHash = hashDeviceKey(
            deriveCameraDeviceKey(masterKey.value, definition.device_code)
        );
        const payload = {
            device_code: definition.device_code,
            name: definition.name,
            garage_id: garage._id,
            location: definition.location,
            status: definition.status,
            api_key_hash: apiKeyHash,
            created_by_id: admin._id,
            rotated_by_id: null,
            key_rotated_at: null,
            last_heartbeat_at: null,
            last_event_at: null,
            firmware_version: null,
            client_version: null,
            metadata: definition.metadata,
            created_at: definition.created_at,
            updated_at: definition.created_at,
        };
        const validationError = new CameraDevice(payload).validateSync();

        if (validationError) {
            throw validationError;
        }

        return payload;
    });
    const operations = records.map((record) => ({
        updateOne: {
            filter: { device_code: record.device_code },
            update: {
                $set: {
                    name: record.name,
                    garage_id: record.garage_id,
                    location: record.location,
                    'metadata.purpose': record.metadata.purpose,
                    'metadata.direction': record.metadata.direction,
                    'metadata.lane': record.metadata.lane,
                },
                $setOnInsert: {
                    status: record.status,
                    api_key_hash: record.api_key_hash,
                    created_by_id: record.created_by_id,
                    rotated_by_id: record.rotated_by_id,
                    key_rotated_at: record.key_rotated_at,
                    last_heartbeat_at: record.last_heartbeat_at,
                    last_event_at: record.last_event_at,
                    firmware_version: record.firmware_version,
                    client_version: record.client_version,
                    created_at: record.created_at,
                    updated_at: record.updated_at,
                },
            },
            upsert: true,
            timestamps: false,
        },
    }));
    const result = await CameraDevice.bulkWrite(operations, {
        ordered: true,
        session,
    });
    const summary = {
        dry_run: false,
        planned: records.length,
        matched: result.matchedCount,
        modified: result.modifiedCount,
        inserted: result.upsertedCount,
        key_source: masterKey.source,
        device_codes: records.map((record) => record.device_code),
    };

    console.table([{
        planned: summary.planned,
        matched: summary.matched,
        modified: summary.modified,
        inserted: summary.inserted,
    }]);
    console.log('Camera devices seeding completed');

    return summary;
};

module.exports = seedCameraDevice;
module.exports.CAMERA_ADMIN_PHONE = CAMERA_ADMIN_PHONE;
module.exports.getCameraSeedMasterKey = getCameraSeedMasterKey;
module.exports.deriveCameraDeviceKey = deriveCameraDeviceKey;
module.exports.buildCameraDeviceDefinitions = buildCameraDeviceDefinitions;
module.exports.assertUniqueCameraDeviceDefinitions = assertUniqueCameraDeviceDefinitions;
