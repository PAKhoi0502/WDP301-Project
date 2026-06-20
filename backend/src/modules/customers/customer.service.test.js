jest.mock('../bookings/booking.model', () => ({
    aggregate: jest.fn(),
}));

jest.mock('../staff-profiles/staffProfile.model', () => ({
    findOne: jest.fn(),
}));

const mongoose = require('mongoose');

const Booking = require('../bookings/booking.model');
const StaffProfile = require('../staff-profiles/staffProfile.model');
const customerService = require('./customer.service');
const { USER_ROLES } = require('../../shared/constants/roles.constant');

describe('customer service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        Booking.aggregate.mockReset();
        StaffProfile.findOne.mockReset();
    });

    it('requires garage_id for admin customer search', async () => {
        await expect(customerService.searchAdminCustomers({
            _id: new mongoose.Types.ObjectId(),
            role: USER_ROLES.ADMIN,
        })).rejects.toMatchObject({
            statusCode: 400,
            errorCode: 'GARAGE_ID_REQUIRED',
        });

        expect(Booking.aggregate).not.toHaveBeenCalled();
    });

    it('rejects staff customer search outside assigned garage', async () => {
        const assignedGarageId = new mongoose.Types.ObjectId();
        const requestedGarageId = new mongoose.Types.ObjectId();

        StaffProfile.findOne.mockResolvedValue({
            garage_id: assignedGarageId,
        });

        await expect(customerService.searchAdminCustomers(
            {
                _id: new mongoose.Types.ObjectId(),
                role: USER_ROLES.STAFF,
            },
            {
                garage_id: requestedGarageId.toString(),
            }
        )).rejects.toMatchObject({
            statusCode: 403,
            errorCode: 'STAFF_GARAGE_ACCESS_DENIED',
        });

        expect(Booking.aggregate).not.toHaveBeenCalled();
    });

    it('searches registered customers at the staff garage', async () => {
        const staffId = new mongoose.Types.ObjectId();
        const garageId = new mongoose.Types.ObjectId();
        const customerId = new mongoose.Types.ObjectId();
        const vehicleId = new mongoose.Types.ObjectId();
        const lastBookingAt = new Date('2026-06-20T03:00:00.000Z');

        StaffProfile.findOne.mockResolvedValue({
            garage_id: garageId,
        });
        Booking.aggregate
            .mockResolvedValueOnce([
                {
                    customer_id: customerId,
                    customer: {
                        full_name: 'Nguyen Van A',
                        phone: '+84901234567',
                        email: 'a@example.com',
                    },
                    vehicles: [
                        {
                            _id: vehicleId,
                            raw_license_plate: '59A-123.45',
                            normalized_license_plate: '59A12345',
                            vehicle_type: 'CAR',
                        },
                    ],
                    last_booking_at: lastBookingAt,
                    total_bookings_at_garage: 3,
                },
            ])
            .mockResolvedValueOnce([{ total: 1 }]);

        const result = await customerService.searchAdminCustomers(
            {
                _id: staffId,
                role: USER_ROLES.STAFF,
            },
            {
                garage_id: garageId.toString(),
                search: '0901234567',
                page: 1,
                limit: 10,
            }
        );

        const firstPipeline = Booking.aggregate.mock.calls[0][0];

        expect(StaffProfile.findOne).toHaveBeenCalledWith({
            user_id: staffId,
            is_active: true,
        });
        expect(firstPipeline[0].$match.garage_id.toString()).toBe(garageId.toString());
        expect(firstPipeline[0].$match).toMatchObject({
            customer_id: { $ne: null },
            is_walk_in: false,
        });
        expect(result).toEqual({
            data: [
                {
                    customer_id: customerId.toString(),
                    full_name: 'Nguyen Van A',
                    phone: '+84901234567',
                    email: 'a@example.com',
                    vehicles: [
                        {
                            id: vehicleId.toString(),
                            license_plate: '59A-123.45',
                            vehicle_type: 'CAR',
                        },
                    ],
                    last_booking_at: lastBookingAt,
                    total_bookings_at_garage: 3,
                },
            ],
            meta: {
                page: 1,
                limit: 10,
                total: 1,
                total_pages: 1,
            },
        });
    });
});
