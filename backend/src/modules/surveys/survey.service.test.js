jest.mock('./survey.model', () => ({
    create: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    deleteOne: jest.fn(),
}));

jest.mock('./surveyResponse.model', () => ({
    create: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    exists: jest.fn(),
    countDocuments: jest.fn(),
    deleteOne: jest.fn(),
}));

jest.mock('../bookings/booking.model', () => ({
    findOne: jest.fn(),
}));

jest.mock('../wash-histories/washHistory.model', () => ({
    findOne: jest.fn(),
}));

jest.mock('../uploads/upload.model', () => ({
    find: jest.fn(),
    updateMany: jest.fn(),
}));

jest.mock('../audit-logs/auditLog.service', () => ({
    recordAuditEvent: jest.fn(),
}));

const Survey = require('./survey.model');
const SurveyResponse = require('./surveyResponse.model');
const Booking = require('../bookings/booking.model');
const WashHistory = require('../wash-histories/washHistory.model');
const Upload = require('../uploads/upload.model');
const auditLogService = require('../audit-logs/auditLog.service');
const surveyService = require('./survey.service');

describe('survey service', () => {
    const adminUser = {
        _id: '507f1f77bcf86cd799439001',
        role: 'ADMIN',
    };
    const customerUser = {
        _id: '507f1f77bcf86cd799439002',
        role: 'CUSTOMER',
    };
    const surveyId = '507f1f77bcf86cd799439003';
    const bookingId = '507f1f77bcf86cd799439004';
    const washHistoryId = '507f1f77bcf86cd799439005';
    const responseId = '507f1f77bcf86cd799439006';
    const questionId = '507f1f77bcf86cd799439007';
    const uploadId = '507f1f77bcf86cd799439008';

    const createSurveyDocument = (overrides = {}) => ({
        _id: surveyId,
        title: 'Post wash survey',
        description: null,
        status: 'DRAFT',
        questions: [
            {
                _id: questionId,
                text: 'How satisfied are you?',
                type: 'RATING',
                is_required: true,
                options: [],
                order: 1,
            },
        ],
        response_window_days: 7,
        created_by: adminUser._id,
        published_at: null,
        closed_at: null,
        created_at: new Date('2026-06-10T00:00:00.000Z'),
        updated_at: new Date('2026-06-10T00:00:00.000Z'),
        save: jest.fn().mockResolvedValue(undefined),
        ...overrides,
    });

    const createPopulateQuery = (value) => ({
        populate: jest.fn().mockResolvedValue(value),
    });

    const createMultiPopulateQuery = (value) => {
        const query = {
            populate: jest.fn(() => query),
            then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
        };

        return query;
    };

    const createSortQuery = (value) => ({
        sort: jest.fn().mockResolvedValue(value),
    });

    const createSelectQuery = (value) => ({
        select: jest.fn().mockResolvedValue(value),
    });

    beforeEach(() => {
        jest.clearAllMocks();
        Survey.create.mockReset();
        Survey.findById.mockReset();
        Survey.find.mockReset();
        Survey.countDocuments.mockReset();
        Survey.deleteOne.mockReset();
        SurveyResponse.create.mockReset();
        SurveyResponse.findById.mockReset();
        SurveyResponse.find.mockReset();
        SurveyResponse.exists.mockReset();
        SurveyResponse.countDocuments.mockReset();
        SurveyResponse.deleteOne.mockReset();
        Booking.findOne.mockReset();
        WashHistory.findOne.mockReset();
        Upload.find.mockReset();
        Upload.updateMany.mockReset();
        auditLogService.recordAuditEvent.mockReset();
        auditLogService.recordAuditEvent.mockResolvedValue(null);
    });

    it('creates a draft survey and records audit event', async () => {
        const survey = createSurveyDocument();

        Survey.create.mockResolvedValue({ _id: surveyId });
        Survey.findById.mockReturnValue(createPopulateQuery(survey));

        const result = await surveyService.createSurvey(adminUser, {
            title: 'Post wash survey',
            questions: [
                {
                    text: 'How satisfied are you?',
                    type: 'RATING',
                    is_required: true,
                    options: [],
                    order: 1,
                },
            ],
            response_window_days: 7,
        });

        expect(Survey.create).toHaveBeenCalledWith(expect.objectContaining({
            status: 'DRAFT',
            created_by: adminUser._id,
        }));
        expect(auditLogService.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
            action: 'SURVEY_CREATED',
            resourceType: 'SURVEY',
            resourceId: surveyId,
        }));
        expect(result.status).toBe('DRAFT');
    });

    it('publishes a draft survey with questions', async () => {
        const survey = createSurveyDocument();

        Survey.findById.mockReturnValue(createPopulateQuery(survey));

        const result = await surveyService.publishSurvey(adminUser, surveyId);

        expect(survey.status).toBe('PUBLISHED');
        expect(survey.published_at).toBeInstanceOf(Date);
        expect(survey.save).toHaveBeenCalledTimes(1);
        expect(result.status).toBe('PUBLISHED');
    });

    it('rejects publishing an empty survey', async () => {
        const survey = createSurveyDocument({
            questions: [],
        });

        Survey.findById.mockReturnValue(createPopulateQuery(survey));

        await expect(surveyService.publishSurvey(adminUser, surveyId)).rejects.toMatchObject({
            statusCode: 400,
            errorCode: 'SURVEY_QUESTIONS_REQUIRED',
        });
    });

    it('rejects survey response for incomplete booking', async () => {
        Survey.findById.mockResolvedValue(createSurveyDocument({
            status: 'PUBLISHED',
            published_at: new Date('2026-06-10T00:00:00.000Z'),
        }));
        Booking.findOne.mockResolvedValue({
            _id: bookingId,
            customer_id: customerUser._id,
            status: 'IN_PROGRESS',
            payment_status: 'PAID',
        });

        await expect(surveyService.submitSurveyResponse(customerUser, surveyId, {
            booking_id: bookingId,
            answers: [],
        })).rejects.toMatchObject({
            statusCode: 409,
            errorCode: 'SURVEY_BOOKING_NOT_ELIGIBLE',
        });
    });

    it('returns published unanswered surveys for eligible booking', async () => {
        const survey = createSurveyDocument({
            status: 'PUBLISHED',
            published_at: new Date(),
        });

        Booking.findOne.mockResolvedValue({
            _id: bookingId,
            customer_id: customerUser._id,
            status: 'COMPLETED',
            payment_status: 'PAID',
            completed_at: new Date(),
        });
        WashHistory.findOne.mockResolvedValue({
            _id: washHistoryId,
            service_completed_at: new Date(),
        });
        Survey.find.mockReturnValue(createSortQuery([survey]));
        SurveyResponse.find.mockReturnValue(createSelectQuery([]));

        const result = await surveyService.getAvailableSurveys(customerUser._id, bookingId);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(expect.objectContaining({
            id: surveyId,
            booking_id: bookingId,
            wash_history_id: washHistoryId,
            created_by: null,
        }));
    });

    it('submits normalized response for completed paid booking', async () => {
        const survey = createSurveyDocument({
            status: 'PUBLISHED',
            published_at: new Date('2026-06-10T00:00:00.000Z'),
        });
        const booking = {
            _id: bookingId,
            customer_id: customerUser._id,
            status: 'COMPLETED',
            payment_status: 'PAID',
            completed_at: new Date('2026-06-10T00:00:00.000Z'),
        };
        const washHistory = {
            _id: washHistoryId,
            booking_id: bookingId,
            customer_id: customerUser._id,
            service_completed_at: new Date(),
        };
        const response = {
            _id: responseId,
            survey_id: survey,
            booking_id: bookingId,
            wash_history_id: washHistoryId,
            customer_id: customerUser._id,
            answers: [
                {
                    question_id: questionId,
                    question_text_snapshot: 'How satisfied are you?',
                    question_type_snapshot: 'RATING',
                    numeric_value: 5,
                    text_value: null,
                    selected_options: [],
                },
            ],
            upload_ids: [],
            submitted_at: new Date(),
            created_at: new Date(),
            updated_at: new Date(),
        };

        Survey.findById.mockResolvedValue(survey);
        Booking.findOne.mockResolvedValue(booking);
        WashHistory.findOne.mockResolvedValue(washHistory);
        SurveyResponse.exists.mockResolvedValue(null);
        Upload.find.mockResolvedValue([]);
        SurveyResponse.create.mockResolvedValue({ _id: responseId });
        SurveyResponse.findById.mockReturnValue(createMultiPopulateQuery(response));

        const result = await surveyService.submitSurveyResponse(customerUser, surveyId, {
            booking_id: bookingId,
            answers: [
                {
                    question_id: questionId,
                    value: 5,
                },
            ],
            upload_ids: [],
        });

        expect(SurveyResponse.create).toHaveBeenCalledWith(expect.objectContaining({
            survey_id: surveyId,
            booking_id: bookingId,
            wash_history_id: washHistoryId,
            customer_id: customerUser._id,
            answers: [
                expect.objectContaining({
                    question_type_snapshot: 'RATING',
                    numeric_value: 5,
                }),
            ],
        }));
        expect(auditLogService.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
            action: 'SURVEY_RESPONSE_CREATED',
            resourceType: 'SURVEY_RESPONSE',
            resourceId: responseId,
        }));
        expect(result.id).toBe(responseId);
    });

    it('rejects invalid rating answer', async () => {
        const survey = createSurveyDocument({
            status: 'PUBLISHED',
            published_at: new Date(),
        });

        Survey.findById.mockResolvedValue(survey);
        Booking.findOne.mockResolvedValue({
            _id: bookingId,
            customer_id: customerUser._id,
            status: 'COMPLETED',
            payment_status: 'PAID',
            completed_at: new Date(),
        });
        WashHistory.findOne.mockResolvedValue({
            _id: washHistoryId,
            service_completed_at: new Date(),
        });
        SurveyResponse.exists.mockResolvedValue(null);

        await expect(surveyService.submitSurveyResponse(customerUser, surveyId, {
            booking_id: bookingId,
            answers: [
                {
                    question_id: questionId,
                    value: 6,
                },
            ],
        })).rejects.toMatchObject({
            statusCode: 400,
            errorCode: 'INVALID_SURVEY_RATING',
        });
    });

    it('rejects missing required answer', async () => {
        const survey = createSurveyDocument({
            status: 'PUBLISHED',
            published_at: new Date(),
        });

        Survey.findById.mockResolvedValue(survey);
        Booking.findOne.mockResolvedValue({
            _id: bookingId,
            customer_id: customerUser._id,
            status: 'COMPLETED',
            payment_status: 'PAID',
            completed_at: new Date(),
        });
        WashHistory.findOne.mockResolvedValue({
            _id: washHistoryId,
            service_completed_at: new Date(),
        });
        SurveyResponse.exists.mockResolvedValue(null);

        await expect(surveyService.submitSurveyResponse(customerUser, surveyId, {
            booking_id: bookingId,
            answers: [],
        })).rejects.toMatchObject({
            statusCode: 400,
            errorCode: 'SURVEY_REQUIRED_ANSWER_MISSING',
        });
    });

    it('attaches owned survey image uploads to response', async () => {
        const survey = createSurveyDocument({
            status: 'PUBLISHED',
            published_at: new Date(),
        });
        const booking = {
            _id: bookingId,
            customer_id: customerUser._id,
            status: 'COMPLETED',
            payment_status: 'PAID',
            completed_at: new Date(),
        };
        const washHistory = {
            _id: washHistoryId,
            service_completed_at: new Date(),
        };
        const upload = {
            _id: uploadId,
            url: 'https://res.cloudinary.com/demo/image/upload/survey.jpg',
            public_id: 'survey/image',
            mime_type: 'image/jpeg',
            size: 100,
            purpose: 'SURVEY_RESPONSE',
            owner_id: customerUser._id,
            related_type: 'SURVEY_RESPONSE',
            related_id: responseId,
        };
        const response = {
            _id: responseId,
            survey_id: survey,
            booking_id: bookingId,
            wash_history_id: washHistoryId,
            customer_id: customerUser._id,
            answers: [
                {
                    question_id: questionId,
                    question_text_snapshot: 'How satisfied are you?',
                    question_type_snapshot: 'RATING',
                    numeric_value: 5,
                    text_value: null,
                    selected_options: [],
                },
            ],
            upload_ids: [upload],
            submitted_at: new Date(),
        };

        Survey.findById.mockResolvedValue(survey);
        Booking.findOne.mockResolvedValue(booking);
        WashHistory.findOne.mockResolvedValue(washHistory);
        SurveyResponse.exists.mockResolvedValue(null);
        Upload.find.mockResolvedValue([{
            ...upload,
            related_type: null,
            related_id: null,
        }]);
        Upload.updateMany.mockResolvedValue({ modifiedCount: 1 });
        SurveyResponse.create.mockResolvedValue({ _id: responseId });
        SurveyResponse.findById.mockReturnValue(createMultiPopulateQuery(response));

        const result = await surveyService.submitSurveyResponse(customerUser, surveyId, {
            booking_id: bookingId,
            answers: [
                {
                    question_id: questionId,
                    value: 5,
                },
            ],
            upload_ids: [uploadId],
        });

        expect(Upload.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                _id: { $in: [uploadId] },
                owner_id: customerUser._id,
            }),
            {
                $set: {
                    related_type: 'SURVEY_RESPONSE',
                    related_id: responseId,
                },
            }
        );
        expect(result.upload_ids).toEqual([uploadId]);
    });
});
