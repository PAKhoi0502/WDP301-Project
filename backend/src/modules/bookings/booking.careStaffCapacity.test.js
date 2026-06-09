jest.mock('./booking.model', () => ({
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
    exists: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
}));

jest.mock('../users/user.model', () => ({}));
jest.mock('../vehicles/vehicle.model', () => ({
    findOne: jest.fn(),
}));
jest.mock('../garages/garage.model', () => ({
    findById: jest.fn(),
}));
jest.mock('../wash-bays/washBay.model', () => ({
    countDocuments: jest.fn(),
    findOneAndUpdate: jest.fn(),
}));
jest.mock('../wash-bays/washBay.service', () => ({
    assertGarageSupportsVehicleType: jest.fn(),
    getSupportedVehicleTypesByGarage: jest.fn(),
}));
jest.mock('../staff-profiles/staffProfile.model', () => ({
    countDocuments: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
}));
jest.mock('../service-packages/servicePackage.model', () => ({
    findById: jest.fn(),
    find: jest.fn(),
}));
jest.mock('../booking-service-steps/bookingServiceStep.service', () => ({}));
jest.mock('./bookingPayment.service', () => ({}));
jest.mock('../promotions/promotion.service', () => ({
    validatePromotionForBooking: jest.fn(),
}));
jest.mock('../loyalty/customerLoyalty.model', () => ({
    findOne: jest.fn(),
}));
jest.mock('../loyalty/tierRule.model', () => ({
    findOne: jest.fn(),
}));

const Booking = require('./booking.model');
const Vehicle = require('../vehicles/vehicle.model');
const Garage = require('../garages/garage.model');
const WashBay = require('../wash-bays/washBay.model');
const StaffProfile = require('../staff-profiles/staffProfile.model');
const ServicePackage = require('../service-packages/servicePackage.model');
const bookingServiceStepService = require('../booking-service-steps/bookingServiceStep.service');
const washBayService = require('../wash-bays/washBay.service');
const promotionService = require('../promotions/promotion.service');
const CustomerLoyalty = require('../loyalty/customerLoyalty.model');
const TierRule = require('../loyalty/tierRule.model');
const bookingService = require('./booking.service');

const createFindSortLeanQuery = (result = []) => ({
    sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(result),
    }),
});

const createPopulateQuery = (result) => ({
    populate: jest.fn().mockReturnThis(),
    then(resolve, reject) {
        return Promise.resolve(result).then(resolve, reject);
    },
});

