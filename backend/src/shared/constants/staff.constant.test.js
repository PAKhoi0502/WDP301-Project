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

    it.each(Object.values(STAFF_TYPES))(
        'allows %s to read the shared garage workflow',
        (staffType) => {
            expect(staffTypeHasCapability(
                staffType,
                STAFF_CAPABILITIES.BOOKING_WORKFLOW_READ_GARAGE
            )).toBe(true);
        }
    );

    it('limits handover and customer case management to customer service staff', () => {
        expect(staffTypeHasCapability(
            STAFF_TYPES.CUSTOMER_SERVICE_STAFF,
            STAFF_CAPABILITIES.CUSTOMER_CASE_ACKNOWLEDGE
        )).toBe(true);
        expect(staffTypeHasCapability(
            STAFF_TYPES.WASH_OPERATOR,
            STAFF_CAPABILITIES.CUSTOMER_CASE_ACKNOWLEDGE
        )).toBe(false);
        expect(staffTypeHasCapability(
            STAFF_TYPES.VEHICLE_INSPECTION_STAFF,
            STAFF_CAPABILITIES.BOOKING_HANDOVER_MANAGE_GARAGE
        )).toBe(false);
    });

    it('separates walk-in/SLA handling from assigned technical assessment', () => {
        expect(staffTypeHasCapability(
            STAFF_TYPES.CUSTOMER_SERVICE_STAFF,
            STAFF_CAPABILITIES.CUSTOMER_CASE_CREATE_WALK_IN
        )).toBe(true);
        expect(staffTypeHasCapability(
            STAFF_TYPES.VEHICLE_INSPECTION_STAFF,
            STAFF_CAPABILITIES.CUSTOMER_CASE_CREATE_WALK_IN
        )).toBe(false);
        expect(staffTypeHasCapability(
            STAFF_TYPES.VEHICLE_INSPECTION_STAFF,
            STAFF_CAPABILITIES.CUSTOMER_CASE_TECHNICAL_ASSESS_ASSIGNED
        )).toBe(true);
        expect(staffTypeHasCapability(
            STAFF_TYPES.VEHICLE_INSPECTION_STAFF,
            STAFF_CAPABILITIES.CUSTOMER_CASE_READ_GARAGE
        )).toBe(false);
    });
});
