const mongoose = require('mongoose');

const {
    SURVEY_STATUSES,
    SURVEY_STATUS_VALUES,
    SURVEY_QUESTION_TYPES,
    SURVEY_QUESTION_TYPE_VALUES,
} = require('../../shared/constants/survey.constant');

const surveyQuestionSchema = new mongoose.Schema(
    {
        text: {
            type: String,
            required: [true, 'Question text is required'],
            trim: true,
            maxlength: [500, 'Question text must not exceed 500 characters'],
        },

        type: {
            type: String,
            enum: SURVEY_QUESTION_TYPE_VALUES,
            required: [true, 'Question type is required'],
        },

        is_required: {
            type: Boolean,
            default: false,
        },

        options: {
            type: [
                {
                    type: String,
                    trim: true,
                    maxlength: [200, 'Question option must not exceed 200 characters'],
                },
            ],
            default: [],
            validate: {
                validator(options) {
                    const isChoiceQuestion = [
                        SURVEY_QUESTION_TYPES.SINGLE_CHOICE,
                        SURVEY_QUESTION_TYPES.MULTI_CHOICE,
                    ].includes(this.type);
                    const normalizedOptions = options.map((option) => option.trim());

                    if (new Set(normalizedOptions).size !== normalizedOptions.length) {
                        return false;
                    }

                    return isChoiceQuestion
                        ? normalizedOptions.length >= 2 && normalizedOptions.every(Boolean)
                        : normalizedOptions.length === 0;
                },
                message: 'Question options do not match question type',
            },
        },

        order: {
            type: Number,
            required: [true, 'Question order is required'],
            min: [1, 'Question order must be at least 1'],
        },
    }
);

const surveySchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Title is required'],
            trim: true,
            maxlength: [200, 'Title must not exceed 200 characters'],
        },

        description: {
            type: String,
            trim: true,
            maxlength: [2000, 'Description must not exceed 2000 characters'],
            default: null,
        },

        status: {
            type: String,
            enum: SURVEY_STATUS_VALUES,
            default: SURVEY_STATUSES.DRAFT,
        },

        questions: {
            type: [surveyQuestionSchema],
            default: [],
            validate: {
                validator(questions) {
                    const orders = questions.map((question) => question.order);

                    return new Set(orders).size === orders.length;
                },
                message: 'Question order must be unique',
            },
        },

        response_window_days: {
            type: Number,
            min: [1, 'Response window must be at least 1 day'],
            max: [365, 'Response window must not exceed 365 days'],
            default: 7,
        },

        created_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Creator is required'],
        },

        published_at: {
            type: Date,
            default: null,
        },

        closed_at: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
        collection: 'surveys',
    }
);

surveySchema.index({ status: 1, published_at: -1 });
surveySchema.index({ created_by: 1, created_at: -1 });
surveySchema.index({ created_at: -1 });

surveySchema.path('status').validate(function (status) {
    if (status === SURVEY_STATUSES.PUBLISHED) {
        return !!this.published_at && this.questions.length > 0;
    }

    if (status === SURVEY_STATUSES.CLOSED) {
        return !!this.closed_at;
    }

    return true;
}, 'Survey status state is invalid');

surveySchema.methods.toJSON = function () {
    const survey = this.toObject();

    delete survey.__v;

    return survey;
};

const Survey = mongoose.model('Survey', surveySchema);

module.exports = Survey;
