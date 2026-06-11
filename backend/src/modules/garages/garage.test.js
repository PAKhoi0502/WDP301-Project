const Garage = require('./garage.model');
const {
    createGarageSchema,
    updateGarageSchema,
} = require('./garage.validator');

describe('garage module', () => {
    const garagePayload = {
        name: 'Garage A',
        garage_code: 'GAR001',
        address: '123 Nguyen Hue Street',
    };

    it('uses a fifteen-minute late grace period by default', () => {
        const result = createGarageSchema.parse({
            body: garagePayload,
        });

        expect(result.body.late_grace_minutes).toBe(15);
    });

    it('accepts a garage-specific late grace period', async () => {
        const garage = new Garage({
            ...garagePayload,
            late_grace_minutes: 20,
        });

        await expect(garage.validate()).resolves.toBeUndefined();
        expect(garage.late_grace_minutes).toBe(20);
    });

    it('rejects a negative late grace period', () => {
        const result = updateGarageSchema.safeParse({
            params: {
                id: '507f1f77bcf86cd799439011',
            },
            body: {
                late_grace_minutes: -1,
            },
        });

        expect(result.success).toBe(false);
    });
});
