const mongoose = require('mongoose');

const {
    VEHICLE_TYPE_VALUES,
    ENGINE_TYPE_VALUES,
    MOTORBIKE_CC_GROUP_VALUES,
    CAR_BODY_TYPE_VALUES,
} = require('../../shared/constants/vehicle.constant');

const vehicleSnapshotSchema = new mongoose.Schema(
    {
        vehicle_type: {
            type: String,
            enum: VEHICLE_TYPE_VALUES,
            required: true,
        },
        engine_type: {
            type: String,
            enum: ENGINE_TYPE_VALUES,
            default: null,
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
            min: 2,
            max: 16,
            default: null,
        },
    },
    { _id: false }
);

const quoteItemSchema = new mongoose.Schema(
    {
        service_package_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ServicePackage',
            required: true,
        },
        service_price_rule_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ServicePriceRule',
            default: null,
        },
        rule_version: {
            type: Number,
            default: null,
        },
        source: {
            type: String,
            enum: ['PRIMARY', 'ADD_ON'],
            required: true,
        },
        name_snapshot: {
            type: String,
            required: true,
            trim: true,
        },
        price_snapshot: {
            type: Number,
            required: true,
            min: 0,
        },
        duration_minutes: {
            type: Number,
            required: true,
            min: 1,
        },
    },
    { _id: false }
);

const priceQuoteSchema = new mongoose.Schema(
    {
        customer_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        created_by_staff_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        garage_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Garage',
            required: true,
        },
        vehicle_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Vehicle',
            default: null,
        },
        vehicle_snapshot: {
            type: vehicleSnapshotSchema,
            required: true,
        },
        service_package_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ServicePackage',
            required: true,
        },
        add_on_service_ids: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ServicePackage',
        }],
        items: {
            type: [quoteItemSchema],
            default: [],
        },
        subtotal: {
            type: Number,
            required: true,
            min: 0,
        },
        total_duration_minutes: {
            type: Number,
            required: true,
            min: 1,
        },
        effective_at: {
            type: Date,
            required: true,
            default: Date.now,
        },
        status: {
            type: String,
            enum: ['ACTIVE', 'CONSUMED', 'EXPIRED'],
            default: 'ACTIVE',
        },
        expires_at: {
            type: Date,
            required: true,
        },
        consumed_at: {
            type: Date,
            default: null,
        },
        booking_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking',
            default: null,
        },
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
        collection: 'price_quotes',
    }
);

priceQuoteSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
priceQuoteSchema.index({ customer_id: 1, created_at: -1 });
priceQuoteSchema.index({ created_by_staff_id: 1, created_at: -1 });

module.exports = mongoose.model('PriceQuote', priceQuoteSchema);
