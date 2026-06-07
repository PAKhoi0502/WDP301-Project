const Garage = require('../modules/garages/garage.model');
const WashBay = require('../modules/wash-bays/washBay.model');
const { VEHICLE_TYPES } = require('../shared/constants/vehicle.constant');
const { WASH_BAY_STATUS } = require('../shared/constants/washBay.constant');

const buildWashBays = ({ garage_code, motorbikeCount, carCount }) => {
    const washBays = [];

    for (let index = 1; index <= motorbikeCount; index += 1) {
        const bayNumber = String(index).padStart(2, '0');

        washBays.push({
            garage_code,
            name: `Motorbike Bay ${bayNumber}`,
            bay_code: `MB-${bayNumber}`,
            vehicle_type: VEHICLE_TYPES.MOTORBIKE,
            status: WASH_BAY_STATUS.AVAILABLE,
            is_active: true,
        });
    }

    for (let index = 1; index <= carCount; index += 1) {
        const bayNumber = String(index).padStart(2, '0');

        washBays.push({
            garage_code,
            name: `Car Bay ${bayNumber}`,
            bay_code: `CAR-${bayNumber}`,
            vehicle_type: VEHICLE_TYPES.CAR,
            status: WASH_BAY_STATUS.AVAILABLE,
            is_active: true,
        });
    }

    return washBays;
};

const seedWashBays = [
    ...buildWashBays({
        garage_code: 'GAR001',
        motorbikeCount: 2,
        carCount: 3,
    }),
    ...buildWashBays({
        garage_code: 'GAR002',
        motorbikeCount: 3,
        carCount: 2,
    }),
    ...buildWashBays({
        garage_code: 'GAR003',
        motorbikeCount: 0,
        carCount: 2,
    }),
    ...buildWashBays({
        garage_code: 'GAR004',
        motorbikeCount: 2,
        carCount: 0,
    }),
];

const deactivateUnusedSeedWashBays = async (garageIds, activeBayCodesByGarageId) => {
    for (const garageId of garageIds) {
        const activeBayCodes = activeBayCodesByGarageId.get(String(garageId)) || [];

        await WashBay.updateMany(
            {
                garage_id: garageId,
                bay_code: { $nin: activeBayCodes },
            },
            {
                $set: {
                    status: WASH_BAY_STATUS.INACTIVE,
                    current_booking_id: null,
                    is_active: false,
                },
            },
            {
                runValidators: true,
            }
        );
    }
};

const seedWashBay = async () => {
    console.log('== Seeding wash bays ==');

    const garageCodes = [...new Set(seedWashBays.map((washBay) => washBay.garage_code))];
    const garages = await Garage.find({
        garage_code: { $in: garageCodes },
    }).select('_id garage_code');

    const garageByCode = new Map(
        garages.map((garage) => [garage.garage_code, garage])
    );
    const activeBayCodesByGarageId = new Map();

    for (const washBay of seedWashBays) {
        const garage = garageByCode.get(washBay.garage_code);

        if (!garage) {
            console.log(`Skipped wash bay: ${washBay.garage_code} ${washBay.bay_code}`);
            continue;
        }

        const garageId = String(garage._id);
        const currentBayCodes = activeBayCodesByGarageId.get(garageId) || [];

        activeBayCodesByGarageId.set(garageId, [
            ...currentBayCodes,
            washBay.bay_code,
        ]);

        const payload = {
            garage_id: garage._id,
            name: washBay.name,
            bay_code: washBay.bay_code,
            vehicle_type: washBay.vehicle_type,
            status: washBay.status,
            current_booking_id: null,
            is_active: washBay.is_active,
        };

        const existingWashBay = await WashBay.findOne({
            garage_id: garage._id,
            bay_code: washBay.bay_code,
        }).select('_id');

        if (existingWashBay) {
            await WashBay.updateOne(
                { _id: existingWashBay._id },
                { $set: payload },
                { runValidators: true }
            );

            console.log(`Updated wash bay: ${washBay.garage_code} ${washBay.bay_code}`);
            continue;
        }

        await WashBay.create(payload);

        console.log(`Created wash bay: ${washBay.garage_code} ${washBay.bay_code}`);
    }

    await deactivateUnusedSeedWashBays(
        garages.map((garage) => garage._id),
        activeBayCodesByGarageId
    );

    console.log('Wash bays seeding completed');
};

module.exports = seedWashBay;