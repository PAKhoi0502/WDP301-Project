const mongoose = require('mongoose');

jest.mock('./staffProfile.model', () => ({
    findById: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn(),
}));
jest.mock('./staffTypeChange.model', () => ({
    exists: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
}));
jest.mock('../bookings/booking.model', () => ({
    countDocuments: jest.fn(),
}));
jest.mock('../users/user.model', () => ({
    find: jest.fn(),
}));
jest.mock('../auth/services/token.service', () => ({
    revokeAllByUser: jest.fn(),
}));
jest.mock('../audit-logs/auditLog.service', () => ({
    recordAuditEvent: jest.fn(),
}));
jest.mock('../notifications/notification.service', () => ({
    createInAppNotification: jest.fn(),
}));

const StaffProfile = require('./staffProfile.model');
const StaffTypeChangeRequest = require('./staffTypeChange.model');
const Booking = require('../bookings/booking.model');
const User = require('../users/user.model');
const auditLogService = require('../audit-logs/auditLog.service');
const notificationService = require('../notifications/notification.service');
const service = require('./staffTypeChange.service');

const createSession = () => ({
    withTransaction: jest.fn(async (callback) => callback()),
    endSession: jest.fn().mockResolvedValue(undefined),
});

const createSessionQuery = (value) => ({
    session: jest.fn().mockResolvedValue(value),
});

const createPopulateQuery = (value) => {
    const query = {
        populate: jest.fn(),
        then(resolve, reject) {
            return Promise.resolve(value).then(resolve, reject);
        },
    };
    query.populate.mockReturnValue(query);
    return query;
};

