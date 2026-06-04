const express = require('express');

const authRoutes = require('../modules/auth/auth.routes');
const userRoutes = require('../modules/users/user.routes');
const staffProfileRoutes = require('../modules/staff-profiles/staffProfile.routes');
const garageRoutes = require('../modules/garages/garage.routes');
const washBayRoutes = require('../modules/wash-bays/washBay.routes');
const vehicleRoutes = require('../modules/vehicles/vehicle.routes');
const servicePackageRoutes = require('../modules/service-packages/servicePackage.routes');
const bookingRoutes = require('../modules/bookings/booking.routes');
const promotionRoutes = require('../modules/promotions/promotion.routes');

const router = express.Router();

router.get('/', (req, res) => {
    return res.status(200).json({
        success: true,
        message: 'Welcome to AutoWash Pro API v1',
    });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/staff-profiles', staffProfileRoutes);
router.use('/garages', garageRoutes.publicRouter);
router.use('/vehicles', vehicleRoutes.customerRouter);
router.use('/service-packages', servicePackageRoutes.publicRouter);
router.use('/bookings', bookingRoutes.customerRouter);
router.use('/promotions', promotionRoutes.publicRouter);
router.use('/promotions', promotionRoutes.customerRouter);
router.use('/admin/vehicles', vehicleRoutes.adminRouter);
router.use('/admin/service-packages', servicePackageRoutes.adminRouter);
router.use('/admin/bookings', bookingRoutes.adminRouter);
router.use('/admin/promotions', promotionRoutes.adminRouter);
router.use('/admin/wash-bays', washBayRoutes.adminRouter);
router.use('/admin/garages/:garageId/wash-bays', washBayRoutes.garageRouter);
router.use('/admin/garages/:garageId/available-wash-bays', washBayRoutes.availableRouter);
router.use('/admin/garages', garageRoutes.adminRouter);

module.exports = router;