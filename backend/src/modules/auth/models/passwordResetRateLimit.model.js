const mongoose = require('mongoose');

const passwordResetRateLimitSchema = new mongoose.Schema(
    {
        phone: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            index: true,
        },
        window_started_at: {
            type: Date,
            required: true,
        },
        request_count: {
            type: Number,
            required: true,
            default: 0,
        },
        last_requested_at: {
            type: Date,
            required: true,
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
        collection: 'password_reset_rate_limits',
    }
);

passwordResetRateLimitSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

const PasswordResetRateLimit = mongoose.model(
    'PasswordResetRateLimit',
    passwordResetRateLimitSchema
);

module.exports = PasswordResetRateLimit;
