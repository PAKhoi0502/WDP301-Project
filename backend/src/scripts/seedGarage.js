const Garage = require('../modules/garages/garage.model');

const seedGarages = [
    {
        name: 'Garage A',
        garage_code: 'GAR001',
        address: '123 Nguyen Hue Street',
        ward: 'Ben Nghe',
        district: 'District 1',
        city: 'Ho Chi Minh City',
        phone: '0900000991',
        email: 'garage.a@example.com',
        latitude: 10.7769,
        longitude: 106.7009,
        opening_time: '08:00',
        closing_time: '18:00',
        slot_interval_minutes: 30,
        late_grace_minutes: 15,
        description: 'Demo garage A with motorbike and car wash bays',
        is_active: true,
    },
    {
        name: 'Garage B',
        garage_code: 'GAR002',
        address: '456 Vo Van Ngan Street',
        ward: 'Linh Chieu',
        district: 'Thu Duc City',
        city: 'Ho Chi Minh City',
        phone: '0900000992',
        email: 'garage.b@example.com',
        latitude: 10.8494,
        longitude: 106.7538,
        opening_time: '07:00',
        closing_time: '19:00',
        slot_interval_minutes: 30,
        late_grace_minutes: 15,
        description: 'Demo garage B with motorbike and car wash bays',
        is_active: true,
    },
    {
        name: 'Garage C',
        garage_code: 'GAR003',
        address: '789 Le Van Viet Street',
        ward: 'Tang Nhon Phu A',
        district: 'Thu Duc City',
        city: 'Ho Chi Minh City',
        phone: '0900000993',
        email: 'garage.c@example.com',
        latitude: 10.8456,
        longitude: 106.7812,
        opening_time: '07:00',
        closing_time: '18:00',
        slot_interval_minutes: 30,
        late_grace_minutes: 15,
        description: 'Demo garage C with car wash bays only',
        is_active: true,
    },
    {
        name: 'Garage D',
        garage_code: 'GAR004',
        address: '321 Pham Van Dong Street',
        ward: 'Hiep Binh Chanh',
        district: 'Thu Duc City',
        city: 'Ho Chi Minh City',
        phone: '0900000994',
        email: 'garage.d@example.com',
        latitude: 10.8335,
        longitude: 106.7234,
        opening_time: '07:00',
        closing_time: '18:00',
        slot_interval_minutes: 30,
        late_grace_minutes: 15,
        description: 'Demo garage D with motorbike wash bays only',
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
