jest.mock('mongoose', () => ({
    startSession: jest.fn(),
}));

jest.mock('../config/db', () => ({
    connectDB: jest.fn(),
    disconnectDB: jest.fn(),
}));

jest.mock('../modules/users/user.model', () => ({
    countDocuments: jest.fn(),
    updateMany: jest.fn(),
}));

const mongoose = require('mongoose');
const User = require('../modules/users/user.model');
const {
    LEGACY_USER_FILTER,
    LEGACY_STAFF_FILTER,
    buildLegacyStaffUpdate,
    migrateLegacyUserOnboarding,
} = require('./migrateLegacyUserOnboarding');

describe('migrate legacy user onboarding', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('reports affected users without writing in dry-run mode', async () => {
        User.countDocuments
            .mockResolvedValueOnce(12)
            .mockResolvedValueOnce(10);

        const result = await migrateLegacyUserOnboarding({ dryRun: true });

        expect(User.countDocuments).toHaveBeenNthCalledWith(1, LEGACY_USER_FILTER);
        expect(User.countDocuments).toHaveBeenNthCalledWith(2, LEGACY_STAFF_FILTER);
        expect(User.updateMany).not.toHaveBeenCalled();
        expect(mongoose.startSession).not.toHaveBeenCalled();
        expect(result).toEqual({
            dry_run: true,
            legacy_users_found: 12,
            legacy_staff_found: 10,
            legacy_non_staff_found: 2,
            staff_updated: 0,
            non_staff_updated: 0,
        });
    });

    it('backfills legacy staff before remaining legacy users', async () => {
        const session = {
            withTransaction: jest.fn(async (work) => work()),
            endSession: jest.fn(),
        };

        User.countDocuments
            .mockResolvedValueOnce(12)
            .mockResolvedValueOnce(10);
        User.updateMany
            .mockResolvedValueOnce({ modifiedCount: 10 })
            .mockResolvedValueOnce({ modifiedCount: 2 });
        mongoose.startSession.mockResolvedValue(session);

        const result = await migrateLegacyUserOnboarding();

        expect(User.updateMany).toHaveBeenNthCalledWith(
            1,
            LEGACY_STAFF_FILTER,
            buildLegacyStaffUpdate(),
            { session }
        );
        expect(User.updateMany).toHaveBeenNthCalledWith(
            2,
            LEGACY_USER_FILTER,
            {
                $set: {
                    onboarding_status: 'ACTIVE',
                },
            },
            { session }
        );
        expect(session.endSession).toHaveBeenCalled();
        expect(result.staff_updated).toBe(10);
        expect(result.non_staff_updated).toBe(2);
    });

    it('is a no-op when no legacy users remain', async () => {
        User.countDocuments.mockResolvedValue(0);

        const result = await migrateLegacyUserOnboarding();

        expect(User.updateMany).not.toHaveBeenCalled();
        expect(mongoose.startSession).not.toHaveBeenCalled();
        expect(result.legacy_users_found).toBe(0);
    });
});
