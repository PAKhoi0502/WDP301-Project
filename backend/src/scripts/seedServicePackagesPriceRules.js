require('dotenv').config();

const ServicePackage = require('../modules/service-packages/servicePackage.model');
const ServicePriceRule = require('../modules/service-price-rules/servicePriceRule.model');
const { connectDB, disconnectDB } = require('../config/db');
const {
    SERVICE_PACKAGE_TYPES,
} = require('../shared/constants/servicePackage.constant');
const seedServicePackage = require('./seedServicePackage');
const seedServicePriceRule = require('./seedServicePriceRule');
const {
    buildServicePackageDefinitions,
    buildServicePriceRuleDefinitions,
    servicePriceRuleMatchesVehicle,
} = require('./seedServiceCatalogData');
const {
    buildVehicleDefinitions,
} = require('./seedWashBaysVehiclesCatalog');
const { getSeedReferenceDate } = require('./seedTime');

const sameNullableValue = (left, right) => (
    (left ?? null) === (right ?? null)
);

const verifyServicePackagesPriceRules = async ({ referenceDate } = {}) => {
    const packageDefinitions = buildServicePackageDefinitions(referenceDate);
    const ruleDefinitions = buildServicePriceRuleDefinitions(referenceDate);
    const vehicleDefinitions = buildVehicleDefinitions(referenceDate);
    const serviceCodes = packageDefinitions.map(
        (definition) => definition.service_code
    );
    const ruleCodes = ruleDefinitions.map(
        (definition) => definition.rule_code
    );
    const [servicePackages, priceRules] = await Promise.all([
        ServicePackage.find({
            service_code: { $in: serviceCodes },
        }).lean(),
        ServicePriceRule.find({
            rule_code: { $in: ruleCodes },
        }).lean(),
    ]);

    if (servicePackages.length !== packageDefinitions.length) {
        throw new Error(
            `Service package verification failed: expected ${packageDefinitions.length}, found ${servicePackages.length}`
        );
    }

    if (priceRules.length !== ruleDefinitions.length) {
        throw new Error(
            `Service price rule verification failed: expected ${ruleDefinitions.length}, found ${priceRules.length}`
        );
    }

    const packageByCode = new Map(
        servicePackages.map((servicePackage) => [
            servicePackage.service_code,
            servicePackage,
        ])
    );
    const serviceCodeById = new Map(
        servicePackages.map((servicePackage) => [
            servicePackage._id.toString(),
            servicePackage.service_code,
        ])
    );

    for (const definition of packageDefinitions) {
        const servicePackage = packageByCode.get(definition.service_code);

        if (!servicePackage) {
            throw new Error(
                `Service package not found during verification: ${definition.service_code}`
            );
        }

        const includedCodes = servicePackage.included_service_ids.map(
            (serviceId) => serviceCodeById.get(serviceId.toString())
        );

        if (
            !servicePackage.is_active
            || servicePackage.name !== definition.name
            || servicePackage.vehicle_type !== definition.vehicle_type
            || servicePackage.service_type !== definition.service_type
            || servicePackage.base_price !== definition.base_price
            || servicePackage.duration_minutes !== definition.duration_minutes
            || servicePackage.points_earned !== definition.points_earned
            || servicePackage.requires_wash_bay
                !== definition.requires_wash_bay
            || servicePackage.wash_bay_duration_minutes
                !== definition.wash_bay_duration_minutes
            || servicePackage.wash_bay_start_offset_minutes
                !== definition.wash_bay_start_offset_minutes
            || servicePackage.requires_care_staff
                !== definition.requires_care_staff
            || servicePackage.care_staff_type
                !== definition.care_staff_type
            || servicePackage.care_staff_required_count
                !== definition.care_staff_required_count
            || servicePackage.care_staff_duration_minutes
                !== definition.care_staff_duration_minutes
            || servicePackage.care_staff_start_offset_minutes
                !== definition.care_staff_start_offset_minutes
            || JSON.stringify(includedCodes)
                !== JSON.stringify(definition.included_service_codes)
            || (
                definition.service_type === SERVICE_PACKAGE_TYPES.COMBO
                && servicePackage.steps_template.length > 0
            )
        ) {
            throw new Error(
                `Invalid service package mapping: ${definition.service_code}`
            );
        }
    }

    const ruleByCode = new Map(
        priceRules.map((priceRule) => [
            priceRule.rule_code,
            priceRule,
        ])
    );

    for (const definition of ruleDefinitions) {
        const priceRule = ruleByCode.get(definition.rule_code);
        const servicePackage = packageByCode.get(definition.service_code);

        if (
            !priceRule
            || !priceRule.is_active
            || priceRule.garage_id !== null
            || priceRule.service_package_id.toString()
                !== servicePackage._id.toString()
            || priceRule.vehicle_type !== definition.vehicle_type
            || !sameNullableValue(
                priceRule.engine_type,
                definition.engine_type
            )
            || !sameNullableValue(
                priceRule.motorbike_cc_group,
                definition.motorbike_cc_group
            )
            || !sameNullableValue(
                priceRule.car_body_type,
                definition.car_body_type
            )
            || !sameNullableValue(priceRule.seat_min, definition.seat_min)
            || !sameNullableValue(priceRule.seat_max, definition.seat_max)
            || priceRule.price !== definition.price
            || priceRule.duration_minutes !== null
            || priceRule.wash_bay_duration_minutes !== null
            || priceRule.care_staff_duration_minutes !== null
            || priceRule.effective_from.getTime()
                !== definition.effective_from.getTime()
            || priceRule.effective_to !== null
            || priceRule.version !== 1
        ) {
            throw new Error(
                `Invalid service price rule mapping: ${definition.rule_code}`
            );
        }
    }

    const rulesByServiceCode = new Map();

    for (const rule of ruleDefinitions) {
        const serviceRules = rulesByServiceCode.get(rule.service_code) || [];

        serviceRules.push(rule);
        rulesByServiceCode.set(rule.service_code, serviceRules);
    }

    let eligiblePairs = 0;
    let ineligiblePairs = 0;
    const matchedVehicleCountByService = new Map();

    for (const vehicle of vehicleDefinitions) {
        const matchingWashServices = [];

        for (const servicePackage of packageDefinitions) {
            if (servicePackage.vehicle_type !== vehicle.vehicle_type) {
                continue;
            }

            const matchingRules = (
                rulesByServiceCode.get(servicePackage.service_code) || []
            ).filter((rule) => servicePriceRuleMatchesVehicle(rule, vehicle));

            if (matchingRules.length > 1) {
                throw new Error(
                    `Ambiguous seeded price rules: ${servicePackage.service_code}:${vehicle.normalized_license_plate}`
                );
            }

            if (matchingRules.length === 1) {
                eligiblePairs += 1;
                matchedVehicleCountByService.set(
                    servicePackage.service_code,
                    (
                        matchedVehicleCountByService.get(
                            servicePackage.service_code
                        ) || 0
                    ) + 1
                );

                if (
                    servicePackage.service_type === SERVICE_PACKAGE_TYPES.WASH
                ) {
                    matchingWashServices.push(servicePackage.service_code);
                }
            } else {
                ineligiblePairs += 1;
            }
        }

        if (matchingWashServices.length === 0) {
            throw new Error(
                `Vehicle has no eligible wash service: ${vehicle.normalized_license_plate}`
            );
        }
    }

    for (const definition of packageDefinitions) {
        if (!matchedVehicleCountByService.has(definition.service_code)) {
            throw new Error(
                `Service has no eligible seeded vehicle: ${definition.service_code}`
            );
        }
    }

    return {
        service_packages: {
            total: servicePackages.length,
            active: servicePackages.filter(
                (servicePackage) => servicePackage.is_active
            ).length,
            by_vehicle_type: servicePackages.reduce(
                (counts, servicePackage) => ({
                    ...counts,
                    [servicePackage.vehicle_type]: (
                        counts[servicePackage.vehicle_type] || 0
                    ) + 1,
                }),
                {}
            ),
            by_service_type: servicePackages.reduce(
                (counts, servicePackage) => ({
                    ...counts,
                    [servicePackage.service_type]: (
                        counts[servicePackage.service_type] || 0
                    ) + 1,
                }),
                {}
            ),
        },
        price_rules: {
            total: priceRules.length,
            active: priceRules.filter((priceRule) => priceRule.is_active).length,
            global: priceRules.filter((priceRule) => !priceRule.garage_id).length,
            garage_specific: priceRules.filter(
                (priceRule) => priceRule.garage_id
            ).length,
        },
        eligibility: {
            vehicles_checked: vehicleDefinitions.length,
            eligible_pairs: eligiblePairs,
            ineligible_pairs: ineligiblePairs,
            services_with_matching_vehicles: matchedVehicleCountByService.size,
        },
    };
};

