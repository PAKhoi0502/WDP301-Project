const mongoose = require('mongoose');

const {
    findGarageDependencies,
    garageDependencyRules,
} = require('./garage.dependencies');

describe('garage dependency checks', () => {
    beforeEach(() => {
        for (const rule of garageDependencyRules) {
            jest.spyOn(rule.model, 'exists').mockResolvedValue(null);
        }
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('returns every related data group found for the garage', async () => {
        const garageId = new mongoose.Types.ObjectId();
        const washBayRule = garageDependencyRules.find(
            (rule) => rule.key === 'wash_bays'
        );
        const bookingRule = garageDependencyRules.find(
            (rule) => rule.key === 'bookings'
        );

        washBayRule.model.exists.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });
        bookingRule.model.exists.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });

        await expect(findGarageDependencies(garageId)).resolves.toEqual([
            { key: 'wash_bays', label: 'wash bays' },
            { key: 'bookings', label: 'booking history' },
        ]);
        expect(washBayRule.model.exists).toHaveBeenCalledWith({
            garage_id: garageId,
        });
        expect(bookingRule.model.exists).toHaveBeenCalledWith({
            garage_id: garageId,
        });
    });

    it('checks both source and destination garage on staff type changes', async () => {
        const garageId = new mongoose.Types.ObjectId();
        const rule = garageDependencyRules.find(
            (item) => item.key === 'staff_type_changes'
        );

        await findGarageDependencies(garageId);

        expect(rule.model.exists).toHaveBeenCalledWith({
            $or: [
                { from_garage_id: garageId },
                { to_garage_id: garageId },
            ],
        });
    });
});
