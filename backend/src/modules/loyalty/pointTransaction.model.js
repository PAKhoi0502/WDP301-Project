const mongoose = require('mongoose');

const {
    POINT_TRANSACTION_TYPES,
    POINT_TRANSACTION_TYPE_VALUES,
} = require('../../shared/constants/loyalty.constant');

const pointTransactionSchema = new mongoose.Schema(
    {
        customer_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Customer is required'],
        },

        booking_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking',
            default: null,
        },

        type: {
            type: String,
            enum: POINT_TRANSACTION_TYPE_VALUES,
            required: [true, 'Point transaction type is required'],
        },

        points: {
            type: Number,
            required: [true, 'Points are required'],
        },

        remaining_points: {
            type: Number,
            min: [0, 'Remaining points must be greater than or equal to 0'],
            default: 0,
        },

        balance_before: {
            type: Number,
            min: [0, 'Balance before must be greater than or equal to 0'],
            required: [true, 'Balance before is required'],
        },

        balance_after: {
            type: Number,
            min: [0, 'Balance after must be greater than or equal to 0'],
            required: [true, 'Balance after is required'],
        },

        description: {
            type: String,
            trim: true,
            maxlength: [500, 'Description must not exceed 500 characters'],
            default: null,
        },

        earned_at: {
            type: Date,
            default: null,
        },

        expires_at: {
            type: Date,
            default: null,
        },

        expired_at: {
            type: Date,
            default: null,
        },

        source_transaction_ids: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'PointTransaction',
            },
        ],

        created_by: {
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
        collection: 'point_transactions',
    }
);

pointTransactionSchema.index({ customer_id: 1, created_at: -1 });
pointTransactionSchema.index({ booking_id: 1 });
pointTransactionSchema.index({ type: 1 });
pointTransactionSchema.index({ expires_at: 1, remaining_points: 1 });
pointTransactionSchema.index({ created_by: 1 });

pointTransactionSchema.pre('validate', function (next) {
    if ([POINT_TRANSACTION_TYPES.EARN, POINT_TRANSACTION_TYPES.REFUND].includes(this.type)) {
        if (this.points < 0) {
            this.invalidate('points', 'Earn and refund points must be positive');
        }

        if (this.remaining_points > this.points) {
            this.invalidate('remaining_points', 'Remaining points must not exceed points');
        }
    }

    if ([POINT_TRANSACTION_TYPES.REDEEM, POINT_TRANSACTION_TYPES.EXPIRE].includes(this.type) && this.points > 0) {
        this.invalidate('points', 'Redeem and expire points must be negative');
    }

    if (this.balance_after < 0) {
        this.invalidate('balance_after', 'Point balance must not be negative');
    }

    next();
});

pointTransactionSchema.methods.toJSON = function () {
    const transaction = this.toObject();

    delete transaction.__v;

    return transaction;
};

const PointTransaction = mongoose.model('PointTransaction', pointTransactionSchema);

module.exports = PointTransaction;
