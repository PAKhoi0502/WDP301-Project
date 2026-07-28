const ServicePackage = require('../modules/service-packages/servicePackage.model');
const {
    SERVICE_PACKAGE_TYPES,
} = require('../shared/constants/servicePackage.constant');
const {
    buildServicePackageDefinitions,
} = require('./seedServiceCatalogData');
const { getSeedReferenceDate } = require('./seedTime');

const assertUniqueServicePackageDefinitions = (definitions) => {
    const serviceCodes = new Set();
    const displayKeys = new Set();

    for (const definition of definitions) {
        const displayKey = `${definition.vehicle_type}:${definition.name}`;

        if (serviceCodes.has(definition.service_code)) {
            throw new Error(
                `Duplicate service package code: ${definition.service_code}`
            );
        }

        if (displayKeys.has(displayKey)) {
            throw new Error(`Duplicate service package name: ${displayKey}`);
        }

        if (
            definition.service_type === SERVICE_PACKAGE_TYPES.COMBO
            && definition.steps_template.length > 0
        ) {
            throw new Error(
                `Combo cannot define operational steps: ${definition.service_code}`
            );
        }

        serviceCodes.add(definition.service_code);
        displayKeys.add(displayKey);
    }
};

const summarizeServicePackages = (definitions) => ({
    planned: definitions.length,
    by_vehicle_type: definitions.reduce((counts, definition) => ({
        ...counts,
        [definition.vehicle_type]: (
            counts[definition.vehicle_type] || 0
        ) + 1,
    }), {}),
    by_service_type: definitions.reduce((counts, definition) => ({
        ...counts,
        [definition.service_type]: (
            counts[definition.service_type] || 0
        ) + 1,
    }), {}),
});

const toPayload = ({
    definition,
    includedServiceIds = [],
}) => ({
    service_code: definition.service_code,
    name: definition.name,
    vehicle_type: definition.vehicle_type,
    service_type: definition.service_type,
    description: definition.description,
    base_price: definition.base_price,
    duration_minutes: definition.duration_minutes,
    countdown_duration_seconds: definition.duration_minutes * 60,
    transition_mode: definition.transition_mode,
    wash_bay_duration_minutes: definition.wash_bay_duration_minutes,
    wash_bay_start_offset_minutes: definition.wash_bay_start_offset_minutes,
    points_earned: definition.points_earned,
    requires_wash_bay: definition.requires_wash_bay,
    requires_care_staff: definition.requires_care_staff,
    care_staff_type: definition.care_staff_type,
    care_staff_required_count: definition.care_staff_required_count,
    care_staff_duration_minutes: definition.care_staff_duration_minutes,
    care_staff_start_offset_minutes: definition.care_staff_start_offset_minutes,
    allow_duplicate_in_booking: false,
    included_service_ids: includedServiceIds,
    steps_template: definition.steps_template,
    is_active: definition.is_active,
});

const validatePayload = (payload, createdAt) => {
    const validationError = new ServicePackage({
        ...payload,
        created_at: createdAt,
        updated_at: createdAt,
    }).validateSync();

    if (validationError) {
        throw validationError;
    }
};

const seedDefinitionGroup = async ({
    definitions,
    idByCode,
    session,
}) => {
    const operations = definitions.map((definition) => {
        const includedServiceIds = definition.included_service_codes.map(
            (serviceCode) => {
                const serviceId = idByCode.get(serviceCode);

                if (!serviceId) {
                    throw new Error(
                        `Included service not found: ${definition.service_code}:${serviceCode}`
                    );
                }

                return serviceId;
            }
        );
        const payload = toPayload({
            definition,
            includedServiceIds,
        });

        validatePayload(payload, definition.created_at);

        return {
            updateOne: {
                filter: {
                    service_code: definition.service_code,
                },
                update: {
                    $set: {
                        ...payload,
                        updated_at: definition.created_at,
                    },
                    $setOnInsert: {
                        created_at: definition.created_at,
                    },
                },
                upsert: true,
                timestamps: false,
            },
        };
    });

    if (operations.length === 0) {
        return {
            matchedCount: 0,
            modifiedCount: 0,
            upsertedCount: 0,
        };
    }

    const result = await ServicePackage.bulkWrite(operations, {
        ordered: true,
        session,
    });
    const codes = definitions.map((definition) => definition.service_code);
    const packageQuery = ServicePackage.find({
        service_code: { $in: codes },
    }).select('_id service_code');

    if (session) {
        packageQuery.session(session);
    }

    const packages = await packageQuery.lean();

    for (const servicePackage of packages) {
        idByCode.set(servicePackage.service_code, servicePackage._id);
    }

    if (packages.length !== definitions.length) {
        throw new Error(
            `Service package upsert verification failed: expected ${definitions.length}, found ${packages.length}`
        );
    }

    return result;
};

const seedServicePackage = async ({
    session = null,
    referenceDate = getSeedReferenceDate(),
    dryRun = false,
} = {}) => {
    console.log('== Seeding service packages ==');

    const definitions = buildServicePackageDefinitions(referenceDate);

    assertUniqueServicePackageDefinitions(definitions);

    const summary = summarizeServicePackages(definitions);

    if (dryRun) {
        console.table([
            {
                planned: summary.planned,
                ...summary.by_vehicle_type,
                ...summary.by_service_type,
            },
        ]);

        return {
            ...summary,
            dry_run: true,
        };
    }

    const baseDefinitions = definitions.filter(
        (definition) => definition.service_type !== SERVICE_PACKAGE_TYPES.COMBO
    );
    const comboDefinitions = definitions.filter(
        (definition) => definition.service_type === SERVICE_PACKAGE_TYPES.COMBO
    );
    const idByCode = new Map();
    const baseResult = await seedDefinitionGroup({
        definitions: baseDefinitions,
        idByCode,
        session,
    });
    const comboResult = await seedDefinitionGroup({
        definitions: comboDefinitions,
        idByCode,
        session,
    });
    const serviceCodes = definitions.map(
        (definition) => definition.service_code
    );
    const staleResult = await ServicePackage.updateMany(
        {
            service_code: {
                $type: 'string',
                $nin: serviceCodes,
            },
            is_active: true,
        },
        {
            $set: {
                is_active: false,
            },
        },
        {
            session,
        }
    );
    const completedSummary = {
        ...summary,
        dry_run: false,
        matched: baseResult.matchedCount + comboResult.matchedCount,
        modified: baseResult.modifiedCount + comboResult.modifiedCount,
        inserted: baseResult.upsertedCount + comboResult.upsertedCount,
        retired: staleResult.modifiedCount,
    };

    console.table([
        {
            planned: completedSummary.planned,
            matched: completedSummary.matched,
            modified: completedSummary.modified,
            inserted: completedSummary.inserted,
            retired: completedSummary.retired,
        },
    ]);
    console.log('Service packages seeding completed');

    return completedSummary;
};

module.exports = seedServicePackage;
module.exports.assertUniqueServicePackageDefinitions = (
    assertUniqueServicePackageDefinitions
);
module.exports.summarizeServicePackages = summarizeServicePackages;
