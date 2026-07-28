const ServicePackage = require('../modules/service-packages/servicePackage.model');
const ServicePriceRule = require('../modules/service-price-rules/servicePriceRule.model');
const User = require('../modules/users/user.model');
const { USER_ROLES } = require('../shared/constants/roles.constant');
const { normalizePhone } = require('../shared/utils/phone');
const {
    buildServicePriceRuleDefinitions,
} = require('./seedServiceCatalogData');
const { getSeedReferenceDate } = require('./seedTime');

const PRICE_RULE_ADMIN_PHONE = '0900000001';

const assertUniqueServicePriceRuleDefinitions = (definitions) => {
    const ruleCodes = new Set();
    const signatures = new Set();

    for (const definition of definitions) {
        const signature = [
            definition.service_code,
            definition.garage_code || 'GLOBAL',
            definition.vehicle_type,
            definition.engine_type || 'ALL_ENGINES',
            definition.motorbike_cc_group || 'ALL_CC',
            definition.car_body_type || 'ALL_BODY_TYPES',
            definition.seat_min ?? 'NO_SEAT_MIN',
            definition.seat_max ?? 'NO_SEAT_MAX',
            definition.version,
        ].join(':');

        if (ruleCodes.has(definition.rule_code)) {
            throw new Error(
                `Duplicate service price rule code: ${definition.rule_code}`
            );
        }

        if (signatures.has(signature)) {
            throw new Error(
                `Duplicate service price rule signature: ${signature}`
            );
        }

        ruleCodes.add(definition.rule_code);
        signatures.add(signature);
    }
};

const summarizeServicePriceRules = (definitions) => ({
    planned: definitions.length,
    global: definitions.filter(
        (definition) => definition.garage_code === null
    ).length,
    garage_specific: definitions.filter(
        (definition) => definition.garage_code !== null
    ).length,
    by_vehicle_type: definitions.reduce((counts, definition) => ({
        ...counts,
        [definition.vehicle_type]: (
            counts[definition.vehicle_type] || 0
        ) + 1,
    }), {}),
});

const seedServicePriceRule = async ({
    session = null,
    referenceDate = getSeedReferenceDate(),
    dryRun = false,
} = {}) => {
    console.log('== Seeding service price rules ==');

    const definitions = buildServicePriceRuleDefinitions(referenceDate);

    assertUniqueServicePriceRuleDefinitions(definitions);

    const summary = summarizeServicePriceRules(definitions);

    if (dryRun) {
        console.table([
            {
                planned: summary.planned,
                global: summary.global,
                garage_specific: summary.garage_specific,
                ...summary.by_vehicle_type,
            },
        ]);

        return {
            ...summary,
            dry_run: true,
        };
    }

    const serviceCodes = [...new Set(
        definitions.map((definition) => definition.service_code)
    )];
    const packageQuery = ServicePackage.find({
        service_code: { $in: serviceCodes },
        is_active: true,
    }).select('_id service_code vehicle_type base_price');
    const adminQuery = User.findOne({
        phone: normalizePhone(PRICE_RULE_ADMIN_PHONE),
        role: USER_ROLES.ADMIN,
        is_active: true,
    }).select('_id');

    if (session) {
        packageQuery.session(session);
        adminQuery.session(session);
    }

    const [servicePackages, admin] = await Promise.all([
        packageQuery.lean(),
        adminQuery.lean(),
    ]);

    if (servicePackages.length !== serviceCodes.length) {
        throw new Error(
            `Service price rule package verification failed: expected ${serviceCodes.length}, found ${servicePackages.length}`
        );
    }

    if (!admin) {
        throw new Error(
            `Price rule admin not found: ${PRICE_RULE_ADMIN_PHONE}`
        );
    }

    const packageByCode = new Map(
        servicePackages.map((servicePackage) => [
            servicePackage.service_code,
            servicePackage,
        ])
    );
    const records = definitions.map((definition) => {
        const servicePackage = packageByCode.get(definition.service_code);

        if (!servicePackage) {
            throw new Error(
                `Price rule service package not found: ${definition.service_code}`
            );
        }

        if (servicePackage.vehicle_type !== definition.vehicle_type) {
            throw new Error(
                `Price rule vehicle type mismatch: ${definition.rule_code}`
            );
        }

        if (servicePackage.base_price !== definition.price) {
            throw new Error(
                `Price rule base price mismatch: ${definition.rule_code}`
            );
        }

        const payload = {
            rule_code: definition.rule_code,
            service_package_id: servicePackage._id,
            garage_id: null,
            vehicle_type: definition.vehicle_type,
            engine_type: definition.engine_type,
            motorbike_cc_group: definition.motorbike_cc_group,
            car_body_type: definition.car_body_type,
            seat_min: definition.seat_min,
            seat_max: definition.seat_max,
            price: definition.price,
            duration_minutes: definition.duration_minutes,
            wash_bay_duration_minutes: definition.wash_bay_duration_minutes,
            care_staff_duration_minutes: definition.care_staff_duration_minutes,
            effective_from: definition.effective_from,
            effective_to: definition.effective_to,
            version: definition.version,
            is_active: definition.is_active,
            note: definition.note,
            created_by: admin._id,
            updated_by: admin._id,
            created_at: definition.effective_from,
            updated_at: definition.effective_from,
        };
        const validationError = new ServicePriceRule(payload).validateSync();

        if (validationError) {
            throw validationError;
        }

        return payload;
    });
    const operations = records.map((record) => ({
        updateOne: {
            filter: {
                rule_code: record.rule_code,
            },
            update: {
                $set: {
                    rule_code: record.rule_code,
                    service_package_id: record.service_package_id,
                    garage_id: record.garage_id,
                    vehicle_type: record.vehicle_type,
                    engine_type: record.engine_type,
                    motorbike_cc_group: record.motorbike_cc_group,
                    car_body_type: record.car_body_type,
                    seat_min: record.seat_min,
                    seat_max: record.seat_max,
                    price: record.price,
                    duration_minutes: record.duration_minutes,
                    wash_bay_duration_minutes: record.wash_bay_duration_minutes,
                    care_staff_duration_minutes: record.care_staff_duration_minutes,
                    effective_from: record.effective_from,
                    effective_to: record.effective_to,
                    version: record.version,
                    is_active: record.is_active,
                    note: record.note,
                    updated_by: record.updated_by,
                    updated_at: record.updated_at,
                },
                $setOnInsert: {
                    created_by: record.created_by,
                    created_at: record.created_at,
                },
            },
            upsert: true,
            timestamps: false,
        },
    }));
    const result = await ServicePriceRule.bulkWrite(operations, {
        ordered: true,
        session,
    });
    const ruleCodes = records.map((record) => record.rule_code);
    const staleResult = await ServicePriceRule.updateMany(
        {
            rule_code: {
                $type: 'string',
                $nin: ruleCodes,
            },
            is_active: true,
        },
        {
            $set: {
                is_active: false,
                updated_by: admin._id,
            },
        },
        {
            session,
        }
    );
    const completedSummary = {
        ...summary,
        dry_run: false,
        matched: result.matchedCount,
        modified: result.modifiedCount,
        inserted: result.upsertedCount,
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
    console.log('Service price rules seeding completed');

    return completedSummary;
};

module.exports = seedServicePriceRule;
module.exports.PRICE_RULE_ADMIN_PHONE = PRICE_RULE_ADMIN_PHONE;
module.exports.assertUniqueServicePriceRuleDefinitions = (
    assertUniqueServicePriceRuleDefinitions
);
module.exports.summarizeServicePriceRules = summarizeServicePriceRules;
