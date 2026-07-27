const ServicePackage = require('../modules/service-packages/servicePackage.model');
const ServicePriceRule = require('../modules/service-price-rules/servicePriceRule.model');

const seedServicePriceRule = async () => {
    console.log('== Seeding default service price rules ==');

    const servicePackages = await ServicePackage.find({}).lean();
    let createdCount = 0;

    for (const servicePackage of servicePackages) {
        const hasConfiguredRule = await ServicePriceRule.exists({
            service_package_id: servicePackage._id,
        });

        if (hasConfiguredRule) {
            continue;
        }

        await ServicePriceRule.create({
            service_package_id: servicePackage._id,
            garage_id: null,
            vehicle_type: servicePackage.vehicle_type,
            engine_type: null,
            motorbike_cc_group: null,
            car_body_type: null,
            seat_min: null,
            seat_max: null,
            price: servicePackage.base_price,
            duration_minutes: null,
            wash_bay_duration_minutes: null,
            care_staff_duration_minutes: null,
            effective_from: servicePackage.created_at || new Date(),
            effective_to: null,
            version: 1,
            is_active: true,
            note: 'Default rule migrated from service package base price',
        });
        createdCount += 1;
    }

    console.log(`Default service price rules completed: ${createdCount} created`);
};

module.exports = seedServicePriceRule;
