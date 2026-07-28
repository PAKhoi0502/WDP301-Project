const mongoose = require('mongoose');

const { VEHICLE_TYPE_VALUES } = require('../../shared/constants/vehicle.constant');
const { STAFF_TYPES, STAFF_TYPE_VALUES } = require('../../shared/constants/staff.constant');
const {
    SERVICE_PACKAGE_TYPE_VALUES,
    SERVICE_STEP_TYPE_VALUES,
    SERVICE_PACKAGE_TYPES,
    SERVICE_STEP_TYPES,
    SERVICE_TRANSITION_MODES,
    SERVICE_TRANSITION_MODE_VALUES,
} = require('../../shared/constants/servicePackage.constant');

const stepTemplateSchema = new mongoose.Schema(
    {
        step_code: {
            type: String,
            required: [true, 'Step code is required'],
            trim: true,
            uppercase: true,
            minlength: [2, 'Step code must be at least 2 characters'],
            maxlength: [80, 'Step code must not exceed 80 characters'],
            match: [/^[A-Z0-9_]+$/, 'Step code is invalid'],
        },

        step_name: {
            type: String,
            required: [true, 'Step name is required'],
            trim: true,
            minlength: [2, 'Step name must be at least 2 characters'],
            maxlength: [150, 'Step name must not exceed 150 characters'],
        },

        order: {
            type: Number,
            required: [true, 'Step order is required'],
            min: [1, 'Step order must be at least 1'],
        },

        step_type: {
            type: String,
            enum: SERVICE_STEP_TYPE_VALUES,
            required: [true, 'Step type is required'],
        },

        is_required: {
            type: Boolean,
            default: true,
        },

        display_staff_type: {
            type: String,
            enum: STAFF_TYPE_VALUES,
            default: null,
        },

        instructions: {
            type: [String],
            default: [],
            validate: {
                validator(value) {
                    return value.every((item) => typeof item === 'string' && item.trim().length > 0 && item.trim().length <= 500);
                },
                message: 'Instructions are invalid',
            },
        },
    },
    {
        _id: false,
    }
);

const servicePackageSchema = new mongoose.Schema(
    {
        service_code: {
            type: String,
            trim: true,
            uppercase: true,
            minlength: [3, 'Service package code must be at least 3 characters'],
            maxlength: [100, 'Service package code must not exceed 100 characters'],
            match: [/^[A-Z0-9_]+$/, 'Service package code is invalid'],
            immutable: true,
        },

        name: {
            type: String,
            required: [true, 'Service package name is required'],
            trim: true,
            minlength: [2, 'Service package name must be at least 2 characters'],
            maxlength: [150, 'Service package name must not exceed 150 characters'],
        },

        vehicle_type: {
            type: String,
            enum: VEHICLE_TYPE_VALUES,
            required: [true, 'Vehicle type is required'],
        },

        service_type: {
            type: String,
            enum: SERVICE_PACKAGE_TYPE_VALUES,
            required: [true, 'Service type is required'],
        },

        description: {
            type: String,
            trim: true,
            maxlength: [2000, 'Description must not exceed 2000 characters'],
            default: null,
        },

        base_price: {
            type: Number,
            required: [true, 'Base price is required'],
            min: [0, 'Base price must be greater than or equal to 0'],
        },

        duration_minutes: {
            type: Number,
            required: [true, 'Duration is required'],
            min: [1, 'Duration must be at least 1 minute'],
            max: [1440, 'Duration must not exceed 1440 minutes'],
        },

        countdown_duration_seconds: {
            type: Number,
            min: [1, 'Countdown duration must be at least 1 second'],
            max: [86400, 'Countdown duration must not exceed 86400 seconds'],
            default: null,
        },

        transition_mode: {
            type: String,
            enum: SERVICE_TRANSITION_MODE_VALUES,
            default: SERVICE_TRANSITION_MODES.REQUIRE_CONFIRMATION,
        },

        wash_bay_duration_minutes: {
            type: Number,
            min: [0, 'Wash bay duration must be greater than or equal to 0'],
            max: [1440, 'Wash bay duration must not exceed 1440 minutes'],
            default: 0,
        },

        wash_bay_start_offset_minutes: {
            type: Number,
            min: [0, 'Wash bay start offset must be greater than or equal to 0'],
            max: [1440, 'Wash bay start offset must not exceed 1440 minutes'],
            default: 0,
        },

        points_earned: {
            type: Number,
            required: [true, 'Points earned is required'],
            min: [0, 'Points earned must be greater than or equal to 0'],
            default: 0,
        },

        requires_wash_bay: {
            type: Boolean,
            default: false,
        },

        requires_care_staff: {
            type: Boolean,
            default: false,
        },

        care_staff_type: {
            type: String,
            enum: STAFF_TYPE_VALUES,
            default: null,
        },

        care_staff_required_count: {
            type: Number,
            min: [0, 'Care staff required count must be greater than or equal to 0'],
            max: [50, 'Care staff required count must not exceed 50'],
            default: 0,
        },

        care_staff_duration_minutes: {
            type: Number,
            min: [0, 'Care staff duration must be greater than or equal to 0'],
            max: [1440, 'Care staff duration must not exceed 1440 minutes'],
            default: 0,
        },

        care_staff_start_offset_minutes: {
            type: Number,
            min: [0, 'Care staff start offset must be greater than or equal to 0'],
            max: [1440, 'Care staff start offset must not exceed 1440 minutes'],
            default: 0,
        },

        allow_duplicate_in_booking: {
            type: Boolean,
            default: false,
        },

        included_service_ids: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'ServicePackage',
            },
        ],

        steps_template: {
            type: [stepTemplateSchema],
            default: [],
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
        collection: 'service_packages',
    }
);

