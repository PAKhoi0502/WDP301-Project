jest.mock('../bookings/booking.model', () => ({ findById: jest.fn() }));
jest.mock('../booking-handovers/bookingHandover.model', () => ({ findOne: jest.fn() }));
jest.mock('../staff-profiles/staffProfile.model', () => ({ findOne: jest.fn() }));
jest.mock('./customerCase.model', () => ({ find: jest.fn(), exists: jest.fn(), create: jest.fn() }));
jest.mock('./customerCaseTechnicalAssessment.model', () => ({
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
}));
jest.mock('./customerCaseResolution.model', () => ({
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
}));
jest.mock('./customerCaseRefund.model', () => ({
    aggregate: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
}));
jest.mock('./customerCase.service', () => ({
    getCaseDocument: jest.fn(),
    getCaseDetail: jest.fn(),
    assertStaffGarageAccess: jest.fn(),
    assertAssignedHandler: jest.fn(),
    assertCaseOpen: jest.fn(),
    assertCustomerOwnsCase: jest.fn(),
    createEvent: jest.fn(),
    validateEvidenceUploads: jest.fn(),
    linkEvidenceUploads: jest.fn(),
    getSlaDeadlines: jest.fn(),
    buildCaseCode: jest.fn(),
    buildBookingSnapshot: jest.fn(),
}));
jest.mock('./customerCaseNotification.service', () => ({
    findGarageCustomerServiceUserIds: jest.fn().mockResolvedValue([]),
    findAdminUserIds: jest.fn().mockResolvedValue([]),
    notifyUsers: jest.fn(),
    notifyCustomerCaseUpdate: jest.fn(),
    notifyCaseSubmitted: jest.fn(),
}));
jest.mock('../customer-vouchers/customerVoucher.service', () => ({ issueCompensationVoucher: jest.fn() }));
jest.mock('../bookings/booking.service', () => ({ createReworkBooking: jest.fn() }));
jest.mock('../auth/services/phoneVerification.service', () => ({
    requestVerification: jest.fn(), verifyOtp: jest.fn(), getVerifiedChallenge: jest.fn(), consumeVerifiedChallenge: jest.fn(),
}));
jest.mock('../audit-logs/auditLog.service', () => ({ recordAuditEvent: jest.fn() }));

const Booking = require('../bookings/booking.model');
const StaffProfile = require('../staff-profiles/staffProfile.model');
const CustomerCase = require('./customerCase.model');
const CustomerCaseTechnicalAssessment = require('./customerCaseTechnicalAssessment.model');
const CustomerCaseResolution = require('./customerCaseResolution.model');
const CustomerCaseRefund = require('./customerCaseRefund.model');
const customerCaseService = require('./customerCase.service');
const stage2Service = require('./customerCaseStage2.service');

