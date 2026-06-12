const ResearchReport = require('./researchReport.model');
const ResearchMapper = require('./research.mapper');
const researchDataService = require('./researchData.service');
const researchGeminiService = require('./researchGemini.service');
const auditLogService = require('../audit-logs/auditLog.service');
const { AppError } = require('../../shared/utils/appError');
const {
    RESEARCH_REPORT_STATUSES,
    RESEARCH_REPORT_TYPES,
} = require('../../shared/constants/research.constant');
const {
    AUDIT_ACTIONS,
    AUDIT_RESOURCE_TYPES,
} = require('../../shared/constants/audit.constant');

const populateReportQuery = (query) => {
    return query.populate('created_by', 'full_name email phone role is_active');
};

const getReportDocumentById = async (reportId) => {
    const report = await populateReportQuery(ResearchReport.findById(reportId));

    if (!report) {
        throw new AppError('Research report not found', 404, 'RESEARCH_REPORT_NOT_FOUND');
    }

    return report;
};

const getResearchReports = async ({
    page = 1,
    limit = 20,
    status,
    type,
    created_by,
    survey_id,
} = {}) => {
    const filter = {};

    if (status) {
        filter.status = status;
    }

    if (type) {
        filter.type = type;
    }

    if (created_by) {
        filter.created_by = created_by;
    }

    if (survey_id) {
        filter['filters.survey_id'] = survey_id;
    }

    const skip = (page - 1) * limit;
    const [reports, total] = await Promise.all([
        populateReportQuery(
            ResearchReport.find(filter)
                .sort({ created_at: -1 })
                .skip(skip)
                .limit(limit)
        ),
        ResearchReport.countDocuments(filter),
    ]);

    return {
        data: ResearchMapper.toResearchReportDtoList(reports),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

const getResearchReportById = async (reportId) => {
    const report = await getReportDocumentById(reportId);

    return ResearchMapper.toResearchReportDto(report);
};

const createResearchReport = async (user, payload, auditContext = {}) => {
    const report = await ResearchReport.create({
        title: payload.title,
        objective: payload.objective,
        type: payload.type || RESEARCH_REPORT_TYPES.SURVEY_INSIGHT,
        status: RESEARCH_REPORT_STATUSES.DRAFT,
        filters: payload.filters,
        created_by: user._id,
    });
    const populatedReport = await getReportDocumentById(report._id);
    const result = ResearchMapper.toResearchReportDto(populatedReport);

    await auditLogService.recordAuditEvent({
        actorId: user._id,
        action: AUDIT_ACTIONS.RESEARCH_CREATED,
        resourceType: AUDIT_RESOURCE_TYPES.RESEARCH_REPORT,
        resourceId: report._id,
        after: result,
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
    });

    return result;
};

const updateResearchReport = async (user, reportId, payload, auditContext = {}) => {
    const report = await getReportDocumentById(reportId);

    if (![RESEARCH_REPORT_STATUSES.DRAFT, RESEARCH_REPORT_STATUSES.FAILED].includes(report.status)) {
        throw new AppError(
            'Only draft or failed research report can be updated',
            409,
            'RESEARCH_REPORT_NOT_EDITABLE'
        );
    }

    const before = ResearchMapper.toResearchReportDto(report);

    if (payload.title !== undefined) {
        report.title = payload.title;
    }

    if (payload.objective !== undefined) {
        report.objective = payload.objective;
    }

    if (payload.filters !== undefined) {
        report.filters = payload.filters;
    }

    if (report.status === RESEARCH_REPORT_STATUSES.FAILED) {
        report.status = RESEARCH_REPORT_STATUSES.DRAFT;
        report.data_snapshot = null;
        report.result = null;
        report.model = null;
        report.prompt_version = null;
        report.usage_metadata = null;
        report.error = null;
        report.started_at = null;
        report.completed_at = null;
    }

    await report.save();

    const populatedReport = await getReportDocumentById(report._id);
    const result = ResearchMapper.toResearchReportDto(populatedReport);

    await auditLogService.recordAuditEvent({
        actorId: user._id,
        action: AUDIT_ACTIONS.RESEARCH_UPDATED,
        resourceType: AUDIT_RESOURCE_TYPES.RESEARCH_REPORT,
        resourceId: report._id,
        before,
        after: result,
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
    });

    return result;
};

const deleteResearchReport = async (user, reportId, auditContext = {}) => {
    const report = await getReportDocumentById(reportId);

    if (![RESEARCH_REPORT_STATUSES.DRAFT, RESEARCH_REPORT_STATUSES.FAILED].includes(report.status)) {
        throw new AppError(
            'Only draft or failed research report can be deleted',
            409,
            'RESEARCH_REPORT_NOT_DELETABLE'
        );
    }

    const before = ResearchMapper.toResearchReportDto(report);

    await ResearchReport.deleteOne({ _id: report._id });

    await auditLogService.recordAuditEvent({
        actorId: user._id,
        action: AUDIT_ACTIONS.RESEARCH_DELETED,
        resourceType: AUDIT_RESOURCE_TYPES.RESEARCH_REPORT,
        resourceId: report._id,
        before,
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
    });

    return before;
};

const serializeResearchError = (error) => ({
    code: error?.errorCode || 'RESEARCH_EXECUTION_FAILED',
    message: error?.message || 'Research execution failed',
    failed_at: new Date(),
});

const executeResearchReport = async ({
    user,
    reportId,
    expectedStatus,
    auditContext,
    reuseSnapshot,
}) => {
    const startedAt = new Date();
    const report = await ResearchReport.findOneAndUpdate(
        {
            _id: reportId,
            status: expectedStatus,
        },
        {
            $set: {
                status: RESEARCH_REPORT_STATUSES.PROCESSING,
                started_at: startedAt,
                completed_at: null,
                error: null,
            },
        },
        {
            new: true,
        }
    );

    if (!report) {
        const existingReport = await ResearchReport.findById(reportId);

        if (!existingReport) {
            throw new AppError('Research report not found', 404, 'RESEARCH_REPORT_NOT_FOUND');
        }

        throw new AppError(
            expectedStatus === RESEARCH_REPORT_STATUSES.FAILED
                ? 'Only failed research report can be retried'
                : 'Only draft research report can be run',
            409,
            expectedStatus === RESEARCH_REPORT_STATUSES.FAILED
                ? 'RESEARCH_REPORT_RETRY_NOT_ALLOWED'
                : 'RESEARCH_REPORT_RUN_NOT_ALLOWED'
        );
    }

    let completionContext;

    try {
        await auditLogService.recordAuditEvent({
            actorId: user._id,
            action: AUDIT_ACTIONS.RESEARCH_STARTED,
            resourceType: AUDIT_RESOURCE_TYPES.RESEARCH_REPORT,
            resourceId: report._id,
            after: {
                status: RESEARCH_REPORT_STATUSES.PROCESSING,
                started_at: startedAt,
            },
            ip: auditContext.ip,
            userAgent: auditContext.userAgent,
        });

        const snapshot = reuseSnapshot && report.data_snapshot
            ? report.data_snapshot
            : await researchDataService.buildResearchSnapshot(report);

        if (!reuseSnapshot || !report.data_snapshot) {
            await ResearchReport.updateOne(
                {
                    _id: report._id,
                    status: RESEARCH_REPORT_STATUSES.PROCESSING,
                },
                {
                    $set: {
                        data_snapshot: snapshot,
                    },
                }
            );
        }

        const generated = await researchGeminiService.generateSurveyInsight(
            snapshot,
            report.objective
        );
        const completedAt = new Date();
        const completedReport = await ResearchReport.findOneAndUpdate(
            {
                _id: report._id,
                status: RESEARCH_REPORT_STATUSES.PROCESSING,
            },
            {
                $set: {
                    status: RESEARCH_REPORT_STATUSES.COMPLETED,
                    data_snapshot: snapshot,
                    result: generated.result,
                    model: generated.model,
                    prompt_version: generated.prompt_version,
                    usage_metadata: generated.usage_metadata,
                    error: null,
                    completed_at: completedAt,
                },
            },
            {
                new: true,
            }
        );

        if (!completedReport) {
            throw new AppError(
                'Research report state changed during execution',
                409,
                'RESEARCH_REPORT_STATE_CONFLICT'
            );
        }

        completionContext = {
            generated,
            snapshot,
            completedAt,
        };
    } catch (error) {
        const serializedError = serializeResearchError(error);
        const failedReport = await ResearchReport.findOneAndUpdate(
            {
                _id: report._id,
                status: RESEARCH_REPORT_STATUSES.PROCESSING,
            },
            {
                $set: {
                    status: RESEARCH_REPORT_STATUSES.FAILED,
                    error: serializedError,
                    completed_at: new Date(),
                },
            },
            {
                new: true,
            }
        );

        await auditLogService.recordAuditEvent({
            actorId: user._id,
            action: AUDIT_ACTIONS.RESEARCH_FAILED,
            resourceType: AUDIT_RESOURCE_TYPES.RESEARCH_REPORT,
            resourceId: report._id,
            after: {
                status: RESEARCH_REPORT_STATUSES.FAILED,
                error_code: serializedError.code,
                completed_at: failedReport?.completed_at || serializedError.failed_at,
            },
            ip: auditContext.ip,
            userAgent: auditContext.userAgent,
        });

        throw error;
    }

    await auditLogService.recordAuditEvent({
        actorId: user._id,
        action: AUDIT_ACTIONS.RESEARCH_COMPLETED,
        resourceType: AUDIT_RESOURCE_TYPES.RESEARCH_REPORT,
        resourceId: report._id,
        after: {
            status: RESEARCH_REPORT_STATUSES.COMPLETED,
            model: completionContext.generated.model,
            prompt_version: completionContext.generated.prompt_version,
            snapshot_hash: completionContext.snapshot.snapshot_hash,
            completed_at: completionContext.completedAt,
        },
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
    });

    const populatedReport = await getReportDocumentById(report._id);

    return ResearchMapper.toResearchReportDto(populatedReport);
};

const runResearchReport = async (user, reportId, auditContext = {}) => {
    return executeResearchReport({
        user,
        reportId,
        expectedStatus: RESEARCH_REPORT_STATUSES.DRAFT,
        auditContext,
        reuseSnapshot: false,
    });
};

const retryResearchReport = async (user, reportId, auditContext = {}) => {
    return executeResearchReport({
        user,
        reportId,
        expectedStatus: RESEARCH_REPORT_STATUSES.FAILED,
        auditContext,
        reuseSnapshot: true,
    });
};

module.exports = {
    getResearchReports,
    getResearchReportById,
    createResearchReport,
    updateResearchReport,
    deleteResearchReport,
    runResearchReport,
    retryResearchReport,
};
