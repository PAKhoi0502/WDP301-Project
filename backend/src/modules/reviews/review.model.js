const mongoose = require('mongoose');

const {
    REVIEW_MODERATION_STATUSES,
    REVIEW_MODERATION_STATUS_VALUES,
    REVIEW_MODERATION_REASON_VALUES,
} = require('../../shared/constants/review.constant');

const garageSnapshotSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120,
        },
        garage_code: {
            type: String,
            trim: true,
            maxlength: 30,
            default: null,
        },
    },
    { _id: false }
);

const servicePackageSnapshotSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 150,
        },
        service_code: {
            type: String,
            trim: true,
            maxlength: 100,
            default: null,
        },
    },
    { _id: false }
);

const garageReplySchema = new mongoose.Schema(
    {
        content: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 1000,
        },
        replied_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        replied_at: {
            type: Date,
            required: true,
        },
        updated_at: {
            type: Date,
            required: true,
        },
    },
    { _id: false }
);

const reviewSchema = new mongoose.Schema(
    {
        booking_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking',
            required: true,
            unique: true,
        },
        wash_history_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'WashHistory',
            required: true,
            unique: true,
        },
        customer_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        garage_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Garage',
            required: true,
        },
        service_package_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ServicePackage',
            required: true,
        },
        garage_snapshot: {
            type: garageSnapshotSchema,
            required: true,
        },
        service_package_snapshot: {
            type: servicePackageSnapshotSchema,
            required: true,
        },
        garage_rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },
        service_rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },
        comment: {
            type: String,
            trim: true,
            maxlength: 2000,
            default: null,
        },
        upload_ids: {
            type: [
                {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Upload',
                },
            ],
            default: [],
            validate: {
                validator(uploadIds) {
                    const normalizedIds = uploadIds.map((uploadId) => uploadId.toString());

                    return new Set(normalizedIds).size === normalizedIds.length;
                },
                message: 'Upload ids must be unique',
            },
        },
        is_anonymous: {
            type: Boolean,
            default: false,
        },
        moderation_status: {
            type: String,
            enum: REVIEW_MODERATION_STATUS_VALUES,
            default: REVIEW_MODERATION_STATUSES.PUBLISHED,
        },
        moderation_reason: {
            type: String,
            enum: REVIEW_MODERATION_REASON_VALUES,
            default: null,
        },
        moderation_note: {
            type: String,
            trim: true,
            maxlength: 1000,
            default: null,
        },
        moderated_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        moderated_at: {
            type: Date,
            default: null,
        },
        garage_reply: {
            type: garageReplySchema,
            default: null,
        },
        deleted_at: {
            type: Date,
            default: null,
        },
        deleted_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
        collection: 'reviews',
    }
);

reviewSchema.index({ garage_id: 1, moderation_status: 1, deleted_at: 1, created_at: -1 });
reviewSchema.index({ service_package_id: 1, moderation_status: 1, deleted_at: 1, created_at: -1 });
reviewSchema.index({ customer_id: 1, deleted_at: 1, created_at: -1 });
reviewSchema.index({ moderation_status: 1, deleted_at: 1, created_at: -1 });
reviewSchema.index({ garage_id: 1, garage_rating: 1, moderation_status: 1, deleted_at: 1 });
reviewSchema.index({ service_package_id: 1, service_rating: 1, moderation_status: 1, deleted_at: 1 });

reviewSchema.pre('validate', function (next) {
    if (this.moderation_status === REVIEW_MODERATION_STATUSES.HIDDEN && !this.moderation_reason) {
        this.invalidate('moderation_reason', 'Moderation reason is required when review is hidden');
    }

    if (this.moderation_status === REVIEW_MODERATION_STATUSES.PUBLISHED) {
        this.moderation_reason = null;
    }

    if (this.deleted_at && !this.deleted_by) {
        this.invalidate('deleted_by', 'Deleted by is required when review is deleted');
    }

    next();
});

reviewSchema.methods.toJSON = function () {
    const review = this.toObject();

    delete review.__v;

    return review;
};

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
