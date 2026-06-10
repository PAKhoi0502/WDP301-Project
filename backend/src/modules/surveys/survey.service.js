const Survey = require('./survey.model');
const SurveyResponse = require('./surveyResponse.model');
const SurveyMapper = require('./survey.mapper');
const Booking = require('../bookings/booking.model');
const WashHistory = require('../wash-histories/washHistory.model');
const Upload = require('../uploads/upload.model');
const auditLogService = require('../audit-logs/auditLog.service');
const { AppError } = require('../../shared/utils/appError');
const {
    SURVEY_STATUSES,
    SURVEY_QUESTION_TYPES,
} = require('../../shared/constants/survey.constant');
const {
    BOOKING_STATUS,
    BOOKING_PAYMENT_STATUS,
} = require('../../shared/constants/booking.constant');
const {
    UPLOAD_PURPOSES,
    UPLOAD_RELATED_TYPES,
} = require('../../shared/constants/upload.constant');
const {
    AUDIT_ACTIONS,
    AUDIT_RESOURCE_TYPES,
} = require('../../shared/constants/audit.constant');

const normalizeText = (value) => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value !== 'string') {
        return value;
    }

    const trimmedValue = value.trim();

    return trimmedValue || null;
};

const escapeRegExp = (value) => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const normalizeQuestions = (questions = []) => {
    return questions
        .map((question) => ({
            text: question.text.trim(),
            type: question.type,
            is_required: question.is_required || false,
            options: (question.options || []).map((option) => option.trim()),
            order: question.order,
        }))
        .sort((firstQuestion, secondQuestion) => firstQuestion.order - secondQuestion.order);
};

const normalizeSurveyPayload = (payload = {}) => {
    const normalizedPayload = {};

    if (payload.title !== undefined) {
        normalizedPayload.title = payload.title.trim();
    }

    if (payload.description !== undefined) {
        normalizedPayload.description = normalizeText(payload.description);
    }

    if (payload.questions !== undefined) {
        normalizedPayload.questions = normalizeQuestions(payload.questions);
    }

    if (payload.response_window_days !== undefined) {
        normalizedPayload.response_window_days = payload.response_window_days;
    }

    return normalizedPayload;
};

const populateSurveyQuery = (query) => {
    return query.populate('created_by', 'full_name email phone role is_active');
};

const populateSurveyResponseQuery = (query) => {
    return query
        .populate('survey_id')
        .populate('customer_id', 'full_name email phone role is_active')
        .populate('upload_ids');
};

const getSurveyDocumentById = async (surveyId) => {
    const survey = await populateSurveyQuery(Survey.findById(surveyId));

    if (!survey) {
        throw new AppError('Survey not found', 404, 'SURVEY_NOT_FOUND');
    }

    return survey;
};

const assertSurveyDraft = (survey) => {
    if (survey.status !== SURVEY_STATUSES.DRAFT) {
        throw new AppError('Only draft survey can be modified', 409, 'SURVEY_NOT_DRAFT');
    }
};

