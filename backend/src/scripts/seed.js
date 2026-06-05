require('dotenv').config();

const { connectDB, disconnectDB } = require('../config/db');
const seedUser = require('./seedUser');
const seedGarage = require('./seedGarage');
const seedStaffProfile = require('./seedStaffProfile');
const seedWashBay = require('./seedWashBay');
const seedVehicle = require('./seedVehicle');
const seedServicePackage = require('./seedServicePackage');
const seedTierRule = require('./seedTierRule');
const seedLoyaltyRedeemRule = require('./seedLoyaltyRedeemRule');

const run = async () => {
    try {
        await connectDB();

        await seedUser();
        await seedGarage();
        await seedStaffProfile();
        await seedWashBay();
        await seedVehicle();
        await seedServicePackage();
        await seedTierRule();
        await seedLoyaltyRedeemRule();

        console.log('All seed completed');
        process.exit(0);
    } catch (error) {
        console.error('Seed failed:', error);
        process.exit(1);
    } finally {
        await disconnectDB();
    }
};

run();
