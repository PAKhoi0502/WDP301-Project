const mongoose = require('mongoose');

const { VEHICLE_TYPE_VALUES } = require('../../shared/constants/vehicle.constant');
const {
    BOOKING_PAYMENT_METHOD,
    BOOKING_PAYMENT_METHOD_VALUES,
} = require('../../shared/constants/booking.constant');

const washHistorySchema = new mongoose.Schema(
    {
        booking_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking',
            required: [true, 'Booking is required'],
            unique: true,
        },

        customer_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

        vehicle_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Vehicle',
            default: null,
        },

        garage_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Garage',
            required: [true, 'Garage is required'],
        },

        wash_bay_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'WashBay',
            default: null,
        },

        service_package_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ServicePackage',
            required: [true, 'Service package is required'],
        },

        vehicle_type: {
            type: String,
            enum: VEHICLE_TYPE_VALUES,
            required: [true, 'Vehicle type is required'],
        },

        amount_paid: {
            type: Number,
            min: [0, 'Amount paid must be greater than or equal to 0'],
            required: [true, 'Amount paid is required'],
        },

        original_price: {
            type: Number,
            min: [0, 'Original price must be greater than or equal to 0'],
            required: [true, 'Original price is required'],
        },

        discount_amount: {
            type: Number,
            min: [0, 'Discount amount must be greater than or equal to 0'],
            default: 0,
        },

        points_earned: {
            type: Number,
            min: [0, 'Points earned must be greater than or equal to 0'],
            default: 0,
        },

        points_used: {
            type: Number,
            min: [0, 'Points used must be greater than or equal to 0'],
            default: 0,
        },

        payment_method: {
            type: String,
            enum: BOOKING_PAYMENT_METHOD_VALUES,
            default: BOOKING_PAYMENT_METHOD.CASH,
        },

        paid_at: {
            type: Date,
            required: [true, 'Paid at is required'],
        },

        service_started_at: {
            type: Date,
            default: null,
        },

        service_completed_at: {
            type: Date,
            required: [true, 'Service completed at is required'],
        },
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
        collection: 'wash_histories',
    }
);

washHistorySchema.index({ customer_id: 1, created_at: -1 });
washHistorySchema.index({ vehicle_id: 1, created_at: -1 });
washHistorySchema.index({ garage_id: 1, created_at: -1 });
washHistorySchema.index({ service_package_id: 1 });
washHistorySchema.index({ paid_at: -1 });

washHistorySchema.methods.toJSON = function () {
    const washHistory = this.toObject();

    delete washHistory.__v;

    return washHistory;
};

const WashHistory = mongoose.model('WashHistory', washHistorySchema);

module.exports = WashHistory;
