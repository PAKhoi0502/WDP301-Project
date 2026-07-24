const {
    createVehicleInspectionSchema,
} = require('./vehicleInspection.validator');

describe('vehicle inspection module', () => {
    const params = { id: '507f1f77bcf86cd799439001' };

    it('allows before-wash inspection without images', () => {
        const result = createVehicleInspectionSchema.safeParse({
            params,
            body: {
                type: 'BEFORE_WASH',
                images: [],
            },
        });

        expect(result.success).toBe(true);
    });

    it('requires image evidence for after-wash inspection', () => {
        const result = createVehicleInspectionSchema.safeParse({
            params,
            body: {
                type: 'AFTER_WASH',
                images: [],
            },
        });

        expect(result.success).toBe(false);
        expect(result.error.issues).toEqual(expect.arrayContaining([
            expect.objectContaining({
                path: ['body', 'images'],
                message: 'After-wash inspection requires at least one image',
            }),
        ]));
    });
});