describe('customer case stage 2 service', () => {
    const caseId = '507f1f77bcf86cd799439011';
    const garageId = '507f1f77bcf86cd799439012';
    const userId = '507f1f77bcf86cd799439013';
    const profileId = '507f1f77bcf86cd799439014';
    const bookingId = '507f1f77bcf86cd799439015';
    const customerCase = {
        _id: caseId,
        case_code: 'CC-20260718-A1B2C3D4',
        garage_id: garageId,
        booking_id: bookingId,
        customer_id: '507f1f77bcf86cd799439016',
        category: 'VEHICLE_DAMAGE',
        status: 'INVESTIGATING',
    };
    const admin = { _id: userId, role: 'ADMIN' };
    const staffContext = { garage_id: garageId, is_admin: false };

    beforeEach(() => {
        jest.clearAllMocks();
        customerCaseService.getCaseDocument.mockResolvedValue(customerCase);
        customerCaseService.getCaseDetail.mockResolvedValue({ case: { id: caseId } });
    });

    it('requires a submitted technical assessment before proposing a technical resolution', async () => {
        CustomerCaseTechnicalAssessment.findOne.mockResolvedValue(null);

        await expect(stage2Service.proposeResolution(admin, caseId, {
            summary: 'Garage proposes a corrective resolution.',
            actions: [{ action_type: 'NO_COMPENSATION' }],
        })).rejects.toMatchObject({ errorCode: 'CUSTOMER_CASE_ASSESSMENT_REQUIRED' });
    });

    it('assigns only an active inspection profile in the same garage', async () => {
        const inspector = { _id: profileId, user_id: '507f1f77bcf86cd799439099' };
        const assessment = { _id: '507f1f77bcf86cd799439098' };
        StaffProfile.findOne.mockResolvedValue(inspector);
        CustomerCaseTechnicalAssessment.findOne.mockResolvedValue(null);
        CustomerCaseTechnicalAssessment.findOneAndUpdate.mockResolvedValue(assessment);

        await stage2Service.assignTechnicalAssessment(
            { _id: userId, role: 'STAFF' }, staffContext, caseId, { staff_profile_id: profileId }
        );

        expect(StaffProfile.findOne).toHaveBeenCalledWith(expect.objectContaining({
            _id: profileId,
            garage_id: garageId,
            staff_type: 'VEHICLE_INSPECTION_STAFF',
            is_active: true,
        }));
        expect(customerCaseService.createEvent).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'TECHNICAL_ASSESSMENT_ASSIGNED',
            visibleToCustomer: false,
        }));
    });

    it('does not create a refund ledger for an unpaid booking', async () => {
        const resolution = {
            _id: '507f1f77bcf86cd799439088',
            case_id: caseId,
            status: 'CUSTOMER_ACCEPTED',
            actions: [{ action_type: 'REFUND', amount: 100000, refund_method: 'BANK_TRANSFER' }],
            refund_ids: [], voucher_ids: [], rework_booking_ids: [],
            toObject: () => ({}),
            save: jest.fn(),
        };
        CustomerCaseResolution.findById.mockResolvedValue(resolution);
        Booking.findById.mockResolvedValue({ _id: bookingId, payment_status: 'UNPAID', final_price: 200000 });

        await expect(stage2Service.applyResolution(admin, caseId, resolution._id))
            .rejects.toMatchObject({ errorCode: 'CUSTOMER_CASE_REFUND_PAYMENT_REQUIRED' });
        expect(resolution.status).toBe('FAILED');
    });

    it('reuses a refund linked to the same resolution when application is retried', async () => {
        const refundId = '507f1f77bcf86cd799439077';
        const resolution = {
            _id: '507f1f77bcf86cd799439088',
            case_id: caseId,
            status: 'FAILED',
            actions: [{ action_type: 'REFUND', amount: 100000, refund_method: 'BANK_TRANSFER' }],
            refund_ids: [], voucher_ids: [], rework_booking_ids: [],
            toObject: () => ({}),
            save: jest.fn(),
        };
        CustomerCaseResolution.findById.mockResolvedValue(resolution);
        Booking.findById.mockResolvedValue({ _id: bookingId, payment_status: 'PAID', final_price: 200000 });
        CustomerCaseRefund.findOne.mockResolvedValue({ _id: refundId });

        await stage2Service.applyResolution(admin, caseId, resolution._id);

        expect(CustomerCaseRefund.create).not.toHaveBeenCalled();
        expect(resolution.refund_ids).toEqual([refundId]);
        expect(resolution.status).toBe('APPLIED');
    });

    it('builds a garage-scoped SLA dashboard for staff', async () => {
        const query = {
            sort: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue([{
                _id: caseId,
                case_code: customerCase.case_code,
                garage_id: garageId,
                status: 'SUBMITTED',
                priority: 'HIGH',
                priority_rank: 2,
                acknowledged_at: null,
                first_response_due_at: new Date(Date.now() - 1000),
                resolution_due_at: new Date(Date.now() + 100000),
                escalation_level: 0,
            }]),
        };
        CustomerCase.find.mockReturnValue(query);

        const result = await stage2Service.getSlaDashboard(staffContext, { limit: 50 });

        expect(CustomerCase.find).toHaveBeenCalledWith({ garage_id: garageId });
        expect(result.summary.by_sla_state.FIRST_RESPONSE_OVERDUE).toBe(1);
    });

    it('automatically stamps and records an overdue SLA escalation', async () => {
        const dueCase = {
            ...customerCase,
            priority: 'HIGH',
            acknowledged_at: null,
            first_response_due_at: new Date(Date.now() - 60000),
            resolution_due_at: new Date(Date.now() + 60000),
            escalation_level: 0,
            first_response_breached_at: null,
            resolution_breached_at: null,
            save: jest.fn(),
        };
        CustomerCase.find
            .mockReturnValueOnce({ limit: jest.fn().mockResolvedValue([]) })
            .mockReturnValueOnce({
                sort: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([dueCase]),
            });

        const result = await stage2Service.processDueSlaEscalations({ limit: 10 });

        expect(result).toEqual({ processed: 1, escalated: 1 });
        expect(dueCase.first_response_breached_at).toBeInstanceOf(Date);
        expect(customerCaseService.createEvent).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'SLA_ESCALATED',
            visibleToCustomer: false,
        }));
    });
});
