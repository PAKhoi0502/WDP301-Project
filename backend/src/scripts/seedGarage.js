const Garage = require('../modules/garages/garage.model');

const seedGarages = [
    {
        name: 'AutoWash Pro District 1',
        garage_code: 'GAR001',
        address: '123 Nguyen Hue Street',
        ward: 'Ben Nghe',
        district: 'District 1',
        city: 'Ho Chi Minh City',
        phone: '0900000999',
        email: 'garage.d1@example.com',
        latitude: 10.7769,
        longitude: 106.7009,
        opening_time: '07:00',
        closing_time: '18:00',
        slot_interval_minutes: 30,
        description: 'Main demo garage branch',
        is_active: true,
    },
    {
        name: 'AutoWash Pro Thu Duc',
        garage_code: 'GAR002',
        address: '456 Vo Van Ngan Street',
        ward: 'Linh Chieu',
        district: 'Thu Duc City',
        city: 'Ho Chi Minh City',
        phone: '0900000888',
        email: 'garage.td@example.com',
        latitude: 10.8494,
        longitude: 106.7538,
        opening_time: '07:00',
        closing_time: '18:00',
        slot_interval_minutes: 30,
        description: 'Secondary demo garage branch',
        is_active: true,
    },
];

const seedGarage = async () => {
    console.log('== Seeding garages ==');

    for (const garage of seedGarages) {
        const existingGarage = await Garage.findOne({
            garage_code: garage.garage_code,
        }).select('_id');

        if (existingGarage) {
            await Garage.updateOne(
                { _id: existingGarage._id },
                { $set: garage },
                { runValidators: true }
            );

            console.log(`Updated garage: ${garage.garage_code}`);
            continue;
        }

        await Garage.create(garage);

        console.log(`Created garage: ${garage.garage_code}`);
    }

    console.log('Garages seeding completed');
};

module.exports = seedGarage;
