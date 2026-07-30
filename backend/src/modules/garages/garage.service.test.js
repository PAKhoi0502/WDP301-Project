jest.mock('./garage.model', () => ({
    findById: jest.fn(),
    deleteOne: jest.fn(),
}));

jest.mock('./garage.dependencies', () => ({
    findGarageDependencies: jest.fn(),
}));

jest.mock('../reviews/reviewSummary.service', () => ({
    getGarageSummary: jest.fn(),
    getGarageSummaryMap: jest.fn(),
}));

const Garage = require('./garage.model');
const { findGarageDependencies } = require('./garage.dependencies');
const garageService = require('./garage.service');

describe('garage deletion', () => {
    const garageId = '507f1f77bcf86cd799439011';

    const buildGarage = (overrides = {}) => ({
        _id: garageId,
        name: 'Garage A',
        garage_code: 'GAR001',
        address: '123 Nguyen Hue Street',
        is_active: false,
        ...overrides,
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('requires the garage to be inactive before deletion', async () => {
        Garage.findById.mockResolvedValue(buildGarage({ is_active: true }));

        await expect(garageService.deleteGarage(garageId)).rejects.toMatchObject({
            statusCode: 409,
            errorCode: 'GARAGE_MUST_BE_INACTIVE',
        });
        expect(findGarageDependencies).not.toHaveBeenCalled();
        expect(Garage.deleteOne).not.toHaveBeenCalled();
    });

    it('preserves a garage that still has operational data', async () => {
        Garage.findById.mockResolvedValue(buildGarage());
        findGarageDependencies.mockResolvedValue([
            { key: 'bookings', label: 'booking history' },
            { key: 'wash_bays', label: 'wash bays' },
        ]);

        await expect(garageService.deleteGarage(garageId)).rejects.toMatchObject({
            statusCode: 409,
            errorCode: 'GARAGE_HAS_DEPENDENCIES',
            errors: [
                { path: 'bookings', message: 'booking history' },
                { path: 'wash_bays', message: 'wash bays' },
            ],
        });
        expect(Garage.deleteOne).not.toHaveBeenCalled();
    });

    it('deletes an unused inactive garage', async () => {
        Garage.findById.mockResolvedValue(buildGarage());
        findGarageDependencies.mockResolvedValue([]);
        Garage.deleteOne.mockResolvedValue({ deletedCount: 1 });

        await expect(garageService.deleteGarage(garageId)).resolves.toMatchObject({
            id: garageId,
            name: 'Garage A',
            is_active: false,
        });
        expect(Garage.deleteOne).toHaveBeenCalledWith({
            _id: garageId,
            is_active: false,
        });
    });

    it('rejects deletion when the garage becomes active concurrently', async () => {
        Garage.findById.mockResolvedValue(buildGarage());
        findGarageDependencies.mockResolvedValue([]);
        Garage.deleteOne.mockResolvedValue({ deletedCount: 0 });

        await expect(garageService.deleteGarage(garageId)).rejects.toMatchObject({
            statusCode: 409,
            errorCode: 'GARAGE_DELETE_CONFLICT',
        });
    });
});
