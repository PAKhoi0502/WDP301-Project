jest.mock('mongoose', () => ({
    startSession: jest.fn(),
}));

jest.mock('../bookings/booking.model', () => ({
    findById: jest.fn(),
}));

jest.mock('../staff-profiles/staffProfile.model', () => ({
    findOne: jest.fn(),
}));

jest.mock('./vehicleInspection.model', () => ({
    exists: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
}));

jest.mock('./vehicleInspection.mapper', () => ({
    toVehicleInspectionDto: jest.fn((inspection) => inspection),
    toVehicleInspectionDtoList: jest.fn((inspections) => inspections),
}));

jest.mock('../booking-service-steps/bookingServiceStep.service', () => ({
    completePreServiceStepFromInspection: jest.fn(),
    completePostServiceStepFromInspection: jest.fn(),
}));

const mongoose = require('mongoose');
const Booking = require('../bookings/booking.model');
const VehicleInspection = require('./vehicleInspection.model');
const bookingServiceStepService = require('../booking-service-steps/bookingServiceStep.service');
const vehicleInspectionService = require('./vehicleInspection.service');

const createSessionQuery = (result) => ({
    session: jest.fn().mockReturnThis(),
    then(resolve, reject) {
        return Promise.resolve(result).then(resolve, reject);
    },
});

const createPopulateQuery = (result) => ({
    populate: jest.fn().mockReturnThis(),
    then(resolve, reject) {
        return Promise.resolve(result).then(resolve, reject);
    },
});

describe('vehicle inspection service', () => {
    const bookingId = '507f1f77bcf86cd799439001';
    const garageId = '507f1f77bcf86cd799439002';
    const userId = '507f1f77bcf86cd799439003';
    const inspectionId = '507f1f77bcf86cd799439004';
    const user = { _id: userId, role: 'ADMIN' };
    let session;

    const createBooking = (overrides = {}) => ({
        _id: bookingId,
        garage_id: garageId,
        status: 'IN_PROGRESS',
        booking_items: [{
            item_key: 'WASH_1',
            status: 'DONE',
        }],
        ...overrides,
    });

    beforeEach(() => {
        jest.clearAllMocks();
        session = {
            withTransaction: jest.fn(async (work) => work()),
            endSession: jest.fn().mockResolvedValue(undefined),
        };
        mongoose.startSession.mockResolvedValue(session);
        Booking.findById.mockReturnValue(createSessionQuery(createBooking()));
        VehicleInspection.exists.mockReturnValue(createSessionQuery(null));
        VehicleInspection.create.mockImplementation(async ([payload]) => ([{
            _id: inspectionId,
            ...payload,
        }]));
        VehicleInspection.findById.mockReturnValue(createPopulateQuery({
            _id: inspectionId,
            booking_id: bookingId,
            type: 'AFTER_WASH',
        }));
        bookingServiceStepService.completePreServiceStepFromInspection.mockResolvedValue(null);
        bookingServiceStepService.completePostServiceStepFromInspection.mockResolvedValue(null);
    });

    it('creates after-wash inspection and completes the post-service step in one transaction', async () => {
        const result = await vehicleInspectionService.createInspection(user, bookingId, {
            type: 'AFTER_WASH',
            note: ' Ready for handover ',
            images: [{
                image_url: ' https://example.com/after.jpg ',
                caption: ' Finished ',
            }],
        });

        expect(session.withTransaction).toHaveBeenCalledTimes(1);
        expect(VehicleInspection.create).toHaveBeenCalledWith(
            [expect.objectContaining({
                booking_id: bookingId,
                type: 'AFTER_WASH',
                note: 'Ready for handover',
                images: [{
                    image_url: 'https://example.com/after.jpg',
                    public_id: null,
                    caption: 'Finished',
                }],
                inspected_by: userId,
                inspected_at: expect.any(Date),
            })],
            { session }
        );
        expect(
            bookingServiceStepService.completePostServiceStepFromInspection
        ).toHaveBeenCalledWith({
            bookingId,
            inspectionId,
            inspectorUserId: userId,
            inspectedAt: expect.any(Date),
            session,
        });
        expect(session.endSession).toHaveBeenCalledTimes(1);
        expect(result).toMatchObject({ _id: inspectionId });
    });

    it('rejects after-wash inspection without image evidence', async () => {
        await expect(vehicleInspectionService.createInspection(user, bookingId, {
            type: 'AFTER_WASH',
            images: [],
        })).rejects.toMatchObject({
            statusCode: 400,
            errorCode: 'AFTER_WASH_INSPECTION_IMAGE_REQUIRED',
        });

        expect(VehicleInspection.create).not.toHaveBeenCalled();
        expect(
            bookingServiceStepService.completePostServiceStepFromInspection
        ).not.toHaveBeenCalled();
        expect(session.endSession).toHaveBeenCalledTimes(1);
    });

    it('rejects after-wash inspection while a service item is unfinished', async () => {
        Booking.findById.mockReturnValue(createSessionQuery(createBooking({
            booking_items: [{
                item_key: 'WASH_1',
                status: 'IN_PROGRESS',
            }],
        })));

        await expect(vehicleInspectionService.createInspection(user, bookingId, {
            type: 'AFTER_WASH',
            images: [{ image_url: 'https://example.com/after.jpg' }],
        })).rejects.toMatchObject({
            statusCode: 400,
            errorCode: 'AFTER_WASH_SERVICE_ITEMS_NOT_DONE',
        });

        expect(VehicleInspection.create).not.toHaveBeenCalled();
        expect(session.endSession).toHaveBeenCalledTimes(1);
    });

    it('creates before-wash inspection and completes the pre-service step in one transaction', async () => {
        Booking.findById.mockReturnValue(createSessionQuery(createBooking({
            status: 'CHECKED_IN',
            booking_items: [],
        })));

        await vehicleInspectionService.createInspection(user, bookingId, {
            type: 'BEFORE_WASH',
            images: [],
        });

        expect(VehicleInspection.create).toHaveBeenCalled();
        expect(
            bookingServiceStepService.completePreServiceStepFromInspection
        ).toHaveBeenCalledWith({
            bookingId,
            inspectionId,
            inspectorUserId: userId,
            inspectedAt: expect.any(Date),
            session,
        });
        expect(
            bookingServiceStepService.completePostServiceStepFromInspection
        ).not.toHaveBeenCalled();
        expect(session.endSession).toHaveBeenCalledTimes(1);
    });
});
