jest.mock('./feedbackRewardRule.model', () => ({
    findOneAndUpdate: jest.fn(),
}));

jest.mock('../loyalty/pointTransaction.model', () => ({
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    aggregate: jest.fn(),
    countDocuments: jest.fn(),
}));

jest.mock('../loyalty/customerLoyalty.model', () => ({
    findOne: jest.fn(),
}));

jest.mock('../loyalty/loyaltyRedeemRule.model', () => ({
    findOne: jest.fn(),
}));

jest.mock('../bookings/booking.model', () => ({
    findOne: jest.fn(),
}));

jest.mock('../wash-histories/washHistory.model', () => ({
    findOne: jest.fn(),
}));

jest.mock('../surveys/surveyResponse.model', () => ({
    findOne: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
}));

jest.mock('../surveys/survey.model', () => ({
    findOne: jest.fn(),
}));

jest.mock('../reviews/review.model', () => ({
    findOne: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
}));

jest.mock('../notifications/notification.model', () => ({
    find: jest.fn(),
    exists: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
}));

jest.mock('../loyalty/loyalty.service', () => ({
    getOrCreateCustomerLoyalty: jest.fn(),
    reviewCustomerTier: jest.fn(),
}));

jest.mock('../notifications/notification.service', () => ({
    emitFeedbackRewardEarned: jest.fn(),
    emitFeedbackReminder: jest.fn(),
}));

jest.mock('../audit-logs/auditLog.service', () => ({
    recordAuditEvent: jest.fn(),
}));

const FeedbackRewardRule = require('./feedbackRewardRule.model');
const PointTransaction = require('../loyalty/pointTransaction.model');
const LoyaltyRedeemRule = require('../loyalty/loyaltyRedeemRule.model');
const SurveyResponse = require('../surveys/surveyResponse.model');
const Review = require('../reviews/review.model');
const Notification = require('../notifications/notification.model');
const loyaltyService = require('../loyalty/loyalty.service');
const notificationService = require('../notifications/notification.service');
const feedbackRewardService = require('./feedbackReward.service');

const createQuery = (value) => {
    const query = {
        session: jest.fn(() => query),
        sort: jest.fn(() => query),
        limit: jest.fn(() => query),
        then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
    };

    return query;
};

