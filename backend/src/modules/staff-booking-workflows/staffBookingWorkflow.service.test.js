jest.mock('../bookings/booking.model', () => ({
    find: jest.fn(),
    findById: jest.fn(),
    findOneAndUpdate: jest.fn(),
    countDocuments: jest.fn(),
}));

jest.mock('../vehicle-inspections/vehicleInspection.model', () => ({
    find: jest.fn(),
    exists: jest.fn(),
}));

jest.mock('../booking-handovers/bookingHandover.model', () => ({
    find: jest.fn(),
    findOne: jest.fn(),
}));

jest.mock('../booking-service-steps/bookingServiceStep.model', () => ({
    find: jest.fn(),
}));

const Booking = require('../bookings/booking.model');
const VehicleInspection = require('../vehicle-inspections/vehicleInspection.model');
const BookingHandover = require('../booking-handovers/bookingHandover.model');
const BookingServiceStep = require('../booking-service-steps/bookingServiceStep.model');
const staffBookingWorkflowService = require('./staffBookingWorkflow.service');
const {
    STAFF_TYPES,
    getStaffCapabilities,
} = require('../../shared/constants/staff.constant');
const {
    BOOKING_WORKFLOW_PHASES,
    BOOKING_WORKFLOW_ACTIONS,
    BOOKING_WORKFLOW_BLOCKERS,
} = require('../../shared/constants/bookingWorkflow.constant');

const createLeanQuery = (result) => ({
    lean: jest.fn().mockResolvedValue(result),
});

const createSortLeanQuery = (result) => ({
    sort: jest.fn().mockReturnValue(createLeanQuery(result)),
});

const createBookingListQuery = (result) => {
    const query = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(result),
    };

    return query;
};

