const mongoose = require('mongoose');

const { VEHICLE_TYPE_VALUES } = require('../../shared/constants/vehicle.constant');
const { ANALYTICS_GROUP_BY_VALUES } = require('../../shared/constants/analytics.constant');
const {
    RESEARCH_REPORT_STATUSES,
    RESEARCH_REPORT_STATUS_VALUES,
    RESEARCH_REPORT_TYPES,
    RESEARCH_REPORT_TYPE_VALUES,
} = require('../../shared/constants/research.constant');

const researchFiltersSchema = new mongoose.Schema(
    {
        survey_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Survey',
            default: null,
        },

        from: {
            type: Date,
            default: null,
        },

        to: {
            type: Date,
            default: null,
        },

        garage_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Garage',
            default: null,
        },

        service_package_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ServicePackage',
            default: null,
        },

        vehicle_type: {
            type: String,
            enum: VEHICLE_TYPE_VALUES,
            default: null,
        },

        group_by: {
            type: String,
            enum: ANALYTICS_GROUP_BY_VALUES,
            default: 'DAY',
        },
    },
    {
        _id: false,
    }
);

const researchReportSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Title is required'],
            trim: true,
            minlength: [2, 'Title must be at least 2 characters'],
            maxlength: [200, 'Title must not exceed 200 characters'],
        },

        objective: {
            type: String,
            required: [true, 'Objective is required'],
            trim: true,
            minlength: [10, 'Objective must be at least 10 characters'],
            maxlength: [2000, 'Objective must not exceed 2000 characters'],
        },

        type: {
            type: String,
            enum: RESEARCH_REPORT_TYPE_VALUES,
            default: RESEARCH_REPORT_TYPES.SURVEY_INSIGHT,
            required: true,
        },

        status: {
            type: String,
            enum: RESEARCH_REPORT_STATUS_VALUES,
            default: RESEARCH_REPORT_STATUSES.DRAFT,
            required: true,
        },

        filters: {
            type: researchFiltersSchema,
            required: true,
        },

        data_snapshot: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },

        result: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },

        model: {
            type: String,
            trim: true,
            maxlength: [120, 'Model must not exceed 120 characters'],
            default: null,
        },

        prompt_version: {
            type: String,
            trim: true,
            maxlength: [100, 'Prompt version must not exceed 100 characters'],
            default: null,
        },

        usage_metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },

        error: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },

        created_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Creator is required'],
        },

        started_at: {
            type: Date,
            default: null,
        },

        completed_at: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
        collection: 'research_reports',
    }
);

researchReportSchema.index({ status: 1, created_at: -1 });
researchReportSchema.index({ type: 1, created_at: -1 });
researchReportSchema.index({ created_by: 1, created_at: -1 });
researchReportSchema.index({ 'filters.survey_id': 1, created_at: -1 });

researchReportSchema.pre('validate', function (next) {
    if (
        this.type === RESEARCH_REPORT_TYPES.SURVEY_INSIGHT
        && !this.filters?.survey_id
    ) {
        this.invalidate('filters.survey_id', 'Survey is required for survey insight');
    }

    if (this.filters?.from && this.filters?.to && this.filters.from > this.filters.to) {
        this.invalidate('filters.to', 'To date must be after or equal to from date');
    }

    next();
});

researchReportSchema.methods.toJSON = function () {
    const report = this.toObject();

    delete report.__v;

    return report;
};

const ResearchReport = mongoose.model('ResearchReport', researchReportSchema);

module.exports = ResearchReport;
