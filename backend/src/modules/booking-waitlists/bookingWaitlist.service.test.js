jest.mock('./bookingWaitlist.model', () => ({
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn(),
}));

jest.mock('../vehicles/vehicle.model', () => ({
    findOne: jest.fn(),
}));

jest.mock('../garages/garage.model', () => ({
    findById: jest.fn(),
}));

jest.mock('../service-packages/servicePackage.model', () => ({
    findById: jest.fn(),
    find: jest.fn(),
}));

jest.mock('../staff-profiles/staffProfile.model', () => ({
    findOne: jest.fn(),
}));

jest.mock('../notifications/notification.service', () => ({
    createInAppNotification: jest.fn(),
}));

jest.mock('../bookings/booking.service', () => ({
    getAvailableSlots: jest.fn(),
    createCustomerBooking: jest.fn(),
}));

const BookingWaitlist = require('./bookingWaitlist.model');
const Vehicle = require('../vehicles/vehicle.model');
const Garage = require('../garages/garage.model');
const ServicePackage = require('../service-packages/servicePackage.model');
const notificationService = require('../notifications/notification.service');
const bookingService = require('../bookings/booking.service');
const bookingWaitlistService = require('./bookingWaitlist.service');
const { WAITLIST_STATUS } = require('../../shared/constants/waitlist.constant');
const { NOTIFICATION_TYPES } = require('../../shared/constants/notification.constant');

const createQuery = (result) => ({
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    then(resolve, reject) {
        return Promise.resolve(result).then(resolve, reject);
    },
});

