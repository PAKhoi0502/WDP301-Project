const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
    {
        actor_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

        action: {
            type: String,
            required: [true, 'Action is required'],
            trim: true,
            uppercase: true,
            maxlength: [100, 'Action must not exceed 100 characters'],
            match: [/^[A-Z][A-Z0-9_]*$/, 'Action format is invalid'],
        },

        resource_type: {
            type: String,
            required: [true, 'Resource type is required'],
            trim: true,
            uppercase: true,
            maxlength: [100, 'Resource type must not exceed 100 characters'],
            match: [/^[A-Z][A-Z0-9_]*$/, 'Resource type format is invalid'],
        },

        resource_id: {
            type: mongoose.Schema.Types.ObjectId,
            required: [true, 'Resource id is required'],
        },

        before: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },

        after: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },

        ip: {
            type: String,
            trim: true,
            maxlength: [64, 'IP must not exceed 64 characters'],
            default: null,
        },

        user_agent: {
            type: String,
            trim: true,
            maxlength: [1000, 'User agent must not exceed 1000 characters'],
            default: null,
        },

        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: false,
        },
        collection: 'audit_logs',
    }
);

auditLogSchema.index({ created_at: -1 });
auditLogSchema.index({ actor_id: 1, created_at: -1 });
auditLogSchema.index({ action: 1, created_at: -1 });
auditLogSchema.index({ resource_type: 1, resource_id: 1, created_at: -1 });
auditLogSchema.index({ ip: 1, created_at: -1 });

auditLogSchema.methods.toJSON = function () {
    const auditLog = this.toObject();

    delete auditLog.__v;

    return auditLog;
};

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
