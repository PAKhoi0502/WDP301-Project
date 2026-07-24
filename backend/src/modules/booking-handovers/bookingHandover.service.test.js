jest.mock('../bookings/booking.model', () => ({ findById: jest.fn() }));
jest.mock('../vehicle-inspections/vehicleInspection.model', () => ({ find: jest.fn() }));
jest.mock('./bookingHandover.model', () => ({
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
}));
jest.mock('../customer-cases/customerCase.model', () => ({ exists: jest.fn() }));
jest.mock('../customer-cases/customerCaseNotification.service', () => ({
    notifyHandoverReady: jest.fn(),
    notifyHandoverAccepted: jest.fn(),
    notifyHandoverReleased: jest.fn(),
}));
jest.mock('../audit-logs/auditLog.service', () => ({ recordAuditEvent: jest.fn() }));

const Booking = require('../bookings/booking.model');
const VehicleInspection = require('../vehicle-inspections/vehicleInspection.model');
const BookingHandover = require('./bookingHandover.model');
const CustomerCase = require('../customer-cases/customerCase.model');
const notificationService = require('../customer-cases/customerCaseNotification.service');
const bookingHandoverService = require('./bookingHandover.service');

const thenablePopulateQuery = (value) => {
    const query = {
        populate: jest.fn(() => query),
        then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
    };
    return query;
};

