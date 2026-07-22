const StaffTypeChangeRequest = require('./staffTypeChange.model');
const {
    createMyStaffTypeChangeRequestSchema,
    createAdminStaffTypeChangeRequestSchema,
    approveStaffTypeChangeRequestSchema,
} = require('./staffTypeChange.validator');

describe('staff type change workflow', () => {
    const staffProfileId = '507f1f77bcf86cd799439011';
    const userId = '507f1f77bcf86cd799439012';

    it('accepts a request to move to a different staff type', () => {
        const result = createMyStaffTypeChangeRequestSchema.safeParse({
            body: {
                to_staff_type: 'WASH_OPERATOR',
                reason: 'Muon chuyen sang van hanh khu rua',
                effective_at: '2027-01-01T08:00:00.000Z',
            },
        });

        expect(result.success).toBe(true);
        expect(result.data.body.effective_at).toBeInstanceOf(Date);
    });

    it('requires a reason for emergency override', () => {
        const result = approveStaffTypeChangeRequestSchema.safeParse({
            params: { requestId: staffProfileId },
            body: { emergency_override: true },
        });

        expect(result.success).toBe(false);
    });

    it('accepts an admin-directed request bound to a staff profile', () => {
        const result = createAdminStaffTypeChangeRequestSchema.safeParse({
            params: { id: staffProfileId },
            body: {
                to_staff_type: 'VEHICLE_INSPECTION_STAFF',
                reason: 'Operational reassignment requested by management',
                handover_note: 'Complete assigned wash work before transfer',
            },
        });

        expect(result.success).toBe(true);
    });

    it('rejects a model whose source and target types are equal', async () => {
        const request = new StaffTypeChangeRequest({
            staff_profile_id: staffProfileId,
            from_staff_type: 'VEHICLE_CARE_STAFF',
            to_staff_type: 'VEHICLE_CARE_STAFF',
            reason: 'No actual position change',
            effective_at: new Date(),
            requested_by: userId,
        });

        await expect(request.validate()).rejects.toMatchObject({
            errors: expect.objectContaining({
                to_staff_type: expect.anything(),
            }),
        });
    });

    it('defaults legacy-compatible requests to staff self-request source', async () => {
        const request = new StaffTypeChangeRequest({
            staff_profile_id: staffProfileId,
            from_staff_type: 'VEHICLE_CARE_STAFF',
            to_staff_type: 'WASH_OPERATOR',
            reason: 'Move to wash operations',
            effective_at: new Date(),
            requested_by: userId,
        });

        await request.validate();

        expect(request.request_source).toBe('STAFF_SELF_REQUEST');
        expect(request.requested_by_role).toBe('STAFF');
    });
});
