const mongoose = require('mongoose');

const {
    UPLOAD_PURPOSES,
    UPLOAD_PURPOSE_VALUES,
    UPLOAD_RELATED_TYPE_VALUES,
} = require('../../shared/constants/upload.constant');

const uploadSchema = new mongoose.Schema(
    {
        url: {
            type: String,
            required: [true, 'URL is required'],
            trim: true,
            maxlength: [1000, 'URL must not exceed 1000 characters'],
        },

        public_id: {
            type: String,
            required: [true, 'Public id is required'],
            trim: true,
            maxlength: [255, 'Public id must not exceed 255 characters'],
            unique: true,
        },

        mime_type: {
            type: String,
            required: [true, 'MIME type is required'],
            trim: true,
            maxlength: [120, 'MIME type must not exceed 120 characters'],
        },

        size: {
            type: Number,
            required: [true, 'Size is required'],
            min: [0, 'Size must be greater than or equal to 0'],
        },

        width: { type: Number, min: 1, default: null },
        height: { type: Number, min: 1, default: null },

        purpose: {
            type: String,
            enum: UPLOAD_PURPOSE_VALUES,
            default: UPLOAD_PURPOSES.GENERAL,
            required: [true, 'Purpose is required'],
        },

        owner_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Owner is required'],
        },

        related_type: {
            type: String,
            enum: UPLOAD_RELATED_TYPE_VALUES,
            default: null,
        },

        related_id: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },
        retained_until: { type: Date, default: null },
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
        collection: 'uploads',
    }
);

uploadSchema.index({ owner_id: 1, created_at: -1 });
uploadSchema.index({ purpose: 1, created_at: -1 });
uploadSchema.index({ related_type: 1, related_id: 1 });
uploadSchema.index({ mime_type: 1 });
uploadSchema.index({ created_at: -1 });

uploadSchema.pre('validate', function (next) {
    if (this.related_type && !this.related_id) {
        this.invalidate('related_id', 'Related id is required when related type is provided');
    }

    if (!this.related_type && this.related_id) {
        this.invalidate('related_type', 'Related type is required when related id is provided');
    }

    next();
});

uploadSchema.methods.toJSON = function () {
    const upload = this.toObject();

    delete upload.__v;

    return upload;
};

const Upload = mongoose.model('Upload', uploadSchema);

module.exports = Upload;
