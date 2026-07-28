jest.mock('./washBay.model', () => ({
    find: jest.fn(),
}));

jest.mock('../garages/garage.model', () => ({
    findById: jest.fn(),
}));

const WashBay = require('./washBay.model');
const Garage = require('../garages/garage.model');
const washBayService = require('./washBay.service');
const { getStaffWashBaysSchema } = require('./washBay.validator');

const createFindQuery = (result) => {
    const sort = jest.fn().mockResolvedValue(result);
    const populate = jest.fn().mockReturnValue({ sort });
    return { populate, sort };
};

describe('wash bay module', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns every real wash bay in the assigned garage workspace', async () => {
        const garageId = '507f1f77bcf86cd799439011';
        const washBays = [
            {
                _id: '507f1f77bcf86cd799439021',
                garage_id: garageId,
                name: 'Bay 01',
                bay_code: 'B01',
                vehicle_type: 'CAR',
                status: 'AVAILABLE',
                current_booking_id: null,
                is_active: true,
            },
            {
                _id: '507f1f77bcf86cd799439022',
                garage_id: garageId,
                name: 'Bay 02',
                bay_code: 'B02',
                vehicle_type: 'CAR',
                status: 'OCCUPIED',
                current_booking_id: '507f1f77bcf86cd799439031',
                is_active: true,
            },
        ];
        Garage.findById.mockResolvedValue({ _id: garageId, is_active: true });
        WashBay.find.mockReturnValue(createFindQuery(washBays));

        const result = await washBayService.getWashBaysForGarageWorkspace(garageId);

        expect(WashBay.find).toHaveBeenCalledWith({ garage_id: garageId });
        expect(result).toHaveLength(2);
        expect(result[1]).toMatchObject({
            id: '507f1f77bcf86cd799439022',
            status: 'OCCUPIED',
            current_booking_id: '507f1f77bcf86cd799439031',
        });
    });

    it('rejects a workspace request without a garage assignment', async () => {
        await expect(
            washBayService.getWashBaysForGarageWorkspace()
        ).rejects.toMatchObject({
            statusCode: 403,
            errorCode: 'STAFF_GARAGE_REQUIRED',
        });

        expect(Garage.findById).not.toHaveBeenCalled();
        expect(WashBay.find).not.toHaveBeenCalled();
    });

    it('rejects caller-supplied staff workspace filters', () => {
        const result = getStaffWashBaysSchema.safeParse({
            query: {
                garage_id: '507f1f77bcf86cd799439099',
            },
        });

        expect(result.success).toBe(false);
    });
});
