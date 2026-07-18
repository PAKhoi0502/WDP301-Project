jest.mock('./staffProfile.model', () => ({
    findById: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn(),
}));

jest.mock('./staffTypeChange.model', () => ({}));
jest.mock('../bookings/booking.model', () => ({
    countDocuments: jest.fn(),
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
const Booking = require('../bookings/booking.model');
const staffTypeChangeService = require('./staffTypeChange.service');

describe('staff type change impact', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('reports assignment blockers and capacity changes', async () => {
        StaffProfile.findById.mockResolvedValue({
            _id: '507f1f77bcf86cd799439011',
            user_id: '507f1f77bcf86cd799439012',
            garage_id: '507f1f77bcf86cd799439013',
            staff_type: 'VEHICLE_CARE_STAFF',
        });
        Booking.countDocuments
            .mockResolvedValueOnce(1)
            .mockResolvedValueOnce(2);
        StaffProfile.countDocuments
            .mockResolvedValueOnce(3)
            .mockResolvedValueOnce(2);

        const result = await staffTypeChangeService.getStaffTypeChangeImpact(
            '507f1f77bcf86cd799439011',
            { to_staff_type: 'WASH_OPERATOR' }
        );

        expect(result).toEqual(expect.objectContaining({
            active_assignment_count: 1,
            future_assignment_count: 2,
            can_apply_now: false,
            capacity: {
                source_before: 3,
                source_after: 2,
                target_before: 2,
                target_after: 3,
            },
        }));
        expect(result.blockers).toEqual(expect.arrayContaining([
            expect.objectContaining({ code: 'STAFF_HAS_ACTIVE_ASSIGNMENTS' }),
        ]));
        expect(result.warnings).toEqual(expect.arrayContaining([
            expect.objectContaining({ code: 'STAFF_HAS_FUTURE_ASSIGNMENTS' }),
        ]));
    });

    it('rejects an impact preview without an actual position change', async () => {
        StaffProfile.findById.mockResolvedValue({
            _id: '507f1f77bcf86cd799439011',
            user_id: '507f1f77bcf86cd799439012',
            garage_id: '507f1f77bcf86cd799439013',
            staff_type: 'VEHICLE_CARE_STAFF',
        });

        await expect(staffTypeChangeService.getStaffTypeChangeImpact(
            '507f1f77bcf86cd799439011',
            { to_staff_type: 'VEHICLE_CARE_STAFF' }
        )).rejects.toMatchObject({
            statusCode: 400,
            errorCode: 'STAFF_TYPE_CHANGE_NO_CHANGE',
        });
    });
});