describe('booking care staff capacity', () => {
    const garageId = '507f1f77bcf86cd799439011';
    const servicePackageId = '507f1f77bcf86cd799439012';
    const customerId = '507f1f77bcf86cd799439013';
    const vehicleId = '507f1f77bcf86cd799439014';
    const washServiceId = '507f1f77bcf86cd799439015';
    const careServiceId = '507f1f77bcf86cd799439016';
    const addOnServiceId = '507f1f77bcf86cd799439017';

    const garage = {
        _id: garageId,
        is_active: true,
        opening_time: '13:00',
        closing_time: '14:30',
        slot_interval_minutes: 30,
    };

    const careStaffServicePackage = {
        _id: servicePackageId,
        is_active: true,
        vehicle_type: 'CAR',
        service_type: 'ADDON',
        base_price: 250000,
        duration_minutes: 90,
        wash_bay_duration_minutes: 0,
        requires_wash_bay: false,
        requires_care_staff: true,
        care_staff_type: 'VEHICLE_CARE_STAFF',
        care_staff_required_count: 1,
        care_staff_duration_minutes: 90,
    };

    const comboServicePackage = {
        _id: servicePackageId,
        name: 'Combo care',
        is_active: true,
        vehicle_type: 'CAR',
        service_type: 'COMBO',
        base_price: 500000,
        duration_minutes: 150,
        wash_bay_duration_minutes: 30,
        wash_bay_start_offset_minutes: 0,
        requires_wash_bay: true,
        requires_care_staff: true,
        care_staff_type: 'VEHICLE_CARE_STAFF',
        care_staff_required_count: 1,
        care_staff_duration_minutes: 120,
        care_staff_start_offset_minutes: 30,
        included_service_ids: [washServiceId, careServiceId],
    };

    const washService = {
        _id: washServiceId,
        name: 'Premium wash',
        is_active: true,
        vehicle_type: 'CAR',
        service_type: 'WASH',
        base_price: 150000,
        duration_minutes: 30,
        wash_bay_duration_minutes: 30,
        wash_bay_start_offset_minutes: 0,
        requires_wash_bay: true,
        requires_care_staff: false,
        care_staff_required_count: 0,
        care_staff_duration_minutes: 0,
        care_staff_start_offset_minutes: 0,
        allow_duplicate_in_booking: false,
    };

    const careService = {
        _id: careServiceId,
        name: 'Interior care',
        is_active: true,
        vehicle_type: 'CAR',
        service_type: 'ADDON',
        base_price: 250000,
        duration_minutes: 120,
        wash_bay_duration_minutes: 0,
        wash_bay_start_offset_minutes: 0,
        requires_wash_bay: false,
        requires_care_staff: true,
        care_staff_type: 'VEHICLE_CARE_STAFF',
        care_staff_required_count: 1,
        care_staff_duration_minutes: 120,
        care_staff_start_offset_minutes: 0,
        allow_duplicate_in_booking: false,
    };

    const ironDustService = {
        _id: addOnServiceId,
        name: 'Iron dust removal',
        is_active: true,
        vehicle_type: 'CAR',
        service_type: 'ADDON',
        base_price: 120000,
        duration_minutes: 30,
        wash_bay_duration_minutes: 0,
        wash_bay_start_offset_minutes: 0,
        requires_wash_bay: false,
        requires_care_staff: true,
        care_staff_type: 'VEHICLE_CARE_STAFF',
        care_staff_required_count: 1,
        care_staff_duration_minutes: 30,
        care_staff_start_offset_minutes: 0,
        allow_duplicate_in_booking: false,
    };

    const allServices = [washService, careService, ironDustService];

    beforeEach(() => {
        jest.resetAllMocks();
        Garage.findById.mockResolvedValue(garage);
        ServicePackage.findById.mockResolvedValue(careStaffServicePackage);
        ServicePackage.find.mockImplementation((filter) => {
            const ids = (filter._id?.$in || []).map((id) => id.toString());
            return Promise.resolve(allServices.filter((item) => ids.includes(item._id.toString())));
        });
        washBayService.assertGarageSupportsVehicleType.mockResolvedValue(undefined);
        WashBay.countDocuments.mockResolvedValue(1);
        StaffProfile.countDocuments.mockResolvedValue(2);
        StaffProfile.find.mockReturnValue(createFindSortLeanQuery([]));
        Booking.countDocuments.mockResolvedValue(0);
        Booking.exists.mockResolvedValue(null);
        Booking.aggregate.mockResolvedValue([{ total: 1 }]);
        bookingServiceStepService.markStepDone = jest.fn();
        bookingServiceStepService.createStepsForBooking = jest.fn();
        bookingServiceStepService.areAllRequiredStepsDoneForBookingItem = jest.fn();
        bookingServiceStepService.markResourceReleasedForBookingItem = jest.fn();
        bookingServiceStepService.assertAllRequiredStepsDone = jest.fn();
        Vehicle.findOne.mockResolvedValue({
            _id: vehicleId,
            customer_id: customerId,
            vehicle_type: 'CAR',
            raw_license_plate: '59A-12345',
            normalized_license_plate: '59A12345',
            is_active: true,
        });
        promotionService.validatePromotionForBooking.mockResolvedValue(null);
        CustomerLoyalty.findOne.mockReturnValue({
            select: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(null),
            }),
        });
        TierRule.findOne.mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                tier_name: 'BRONZE',
                booking_window_days: 999999,
                max_upcoming_bookings: 10,
                priority_level: 1,
            }),
        });
    });

    it('assigns a concrete available care staff when service starts', async () => {
        const bookingId = '507f1f77bcf86cd799439030';
        const staffAId = '507f1f77bcf86cd799439031';
        const userAId = '507f1f77bcf86cd799439032';
        const staffBId = '507f1f77bcf86cd799439033';
        const userBId = '507f1f77bcf86cd799439034';
        const booking = {
            _id: bookingId,
            garage_id: garageId,
            service_package_id: servicePackageId,
            vehicle_type: 'CAR',
            status: 'CHECKED_IN',
            requires_wash_bay: false,
            requires_care_staff: true,
            booking_items: [
                {
                    item_key: 'ITEM_1_507F1F77BCF86CD799439016',
                    service_package_id: careServiceId,
                    source: 'PRIMARY',
                    name_snapshot: 'Interior care',
                    sequence: 1,
                    requires_wash_bay: false,
                    requires_care_staff: true,
                    care_staff_type: 'VEHICLE_CARE_STAFF',
                    care_staff_required_count: 1,
                    care_staff_start_time: new Date('2999-01-01T06:00:00.000Z'),
                    care_staff_end_time: new Date('2999-01-01T07:30:00.000Z'),
                    assigned_care_staff: [],
                    status: 'PENDING',
                },
            ],
            save: jest.fn().mockResolvedValue(undefined),
            markModified: jest.fn(),
        };

        Booking.findById
            .mockReturnValueOnce(booking)
            .mockReturnValueOnce(createPopulateQuery(booking));
        StaffProfile.find.mockReturnValue(createFindSortLeanQuery([
            {
                _id: staffAId,
                user_id: userAId,
                staff_code: 'STAFF_A',
                staff_type: 'VEHICLE_CARE_STAFF',
                garage_id: garageId,
                is_active: true,
            },
            {
                _id: staffBId,
                user_id: userBId,
                staff_code: 'STAFF_B',
                staff_type: 'VEHICLE_CARE_STAFF',
                garage_id: garageId,
                is_active: true,
            },
        ]));
        Booking.aggregate
            .mockResolvedValueOnce([{ total: 1 }])
            .mockResolvedValueOnce([{ _id: staffAId }]);
        bookingServiceStepService.createStepsForBooking.mockResolvedValue([
            {
                assigned_staff_id: userBId,
            },
        ]);

        await bookingService.startService(
            { _id: '507f1f77bcf86cd799439035', role: 'ADMIN' },
            bookingId,
            {}
        );

        expect(booking.booking_items[0].assigned_care_staff).toHaveLength(1);
        expect(booking.booking_items[0].assigned_care_staff[0]).toMatchObject({
            staff_profile_id: staffBId,
            user_id: userBId,
            released_at: null,
        });
        expect(booking.booking_items[0].assigned_care_staff[0].assigned_at).toBeInstanceOf(Date);
        expect(booking.assigned_care_staff_ids).toEqual([staffBId]);
        expect(booking.status).toBe('IN_PROGRESS');
        expect(bookingServiceStepService.createStepsForBooking).toHaveBeenCalledWith(
            expect.objectContaining({
                booking_items: expect.arrayContaining([
                    expect.objectContaining({
                        assigned_care_staff: expect.arrayContaining([
                            expect.objectContaining({
                                user_id: userBId,
                            }),
                        ]),
                    }),
                ]),
            }),
            careStaffServicePackage
        );
    });

    it('cancels a confirmed booking as staff or admin', async () => {
        const adminUser = { _id: '507f1f77bcf86cd799439041', role: 'ADMIN' };
        const booking = {
            _id: '507f1f77bcf86cd799439040',
            garage_id: garageId,
            status: 'CONFIRMED',
            payment_status: 'UNPAID',
            wash_bay_id: null,
            booking_items: [],
            save: jest.fn().mockResolvedValue(undefined),
            markModified: jest.fn(),
        };

        Booking.findById
            .mockReturnValueOnce(booking)
            .mockReturnValueOnce(createPopulateQuery(booking));

        const result = await bookingService.cancelBooking(adminUser, booking._id, {
            reason: 'Customer asked staff to cancel',
        });

        expect(booking.status).toBe('CANCELED');
        expect(booking.canceled_at).toBeInstanceOf(Date);
        expect(booking.canceled_by_id).toBe(adminUser._id);
        expect(booking.cancel_reason).toBe('Customer asked staff to cancel');
        expect(booking.save).toHaveBeenCalledTimes(1);
        expect(WashBay.findOneAndUpdate).not.toHaveBeenCalled();
        expect(bookingServiceStepService.markResourceReleasedForBookingItem).not.toHaveBeenCalled();
        expect(result.status).toBe('CANCELED');
    });

    it('cancels an in-progress booking and releases assigned resources', async () => {
        const adminUser = { _id: '507f1f77bcf86cd799439041', role: 'ADMIN' };
        const washBayId = '507f1f77bcf86cd799439042';
        const booking = {
            _id: '507f1f77bcf86cd799439040',
            garage_id: garageId,
            status: 'IN_PROGRESS',
            payment_status: 'UNPAID',
            wash_bay_id: washBayId,
            booking_items: [
                {
                    item_key: 'ITEM_1_507F1F77BCF86CD799439016',
                    requires_care_staff: true,
                    status: 'IN_PROGRESS',
                    assigned_care_staff: [
                        {
                            staff_profile_id: '507f1f77bcf86cd799439043',
                            user_id: '507f1f77bcf86cd799439044',
                            assigned_at: new Date('2999-01-01T06:00:00.000Z'),
                            released_at: null,
                        },
                    ],
                },
            ],
            save: jest.fn().mockResolvedValue(undefined),
            markModified: jest.fn(),
        };

        Booking.findById
            .mockReturnValueOnce(booking)
            .mockReturnValueOnce(createPopulateQuery(booking));
        WashBay.findOneAndUpdate.mockResolvedValue({});

        await bookingService.cancelBooking(adminUser, booking._id, {
            reason: 'Garage cannot continue service',
        });

        expect(booking.status).toBe('CANCELED');
        expect(booking.canceled_at).toBeInstanceOf(Date);
        expect(booking.booking_items[0].assigned_care_staff[0].released_at).toBe(booking.canceled_at);
        expect(booking.markModified).toHaveBeenCalledWith('booking_items');
        expect(WashBay.findOneAndUpdate).toHaveBeenCalledWith(
            {
                _id: washBayId,
                current_booking_id: booking._id,
            },
            {
                status: 'AVAILABLE',
                current_booking_id: null,
            }
        );
        expect(bookingServiceStepService.markResourceReleasedForBookingItem).toHaveBeenCalledWith(
            booking._id,
            'ITEM_1_507F1F77BCF86CD799439016',
            booking.canceled_at
        );
    });

    it('rejects staff cancel when booking is completed or paid', async () => {
        const adminUser = { _id: '507f1f77bcf86cd799439041', role: 'ADMIN' };

        Booking.findById.mockReturnValueOnce({
            _id: '507f1f77bcf86cd799439040',
            garage_id: garageId,
            status: 'COMPLETED',
            payment_status: 'UNPAID',
        });

        await expect(bookingService.cancelBooking(adminUser, '507f1f77bcf86cd799439040')).rejects.toMatchObject({
            statusCode: 400,
            errorCode: 'BOOKING_CANCEL_NOT_ALLOWED',
        });

        Booking.findById.mockReturnValueOnce({
            _id: '507f1f77bcf86cd799439045',
            garage_id: garageId,
            status: 'CONFIRMED',
            payment_status: 'PAID',
        });

        await expect(bookingService.cancelBooking(adminUser, '507f1f77bcf86cd799439045')).rejects.toMatchObject({
            statusCode: 409,
            errorCode: 'BOOKING_PAID_CANNOT_CANCEL',
        });
    });

    it('marks slot available when care staff capacity remains', async () => {
        const result = await bookingService.getAvailableSlots({
            garage_id: garageId,
            service_package_id: servicePackageId,
            date: '2999-01-01',
        });

        expect(result.requires_care_staff).toBe(true);
        expect(result.active_care_staff_count).toBe(2);
        expect(result.slots).toHaveLength(1);
        expect(result.slots[0].is_available).toBe(true);
        expect(result.slots[0].available_care_staff_capacity).toBe(1);
        expect(washBayService.assertGarageSupportsVehicleType).not.toHaveBeenCalled();
        expect(WashBay.countDocuments).not.toHaveBeenCalled();
    });

    it('rejects customer booking when care staff capacity is full', async () => {
        Booking.aggregate.mockResolvedValue([{ total: 2 }]);

        await expect(bookingService.createCustomerBooking(customerId, {
            garage_id: garageId,
            vehicle_id: vehicleId,
            service_package_id: servicePackageId,
            start_time: '2999-01-01T13:00:00+07:00',
        })).rejects.toMatchObject({
            statusCode: 409,
            errorCode: 'CARE_STAFF_CAPACITY_FULL',
        });

        expect(Booking.create).not.toHaveBeenCalled();
    });

    it('rejects combo booking when all matching wash bays are under maintenance', async () => {
        Garage.findById.mockResolvedValue({
            ...garage,
            closing_time: '18:00',
        });
        ServicePackage.findById.mockResolvedValue(comboServicePackage);
        WashBay.countDocuments
            .mockResolvedValueOnce(1)
            .mockResolvedValueOnce(1)
            .mockResolvedValueOnce(0);

        await expect(bookingService.createCustomerBooking(customerId, {
            garage_id: garageId,
            vehicle_id: vehicleId,
            service_package_id: servicePackageId,
            start_time: '2999-01-01T13:00:00+07:00',
        })).rejects.toMatchObject({
            statusCode: 409,
            errorCode: 'WASH_BAY_TEMPORARILY_UNAVAILABLE',
        });

        expect(Booking.create).not.toHaveBeenCalled();
    });

    it('rejects combo booking when garage has no matching wash bay type', async () => {
        Garage.findById.mockResolvedValue({
            ...garage,
            closing_time: '18:00',
        });
        ServicePackage.findById.mockResolvedValue(comboServicePackage);
        WashBay.countDocuments.mockResolvedValueOnce(0);

        await expect(bookingService.createCustomerBooking(customerId, {
            garage_id: garageId,
            vehicle_id: vehicleId,
            service_package_id: servicePackageId,
            start_time: '2999-01-01T13:00:00+07:00',
        })).rejects.toMatchObject({
            statusCode: 400,
            errorCode: 'GARAGE_VEHICLE_TYPE_NOT_SUPPORTED',
        });

        expect(Booking.create).not.toHaveBeenCalled();
    });

    it('rejects combo booking when matching wash bay slot capacity is full', async () => {
        Garage.findById.mockResolvedValue({
            ...garage,
            closing_time: '18:00',
        });
        ServicePackage.findById.mockResolvedValue(comboServicePackage);
        WashBay.countDocuments
            .mockResolvedValueOnce(1)
            .mockResolvedValueOnce(1)
            .mockResolvedValueOnce(1);
        Booking.aggregate.mockResolvedValueOnce([{ total: 1 }]);

        await expect(bookingService.createCustomerBooking(customerId, {
            garage_id: garageId,
            vehicle_id: vehicleId,
            service_package_id: servicePackageId,
            start_time: '2999-01-01T13:00:00+07:00',
        })).rejects.toMatchObject({
            statusCode: 409,
            errorCode: 'WASH_BAY_CAPACITY_FULL',
        });

        expect(Booking.create).not.toHaveBeenCalled();
    });

    it('builds combo and add-on booking items with separate resource ranges', async () => {
        Garage.findById.mockResolvedValue({
            ...garage,
            closing_time: '16:00',
        });
        ServicePackage.findById.mockResolvedValue(comboServicePackage);
        Booking.aggregate.mockResolvedValue([]);

        const result = await bookingService.getAvailableSlots({
            garage_id: garageId,
            service_package_id: servicePackageId,
            add_on_service_ids: [addOnServiceId],
            date: '2999-01-01',
        });

        expect(result.slots).toHaveLength(1);
        expect(result.slots[0].is_available).toBe(true);
        expect(result.slots[0].booking_items).toHaveLength(3);
        expect(result.slots[0].booking_items[0]).toMatchObject({
            service_package_id: washServiceId,
            source: 'COMBO_INCLUDED',
            requires_wash_bay: true,
            requires_care_staff: false,
        });
        expect(result.slots[0].booking_items[0].wash_bay_start_time.toISOString()).toBe('2999-01-01T06:00:00.000Z');
        expect(result.slots[0].booking_items[0].wash_bay_end_time.toISOString()).toBe('2999-01-01T06:30:00.000Z');
        expect(result.slots[0].booking_items[1]).toMatchObject({
            service_package_id: careServiceId,
            source: 'COMBO_INCLUDED',
            requires_wash_bay: false,
            requires_care_staff: true,
        });
        expect(result.slots[0].booking_items[1].care_staff_start_time.toISOString()).toBe('2999-01-01T06:30:00.000Z');
        expect(result.slots[0].booking_items[1].care_staff_end_time.toISOString()).toBe('2999-01-01T08:30:00.000Z');
        expect(result.slots[0].booking_items[2]).toMatchObject({
            service_package_id: addOnServiceId,
            source: 'ADD_ON',
            requires_care_staff: true,
        });
        expect(result.slots[0].booking_items[2].care_staff_start_time.toISOString()).toBe('2999-01-01T08:30:00.000Z');
        expect(result.slots[0].booking_items[2].care_staff_end_time.toISOString()).toBe('2999-01-01T09:00:00.000Z');
    });

    it('rejects add-on service that is already included in combo', async () => {
        ServicePackage.findById.mockResolvedValue(comboServicePackage);

        await expect(bookingService.getAvailableSlots({
            garage_id: garageId,
            service_package_id: servicePackageId,
            add_on_service_ids: [washServiceId],
            date: '2999-01-01',
        })).rejects.toMatchObject({
            statusCode: 409,
            errorCode: 'DUPLICATE_SERVICE_ITEM',
        });
    });

    it('rejects duplicate booking item even when service allows duplicate flag', async () => {
        ServicePackage.findById.mockResolvedValue(comboServicePackage);
        ServicePackage.find.mockImplementation((filter) => {
            const ids = (filter._id?.$in || []).map((id) => id.toString());
            const services = [
                {
                    ...washService,
                    allow_duplicate_in_booking: true,
                },
                careService,
                ironDustService,
            ];

            return Promise.resolve(services.filter((item) => ids.includes(item._id.toString())));
        });

        await expect(bookingService.getAvailableSlots({
            garage_id: garageId,
            service_package_id: servicePackageId,
            add_on_service_ids: [washServiceId],
            date: '2999-01-01',
        })).rejects.toMatchObject({
            statusCode: 409,
            errorCode: 'DUPLICATE_SERVICE_ITEM',
        });
    });

    it('marks wash booking item done and releases wash bay when its required steps are done', async () => {
        const washBayId = '507f1f77bcf86cd799439018';
        const booking = {
            _id: '507f1f77bcf86cd799439019',
            garage_id: garageId,
            status: 'IN_PROGRESS',
            wash_bay_id: washBayId,
            booking_items: [
                {
                    item_key: 'ITEM_1_507F1F77BCF86CD799439015',
                    requires_wash_bay: true,
                    status: 'PENDING',
                },
                {
                    item_key: 'ITEM_2_507F1F77BCF86CD799439016',
                    requires_wash_bay: false,
                    requires_care_staff: true,
                    status: 'PENDING',
                },
            ],
            save: jest.fn().mockResolvedValue(undefined),
            markModified: jest.fn(),
        };

        Booking.findById.mockResolvedValue(booking);
        WashBay.findOneAndUpdate.mockResolvedValue({});
        bookingServiceStepService.markStepDone.mockResolvedValue({
            id: '507f1f77bcf86cd799439020',
            booking_item_key: 'ITEM_1_507F1F77BCF86CD799439015',
        });
        bookingServiceStepService.areAllRequiredStepsDoneForBookingItem.mockResolvedValue(true);

        await bookingService.markBookingServiceStepDone(
            { _id: '507f1f77bcf86cd799439021', role: 'ADMIN' },
            booking._id,
            '507f1f77bcf86cd799439020',
            {}
        );

        expect(booking.booking_items[0].status).toBe('DONE');
        expect(booking.markModified).toHaveBeenCalledWith('booking_items');
        expect(bookingServiceStepService.markResourceReleasedForBookingItem).toHaveBeenCalledWith(
            booking._id,
            'ITEM_1_507F1F77BCF86CD799439015',
            expect.any(Date)
        );
        expect(WashBay.findOneAndUpdate).toHaveBeenCalledWith(
            {
                _id: washBayId,
                current_booking_id: booking._id,
            },
            {
                status: 'AVAILABLE',
                current_booking_id: null,
            }
        );
    });

    it('releases assigned care staff when a care booking item is done', async () => {
        const staffProfileId = '507f1f77bcf86cd799439031';
        const userId = '507f1f77bcf86cd799439032';
        const booking = {
            _id: '507f1f77bcf86cd799439019',
            garage_id: garageId,
            status: 'IN_PROGRESS',
            wash_bay_id: null,
            booking_items: [
                {
                    item_key: 'ITEM_1_507F1F77BCF86CD799439016',
                    requires_wash_bay: false,
                    requires_care_staff: true,
                    status: 'PENDING',
                    assigned_care_staff: [
                        {
                            staff_profile_id: staffProfileId,
                            user_id: userId,
                            assigned_at: new Date('2999-01-01T06:00:00.000Z'),
                            released_at: null,
                        },
                    ],
                },
            ],
            save: jest.fn().mockResolvedValue(undefined),
            markModified: jest.fn(),
        };

        Booking.findById.mockResolvedValue(booking);
        bookingServiceStepService.markStepDone.mockResolvedValue({
            id: '507f1f77bcf86cd799439020',
            booking_item_key: 'ITEM_1_507F1F77BCF86CD799439016',
        });
        bookingServiceStepService.areAllRequiredStepsDoneForBookingItem.mockResolvedValue(true);

        await bookingService.markBookingServiceStepDone(
            { _id: '507f1f77bcf86cd799439021', role: 'ADMIN' },
            booking._id,
            '507f1f77bcf86cd799439020',
            {}
        );

        expect(booking.booking_items[0].status).toBe('DONE');
        expect(booking.booking_items[0].assigned_care_staff[0].released_at).toBeInstanceOf(Date);
        expect(bookingServiceStepService.markResourceReleasedForBookingItem).toHaveBeenCalledWith(
            booking._id,
            'ITEM_1_507F1F77BCF86CD799439016',
            booking.booking_items[0].assigned_care_staff[0].released_at
        );
    });

    it('releases remaining active care staff assignments when service is completed', async () => {
        const bookingId = '507f1f77bcf86cd799439019';
        const booking = {
            _id: bookingId,
            garage_id: garageId,
            status: 'IN_PROGRESS',
            wash_bay_id: null,
            booking_items: [
                {
                    item_key: 'ITEM_1_507F1F77BCF86CD799439016',
                    requires_care_staff: true,
                    status: 'IN_PROGRESS',
                    assigned_care_staff: [
                        {
                            staff_profile_id: '507f1f77bcf86cd799439031',
                            user_id: '507f1f77bcf86cd799439032',
                            assigned_at: new Date('2999-01-01T06:00:00.000Z'),
                            released_at: null,
                        },
                    ],
                },
            ],
            save: jest.fn().mockResolvedValue(undefined),
            markModified: jest.fn(),
        };

        Booking.findById
            .mockReturnValueOnce(booking)
            .mockReturnValueOnce(createPopulateQuery(booking));
        bookingServiceStepService.assertAllRequiredStepsDone.mockResolvedValue(undefined);

        await bookingService.completeService(
            { _id: '507f1f77bcf86cd799439021', role: 'ADMIN' },
            bookingId,
            {}
        );

        expect(booking.status).toBe('COMPLETED');
        expect(booking.completed_at).toBeInstanceOf(Date);
        expect(booking.booking_items[0].assigned_care_staff[0].released_at).toBe(booking.completed_at);
        expect(bookingServiceStepService.markResourceReleasedForBookingItem).toHaveBeenCalledWith(
            booking._id,
            'ITEM_1_507F1F77BCF86CD799439016',
            booking.completed_at
        );
    });
});
