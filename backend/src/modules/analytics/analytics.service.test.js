jest.mock('../bookings/booking.model', () => ({
    aggregate: jest.fn(),
}));

jest.mock('../wash-histories/washHistory.model', () => ({
    aggregate: jest.fn(),
    countDocuments: jest.fn(),
}));

jest.mock('../promotion-usages/promotionUsage.model', () => ({
    aggregate: jest.fn(),
}));

jest.mock('../surveys/survey.model', () => ({
    findById: jest.fn(),
}));

jest.mock('../surveys/surveyResponse.model', () => ({
    aggregate: jest.fn(),
}));

jest.mock('../payments/paymentTransaction.model', () => ({
    aggregate: jest.fn(),
}));

const Booking = require('../bookings/booking.model');
const WashHistory = require('../wash-histories/washHistory.model');
const Survey = require('../surveys/survey.model');
const SurveyResponse = require('../surveys/surveyResponse.model');
const PaymentTransaction = require('../payments/paymentTransaction.model');
const analyticsService = require('./analytics.service');

describe('analytics service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('calculates overview revenue from wash histories', async () => {
        Booking.aggregate.mockResolvedValue([
            {
                total_bookings: 10,
                completed_bookings: 7,
                canceled_bookings: 2,
                no_show_bookings: 1,
                registered_customer_bookings: 6,
                walk_in_bookings: 4,
                unique_registered_customers: ['customer-1', 'customer-2'],
            },
        ]);
        WashHistory.aggregate.mockResolvedValue([
            {
                total_revenue: 700000,
                original_revenue: 800000,
                total_discount: 100000,
                paid_booking_count: 7,
            },
        ]);

        const result = await analyticsService.getOverview({});

        expect(result.metrics).toMatchObject({
            total_bookings: 10,
            completed_bookings: 7,
            completion_rate: 70,
            cancellation_rate: 20,
            no_show_rate: 10,
            unique_registered_customers: 2,
            total_revenue: 700000,
            average_order_value: 100000,
        });
        expect(WashHistory.aggregate).toHaveBeenCalledTimes(1);
    });

    it('scopes staff overview to the assigned garage and redacts revenue', async () => {
        const garageId = '507f1f77bcf86cd799439011';
        Booking.aggregate.mockResolvedValue([
            {
                total_bookings: 4,
                completed_bookings: 3,
                canceled_bookings: 1,
                no_show_bookings: 0,
                registered_customer_bookings: 2,
                walk_in_bookings: 2,
                unique_registered_customers: ['customer-1'],
            },
        ]);
        WashHistory.aggregate.mockResolvedValue([
            {
                total_revenue: 400000,
                original_revenue: 450000,
                total_discount: 50000,
                paid_booking_count: 3,
            },
        ]);

        const result = await analyticsService.getStaffOverview(
            { garage_id: '507f1f77bcf86cd799439099' },
            { garageId, includeRevenue: false }
        );
        const bookingPipeline = Booking.aggregate.mock.calls[0][0];
        const revenuePipeline = WashHistory.aggregate.mock.calls[0][0];

        expect(bookingPipeline[0].$match.garage_id.toString()).toBe(garageId);
        expect(revenuePipeline[0].$match.garage_id.toString()).toBe(garageId);
        expect(result.metrics).toMatchObject({
            total_bookings: 4,
            completed_bookings: 3,
            completion_rate: 75,
        });
        expect(result.metrics).not.toHaveProperty('total_revenue');
        expect(result.metrics).not.toHaveProperty('original_revenue');
        expect(result.metrics).not.toHaveProperty('total_discount');
        expect(result.metrics).not.toHaveProperty('average_order_value');
    });

    it('rejects an unscoped staff overview request', async () => {
        await expect(
            analyticsService.getStaffOverview({}, { includeRevenue: false })
        ).rejects.toMatchObject({
            statusCode: 403,
            errorCode: 'STAFF_GARAGE_REQUIRED',
        });

        expect(Booking.aggregate).not.toHaveBeenCalled();
        expect(WashHistory.aggregate).not.toHaveBeenCalled();
    });

    it('returns booking rates, trends, and duration metrics', async () => {
        Booking.aggregate.mockResolvedValue([
            {
                status_distribution: [
                    { _id: 'COMPLETED', count: 3 },
                    { _id: 'CANCELED', count: 1 },
                ],
                trend: [
                    { _id: '2026-06-10', count: 2 },
                    { _id: '2026-06-11', count: 2 },
                ],
                garage_distribution: [{ _id: 'garage-1', count: 4 }],
                vehicle_type_distribution: [{ _id: 'CAR', count: 4 }],
                time_of_day_distribution: [{ _id: 'MORNING', count: 4 }],
                metrics: [
                    {
                        total_bookings: 4,
                        completed_bookings: 3,
                        canceled_bookings: 1,
                        no_show_bookings: 0,
                        scheduled_duration_average: 60,
                        actual_duration_average: 55.5,
                        late_booking_count: 1,
                        reschedule_count: 2,
                        walk_in_bookings: 1,
                        registered_customer_bookings: 3,
                    },
                ],
            },
        ]);

        const result = await analyticsService.getBookingAnalytics({
            group_by: 'DAY',
        });

        expect(result.metrics).toEqual({
            total_bookings: 4,
            completed_bookings: 3,
            canceled_bookings: 1,
            no_show_bookings: 0,
            completion_rate: 75,
            cancellation_rate: 25,
            no_show_rate: 0,
            scheduled_duration_average_minutes: 60,
            actual_duration_average_minutes: 55.5,
            late_booking_count: 1,
            reschedule_count: 2,
            walk_in_bookings: 1,
            registered_customer_bookings: 3,
        });
        expect(result.trend).toEqual([
            { period: '2026-06-10', count: 2, revenue: 0 },
            { period: '2026-06-11', count: 2, revenue: 0 },
        ]);
    });

    it('calculates survey NPS by promoter and detractor percentages', async () => {
        const surveyId = '507f1f77bcf86cd799439001';
        const npsQuestionId = '507f1f77bcf86cd799439002';
        const ratingQuestionId = '507f1f77bcf86cd799439003';
        const survey = {
            _id: { toString: () => surveyId },
            title: 'Post wash survey',
            status: 'PUBLISHED',
            published_at: new Date('2026-06-01T00:00:00.000Z'),
            closed_at: null,
            response_window_days: 7,
            questions: [
                {
                    _id: { toString: () => npsQuestionId },
                    text: 'Recommend us?',
                    type: 'NPS',
                    order: 1,
                },
                {
                    _id: { toString: () => ratingQuestionId },
                    text: 'Rate service',
                    type: 'RATING',
                    order: 2,
                },
            ],
        };

        Survey.findById.mockReturnValue({
            lean: jest.fn().mockResolvedValue(survey),
        });
        SurveyResponse.aggregate
            .mockResolvedValueOnce([{ count: 10 }])
            .mockResolvedValueOnce([
                {
                    _id: { toString: () => npsQuestionId },
                    response_count: 10,
                    numeric_average: 7.5,
                    text_response_count: 0,
                },
                {
                    _id: { toString: () => ratingQuestionId },
                    response_count: 10,
                    numeric_average: 4.2,
                    text_response_count: 0,
                },
            ])
            .mockResolvedValueOnce([
                {
                    _id: {
                        question_id: { toString: () => ratingQuestionId },
                        value: 5,
                    },
                    count: 6,
                },
            ])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
                {
                    _id: { toString: () => npsQuestionId },
                    total: 10,
                    promoters: 6,
                    passives: 2,
                    detractors: 2,
                },
            ]);
        WashHistory.countDocuments.mockResolvedValue(20);

        const result = await analyticsService.getSurveyAnalytics(surveyId, {});
        const npsQuestion = result.questions[0];
        const ratingQuestion = result.questions[1];

        expect(result.metrics).toEqual({
            response_count: 10,
            eligible_booking_count: 20,
            response_rate: 50,
        });
        expect(npsQuestion).toMatchObject({
            nps: 40,
            promoter_percentage: 60,
            passive_percentage: 20,
            detractor_percentage: 20,
        });
        expect(ratingQuestion.rating_average).toBe(4.2);
    });

    it('returns empty survey metrics without division errors', async () => {
        const surveyId = '507f1f77bcf86cd799439001';

        Survey.findById.mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                _id: { toString: () => surveyId },
                title: 'Empty survey',
                status: 'DRAFT',
                published_at: null,
                response_window_days: 7,
                questions: [],
            }),
        });
        SurveyResponse.aggregate.mockResolvedValue([]);

        const result = await analyticsService.getSurveyAnalytics(surveyId, {});

        expect(result.metrics).toEqual({
            response_count: 0,
            eligible_booking_count: 0,
            response_rate: 0,
        });
    });

    it('calculates payment analytics by initiated channel', async () => {
        PaymentTransaction.aggregate.mockResolvedValue([{
            metrics: [{
                total_transactions: 10,
                paid_transactions: 8,
                active_transactions: 1,
                paid_amount: 1200000,
            }],
            by_initiated_channel: [
                {
                    _id: 'CUSTOMER_SELF_SERVICE',
                    transaction_count: 6,
                    paid_count: 5,
                    paid_amount: 750000,
                },
                {
                    _id: 'STAFF_ASSISTED',
                    transaction_count: 4,
                    paid_count: 3,
                    paid_amount: 450000,
                },
            ],
            by_status: [{ _id: 'PAID', count: 8, amount: 1200000 }],
            trend: [{ _id: '2026-07-21', count: 10, paid_count: 8, paid_amount: 1200000 }],
        }]);

        const result = await analyticsService.getPaymentAnalytics({ group_by: 'DAY' });

        expect(result.metrics).toEqual({
            total_transactions: 10,
            paid_transactions: 8,
            active_transactions: 1,
            paid_amount: 1200000,
            success_rate: 80,
        });
        expect(result.by_initiated_channel).toEqual([
            expect.objectContaining({ channel: 'CUSTOMER_SELF_SERVICE', success_rate: 83.33 }),
            expect.objectContaining({ channel: 'STAFF_ASSISTED', success_rate: 75 }),
        ]);
    });
});
