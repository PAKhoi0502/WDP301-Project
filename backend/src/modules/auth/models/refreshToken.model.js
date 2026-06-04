const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema(
    {
        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        jti: {
            type: String,
            required: true,
            unique: true,
        },
        token_hash: {
            type: String,
            required: true,
            unique: true,
        },
        user_agent: {
            type: String,
            default: '',
            trim: true,
        },
        ip_address: {
            type: String,
            default: '',
            trim: true,
        },
        is_revoked: {
            type: Boolean,
            default: false,
            index: true,
        },
        revoked_at: {
            type: Date,
            default: null,
        },
        revoked_reason: {
            type: String,
            default: '',
            trim: true,
        },
        replaced_by_jti: {
            type: String,
            default: null,
        },
        expires_at: {
            type: Date,
            required: true,
        },
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
        collection: 'refresh_tokens',
    }
);

refreshTokenSchema.index({ user_id: 1, created_at: -1 });
refreshTokenSchema.index({ user_id: 1, is_revoked: 1 });
refreshTokenSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

module.exports = RefreshToken;