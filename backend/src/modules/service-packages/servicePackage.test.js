const ServicePackage = require('./servicePackage.model');

describe('service package module', () => {
    const createServicePackage = (overrides = {}) => new ServicePackage({
        name: 'Interior care',
        vehicle_type: 'CAR',
        service_type: 'ADDON',
        base_price: 250000,
        duration_minutes: 90,
        points_earned: 20,
        requires_wash_bay: false,
        ...overrides,
    });

    it('defaults care staff fields when service requires care staff', async () => {
        const servicePackage = createServicePackage({
            requires_care_staff: true,
        });

        await expect(servicePackage.validate()).resolves.toBeUndefined();

        expect(servicePackage.care_staff_type).toBe('VEHICLE_CARE_STAFF');
        expect(servicePackage.care_staff_required_count).toBe(1);
        expect(servicePackage.care_staff_duration_minutes).toBe(90);
    });

    it('clears care staff fields when service does not require care staff', async () => {
        const servicePackage = createServicePackage({
            requires_care_staff: false,
            care_staff_type: 'VEHICLE_CARE_STAFF',
            care_staff_required_count: 1,
            care_staff_duration_minutes: 60,
        });

        await expect(servicePackage.validate()).resolves.toBeUndefined();

        expect(servicePackage.care_staff_type).toBeNull();
        expect(servicePackage.care_staff_required_count).toBe(0);
        expect(servicePackage.care_staff_duration_minutes).toBe(0);
    });

    it('rejects care staff duration greater than total duration', async () => {
        const servicePackage = createServicePackage({
            requires_care_staff: true,
            care_staff_duration_minutes: 120,
        });

        await expect(servicePackage.validate()).rejects.toMatchObject({
            errors: {
                care_staff_duration_minutes: expect.anything(),
            },
        });
    });
});
