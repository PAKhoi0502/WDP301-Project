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

const toAuditLogDto = (auditLog) => {
    if (!auditLog) {
        return null;
    }

    const plainAuditLog = auditLog.toObject ? auditLog.toObject() : auditLog;

    return {
        id: plainAuditLog._id?.toString() || plainAuditLog.id || null,
        actor_id: toId(plainAuditLog.actor_id),
        actor: toUserSummaryDto(plainAuditLog.actor_id),
        action: plainAuditLog.action,
        resource_type: plainAuditLog.resource_type,
        resource_id: toId(plainAuditLog.resource_id),
        before: plainAuditLog.before ?? null,
        after: plainAuditLog.after ?? null,
        ip: plainAuditLog.ip || null,
        user_agent: plainAuditLog.user_agent || null,
        metadata: plainAuditLog.metadata || {},
        created_at: plainAuditLog.created_at,
    };
};

const toAuditLogDtoList = (auditLogs = []) => {
    return auditLogs.map((auditLog) => toAuditLogDto(auditLog));
};

module.exports = {
    toAuditLogDto,
    toAuditLogDtoList,
};
