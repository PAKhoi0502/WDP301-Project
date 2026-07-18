const mongoose = require('mongoose');

const {
    CUSTOMER_CASE_TECHNICAL_ASSESSMENT_STATUSES,
    CUSTOMER_CASE_TECHNICAL_ASSESSMENT_STATUS_VALUES,
} = require('../../shared/constants/customerCase.constant');

const schema = new mongoose.Schema({
    case_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerCase', required: true, unique: true },
    garage_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Garage', required: true },
    inspector_staff_profile_id: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffProfile', required: true },
    inspector_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assigned_by_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assigned_at: { type: Date, required: true },
    status: {
        type: String,
        enum: CUSTOMER_CASE_TECHNICAL_ASSESSMENT_STATUS_VALUES,
        default: CUSTOMER_CASE_TECHNICAL_ASSESSMENT_STATUSES.ASSIGNED,
    },
    started_at: { type: Date, default: null },
    findings: { type: String, trim: true, maxlength: 5000, default: null },
    root_cause: { type: String, trim: true, maxlength: 3000, default: null },
    severity: { type: String, enum: ['MINOR', 'MODERATE', 'MAJOR', 'SAFETY_CRITICAL'], default: null },
    recommended_resolution: { type: String, trim: true, maxlength: 3000, default: null },
    upload_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Upload' }],
    submitted_at: { type: Date, default: null },
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'customer_case_technical_assessments',
});

schema.index({ inspector_user_id: 1, status: 1, assigned_at: -1 });

schema.pre('validate', function (next) {
    if (this.status === CUSTOMER_CASE_TECHNICAL_ASSESSMENT_STATUSES.IN_PROGRESS && !this.started_at) {
        this.invalidate('started_at', 'Start time is required');
    }
    if (this.status === CUSTOMER_CASE_TECHNICAL_ASSESSMENT_STATUSES.SUBMITTED
        && (!this.findings || !this.root_cause || !this.severity || !this.recommended_resolution || !this.submitted_at)) {
        this.invalidate('findings', 'Submitted technical assessment is incomplete');
    }
    next();
});

module.exports = mongoose.model('CustomerCaseTechnicalAssessment', schema);
