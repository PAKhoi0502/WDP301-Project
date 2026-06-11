const mongoose = require('mongoose');

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const garageSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Garage name is required'],
            trim: true,
            minlength: [2, 'Garage name must be at least 2 characters'],
            maxlength: [120, 'Garage name must not exceed 120 characters'],
        },

        garage_code: {
            type: String,
            required: [true, 'Garage code is required'],
            trim: true,
            uppercase: true,
            minlength: [2, 'Garage code must be at least 2 characters'],
            maxlength: [30, 'Garage code must not exceed 30 characters'],
            match: [/^[A-Z0-9_-]+$/, 'Garage code is invalid'],
        },

        address: {
            type: String,
            required: [true, 'Garage address is required'],
            trim: true,
            minlength: [5, 'Garage address must be at least 5 characters'],
            maxlength: [500, 'Garage address must not exceed 500 characters'],
        },

        ward: {
            type: String,
            trim: true,
            maxlength: [100, 'Ward must not exceed 100 characters'],
            default: null,
        },

        district: {
            type: String,
            trim: true,
            maxlength: [100, 'District must not exceed 100 characters'],
            default: null,
        },

        city: {
            type: String,
            trim: true,
            maxlength: [100, 'City must not exceed 100 characters'],
            default: null,
        },

        phone: {
            type: String,
            trim: true,
            maxlength: [20, 'Phone must not exceed 20 characters'],
            default: null,
        },

        email: {
            type: String,
            trim: true,
            lowercase: true,
            maxlength: [120, 'Email must not exceed 120 characters'],
            default: null,
        },

        latitude: {
            type: Number,
            min: [-90, 'Latitude must be greater than or equal to -90'],
            max: [90, 'Latitude must be less than or equal to 90'],
            default: null,
        },

        longitude: {
            type: Number,
            min: [-180, 'Longitude must be greater than or equal to -180'],
            max: [180, 'Longitude must be less than or equal to 180'],
            default: null,
        },

        opening_time: {
            type: String,
            required: [true, 'Opening time is required'],
            default: '07:00',
            match: [timePattern, 'Opening time must be HH:mm'],
        },

        closing_time: {
            type: String,
            required: [true, 'Closing time is required'],
            default: '18:00',
            match: [timePattern, 'Closing time must be HH:mm'],
        },

        slot_interval_minutes: {
            type: Number,
            required: [true, 'Slot interval is required'],
            default: 30,
            min: [5, 'Slot interval must be at least 5 minutes'],
            max: [240, 'Slot interval must not exceed 240 minutes'],
        },

        late_grace_minutes: {
            type: Number,
            required: [true, 'Late grace period is required'],
            default: 15,
            min: [0, 'Late grace period must be greater than or equal to 0'],
            max: [240, 'Late grace period must not exceed 240 minutes'],
        },

        description: {
            type: String,
            trim: true,
            maxlength: [1000, 'Description must not exceed 1000 characters'],
            default: null,
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
        collection: 'garages',
    }
);

garageSchema.index({ garage_code: 1 }, { unique: true });
garageSchema.index({ name: 1 });
garageSchema.index({ city: 1 });
garageSchema.index({ district: 1 });
garageSchema.index({ is_active: 1 });
garageSchema.index({ created_at: -1 });

garageSchema.methods.toJSON = function () {
    const garage = this.toObject();

    delete garage.__v;

    return garage;
};

const Garage = mongoose.model('Garage', garageSchema);

module.exports = Garage;
