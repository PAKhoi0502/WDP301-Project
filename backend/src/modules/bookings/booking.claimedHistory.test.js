jest.mock('./booking.model', () => ({
    find: jest.fn(),
    findById: jest.fn(),
    countDocuments: jest.fn(),
}));

jest.mock('../users/user.model', () => ({
    findById: jest.fn(),
}));

const mongoose = require('mongoose');
const Booking = require('./booking.model');
const User = require('../users/user.model');
const bookingService = require('./booking.service');

const createBookingQuery = (result) => {
    const query = {
        populate: jest.fn(() => query),
        sort: jest.fn(() => query),
        skip: jest.fn(() => query),
        limit: jest.fn().mockResolvedValue(result),
    };

    return query;
};

const createBookingByIdQuery = (result) => {
    const query = {
        populate: jest.fn(() => query),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };

    return query;
};

describe('claimed walk-in booking history', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('includes registered and claimed walk-in bookings in customer history', async () => {
        const customerId = new mongoose.Types.ObjectId();

        User.findById.mockResolvedValue({
            _id: customerId,
            is_active: true,
        });
        Booking.find.mockReturnValue(createBookingQuery([]));
        Booking.countDocuments.mockResolvedValue(0);

        await bookingService.getMyBookings(customerId, {
            page: 1,
            limit: 20,
        });

        expect(Booking.find).toHaveBeenCalledWith({
            $or: [
                {
                    customer_id: customerId,
                    is_walk_in: false,
                },
                {
                    claimed_customer_id: customerId,
                    is_walk_in: true,
                },
            ],
        });
        expect(Booking.countDocuments).toHaveBeenCalledWith({
            $or: [
                {
                    customer_id: customerId,
                    is_walk_in: false,
                },
                {
                    claimed_customer_id: customerId,
                    is_walk_in: true,
                },
            ],
        });
    });

    it('allows the claimant to read a walk-in booking detail', async () => {
        const customerId = new mongoose.Types.ObjectId();
        const bookingId = new mongoose.Types.ObjectId();

        Booking.findById.mockReturnValue(createBookingByIdQuery({
            _id: bookingId,
            customer_id: null,
            claimed_customer_id: customerId,
            is_walk_in: true,
        }));

        const result = await bookingService.getMyBookingById(customerId, bookingId);

        expect(result.id).toBe(bookingId.toString());
        expect(result.claimed_customer_id).toBe(customerId.toString());
        expect(result.is_walk_in).toBe(true);
    });
});
