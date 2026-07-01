const {
    createStaffProfileSchema,
    updateStaffEmploymentStatusSchema,
    updateStaffProfileSchema,
} = require('./staffProfile.validator');

describe('staff profile status validation', () => {
    const staffProfileId = '665f1b7b2a5f9d0012a22222';

    it('does not allow status changes through the general update API', () => {
        const result = updateStaffProfileSchema.safeParse({
            params: { id: staffProfileId },
            body: { is_active: true },
        });

        expect(result.success).toBe(false);
    });

    it('does not allow the legacy create API to choose active status', () => {
        const result = createStaffProfileSchema.safeParse({
            body: {
                user_id: '665f1b7b2a5f9d0012a12345',
                staff_code: 'STF200',
                staff_type: 'CUSTOMER_SERVICE_STAFF',
                garage_id: '665f1b7b2a5f9d0012a33333',
                is_active: false,
            },
        });

        expect(result.success).toBe(false);
    });

    it('allows employment status changes through the dedicated API', () => {
        const result = updateStaffEmploymentStatusSchema.safeParse({
            params: { id: staffProfileId },
            body: {
                status: 'TERMINATED',
                reason: 'Nhan vien nghi viec',
            },
        });

        expect(result.success).toBe(true);
    });

    it('does not allow invalid employment status values', () => {
        const result = updateStaffEmploymentStatusSchema.safeParse({
            params: { id: staffProfileId },
            body: {
                status: 'DELETED',
            },
        });

        expect(result.success).toBe(false);
    });
});
