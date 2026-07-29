const UploadMapper = require('../uploads/upload.mapper');

const toId = (value) => {
    if (!value) {
        return null;
    }

    if (value._id) {
        return value._id.toString();
    }

    if (value.toString) {
        return value.toString();
    }

    return value;
};

const toUserSummaryDto = (user) => {
    if (!user || typeof user !== 'object' || !user._id) {
        return null;
    }

    const plainUser = user.toObject ? user.toObject() : user;

    return {
        id: plainUser._id?.toString() || plainUser.id || null,
        full_name: plainUser.full_name || '',
        email: plainUser.email || null,
        phone: plainUser.phone || null,
        role: plainUser.role,
        is_active: plainUser.is_active,
    };
};

const toQuestionDto = (question) => {
    const plainQuestion = question.toObject ? question.toObject() : question;

    return {
        id: plainQuestion._id?.toString() || plainQuestion.id || null,
        text: plainQuestion.text,
        type: plainQuestion.type,
        is_required: plainQuestion.is_required,
        options: plainQuestion.options || [],
        order: plainQuestion.order,
    };
};

const toSurveyDto = (survey, extra = {}) => {
    if (!survey) {
        return null;
    }

    const plainSurvey = survey.toObject ? survey.toObject() : survey;

    return {
        id: plainSurvey._id?.toString() || plainSurvey.id || null,
        title: plainSurvey.title,
        description: plainSurvey.description,
        status: plainSurvey.status,
        questions: (plainSurvey.questions || [])
            .map((question) => toQuestionDto(question))
            .sort((firstQuestion, secondQuestion) => firstQuestion.order - secondQuestion.order),
        response_window_days: plainSurvey.response_window_days,
        created_by_id: toId(plainSurvey.created_by),
        created_by: toUserSummaryDto(plainSurvey.created_by),
        published_at: plainSurvey.published_at,
        closed_at: plainSurvey.closed_at,
        created_at: plainSurvey.created_at,
        updated_at: plainSurvey.updated_at,
        ...extra,
    };
};

const toSurveyDtoList = (surveys = []) => {
    return surveys.map((survey) => toSurveyDto(survey));
};

const toAnswerDto = (answer) => {
    const plainAnswer = answer.toObject ? answer.toObject() : answer;

    return {
        question_id: toId(plainAnswer.question_id),
        question_text: plainAnswer.question_text_snapshot,
        question_type: plainAnswer.question_type_snapshot,
        numeric_value: plainAnswer.numeric_value,
        text_value: plainAnswer.text_value,
        selected_options: plainAnswer.selected_options || [],
    };
};

const toSurveyResponseDto = (response) => {
    if (!response) {
        return null;
    }

    const plainResponse = response.toObject ? response.toObject() : response;
    const populatedSurvey = plainResponse.survey_id && typeof plainResponse.survey_id === 'object' && plainResponse.survey_id._id
        ? toSurveyDto(plainResponse.survey_id)
        : null;

    return {
        id: plainResponse._id?.toString() || plainResponse.id || null,
        survey_id: toId(plainResponse.survey_id),
        survey: populatedSurvey,
        booking_id: toId(plainResponse.booking_id),
        wash_history_id: toId(plainResponse.wash_history_id),
        customer_id: toId(plainResponse.customer_id),
        customer: toUserSummaryDto(plainResponse.customer_id),
        answers: (plainResponse.answers || []).map((answer) => toAnswerDto(answer)),
        upload_ids: (plainResponse.upload_ids || []).map((upload) => toId(upload)),
        uploads: (plainResponse.upload_ids || [])
            .filter((upload) => upload && typeof upload === 'object' && upload._id)
            .map((upload) => UploadMapper.toUploadDto(upload)),
        submitted_at: plainResponse.submitted_at,
        reward: {
            awarded: Boolean(plainResponse.reward_transaction_id),
            points: plainResponse.reward_points || 0,
            transaction_id: toId(plainResponse.reward_transaction_id),
            rule_id: toId(plainResponse.reward_rule_id),
            awarded_at: plainResponse.rewarded_at,
        },
        created_at: plainResponse.created_at,
        updated_at: plainResponse.updated_at,
    };
};

const toSurveyResponseDtoList = (responses = []) => {
    return responses.map((response) => toSurveyResponseDto(response));
};

module.exports = {
    toSurveyDto,
    toSurveyDtoList,
    toSurveyResponseDto,
    toSurveyResponseDtoList,
};