const getAllSurveys = async ({ page = 1, limit = 20, search, status, created_by } = {}) => {
    const filter = {};
    const skip = (page - 1) * limit;

    if (search) {
        const keyword = escapeRegExp(search.trim());

        filter.$or = [
            { title: { $regex: keyword, $options: 'i' } },
            { description: { $regex: keyword, $options: 'i' } },
        ];
    }

    if (status) {
        filter.status = status;
    }

    if (created_by) {
        filter.created_by = created_by;
    }

    const [surveys, total] = await Promise.all([
        populateSurveyQuery(
            Survey.find(filter)
                .sort({ created_at: -1 })
                .skip(skip)
                .limit(limit)
        ),
        Survey.countDocuments(filter),
    ]);

    return {
        data: SurveyMapper.toSurveyDtoList(surveys),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

const getSurveyById = async (surveyId) => {
    const survey = await getSurveyDocumentById(surveyId);

    return SurveyMapper.toSurveyDto(survey);
};

const createSurvey = async (user, payload = {}, auditContext = {}) => {
    const survey = await Survey.create({
        ...normalizeSurveyPayload(payload),
        status: SURVEY_STATUSES.DRAFT,
        created_by: user._id,
    });
    const populatedSurvey = await getSurveyDocumentById(survey._id);
    const result = SurveyMapper.toSurveyDto(populatedSurvey);

    await auditLogService.recordAuditEvent({
        actorId: user._id,
        action: AUDIT_ACTIONS.SURVEY_CREATED,
        resourceType: AUDIT_RESOURCE_TYPES.SURVEY,
        resourceId: survey._id,
        after: result,
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
    });

    return result;
};

const updateSurvey = async (user, surveyId, payload = {}, auditContext = {}) => {
    const survey = await getSurveyDocumentById(surveyId);

    assertSurveyDraft(survey);

    const before = SurveyMapper.toSurveyDto(survey);
    const updatePayload = normalizeSurveyPayload(payload);

    Object.assign(survey, updatePayload);

    await survey.save();

    const populatedSurvey = await getSurveyDocumentById(survey._id);
    const result = SurveyMapper.toSurveyDto(populatedSurvey);

    await auditLogService.recordAuditEvent({
        actorId: user._id,
        action: AUDIT_ACTIONS.SURVEY_UPDATED,
        resourceType: AUDIT_RESOURCE_TYPES.SURVEY,
        resourceId: survey._id,
        before,
        after: result,
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
    });

    return result;
};

const deleteSurvey = async (user, surveyId, auditContext = {}) => {
    const survey = await getSurveyDocumentById(surveyId);

    assertSurveyDraft(survey);

    const before = SurveyMapper.toSurveyDto(survey);

    await Survey.deleteOne({ _id: survey._id });

    await auditLogService.recordAuditEvent({
        actorId: user._id,
        action: AUDIT_ACTIONS.SURVEY_DELETED,
        resourceType: AUDIT_RESOURCE_TYPES.SURVEY,
        resourceId: survey._id,
        before,
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
    });

    return before;
};

const publishSurvey = async (user, surveyId, auditContext = {}) => {
    const survey = await getSurveyDocumentById(surveyId);

    assertSurveyDraft(survey);

    if (!survey.questions || survey.questions.length === 0) {
        throw new AppError('Survey requires at least one question before publishing', 400, 'SURVEY_QUESTIONS_REQUIRED');
    }

    const before = SurveyMapper.toSurveyDto(survey);

    survey.status = SURVEY_STATUSES.PUBLISHED;
    survey.published_at = new Date();
    survey.closed_at = null;

    await survey.save();

    const result = SurveyMapper.toSurveyDto(survey);

    await auditLogService.recordAuditEvent({
        actorId: user._id,
        action: AUDIT_ACTIONS.SURVEY_PUBLISHED,
        resourceType: AUDIT_RESOURCE_TYPES.SURVEY,
        resourceId: survey._id,
        before,
        after: result,
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
    });

    return result;
};

const closeSurvey = async (user, surveyId, auditContext = {}) => {
    const survey = await getSurveyDocumentById(surveyId);

    if (survey.status !== SURVEY_STATUSES.PUBLISHED) {
        throw new AppError('Only published survey can be closed', 409, 'SURVEY_NOT_PUBLISHED');
    }

    const before = SurveyMapper.toSurveyDto(survey);

    survey.status = SURVEY_STATUSES.CLOSED;
    survey.closed_at = new Date();

    await survey.save();

    const result = SurveyMapper.toSurveyDto(survey);

    await auditLogService.recordAuditEvent({
        actorId: user._id,
        action: AUDIT_ACTIONS.SURVEY_CLOSED,
        resourceType: AUDIT_RESOURCE_TYPES.SURVEY,
        resourceId: survey._id,
        before,
        after: result,
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
    });

    return result;
};

const getEligibleBookingContext = async (customerId, bookingId) => {
    const booking = await Booking.findOne({
        _id: bookingId,
        customer_id: customerId,
    });

    if (!booking) {
        throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    if (booking.status !== BOOKING_STATUS.COMPLETED || booking.payment_status !== BOOKING_PAYMENT_STATUS.PAID) {
        throw new AppError(
            'Survey is only available after booking is completed and paid',
            409,
            'SURVEY_BOOKING_NOT_ELIGIBLE'
        );
    }

    const washHistory = await WashHistory.findOne({
        booking_id: booking._id,
        customer_id: customerId,
    });

    if (!washHistory) {
        throw new AppError('Wash history is required before survey submission', 409, 'SURVEY_WASH_HISTORY_REQUIRED');
    }

    return {
        booking,
        washHistory,
    };
};

const getResponseExpiresAt = (survey, booking, washHistory) => {
    const baseDate = washHistory.service_completed_at || booking.completed_at;
    const expiresAt = new Date(baseDate);

    expiresAt.setUTCDate(expiresAt.getUTCDate() + survey.response_window_days);

    return expiresAt;
};

const assertSurveyResponseWindowOpen = (survey, booking, washHistory) => {
    const expiresAt = getResponseExpiresAt(survey, booking, washHistory);

    if (expiresAt < new Date()) {
        throw new AppError('Survey response window has expired', 409, 'SURVEY_RESPONSE_WINDOW_EXPIRED');
    }

    return expiresAt;
};

const getAvailableSurveys = async (customerId, bookingId) => {
    const { booking, washHistory } = await getEligibleBookingContext(customerId, bookingId);
    const [surveys, responses] = await Promise.all([
        Survey.find({
            status: SURVEY_STATUSES.PUBLISHED,
        }).sort({ published_at: -1 }),
        SurveyResponse.find({
            booking_id: booking._id,
        }).select('survey_id'),
    ]);
    const respondedSurveyIds = new Set(
        responses.map((response) => response.survey_id.toString())
    );

    return surveys
        .filter((survey) => {
            if (respondedSurveyIds.has(survey._id.toString())) {
                return false;
            }

            return getResponseExpiresAt(survey, booking, washHistory) >= new Date();
        })
        .map((survey) => SurveyMapper.toSurveyDto(survey, {
            booking_id: booking._id.toString(),
            wash_history_id: washHistory._id.toString(),
            response_expires_at: getResponseExpiresAt(survey, booking, washHistory),
        }));
};

const normalizeNumericAnswer = (value, min, max, errorCode, message) => {
    if (!Number.isInteger(value) || value < min || value > max) {
        throw new AppError(message, 400, errorCode);
    }

    return value;
};

const normalizeAnswer = (question, value) => {
    const answer = {
        question_id: question._id,
        question_text_snapshot: question.text,
        question_type_snapshot: question.type,
        numeric_value: null,
        text_value: null,
        selected_options: [],
    };

    if (question.type === SURVEY_QUESTION_TYPES.RATING) {
        answer.numeric_value = normalizeNumericAnswer(
            value,
            1,
            5,
            'INVALID_SURVEY_RATING',
            'Rating answer must be an integer from 1 to 5'
        );

        return answer;
    }

    if (question.type === SURVEY_QUESTION_TYPES.NPS) {
        answer.numeric_value = normalizeNumericAnswer(
            value,
            0,
            10,
            'INVALID_SURVEY_NPS',
            'NPS answer must be an integer from 0 to 10'
        );

        return answer;
    }

    if (question.type === SURVEY_QUESTION_TYPES.SINGLE_CHOICE) {
        if (typeof value !== 'string' || !question.options.includes(value.trim())) {
            throw new AppError('Single choice answer is invalid', 400, 'INVALID_SURVEY_SINGLE_CHOICE');
        }

        answer.selected_options = [value.trim()];

        return answer;
    }

    if (question.type === SURVEY_QUESTION_TYPES.MULTI_CHOICE) {
        if (!Array.isArray(value) || value.length === 0) {
            throw new AppError('Multiple choice answer is invalid', 400, 'INVALID_SURVEY_MULTI_CHOICE');
        }

        const selectedOptions = value.map((option) => {
            if (typeof option !== 'string') {
                throw new AppError('Multiple choice answer is invalid', 400, 'INVALID_SURVEY_MULTI_CHOICE');
            }

            return option.trim();
        });

        if (
            new Set(selectedOptions).size !== selectedOptions.length
            || selectedOptions.some((option) => !question.options.includes(option))
        ) {
            throw new AppError('Multiple choice answer is invalid', 400, 'INVALID_SURVEY_MULTI_CHOICE');
        }

        answer.selected_options = selectedOptions;

        return answer;
    }

    const textValue = normalizeText(value);

    if (!textValue || typeof textValue !== 'string' || textValue.length > 2000) {
        throw new AppError('Text answer is invalid', 400, 'INVALID_SURVEY_TEXT');
    }

    answer.text_value = textValue;

    return answer;
};

const normalizeAnswers = (survey, answers = []) => {
    const questionsById = new Map(
        survey.questions.map((question) => [question._id.toString(), question])
    );
    const answersByQuestionId = new Map();

    for (const answer of answers) {
        if (answersByQuestionId.has(answer.question_id)) {
            throw new AppError('Each question can only be answered once', 400, 'DUPLICATE_SURVEY_ANSWER');
        }

        const question = questionsById.get(answer.question_id);

        if (!question) {
            throw new AppError('Survey answer contains unknown question', 400, 'SURVEY_QUESTION_NOT_FOUND');
        }

        answersByQuestionId.set(answer.question_id, normalizeAnswer(question, answer.value));
    }

    const missingRequiredQuestion = survey.questions.find((question) => {
        return question.is_required && !answersByQuestionId.has(question._id.toString());
    });

    if (missingRequiredQuestion) {
        throw new AppError('Required survey question is missing', 400, 'SURVEY_REQUIRED_ANSWER_MISSING', [
            {
                path: missingRequiredQuestion._id.toString(),
                message: missingRequiredQuestion.text,
            },
        ]);
    }

    return survey.questions
        .filter((question) => answersByQuestionId.has(question._id.toString()))
        .map((question) => answersByQuestionId.get(question._id.toString()));
};

const getSurveyUploads = async (customerId, uploadIds = []) => {
    const uniqueUploadIds = [...new Set(uploadIds)];

    if (uniqueUploadIds.length === 0) {
        return [];
    }

    const uploads = await Upload.find({
        _id: { $in: uniqueUploadIds },
        owner_id: customerId,
        purpose: UPLOAD_PURPOSES.SURVEY_RESPONSE,
        related_type: null,
        related_id: null,
    });

    if (uploads.length !== uniqueUploadIds.length) {
        throw new AppError(
            'One or more survey uploads are invalid, already used, or not owned by customer',
            400,
            'INVALID_SURVEY_UPLOADS'
        );
    }

    if (uploads.some((upload) => !upload.mime_type.startsWith('image/'))) {
        throw new AppError('Survey response only accepts image uploads', 400, 'SURVEY_UPLOAD_IMAGE_REQUIRED');
    }

    return uploads;
};

const submitSurveyResponse = async (user, surveyId, payload = {}, auditContext = {}) => {
    const survey = await Survey.findById(surveyId);

    if (!survey || survey.status !== SURVEY_STATUSES.PUBLISHED) {
        throw new AppError('Published survey not found', 404, 'SURVEY_NOT_FOUND');
    }

    const { booking, washHistory } = await getEligibleBookingContext(user._id, payload.booking_id);

    assertSurveyResponseWindowOpen(survey, booking, washHistory);

    const existedResponse = await SurveyResponse.exists({
        survey_id: survey._id,
        booking_id: booking._id,
    });

    if (existedResponse) {
        throw new AppError('Survey response already exists for this booking', 409, 'SURVEY_RESPONSE_ALREADY_EXISTS');
    }

    const answers = normalizeAnswers(survey, payload.answers || []);
    const uploads = await getSurveyUploads(user._id, payload.upload_ids || []);
    const response = await SurveyResponse.create({
        survey_id: survey._id,
        booking_id: booking._id,
        wash_history_id: washHistory._id,
        customer_id: user._id,
        answers,
        upload_ids: uploads.map((upload) => upload._id),
        submitted_at: new Date(),
    });

    if (uploads.length > 0) {
        const uploadIds = uploads.map((upload) => upload._id);
        const updateResult = await Upload.updateMany(
            {
                _id: { $in: uploadIds },
                owner_id: user._id,
                related_type: null,
                related_id: null,
            },
            {
                $set: {
                    related_type: UPLOAD_RELATED_TYPES.SURVEY_RESPONSE,
                    related_id: response._id,
                },
            }
        );

        if ((updateResult.modifiedCount || 0) !== uploads.length) {
            await Upload.updateMany(
                {
                    related_type: UPLOAD_RELATED_TYPES.SURVEY_RESPONSE,
                    related_id: response._id,
                },
                {
                    $set: {
                        related_type: null,
                        related_id: null,
                    },
                }
            );
            await SurveyResponse.deleteOne({ _id: response._id });

            throw new AppError('Failed to attach uploads to survey response', 409, 'SURVEY_UPLOAD_ATTACH_CONFLICT');
        }
    }

    const populatedResponse = await populateSurveyResponseQuery(
        SurveyResponse.findById(response._id)
    );
    const result = SurveyMapper.toSurveyResponseDto(populatedResponse);

    await auditLogService.recordAuditEvent({
        actorId: user._id,
        action: AUDIT_ACTIONS.SURVEY_RESPONSE_CREATED,
        resourceType: AUDIT_RESOURCE_TYPES.SURVEY_RESPONSE,
        resourceId: response._id,
        after: result,
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
        metadata: {
            survey_id: survey._id.toString(),
            booking_id: booking._id.toString(),
            wash_history_id: washHistory._id.toString(),
        },
    });

    return result;
};

const getSurveyResponses = async (surveyId, { page = 1, limit = 20, customer_id, booking_id, from, to } = {}) => {
    await getSurveyDocumentById(surveyId);

    const filter = {
        survey_id: surveyId,
    };
    const submittedAtRange = {};

    if (customer_id) {
        filter.customer_id = customer_id;
    }

    if (booking_id) {
        filter.booking_id = booking_id;
    }

    if (from) {
        submittedAtRange.$gte = from;
    }

    if (to) {
        submittedAtRange.$lte = to;
    }

    if (Object.keys(submittedAtRange).length > 0) {
        filter.submitted_at = submittedAtRange;
    }

    const skip = (page - 1) * limit;
    const [responses, total] = await Promise.all([
        populateSurveyResponseQuery(
            SurveyResponse.find(filter)
                .sort({ submitted_at: -1 })
                .skip(skip)
                .limit(limit)
        ),
        SurveyResponse.countDocuments(filter),
    ]);

    return {
        data: SurveyMapper.toSurveyResponseDtoList(responses),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

module.exports = {
    getAllSurveys,
    getSurveyById,
    createSurvey,
    updateSurvey,
    deleteSurvey,
    publishSurvey,
    closeSurvey,
    getAvailableSurveys,
    submitSurveyResponse,
    getSurveyResponses,
};