describe('booking waitlist service', () => {
    const customerId = '507f1f77bcf86cd799439011';
    const otherCustomerId = '507f1f77bcf86cd799439012';
    const vehicleId = '507f1f77bcf86cd799439013';
    const garageId = '507f1f77bcf86cd799439014';
    const servicePackageId = '507f1f77bcf86cd799439015';
    const addOnServiceId = '507f1f77bcf86cd799439016';
    const waitlistId = '507f1f77bcf86cd799439017';
    const bookingId = '507f1f77bcf86cd799439018';
    const adminId = '507f1f77bcf86cd799439019';
    const desiredStartTime = new Date('2099-06-10T09:00:00+07:00');
    const adminUser = {
        _id: adminId,
        role: 'ADMIN',
    };

    const baseVehicle = {
        _id: vehicleId,
        customer_id: customerId,
        vehicle_type: 'CAR',
        is_active: true,
    };

    const baseGarage = {
        _id: garageId,
        is_active: true,
    };

    const baseServicePackage = {
        _id: servicePackageId,
        vehicle_type: 'CAR',
        service_type: 'WASH',
        is_active: true,
    };

    const makeWaitlist = (overrides = {}) => ({
        _id: waitlistId,
        customer_id: customerId,
        vehicle_id: vehicleId,
        garage_id: garageId,
        service_package_id: servicePackageId,
        add_on_service_ids: [],
        vehicle_type: 'CAR',
        desired_start_time: desiredStartTime,
        status: WAITLIST_STATUS.WAITING,
        offered_at: null,
        offer_expires_at: null,
        accepted_at: null,
        canceled_at: null,
        canceled_by_id: null,
        cancel_reason: null,
        expired_at: null,
        created_booking_id: null,
        source_booking_id: null,
        note: null,
        created_at: new Date('2099-06-09T08:00:00+07:00'),
        updated_at: new Date('2099-06-09T08:00:00+07:00'),
        save: jest.fn().mockResolvedValue(true),
        ...overrides,
    });

    const setupBaseCreateDependencies = ({ slotAvailable = false } = {}) => {
        Vehicle.findOne.mockResolvedValue(baseVehicle);
        Garage.findById.mockResolvedValue(baseGarage);
        ServicePackage.findById.mockResolvedValue(baseServicePackage);
        ServicePackage.find.mockResolvedValue([]);
        bookingService.getAvailableSlots.mockResolvedValue({
            slots: [
                {
                    start_time: desiredStartTime,
                    is_available: slotAvailable,
                },
            ],
        });
    };

    const setupOfferSlotAvailability = ({ slotAvailable = true, startTime = desiredStartTime } = {}) => {
        bookingService.getAvailableSlots.mockResolvedValue({
            slots: [
                {
                    start_time: startTime,
                    is_available: slotAvailable,
                },
            ],
        });
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('creates a waiting entry for an unavailable slot', async () => {
        const waitlist = makeWaitlist();

        setupBaseCreateDependencies();
        BookingWaitlist.find.mockResolvedValue([]);
        BookingWaitlist.create.mockResolvedValue(waitlist);
        BookingWaitlist.findById.mockReturnValue(createQuery(waitlist));

        const result = await bookingWaitlistService.createMyWaitlist(customerId, {
            garage_id: garageId,
            vehicle_id: vehicleId,
            service_package_id: servicePackageId,
            add_on_service_ids: [],
            desired_start_time: '2099-06-10T09:00:00+07:00',
            note: 'Need this slot',
        });

        expect(BookingWaitlist.create).toHaveBeenCalledWith(expect.objectContaining({
            customer_id: customerId,
            vehicle_id: vehicleId,
            garage_id: garageId,
            service_package_id: servicePackageId,
            status: WAITLIST_STATUS.WAITING,
        }));
        expect(notificationService.createInAppNotification).toHaveBeenCalledWith(expect.objectContaining({
            userId: customerId,
            type: NOTIFICATION_TYPES.WAITLIST_JOINED,
        }));
        expect(result).toMatchObject({
            id: waitlistId,
            status: WAITLIST_STATUS.WAITING,
        });
    });

    it('rejects joining waitlist when the slot is still available', async () => {
        setupBaseCreateDependencies({ slotAvailable: true });

        await expect(bookingWaitlistService.createMyWaitlist(customerId, {
            garage_id: garageId,
            vehicle_id: vehicleId,
            service_package_id: servicePackageId,
            add_on_service_ids: [],
            desired_start_time: '2099-06-10T09:00:00+07:00',
        })).rejects.toMatchObject({
            errorCode: 'WAITLIST_SLOT_STILL_AVAILABLE',
        });

        expect(BookingWaitlist.create).not.toHaveBeenCalled();
    });

    it('offers the oldest matching waitlist when a booking releases the slot', async () => {
        const waitlist = makeWaitlist({
            customer_id: otherCustomerId,
            add_on_service_ids: [addOnServiceId],
        });

        BookingWaitlist.find.mockReturnValue(createQuery([waitlist]));
        BookingWaitlist.findById.mockReturnValue(createQuery(waitlist));
        setupOfferSlotAvailability();

        const result = await bookingWaitlistService.offerNextForReleasedBooking({
            id: bookingId,
            customer_id: customerId,
            garage_id: garageId,
            service_package_id: servicePackageId,
            add_on_service_ids: [addOnServiceId],
            vehicle_type: 'CAR',
            start_time: desiredStartTime,
        });

        expect(bookingService.getAvailableSlots).toHaveBeenCalledWith(expect.objectContaining({
            customer_id: otherCustomerId,
            garage_id: garageId,
            service_package_id: servicePackageId,
            add_on_service_ids: [addOnServiceId],
            date: '2099-06-10',
        }));
        expect(waitlist.status).toBe(WAITLIST_STATUS.OFFERED);
        expect(waitlist.offered_at).toBeInstanceOf(Date);
        expect(waitlist.offer_expires_at).toBeInstanceOf(Date);
        expect(waitlist.source_booking_id).toBe(bookingId);
        expect(waitlist.save).toHaveBeenCalledTimes(1);
        expect(notificationService.createInAppNotification).toHaveBeenCalledWith(expect.objectContaining({
            userId: otherCustomerId,
            type: NOTIFICATION_TYPES.WAITLIST_OFFERED,
        }));
        expect(result).toMatchObject({
            id: waitlistId,
            status: WAITLIST_STATUS.OFFERED,
        });
    });

    it('can offer a waitlist when a walk-in booking releases the slot', async () => {
        const waitlist = makeWaitlist({
            customer_id: otherCustomerId,
        });

        BookingWaitlist.find.mockReturnValue(createQuery([waitlist]));
        BookingWaitlist.findById.mockReturnValue(createQuery(waitlist));
        setupOfferSlotAvailability();

        const result = await bookingWaitlistService.offerNextForReleasedBooking({
            id: bookingId,
            customer_id: null,
            garage_id: garageId,
            service_package_id: servicePackageId,
            add_on_service_ids: [],
            vehicle_type: 'CAR',
            start_time: desiredStartTime,
        });

        expect(waitlist.status).toBe(WAITLIST_STATUS.OFFERED);
        expect(waitlist.source_booking_id).toBe(bookingId);
        expect(result).toMatchObject({
            id: waitlistId,
            status: WAITLIST_STATUS.OFFERED,
        });
    });

    it('does not auto-offer when the released slot is inside the waitlist cutoff', async () => {
        const nearStartTime = new Date(Date.now() + 11 * 60 * 60 * 1000);

        const result = await bookingWaitlistService.offerNextForReleasedBooking({
            id: bookingId,
            customer_id: customerId,
            garage_id: garageId,
            service_package_id: servicePackageId,
            add_on_service_ids: [],
            vehicle_type: 'CAR',
            start_time: nearStartTime,
        });

        expect(result).toBeNull();
        expect(BookingWaitlist.find).not.toHaveBeenCalled();
        expect(notificationService.createInAppNotification).not.toHaveBeenCalled();
    });

    it('rejects auto-offer when the released slot is no longer available', async () => {
        const waitlist = makeWaitlist({
            customer_id: otherCustomerId,
        });

        BookingWaitlist.find.mockReturnValue(createQuery([waitlist]));
        setupOfferSlotAvailability({ slotAvailable: false });

        await expect(bookingWaitlistService.offerNextForReleasedBooking({
            id: bookingId,
            customer_id: customerId,
            garage_id: garageId,
            service_package_id: servicePackageId,
            add_on_service_ids: [],
            vehicle_type: 'CAR',
            start_time: desiredStartTime,
        })).rejects.toMatchObject({
            errorCode: 'WAITLIST_SLOT_NOT_AVAILABLE_FOR_OFFER',
        });

        expect(waitlist.save).not.toHaveBeenCalled();
        expect(notificationService.createInAppNotification).not.toHaveBeenCalled();
    });

    it('allows admin to manually offer a waiting waitlist when the slot is available', async () => {
        const waitlist = makeWaitlist();

        BookingWaitlist.findById
            .mockReturnValueOnce(waitlist)
            .mockReturnValueOnce(createQuery(waitlist));
        bookingService.getAvailableSlots.mockResolvedValue({
            slots: [
                {
                    start_time: desiredStartTime,
                    is_available: true,
                },
            ],
        });

        const result = await bookingWaitlistService.offerWaitlist(adminUser, waitlistId, {
            offer_expires_in_minutes: 30,
        });

        expect(bookingService.getAvailableSlots).toHaveBeenCalledWith(expect.objectContaining({
            garage_id: garageId,
            service_package_id: servicePackageId,
            add_on_service_ids: [],
            date: '2099-06-10',
        }));
        expect(waitlist.status).toBe(WAITLIST_STATUS.OFFERED);
        expect(waitlist.offered_at).toBeInstanceOf(Date);
        expect(waitlist.offer_expires_at).toBeInstanceOf(Date);
        expect(waitlist.source_booking_id).toBeNull();
        expect(waitlist.save).toHaveBeenCalledTimes(1);
        expect(notificationService.createInAppNotification).toHaveBeenCalledWith(expect.objectContaining({
            userId: customerId,
            type: NOTIFICATION_TYPES.WAITLIST_OFFERED,
            metadata: expect.objectContaining({
                offered_by_id: adminId,
                offer_expires_at: waitlist.offer_expires_at,
            }),
        }));
        expect(result).toMatchObject({
            id: waitlistId,
            status: WAITLIST_STATUS.OFFERED,
        });
    });

    it('rejects manual waitlist offer when the slot is not available', async () => {
        const waitlist = makeWaitlist();

        BookingWaitlist.findById.mockReturnValue(waitlist);
        bookingService.getAvailableSlots.mockResolvedValue({
            slots: [
                {
                    start_time: desiredStartTime,
                    is_available: false,
                },
            ],
        });

        await expect(bookingWaitlistService.offerWaitlist(adminUser, waitlistId))
            .rejects
            .toMatchObject({
                errorCode: 'WAITLIST_SLOT_NOT_AVAILABLE_FOR_OFFER',
            });

        expect(waitlist.save).not.toHaveBeenCalled();
        expect(notificationService.createInAppNotification).not.toHaveBeenCalled();
    });

    it('allows admin to expire an offered waitlist', async () => {
        const waitlist = makeWaitlist({
            status: WAITLIST_STATUS.OFFERED,
            offered_at: new Date('2099-06-09T08:00:00+07:00'),
            offer_expires_at: new Date('2099-06-09T08:15:00+07:00'),
        });

        BookingWaitlist.findById
            .mockReturnValueOnce(waitlist)
            .mockReturnValueOnce(createQuery(waitlist));

        const result = await bookingWaitlistService.expireWaitlistOffer(adminUser, waitlistId);

        expect(waitlist.status).toBe(WAITLIST_STATUS.EXPIRED);
        expect(waitlist.expired_at).toBeInstanceOf(Date);
        expect(waitlist.save).toHaveBeenCalledTimes(1);
        expect(notificationService.createInAppNotification).toHaveBeenCalledWith(expect.objectContaining({
            userId: customerId,
            type: NOTIFICATION_TYPES.WAITLIST_OFFER_EXPIRED,
            metadata: expect.objectContaining({
                expired_by_id: adminId,
            }),
        }));
        expect(result).toMatchObject({
            id: waitlistId,
            status: WAITLIST_STATUS.EXPIRED,
        });
    });

    it('expires overdue waitlist offers in batches', async () => {
        const waitlist = makeWaitlist({
            status: WAITLIST_STATUS.OFFERED,
            offered_at: new Date('2026-01-01T08:00:00+07:00'),
            offer_expires_at: new Date('2026-01-01T08:15:00+07:00'),
        });

        BookingWaitlist.find.mockReturnValue(createQuery([waitlist]));

        const result = await bookingWaitlistService.expireExpiredOffers({ limit: 10 });

        expect(BookingWaitlist.find).toHaveBeenCalledWith({
            $or: expect.arrayContaining([
                expect.objectContaining({
                    status: WAITLIST_STATUS.OFFERED,
                    offer_expires_at: { $lte: expect.any(Date) },
                }),
                expect.objectContaining({
                    status: { $in: [WAITLIST_STATUS.WAITING, WAITLIST_STATUS.OFFERED] },
                    desired_start_time: { $lte: expect.any(Date) },
                }),
            ]),
        });
        expect(waitlist.status).toBe(WAITLIST_STATUS.EXPIRED);
        expect(waitlist.expired_at).toBeInstanceOf(Date);
        expect(waitlist.save).toHaveBeenCalledTimes(1);
        expect(notificationService.createInAppNotification).toHaveBeenCalledWith(expect.objectContaining({
            userId: customerId,
            type: NOTIFICATION_TYPES.WAITLIST_OFFER_EXPIRED,
        }));
        expect(result).toMatchObject({
            attempted: 1,
            expired: 1,
            data: [
                {
                    id: waitlistId,
                    status: WAITLIST_STATUS.EXPIRED,
                },
            ],
        });
    });

    it('expires waiting waitlists when the cutoff is reached', async () => {
        const waitlist = makeWaitlist({
            status: WAITLIST_STATUS.WAITING,
            desired_start_time: new Date(Date.now() + 11 * 60 * 60 * 1000),
        });

        BookingWaitlist.find.mockReturnValue(createQuery([waitlist]));

        const result = await bookingWaitlistService.expireExpiredOffers({ limit: 10 });

        expect(waitlist.status).toBe(WAITLIST_STATUS.EXPIRED);
        expect(waitlist.expired_at).toBeInstanceOf(Date);
        expect(waitlist.save).toHaveBeenCalledTimes(1);
        expect(notificationService.createInAppNotification).toHaveBeenCalledWith(expect.objectContaining({
            userId: customerId,
            type: NOTIFICATION_TYPES.WAITLIST_EXPIRED,
            metadata: expect.objectContaining({
                cutoff_hours: 12,
            }),
        }));
        expect(result).toMatchObject({
            attempted: 1,
            expired: 1,
            data: [
                {
                    id: waitlistId,
                    status: WAITLIST_STATUS.EXPIRED,
                },
            ],
        });
    });

    it('accepts an offered waitlist and creates a booking', async () => {
        const waitlist = makeWaitlist({
            status: WAITLIST_STATUS.OFFERED,
            offered_at: new Date('2099-06-09T08:00:00+07:00'),
            offer_expires_at: new Date('2099-06-09T08:15:00+07:00'),
            add_on_service_ids: [addOnServiceId],
        });
        const booking = {
            id: bookingId,
            status: 'PENDING',
        };

        BookingWaitlist.findOne.mockResolvedValue(waitlist);
        BookingWaitlist.findById.mockReturnValue(createQuery(waitlist));
        bookingService.createCustomerBooking.mockResolvedValue(booking);

        const result = await bookingWaitlistService.acceptMyWaitlist(customerId, waitlistId);

        expect(bookingService.createCustomerBooking).toHaveBeenCalledWith(customerId, {
            garage_id: garageId,
            vehicle_id: vehicleId,
            service_package_id: servicePackageId,
            add_on_service_ids: [addOnServiceId],
            start_time: desiredStartTime.toISOString(),
        });
        expect(waitlist.status).toBe(WAITLIST_STATUS.ACCEPTED);
        expect(waitlist.created_booking_id).toBe(bookingId);
        expect(waitlist.save).toHaveBeenCalledTimes(1);
        expect(notificationService.createInAppNotification).toHaveBeenCalledWith(expect.objectContaining({
            userId: customerId,
            type: NOTIFICATION_TYPES.WAITLIST_OFFER_ACCEPTED,
        }));
        expect(result.booking).toBe(booking);
        expect(result.waitlist).toMatchObject({
            id: waitlistId,
            status: WAITLIST_STATUS.ACCEPTED,
            created_booking_id: bookingId,
        });
    });

    it('cancels an active waitlist entry', async () => {
        const waitlist = makeWaitlist();

        BookingWaitlist.findOne.mockResolvedValue(waitlist);
        BookingWaitlist.findById.mockReturnValue(createQuery(waitlist));

        const result = await bookingWaitlistService.cancelMyWaitlist(customerId, waitlistId, {
            reason: 'Changed schedule',
        });

        expect(waitlist.status).toBe(WAITLIST_STATUS.CANCELED);
        expect(waitlist.canceled_by_id).toBe(customerId);
        expect(waitlist.cancel_reason).toBe('Changed schedule');
        expect(waitlist.save).toHaveBeenCalledTimes(1);
        expect(notificationService.createInAppNotification).toHaveBeenCalledWith(expect.objectContaining({
            userId: customerId,
            type: NOTIFICATION_TYPES.WAITLIST_CANCELED,
        }));
        expect(result).toMatchObject({
            id: waitlistId,
            status: WAITLIST_STATUS.CANCELED,
            cancel_reason: 'Changed schedule',
        });
    });
});
