const StaffProfile = require('../modules/staff-profiles/staffProfile.model');
const User = require('../modules/users/user.model');
const Garage = require('../modules/garages/garage.model');
const { USER_ROLES } = require('../shared/constants/roles.constant');
const {
    STAFF_EMPLOYMENT_STATUS,
} = require('../shared/constants/staff.constant');
const { normalizePhone } = require('../shared/utils/phone');
const { buildStaffSeedUsers } = require('./seedCatalog');
const { getSeedReferenceDate } = require('./seedTime');

const buildStaffProfileDefinitions = (referenceDate = getSeedReferenceDate()) => (
    buildStaffSeedUsers(referenceDate).map((staff) => ({
        phone: normalizePhone(staff.phone),
        staff_code: staff.staff_code,
        staff_type: staff.staff_type,
        garage_code: staff.garage_code,
        created_at: staff.created_at,
    }))
);

const assertUniqueStaffProfileDefinitions = (definitions) => {
    const phones = new Set();
    const staffCodes = new Set();

    for (const definition of definitions) {
        if (phones.has(definition.phone)) {
            throw new Error(`Duplicate staff profile phone: ${definition.phone}`);
        }

        if (staffCodes.has(definition.staff_code)) {
            throw new Error(`Duplicate staff code: ${definition.staff_code}`);
        }

        phones.add(definition.phone);
        staffCodes.add(definition.staff_code);
    }
};

const summarizeStaffProfiles = (definitions) => {
    const byGarage = {};

    for (const definition of definitions) {
        const garage = byGarage[definition.garage_code] || {
            total: 0,
            staff_types: {},
        };

        garage.total += 1;
        garage.staff_types[definition.staff_type] = (
            garage.staff_types[definition.staff_type] || 0
        ) + 1;
        byGarage[definition.garage_code] = garage;
    }

    return {
        planned: definitions.length,
        garages: Object.keys(byGarage).length,
        by_garage: byGarage,
    };
};

const seedStaffProfile = async ({
    session = null,
    referenceDate = getSeedReferenceDate(),
    dryRun = false,
} = {}) => {
    console.log('== Seeding staff profiles ==');

    const definitions = buildStaffProfileDefinitions(referenceDate);

    assertUniqueStaffProfileDefinitions(definitions);

    const summary = summarizeStaffProfiles(definitions);

    if (dryRun) {
        console.table(
            Object.entries(summary.by_garage).map(([garageCode, garage]) => ({
                garage_code: garageCode,
                total: garage.total,
                ...garage.staff_types,
            }))
        );

        return {
            ...summary,
            dry_run: true,
        };
    }

    const userQuery = User.find({
        phone: { $in: definitions.map((definition) => definition.phone) },
    }).select('_id phone role');
    const garageQuery = Garage.find({
        garage_code: {
            $in: [...new Set(
                definitions.map((definition) => definition.garage_code)
            )],
        },
    }).select('_id garage_code');

    if (session) {
        userQuery.session(session);
        garageQuery.session(session);
    }

    const [users, garages] = await Promise.all([
        userQuery.lean(),
        garageQuery.lean(),
    ]);
    const userByPhone = new Map(users.map((user) => [user.phone, user]));
    const garageByCode = new Map(
        garages.map((garage) => [garage.garage_code, garage])
    );
    const records = definitions.map((definition) => {
        const user = userByPhone.get(definition.phone);
        const garage = garageByCode.get(definition.garage_code);

        if (!user) {
            throw new Error(`Staff user not found: ${definition.phone}`);
        }

        if (user.role !== USER_ROLES.STAFF) {
            throw new Error(`Staff profile user has invalid role: ${definition.phone}`);
        }

        if (!garage) {
            throw new Error(`Staff profile garage not found: ${definition.garage_code}`);
        }

        const payload = {
            user_id: user._id,
            staff_code: definition.staff_code,
            staff_type: definition.staff_type,
            garage_id: garage._id,
        };
        const validationError = new StaffProfile({
            ...payload,
            is_active: true,
            employment_status: STAFF_EMPLOYMENT_STATUS.ACTIVE,
            status_reason: null,
            suspended_at: null,
            terminated_at: null,
            status_changed_at: null,
            status_changed_by: null,
            created_at: definition.created_at,
            updated_at: definition.created_at,
        }).validateSync();

        if (validationError) {
            throw validationError;
        }

        return {
            ...payload,
            created_at: definition.created_at,
        };
    });
    const expectedUserByStaffCode = new Map(
        records.map((record) => [record.staff_code, String(record.user_id)])
    );
    const existingQuery = StaffProfile.find({
        staff_code: { $in: records.map((record) => record.staff_code) },
    }).select('user_id staff_code');

    if (session) {
        existingQuery.session(session);
    }

    const existingProfiles = await existingQuery.lean();

    for (const profile of existingProfiles) {
        const expectedUserId = expectedUserByStaffCode.get(profile.staff_code);

        if (expectedUserId !== String(profile.user_id)) {
            throw new Error(`Staff code belongs to another user: ${profile.staff_code}`);
        }
    }

    const operations = records.map((record) => ({
        updateOne: {
            filter: { user_id: record.user_id },
            update: {
                $set: {
                    staff_code: record.staff_code,
                    staff_type: record.staff_type,
                    garage_id: record.garage_id,
                },
                $setOnInsert: {
                    is_active: true,
                    employment_status: STAFF_EMPLOYMENT_STATUS.ACTIVE,
                    status_reason: null,
                    suspended_at: null,
                    terminated_at: null,
                    status_changed_at: null,
                    status_changed_by: null,
                    created_at: record.created_at,
                    updated_at: record.created_at,
                },
            },
            upsert: true,
            timestamps: false,
        },
    }));
    const result = await StaffProfile.bulkWrite(operations, {
        ordered: true,
        session,
    });
    const completedSummary = {
        ...summary,
        dry_run: false,
        matched: result.matchedCount,
        modified: result.modifiedCount,
        inserted: result.upsertedCount,
    };

    console.table([{
        planned: completedSummary.planned,
        matched: completedSummary.matched,
        modified: completedSummary.modified,
        inserted: completedSummary.inserted,
    }]);
    console.log('Staff profiles seeding completed');

    return completedSummary;
};

module.exports = seedStaffProfile;
module.exports.buildStaffProfileDefinitions = buildStaffProfileDefinitions;
module.exports.assertUniqueStaffProfileDefinitions = assertUniqueStaffProfileDefinitions;
module.exports.summarizeStaffProfiles = summarizeStaffProfiles;
