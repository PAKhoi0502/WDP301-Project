jest.mock('mongoose', () => ({ startSession: jest.fn() }));
jest.mock('../bookings/booking.model', () => ({ findById: jest.fn() }));
jest.mock('../booking-handovers/bookingHandover.model', () => ({ findOne: jest.fn() }));
jest.mock('./customerCase.model', () => ({
    findById: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    exists: jest.fn(),
    create: jest.fn(),
}));
jest.mock('./customerCaseEvent.model', () => ({ find: jest.fn(), create: jest.fn() }));
jest.mock('./customerCaseMessage.model', () => ({ find: jest.fn(), create: jest.fn() }));
jest.mock('./customerCaseTechnicalAssessment.model', () => ({ findOne: jest.fn() }));
jest.mock('./customerCaseResolution.model', () => ({ find: jest.fn() }));
jest.mock('./customerCaseRefund.model', () => ({ find: jest.fn() }));
jest.mock('../uploads/upload.model', () => ({ find: jest.fn(), updateMany: jest.fn() }));
jest.mock('../staff-profiles/staffProfile.model', () => ({ findById: jest.fn() }));
jest.mock('../users/user.model', () => ({ exists: jest.fn() }));
jest.mock('./customerCaseNotification.service', () => ({
    notifyCaseSubmitted: jest.fn(),
    notifyCaseAssigned: jest.fn(),
    notifyCustomerCaseUpdate: jest.fn(),
    notifyCaseMessage: jest.fn(),
}));
jest.mock('../audit-logs/auditLog.service', () => ({ recordAuditEvent: jest.fn() }));

const mongoose = require('mongoose');
const Booking = require('../bookings/booking.model');
const BookingHandover = require('../booking-handovers/bookingHandover.model');
const CustomerCase = require('./customerCase.model');
const CustomerCaseEvent = require('./customerCaseEvent.model');
const CustomerCaseMessage = require('./customerCaseMessage.model');
const CustomerCaseTechnicalAssessment = require('./customerCaseTechnicalAssessment.model');
const CustomerCaseResolution = require('./customerCaseResolution.model');
const CustomerCaseRefund = require('./customerCaseRefund.model');
const Upload = require('../uploads/upload.model');
const notificationService = require('./customerCaseNotification.service');
const customerCaseService = require('./customerCase.service');

const sessionQuery = (value) => ({ session: jest.fn().mockResolvedValue(value) });
const chainQuery = (value) => {
    const query = {
        populate: jest.fn(() => query),
        sort: jest.fn(() => query),
        skip: jest.fn(() => query),
        limit: jest.fn(() => query),
        then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
    };
    return query;
};

