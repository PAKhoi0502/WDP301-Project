jest.mock('./review.model', () => ({
    aggregate: jest.fn(),
}));

const Review = require('./review.model');
const ReviewSummaryService = require('./reviewSummary.service');

describe('review summary service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('calculates a rounded garage average and complete distribution', async () => {
        const garageId = '507f1f77bcf86cd799439011';

        Review.aggregate.mockResolvedValue([
            {
                _id: {
                    toString: () => garageId,
                },
                rating_count: 5,
                weighted_total: 23,
                distribution_rows: [
                    { rating: 4, count: 2 },
                    { rating: 5, count: 3 },
                ],
            },
        ]);

        const result = await ReviewSummaryService.getGarageSummary(garageId);

        expect(result).toEqual({
            rating_average: 4.6,
            rating_count: 5,
            distribution: {
                1: 0,
                2: 0,
                3: 0,
                4: 2,
                5: 3,
            },
        });
    });

    it('returns an empty summary when no public reviews exist', async () => {
        Review.aggregate.mockResolvedValue([]);

        const result = await ReviewSummaryService.getServicePackageSummary(
            '507f1f77bcf86cd799439012'
        );

        expect(result).toEqual({
            rating_average: 0,
            rating_count: 0,
            distribution: {
                1: 0,
                2: 0,
                3: 0,
                4: 0,
                5: 0,
            },
        });
    });
});
