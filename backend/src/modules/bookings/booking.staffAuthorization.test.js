jest.mock('./booking.model', () => ({
    find: jest.fn(),
    findById: jest.fn(),
    countDocuments: jest.fn(),
}));

jest.mock('../staff-profiles/staffProfile.model', () => ({
    findOne: jest.fn(),
}));

jest.mock('../booking-handovers/bookingHandover.model', () => ({
    find: jest.fn(),
}));

const Booking = require('./booking.model');
const StaffProfile = require('../staff-profiles/staffProfile.model');
const BookingHandover = require('../booking-handovers/bookingHandover.model');
const bookingService = require('./booking.service');
const { USER_ROLES } = require('../../shared/constants/roles.constant');
const { STAFF_TYPES } = require('../../shared/constants/staff.constant');

describe('booking staff authorization filters', () => {
    const userId = '507f1f77bcf86cd799439011';
    const staffProfileId = '507f1f77bcf86cd799439012';
    const garageId = '507f1f77bcf86cd799439013';
    let query;

    const createProfile = (staffType) => ({
        _id: staffProfileId,
        user_id: userId,
        staff_type: staffType,
        garage_id: garageId,
        is_active: true,
    });

    const createQuery = () => {
        const bookingQuery = {
            populate: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue([]),
        };

        return bookingQuery;
    };

    const createHandoverQuery = (handovers) => ({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(handovers),
    });

    const createPopulatedBookingQuery = (booking) => {
        const populatedQuery = {
            populate: jest.fn().mockReturnThis(),
        };
        populatedQuery.then = (resolve, reject) => (
            Promise.resolve(booking).then(resolve, reject)
        );

        return populatedQuery;
    };

    const getExpectedAssignmentFilter = () => ({
        $or: [
            { assigned_inspection_staff_id: userId },
            {
                booking_items: {
                    $elemMatch: {
                        'assigned_care_staff.staff_profile_id': staffProfileId,
                        'assigned_care_staff.released_at': null,
                    },
                },
            },
            {
                booking_items: {
                    $elemMatch: {
                        'assigned_execution_staff.staff_profile_id': staffProfileId,
                        'assigned_execution_staff.released_at': null,
                    },
                },
            },
        ],
    });

    beforeEach(() => {
        jest.clearAllMocks();
        query = createQuery();
        Booking.find.mockReturnValue(query);
        Booking.countDocuments.mockResolvedValue(0);
    });

    it('allows customer-service staff to list every booking in their garage', async () => {
        StaffProfile.findOne.mockResolvedValue(
            createProfile(STAFF_TYPES.CUSTOMER_SERVICE_STAFF)
        );

        await bookingService.getAllBookings({
            _id: userId,
            role: USER_ROLES.STAFF,
        });

        expect(Booking.find).toHaveBeenCalledWith({ garage_id: garageId });
        expect(Booking.countDocuments).toHaveBeenCalledWith({ garage_id: garageId });
    });

    it.each([
        STAFF_TYPES.VEHICLE_INSPECTION_STAFF,
        STAFF_TYPES.WASH_OPERATOR,
        STAFF_TYPES.VEHICLE_CARE_STAFF,
    ])('limits %s to bookings assigned to that staff member', async (staffType) => {
        StaffProfile.findOne.mockResolvedValue(createProfile(staffType));

        await bookingService.getAllBookings({
            _id: userId,
            role: USER_ROLES.STAFF,
        });

        const expectedFilter = {
            garage_id: garageId,
            $and: [getExpectedAssignmentFilter()],
        };

        expect(Booking.find).toHaveBeenCalledWith(expectedFilter);
        expect(Booking.countDocuments).toHaveBeenCalledWith(expectedFilter);
    });

    it('rejects a staff request for a different garage', async () => {
        StaffProfile.findOne.mockResolvedValue(
            createProfile(STAFF_TYPES.CUSTOMER_SERVICE_STAFF)
        );

        await expect(bookingService.getAllBookings({
            _id: userId,
            role: USER_ROLES.STAFF,
        }, {
            garage_id: '507f1f77bcf86cd799439099',
        })).rejects.toMatchObject({
            statusCode: 403,
            errorCode: 'STAFF_GARAGE_ACCESS_DENIED',
        });

        expect(Booking.find).not.toHaveBeenCalled();
    });

    it('does not apply staff assignment filters to admins', async () => {
        const requestedGarageId = '507f1f77bcf86cd799439099';

        await bookingService.getAllBookings({
            _id: userId,
            role: USER_ROLES.ADMIN,
        }, {
            garage_id: requestedGarageId,
        });

        expect(Booking.find).toHaveBeenCalledWith({ garage_id: requestedGarageId });
        expect(StaffProfile.findOne).not.toHaveBeenCalled();
    });

    it('applies payment status and pagination to admin booking lists', async () => {
        Booking.countDocuments.mockResolvedValue(45);

        const result = await bookingService.getAllBookings({
            _id: userId,
            role: USER_ROLES.ADMIN,
        }, {
            payment_status: 'PAID',
            page: 2,
            limit: 20,
        });

        expect(Booking.find).toHaveBeenCalledWith({ payment_status: 'PAID' });
        expect(Booking.countDocuments).toHaveBeenCalledWith({ payment_status: 'PAID' });
        expect(query.skip).toHaveBeenCalledWith(20);
        expect(query.limit).toHaveBeenCalledWith(20);
        expect(result.meta).toEqual({
            page: 2,
            limit: 20,
            total: 45,
            total_pages: 3,
        });
    });

    it('sorts dashboard bookings by the nearest appointment when requested', async () => {
        await bookingService.getAllBookings({
            _id: userId,
            role: USER_ROLES.ADMIN,
        }, {
            sort_by: 'START_TIME_ASC',
            limit: 5,
        });

        expect(query.sort).toHaveBeenCalledWith({
            start_time: 1,
            _id: 1,
        });
        expect(query.limit).toHaveBeenCalledWith(5);
    });

    it('includes the exact handover release signal in admin booking lists', async () => {
        const bookingId = '507f1f77bcf86cd799439014';
        const releasedAt = new Date('2026-07-25T00:00:00.000Z');
        const booking = {
            _id: bookingId,
            garage_id: garageId,
            status: 'COMPLETED',
            payment_status: 'PAID',
        };
        const handoverQuery = createHandoverQuery([{
            booking_id: bookingId,
            state: 'RELEASED',
            released_at: releasedAt,
        }]);
        query.limit.mockResolvedValue([booking]);
        BookingHandover.find.mockReturnValue(handoverQuery);

        const result = await bookingService.getAllBookings({
            _id: userId,
            role: USER_ROLES.ADMIN,
        });

        expect(BookingHandover.find).toHaveBeenCalledWith({
            booking_id: { $in: [bookingId] },
        });
        expect(handoverQuery.select).toHaveBeenCalledWith('booking_id state released_at');
        expect(result.data[0]).toMatchObject({
            handover_state: 'RELEASED',
            handover_released_at: releasedAt,
        });
    });

    it('returns nullable handover signals when no handover exists', async () => {
        const bookingId = '507f1f77bcf86cd799439014';
        query.limit.mockResolvedValue([{
            _id: bookingId,
            garage_id: garageId,
            status: 'COMPLETED',
            payment_status: 'PAID',
        }]);
        BookingHandover.find.mockReturnValue(createHandoverQuery([]));

        const result = await bookingService.getAllBookings({
            _id: userId,
            role: USER_ROLES.ADMIN,
        });

        expect(result.data[0]).toMatchObject({
            handover_state: null,
            handover_released_at: null,
        });
    });

    it('includes the same handover release signal in admin booking detail', async () => {
        const bookingId = '507f1f77bcf86cd799439014';
        const releasedAt = new Date('2026-07-25T00:00:00.000Z');
        const booking = {
            _id: bookingId,
            garage_id: garageId,
            status: 'COMPLETED',
            payment_status: 'PAID',
        };
        Booking.findById
            .mockReturnValueOnce(Promise.resolve(booking))
            .mockReturnValueOnce(createPopulatedBookingQuery(booking));
        BookingHandover.find.mockReturnValue(createHandoverQuery([{
            booking_id: bookingId,
            state: 'RELEASED',
            released_at: releasedAt,
        }]));

        const result = await bookingService.getBookingById({
            _id: userId,
            role: USER_ROLES.ADMIN,
        }, bookingId);

        expect(result).toMatchObject({
            handover_state: 'RELEASED',
            handover_released_at: releasedAt,
        });
    });
});
