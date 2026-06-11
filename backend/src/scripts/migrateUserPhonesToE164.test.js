jest.mock('../modules/users/user.model', () => ({}));

const {
    buildMigrationPlan,
} = require('./migrateUserPhonesToE164');

describe('migrate user phones to E.164', () => {
    it('builds updates only for non-canonical phones', () => {
        const updates = buildMigrationPlan([
            {
                _id: {
                    toString: () => 'user-1',
                },
                phone: '0901234567',
            },
            {
                _id: {
                    toString: () => 'user-2',
                },
                phone: '+84987654321',
            },
        ]);

        expect(updates).toEqual([
            {
                updateOne: {
                    filter: {
                        _id: expect.any(Object),
                        phone: '0901234567',
                    },
                    update: {
                        $set: {
                            phone: '+84901234567',
                        },
                    },
                },
            },
        ]);
    });

    it('rejects collisions after normalization', () => {
        expect(() => buildMigrationPlan([
            {
                _id: {
                    toString: () => 'user-1',
                },
                phone: '0901234567',
            },
            {
                _id: {
                    toString: () => 'user-2',
                },
                phone: '+84901234567',
            },
        ])).toThrow('Phone collision after normalization');
    });
});
