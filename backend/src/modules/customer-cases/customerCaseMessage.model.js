const mongoose = require('mongoose');

const { USER_ROLE_VALUES } = require('../../shared/constants/roles.constant');

const customerCaseMessageSchema = new mongoose.Schema(
    {
        case_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerCase', required: true },
        sender_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        sender_role: { type: String, enum: USER_ROLE_VALUES, required: true },
        message: {
            type: String,
            required: [true, 'Message is required'],
            trim: true,
            minlength: [1, 'Message is required'],
            maxlength: [2000, 'Message must not exceed 2000 characters'],
        },
        upload_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Upload' }],
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: false },
        collection: 'customer_case_messages',
    }
);

customerCaseMessageSchema.index({ case_id: 1, created_at: 1 });
customerCaseMessageSchema.index({ sender_id: 1, created_at: -1 });

customerCaseMessageSchema.methods.toJSON = function () {
    const message = this.toObject();
    delete message.__v;
    return message;
};

module.exports = mongoose.model('CustomerCaseMessage', customerCaseMessageSchema);
