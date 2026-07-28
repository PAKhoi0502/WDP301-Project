const Garage = require('../modules/garages/garage.model');
const { GARAGE_SEEDS, toGaragePayload } = require('./seedCatalog');
const { atLocalDayAndMinute, getSeedReferenceDate } = require('./seedTime');

const assertUniqueSeedGarages = (garages) => {
    const codes = new Set();
    const emails = new Set();
    const phones = new Set();

    for (const garage of garages) {
        if (codes.has(garage.garage_code)) {
            throw new Error(`Duplicate seed garage code: ${garage.garage_code}`);
        }

        if (emails.has(garage.email)) {
            throw new Error(`Duplicate seed garage email: ${garage.email}`);
        }

        if (phones.has(garage.phone)) {
            throw new Error(`Duplicate seed garage phone: ${garage.phone}`);
        }

        codes.add(garage.garage_code);
        emails.add(garage.email);
        phones.add(garage.phone);
    }
};

const seedGarage = async ({
    session = null,
    referenceDate = getSeedReferenceDate(),
    dryRun = false,
} = {}) => {
    console.log('== Seeding garages ==');

    assertUniqueSeedGarages(GARAGE_SEEDS);

    const garages = GARAGE_SEEDS.map((definition, index) => {
        const payload = toGaragePayload(definition);
        const createdAt = atLocalDayAndMinute({
            referenceDate,
            dayOffset: -180 + index * 11,
            minuteOfDay: 8 * 60 + index * 37,
        });
        const validationError = new Garage({
            ...payload,
            created_at: createdAt,
            updated_at: createdAt,
        }).validateSync();

        if (validationError) {
            throw validationError;
        }

        return {
            payload,
            created_at: createdAt,
        };
    });

    if (dryRun) {
        const summary = {
            dry_run: true,
            planned: garages.length,
            garage_codes: garages.map(({ payload }) => payload.garage_code),
        };

        console.table([{
            planned: summary.planned,
            opening_time: '07:00',
            closing_time: '19:00',
        }]);

        return summary;
    }

    const operations = garages.map(({ payload, created_at }) => ({
        updateOne: {
            filter: { garage_code: payload.garage_code },
            update: {
                $set: payload,
                $setOnInsert: {
                    created_at,
                    updated_at: created_at,
                },
            },
            upsert: true,
            timestamps: false,
        },
    }));
    const result = await Garage.bulkWrite(operations, {
        ordered: true,
        session,
    });
    const summary = {
        dry_run: false,
        planned: garages.length,
        matched: result.matchedCount,
        modified: result.modifiedCount,
        inserted: result.upsertedCount,
        garage_codes: garages.map(({ payload }) => payload.garage_code),
    };

    console.table([{
        planned: summary.planned,
        matched: summary.matched,
        modified: summary.modified,
        inserted: summary.inserted,
    }]);
    console.log('Garages seeding completed');

    return summary;
};

module.exports = seedGarage;
module.exports.assertUniqueSeedGarages = assertUniqueSeedGarages;
