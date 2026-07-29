const StaffProfile = require('./staffProfile.model');
const staffProfileService = require('./staffProfile.service');
const User = require('../users/user.model');

describe('staff profiles module', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should load staff profile module', () => {
        expect(true).toBe(true);
    });

    it('searches populated staff users before paginating profiles', async () => {
        const matchingUserId = '64b7f607f1f2c84c0c9a1001';
        const query = {
            populate: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue([]),
        };

        jest.spyOn(User, 'distinct').mockResolvedValue([matchingUserId]);
        jest.spyOn(StaffProfile, 'find').mockReturnValue(query);
        jest.spyOn(StaffProfile, 'countDocuments').mockResolvedValue(0);

        const result = await staffProfileService.getAllStaffProfiles({
            page: 2,
            limit: 20,
            search: 'Lan',
        });

        expect(User.distinct).toHaveBeenCalledWith('_id', {
            role: 'STAFF',
            $or: [
                { full_name: { $regex: 'Lan', $options: 'i' } },
                { email: { $regex: 'Lan', $options: 'i' } },
                { phone: { $regex: 'Lan', $options: 'i' } },
            ],
        });
        expect(StaffProfile.find).toHaveBeenCalledWith({
            $or: [
                { staff_code: { $regex: 'Lan', $options: 'i' } },
                { user_id: { $in: [matchingUserId] } },
            ],
        });
        expect(query.skip).toHaveBeenCalledWith(20);
        expect(query.limit).toHaveBeenCalledWith(20);
        expect(result.meta).toEqual({
            page: 2,
            limit: 20,
            total: 0,
            total_pages: 0,
        });
    });
});
