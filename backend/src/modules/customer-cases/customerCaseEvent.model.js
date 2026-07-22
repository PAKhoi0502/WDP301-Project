const mongoose = require('mongoose');

const { USER_ROLE_VALUES } = require('../../shared/constants/roles.constant');
const {
    CUSTOMER_CASE_EVENT_TYPE_VALUES,
    CUSTOMER_CASE_STATUS_VALUES,
} = require('../../shared/constants/customerCase.constant');

const customerCaseEventSchema = new mongoose.Schema(
    {
        case_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerCase', required: true },
        event_type: { type: String, enum: CUSTOMER_CASE_EVENT_TYPE_VALUES, required: true },
        actor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        actor_role: { type: String, enum: USER_ROLE_VALUES, default: null },
        from_status: { type: String, enum: CUSTOMER_CASE_STATUS_VALUES, default: null },
        to_status: { type: String, enum: CUSTOMER_CASE_STATUS_VALUES, default: null },
        visible_to_customer: { type: Boolean, default: true },
        metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: false },
        collection: 'customer_case_events',
    }
);

customerCaseEventSchema.index({ case_id: 1, created_at: 1 });
customerCaseEventSchema.index({ actor_id: 1, created_at: -1 });

customerCaseEventSchema.methods.toJSON = function () {
    const event = this.toObject();
    delete event.__v;
    return event;
};

module.exports = mongoose.model('CustomerCaseEvent', customerCaseEventSchema);
