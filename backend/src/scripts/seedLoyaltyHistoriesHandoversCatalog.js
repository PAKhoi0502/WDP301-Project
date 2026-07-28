const {
    BOOKING_HANDOVER_STATES,
    BOOKING_HANDOVER_RESPONSES,
} = require('../shared/constants/customerCase.constant');
const {
    POINT_TRANSACTION_TYPES,
} = require('../shared/constants/loyalty.constant');

const REDEEM_TARGETS = Object.freeze({
    COMPLETED_PAID: 10,
    CONFIRMED: 5,
    CANCELED: 1,
});

const POINT_TRANSACTION_TARGETS = Object.freeze({
    [POINT_TRANSACTION_TYPES.EARN]: 327,
    [POINT_TRANSACTION_TYPES.REDEEM]: 16,
    [POINT_TRANSACTION_TYPES.REFUND]: 1,
    [POINT_TRANSACTION_TYPES.EXPIRE]: 0,
    [POINT_TRANSACTION_TYPES.ADJUST]: 0,
});

const CUSTOMER_LOYALTY_TARGETS = Object.freeze({
    total: 125,
    active: 93,
    inactive: 32,
    tier_distribution: Object.freeze({
        BRONZE: 100,
        SILVER: 12,
        GOLD: 10,
        PLATINUM: 3,
    }),
});

const WASH_HISTORY_TARGETS = Object.freeze({
    total: 355,
    customer: 327,
    walk_in: 28,
});

const HANDOVER_TARGETS = Object.freeze({
    total: 365,
    by_state: Object.freeze({
        [BOOKING_HANDOVER_STATES.RELEASED]: 355,
        [BOOKING_HANDOVER_STATES.READY_FOR_CUSTOMER]: 10,
    }),
    by_response: Object.freeze({
        [BOOKING_HANDOVER_RESPONSES.ACCEPTED]: 360,
        [BOOKING_HANDOVER_RESPONSES.PENDING]: 5,
    }),
});

const POINT_TRANSACTION_TOTAL = Object.values(
    POINT_TRANSACTION_TARGETS
).reduce((total, count) => total + count, 0);

module.exports = {
    REDEEM_TARGETS,
    POINT_TRANSACTION_TARGETS,
    POINT_TRANSACTION_TOTAL,
    CUSTOMER_LOYALTY_TARGETS,
    WASH_HISTORY_TARGETS,
    HANDOVER_TARGETS,
};
