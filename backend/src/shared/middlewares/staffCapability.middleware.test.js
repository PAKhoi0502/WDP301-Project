jest.mock('../../modules/staff-profiles/staffProfile.model', () => ({
    findOne: jest.fn(),
}));

const StaffProfile = require('../../modules/staff-profiles/staffProfile.model');
const { USER_ROLES } = require('../constants/roles.constant');
const {
    STAFF_TYPES,
    STAFF_GROUPS,
    STAFF_CAPABILITIES,
} = require('../constants/staff.constant');
const {
    attachStaffContext,
    requireStaffCapabilities,
    requireAnyStaffCapability,
} = require('./staffCapability.middleware');

describe('staff capability middleware', () => {
    const userId = '507f1f77bcf86cd799439011';
    const staffProfileId = '507f1f77bcf86cd799439012';
    const garageId = '507f1f77bcf86cd799439013';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const mockActiveProfile = (staffType) => {
        StaffProfile.findOne.mockResolvedValue({
            _id: staffProfileId,
            user_id: userId,
            staff_type: staffType,
            garage_id: garageId,
            is_active: true,
            employment_status: 'ACTIVE',
        });
    };

    it('attaches the derived workspace and capabilities', async () => {
        mockActiveProfile(STAFF_TYPES.WASH_OPERATOR);
        const req = {
            user: { _id: userId, role: USER_ROLES.STAFF },
        };
        const next = jest.fn();

        await attachStaffContext(req, {}, next);

        expect(next).toHaveBeenCalledWith();
        expect(req.staffContext).toEqual(expect.objectContaining({
            staff_type: STAFF_TYPES.WASH_OPERATOR,
            staff_group: STAFF_GROUPS.SERVICE_EXECUTION,
            garage_id: garageId,
            capabilities: expect.arrayContaining([
                STAFF_CAPABILITIES.SERVICE_TASK_WASH_EXECUTE_ASSIGNED,
            ]),
        }));
    });

    it('denies a wash operator from customer-service actions', async () => {
        mockActiveProfile(STAFF_TYPES.WASH_OPERATOR);
        const req = {
            user: { _id: userId, role: USER_ROLES.STAFF },
        };
        const next = jest.fn();

        await requireStaffCapabilities(
            STAFF_CAPABILITIES.BOOKING_CHECK_IN
        )(req, {}, next);

        expect(next).toHaveBeenCalledWith(expect.objectContaining({
            statusCode: 403,
            errorCode: 'STAFF_CAPABILITY_REQUIRED',
        }));
    });

    it('allows either of the shared execution capabilities', async () => {
        mockActiveProfile(STAFF_TYPES.VEHICLE_CARE_STAFF);
        const req = {
            user: { _id: userId, role: USER_ROLES.STAFF },
        };
        const next = jest.fn();

        await requireAnyStaffCapability(
            STAFF_CAPABILITIES.SERVICE_TASK_WASH_EXECUTE_ASSIGNED,
            STAFF_CAPABILITIES.SERVICE_TASK_CARE_EXECUTE_ASSIGNED
        )(req, {}, next);

        expect(next).toHaveBeenCalledWith();
    });

    it('lets admins bypass staff capability checks', async () => {
        const req = {
            user: { _id: userId, role: USER_ROLES.ADMIN },
        };
        const next = jest.fn();

        await requireStaffCapabilities(
            STAFF_CAPABILITIES.BOOKING_CHECK_IN
        )(req, {}, next);

        expect(next).toHaveBeenCalledWith();
        expect(StaffProfile.findOne).not.toHaveBeenCalled();
    });
});