servicePackageSchema.index({ service_code: 1 }, { unique: true, sparse: true });
servicePackageSchema.index({ name: 1, vehicle_type: 1 }, { unique: true });
servicePackageSchema.index({ vehicle_type: 1, service_type: 1, is_active: 1 });
servicePackageSchema.index({ requires_wash_bay: 1, is_active: 1 });
servicePackageSchema.index({ requires_care_staff: 1, care_staff_type: 1, is_active: 1 });
servicePackageSchema.index({ included_service_ids: 1 });
servicePackageSchema.index({ created_at: -1 });

servicePackageSchema.pre('validate', function (next) {
    if (!this.countdown_duration_seconds && this.duration_minutes) {
        this.countdown_duration_seconds = this.duration_minutes * 60;
    }

    if (this.countdown_duration_seconds > this.duration_minutes * 60) {
        this.invalidate('countdown_duration_seconds', 'Countdown duration must not exceed scheduled duration');
    }

    if (this.service_type === SERVICE_PACKAGE_TYPES.COMBO && this.steps_template?.length > 0) {
        this.invalidate('steps_template', 'Combo service package must not define operational steps');
    }

    if (this.service_type === SERVICE_PACKAGE_TYPES.COMBO) {
        this.transition_mode = SERVICE_TRANSITION_MODES.REQUIRE_CONFIRMATION;
    }

    if (this.transition_mode === SERVICE_TRANSITION_MODES.AUTO) {
        const requiredSteps = (this.steps_template || []).filter((step) => step.is_required !== false);
        const isAutomated = requiredSteps.length > 0
            ? requiredSteps.every((step) => step.step_type === SERVICE_STEP_TYPES.AUTOMATED_WASH_STEP)
            : this.requires_wash_bay && !this.requires_care_staff;

        if (!isAutomated) {
            this.invalidate('transition_mode', 'Automatic transition requires an automated service workflow');
        }
    }

    if (this.service_type === SERVICE_PACKAGE_TYPES.COMBO && !this.included_service_ids?.length) {
        this.invalidate('included_service_ids', 'Combo service package must include at least one child service');
    }

    if (this.service_type !== SERVICE_PACKAGE_TYPES.COMBO && this.included_service_ids?.length > 0) {
        this.invalidate('included_service_ids', 'Only combo service packages can include child services');
    }

    if (!this.requires_wash_bay) {
        this.wash_bay_duration_minutes = 0;
        this.wash_bay_start_offset_minutes = 0;
    }

    if (this.requires_wash_bay && (!this.wash_bay_duration_minutes || this.wash_bay_duration_minutes < 1)) {
        this.invalidate('wash_bay_duration_minutes', 'Wash bay duration is required when service requires wash bay');
    }

    if (this.wash_bay_duration_minutes > this.duration_minutes || this.wash_bay_start_offset_minutes + this.wash_bay_duration_minutes > this.duration_minutes) {
        this.invalidate('wash_bay_duration_minutes', 'Wash bay duration must not exceed total duration');
    }

    if (!this.requires_care_staff) {
        this.care_staff_type = null;
        this.care_staff_required_count = 0;
        this.care_staff_duration_minutes = 0;
        this.care_staff_start_offset_minutes = 0;
    }

    if (this.requires_care_staff) {
        if (!this.care_staff_type) {
            this.care_staff_type = STAFF_TYPES.VEHICLE_CARE_STAFF;
        }

        if (!this.care_staff_required_count || this.care_staff_required_count < 1) {
            this.care_staff_required_count = 1;
        }

        if (!this.care_staff_duration_minutes || this.care_staff_duration_minutes < 1) {
            this.care_staff_duration_minutes = this.duration_minutes;
        }
    }

    if (this.care_staff_duration_minutes > this.duration_minutes || this.care_staff_start_offset_minutes + this.care_staff_duration_minutes > this.duration_minutes) {
        this.invalidate('care_staff_duration_minutes', 'Care staff duration must not exceed total duration');
    }

    const stepOrders = new Set();
    const stepCodes = new Set();

    for (const step of this.steps_template || []) {
        if (stepOrders.has(step.order)) {
            this.invalidate('steps_template', 'Step order must be unique');
            break;
        }

        if (stepCodes.has(step.step_code)) {
            this.invalidate('steps_template', 'Step code must be unique');
            break;
        }

        stepOrders.add(step.order);
        stepCodes.add(step.step_code);
    }

    next();
});

servicePackageSchema.methods.toJSON = function () {
    const servicePackage = this.toObject();

    delete servicePackage.__v;

    return servicePackage;
};

const ServicePackage = mongoose.model('ServicePackage', servicePackageSchema);

module.exports = ServicePackage;
