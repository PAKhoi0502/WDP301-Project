const mongoose = require('mongoose');

const {
    VEHICLE_TYPE_VALUES,
    ENGINE_TYPE_VALUES,
    MOTORBIKE_CC_GROUP_VALUES,
    CAR_BODY_TYPE_VALUES,
} = require('../../shared/constants/vehicle.constant');

const vehicleSchema = new mongoose.Schema(
    {
        customer_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Customer is required'],
        },

        raw_license_plate: {
            type: String,
            required: [true, 'License plate is required'],
            trim: true,
            minlength: [3, 'License plate must be at least 3 characters'],
            maxlength: [30, 'License plate must not exceed 30 characters'],
        },

        normalized_license_plate: {
            type: String,
            required: [true, 'Normalized license plate is required'],
            uppercase: true,
            trim: true,
            minlength: [5, 'Normalized license plate must be at least 5 characters'],
            maxlength: [20, 'Normalized license plate must not exceed 20 characters'],
            match: [/^[A-Z0-9]+$/, 'Normalized license plate is invalid'],
        },

        vehicle_type: {
            type: String,
            enum: VEHICLE_TYPE_VALUES,
            required: [true, 'Vehicle type is required'],
        },

        engine_type: {
            type: String,
            enum: ENGINE_TYPE_VALUES,
            required: [true, 'Engine type is required'],
        },

        motorbike_cc_group: {
            type: String,
            enum: MOTORBIKE_CC_GROUP_VALUES,
            default: null,
        },

        car_body_type: {
            type: String,
            enum: CAR_BODY_TYPE_VALUES,
            default: null,
        },

        seat_count: {
            type: Number,
            min: [2, 'Seat count must be at least 2'],
            max: [16, 'Seat count must not exceed 16'],
            default: null,
        },

        brand: {
            type: String,
            trim: true,
            maxlength: [100, 'Brand must not exceed 100 characters'],
            default: '',
        },

        model: {
            type: String,
            trim: true,
            maxlength: [100, 'Model must not exceed 100 characters'],
            default: '',
        },

        color: {
            type: String,
            trim: true,
            maxlength: [50, 'Color must not exceed 50 characters'],
            default: '',
        },

        is_default: {
            type: Boolean,
            default: false,
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
        collection: 'vehicles',
    }
);

vehicleSchema.index(
    {
        normalized_license_plate: 1,
        vehicle_type: 1,
    },
    {
        unique: true,
        partialFilterExpression: {
            is_active: true,
        },
    }
);

vehicleSchema.index({ customer_id: 1, is_active: 1 });
vehicleSchema.index({ customer_id: 1, is_default: 1 });
vehicleSchema.index({ vehicle_type: 1 });
vehicleSchema.index({ engine_type: 1 });
vehicleSchema.index({ created_at: -1 });

vehicleSchema.methods.toJSON = function () {
    const vehicle = this.toObject();

    delete vehicle.__v;

    return vehicle;
};

const Vehicle = mongoose.model('Vehicle', vehicleSchema);

module.exports = Vehicle;
