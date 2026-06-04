const Garage = require('../modules/garages/garage.model');
const WashBay = require('../modules/wash-bays/washBay.model');
const { VEHICLE_TYPES } = require('../shared/constants/vehicle.constant');
const { WASH_BAY_STATUS } = require('../shared/constants/washBay.constant');

const seedWashBays = [
    {
        garage_code: 'GAR001',
        name: 'Motorbike Bay 01',
        bay_code: 'MB-01',
        vehicle_type: VEHICLE_TYPES.MOTORBIKE,
        status: WASH_BAY_STATUS.AVAILABLE,
        is_active: true,
    },
    {
        garage_code: 'GAR001',
        name: 'Motorbike Bay 02',
        bay_code: 'MB-02',
        vehicle_type: VEHICLE_TYPES.MOTORBIKE,
        status: WASH_BAY_STATUS.AVAILABLE,
        is_active: true,
    },
    {
        garage_code: 'GAR001',
        name: 'Car Bay 01',
        bay_code: 'CAR-01',
        vehicle_type: VEHICLE_TYPES.CAR,
        status: WASH_BAY_STATUS.AVAILABLE,
        is_active: true,
    },
    {
        garage_code: 'GAR001',
        name: 'Car Bay 02',
        bay_code: 'CAR-02',
        vehicle_type: VEHICLE_TYPES.CAR,
        status: WASH_BAY_STATUS.AVAILABLE,
        is_active: true,
    },
    {
        garage_code: 'GAR002',
        name: 'Motorbike Bay 01',
        bay_code: 'MB-01',
        vehicle_type: VEHICLE_TYPES.MOTORBIKE,
        status: WASH_BAY_STATUS.AVAILABLE,
        is_active: true,
    },
    {
        garage_code: 'GAR002',
        name: 'Car Bay 01',
        bay_code: 'CAR-01',
        vehicle_type: VEHICLE_TYPES.CAR,
        status: WASH_BAY_STATUS.AVAILABLE,
        is_active: true,
    },
];

const seedWashBay = async () => {
    console.log('== Seeding wash bays ==');

    for (const washBay of seedWashBays) {
        const garage = await Garage.findOne({
            garage_code: washBay.garage_code,
        }).select('_id');

        if (!garage) {
            console.log(`Skipped wash bay: ${washBay.garage_code} ${washBay.bay_code}`);
            continue;
        }

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

    console.log('Wash bays seeding completed');
};

module.exports = seedWashBay;