describe('booking handover service', () => {
    const bookingId = '507f1f77bcf86cd799439011';
    const garageId = '507f1f77bcf86cd799439012';
    const customerId = '507f1f77bcf86cd799439013';
    const userId = '507f1f77bcf86cd799439014';

    const booking = {
        _id: bookingId,
        status: 'COMPLETED',
        garage_id: garageId,
        customer_id: customerId,
        vehicle_id: '507f1f77bcf86cd799439015',
    };

    beforeEach(() => {
        jest.clearAllMocks();
        notificationService.notifyHandoverReady.mockResolvedValue([]);
        notificationService.notifyHandoverAccepted.mockResolvedValue([]);
        notificationService.notifyHandoverReleased.mockResolvedValue([]);
        CustomerCase.exists.mockResolvedValue(null);
    });

    it('requires both before and after inspections before handover readiness', async () => {
        Booking.findById.mockResolvedValue(booking);
        VehicleInspection.find.mockResolvedValue([{ type: 'BEFORE_WASH' }]);

        await expect(bookingHandoverService.markReady(
            { _id: userId },
            { garage_id: garageId, is_admin: false },
            bookingId
        )).rejects.toMatchObject({ errorCode: 'HANDOVER_INSPECTIONS_REQUIRED' });

        expect(BookingHandover.create).not.toHaveBeenCalled();
    });

    it('creates a ready handover with an immutable inspection snapshot', async () => {
        const before = { _id: '507f1f77bcf86cd799439021', type: 'BEFORE_WASH', images: [{ image_url: 'before.jpg' }] };
        const after = { _id: '507f1f77bcf86cd799439022', type: 'AFTER_WASH', images: [{ image_url: 'after.jpg' }] };
        const handover = {
            _id: '507f1f77bcf86cd799439023',
            booking_id: bookingId,
            garage_id: garageId,
            customer_id: customerId,
            state: 'READY_FOR_CUSTOMER',
            customer_response: 'PENDING',
            inspection_snapshot: { before, after },
        };

        Booking.findById.mockResolvedValue(booking);
        VehicleInspection.find.mockResolvedValue([before, after]);
        BookingHandover.findOne.mockResolvedValue(null);
        BookingHandover.create.mockResolvedValue(handover);
        BookingHandover.findById.mockReturnValue(thenablePopulateQuery(handover));

        const result = await bookingHandoverService.markReady(
            { _id: userId },
            { garage_id: garageId, is_admin: false },
            bookingId
        );

        expect(BookingHandover.create).toHaveBeenCalledWith(expect.objectContaining({
            state: 'READY_FOR_CUSTOMER',
            inspection_snapshot: expect.objectContaining({
                before: expect.objectContaining({ type: 'BEFORE_WASH' }),
                after: expect.objectContaining({ type: 'AFTER_WASH' }),
            }),
        }));
        expect(notificationService.notifyHandoverReady).toHaveBeenCalledWith(handover);
        expect(result.state).toBe('READY_FOR_CUSTOMER');
    });

    it('prevents a customer from reading another customer handover', async () => {
        Booking.findById.mockResolvedValue(booking);

        await expect(bookingHandoverService.getMyHandover(
            { _id: '507f1f77bcf86cd799439099' },
            bookingId
        )).rejects.toMatchObject({ errorCode: 'BOOKING_NOT_FOUND' });
    });

    it('records customer acceptance before payment without releasing the vehicle', async () => {
        const handover = {
            _id: '507f1f77bcf86cd799439023',
            state: 'READY_FOR_CUSTOMER',
            customer_response: 'PENDING',
            save: jest.fn().mockResolvedValue(undefined),
        };
        Booking.findById.mockResolvedValue({ ...booking, payment_status: 'UNPAID' });
        BookingHandover.findOne.mockResolvedValue(handover);
        BookingHandover.findById.mockReturnValue(thenablePopulateQuery(handover));

        const result = await bookingHandoverService.acceptMyHandover(
            { _id: customerId },
            bookingId,
            { note: 'Vehicle condition is acceptable.' }
        );

        expect(result).toMatchObject({
            state: 'READY_FOR_CUSTOMER',
            customer_response: 'ACCEPTED',
            customer_response_source: 'CUSTOMER_SELF_SERVICE',
            customer_response_recorded_by_id: customerId,
        });
        expect(result.released_at).toBeUndefined();
        expect(handover.save).toHaveBeenCalled();
    });

    it('records walk-in acceptance through the staff actor', async () => {
        const handover = {
            _id: '507f1f77bcf86cd799439023',
            state: 'READY_FOR_CUSTOMER',
            customer_response: 'PENDING',
            save: jest.fn().mockResolvedValue(undefined),
        };
        Booking.findById.mockResolvedValue({
            ...booking,
            customer_id: null,
            is_walk_in: true,
            payment_status: 'UNPAID',
        });
        BookingHandover.findOne.mockResolvedValue(handover);
        BookingHandover.findById.mockReturnValue(thenablePopulateQuery(handover));

        const result = await bookingHandoverService.acceptWalkInHandover(
            { _id: userId },
            { garage_id: garageId, is_admin: false },
            bookingId
        );

        expect(result).toMatchObject({
            state: 'READY_FOR_CUSTOMER',
            customer_response: 'ACCEPTED',
            customer_response_source: 'STAFF_ASSISTED',
            customer_response_recorded_by_id: userId,
        });
    });

    it('keeps an issue-reported vehicle on hold until all linked cases are resolved', async () => {
        const handover = {
            _id: '507f1f77bcf86cd799439023',
            state: 'ON_HOLD',
            customer_response: 'ISSUE_REPORTED',
            issue_case_ids: ['507f1f77bcf86cd799439024'],
            save: jest.fn(),
        };
        Booking.findById.mockResolvedValue(booking);
        BookingHandover.findOne.mockResolvedValue(handover);
        CustomerCase.exists.mockResolvedValue({ _id: handover.issue_case_ids[0] });

        await expect(bookingHandoverService.acceptMyHandover(
            { _id: customerId },
            bookingId
        )).rejects.toMatchObject({
            errorCode: 'HANDOVER_ISSUE_RESOLUTION_REQUIRED',
        });
        expect(handover.save).not.toHaveBeenCalled();
    });

    it('requires an accepted response before staff release', async () => {
        Booking.findById.mockResolvedValue({ ...booking, payment_status: 'PAID' });
        BookingHandover.findOne.mockResolvedValue({
            _id: '507f1f77bcf86cd799439023',
            state: 'ON_HOLD',
            customer_response: 'ISSUE_REPORTED',
        });

        await expect(bookingHandoverService.release(
            { _id: userId },
            { garage_id: garageId, is_admin: false },
            bookingId
        )).rejects.toMatchObject({
            errorCode: 'HANDOVER_CUSTOMER_ACCEPTANCE_REQUIRED',
        });
    });

    it.each(['PAID', 'WAIVED'])('releases an accepted vehicle after %s settlement', async (paymentStatus) => {
        const handover = {
            _id: '507f1f77bcf86cd799439023',
            state: 'READY_FOR_CUSTOMER',
            customer_response: 'ACCEPTED',
            save: jest.fn().mockResolvedValue(undefined),
        };
        Booking.findById.mockResolvedValue({ ...booking, payment_status: paymentStatus });
        BookingHandover.findOne.mockResolvedValue(handover);
        BookingHandover.findById.mockReturnValue(thenablePopulateQuery(handover));

        const result = await bookingHandoverService.release(
            { _id: userId },
            { garage_id: garageId, is_admin: false },
            bookingId
        );

        expect(result.state).toBe('RELEASED');
        expect(result.released_by_id).toBe(userId);
    });

    it('treats an already-ready handover as an idempotent command', async () => {
        const before = { _id: '507f1f77bcf86cd799439021', type: 'BEFORE_WASH', images: [{ image_url: 'before.jpg' }] };
        const after = { _id: '507f1f77bcf86cd799439022', type: 'AFTER_WASH', images: [{ image_url: 'after.jpg' }] };
        const handover = {
            _id: '507f1f77bcf86cd799439023',
            state: 'READY_FOR_CUSTOMER',
            customer_response: 'PENDING',
        };
        Booking.findById.mockResolvedValue(booking);
        VehicleInspection.find.mockResolvedValue([before, after]);
        BookingHandover.findOne.mockResolvedValue(handover);
        BookingHandover.findById.mockReturnValue(thenablePopulateQuery(handover));

        const result = await bookingHandoverService.markReady(
            { _id: userId },
            { garage_id: garageId, is_admin: false },
            bookingId
        );

        expect(result.state).toBe('READY_FOR_CUSTOMER');
        expect(BookingHandover.create).not.toHaveBeenCalled();
        expect(notificationService.notifyHandoverReady).not.toHaveBeenCalled();
    });
});
