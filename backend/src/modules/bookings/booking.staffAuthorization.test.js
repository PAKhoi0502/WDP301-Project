jest.mock('./booking.model', () => ({
    find: jest.fn(),
    countDocuments: jest.fn(),
}));

jest.mock('../staff-profiles/staffProfile.model', () => ({
    findOne: jest.fn(),
}));

const Booking = require('./booking.model');
const StaffProfile = require('../staff-profiles/staffProfile.model');
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
});
