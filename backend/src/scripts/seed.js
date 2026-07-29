require('dotenv').config();

const { connectDB, disconnectDB } = require('../config/db');
const seedUser = require('./seedUser');
const seedGarage = require('./seedGarage');
const seedStaffProfile = require('./seedStaffProfile');
const seedCameraDevice = require('./seedCameraDevice');
const seedWashBay = require('./seedWashBay');
const seedVehicle = require('./seedVehicle');
const seedServicePackage = require('./seedServicePackage');
const seedServicePriceRule = require('./seedServicePriceRule');
const seedTierRule = require('./seedTierRule');
const seedLoyaltyRedeemRule = require('./seedLoyaltyRedeemRule');
const seedPromotion = require('./seedPromotion');
const seedBooking = require('./seedBooking');
const {
    seedServiceStepsInspectionsData,
} = require('./seedServiceStepsInspections');
const {
    seedPaymentsPromotionUsagesData,
} = require('./seedPaymentsPromotionUsages');
const {
    seedLoyaltyHistoriesHandoversData,
} = require('./seedLoyaltyHistoriesHandovers');
const {
    seedIncidentsVouchersCustomerCasesData,
} = require('./seedIncidentsVouchersCustomerCases');
const {
    seedNotificationsSurveysPlateScansData,
} = require('./seedNotificationsSurveysPlateScans');
const { seedReviewsData } = require('./seedReviews');
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
        await seedCameraDevice();
        await seedWashBay();
        await seedVehicle();
        await seedServicePackage();
        await seedServicePriceRule();
        await seedTierRule();
        await seedLoyaltyRedeemRule();
        await seedPromotion();
        await seedBooking();
        await seedServiceStepsInspectionsData();
        await seedPaymentsPromotionUsagesData();
        await seedLoyaltyHistoriesHandoversData();
        await seedIncidentsVouchersCustomerCasesData();
        await seedNotificationsSurveysPlateScansData();
        await seedReviewsData();

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
