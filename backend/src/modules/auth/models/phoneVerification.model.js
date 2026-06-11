const mongoose = require('mongoose');

const {
    PHONE_VERIFICATION_PURPOSE_VALUES,
} = require('../phoneVerification.constant');

const phoneVerificationSchema = new mongoose.Schema(
    {
        phone: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        purpose: {
            type: String,
            enum: PHONE_VERIFICATION_PURPOSE_VALUES,
            required: true,
            index: true,
        },
        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
            index: true,
        },
        otp_hash: {
            type: String,
            required: true,
        },
        verification_token_hash: {
            type: String,
            default: null,
            index: true,
        },
        attempt_count: {
            type: Number,
            default: 0,
            min: 0,
        },
        request_ip: {
            type: String,
            trim: true,
            default: '',
            index: true,
        },
        user_agent: {
            type: String,
            trim: true,
            default: '',
        },
        expires_at: {
            type: Date,
            required: true,
            index: true,
        },
        verified_at: {
            type: Date,
            default: null,
        },
        consumed_at: {
            type: Date,
            default: null,
        },
        invalidated_at: {
            type: Date,
            default: null,
        },
        delete_at: {
            type: Date,
            required: true,
        },
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
        collection: 'phone_verifications',
    }
);

phoneVerificationSchema.index({ phone: 1, purpose: 1, created_at: -1 });
phoneVerificationSchema.index({ request_ip: 1, created_at: -1 });
phoneVerificationSchema.index({ delete_at: 1 }, { expireAfterSeconds: 0 });

const PhoneVerification = mongoose.model(
    'PhoneVerification',
    phoneVerificationSchema
);

module.exports = PhoneVerification;
