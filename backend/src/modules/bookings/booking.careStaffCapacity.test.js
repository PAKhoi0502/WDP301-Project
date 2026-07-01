const mongoose = require('mongoose');

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
    exists: jest.fn(),
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
jest.mock('../audit-logs/auditLog.service', () => ({
    recordAuditEvent: jest.fn(),
}));
jest.mock('../promotions/promotion.service', () => ({
    validatePromotionForBooking: jest.fn(),
}));
jest.mock('../loyalty/customerLoyalty.model', () => ({
    findOne: jest.fn(),
}));
jest.mock('../loyalty/tierRule.model', () => ({
    findOne: jest.fn(),
}));
jest.mock('../loyalty/loyalty.service', () => ({
    calculateBookingRedeemDiscount: jest.fn(),
    redeemPointsForBooking: jest.fn(),
    refundRedeemedPointsForBooking: jest.fn(),
}));
jest.mock('../booking-violations/bookingViolation.service', () => ({
    assertCustomerCanCreateBooking: jest.fn(),
    recordLateCancelIfNeeded: jest.fn(),
    recordNoShow: jest.fn(),
}));

const Booking = require('./booking.model');
const Vehicle = require('../vehicles/vehicle.model');
const Garage = require('../garages/garage.model');
const WashBay = require('../wash-bays/washBay.model');
const StaffProfile = require('../staff-profiles/staffProfile.model');
const ServicePackage = require('../service-packages/servicePackage.model');
const bookingServiceStepService = require('../booking-service-steps/bookingServiceStep.service');
const auditLogService = require('../audit-logs/auditLog.service');
const washBayService = require('../wash-bays/washBay.service');
const promotionService = require('../promotions/promotion.service');
const CustomerLoyalty = require('../loyalty/customerLoyalty.model');
const TierRule = require('../loyalty/tierRule.model');
const loyaltyService = require('../loyalty/loyalty.service');
const bookingViolationService = require('../booking-violations/bookingViolation.service');
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

