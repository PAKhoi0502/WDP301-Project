const mongoose = require('mongoose');

const {
    VEHICLE_INSPECTION_TYPE_VALUES,
} = require('../../shared/constants/vehicleInspection.constant');

const inspectionImageSchema = new mongoose.Schema(
    {
        image_url: {
            type: String,
            required: [true, 'Image URL is required'],
            trim: true,
            maxlength: [1000, 'Image URL must not exceed 1000 characters'],
        },

        public_id: {
            type: String,
            trim: true,
            maxlength: [255, 'Public id must not exceed 255 characters'],
            default: null,
        },

        caption: {
            type: String,
            trim: true,
            maxlength: [255, 'Caption must not exceed 255 characters'],
            default: null,
        },
    },
    {
        _id: false,
    }
);

const vehicleInspectionSchema = new mongoose.Schema(
    {
        booking_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking',
            required: [true, 'Booking is required'],
        },

        type: {
            type: String,
            enum: VEHICLE_INSPECTION_TYPE_VALUES,
            required: [true, 'Inspection type is required'],
        },

        note: {
            type: String,
            trim: true,
            maxlength: [2000, 'Note must not exceed 2000 characters'],
            default: null,
        },

        images: {
            type: [inspectionImageSchema],
            default: [],
        },

        inspected_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Inspector is required'],
        },

        inspected_at: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
        collection: 'vehicle_inspections',
    }
);

vehicleInspectionSchema.index({ booking_id: 1, type: 1 }, { unique: true });
vehicleInspectionSchema.index({ inspected_by: 1 });
vehicleInspectionSchema.index({ inspected_at: -1 });
vehicleInspectionSchema.index({ created_at: -1 });

vehicleInspectionSchema.methods.toJSON = function () {
    const inspection = this.toObject();

    delete inspection.__v;

    return inspection;
};

const VehicleInspection = mongoose.model('VehicleInspection', vehicleInspectionSchema);

module.exports = VehicleInspection;
