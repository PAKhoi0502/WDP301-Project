const StaffTypeChangeRequest = require('./staffTypeChange.model');
const {
    createMyStaffTypeChangeRequestSchema,
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
});