const createCapacityReservation = (bookingId, requiredCount = 1) => ({
    booking_id: bookingId,
    start_time: new Date('2999-01-01T00:00:00.000Z'),
    reserved_until: new Date('2999-01-02T00:00:00.000Z'),
    required_count: requiredCount,
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
        Booking.aggregate.mockResolvedValue([
            createCapacityReservation('507f1f77bcf86cd799439080'),
        ]);
        bookingServiceStepService.markStepDone = jest.fn();
        bookingServiceStepService.createStepsForBooking = jest.fn();
        bookingServiceStepService.areAllRequiredStepsDoneForBookingItem = jest.fn();
        bookingServiceStepService.markResourceReleasedForBookingItem = jest.fn();
        bookingServiceStepService.clearResourceReleasedForBookingItem = jest.fn();
        bookingServiceStepService.assertAllRequiredStepsDone = jest.fn();
        auditLogService.recordAuditEvent.mockResolvedValue(null);
        Vehicle.findOne.mockResolvedValue({
            _id: vehicleId,
            customer_id: customerId,
            vehicle_type: 'CAR',
            raw_license_plate: '59A-12345',
            normalized_license_plate: '59A12345',
            is_active: true,
        });
        Vehicle.exists.mockResolvedValue(null);
        promotionService.validatePromotionForBooking.mockResolvedValue(null);
        loyaltyService.calculateBookingRedeemDiscount.mockResolvedValue({
            loyalty: null,
            redeem_rule: null,
            used_points: 0,
            points_discount_amount: 0,
        });
        loyaltyService.redeemPointsForBooking.mockResolvedValue(null);
        loyaltyService.refundRedeemedPointsForBooking.mockResolvedValue(null);
        bookingViolationService.assertCustomerCanCreateBooking.mockResolvedValue({ allowed: true });
        bookingViolationService.recordLateCancelIfNeeded.mockResolvedValue(null);
        bookingViolationService.recordNoShow.mockResolvedValue(null);
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

    afterEach(() => {
        jest.useRealTimers();
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
            .mockResolvedValueOnce([
                createCapacityReservation('507f1f77bcf86cd799439080'),
            ])
            .mockResolvedValueOnce([
                createCapacityReservation('507f1f77bcf86cd799439080'),
            ])
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
        const activeAssignmentPipeline = Booking.aggregate.mock.calls[2][0];
        const serializedPipeline = JSON.stringify(activeAssignmentPipeline);

        expect(serializedPipeline).toContain('assigned_care_staff.released_at');
        expect(serializedPipeline).not.toContain('care_staff_start_time');
        expect(serializedPipeline).not.toContain('care_staff_reserved_until');
    });

    it('rejects starting service before the scheduled booking time', async () => {
        const booking = {
            _id: '507f1f77bcf86cd799439030',
            garage_id: garageId,
            status: 'CHECKED_IN',
            start_time: new Date('2999-01-01T06:00:00.000Z'),
        };

        Booking.findById.mockResolvedValue(booking);

        await expect(bookingService.startService(
            { _id: '507f1f77bcf86cd799439035', role: 'ADMIN' },
            booking._id,
            {}
        )).rejects.toMatchObject({
            statusCode: 409,
            errorCode: 'BOOKING_SERVICE_START_TOO_EARLY',
        });

        expect(StaffProfile.find).not.toHaveBeenCalled();
        expect(WashBay.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('shifts the booking timeline and starts service early when allowed', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2999-01-01T06:30:00.000Z'));

        const booking = {
            _id: '507f1f77bcf86cd799439030',
            garage_id: garageId,
            service_package_id: servicePackageId,
            vehicle_id: vehicleId,
            vehicle_type: 'CAR',
            status: 'CHECKED_IN',
            arrival_status: 'EARLY',
            arrived_at: new Date('2999-01-01T06:20:00.000Z'),
            start_time: new Date('2999-01-01T07:00:00.000Z'),
            end_time: new Date('2999-01-01T07:30:00.000Z'),
            booking_items: [
                {
                    item_key: 'ITEM_1_507F1F77BCF86CD799439016',
                    service_package_id: careServiceId,
                    source: 'PRIMARY',
                    name_snapshot: 'Interior check',
                    sequence: 1,
                    duration_minutes: 30,
                    item_start_time: new Date('2999-01-01T07:00:00.000Z'),
                    item_end_time: new Date('2999-01-01T07:30:00.000Z'),
                    requires_wash_bay: false,
                    requires_care_staff: false,
                    status: 'PENDING',
                },
            ],
            save: jest.fn().mockResolvedValue(undefined),
            markModified: jest.fn(),
        };

        Booking.findById
            .mockReturnValueOnce(booking)
            .mockReturnValueOnce(createPopulateQuery(booking));
        bookingServiceStepService.createStepsForBooking.mockResolvedValue([]);

        await bookingService.startService(
            { _id: '507f1f77bcf86cd799439035', role: 'ADMIN' },
            booking._id,
            {
                allow_early_start: true,
                note: 'Customer requested early service',
            }
        );

        expect(booking.original_start_time.toISOString()).toBe('2999-01-01T07:00:00.000Z');
        expect(booking.original_end_time.toISOString()).toBe('2999-01-01T07:30:00.000Z');
        expect(booking.start_time.toISOString()).toBe('2999-01-01T06:30:00.000Z');
        expect(booking.end_time.toISOString()).toBe('2999-01-01T07:00:00.000Z');
        expect(booking.booking_items[0].item_start_time.toISOString()).toBe('2999-01-01T06:30:00.000Z');
        expect(booking.booking_items[0].item_end_time.toISOString()).toBe('2999-01-01T07:00:00.000Z');
        expect(booking.status).toBe('IN_PROGRESS');
        expect(booking.started_at.toISOString()).toBe('2999-01-01T06:30:00.000Z');
        expect(booking.rescheduled_by_id).toBe('507f1f77bcf86cd799439035');
        expect(booking.reschedule_reason).toBe('CUSTOMER_EARLY_REQUEST');
        expect(booking.reschedule_count).toBe(1);
        expect(booking.note).toBe('Customer requested early service');
        expect(Booking.exists).toHaveBeenCalledWith(expect.objectContaining({
            vehicle_id: vehicleId,
            _id: { $ne: booking._id },
        }));
        expect(bookingServiceStepService.createStepsForBooking).toHaveBeenCalledWith(
            expect.objectContaining({
                start_time: new Date('2999-01-01T06:30:00.000Z'),
            }),
            careStaffServicePackage
        );
    });

    it('shifts a delayed start to the actual time and records STAFF_DELAY', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2999-01-01T06:15:00.000Z'));

        const booking = {
            _id: '507f1f77bcf86cd799439036',
            garage_id: garageId,
            service_package_id: servicePackageId,
            vehicle_id: vehicleId,
            vehicle_type: 'CAR',
            status: 'CHECKED_IN',
            arrival_status: 'ON_TIME',
            start_time: new Date('2999-01-01T06:00:00.000Z'),
            end_time: new Date('2999-01-01T06:30:00.000Z'),
            booking_items: [
                {
                    item_key: 'ITEM_1_507F1F77BCF86CD799439016',
                    sequence: 1,
                    item_start_time: new Date('2999-01-01T06:00:00.000Z'),
                    item_end_time: new Date('2999-01-01T06:30:00.000Z'),
                    requires_wash_bay: false,
                    requires_care_staff: false,
                    status: 'PENDING',
                },
            ],
            save: jest.fn().mockResolvedValue(undefined),
            markModified: jest.fn(),
        };

        Booking.findById
            .mockReturnValueOnce(booking)
            .mockReturnValueOnce(createPopulateQuery(booking));
        bookingServiceStepService.createStepsForBooking.mockResolvedValue([]);

        await bookingService.startService(
            { _id: '507f1f77bcf86cd799439035', role: 'ADMIN' },
            booking._id,
            {},
            { ip: '127.0.0.1', userAgent: 'jest' }
        );

        expect(booking.original_start_time.toISOString()).toBe('2999-01-01T06:00:00.000Z');
        expect(booking.start_time.toISOString()).toBe('2999-01-01T06:15:00.000Z');
        expect(booking.end_time.toISOString()).toBe('2999-01-01T06:45:00.000Z');
        expect(booking.reschedule_reason).toBe('STAFF_DELAY');
        expect(booking.status).toBe('IN_PROGRESS');
        expect(auditLogService.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
            action: 'BOOKING_SERVICE_START_DELAYED',
            metadata: expect.objectContaining({ reason: 'STAFF_DELAY' }),
            ip: '127.0.0.1',
            userAgent: 'jest',
        }));
    });

    it('reuses care staff for sequential work even when rounded reservations overlap', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2999-01-01T06:10:00.000Z'));

        const staffProfileId = '507f1f77bcf86cd799439031';
        const staffUserId = '507f1f77bcf86cd799439032';
        const createCareItem = (sequence, start, end, reservedUntil) => ({
            item_key: `ITEM_${sequence}_507F1F77BCF86CD799439016`,
            sequence,
            item_start_time: new Date(start),
            item_end_time: new Date(end),
            requires_wash_bay: false,
            requires_care_staff: true,
            care_staff_type: 'VEHICLE_CARE_STAFF',
            care_staff_required_count: 1,
            care_staff_start_time: new Date(start),
            care_staff_end_time: new Date(end),
            care_staff_work_end_time: new Date(end),
            care_staff_reserved_until: new Date(reservedUntil),
            assigned_care_staff: [],
            status: 'PENDING',
        });
        const booking = {
            _id: '507f1f77bcf86cd799439037',
            garage_id: garageId,
            service_package_id: servicePackageId,
            vehicle_id: vehicleId,
            vehicle_type: 'CAR',
            status: 'CHECKED_IN',
            start_time: new Date('2999-01-01T06:00:00.000Z'),
            end_time: new Date('2999-01-01T07:00:00.000Z'),
            requires_care_staff: true,
            booking_items: [
                createCareItem(1, '2999-01-01T06:00:00.000Z', '2999-01-01T06:20:00.000Z', '2999-01-01T06:30:00.000Z'),
                createCareItem(2, '2999-01-01T06:20:00.000Z', '2999-01-01T06:40:00.000Z', '2999-01-01T07:00:00.000Z'),
                createCareItem(3, '2999-01-01T06:40:00.000Z', '2999-01-01T07:00:00.000Z', '2999-01-01T07:00:00.000Z'),
            ],
            save: jest.fn().mockResolvedValue(undefined),
            markModified: jest.fn(),
        };

        Booking.findById
            .mockReturnValueOnce(booking)
            .mockReturnValueOnce(createPopulateQuery(booking));
        Booking.aggregate.mockResolvedValue([]);
        StaffProfile.countDocuments.mockResolvedValue(1);
        StaffProfile.find.mockReturnValue(createFindSortLeanQuery([
            {
                _id: staffProfileId,
                user_id: staffUserId,
                staff_code: 'CARE001',
                staff_type: 'VEHICLE_CARE_STAFF',
                garage_id: garageId,
                is_active: true,
            },
        ]));
        bookingServiceStepService.createStepsForBooking.mockResolvedValue([]);

        await bookingService.startService(
            { _id: '507f1f77bcf86cd799439035', role: 'ADMIN' },
            booking._id,
            {}
        );

        expect(booking.booking_items).toHaveLength(3);
        for (const item of booking.booking_items) {
            expect(item.assigned_care_staff).toEqual([
                expect.objectContaining({
                    staff_profile_id: staffProfileId,
                    user_id: staffUserId,
                }),
            ]);
        }
        expect(booking.status).toBe('IN_PROGRESS');
    });

    it('rechecks resource capacity before starting a checked-in booking', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2999-01-01T06:15:00.000Z'));

        const booking = {
            _id: '507f1f77bcf86cd799439096',
            garage_id: garageId,
            service_package_id: servicePackageId,
            vehicle_type: 'CAR',
            status: 'CHECKED_IN',
            start_time: new Date('2999-01-01T06:00:00.000Z'),
            end_time: new Date('2999-01-01T06:30:00.000Z'),
            booking_items: [
                {
                    item_key: 'ITEM_1_507F1F77BCF86CD799439016',
                    requires_wash_bay: false,
                    requires_care_staff: true,
                    care_staff_type: 'VEHICLE_CARE_STAFF',
                    care_staff_required_count: 1,
                    item_start_time: new Date('2999-01-01T06:00:00.000Z'),
                    item_end_time: new Date('2999-01-01T06:30:00.000Z'),
                    care_staff_start_time: new Date('2999-01-01T06:00:00.000Z'),
                    care_staff_end_time: new Date('2999-01-01T06:30:00.000Z'),
                    care_staff_work_end_time: new Date('2999-01-01T06:30:00.000Z'),
                    care_staff_reserved_until: new Date('2999-01-01T06:30:00.000Z'),
                    status: 'PENDING',
                },
            ],
        };
        Booking.findById.mockResolvedValue(booking);
        StaffProfile.countDocuments.mockResolvedValue(1);
        Booking.aggregate.mockResolvedValueOnce([
            {
                booking_id: '507f1f77bcf86cd799439097',
                start_time: new Date('2999-01-01T06:15:00.000Z'),
                reserved_until: new Date('2999-01-01T06:45:00.000Z'),
                required_count: 1,
            },
        ]);

        await expect(bookingService.startService(
            { _id: '507f1f77bcf86cd799439095', role: 'ADMIN' },
            booking._id,
            {}
        )).rejects.toMatchObject({
            statusCode: 409,
            errorCode: 'BOOKING_LATE_START_RESOURCE_CONFLICT',
            errors: [expect.objectContaining({
                reason: 'STAFF_DELAY',
                conflict_code: 'CARE_STAFF_CAPACITY_FULL',
                options: ['REASSIGN_RESOURCES', 'RESCHEDULE'],
            })],
        });

        expect(StaffProfile.find).not.toHaveBeenCalled();
        expect(bookingServiceStepService.createStepsForBooking).not.toHaveBeenCalled();
        expect(auditLogService.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
            action: 'BOOKING_SERVICE_START_DELAYED',
            metadata: expect.objectContaining({
                reason: 'STAFF_DELAY',
                outcome: 'BLOCKED',
                conflict_code: 'CARE_STAFF_CAPACITY_FULL',
                options: ['REASSIGN_RESOURCES', 'RESCHEDULE'],
            }),
        }));
    });

    it('keeps a released wash bay reservation unavailable until reserved time ends', async () => {
        const washBayId = '507f1f77bcf86cd799439018';
        const bookingId = '507f1f77bcf86cd799439019';
        const booking = {
            _id: bookingId,
            garage_id: garageId,
            status: 'IN_PROGRESS',
            wash_bay_id: washBayId,
            booking_items: [
                {
                    item_key: 'ITEM_1_507F1F77BCF86CD799439015',
                    requires_wash_bay: true,
                    wash_bay_start_time: new Date('2999-01-01T04:00:00.000Z'),
                    wash_bay_end_time: new Date('2999-01-01T04:15:00.000Z'),
                    wash_bay_reserved_until: new Date('2999-01-01T04:30:00.000Z'),
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
            bookingId,
            '507f1f77bcf86cd799439020',
            {}
        );

        Garage.findById.mockResolvedValue({
            ...garage,
            opening_time: '11:00',
            closing_time: '11:30',
        });
        ServicePackage.findById.mockResolvedValue({
            ...washService,
            duration_minutes: 15,
            wash_bay_duration_minutes: 15,
        });
        WashBay.countDocuments.mockResolvedValue(1);
        Booking.aggregate.mockResolvedValue([
            {
                booking_id: bookingId,
                start_time: new Date('2999-01-01T04:00:00.000Z'),
                reserved_until: new Date('2999-01-01T04:30:00.000Z'),
                required_count: 1,
            },
        ]);

        const result = await bookingService.getAvailableSlots({
            garage_id: garageId,
            service_package_id: washServiceId,
            date: '2999-01-01',
        });

        expect(booking.booking_items[0].status).toBe('DONE');
        expect(WashBay.findOneAndUpdate).toHaveBeenCalledWith(
            {
                _id: washBayId,
                current_booking_id: bookingId,
            },
            {
                status: 'AVAILABLE',
                current_booking_id: null,
            }
        );
        expect(result.slots).toHaveLength(1);
        expect(result.slots[0].is_available).toBe(false);
        expect(result.slots[0].available_wash_bay_capacity).toBe(0);
    });

    it('does not start a delayed booking while its wash bay is still occupied', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2999-01-01T06:15:00.000Z'));

        const booking = {
            _id: '507f1f77bcf86cd799439090',
            garage_id: garageId,
            service_package_id: washServiceId,
            vehicle_type: 'CAR',
            status: 'CHECKED_IN',
            start_time: new Date('2999-01-01T06:00:00.000Z'),
            end_time: new Date('2999-01-01T06:30:00.000Z'),
            requires_wash_bay: true,
            requires_care_staff: false,
            wash_bay_id: null,
            booking_items: [],
            save: jest.fn().mockResolvedValue(undefined),
            markModified: jest.fn(),
        };

        Booking.findById.mockResolvedValue(booking);
        ServicePackage.findById.mockResolvedValue(washService);
        WashBay.findOneAndUpdate.mockResolvedValue(null);

        await expect(bookingService.startService(
            { _id: '507f1f77bcf86cd799439091', role: 'ADMIN' },
            booking._id,
            {}
        )).rejects.toMatchObject({
            statusCode: 409,
            errorCode: 'BOOKING_LATE_START_RESOURCE_CONFLICT',
            errors: [expect.objectContaining({
                conflict_code: 'NO_AVAILABLE_WASH_BAY',
                options: ['REASSIGN_RESOURCES', 'RESCHEDULE'],
            })],
        });

        expect(booking.status).toBe('CHECKED_IN');
        expect(booking.started_at).toBeUndefined();
        expect(bookingServiceStepService.createStepsForBooking).not.toHaveBeenCalled();
    });

    it('does not start a delayed booking while care staff remains assigned elsewhere', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2999-01-01T06:15:00.000Z'));

        const busyStaffProfileId = '507f1f77bcf86cd799439092';
        const booking = {
            _id: '507f1f77bcf86cd799439093',
            garage_id: garageId,
            service_package_id: servicePackageId,
            vehicle_type: 'CAR',
            status: 'CHECKED_IN',
            start_time: new Date('2999-01-01T06:00:00.000Z'),
            end_time: new Date('2999-01-01T06:30:00.000Z'),
            requires_wash_bay: false,
            requires_care_staff: true,
            booking_items: [
                {
                    item_key: 'ITEM_1_507F1F77BCF86CD799439016',
                    sequence: 1,
                    requires_wash_bay: false,
                    requires_care_staff: true,
                    care_staff_type: 'VEHICLE_CARE_STAFF',
                    care_staff_required_count: 1,
                    item_start_time: new Date('2999-01-01T06:00:00.000Z'),
                    item_end_time: new Date('2999-01-01T06:30:00.000Z'),
                    care_staff_start_time: new Date('2999-01-01T06:00:00.000Z'),
                    care_staff_end_time: new Date('2999-01-01T06:30:00.000Z'),
                    care_staff_work_end_time: new Date('2999-01-01T06:30:00.000Z'),
                    care_staff_reserved_until: new Date('2999-01-01T06:30:00.000Z'),
                    assigned_care_staff: [],
                    status: 'PENDING',
                },
            ],
            save: jest.fn().mockResolvedValue(undefined),
            markModified: jest.fn(),
        };

        Booking.findById.mockResolvedValue(booking);
        ServicePackage.findById.mockResolvedValue(careStaffServicePackage);
        StaffProfile.find.mockReturnValue(createFindSortLeanQuery([
            {
                _id: busyStaffProfileId,
                user_id: '507f1f77bcf86cd799439094',
                staff_code: 'STAFF_BUSY',
                staff_type: 'VEHICLE_CARE_STAFF',
                garage_id: garageId,
                is_active: true,
            },
        ]));
        Booking.aggregate
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ _id: busyStaffProfileId }]);

        await expect(bookingService.startService(
            { _id: '507f1f77bcf86cd799439095', role: 'ADMIN' },
            booking._id,
            {}
        )).rejects.toMatchObject({
            statusCode: 409,
            errorCode: 'BOOKING_LATE_START_RESOURCE_CONFLICT',
            errors: [expect.objectContaining({
                conflict_code: 'CARE_STAFF_CAPACITY_FULL',
                options: ['REASSIGN_RESOURCES', 'RESCHEDULE'],
            })],
        });

        expect(booking.status).toBe('CHECKED_IN');
        expect(booking.started_at).toBeUndefined();
        expect(bookingServiceStepService.createStepsForBooking).not.toHaveBeenCalled();
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
        expect(loyaltyService.refundRedeemedPointsForBooking).toHaveBeenCalledWith({
            booking,
            actorId: adminUser._id,
        });
        expect(WashBay.findOneAndUpdate).not.toHaveBeenCalled();
        expect(bookingServiceStepService.markResourceReleasedForBookingItem).not.toHaveBeenCalled();
        expect(bookingViolationService.recordLateCancelIfNeeded).not.toHaveBeenCalled();
        expect(bookingViolationService.recordNoShow).not.toHaveBeenCalled();
        expect(result.status).toBe('CANCELED');
    });

    it('cancels a late-arrival booking without refunding redeemed points', async () => {
        const adminUser = { _id: '507f1f77bcf86cd799439041', role: 'ADMIN' };
        const arrivedAt = new Date('2026-06-29T10:35:00.000Z');
        const booking = {
            _id: '507f1f77bcf86cd799439040',
            customer_id: customerId,
            garage_id: garageId,
            status: 'CONFIRMED',
            payment_status: 'UNPAID',
            arrival_status: 'LATE',
            arrived_at: arrivedAt,
            late_minutes: 335,
            used_points: 20,
            wash_bay_id: null,
            booking_items: [],
            save: jest.fn().mockResolvedValue(undefined),
            markModified: jest.fn(),
        };

        Booking.findById
            .mockReturnValueOnce(booking)
            .mockReturnValueOnce(createPopulateQuery(booking));

        const result = await bookingService.cancelBooking(adminUser, booking._id, {
            reason: 'Customer arrived late and declined rescheduling',
        });

        expect(booking.status).toBe('CANCELED');
        expect(booking.arrival_status).toBe('LATE');
        expect(booking.late_minutes).toBe(335);
        expect(booking.arrived_at).toBe(arrivedAt);
        expect(booking.cancel_reason).toBe('Customer arrived late and declined rescheduling');
        expect(loyaltyService.refundRedeemedPointsForBooking).not.toHaveBeenCalled();
        expect(result.status).toBe('CANCELED');
        expect(result.arrival_status).toBe('LATE');
        expect(result.late_minutes).toBe(335);
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

    it('marks a confirmed booking as no-show without refunding redeemed points', async () => {
        const adminUser = { _id: '507f1f77bcf86cd799439041', role: 'ADMIN' };
        const booking = {
            _id: '507f1f77bcf86cd799439046',
            customer_id: customerId,
            garage_id: garageId,
            status: 'CONFIRMED',
            payment_status: 'UNPAID',
            used_points: 20,
            is_walk_in: false,
            wash_bay_id: null,
            booking_items: [],
            save: jest.fn().mockResolvedValue(undefined),
            markModified: jest.fn(),
        };

        Booking.findById
            .mockReturnValueOnce(booking)
            .mockReturnValueOnce(createPopulateQuery(booking));

        const result = await bookingService.markNoShow(adminUser, booking._id, {
            reason: 'Customer did not arrive',
        });

        expect(booking.status).toBe('NO_SHOW');
        expect(booking.no_show_at).toBeInstanceOf(Date);
        expect(booking.no_show_by_id).toBe(adminUser._id);
        expect(booking.no_show_reason).toBe('Customer did not arrive');
        expect(booking.save).toHaveBeenCalledTimes(1);
        expect(loyaltyService.refundRedeemedPointsForBooking).not.toHaveBeenCalled();
        expect(WashBay.findOneAndUpdate).not.toHaveBeenCalled();
        expect(bookingServiceStepService.markResourceReleasedForBookingItem).not.toHaveBeenCalled();
        expect(bookingViolationService.recordNoShow).toHaveBeenCalledWith({
            booking,
            reason: 'Customer did not arrive',
            actorId: adminUser._id,
            noShowAt: booking.no_show_at,
        });
        expect(result.status).toBe('NO_SHOW');
    });

    it('rejects no-show when booking was already checked in or paid', async () => {
        const adminUser = { _id: '507f1f77bcf86cd799439041', role: 'ADMIN' };

        Booking.findById.mockReturnValueOnce({
            _id: '507f1f77bcf86cd799439046',
            garage_id: garageId,
            status: 'CHECKED_IN',
            payment_status: 'UNPAID',
            is_walk_in: false,
        });

        await expect(bookingService.markNoShow(adminUser, '507f1f77bcf86cd799439046')).rejects.toMatchObject({
            statusCode: 400,
            errorCode: 'BOOKING_NO_SHOW_NOT_ALLOWED',
        });

        Booking.findById.mockReturnValueOnce({
            _id: '507f1f77bcf86cd799439047',
            garage_id: garageId,
            status: 'CONFIRMED',
            payment_status: 'PAID',
            is_walk_in: false,
        });

        await expect(bookingService.markNoShow(adminUser, '507f1f77bcf86cd799439047')).rejects.toMatchObject({
            statusCode: 409,
            errorCode: 'BOOKING_PAID_CANNOT_NO_SHOW',
        });

        Booking.findById.mockReturnValueOnce({
            _id: '507f1f77bcf86cd799439049',
            garage_id: garageId,
            status: 'CONFIRMED',
            payment_status: 'PENDING',
            is_walk_in: false,
        });

        await expect(bookingService.markNoShow(adminUser, '507f1f77bcf86cd799439049')).rejects.toMatchObject({
            statusCode: 409,
            errorCode: 'BOOKING_PENDING_PAYMENT_CANNOT_NO_SHOW',
        });
    });

    it('allows no-show for a scheduled walk-in booking', async () => {
        const adminUser = { _id: '507f1f77bcf86cd799439041', role: 'ADMIN' };
        const booking = {
            _id: '507f1f77bcf86cd799439048',
            garage_id: garageId,
            status: 'CONFIRMED',
            payment_status: 'UNPAID',
            is_walk_in: true,
            wash_bay_id: null,
            booking_items: [],
            save: jest.fn().mockResolvedValue(undefined),
        };
        Booking.findById
            .mockReturnValueOnce(booking)
            .mockReturnValueOnce(createPopulateQuery(booking));

        const result = await bookingService.markNoShow(
            adminUser,
            '507f1f77bcf86cd799439048',
            { reason: 'GUEST_DID_NOT_RETURN' }
        );

        expect(result.status).toBe('NO_SHOW');
        expect(booking.no_show_reason).toBe('GUEST_DID_NOT_RETURN');
        expect(booking.save).toHaveBeenCalledTimes(1);
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

    it('returns available slots grouped by each requested day', async () => {
        Booking.aggregate.mockResolvedValue([]);

        const result = await bookingService.getAvailableSlots({
            garage_id: garageId,
            service_package_id: servicePackageId,
            start_date: '2999-01-01',
            days: 3,
        });

        expect(result.start_date).toBe('2999-01-01');
        expect(result.requested_days).toBe(3);
        expect(result.service_duration_minutes).toBe(90);
        expect(result.days).toHaveLength(3);
        expect(result.days.map((item) => item.date)).toEqual([
            '2999-01-01',
            '2999-01-02',
            '2999-01-03',
        ]);
        expect(result.days.every((item) => item.has_available_slots)).toBe(true);
        expect(result.days.every((item) => item.available_slots.length === 1)).toBe(true);
        expect(Booking.aggregate).toHaveBeenCalledTimes(1);
    });

    it('returns a no-continuous-slot reason when every candidate is full', async () => {
        StaffProfile.countDocuments.mockResolvedValue(1);
        Booking.aggregate.mockResolvedValue([
            {
                booking_id: '507f1f77bcf86cd799439090',
                start_time: new Date('2999-01-01T00:00:00.000Z'),
                reserved_until: new Date('2999-01-02T00:00:00.000Z'),
                required_count: 1,
            },
        ]);

        const result = await bookingService.getAvailableSlots({
            garage_id: garageId,
            service_package_id: servicePackageId,
            date: '2999-01-01',
        });

        expect(result.has_available_slots).toBe(false);
        expect(result.available_slots).toEqual([]);
        expect(result.days[0]).toMatchObject({
            date: '2999-01-01',
            has_available_slots: false,
            reason: 'NO_CONTINUOUS_SLOT_AVAILABLE',
        });
        expect(result.days[0].slots[0].unavailable_reasons).toContain('CARE_STAFF_CAPACITY_FULL');
    });

    it('filters only candidate times that overlap the selected vehicle booking', async () => {
        Garage.findById.mockResolvedValue({
            ...garage,
            closing_time: '14:30',
        });
        ServicePackage.findById.mockResolvedValue({
            ...careStaffServicePackage,
            duration_minutes: 30,
            care_staff_duration_minutes: 30,
        });
        Booking.aggregate.mockImplementation((pipeline) => {
            const serializedPipeline = JSON.stringify(pipeline);

            if (serializedPipeline.includes('"vehicle_id"') && !serializedPipeline.includes('"booking_items"')) {
                return Promise.resolve([
                    {
                        booking_id: '507f1f77bcf86cd799439091',
                        start_time: new Date('2999-01-01T06:30:00.000Z'),
                        end_time: new Date('2999-01-01T07:00:00.000Z'),
                    },
                ]);
            }

            return Promise.resolve([]);
        });

        const result = await bookingService.getAvailableSlots({
            customer_id: customerId,
            vehicle_id: vehicleId,
            garage_id: garageId,
            service_package_id: servicePackageId,
            date: '2999-01-01',
        });

        expect(result.vehicle_id).toBe(vehicleId);
        expect(result.slots).toHaveLength(3);
        expect(result.slots.map((slot) => slot.is_available)).toEqual([true, false, true]);
        expect(result.slots[1].unavailable_reasons).toContain('VEHICLE_BOOKING_OVERLAP');
        expect(result.available_slots).toHaveLength(2);
    });

    it('requires authentication when availability is checked for a vehicle', async () => {
        await expect(bookingService.getAvailableSlots({
            vehicle_id: vehicleId,
            garage_id: garageId,
            service_package_id: servicePackageId,
            date: '2999-01-01',
        })).rejects.toMatchObject({
            statusCode: 401,
            errorCode: 'AUTHENTICATION_REQUIRED',
        });
    });

    it('starts today availability from the next future garage slot', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-06-11T18:17:00+07:00'));
        Garage.findById.mockResolvedValue({
            ...garage,
            opening_time: '07:00',
            closing_time: '19:00',
        });
        ServicePackage.findById.mockResolvedValue({
            ...washService,
            duration_minutes: 15,
            wash_bay_duration_minutes: 15,
        });
        Booking.aggregate.mockResolvedValue([]);

        const result = await bookingService.getAvailableSlots({
            garage_id: garageId,
            service_package_id: washServiceId,
            date: '2026-06-11',
        });

        expect(result.slots).toHaveLength(1);
        expect(result.slots[0].start_time.toISOString()).toBe('2026-06-11T11:30:00.000Z');
        expect(result.slots[0].end_time.toISOString()).toBe('2026-06-11T11:45:00.000Z');
        expect(result.slots[0].wash_bay_reserved_until.toISOString()).toBe('2026-06-11T12:00:00.000Z');
        expect(result.available_slots).toHaveLength(1);
    });

    it('moves past a slot when current time is exactly on its boundary', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-06-11T18:30:00+07:00'));
        Garage.findById.mockResolvedValue({
            ...garage,
            opening_time: '07:00',
            closing_time: '19:00',
        });
        ServicePackage.findById.mockResolvedValue({
            ...washService,
            duration_minutes: 15,
            wash_bay_duration_minutes: 15,
        });

        const result = await bookingService.getAvailableSlots({
            garage_id: garageId,
            service_package_id: washServiceId,
            date: '2026-06-11',
        });

        expect(result.slots).toEqual([]);
        expect(result.days[0].reason).toBe('NO_FUTURE_SLOT_TODAY');
        expect(Booking.aggregate).not.toHaveBeenCalled();
        expect(WashBay.countDocuments).not.toHaveBeenCalled();
    });

    it('does not offer a future slot when the service cannot finish before closing', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-06-11T18:17:00+07:00'));
        Garage.findById.mockResolvedValue({
            ...garage,
            opening_time: '07:00',
            closing_time: '19:00',
        });
        ServicePackage.findById.mockResolvedValue({
            ...careStaffServicePackage,
            duration_minutes: 60,
            care_staff_duration_minutes: 60,
        });

        const result = await bookingService.getAvailableSlots({
            garage_id: garageId,
            service_package_id: servicePackageId,
            date: '2026-06-11',
        });

        expect(result.slots).toEqual([]);
        expect(result.days[0].reason).toBe('NO_CONTINUOUS_SLOT_AVAILABLE');
        expect(Booking.aggregate).not.toHaveBeenCalled();
        expect(StaffProfile.countDocuments).not.toHaveBeenCalled();
    });

    it('skips capacity queries for a past date', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-06-11T18:17:00+07:00'));

        const result = await bookingService.getAvailableSlots({
            garage_id: garageId,
            service_package_id: servicePackageId,
            date: '2026-06-10',
        });

        expect(result.slots).toEqual([]);
        expect(result.available_slots).toEqual([]);
        expect(result.days[0].reason).toBe('DATE_IN_PAST');
        expect(Booking.aggregate).not.toHaveBeenCalled();
        expect(StaffProfile.countDocuments).not.toHaveBeenCalled();
    });

    it('limits available slots to the customer booking window', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-06-11T08:00:00+07:00'));
        Garage.findById.mockResolvedValue({
            ...garage,
            opening_time: '07:00',
            closing_time: '10:00',
        });
        ServicePackage.findById.mockResolvedValue({
            ...careStaffServicePackage,
            duration_minutes: 30,
            care_staff_duration_minutes: 30,
        });
        CustomerLoyalty.findOne.mockReturnValue({
            select: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue({
                    current_tier: 'GOLD',
                }),
            }),
        });
        TierRule.findOne.mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                tier_name: 'GOLD',
                booking_window_days: 1,
                max_upcoming_bookings: 1,
                priority_level: 1,
            }),
        });
        Booking.aggregate.mockResolvedValue([]);

        const result = await bookingService.getAvailableSlots({
            customer_id: customerId,
            garage_id: garageId,
            service_package_id: servicePackageId,
            start_date: '2026-06-12',
            days: 2,
        });

        expect(result.booking_tier).toBe('GOLD');
        expect(result.booking_window_days).toBe(1);
        expect(result.booking_window_end.toISOString()).toBe('2026-06-12T01:00:00.000Z');
        expect(result.days[0].available_slots.map((slot) => slot.start_time.toISOString())).toEqual([
            '2026-06-12T00:00:00.000Z',
            '2026-06-12T00:30:00.000Z',
            '2026-06-12T01:00:00.000Z',
        ]);
        expect(result.days[1]).toMatchObject({
            date: '2026-06-13',
            has_available_slots: false,
            reason: 'BOOKING_WINDOW_EXCEEDED',
        });
    });

    it('rejects customer booking at a past start time using the same request clock', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-06-11T18:17:00+07:00'));
        Garage.findById.mockResolvedValue({
            ...garage,
            opening_time: '07:00',
            closing_time: '19:00',
        });
        ServicePackage.findById.mockResolvedValue({
            ...careStaffServicePackage,
            duration_minutes: 30,
            care_staff_duration_minutes: 30,
        });

        await expect(bookingService.createCustomerBooking(customerId, {
            garage_id: garageId,
            vehicle_id: vehicleId,
            service_package_id: servicePackageId,
            start_time: '2026-06-11T18:00:00+07:00',
        })).rejects.toMatchObject({
            statusCode: 400,
            errorCode: 'BOOKING_START_TIME_IN_PAST',
        });

        expect(Booking.create).not.toHaveBeenCalled();
    });

    it('rejects customer booking while customer is temporarily blocked', async () => {
        const blockError = Object.assign(new Error('Customer is temporarily blocked from creating bookings'), {
            statusCode: 403,
            errorCode: 'CUSTOMER_BOOKING_BLOCKED',
        });

        bookingViolationService.assertCustomerCanCreateBooking.mockRejectedValue(blockError);

        await expect(bookingService.createCustomerBooking(customerId, {
            garage_id: garageId,
            vehicle_id: vehicleId,
            service_package_id: servicePackageId,
            start_time: '2999-01-01T08:00:00+07:00',
        })).rejects.toMatchObject({
            statusCode: 403,
            errorCode: 'CUSTOMER_BOOKING_BLOCKED',
        });

        expect(Garage.findById).not.toHaveBeenCalled();
        expect(Booking.create).not.toHaveBeenCalled();
    });

    it('rejects customer booking beyond the same tier booking window', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-06-11T08:00:00+07:00'));
        Garage.findById.mockResolvedValue({
            ...garage,
            opening_time: '07:00',
            closing_time: '10:00',
        });
        ServicePackage.findById.mockResolvedValue({
            ...careStaffServicePackage,
            duration_minutes: 30,
            care_staff_duration_minutes: 30,
        });
        CustomerLoyalty.findOne.mockReturnValue({
            select: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue({
                    current_tier: 'GOLD',
                }),
            }),
        });
        TierRule.findOne.mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                tier_name: 'GOLD',
                booking_window_days: 1,
                max_upcoming_bookings: 1,
                priority_level: 1,
            }),
        });

        await expect(bookingService.createCustomerBooking(customerId, {
            garage_id: garageId,
            vehicle_id: vehicleId,
            service_package_id: servicePackageId,
            start_time: '2026-06-12T08:30:00+07:00',
        })).rejects.toMatchObject({
            statusCode: 400,
            errorCode: 'BOOKING_WINDOW_EXCEEDED',
        });

        expect(Booking.create).not.toHaveBeenCalled();
    });

    it('rounds a 15-minute wash bay reservation to the next garage slot', async () => {
        Garage.findById.mockResolvedValue({
            ...garage,
            opening_time: '11:00',
            closing_time: '12:00',
        });
        ServicePackage.findById.mockResolvedValue({
            ...washService,
            duration_minutes: 15,
            wash_bay_duration_minutes: 15,
        });
        Booking.aggregate.mockResolvedValue([]);

        const result = await bookingService.getAvailableSlots({
            garage_id: garageId,
            service_package_id: washServiceId,
            date: '2999-01-01',
        });

        expect(result.slots).toHaveLength(2);
        expect(result.slots[0].end_time.toISOString()).toBe('2999-01-01T04:15:00.000Z');
        expect(result.slots[0].wash_bay_work_end_time.toISOString()).toBe('2999-01-01T04:15:00.000Z');
        expect(result.slots[0].wash_bay_reserved_until.toISOString()).toBe('2999-01-01T04:30:00.000Z');
        expect(result.slots[0].booking_items[0].item_start_time.toISOString()).toBe('2999-01-01T04:00:00.000Z');
        expect(result.slots[0].booking_items[0].item_end_time.toISOString()).toBe('2999-01-01T04:15:00.000Z');
    });

    it('rounds a 105-minute care staff reservation to the next garage slot', async () => {
        Garage.findById.mockResolvedValue({
            ...garage,
            opening_time: '11:00',
            closing_time: '14:00',
        });
        ServicePackage.findById.mockResolvedValue({
            ...careStaffServicePackage,
            duration_minutes: 105,
            care_staff_duration_minutes: 105,
        });
        Booking.aggregate.mockResolvedValue([]);

        const result = await bookingService.getAvailableSlots({
            garage_id: garageId,
            service_package_id: servicePackageId,
            date: '2999-01-01',
        });

        expect(result.slots).toHaveLength(3);
        expect(result.slots[0].care_staff_work_end_time.toISOString()).toBe('2999-01-01T05:45:00.000Z');
        expect(result.slots[0].care_staff_reserved_until.toISOString()).toBe('2999-01-01T06:00:00.000Z');
    });

    it.each([
        [120, 17],
        [180, 15],
        [300, 11],
    ])('keeps %i-minute services inside garage closing time', async (durationMinutes, expectedSlotCount) => {
        Garage.findById.mockResolvedValue({
            ...garage,
            opening_time: '08:00',
            closing_time: '18:00',
        });
        ServicePackage.findById.mockResolvedValue({
            ...careStaffServicePackage,
            duration_minutes: durationMinutes,
            care_staff_duration_minutes: durationMinutes,
        });
        Booking.aggregate.mockResolvedValue([]);

        const result = await bookingService.getAvailableSlots({
            garage_id: garageId,
            service_package_id: servicePackageId,
            date: '2999-01-01',
        });

        expect(result.slots).toHaveLength(expectedSlotCount);
        expect(result.slots.at(-1).care_staff_reserved_until.toISOString()).toBe('2999-01-01T11:00:00.000Z');
    });

    it('requires one continuous resource window for a three-hour service', async () => {
        Garage.findById.mockResolvedValue({
            ...garage,
            opening_time: '07:00',
            closing_time: '13:00',
        });
        ServicePackage.findById.mockResolvedValue({
            ...careStaffServicePackage,
            duration_minutes: 180,
            care_staff_duration_minutes: 180,
        });
        StaffProfile.countDocuments.mockResolvedValue(1);
        Booking.aggregate.mockResolvedValue([
            {
                booking_id: '507f1f77bcf86cd799439092',
                start_time: new Date('2999-01-01T01:00:00.000Z'),
                reserved_until: new Date('2999-01-01T02:00:00.000Z'),
                required_count: 1,
            },
        ]);

        const result = await bookingService.getAvailableSlots({
            garage_id: garageId,
            service_package_id: servicePackageId,
            date: '2999-01-01',
        });

        expect(result.slots.map((slot) => slot.is_available)).toEqual([
            false,
            false,
            false,
            false,
            true,
            true,
            true,
        ]);
        expect(result.available_slots.map((slot) => slot.start_time.toISOString())).toEqual([
            '2999-01-01T02:00:00.000Z',
            '2999-01-01T02:30:00.000Z',
            '2999-01-01T03:00:00.000Z',
        ]);
    });

    it('rejects booking creation when start time is outside the garage slot grid', async () => {
        await expect(bookingService.createCustomerBooking(customerId, {
            garage_id: garageId,
            vehicle_id: vehicleId,
            service_package_id: servicePackageId,
            start_time: '2999-01-01T13:15:00+07:00',
        })).rejects.toMatchObject({
            statusCode: 400,
            errorCode: 'BOOKING_START_TIME_NOT_ALIGNED',
        });

        expect(Booking.create).not.toHaveBeenCalled();
    });

    it('keeps done booking items in reserved capacity overlap queries', async () => {
        Booking.aggregate.mockResolvedValue([]);

        await bookingService.getAvailableSlots({
            garage_id: garageId,
            service_package_id: servicePackageId,
            date: '2999-01-01',
        });

        const pipeline = Booking.aggregate.mock.calls[0][0];
        const serializedPipeline = JSON.stringify(pipeline);

        expect(serializedPipeline).toContain('"DONE"');
        expect(serializedPipeline).toContain('"COMPLETED"');
        expect(serializedPipeline).toContain('care_staff_reserved_until');
    });

    it('counts sequential wash bay items from one booking once at each point in time', async () => {
        const existingBookingId = '507f1f77bcf86cd799439070';

        Garage.findById.mockResolvedValue({
            ...garage,
            opening_time: '08:00',
            closing_time: '09:00',
        });
        ServicePackage.findById.mockResolvedValue({
            ...washService,
            duration_minutes: 60,
            wash_bay_duration_minutes: 60,
        });
        WashBay.countDocuments.mockResolvedValue(2);
        Booking.aggregate.mockResolvedValue([
            {
                booking_id: existingBookingId,
                start_time: new Date('2999-01-01T01:00:00.000Z'),
                reserved_until: new Date('2999-01-01T01:30:00.000Z'),
                required_count: 1,
            },
            {
                booking_id: existingBookingId,
                start_time: new Date('2999-01-01T01:30:00.000Z'),
                reserved_until: new Date('2999-01-01T02:00:00.000Z'),
                required_count: 1,
            },
        ]);

        const result = await bookingService.getAvailableSlots({
            garage_id: garageId,
            service_package_id: washServiceId,
            date: '2999-01-01',
        });

        expect(result.slots).toHaveLength(1);
        expect(result.slots[0].available_wash_bay_capacity).toBe(1);
        expect(result.slots[0].is_available).toBe(true);
    });

    it('uses peak wash bay concurrency instead of summing disjoint bookings', async () => {
        Garage.findById.mockResolvedValue({
            ...garage,
            opening_time: '08:00',
            closing_time: '09:00',
        });
        ServicePackage.findById.mockResolvedValue({
            ...washService,
            duration_minutes: 60,
            wash_bay_duration_minutes: 60,
        });
        WashBay.countDocuments.mockResolvedValue(2);
        Booking.aggregate.mockResolvedValue([
            {
                booking_id: '507f1f77bcf86cd799439071',
                start_time: new Date('2999-01-01T01:00:00.000Z'),
                reserved_until: new Date('2999-01-01T01:30:00.000Z'),
                required_count: 1,
            },
            {
                booking_id: '507f1f77bcf86cd799439072',
                start_time: new Date('2999-01-01T01:30:00.000Z'),
                reserved_until: new Date('2999-01-01T02:00:00.000Z'),
                required_count: 1,
            },
        ]);

        const result = await bookingService.getAvailableSlots({
            garage_id: garageId,
            service_package_id: washServiceId,
            date: '2999-01-01',
        });

        expect(result.slots[0].available_wash_bay_capacity).toBe(1);
        expect(result.slots[0].is_available).toBe(true);
    });

    it('uses the maximum care staff requirement within one sequential booking', async () => {
        const existingBookingId = '507f1f77bcf86cd799439073';

        Garage.findById.mockResolvedValue({
            ...garage,
            opening_time: '08:00',
            closing_time: '09:00',
        });
        ServicePackage.findById.mockResolvedValue({
            ...careStaffServicePackage,
            duration_minutes: 60,
            care_staff_duration_minutes: 60,
        });
        StaffProfile.countDocuments.mockResolvedValue(3);
        Booking.aggregate.mockResolvedValue([
            {
                booking_id: existingBookingId,
                start_time: new Date('2999-01-01T01:00:00.000Z'),
                reserved_until: new Date('2999-01-01T01:30:00.000Z'),
                required_count: 1,
            },
            {
                booking_id: existingBookingId,
                start_time: new Date('2999-01-01T01:30:00.000Z'),
                reserved_until: new Date('2999-01-01T02:00:00.000Z'),
                required_count: 2,
            },
        ]);

        const result = await bookingService.getAvailableSlots({
            garage_id: garageId,
            service_package_id: servicePackageId,
            date: '2999-01-01',
        });

        expect(result.slots).toHaveLength(1);
        expect(result.slots[0].available_care_staff_capacity).toBe(1);
        expect(result.slots[0].is_available).toBe(true);
    });

    it('rejects customer booking when care staff capacity is full', async () => {
        Booking.aggregate.mockResolvedValue([
            createCapacityReservation('507f1f77bcf86cd799439080'),
            createCapacityReservation('507f1f77bcf86cd799439081'),
        ]);

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

    it('creates an immediate walk-in at the current minute and checks it in', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2999-01-01T06:15:00.000Z'));
        const bookingId = '507f1f77bcf86cd799439061';
        Garage.findById.mockResolvedValue({
            ...garage,
            closing_time: '15:00',
        });
        Booking.aggregate.mockResolvedValue([]);
        Booking.create.mockImplementation(async (payload) => ({
            _id: bookingId,
            ...payload,
        }));
        Booking.findById.mockReturnValue(createPopulateQuery({
            _id: bookingId,
            garage_id: garageId,
            service_package_id: servicePackageId,
            vehicle_type: 'CAR',
            is_walk_in: true,
            status: 'CHECKED_IN',
            arrival_status: 'ON_TIME',
            start_time: new Date('2999-01-01T06:15:00.000Z'),
            end_time: new Date('2999-01-01T07:45:00.000Z'),
            booking_items: [],
            add_on_service_ids: [],
        }));

        const result = await bookingService.createWalkInBooking(
            { _id: '507f1f77bcf86cd799439062', role: 'ADMIN' },
            {
                garage_id: garageId,
                service_package_id: servicePackageId,
                serve_now: true,
                license_plate: '59A-123.45',
                vehicle_type: 'CAR',
            }
        );

        expect(Booking.create).toHaveBeenCalledWith(expect.objectContaining({
            is_walk_in: true,
            status: 'CHECKED_IN',
            arrival_status: 'ON_TIME',
            start_time: new Date('2999-01-01T06:15:00.000Z'),
            checked_in_at: new Date('2999-01-01T06:15:00.000Z'),
        }));
        expect(result).toMatchObject({
            id: bookingId,
            status: 'CHECKED_IN',
            start_time: new Date('2999-01-01T06:15:00.000Z'),
        });
    });

    it('returns suggested slots without creating an immediate walk-in when staff is full', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2999-01-01T06:15:00.000Z'));
        Garage.findById.mockResolvedValue({
            ...garage,
            closing_time: '18:00',
        });
        Booking.aggregate
            .mockResolvedValueOnce([
                createCapacityReservation('507f1f77bcf86cd799439080'),
                createCapacityReservation('507f1f77bcf86cd799439081'),
            ])
            .mockResolvedValueOnce([]);

        await expect(bookingService.createWalkInBooking(
            { _id: '507f1f77bcf86cd799439062', role: 'ADMIN' },
            {
                garage_id: garageId,
                service_package_id: servicePackageId,
                serve_now: true,
                suggestion_days: 1,
                license_plate: '59A-123.45',
                vehicle_type: 'CAR',
            }
        )).rejects.toMatchObject({
            statusCode: 409,
            errorCode: 'CARE_STAFF_CAPACITY_FULL',
            errors: expect.objectContaining({
                can_serve_now: false,
                unavailable_reasons: ['CARE_STAFF_CAPACITY_FULL'],
                suggested_slots: expect.arrayContaining([
                    expect.objectContaining({
                        start_time: new Date('2999-01-01T06:30:00.000Z'),
                    }),
                ]),
            }),
        });

        expect(Booking.create).not.toHaveBeenCalled();
    });

    it('creates customer booking with redeemed points and records redeem transaction', async () => {
        const bookingId = '507f1f77bcf86cd799439060';
        const session = {
            withTransaction: jest.fn(async (callback) => callback()),
            endSession: jest.fn().mockResolvedValue(undefined),
        };
        const startSessionSpy = jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);

        try {
            loyaltyService.calculateBookingRedeemDiscount.mockResolvedValue({
                loyalty: { id: 'loyalty-id' },
                redeem_rule: { id: 'redeem-rule-id' },
                used_points: 50,
                points_discount_amount: 50000,
            });
            Booking.create.mockImplementation(async (payload) => {
                const document = Array.isArray(payload) ? payload[0] : payload;

                return Array.isArray(payload)
                    ? [{ _id: bookingId, ...document }]
                    : { _id: bookingId, ...document };
            });
            Booking.findById.mockReturnValue(createPopulateQuery({
                _id: bookingId,
                customer_id: customerId,
                vehicle_id: vehicleId,
                garage_id: garageId,
                service_package_id: servicePackageId,
                vehicle_type: 'CAR',
                start_time: new Date('2999-01-01T06:00:00.000Z'),
                end_time: new Date('2999-01-01T07:30:00.000Z'),
                original_price: 250000,
                promotion_discount_amount: 0,
                points_discount_amount: 50000,
                discount_amount: 50000,
                final_price: 200000,
                used_points: 50,
                add_on_service_ids: [],
                booking_items: [],
            }));

            const result = await bookingService.createCustomerBooking(customerId, {
                garage_id: garageId,
                vehicle_id: vehicleId,
                service_package_id: servicePackageId,
                start_time: '2999-01-01T13:00:00+07:00',
                used_points: 50,
            });

            expect(startSessionSpy).toHaveBeenCalledTimes(1);
            expect(session.withTransaction).toHaveBeenCalledTimes(1);
            expect(session.endSession).toHaveBeenCalledTimes(1);
            expect(Booking.create).toHaveBeenCalledWith(
                [
                    expect.objectContaining({
                        customer_id: customerId,
                        vehicle_id: vehicleId,
                        used_points: 50,
                        points_discount_amount: 50000,
                        discount_amount: 50000,
                        final_price: 200000,
                    }),
                ],
                { session }
            );
            expect(loyaltyService.redeemPointsForBooking).toHaveBeenCalledWith(expect.objectContaining({
                booking: expect.objectContaining({ _id: bookingId }),
                customerId,
                usedPoints: 50,
                priceAfterPromotion: 250000,
                actorId: customerId,
                expectedPointsDiscountAmount: 50000,
                session,
            }));
            expect(result).toMatchObject({
                id: bookingId,
                used_points: 50,
                points_discount_amount: 50000,
                final_price: 200000,
            });
        } finally {
            startSessionSpy.mockRestore();
        }
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
        Booking.aggregate.mockResolvedValueOnce([
            createCapacityReservation('507f1f77bcf86cd799439080'),
        ]);

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

    it('reopens completed unpaid booking as admin', async () => {
        const bookingId = '507f1f77bcf86cd799439019';
        const washBayId = '507f1f77bcf86cd799439022';
        const completedAt = new Date('2999-01-01T07:30:00.000Z');
        const booking = {
            _id: bookingId,
            garage_id: garageId,
            status: 'COMPLETED',
            payment_status: 'UNPAID',
            reward_processed: false,
            paid_at: null,
            completed_at: completedAt,
            requires_wash_bay: true,
            wash_bay_id: washBayId,
            booking_items: [
                {
                    item_key: 'ITEM_1_507F1F77BCF86CD799439016',
                    requires_care_staff: true,
                    care_staff_type: 'VEHICLE_CARE_STAFF',
                    status: 'IN_PROGRESS',
                    assigned_care_staff: [
                        {
                            staff_profile_id: '507f1f77bcf86cd799439031',
                            user_id: '507f1f77bcf86cd799439032',
                            assigned_at: new Date('2999-01-01T06:00:00.000Z'),
                            released_at: completedAt,
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
        Booking.aggregate.mockResolvedValue([]);
        WashBay.findOneAndUpdate.mockResolvedValue({ _id: washBayId });

        await bookingService.reopenCompletedBooking(
            { _id: '507f1f77bcf86cd799439021', role: 'ADMIN' },
            bookingId,
            { note: 'Service was not actually completed' }
        );

        expect(WashBay.findOneAndUpdate).toHaveBeenCalledWith(
            {
                _id: washBayId,
                status: 'AVAILABLE',
                current_booking_id: null,
                is_active: true,
            },
            {
                status: 'OCCUPIED',
                current_booking_id: booking._id,
            },
            {
                new: true,
            }
        );
        expect(booking.status).toBe('IN_PROGRESS');
        expect(booking.completed_at).toBeNull();
        expect(booking.note).toBe('Service was not actually completed');
        expect(booking.booking_items[0].assigned_care_staff[0].released_at).toBeNull();
        expect(booking.markModified).toHaveBeenCalledWith('booking_items');
        expect(bookingServiceStepService.clearResourceReleasedForBookingItem).toHaveBeenCalledWith(
            booking._id,
            'ITEM_1_507F1F77BCF86CD799439016',
            completedAt
        );
    });

    it('rejects reopening completed booking unless it is unpaid and unrewarded', async () => {
        const adminUser = { _id: '507f1f77bcf86cd799439021', role: 'ADMIN' };
        const bookingId = '507f1f77bcf86cd799439019';
        const baseBooking = {
            _id: bookingId,
            garage_id: garageId,
            status: 'COMPLETED',
            payment_status: 'UNPAID',
            reward_processed: false,
            paid_at: null,
            completed_at: new Date('2999-01-01T07:30:00.000Z'),
        };

        const cases = [
            {
                booking: { ...baseBooking, payment_status: 'PENDING' },
                errorCode: 'BOOKING_REOPEN_PAYMENT_NOT_ALLOWED',
            },
            {
                booking: { ...baseBooking, reward_processed: true },
                errorCode: 'BOOKING_REOPEN_REWARD_PROCESSED',
            },
            {
                booking: { ...baseBooking, paid_at: new Date('2999-01-01T07:35:00.000Z') },
                errorCode: 'BOOKING_REOPEN_PAID_AT_EXISTS',
            },
        ];

        for (const testCase of cases) {
            Booking.findById.mockResolvedValueOnce(testCase.booking);

            await expect(
                bookingService.reopenCompletedBooking(adminUser, bookingId, {})
            ).rejects.toMatchObject({
                statusCode: 409,
                errorCode: testCase.errorCode,
            });
        }
    });

    it('rejects reopening completed booking by staff', async () => {
        await expect(
            bookingService.reopenCompletedBooking(
                { _id: '507f1f77bcf86cd799439021', role: 'STAFF' },
                '507f1f77bcf86cd799439019',
                {}
            )
        ).rejects.toMatchObject({
            statusCode: 403,
            errorCode: 'BOOKING_REOPEN_ADMIN_ONLY',
        });
    });
});