describe('staff booking workflow service', () => {
    const bookingId = '507f1f77bcf86cd799439011';
    const garageId = '507f1f77bcf86cd799439012';
    const otherGarageId = '507f1f77bcf86cd799439013';
    const userId = '507f1f77bcf86cd799439014';
    const staffProfileId = '507f1f77bcf86cd799439015';

    const createStaffContext = (staffType, overrides = {}) => ({
        is_admin: false,
        user_id: userId,
        staff_profile_id: staffProfileId,
        staff_type: staffType,
        garage_id: garageId,
        capabilities: getStaffCapabilities(staffType),
        ...overrides,
    });

    const createBooking = (overrides = {}) => ({
        _id: bookingId,
        garage_id: garageId,
        customer_id: '507f1f77bcf86cd799439099',
        guest_phone: '0901234567',
        guest_email: 'private@example.com',
        final_price: 500000,
        license_plate: '59A-12345',
        normalized_license_plate: '59A12345',
        vehicle_type: 'CAR',
        start_time: new Date('2026-07-22T03:00:00.000Z'),
        end_time: new Date('2026-07-22T04:00:00.000Z'),
        wash_bay_id: null,
        assigned_inspection_staff_id: userId,
        status: 'CHECKED_IN',
        arrival_status: 'ON_TIME',
        operation_status: 'NORMAL',
        active_incident_id: null,
        checked_in_at: new Date('2026-07-22T02:55:00.000Z'),
        payment_method: 'CASH',
        payment_status: 'UNPAID',
        booking_items: [],
        ...overrides,
    });

    const beforeInspection = {
        _id: '507f1f77bcf86cd799439020',
        booking_id: bookingId,
        type: 'BEFORE_WASH',
        inspected_by: userId,
        inspected_at: new Date('2026-07-22T02:58:00.000Z'),
        images: [{ image_url: 'https://example.com/before.jpg' }],
    };

    const afterInspection = {
        _id: '507f1f77bcf86cd799439021',
        booking_id: bookingId,
        type: 'AFTER_WASH',
        inspected_by: userId,
        inspected_at: new Date('2026-07-22T04:05:00.000Z'),
        images: [{ image_url: 'https://example.com/after.jpg' }],
    };

    const mockDetailQueries = ({
        booking = createBooking(),
        inspections = [],
        handover = null,
        serviceSteps = [],
    } = {}) => {
        Booking.findById.mockReturnValue(createLeanQuery(booking));
        VehicleInspection.find.mockReturnValue(createSortLeanQuery(inspections));
        BookingHandover.findOne.mockReturnValue(createLeanQuery(handover));
        BookingServiceStep.find.mockReturnValue(createSortLeanQuery(serviceSteps));
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('lists all same-garage workflows without exposing customer contact or prices', async () => {
        const booking = createBooking({ assigned_inspection_staff_id: null });
        Booking.find.mockReturnValue(createBookingListQuery([booking]));
        Booking.countDocuments.mockResolvedValue(1);
        VehicleInspection.find.mockReturnValue(createSortLeanQuery([beforeInspection]));
        BookingHandover.find.mockReturnValue(createLeanQuery([]));
        BookingServiceStep.find.mockReturnValue(createSortLeanQuery([]));

        const result = await staffBookingWorkflowService.listBookingWorkflows(
            createStaffContext(STAFF_TYPES.WASH_OPERATOR),
            { page: 1, limit: 20 }
        );

        expect(Booking.find).toHaveBeenCalledWith({ garage_id: garageId });
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toMatchObject({
            booking_id: bookingId,
            workflow_phase: BOOKING_WORKFLOW_PHASES.READY_FOR_SERVICE,
        });
        expect(result.data[0]).not.toHaveProperty('customer_id');
        expect(result.data[0]).not.toHaveProperty('guest_phone');
        expect(result.data[0]).not.toHaveProperty('guest_email');
        expect(result.data[0]).not.toHaveProperty('final_price');
        expect(result.data[0]).toHaveProperty('available_actions');
    });

    it('offers inspection self-claim in the shared queue for an eligible booking', async () => {
        const booking = createBooking({ assigned_inspection_staff_id: null });
        Booking.find.mockReturnValue(createBookingListQuery([booking]));
        Booking.countDocuments.mockResolvedValue(1);
        VehicleInspection.find.mockReturnValue(createSortLeanQuery([]));
        BookingHandover.find.mockReturnValue(createLeanQuery([]));
        BookingServiceStep.find.mockReturnValue(createSortLeanQuery([]));

        const result = await staffBookingWorkflowService.listBookingWorkflows(
            createStaffContext(STAFF_TYPES.VEHICLE_INSPECTION_STAFF),
            { page: 1, limit: 20 }
        );

        expect(result.data[0].available_actions).toContain(
            BOOKING_WORKFLOW_ACTIONS.INSPECTION_CLAIM
        );
        expect(result.data[0].available_actions).not.toContain(
            BOOKING_WORKFLOW_ACTIONS.INSPECTION_BEFORE_WASH_CREATE
        );
    });

    it('rejects workflow detail access outside the assigned garage', async () => {
        Booking.findById.mockReturnValue(createLeanQuery(
            createBooking({ garage_id: otherGarageId })
        ));

        await expect(staffBookingWorkflowService.getBookingWorkflow(
            createStaffContext(STAFF_TYPES.VEHICLE_INSPECTION_STAFF),
            bookingId
        )).rejects.toMatchObject({
            statusCode: 403,
            errorCode: 'STAFF_GARAGE_ACCESS_DENIED',
        });

        expect(VehicleInspection.find).not.toHaveBeenCalled();
        expect(BookingHandover.findOne).not.toHaveBeenCalled();
        expect(BookingServiceStep.find).not.toHaveBeenCalled();
    });

    it('rejects workflow listing when staff has no assigned garage', async () => {
        await expect(staffBookingWorkflowService.listBookingWorkflows(
            createStaffContext(STAFF_TYPES.WASH_OPERATOR, { garage_id: null }),
            { page: 1, limit: 20 }
        )).rejects.toMatchObject({
            statusCode: 403,
            errorCode: 'STAFF_GARAGE_NOT_ASSIGNED',
        });

        expect(Booking.find).not.toHaveBeenCalled();
    });

    it('offers before-wash inspection only to the assigned inspection staff', async () => {
        mockDetailQueries();

        const result = await staffBookingWorkflowService.getBookingWorkflow(
            createStaffContext(STAFF_TYPES.VEHICLE_INSPECTION_STAFF),
            bookingId
        );

        expect(result.workflow_phase).toBe(
            BOOKING_WORKFLOW_PHASES.WAITING_BEFORE_WASH_INSPECTION
        );
        expect(result.blockers).toContain(
            BOOKING_WORKFLOW_BLOCKERS.BEFORE_WASH_INSPECTION_REQUIRED
        );
        expect(result.available_actions).toContain(
            BOOKING_WORKFLOW_ACTIONS.INSPECTION_BEFORE_WASH_CREATE
        );
        expect(result.available_actions).not.toContain(
            BOOKING_WORKFLOW_ACTIONS.BOOKING_SERVICE_START
        );
    });

    it('offers claim instead of inspection creation when the booking is unassigned', async () => {
        mockDetailQueries({
            booking: createBooking({ assigned_inspection_staff_id: null }),
        });

        const result = await staffBookingWorkflowService.getBookingWorkflow(
            createStaffContext(STAFF_TYPES.VEHICLE_INSPECTION_STAFF),
            bookingId
        );

        expect(result.available_actions).toContain(
            BOOKING_WORKFLOW_ACTIONS.INSPECTION_CLAIM
        );
        expect(result.available_actions).not.toContain(
            BOOKING_WORKFLOW_ACTIONS.INSPECTION_BEFORE_WASH_CREATE
        );
    });

    it('does not offer inspection actions when another inspector owns the booking', async () => {
        mockDetailQueries({
            booking: createBooking({
                assigned_inspection_staff_id: '507f1f77bcf86cd799439030',
            }),
        });

        const result = await staffBookingWorkflowService.getBookingWorkflow(
            createStaffContext(STAFF_TYPES.VEHICLE_INSPECTION_STAFF),
            bookingId
        );

        expect(result.available_actions).not.toContain(
            BOOKING_WORKFLOW_ACTIONS.INSPECTION_CLAIM
        );
        expect(result.available_actions).not.toContain(
            BOOKING_WORKFLOW_ACTIONS.INSPECTION_BEFORE_WASH_CREATE
        );
    });

    it('atomically claims an eligible booking and returns the updated workflow', async () => {
        const unassignedBooking = createBooking({ assigned_inspection_staff_id: null });
        const claimedBooking = createBooking({ assigned_inspection_staff_id: userId });
        Booking.findById
            .mockReturnValueOnce(createLeanQuery(unassignedBooking))
            .mockReturnValueOnce(createLeanQuery(claimedBooking));
        Booking.findOneAndUpdate.mockReturnValue(createLeanQuery(claimedBooking));
        VehicleInspection.exists.mockResolvedValue(false);
        VehicleInspection.find.mockReturnValue(createSortLeanQuery([]));
        BookingHandover.findOne.mockReturnValue(createLeanQuery(null));
        BookingServiceStep.find.mockReturnValue(createSortLeanQuery([]));

        const result = await staffBookingWorkflowService.claimInspectionBooking(
            createStaffContext(STAFF_TYPES.VEHICLE_INSPECTION_STAFF),
            bookingId
        );

        expect(Booking.findOneAndUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                _id: bookingId,
                garage_id: garageId,
                status: 'CHECKED_IN',
            }),
            {
                $set: {
                    assigned_inspection_staff_id: userId,
                },
            },
            { new: true }
        );
        expect(result.assigned_inspection_staff_id).toBe(userId);
        expect(result.available_actions).toContain(
            BOOKING_WORKFLOW_ACTIONS.INSPECTION_BEFORE_WASH_CREATE
        );
        expect(result.available_actions).not.toContain(
            BOOKING_WORKFLOW_ACTIONS.INSPECTION_CLAIM
        );
    });

    it('returns the current workflow without writing when the caller already owns the claim', async () => {
        const claimedBooking = createBooking({
            assigned_inspection_staff_id: userId,
            status: 'COMPLETED',
        });
        Booking.findById
            .mockReturnValueOnce(createLeanQuery(claimedBooking))
            .mockReturnValueOnce(createLeanQuery(claimedBooking));
        VehicleInspection.find.mockReturnValue(createSortLeanQuery([
            beforeInspection,
            afterInspection,
        ]));
        BookingHandover.findOne.mockReturnValue(createLeanQuery(null));
        BookingServiceStep.find.mockReturnValue(createSortLeanQuery([]));

        const result = await staffBookingWorkflowService.claimInspectionBooking(
            createStaffContext(STAFF_TYPES.VEHICLE_INSPECTION_STAFF),
            bookingId
        );

        expect(Booking.findOneAndUpdate).not.toHaveBeenCalled();
        expect(VehicleInspection.exists).not.toHaveBeenCalled();
        expect(result.assigned_inspection_staff_id).toBe(userId);
    });

    it('returns a deterministic conflict when another inspector wins the claim', async () => {
        const unassignedBooking = createBooking({ assigned_inspection_staff_id: null });
        const competingBooking = createBooking({
            assigned_inspection_staff_id: '507f1f77bcf86cd799439030',
        });
        Booking.findById
            .mockReturnValueOnce(createLeanQuery(unassignedBooking))
            .mockReturnValueOnce(createLeanQuery(competingBooking));
        Booking.findOneAndUpdate.mockReturnValue(createLeanQuery(null));
        VehicleInspection.exists.mockResolvedValue(false);

        await expect(staffBookingWorkflowService.claimInspectionBooking(
            createStaffContext(STAFF_TYPES.VEHICLE_INSPECTION_STAFF),
            bookingId
        )).rejects.toMatchObject({
            statusCode: 409,
            errorCode: 'INSPECTION_ALREADY_CLAIMED',
        });
    });

    it('rejects claims before check-in or after the before-wash inspection exists', async () => {
        Booking.findById.mockReturnValueOnce(createLeanQuery(createBooking({
            assigned_inspection_staff_id: null,
            status: 'CONFIRMED',
        })));

        await expect(staffBookingWorkflowService.claimInspectionBooking(
            createStaffContext(STAFF_TYPES.VEHICLE_INSPECTION_STAFF),
            bookingId
        )).rejects.toMatchObject({
            statusCode: 409,
            errorCode: 'INSPECTION_CLAIM_NOT_ALLOWED',
        });

        Booking.findById.mockReturnValueOnce(createLeanQuery(createBooking({
            assigned_inspection_staff_id: null,
        })));
        VehicleInspection.exists.mockResolvedValueOnce(true);

        await expect(staffBookingWorkflowService.claimInspectionBooking(
            createStaffContext(STAFF_TYPES.VEHICLE_INSPECTION_STAFF),
            bookingId
        )).rejects.toMatchObject({
            statusCode: 409,
            errorCode: 'BEFORE_WASH_INSPECTION_ALREADY_EXISTS',
        });

        expect(Booking.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('rejects claims while the booking workflow is on incident hold', async () => {
        Booking.findById.mockReturnValueOnce(createLeanQuery(createBooking({
            assigned_inspection_staff_id: null,
            active_incident_id: '507f1f77bcf86cd799439040',
        })));

        await expect(staffBookingWorkflowService.claimInspectionBooking(
            createStaffContext(STAFF_TYPES.VEHICLE_INSPECTION_STAFF),
            bookingId
        )).rejects.toMatchObject({
            statusCode: 409,
            errorCode: 'INSPECTION_CLAIM_ON_HOLD',
        });

        expect(VehicleInspection.exists).not.toHaveBeenCalled();
        expect(Booking.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('rejects inspection claims from other staff types', async () => {
        await expect(staffBookingWorkflowService.claimInspectionBooking(
            createStaffContext(STAFF_TYPES.CUSTOMER_SERVICE_STAFF),
            bookingId
        )).rejects.toMatchObject({
            statusCode: 403,
            errorCode: 'INSPECTION_CLAIM_STAFF_ONLY',
        });

        expect(Booking.findById).not.toHaveBeenCalled();
    });

    it('offers service start to customer service after before-wash inspection', async () => {
        mockDetailQueries({ inspections: [beforeInspection] });

        const result = await staffBookingWorkflowService.getBookingWorkflow(
            createStaffContext(STAFF_TYPES.CUSTOMER_SERVICE_STAFF),
            bookingId
        );

        expect(result.workflow_phase).toBe(BOOKING_WORKFLOW_PHASES.READY_FOR_SERVICE);
        expect(result.available_actions).toContain(
            BOOKING_WORKFLOW_ACTIONS.BOOKING_SERVICE_START
        );
        expect(result.available_actions).not.toContain(
            BOOKING_WORKFLOW_ACTIONS.INSPECTION_BEFORE_WASH_CREATE
        );
        expect(result).not.toHaveProperty('customer_id');
        expect(result).not.toHaveProperty('guest_phone');
        expect(result).not.toHaveProperty('guest_email');
        expect(result).not.toHaveProperty('final_price');
    });

    it('offers service-item actions only to the assigned execution staff', async () => {
        const booking = createBooking({
            status: 'IN_PROGRESS',
            booking_items: [{
                item_key: 'WASH_1',
                name_snapshot: 'Automated wash',
                sequence: 1,
                duration_minutes: 15,
                transition_mode: 'AUTO',
                status: 'IN_PROGRESS',
                requires_wash_bay: true,
                requires_care_staff: false,
                assigned_execution_staff: [{
                    staff_profile_id: staffProfileId,
                    user_id: userId,
                    released_at: null,
                }],
            }],
        });
        mockDetailQueries({ booking, inspections: [beforeInspection] });

        const assignedResult = await staffBookingWorkflowService.getBookingWorkflow(
            createStaffContext(STAFF_TYPES.WASH_OPERATOR),
            bookingId
        );

        expect(assignedResult.available_actions).toEqual(expect.arrayContaining([
            BOOKING_WORKFLOW_ACTIONS.SERVICE_ITEM_PAUSE,
            BOOKING_WORKFLOW_ACTIONS.SERVICE_ITEM_COMPLETE_EARLY,
        ]));

        mockDetailQueries({ booking, inspections: [beforeInspection] });
        const unassignedResult = await staffBookingWorkflowService.getBookingWorkflow(
            createStaffContext(STAFF_TYPES.VEHICLE_CARE_STAFF, {
                user_id: '507f1f77bcf86cd799439030',
                staff_profile_id: '507f1f77bcf86cd799439031',
            }),
            bookingId
        );

        expect(unassignedResult.available_actions).not.toContain(
            BOOKING_WORKFLOW_ACTIONS.SERVICE_ITEM_PAUSE
        );
        expect(unassignedResult.available_actions).not.toContain(
            BOOKING_WORKFLOW_ACTIONS.SERVICE_ITEM_COMPLETE_EARLY
        );
    });

    it('waits for after-wash inspection after all service items are done', async () => {
        const booking = createBooking({
            status: 'IN_PROGRESS',
            booking_items: [{
                item_key: 'WASH_1',
                name_snapshot: 'Automated wash',
                sequence: 1,
                status: 'DONE',
            }],
        });
        mockDetailQueries({
            booking,
            inspections: [beforeInspection],
            serviceSteps: [{
                step_code: 'POST_SERVICE_HANDOVER',
                workflow_type: 'POST_SERVICE',
                is_required: true,
                status: 'PENDING',
            }],
        });

        const result = await staffBookingWorkflowService.getBookingWorkflow(
            createStaffContext(STAFF_TYPES.VEHICLE_INSPECTION_STAFF),
            bookingId
        );

        expect(result.workflow_phase).toBe(
            BOOKING_WORKFLOW_PHASES.WAITING_AFTER_WASH_INSPECTION
        );
        expect(result.blockers).toContain(
            BOOKING_WORKFLOW_BLOCKERS.AFTER_WASH_INSPECTION_REQUIRED
        );
        expect(result.available_actions).toContain(
            BOOKING_WORKFLOW_ACTIONS.INSPECTION_AFTER_WASH_CREATE
        );
    });

    it('allows service completion when after-wash evidence covers a legacy pending post step', async () => {
        const booking = createBooking({
            status: 'IN_PROGRESS',
            booking_items: [{
                item_key: 'WASH_1',
                name_snapshot: 'Automated wash',
                sequence: 1,
                status: 'DONE',
            }],
        });
        mockDetailQueries({
            booking,
            inspections: [beforeInspection, afterInspection],
            serviceSteps: [{
                _id: '507f1f77bcf86cd799439030',
                step_code: 'POST_SERVICE_HANDOVER',
                workflow_type: 'POST_SERVICE',
                is_required: true,
                status: 'PENDING',
            }],
        });

        const result = await staffBookingWorkflowService.getBookingWorkflow(
            createStaffContext(STAFF_TYPES.CUSTOMER_SERVICE_STAFF),
            bookingId
        );

        expect(result.workflow_phase).toBe(
            BOOKING_WORKFLOW_PHASES.READY_TO_COMPLETE_SERVICE
        );
        expect(result.blockers).not.toContain(
            BOOKING_WORKFLOW_BLOCKERS.REQUIRED_SERVICE_STEPS_NOT_DONE
        );
        expect(result.available_actions).toContain(
            BOOKING_WORKFLOW_ACTIONS.BOOKING_SERVICE_COMPLETE
        );
    });

    it('keeps service completion blocked when another required step is pending', async () => {
        const booking = createBooking({
            status: 'IN_PROGRESS',
            booking_items: [{
                item_key: 'WASH_1',
                name_snapshot: 'Automated wash',
                sequence: 1,
                status: 'DONE',
            }],
        });
        mockDetailQueries({
            booking,
            inspections: [beforeInspection, afterInspection],
            serviceSteps: [
                {
                    step_code: 'CAR_STANDARD_WASH',
                    workflow_type: 'SERVICE',
                    is_required: true,
                    status: 'PENDING',
                },
                {
                    step_code: 'POST_SERVICE_HANDOVER',
                    workflow_type: 'POST_SERVICE',
                    is_required: true,
                    status: 'PENDING',
                },
            ],
        });

        const result = await staffBookingWorkflowService.getBookingWorkflow(
            createStaffContext(STAFF_TYPES.CUSTOMER_SERVICE_STAFF),
            bookingId
        );

        expect(result.blockers).toContain(
            BOOKING_WORKFLOW_BLOCKERS.REQUIRED_SERVICE_STEPS_NOT_DONE
        );
        expect(result.available_actions).not.toContain(
            BOOKING_WORKFLOW_ACTIONS.BOOKING_SERVICE_COMPLETE
        );
    });

    it('derives post-service payment and release phases from handover state', async () => {
        const booking = createBooking({
            status: 'COMPLETED',
            completed_at: new Date('2026-07-22T04:00:00.000Z'),
        });
        const handover = {
            booking_id: bookingId,
            state: 'READY_FOR_CUSTOMER',
            customer_response: 'ACCEPTED',
            ready_at: new Date('2026-07-22T04:10:00.000Z'),
        };
        mockDetailQueries({
            booking,
            inspections: [beforeInspection, afterInspection],
            handover,
        });

        const unpaidResult = await staffBookingWorkflowService.getBookingWorkflow(
            createStaffContext(STAFF_TYPES.CUSTOMER_SERVICE_STAFF),
            bookingId
        );

        expect(unpaidResult.workflow_phase).toBe(BOOKING_WORKFLOW_PHASES.WAITING_PAYMENT);
        expect(unpaidResult.blockers).toContain(BOOKING_WORKFLOW_BLOCKERS.PAYMENT_REQUIRED);
        expect(unpaidResult.available_actions).toContain(
            BOOKING_WORKFLOW_ACTIONS.BOOKING_PAYMENT_COLLECT_CASH
        );

        mockDetailQueries({
            booking: { ...booking, payment_status: 'PAID' },
            inspections: [beforeInspection, afterInspection],
            handover,
        });
        const paidResult = await staffBookingWorkflowService.getBookingWorkflow(
            createStaffContext(STAFF_TYPES.CUSTOMER_SERVICE_STAFF),
            bookingId
        );

        expect(paidResult.workflow_phase).toBe(BOOKING_WORKFLOW_PHASES.READY_FOR_RELEASE);
        expect(paidResult.available_actions).toContain(
            BOOKING_WORKFLOW_ACTIONS.HANDOVER_RELEASE
        );
    });
});
