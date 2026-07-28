const mongoose = require('mongoose');

const loyaltyRedeemRuleSchema = new mongoose.Schema(
    {
        rule_code: {
            type: String,
            trim: true,
            uppercase: true,
            minlength: [3, 'Redeem rule code must be at least 3 characters'],
            maxlength: [100, 'Redeem rule code must not exceed 100 characters'],
            match: [/^[A-Z0-9_]+$/, 'Redeem rule code is invalid'],
            immutable: true,
        },

        point_value_amount: {
            type: Number,
            required: [true, 'Point value amount is required'],
            min: [1, 'Point value amount must be at least 1'],
        },

        min_redeem_points: {
            type: Number,
            required: [true, 'Min redeem points is required'],
            min: [1, 'Min redeem points must be at least 1'],
        },

        redeem_step: {
            type: Number,
            required: [true, 'Redeem step is required'],
            min: [1, 'Redeem step must be at least 1'],
        },

        max_redeem_percent: {
            type: Number,
            required: [true, 'Max redeem percent is required'],
            min: [1, 'Max redeem percent must be at least 1'],
            max: [100, 'Max redeem percent must not exceed 100'],
        },

        is_active: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
        collection: 'loyalty_redeem_rules',
    }
);

loyaltyRedeemRuleSchema.index({ rule_code: 1 }, { unique: true, sparse: true });
loyaltyRedeemRuleSchema.index({ is_active: 1, created_at: -1 });

loyaltyRedeemRuleSchema.pre('save', async function (next) {
    if (!this.is_active || !this.isModified('is_active')) {
        return next();
    }

    await this.constructor.updateMany(
        {
            _id: { $ne: this._id },
            is_active: true,
        },
        {
            $set: { is_active: false },
        }
    );

    return next();
});

loyaltyRedeemRuleSchema.methods.toJSON = function () {
    const redeemRule = this.toObject();

    delete redeemRule.__v;

    return redeemRule;
};

const LoyaltyRedeemRule = mongoose.model('LoyaltyRedeemRule', loyaltyRedeemRuleSchema);

module.exports = LoyaltyRedeemRule;