describe('staff type change request initiation', () => {
    const staffProfileId = new mongoose.Types.ObjectId();
    const staffUserId = new mongoose.Types.ObjectId();
    const adminId = new mongoose.Types.ObjectId();
    const requestId = new mongoose.Types.ObjectId();
    const garageId = new mongoose.Types.ObjectId();

    const profile = {
        _id: staffProfileId,
        user_id: staffUserId,
        garage_id: garageId,
        staff_type: 'VEHICLE_CARE_STAFF',
        employment_status: 'ACTIVE',
        is_active: true,
    };

    const setupCreate = (requestSource, requestedBy, requestedByRole) => {
        const session = createSession();
        const request = {
            _id: requestId,
            staff_profile_id: staffProfileId,
            from_staff_type: profile.staff_type,
            to_staff_type: 'WASH_OPERATOR',
            from_garage_id: garageId,
            to_garage_id: garageId,
            reason: 'Operational position change',
            effective_at: new Date('2026-07-30T03:00:00.000Z'),
            requested_by: requestedBy,
            request_source: requestSource,
            requested_by_role: requestedByRole,
            handover_note: null,
            status: 'REQUESTED',
        };

        jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
        StaffTypeChangeRequest.exists.mockReturnValue(createSessionQuery(null));
        StaffTypeChangeRequest.create.mockResolvedValue([request]);
        StaffTypeChangeRequest.findById.mockReturnValue(createPopulateQuery(request));
        auditLogService.recordAuditEvent.mockResolvedValue(null);
        notificationService.createInAppNotification.mockResolvedValue(null);

        return { request, session };
    };

    beforeEach(() => {
        jest.resetAllMocks();
        Booking.countDocuments.mockResolvedValue(0);
        StaffProfile.countDocuments.mockResolvedValue(1);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('lets admin initiate a request without bypassing REQUESTED state', async () => {
        const { session } = setupCreate('ADMIN_DIRECTED', adminId, 'ADMIN');
        StaffProfile.findById
            .mockReturnValueOnce(Promise.resolve(profile))
            .mockReturnValueOnce({ select: jest.fn().mockResolvedValue({ user_id: staffUserId }) });

        const result = await service.createAdminStaffTypeChangeRequest(
            staffProfileId,
            adminId,
            {
                to_staff_type: 'WASH_OPERATOR',
                reason: 'Operational position change',
                effective_at: new Date('2026-07-30T03:00:00.000Z'),
            },
            {}
        );

        expect(result).toMatchObject({
            status: 'REQUESTED',
            request_source: 'ADMIN_DIRECTED',
            requested_by_role: 'ADMIN',
        });
        expect(StaffTypeChangeRequest.create).toHaveBeenCalledWith([
            expect.objectContaining({
                staff_profile_id: staffProfileId,
                requested_by: adminId,
                request_source: 'ADMIN_DIRECTED',
                requested_by_role: 'ADMIN',
                status: 'REQUESTED',
                impact_snapshot: expect.objectContaining({
                    active_assignment_count: 0,
                    future_assignment_count: 0,
                }),
            }),
        ], { session });
        expect(auditLogService.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
            action: 'STAFF_TYPE_CHANGE_REQUESTED',
            actorId: adminId,
            session,
            metadata: expect.objectContaining({
                request_source: 'ADMIN_DIRECTED',
                requested_by_role: 'ADMIN',
            }),
        }));
        expect(notificationService.createInAppNotification).toHaveBeenCalledWith(expect.objectContaining({
            userId: staffUserId,
            type: 'STAFF_TYPE_CHANGE_REQUESTED',
            relatedId: requestId,
        }));
    });

    it('requires a handover plan when admin initiates a transfer with assignments', async () => {
        StaffProfile.findById.mockResolvedValueOnce(profile);
        Booking.countDocuments
            .mockResolvedValueOnce(1)
            .mockResolvedValueOnce(2);

        await expect(service.createAdminStaffTypeChangeRequest(
            staffProfileId,
            adminId,
            {
                to_staff_type: 'WASH_OPERATOR',
                reason: 'Operational position change',
            },
            {}
        )).rejects.toMatchObject({
            statusCode: 400,
            errorCode: 'STAFF_TYPE_CHANGE_HANDOVER_REQUIRED',
        });

        expect(StaffTypeChangeRequest.create).not.toHaveBeenCalled();
    });

    it('notifies active admins when staff submits a self-request', async () => {
        setupCreate('STAFF_SELF_REQUEST', staffUserId, 'STAFF');
        StaffProfile.findOne.mockResolvedValue(profile);
        const firstAdminId = new mongoose.Types.ObjectId();
        const secondAdminId = new mongoose.Types.ObjectId();
        User.find.mockReturnValue({
            select: jest.fn().mockResolvedValue([
                { _id: firstAdminId },
                { _id: secondAdminId },
            ]),
        });

        const result = await service.createMyStaffTypeChangeRequest(
            staffUserId,
            {
                to_staff_type: 'WASH_OPERATOR',
                reason: 'Request a move to wash operations',
            },
            {}
        );

        expect(result.request_source).toBe('STAFF_SELF_REQUEST');
        expect(User.find).toHaveBeenCalledWith({ role: 'ADMIN', is_active: true });
        expect(notificationService.createInAppNotification).toHaveBeenCalledTimes(2);
        expect(notificationService.createInAppNotification).toHaveBeenCalledWith(expect.objectContaining({
            userId: firstAdminId,
            type: 'STAFF_TYPE_CHANGE_REQUESTED',
        }));
    });

    it('does not let staff cancel an admin-directed request', async () => {
        const request = {
            _id: requestId,
            staff_profile_id: staffProfileId,
            status: 'REQUESTED',
            request_source: 'ADMIN_DIRECTED',
            save: jest.fn(),
        };
        StaffTypeChangeRequest.findById.mockResolvedValueOnce(request);
        StaffProfile.findById.mockResolvedValueOnce(profile);

        await expect(service.cancelStaffTypeChangeRequest(
            requestId,
            { _id: staffUserId, role: 'STAFF' },
            null,
            {}
        )).rejects.toMatchObject({
            statusCode: 403,
            errorCode: 'STAFF_TYPE_CHANGE_CANCEL_FORBIDDEN',
        });

        expect(request.save).not.toHaveBeenCalled();
    });

    it('requires an audit reason when admin cancels an open request', async () => {
        const request = {
            _id: requestId,
            staff_profile_id: staffProfileId,
            status: 'REQUESTED',
            request_source: 'STAFF_SELF_REQUEST',
            save: jest.fn(),
        };
        StaffTypeChangeRequest.findById.mockResolvedValueOnce(request);
        StaffProfile.findById.mockResolvedValueOnce(profile);

        await expect(service.cancelStaffTypeChangeRequest(
            requestId,
            { _id: adminId, role: 'ADMIN' },
            null,
            {}
        )).rejects.toMatchObject({
            statusCode: 400,
            errorCode: 'STAFF_TYPE_CHANGE_CANCEL_REASON_REQUIRED',
        });

        expect(request.save).not.toHaveBeenCalled();
    });
});
