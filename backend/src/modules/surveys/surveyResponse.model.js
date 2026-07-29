const mongoose = require('mongoose');

const {
    SURVEY_QUESTION_TYPE_VALUES,
} = require('../../shared/constants/survey.constant');

const surveyAnswerSchema = new mongoose.Schema(
    {
        question_id: {
            type: mongoose.Schema.Types.ObjectId,
            required: [true, 'Question id is required'],
        },

        question_text_snapshot: {
            type: String,
            required: [true, 'Question text snapshot is required'],
            trim: true,
            maxlength: [500, 'Question text snapshot must not exceed 500 characters'],
        },

        question_type_snapshot: {
            type: String,
            enum: SURVEY_QUESTION_TYPE_VALUES,
            required: [true, 'Question type snapshot is required'],
        },

        numeric_value: {
            type: Number,
            default: null,
        },

        text_value: {
            type: String,
            trim: true,
            maxlength: [2000, 'Text answer must not exceed 2000 characters'],
            default: null,
        },

        selected_options: {
            type: [String],
            default: [],
        },
    },
    {
        _id: false,
    }
);

const surveyResponseSchema = new mongoose.Schema(
    {
        survey_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Survey',
            required: [true, 'Survey is required'],
        },

        booking_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking',
            required: [true, 'Booking is required'],
        },

        wash_history_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'WashHistory',
            required: [true, 'Wash history is required'],
        },

        customer_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Customer is required'],
        },

        answers: {
            type: [surveyAnswerSchema],
            default: [],
            validate: {
                validator(answers) {
                    const questionIds = answers.map((answer) => answer.question_id.toString());

                    return new Set(questionIds).size === questionIds.length;
                },
                message: 'Each question can only be answered once',
            },
        },

        upload_ids: {
            type: [
                {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Upload',
                },
            ],
            validate: {
                validator(uploadIds) {
                    const normalizedUploadIds = uploadIds.map((uploadId) => uploadId.toString());

                    return new Set(normalizedUploadIds).size === normalizedUploadIds.length;
                },
                message: 'Upload ids must be unique',
            },
        },

        submitted_at: {
            type: Date,
            default: Date.now,
        },

        reward_points: {
            type: Number,
            min: 0,
            default: 0,
        },

        reward_transaction_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'PointTransaction',
            default: null,
        },

        reward_rule_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FeedbackRewardRule',
            default: null,
        },

        rewarded_at: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
        collection: 'survey_responses',
    }
);

surveyResponseSchema.index({ survey_id: 1, booking_id: 1 }, { unique: true });
surveyResponseSchema.index({ survey_id: 1, submitted_at: -1 });
surveyResponseSchema.index({ customer_id: 1, submitted_at: -1 });
surveyResponseSchema.index({ booking_id: 1 });
surveyResponseSchema.index({ wash_history_id: 1 });
surveyResponseSchema.index({ reward_transaction_id: 1 });

surveyResponseSchema.methods.toJSON = function () {
    const response = this.toObject();

    delete response.__v;

    return response;
};

const SurveyResponse = mongoose.model('SurveyResponse', surveyResponseSchema);

module.exports = SurveyResponse;
