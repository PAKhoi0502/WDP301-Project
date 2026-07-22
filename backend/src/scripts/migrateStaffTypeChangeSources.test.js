const {
    LEGACY_REQUEST_FILTER,
    buildMigrationPipeline,
} = require('./migrateStaffTypeChangeSources');

describe('staff type change source migration', () => {
    it('selects records missing either canonical source field', () => {
        expect(LEGACY_REQUEST_FILTER).toEqual({
            $or: [
                { request_source: { $exists: false } },
                { requested_by_role: { $exists: false } },
            ],
        });
    });

    it('backfills legacy requests without overwriting existing values', () => {
        expect(buildMigrationPipeline()).toEqual([
            {
                $set: {
                    request_source: {
                        $ifNull: ['$request_source', 'STAFF_SELF_REQUEST'],
                    },
                    requested_by_role: {
                        $ifNull: [
                            '$requested_by_role',
                            {
                                $cond: [
                                    { $eq: ['$request_source', 'ADMIN_DIRECTED'] },
                                    'ADMIN',
                                    'STAFF',
                                ],
                            },
                        ],
                    },
                },
            },
        ]);
    });
});