const seedServicePackagesPriceRules = async ({
    dryRun = process.argv.includes('--dry-run'),
} = {}) => {
    const referenceDate = getSeedReferenceDate();

    if (dryRun) {
        return {
            dry_run: true,
            reference_date: referenceDate,
            service_packages: await seedServicePackage({
                referenceDate,
                dryRun: true,
            }),
            price_rules: await seedServicePriceRule({
                referenceDate,
                dryRun: true,
            }),
        };
    }

    await connectDB();

    const session = await ServicePackage.startSession();
    const result = {
        dry_run: false,
        reference_date: referenceDate,
    };

    try {
        await session.withTransaction(async () => {
            result.service_packages = await seedServicePackage({
                session,
                referenceDate,
            });
            result.price_rules = await seedServicePriceRule({
                session,
                referenceDate,
            });
        });

        result.verification = await verifyServicePackagesPriceRules({
            referenceDate,
        });

        return result;
    } finally {
        await session.endSession();
        await disconnectDB();
    }
};

const run = async () => {
    try {
        const result = await seedServicePackagesPriceRules();

        console.log('Service packages and price rules seed completed');
        console.dir(result.verification || result, { depth: null });
    } catch (error) {
        console.error(
            'Service packages and price rules seed failed:',
            error
        );
        process.exitCode = 1;

        await disconnectDB().catch(() => {});
    }
};

if (require.main === module) {
    run();
}

module.exports = {
    seedServicePackagesPriceRules,
    verifyServicePackagesPriceRules,
};
