require('dotenv').config();

const { connectDB, disconnectDB } = require('../config/db');
const seedUser = require('./seedUser');
const seedGarage = require('./seedGarage');
const seedStaffProfile = require('./seedStaffProfile');
const seedWashBay = require('./seedWashBay');
const seedVehicle = require('./seedVehicle');
const seedServicePackage = require('./seedServicePackage');
const seedServicePriceRule = require('./seedServicePriceRule');
const seedTierRule = require('./seedTierRule');
const seedLoyaltyRedeemRule = require('./seedLoyaltyRedeemRule');
const { resetDatabase } = require('./resetDatabase');

const shouldResetDatabase = process.argv.includes('--reset');
const isDryRun = process.argv.includes('--dry-run');

const run = async () => {
    let exitCode = 0;

    try {
        await connectDB();

        if (shouldResetDatabase) {
            await resetDatabase();

            if (isDryRun) {
                console.log('Seed skipped after dry run reset');
                return;
            }
        }

        await seedUser();
        await seedGarage();
        await seedStaffProfile();
        await seedWashBay();
        await seedVehicle();
        await seedServicePackage();
        await seedServicePriceRule();
        await seedTierRule();
        await seedLoyaltyRedeemRule();

        console.log('All seed completed');
    } catch (error) {
        console.error('Seed failed:', error);
        exitCode = 1;
    } finally {
        await disconnectDB();
        process.exitCode = exitCode;
    }
};

run();
