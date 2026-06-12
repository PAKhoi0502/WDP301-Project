jest.mock('./researchReport.model', () => ({
    create: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
    countDocuments: jest.fn(),
    deleteOne: jest.fn(),
}));

jest.mock('./researchData.service', () => ({
    buildResearchSnapshot: jest.fn(),
}));

jest.mock('./researchGemini.service', () => ({
    generateSurveyInsight: jest.fn(),
}));

jest.mock('../audit-logs/auditLog.service', () => ({
    recordAuditEvent: jest.fn(),
}));

const ResearchReport = require('./researchReport.model');
const researchDataService = require('./researchData.service');
const researchGeminiService = require('./researchGemini.service');
const auditLogService = require('../audit-logs/auditLog.service');
const researchService = require('./research.service');

describe('research service', () => {
    const adminUser = {
        _id: '507f1f77bcf86cd799439001',
        role: 'ADMIN',
    };
    const reportId = '507f1f77bcf86cd799439002';
    const surveyId = '507f1f77bcf86cd799439003';

    const createReport = (overrides = {}) => ({
        _id: reportId,
        title: 'Survey research',
        objective: 'Analyze customer satisfaction',
        type: 'SURVEY_INSIGHT',
        status: 'DRAFT',
        filters: {
            survey_id: surveyId,
            group_by: 'DAY',
        },
        data_snapshot: null,
        result: null,
        model: null,
        prompt_version: null,
        usage_metadata: null,
        error: null,
        created_by: adminUser._id,
        started_at: null,
        completed_at: null,
        created_at: new Date(),
        updated_at: new Date(),
        save: jest.fn().mockResolvedValue(undefined),
        ...overrides,
    });

    const createPopulateQuery = (value) => ({
        populate: jest.fn().mockResolvedValue(value),
    });

    beforeEach(() => {
        jest.clearAllMocks();
        auditLogService.recordAuditEvent.mockResolvedValue(null);
        ResearchReport.updateOne.mockResolvedValue({ modifiedCount: 1 });
    });

    it('creates a draft report and records audit', async () => {
        const report = createReport();

        ResearchReport.create.mockResolvedValue({ _id: reportId });
        ResearchReport.findById.mockReturnValue(createPopulateQuery(report));

        const result = await researchService.createResearchReport(adminUser, {
            title: report.title,
            objective: report.objective,
            type: report.type,
            filters: report.filters,
        });

        expect(ResearchReport.create).toHaveBeenCalledWith(expect.objectContaining({
            status: 'DRAFT',
            created_by: adminUser._id,
        }));
        expect(auditLogService.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
            action: 'RESEARCH_CREATED',
            resourceType: 'RESEARCH_REPORT',
        }));
        expect(result.status).toBe('DRAFT');
    });

    it('runs a draft report atomically to completion', async () => {
        const processingReport = createReport({
            status: 'PROCESSING',
        });
        const completedReport = createReport({
            status: 'COMPLETED',
            data_snapshot: {
                snapshot_hash: 'snapshot-hash',
            },
            result: {
                executive_summary: 'Summary',
            },
            model: 'gemini-2.5-flash',
            prompt_version: 'survey-insight-v1',
        });
        const snapshot = {
            snapshot_hash: 'snapshot-hash',
        };

        ResearchReport.findOneAndUpdate
            .mockResolvedValueOnce(processingReport)
            .mockResolvedValueOnce(completedReport);
        researchDataService.buildResearchSnapshot.mockResolvedValue(snapshot);
        researchGeminiService.generateSurveyInsight.mockResolvedValue({
            result: completedReport.result,
            model: completedReport.model,
            prompt_version: completedReport.prompt_version,
            usage_metadata: null,
        });
        ResearchReport.findById.mockReturnValue(createPopulateQuery(completedReport));

        const result = await researchService.runResearchReport(adminUser, reportId);

        expect(ResearchReport.findOneAndUpdate).toHaveBeenNthCalledWith(
            1,
            {
                _id: reportId,
                status: 'DRAFT',
            },
            expect.objectContaining({
                $set: expect.objectContaining({
                    status: 'PROCESSING',
                }),
            }),
            {
                new: true,
            }
        );
        expect(researchDataService.buildResearchSnapshot).toHaveBeenCalledWith(processingReport);
        expect(researchGeminiService.generateSurveyInsight).toHaveBeenCalledWith(
            snapshot,
            processingReport.objective
        );
        expect(result.status).toBe('COMPLETED');
        expect(auditLogService.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
            action: 'RESEARCH_COMPLETED',
        }));
    });

    it('moves report to failed when Gemini fails', async () => {
        const processingReport = createReport({
            status: 'PROCESSING',
        });
        const error = Object.assign(new Error('quota'), {
            errorCode: 'GEMINI_QUOTA_EXCEEDED',
        });

        ResearchReport.findOneAndUpdate
            .mockResolvedValueOnce(processingReport)
            .mockResolvedValueOnce(createReport({ status: 'FAILED' }));
        researchDataService.buildResearchSnapshot.mockResolvedValue({
            snapshot_hash: 'snapshot-hash',
        });
        researchGeminiService.generateSurveyInsight.mockRejectedValue(error);

        await expect(
            researchService.runResearchReport(adminUser, reportId)
        ).rejects.toBe(error);

        expect(ResearchReport.findOneAndUpdate).toHaveBeenNthCalledWith(
            2,
            {
                _id: reportId,
                status: 'PROCESSING',
            },
            expect.objectContaining({
                $set: expect.objectContaining({
                    status: 'FAILED',
                    error: expect.objectContaining({
                        code: 'GEMINI_QUOTA_EXCEEDED',
                    }),
                }),
            }),
            {
                new: true,
            }
        );
        expect(auditLogService.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
            action: 'RESEARCH_FAILED',
        }));
    });

    it('rejects running a report that is not draft', async () => {
        ResearchReport.findOneAndUpdate.mockResolvedValue(null);
        ResearchReport.findById.mockResolvedValue(createReport({
            status: 'PROCESSING',
        }));

        await expect(
            researchService.runResearchReport(adminUser, reportId)
        ).rejects.toMatchObject({
            statusCode: 409,
            errorCode: 'RESEARCH_REPORT_RUN_NOT_ALLOWED',
        });
        expect(researchDataService.buildResearchSnapshot).not.toHaveBeenCalled();
    });

    it('rejects editing a completed report', async () => {
        ResearchReport.findById.mockReturnValue(createPopulateQuery(createReport({
            status: 'COMPLETED',
        })));

        await expect(
            researchService.updateResearchReport(adminUser, reportId, {
                title: 'Changed title',
            })
        ).rejects.toMatchObject({
            statusCode: 409,
            errorCode: 'RESEARCH_REPORT_NOT_EDITABLE',
        });
    });

    it('retries a failed report using its saved snapshot', async () => {
        const snapshot = {
            snapshot_hash: 'saved-snapshot',
        };
        const processingReport = createReport({
            status: 'PROCESSING',
            data_snapshot: snapshot,
        });
        const completedReport = createReport({
            status: 'COMPLETED',
            data_snapshot: snapshot,
            result: {
                executive_summary: 'Summary',
            },
        });

        ResearchReport.findOneAndUpdate
            .mockResolvedValueOnce(processingReport)
            .mockResolvedValueOnce(completedReport);
        researchGeminiService.generateSurveyInsight.mockResolvedValue({
            result: completedReport.result,
            model: 'gemini-2.5-flash',
            prompt_version: 'survey-insight-v1',
            usage_metadata: null,
        });
        ResearchReport.findById.mockReturnValue(createPopulateQuery(completedReport));

        await researchService.retryResearchReport(adminUser, reportId);

        expect(researchDataService.buildResearchSnapshot).not.toHaveBeenCalled();
        expect(researchGeminiService.generateSurveyInsight).toHaveBeenCalledWith(
            snapshot,
            processingReport.objective
        );
    });
});