describe('feedback reward service', () => {
    const customerId = '507f1f77bcf86cd799439001';
    const bookingId = '507f1f77bcf86cd799439002';
    const sourceId = '507f1f77bcf86cd799439003';
    const rule = {
        _id: '507f1f77bcf86cd799439004',
        rule_code: 'POST_SERVICE_FEEDBACK',
        survey_points: 50,
        review_points: 50,
        review_window_days: 30,
        reminder_after_hours: 48,
        count_toward_tier: false,
        is_active: true,
        starts_at: null,
        ends_at: null,
    };

    beforeEach(() => {
        jest.clearAllMocks();
        FeedbackRewardRule.findOneAndUpdate.mockReturnValue(createQuery(rule));
        PointTransaction.findOne.mockReturnValue(createQuery(null));
        loyaltyService.reviewCustomerTier.mockResolvedValue(null);
        notificationService.emitFeedbackRewardEarned.mockResolvedValue(null);
    });

    it('awards survey points without increasing tier qualifying points', async () => {
        const loyalty = {
            total_points: 100,
            qualifying_points: 100,
            bonus_points: 0,
            available_points: 40,
            save: jest.fn().mockResolvedValue(null),
        };
        const transaction = {
            _id: '507f1f77bcf86cd799439005',
            customer_id: customerId,
            booking_id: bookingId,
            source_id: sourceId,
            type: 'SURVEY_REWARD',
            points: 50,
            remaining_points: 50,
            balance_before: 40,
            balance_after: 90,
            earned_at: new Date(),
        };

        loyaltyService.getOrCreateCustomerLoyalty.mockResolvedValue(loyalty);
        PointTransaction.create.mockResolvedValue([transaction]);

        const result = await feedbackRewardService.awardFeedbackReward({
            customerId,
            bookingId,
            source: 'SURVEY',
            sourceId,
        });

        expect(result).toMatchObject({
            awarded: true,
            already_processed: false,
            points: 50,
        });
        expect(loyalty).toMatchObject({
            total_points: 150,
            qualifying_points: 100,
            bonus_points: 50,
            available_points: 90,
        });
        expect(PointTransaction.create).toHaveBeenCalledWith(
            [
                expect.objectContaining({
                    type: 'SURVEY_REWARD',
                    points: 50,
                    counts_toward_tier: false,
                }),
            ],
            undefined
        );
        expect(notificationService.emitFeedbackRewardEarned).toHaveBeenCalledWith(
            expect.objectContaining({
                customerId,
                bookingId,
                source: 'SURVEY',
                points: 50,
            })
        );
    });

    it('returns the existing reward without changing the balance', async () => {
        const existingTransaction = {
            _id: '507f1f77bcf86cd799439006',
            customer_id: customerId,
            booking_id: bookingId,
            type: 'REVIEW_REWARD',
            points: 50,
            earned_at: new Date(),
            rule_snapshot: {
                review_points: 50,
            },
        };

        PointTransaction.findOne.mockReturnValue(createQuery(existingTransaction));

        const result = await feedbackRewardService.awardFeedbackReward({
            customerId,
            bookingId,
            source: 'REVIEW',
            sourceId,
        });

        expect(result).toMatchObject({
            awarded: true,
            already_processed: true,
            points: 50,
        });
        expect(loyaltyService.getOrCreateCustomerLoyalty).not.toHaveBeenCalled();
        expect(PointTransaction.create).not.toHaveBeenCalled();
    });

    it('calculates the 30-day feedback funnel, reward cost, and quality metrics', async () => {
        PointTransaction.aggregate.mockResolvedValue([
            {
                _id: 'SURVEY_REWARD',
                count: 8,
                points: 400,
                remaining_points: 300,
                customers: [customerId],
            },
            {
                _id: 'REVIEW_REWARD',
                count: 6,
                points: 300,
                remaining_points: 250,
                customers: [customerId, '507f1f77bcf86cd799439007'],
            },
        ]);
        Notification.aggregate.mockResolvedValue([
            { _id: 'SURVEY_REQUEST', total: 10, opened: 8 },
            { _id: 'REVIEW_REQUEST', total: 10, opened: 7 },
        ]);
        SurveyResponse.countDocuments.mockResolvedValue(8);
        SurveyResponse.aggregate.mockResolvedValue([
            {
                _id: null,
                total: 5,
                promoters: 3,
                detractors: 1,
            },
        ]);
        Review.aggregate.mockResolvedValue([
            {
                _id: null,
                total: 6,
                hidden: 1,
                spam: 1,
                average_garage_rating: 4.5,
                average_service_rating: 4.25,
            },
        ]);
        LoyaltyRedeemRule.findOne.mockReturnValue(
            createQuery({ point_value_amount: 100 })
        );

        const result = await feedbackRewardService.getAnalytics({});

        expect(result).toMatchObject({
            invitations: {
                total: 20,
                opened: 15,
                open_rate: 75,
                survey: {
                    total: 10,
                    opened: 8,
                    open_rate: 80,
                },
                review: {
                    total: 10,
                    opened: 7,
                    open_rate: 70,
                },
            },
            completions: {
                survey_responses: 8,
                reviews: 6,
                survey_rate: 80,
                review_rate: 60,
            },
            rewards: {
                total_points: 700,
                remaining_points: 550,
                consumed_points_estimate: 150,
                estimated_value_amount: 70000,
                estimated_cost_per_feedback: 5000,
                unique_customers: 2,
            },
            quality: {
                hidden_reviews: 1,
                spam_reviews: 1,
                nps_response_count: 5,
                nps_score: 40,
                average_garage_rating: 4.5,
                average_service_rating: 4.25,
            },
        });
    });
});
