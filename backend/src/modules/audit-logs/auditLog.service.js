const AuditLog = require('./auditLog.model');
const AuditLogMapper = require('./auditLog.mapper');

const SENSITIVE_KEYS = new Set([
    'password',
    'password_hash',
    'current_password',
    'new_password',
    'confirm_password',
    'access_token',
    'refresh_token',
    'token',
    'api_key',
    'api_secret',
    'client_secret',
    'checksum_key',
    'signature',
    'authorization',
    'cookie',
]);

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

const normalizeAuditKey = (value) => {
    return normalizeText(value)?.toUpperCase() || null;
};

const toPlainValue = (value) => {
    if (value && typeof value.toObject === 'function') {
        return value.toObject();
    }

    return value;
};

const sanitizeAuditValue = (value, seen = new WeakSet()) => {
    const plainValue = toPlainValue(value);

    if (plainValue === null || plainValue === undefined) {
        return null;
    }

    if (plainValue instanceof Date) {
        return plainValue;
    }

    if (Buffer.isBuffer(plainValue)) {
        return `[BUFFER:${plainValue.length}]`;
    }

    if (plainValue?._bsontype === 'ObjectId') {
        return plainValue.toString();
    }

    if (Array.isArray(plainValue)) {
        return plainValue.map((item) => sanitizeAuditValue(item, seen));
    }

    if (typeof plainValue !== 'object') {
        return plainValue;
    }

    if (seen.has(plainValue)) {
        return '[CIRCULAR]';
    }

    seen.add(plainValue);

    const sanitized = {};

    for (const [key, item] of Object.entries(plainValue)) {
        if (SENSITIVE_KEYS.has(key.toLowerCase())) {
            sanitized[key] = '[REDACTED]';
            continue;
        }

        sanitized[key] = sanitizeAuditValue(item, seen);
    }

    seen.delete(plainValue);

    return sanitized;
};

const populateAuditLogQuery = (query) => {
    return query.populate('actor_id', 'full_name email phone role is_active');
};

const recordAuditEvent = async ({
    actorId = null,
    action,
    resourceType,
    resourceId,
    before = null,
    after = null,
    ip = null,
    userAgent = null,
    metadata = {},
    session = null,
}) => {
    const payload = {
        actor_id: actorId,
        action: normalizeAuditKey(action),
        resource_type: normalizeAuditKey(resourceType),
        resource_id: resourceId,
        before: sanitizeAuditValue(before),
        after: sanitizeAuditValue(after),
        ip: normalizeText(ip),
        user_agent: normalizeText(userAgent),
        metadata: sanitizeAuditValue(metadata) || {},
    };

    let auditLog;

    if (session) {
        const documents = await AuditLog.create([payload], { session });

        [auditLog] = documents;
    } else {
        auditLog = await AuditLog.create(payload);
    }

    return AuditLogMapper.toAuditLogDto(auditLog);
};

const buildDateRangeFilter = ({ from, to } = {}) => {
    if (!from && !to) {
        return null;
    }

    const range = {};

    if (from) {
        range.$gte = from;
    }

    if (to) {
        range.$lte = to;
    }

    return range;
};

const buildAuditLogFilter = ({ actor_id, action, resource_type, resource_id, ip, from, to } = {}) => {
    const filter = {};
    const createdAtRange = buildDateRangeFilter({ from, to });

    if (actor_id) {
        filter.actor_id = actor_id;
    }

    if (action) {
        filter.action = normalizeAuditKey(action);
    }

    if (resource_type) {
        filter.resource_type = normalizeAuditKey(resource_type);
    }

    if (resource_id) {
        filter.resource_id = resource_id;
    }

    if (ip) {
        filter.ip = ip;
    }

    if (createdAtRange) {
        filter.created_at = createdAtRange;
    }

    return filter;
};

const getAuditLogs = async ({ page = 1, limit = 20, actor_id, action, resource_type, resource_id, ip, from, to } = {}) => {
    const filter = buildAuditLogFilter({
        actor_id,
        action,
        resource_type,
        resource_id,
        ip,
        from,
        to,
    });
    const skip = (page - 1) * limit;

    const [auditLogs, total] = await Promise.all([
        populateAuditLogQuery(
            AuditLog.find(filter)
                .sort({ created_at: -1 })
                .skip(skip)
                .limit(limit)
        ),
        AuditLog.countDocuments(filter),
    ]);

    return {
        data: AuditLogMapper.toAuditLogDtoList(auditLogs),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

const getAuditRequestContext = (req) => {
    return {
        ip: normalizeText(req?.ip),
        userAgent: normalizeText(req?.get?.('user-agent')),
    };
};

module.exports = {
    recordAuditEvent,
    getAuditLogs,
    getAuditRequestContext,
};
