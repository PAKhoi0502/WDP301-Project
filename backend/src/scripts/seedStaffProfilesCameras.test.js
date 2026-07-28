const mongoose = require('mongoose');

const StaffProfile = require('../modules/staff-profiles/staffProfile.model');
const CameraDevice = require('../modules/booking-arrivals/cameraDevice.model');
const {
    STAFF_EMPLOYMENT_STATUS,
    STAFF_TYPES,
} = require('../shared/constants/staff.constant');
const {
    CAMERA_DEVICE_STATUSES,
} = require('../shared/constants/bookingArrival.constant');
const {
    GARAGE_SEEDS,
    buildStaffSeedUsers,
} = require('./seedCatalog');
const {
    buildStaffProfileDefinitions,
    assertUniqueStaffProfileDefinitions,
} = require('./seedStaffProfile');
const {
    buildCameraDeviceDefinitions,
    assertUniqueCameraDeviceDefinitions,
    deriveCameraDeviceKey,
    getCameraSeedMasterKey,
} = require('./seedCameraDevice');
const { getSeedReferenceDate } = require('./seedTime');

describe('staff profiles and camera devices seed catalog', () => {
    const referenceDate = getSeedReferenceDate({
        value: '2026-07-28',
        timezoneOffset: '+07:00',
    });
    const originalMasterKey = process.env.SEED_CAMERA_DEVICE_MASTER_KEY;
    const originalStaffPassword = process.env.SEED_STAFF_PASSWORD;

    afterEach(() => {
        if (originalMasterKey === undefined) {
            delete process.env.SEED_CAMERA_DEVICE_MASTER_KEY;
        } else {
            process.env.SEED_CAMERA_DEVICE_MASTER_KEY = originalMasterKey;
        }

        if (originalStaffPassword === undefined) {
            delete process.env.SEED_STAFF_PASSWORD;
        } else {
            process.env.SEED_STAFF_PASSWORD = originalStaffPassword;
        }
    });

    test('builds ten staff profiles per garage with the agreed distribution', () => {
        const staffUsers = buildStaffSeedUsers(referenceDate);
        const definitions = buildStaffProfileDefinitions(referenceDate);

        expect(staffUsers).toHaveLength(50);
        expect(definitions).toHaveLength(50);
        expect(() => assertUniqueStaffProfileDefinitions(definitions)).not.toThrow();

        for (const garage of GARAGE_SEEDS) {
            const garageDefinitions = definitions.filter(
                (definition) => definition.garage_code === garage.garage_code
            );
            const typeCounts = garageDefinitions.reduce((counts, definition) => ({
                ...counts,
                [definition.staff_type]: (counts[definition.staff_type] || 0) + 1,
            }), {});

            expect(garageDefinitions).toHaveLength(10);
            expect(typeCounts).toEqual({
                [STAFF_TYPES.CUSTOMER_SERVICE_STAFF]: 1,
                [STAFF_TYPES.VEHICLE_INSPECTION_STAFF]: 1,
                [STAFF_TYPES.VEHICLE_CARE_STAFF]: 4,
                [STAFF_TYPES.WASH_OPERATOR]: 4,
            });
        }
    });

    test('produces schema-valid active staff profiles', () => {
        const definitions = buildStaffProfileDefinitions(referenceDate);

        for (const definition of definitions) {
            const error = new StaffProfile({
                user_id: new mongoose.Types.ObjectId(),
                staff_code: definition.staff_code,
                staff_type: definition.staff_type,
                garage_id: new mongoose.Types.ObjectId(),
                is_active: true,
                employment_status: STAFF_EMPLOYMENT_STATUS.ACTIVE,
                created_at: definition.created_at,
                updated_at: definition.created_at,
            }).validateSync();

            expect(error).toBeUndefined();
            expect(definition.created_at.getTime()).toBeLessThan(
                referenceDate.getTime()
            );
        }
    });

    test('builds one schema-valid entry camera for every garage', () => {
        const definitions = buildCameraDeviceDefinitions(referenceDate);

        expect(definitions).toHaveLength(5);
        expect(() => assertUniqueCameraDeviceDefinitions(definitions)).not.toThrow();

        for (const definition of definitions) {
            const error = new CameraDevice({
                device_code: definition.device_code,
                name: definition.name,
                garage_id: new mongoose.Types.ObjectId(),
                location: definition.location,
                status: CAMERA_DEVICE_STATUSES.ACTIVE,
                api_key_hash: 'a'.repeat(64),
                created_by_id: new mongoose.Types.ObjectId(),
                metadata: definition.metadata,
                created_at: definition.created_at,
                updated_at: definition.created_at,
            }).validateSync();

            expect(error).toBeUndefined();
            expect(definition.metadata).toEqual({
                purpose: 'ARRIVAL_PLATE_SCAN',
                direction: 'ENTRY',
                lane: '01',
            });
        }
    });

    test('derives deterministic and device-specific keys from the configured source', () => {
        process.env.SEED_CAMERA_DEVICE_MASTER_KEY = 'camera-master-for-test';
        process.env.SEED_STAFF_PASSWORD = 'staff-password-for-test';

        const source = getCameraSeedMasterKey();
        const first = deriveCameraDeviceKey(
            source.value,
            'CAM-GAR001-ENTRY-01'
        );
        const repeated = deriveCameraDeviceKey(
            source.value,
            'CAM-GAR001-ENTRY-01'
        );
        const other = deriveCameraDeviceKey(
            source.value,
            'CAM-GAR002-ENTRY-01'
        );

        expect(source.source).toBe('SEED_CAMERA_DEVICE_MASTER_KEY');
        expect(first).toBe(repeated);
        expect(first).not.toBe(other);
        expect(first).toMatch(/^[a-f0-9]{64}$/);

        delete process.env.SEED_CAMERA_DEVICE_MASTER_KEY;

        expect(getCameraSeedMasterKey()).toEqual({
            value: 'staff-password-for-test',
            source: 'SEED_STAFF_PASSWORD',
        });
    });
});
