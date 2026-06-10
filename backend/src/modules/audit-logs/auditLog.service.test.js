jest.mock('./auditLog.model', () => ({
    create: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
}));

const AuditLog = require('./auditLog.model');
const auditLogService = require('./auditLog.service');

describe('audit log service', () => {
    const createAuditLogDocument = (overrides = {}) => ({
        _id: '507f1f77bcf86cd799439011',
        actor_id: '507f1f77bcf86cd799439012',
        action: 'UPLOAD_CREATED',
        resource_type: 'UPLOAD',
        resource_id: '507f1f77bcf86cd799439013',
        before: null,
        after: {
            id: '507f1f77bcf86cd799439013',
        },
        ip: '127.0.0.1',
        user_agent: 'Jest',
        metadata: {},
        created_at: new Date('2026-06-10T00:00:00.000Z'),
        ...overrides,
    });

    const createFindListQuery = (value) => {
        const query = {
            sort: jest.fn(() => query),
            skip: jest.fn(() => query),
            limit: jest.fn(() => query),
            populate: jest.fn().mockResolvedValue(value),
        };

        return query;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        AuditLog.create.mockReset();
        AuditLog.find.mockReset();
        AuditLog.countDocuments.mockReset();
    });

    it('records normalized audit event and redacts sensitive values', async () => {
        const auditLog = createAuditLogDocument();

        AuditLog.create.mockImplementation(async (payload) => ({
            ...auditLog,
            ...payload,
        }));

        const result = await auditLogService.recordAuditEvent({
            actorId: auditLog.actor_id,
            action: 'upload_created',
            resourceType: 'upload',
            resourceId: auditLog.resource_id,
            after: {
                email: 'customer@example.com',
                password_hash: 'secret',
                nested: {
                    access_token: 'token',
                },
            },
            ip: '127.0.0.1',
            userAgent: 'Jest',
        });

        expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
            action: 'UPLOAD_CREATED',
            resource_type: 'UPLOAD',
            after: {
                email: 'customer@example.com',
                password_hash: '[REDACTED]',
                nested: {
                    access_token: '[REDACTED]',
                },
            },
        }));
        expect(result.action).toBe('UPLOAD_CREATED');
    });

    it('supports transaction sessions', async () => {
        const auditLog = createAuditLogDocument();
        const session = {};

        AuditLog.create.mockResolvedValue([auditLog]);

        await auditLogService.recordAuditEvent({
            action: 'CREATE',
            resourceType: 'BOOKING',
            resourceId: auditLog.resource_id,
            session,
        });

        expect(AuditLog.create).toHaveBeenCalledWith(
            [expect.objectContaining({
                action: 'CREATE',
                resource_type: 'BOOKING',
            })],
            { session }
        );
    });

    it('gets filtered audit logs with pagination', async () => {
        const auditLogs = [createAuditLogDocument()];
        const from = new Date('2026-06-01T00:00:00.000Z');
        const to = new Date('2026-06-10T23:59:59.999Z');

        AuditLog.find.mockReturnValue(createFindListQuery(auditLogs));
        AuditLog.countDocuments.mockResolvedValue(1);

        const result = await auditLogService.getAuditLogs({
            page: 2,
            limit: 5,
            action: 'upload_created',
            resource_type: 'upload',
            from,
            to,
        });

        expect(AuditLog.find).toHaveBeenCalledWith({
            action: 'UPLOAD_CREATED',
            resource_type: 'UPLOAD',
            created_at: {
                $gte: from,
                $lte: to,
            },
        });
        expect(result.meta).toEqual({
            page: 2,
            limit: 5,
            total: 1,
            total_pages: 1,
        });
        expect(result.data).toHaveLength(1);
    });
});
