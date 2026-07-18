const {
    STAFF_TYPES,
    STAFF_GROUPS,
    STAFF_CAPABILITIES,
    getStaffGroup,
    getStaffCapabilities,
    staffTypeHasCapability,
} = require('./staff.constant');

describe('staff authorization constants', () => {
    it('groups booking operations staff without merging their staff types', () => {
        expect(getStaffGroup(STAFF_TYPES.CUSTOMER_SERVICE_STAFF)).toBe(
            STAFF_GROUPS.BOOKING_OPERATIONS
        );
        expect(getStaffGroup(STAFF_TYPES.VEHICLE_INSPECTION_STAFF)).toBe(
            STAFF_GROUPS.BOOKING_OPERATIONS
        );
        expect(STAFF_TYPES.CUSTOMER_SERVICE_STAFF).not.toBe(
            STAFF_TYPES.VEHICLE_INSPECTION_STAFF
        );
    });

    it('groups wash and care staff in the shared service execution workspace', () => {
        expect(getStaffGroup(STAFF_TYPES.WASH_OPERATOR)).toBe(
            STAFF_GROUPS.SERVICE_EXECUTION
        );
        expect(getStaffGroup(STAFF_TYPES.VEHICLE_CARE_STAFF)).toBe(
            STAFF_GROUPS.SERVICE_EXECUTION
        );
    });

    it('keeps execution capabilities specific to the staff position', () => {
        expect(staffTypeHasCapability(
            STAFF_TYPES.WASH_OPERATOR,
            STAFF_CAPABILITIES.SERVICE_TASK_WASH_EXECUTE_ASSIGNED
        )).toBe(true);
        expect(staffTypeHasCapability(
            STAFF_TYPES.WASH_OPERATOR,
            STAFF_CAPABILITIES.SERVICE_TASK_CARE_EXECUTE_ASSIGNED
        )).toBe(false);
        expect(staffTypeHasCapability(
            STAFF_TYPES.VEHICLE_CARE_STAFF,
            STAFF_CAPABILITIES.SERVICE_TASK_CARE_EXECUTE_ASSIGNED
        )).toBe(true);
    });

    it('returns a copy of the capability list', () => {
        const capabilities = getStaffCapabilities(STAFF_TYPES.CUSTOMER_SERVICE_STAFF);

        capabilities.length = 0;

        expect(getStaffCapabilities(STAFF_TYPES.CUSTOMER_SERVICE_STAFF).length).toBeGreaterThan(0);
    });
});