describe('customer case service', () => {
    const customerId = '507f1f77bcf86cd799439011';
    const bookingId = '507f1f77bcf86cd799439012';
    const garageId = '507f1f77bcf86cd799439013';
    const caseId = '507f1f77bcf86cd799439014';
    const handoverId = '507f1f77bcf86cd799439015';
    const uploadId = '507f1f77bcf86cd799439016';

    const setupSession = () => {
        const session = {
            withTransaction: jest.fn(async (callback) => callback()),
            endSession: jest.fn(),
        };
        mongoose.startSession.mockResolvedValue(session);
        return session;
    };

    const createIssueCaseIds = () => {
        const values = [];
        values.addToSet = jest.fn((value) => {
            if (!values.includes(value)) values.push(value);
        });
        return values;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        setupSession();
        CustomerCaseEvent.create.mockImplementation(async ([item]) => [{ _id: '507f1f77bcf86cd799439099', ...item }]);
        CustomerCaseMessage.find.mockReturnValue(chainQuery([]));
        CustomerCaseTechnicalAssessment.findOne.mockReturnValue(chainQuery(null));
        CustomerCaseResolution.find.mockReturnValue(chainQuery([]));
        CustomerCaseRefund.find.mockReturnValue(chainQuery([]));
        CustomerCaseEvent.find.mockReturnValue(chainQuery([]));
        notificationService.notifyCaseSubmitted.mockResolvedValue([]);
    });

    it('creates a high-priority damage case and links evidence atomically', async () => {
        const booking = {
            _id: bookingId,
            status: 'COMPLETED',
            customer_id: customerId,
            garage_id: garageId,
            vehicle_id: '507f1f77bcf86cd799439017',
            booking_items: [],
        };
        const handover = {
            _id: handoverId,
            state: 'READY_FOR_CUSTOMER',
            customer_response: 'PENDING',
            issue_case_ids: createIssueCaseIds(),
            inspection_snapshot: { before: {}, after: {} },
            save: jest.fn(),
        };
        const upload = {
            _id: uploadId,
            purpose: 'CUSTOMER_CASE_EVIDENCE',
            owner_id: customerId,
            mime_type: 'image/png',
            related_id: null,
        };
        const customerCase = {
            _id: caseId,
            case_code: 'CC-20260718-ABCDEF12',
            booking_id: bookingId,
            handover_id: handoverId,
            garage_id: garageId,
            customer_id: customerId,
            category: 'VEHICLE_DAMAGE',
            priority: 'HIGH',
            status: 'SUBMITTED',
            upload_ids: [uploadId],
        };

        Booking.findById.mockReturnValue(sessionQuery(booking));
        BookingHandover.findOne.mockReturnValue(sessionQuery(handover));
        CustomerCase.exists.mockReturnValue(sessionQuery(null));
        Upload.find.mockReturnValue(sessionQuery([upload]));
        CustomerCase.create.mockImplementation(async ([payload]) => [{ ...customerCase, ...payload, _id: caseId }]);
        Upload.updateMany.mockResolvedValue({ modifiedCount: 1 });
        CustomerCase.findById.mockReturnValue(chainQuery(customerCase));

        const result = await customerCaseService.createFromHandover(
            { _id: customerId, role: 'CUSTOMER' },
            bookingId,
            {
                category: 'VEHICLE_DAMAGE',
                description: 'A new scratch appeared on the left door.',
                upload_ids: [uploadId],
                vehicle_received: false,
            }
        );

        expect(CustomerCase.create).toHaveBeenCalledWith([
            expect.objectContaining({ priority: 'HIGH', priority_rank: 2, source: 'HANDOVER' }),
        ], expect.any(Object));
        expect(Upload.updateMany).toHaveBeenCalledWith(
            { _id: { $in: [uploadId] } },
            { $set: { related_type: 'CUSTOMER_CASE', related_id: caseId } },
            expect.any(Object)
        );
        expect(handover.customer_response).toBe('ISSUE_REPORTED');
        expect(handover.state).toBe('ON_HOLD');
        expect(notificationService.notifyCaseSubmitted).toHaveBeenCalled();
        expect(result.case.case_code).toBe(customerCase.case_code);
    });

    it('holds an unreleased vehicle when a safety concern is reported', async () => {
        const booking = { _id: bookingId, customer_id: customerId, garage_id: garageId, booking_items: [] };
        const handover = {
            _id: handoverId,
            state: 'READY_FOR_CUSTOMER',
            issue_case_ids: createIssueCaseIds(),
            inspection_snapshot: {},
            save: jest.fn(),
        };
        const customerCase = {
            _id: caseId,
            case_code: 'CC-20260718-ABCDEF12',
            booking_id: bookingId,
            handover_id: handoverId,
            garage_id: garageId,
            customer_id: customerId,
            category: 'SAFETY_CONCERN',
            priority: 'CRITICAL',
            status: 'SUBMITTED',
            upload_ids: [],
        };

        Booking.findById.mockReturnValue(sessionQuery(booking));
        BookingHandover.findOne.mockReturnValue(sessionQuery(handover));
        CustomerCase.exists.mockReturnValue(sessionQuery(null));
        CustomerCase.create.mockImplementation(async ([payload]) => [{ ...customerCase, ...payload, _id: caseId }]);
        CustomerCase.findById.mockReturnValue(chainQuery(customerCase));

        await customerCaseService.createFromHandover(
            { _id: customerId, role: 'CUSTOMER' },
            bookingId,
            {
                category: 'SAFETY_CONCERN',
                description: 'The steering response feels unsafe after service.',
                upload_ids: [],
                vehicle_received: false,
            }
        );

        expect(handover.state).toBe('ON_HOLD');
        expect(CustomerCase.create).toHaveBeenCalledWith([
            expect.objectContaining({ priority: 'CRITICAL', priority_rank: 3 }),
        ], expect.any(Object));
    });

    it('requires admin role for liability conclusion', async () => {
        await expect(customerCaseService.concludeCase(
            { _id: customerId, role: 'STAFF' },
            caseId,
            { liability_status: 'INCONCLUSIVE', conclusion: 'No conclusive evidence was available.' }
        )).rejects.toMatchObject({ errorCode: 'CUSTOMER_CASE_CONCLUSION_ADMIN_ONLY' });

        expect(CustomerCase.findById).not.toHaveBeenCalled();
    });

    it('does not record vehicle receipt before payment', async () => {
        Booking.findById.mockReturnValue(sessionQuery({
            _id: bookingId,
            customer_id: customerId,
            garage_id: garageId,
            payment_status: 'UNPAID',
        }));
        BookingHandover.findOne.mockReturnValue(sessionQuery({
            _id: handoverId,
            state: 'READY_FOR_CUSTOMER',
        }));

        await expect(customerCaseService.createFromHandover(
            { _id: customerId, role: 'CUSTOMER' },
            bookingId,
            {
                category: 'SERVICE_QUALITY',
                description: 'The requested service quality was not delivered.',
                upload_ids: [],
                vehicle_received: true,
            }
        )).rejects.toMatchObject({ errorCode: 'HANDOVER_PAYMENT_REQUIRED' });

        expect(CustomerCase.create).not.toHaveBeenCalled();
    });

    it('hides a case from staff in another garage', async () => {
        CustomerCase.findById.mockResolvedValue({
            _id: caseId,
            garage_id: garageId,
        });

        await expect(customerCaseService.getStaffCaseById(
            { is_admin: false, garage_id: '507f1f77bcf86cd799439099' },
            caseId
        )).rejects.toMatchObject({ errorCode: 'CUSTOMER_CASE_GARAGE_ACCESS_REQUIRED' });
    });

    it('filters garage customer cases by priority', async () => {
        CustomerCase.find.mockReturnValue(chainQuery([]));
        CustomerCase.countDocuments.mockResolvedValue(0);

        await customerCaseService.getStaffCases(
            { is_admin: false, garage_id: garageId },
            { priority: 'HIGH', page: 1, limit: 20 }
        );

        expect(CustomerCase.find).toHaveBeenCalledWith({
            garage_id: garageId,
            priority: 'HIGH',
        });
        expect(CustomerCase.countDocuments).toHaveBeenCalledWith({
            garage_id: garageId,
            priority: 'HIGH',
        });
    });
});
