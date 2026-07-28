const Garage = require('../modules/garages/garage.model');
const WashBay = require('../modules/wash-bays/washBay.model');
const {
    buildWashBayDefinitions,
} = require('./seedWashBaysVehiclesCatalog');
const { getSeedReferenceDate } = require('./seedTime');

const assertUniqueWashBayDefinitions = (definitions) => {
    const businessKeys = new Set();

    for (const definition of definitions) {
        const businessKey = `${definition.garage_code}:${definition.bay_code}`;

        if (businessKeys.has(businessKey)) {
            throw new Error(`Duplicate wash bay definition: ${businessKey}`);
        }

        businessKeys.add(businessKey);
    }
};

const summarizeWashBays = (definitions) => {
    const byGarage = {};

    for (const definition of definitions) {
        const garage = byGarage[definition.garage_code] || {
            total: 0,
            vehicle_types: {},
        };

        garage.total += 1;
        garage.vehicle_types[definition.vehicle_type] = (
            garage.vehicle_types[definition.vehicle_type] || 0
        ) + 1;
        byGarage[definition.garage_code] = garage;
    }

    return {
        planned: definitions.length,
        garages: Object.keys(byGarage).length,
        by_garage: byGarage,
    };
};

const seedWashBay = async ({
    session = null,
    referenceDate = getSeedReferenceDate(),
    dryRun = false,
} = {}) => {
    console.log('== Seeding wash bays ==');

    const definitions = buildWashBayDefinitions(referenceDate);

    assertUniqueWashBayDefinitions(definitions);

    const summary = summarizeWashBays(definitions);

    if (dryRun) {
        console.table(
            Object.entries(summary.by_garage).map(([garageCode, garage]) => ({
                garage_code: garageCode,
                total: garage.total,
                ...garage.vehicle_types,
            }))
        );

        return {
            ...summary,
            dry_run: true,
        };
    }

    const garageQuery = Garage.find({
        garage_code: {
            $in: [...new Set(
                definitions.map((definition) => definition.garage_code)
            )],
        },
    }).select('_id garage_code');

    if (session) {
        garageQuery.session(session);
    }

    const garages = await garageQuery.lean();
    const garageByCode = new Map(
        garages.map((garage) => [garage.garage_code, garage])
    );
    const records = definitions.map((definition) => {
        const garage = garageByCode.get(definition.garage_code);

        if (!garage) {
            throw new Error(`Wash bay garage not found: ${definition.garage_code}`);
        }

        const payload = {
            garage_id: garage._id,
            name: definition.name,
            bay_code: definition.bay_code,
            vehicle_type: definition.vehicle_type,
            status: definition.status,
            current_booking_id: definition.current_booking_id,
            is_active: definition.is_active,
            created_at: definition.created_at,
            updated_at: definition.created_at,
        };
        const validationError = new WashBay(payload).validateSync();

        if (validationError) {
            throw validationError;
        }

        return payload;
    });
    const existingQuery = WashBay.find({
        $or: records.map((record) => ({
            garage_id: record.garage_id,
            bay_code: record.bay_code,
        })),
    }).select('garage_id bay_code vehicle_type status current_booking_id');

    if (session) {
        existingQuery.session(session);
    }

    const existingWashBays = await existingQuery.lean();
    const expectedTypeByKey = new Map(
        records.map((record) => [
            `${record.garage_id}:${record.bay_code}`,
            record.vehicle_type,
        ])
    );

    for (const washBay of existingWashBays) {
        const businessKey = `${washBay.garage_id}:${washBay.bay_code}`;

        if (washBay.vehicle_type !== expectedTypeByKey.get(businessKey)) {
            throw new Error(`Wash bay vehicle type conflict: ${businessKey}`);
        }
    }

    const operations = records.map((record) => ({
        updateOne: {
            filter: {
                garage_id: record.garage_id,
                bay_code: record.bay_code,
            },
            update: {
                $set: {
                    name: record.name,
                    vehicle_type: record.vehicle_type,
                },
                $setOnInsert: {
                    status: record.status,
                    current_booking_id: record.current_booking_id,
                    is_active: record.is_active,
                    created_at: record.created_at,
                    updated_at: record.updated_at,
                },
            },
            upsert: true,
            timestamps: false,
        },
    }));
    const result = await WashBay.bulkWrite(operations, {
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
    console.log('Wash bays seeding completed');

    return completedSummary;
};

module.exports = seedWashBay;
module.exports.assertUniqueWashBayDefinitions = assertUniqueWashBayDefinitions;
module.exports.summarizeWashBays = summarizeWashBays;
