const mongoose = require('mongoose');

const { VEHICLE_TYPE_VALUES } = require('../../shared/constants/vehicle.constant');
const { WASH_BAY_STATUS, WASH_BAY_STATUS_VALUES } = require('../../shared/constants/washBay.constant');

const washBaySchema = new mongoose.Schema(
    {
        garage_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Garage',
            required: [true, 'Garage is required'],
        },

        name: {
            type: String,
            required: [true, 'Wash bay name is required'],
            trim: true,
            minlength: [2, 'Wash bay name must be at least 2 characters'],
            maxlength: [100, 'Wash bay name must not exceed 100 characters'],
        },

        bay_code: {
            type: String,
            required: [true, 'Wash bay code is required'],
            trim: true,
            uppercase: true,
            minlength: [2, 'Wash bay code must be at least 2 characters'],
            maxlength: [30, 'Wash bay code must not exceed 30 characters'],
            match: [/^[A-Z0-9_-]+$/, 'Wash bay code is invalid'],
        },

        vehicle_type: {
            type: String,
            enum: VEHICLE_TYPE_VALUES,
            required: [true, 'Vehicle type is required'],
        },

        status: {
            type: String,
            enum: WASH_BAY_STATUS_VALUES,
            default: WASH_BAY_STATUS.AVAILABLE,
        },

        current_booking_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking',
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
        collection: 'wash_bays',
    }
);

washBaySchema.index({ garage_id: 1, bay_code: 1 }, { unique: true });
washBaySchema.index({ garage_id: 1, vehicle_type: 1, is_active: 1 });
washBaySchema.index({ garage_id: 1, vehicle_type: 1, status: 1 });
washBaySchema.index({ status: 1 });
washBaySchema.index({ current_booking_id: 1 });
washBaySchema.index({ created_at: -1 });

washBaySchema.methods.toJSON = function () {
    const washBay = this.toObject();

    delete washBay.__v;

    return washBay;
};

const WashBay = mongoose.model('WashBay', washBaySchema);

module.exports = WashBay;
