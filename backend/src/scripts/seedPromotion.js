const Promotion = require('../modules/promotions/promotion.model');
const ServicePackage = require('../modules/service-packages/servicePackage.model');
const User = require('../modules/users/user.model');
const { USER_ROLES } = require('../shared/constants/roles.constant');
const {
    PROMOTION_AUDIENCES,
} = require('../shared/constants/promotion.constant');
const { normalizePhone } = require('../shared/utils/phone');
const {
    buildPromotionDefinitions,
} = require('./seedLoyaltyPromotionCatalog');
const { getSeedReferenceDate } = require('./seedTime');

const PROMOTION_ADMIN_PHONE = '0900000001';

const assertPromotionDefinitionsValid = (definitions, referenceDate) => {
    const codes = new Set();

    for (const definition of definitions) {
        if (codes.has(definition.code)) {
            throw new Error(`Duplicate promotion code: ${definition.code}`);
        }

        if (
            definition.audience === PROMOTION_AUDIENCES.WALK_IN
            && (
                definition.applicable_tiers.length > 0
                || definition.per_customer_limit !== null
            )
        ) {
            throw new Error(
                `Walk-in promotion has customer-only constraints: ${definition.code}`
            );
        }

        if (
            definition.audience === PROMOTION_AUDIENCES.CUSTOMER
            && (
                definition.phone_required
                || definition.per_phone_limit !== null
            )
        ) {
            throw new Error(
                `Customer promotion has walk-in phone constraints: ${definition.code}`
            );
        }

        if (
            definition.schedule === 'UPCOMING'
            && definition.start_at <= referenceDate
        ) {
            throw new Error(
                `Upcoming promotion schedule is invalid: ${definition.code}`
            );
        }

        if (
            definition.schedule === 'EXPIRED'
            && definition.end_at >= referenceDate
        ) {
            throw new Error(
                `Expired promotion schedule is invalid: ${definition.code}`
            );
        }

        codes.add(definition.code);
    }
};

const summarizePromotions = (definitions, referenceDate) => ({
    planned: definitions.length,
    active_now: definitions.filter((definition) => (
        definition.is_active
        && definition.start_at <= referenceDate
        && definition.end_at >= referenceDate
    )).length,
    upcoming: definitions.filter((definition) => (
        definition.is_active
        && definition.start_at > referenceDate
    )).length,
    expired: definitions.filter(
        (definition) => definition.end_at < referenceDate
    ).length,
    inactive: definitions.filter(
        (definition) => !definition.is_active
    ).length,
});

const seedPromotion = async ({
    session = null,
    referenceDate = getSeedReferenceDate(),
    dryRun = false,
} = {}) => {
    console.log('== Seeding promotions ==');

    const definitions = buildPromotionDefinitions(referenceDate);

    assertPromotionDefinitionsValid(definitions, referenceDate);

    const summary = summarizePromotions(definitions, referenceDate);

    if (dryRun) {
        console.table(definitions.map((definition) => ({
            code: definition.code,
            schedule: definition.schedule,
            audience: definition.audience,
            discount_type: definition.discount_type,
            discount_value: definition.discount_value,
            is_active: definition.is_active,
        })));

        return {
            ...summary,
            dry_run: true,
        };
    }

    const servicePackageCodes = [...new Set(
        definitions.flatMap(
            (definition) => definition.applicable_service_package_codes
        )
    )];
    const packageQuery = ServicePackage.find({
        service_code: { $in: servicePackageCodes },
        is_active: true,
    }).select('_id service_code');
    const adminQuery = User.findOne({
        phone: normalizePhone(PROMOTION_ADMIN_PHONE),
        role: USER_ROLES.ADMIN,
        is_active: true,
    }).select('_id');

    if (session) {
        packageQuery.session(session);
        adminQuery.session(session);
    }

    const servicePackages = await packageQuery.lean();
    const admin = await adminQuery.lean();

    if (servicePackages.length !== servicePackageCodes.length) {
        throw new Error(
            `Promotion service package verification failed: expected ${servicePackageCodes.length}, found ${servicePackages.length}`
        );
    }

    if (!admin) {
        throw new Error(
            `Promotion admin not found: ${PROMOTION_ADMIN_PHONE}`
        );
    }

    const packageByCode = new Map(
        servicePackages.map((servicePackage) => [
            servicePackage.service_code,
            servicePackage,
        ])
    );
    const records = definitions.map((definition) => {
        const applicableServicePackageIds = (
            definition.applicable_service_package_codes
        ).map((serviceCode) => {
            const servicePackage = packageByCode.get(serviceCode);

            if (!servicePackage) {
                throw new Error(
                    `Promotion service package not found: ${definition.code}:${serviceCode}`
                );
            }

            return servicePackage._id;
        });
        const payload = {
            code: definition.code,
            name: definition.name,
            description: definition.description,
            discount_type: definition.discount_type,
            discount_value: definition.discount_value,
            max_discount_amount: definition.max_discount_amount,
            min_order_amount: definition.min_order_amount,
            audience: definition.audience,
            phone_required: definition.phone_required,
            per_phone_limit: definition.per_phone_limit,
            applicable_tiers: definition.applicable_tiers,
            applicable_vehicle_types:
                definition.applicable_vehicle_types,
            applicable_service_package_ids: applicableServicePackageIds,
            start_at: definition.start_at,
            end_at: definition.end_at,
            usage_limit: definition.usage_limit,
            per_customer_limit: definition.per_customer_limit,
            is_active: definition.is_active,
            created_by_id: admin._id,
            updated_by_id: admin._id,
            created_at: definition.created_at,
            updated_at: definition.created_at,
        };
        const validationError = new Promotion(payload).validateSync();

        if (validationError) {
            throw validationError;
        }

        return {
            ...payload,
            used_count: definition.used_count,
            reserved_count: definition.reserved_count,
        };
    });
    const operations = records.map((record) => ({
        updateOne: {
            filter: {
                code: record.code,
            },
            update: {
                $set: {
                    name: record.name,
                    description: record.description,
                    discount_type: record.discount_type,
                    discount_value: record.discount_value,
                    max_discount_amount: record.max_discount_amount,
                    min_order_amount: record.min_order_amount,
                    audience: record.audience,
                    phone_required: record.phone_required,
                    per_phone_limit: record.per_phone_limit,
                    applicable_tiers: record.applicable_tiers,
                    applicable_vehicle_types:
                        record.applicable_vehicle_types,
                    applicable_service_package_ids:
                        record.applicable_service_package_ids,
                    start_at: record.start_at,
                    end_at: record.end_at,
                    usage_limit: record.usage_limit,
                    per_customer_limit: record.per_customer_limit,
                    is_active: record.is_active,
                    updated_by_id: record.updated_by_id,
                    updated_at: record.updated_at,
                },
                $setOnInsert: {
                    code: record.code,
                    used_count: record.used_count,
                    reserved_count: record.reserved_count,
                    created_by_id: record.created_by_id,
                    created_at: record.created_at,
                },
            },
            upsert: true,
            timestamps: false,
        },
    }));
    const result = await Promotion.bulkWrite(operations, {
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
    console.log('Promotions seeding completed');

    return completedSummary;
};

module.exports = seedPromotion;
module.exports.PROMOTION_ADMIN_PHONE = PROMOTION_ADMIN_PHONE;
module.exports.assertPromotionDefinitionsValid = (
    assertPromotionDefinitionsValid
);
module.exports.summarizePromotions = summarizePromotions;
