const mongoose = require('mongoose');

const {
    USER_ROLES,
    USER_ROLE_VALUES,
} = require('../../shared/constants/roles.constant');

const userSchema = new mongoose.Schema(
    {
        full_name: {
            type: String,
            trim: true,
            minlength: [2, 'Full name must be at least 2 characters'],
            maxlength: [100, 'Full name must not exceed 100 characters'],
            default: '',
        },

        email: {
            type: String,
            trim: true,
            lowercase: true,
            maxlength: [120, 'Email must not exceed 120 characters'],
        },

        phone: {
            type: String,
            required: [true, 'Phone number is required'],
            trim: true,
            maxlength: [20, 'Phone number must not exceed 20 characters'],
        },

        phone_verified_at: {
            type: Date,
            default: null,
        },

        password_hash: {
            type: String,
            required: [true, 'Password hash is required'],
            select: false,
        },

        role: {
            type: String,
            enum: USER_ROLE_VALUES,
            default: USER_ROLES.CUSTOMER,
            required: true,
        },

        avatar_url: {
            type: String,
            trim: true,
            default: '',
        },

        is_active: {
            type: Boolean,
            default: true,
        },

        last_login_at: {
            type: Date,
            default: null,
        },

        password_changed_at: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
        collection: 'users',
    }
);

userSchema.index(
    { email: 1 },
    {
        unique: true,
        partialFilterExpression: {
            email: { $type: 'string' },
        },
    }
);

userSchema.index({ phone: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ is_active: 1 });

userSchema.methods.toJSON = function () {
    const user = this.toObject();

    delete user.password_hash;
    delete user.__v;

    return user;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
