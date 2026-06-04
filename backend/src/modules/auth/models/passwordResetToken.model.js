const mongoose = require('mongoose');

const passwordResetSchema = new mongoose.Schema(
    {
        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        phone: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        reset_token_hash: {
            type: String,
            required: true,
            unique: true,
        },
        expires_at: {
            type: Date,
            required: true,
        },
        attempt_count: {
            type: Number,
            default: 0,
        },
        is_used: {
            type: Boolean,
            default: false,
            index: true,
        },
        used_at: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
        collection: 'password_reset_tokens',
    }
);

passwordResetSchema.index({ phone: 1, expires_at: 1 });
passwordResetSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

const PasswordReset = mongoose.model('PasswordReset', passwordResetSchema);

module.exports = PasswordReset;