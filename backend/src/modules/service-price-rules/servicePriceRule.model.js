const mongoose = require('mongoose');

const {
    VEHICLE_TYPES,
    VEHICLE_TYPE_VALUES,
    ENGINE_TYPE_VALUES,
    MOTORBIKE_CC_GROUP_VALUES,
    CAR_BODY_TYPE_VALUES,
} = require('../../shared/constants/vehicle.constant');

const optionalInteger = (min, max, message) => ({
    type: Number,
    min,
    max,
    default: null,
    validate: {
        validator(value) {
            return value === null || Number.isInteger(value);
        },
        message,
    },
});

const servicePriceRuleSchema = new mongoose.Schema(
    {
        rule_code: {
            type: String,
            trim: true,
            uppercase: true,
            minlength: [3, 'Price rule code must be at least 3 characters'],
            maxlength: [180, 'Price rule code must not exceed 180 characters'],
            match: [/^[A-Z0-9_]+$/, 'Price rule code is invalid'],
            immutable: true,
        },
        service_package_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ServicePackage',
            required: [true, 'Service package is required'],
        },
        garage_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Garage',
            default: null,
        },
        vehicle_type: {
            type: String,
            enum: VEHICLE_TYPE_VALUES,
            required: [true, 'Vehicle type is required'],
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
        seat_min: optionalInteger(2, 16, 'Minimum seat count must be an integer'),
        seat_max: optionalInteger(2, 16, 'Maximum seat count must be an integer'),
        price: {
            type: Number,
            required: [true, 'Price is required'],
            min: [0, 'Price must be greater than or equal to 0'],
            validate: {
                validator: Number.isInteger,
                message: 'Price must be an integer',
            },
        },
        duration_minutes: optionalInteger(1, 1440, 'Duration must be an integer'),
        wash_bay_duration_minutes: optionalInteger(0, 1440, 'Wash bay duration must be an integer'),
        care_staff_duration_minutes: optionalInteger(0, 1440, 'Care staff duration must be an integer'),
        effective_from: {
            type: Date,
            required: [true, 'Effective start time is required'],
            default: Date.now,
        },
        effective_to: {
            type: Date,
            default: null,
        },
        version: {
            type: Number,
            min: [1, 'Version must be at least 1'],
            default: 1,
        },
        is_active: {
            type: Boolean,
            default: true,
        },
        note: {
            type: String,
            trim: true,
            maxlength: [500, 'Note must not exceed 500 characters'],
            default: null,
        },
        created_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        updated_by: {
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
        collection: 'service_price_rules',
    }
);

servicePriceRuleSchema.index({ rule_code: 1 }, { unique: true, sparse: true });
servicePriceRuleSchema.index({
    service_package_id: 1,
    garage_id: 1,
    vehicle_type: 1,
    is_active: 1,
    effective_from: -1,
});
servicePriceRuleSchema.index({ garage_id: 1, is_active: 1 });
servicePriceRuleSchema.index({ effective_to: 1, is_active: 1 });

servicePriceRuleSchema.pre('validate', function (next) {
    if ((this.seat_min === null) !== (this.seat_max === null)) {
        this.invalidate('seat_min', 'Both seat_min and seat_max are required for a seat range');
    }

    if (this.seat_min !== null && this.seat_max !== null && this.seat_min > this.seat_max) {
        this.invalidate('seat_max', 'seat_max must be greater than or equal to seat_min');
    }

    if (this.vehicle_type === VEHICLE_TYPES.MOTORBIKE) {
        if (this.car_body_type || this.seat_min !== null || this.seat_max !== null) {
            this.invalidate('vehicle_type', 'Car classification fields are not allowed for motorbike pricing');
        }
    }

    if (this.vehicle_type === VEHICLE_TYPES.CAR && this.motorbike_cc_group) {
        this.invalidate('motorbike_cc_group', 'Motorbike displacement is not allowed for car pricing');
    }

    if (this.effective_to && this.effective_to <= this.effective_from) {
        this.invalidate('effective_to', 'effective_to must be later than effective_from');
    }

    if (
        this.duration_minutes !== null
        && this.wash_bay_duration_minutes !== null
        && this.wash_bay_duration_minutes > this.duration_minutes
    ) {
        this.invalidate('wash_bay_duration_minutes', 'Wash bay duration must not exceed total duration');
    }

    if (
        this.duration_minutes !== null
        && this.care_staff_duration_minutes !== null
        && this.care_staff_duration_minutes > this.duration_minutes
    ) {
        this.invalidate('care_staff_duration_minutes', 'Care staff duration must not exceed total duration');
    }

    next();
});

servicePriceRuleSchema.methods.toJSON = function () {
    const rule = this.toObject();
    delete rule.__v;
    return rule;
};

module.exports = mongoose.model('ServicePriceRule', servicePriceRuleSchema);
