const WASH_BAY_STATUS = Object.freeze({
    AVAILABLE: 'AVAILABLE',
    OCCUPIED: 'OCCUPIED',
    MAINTENANCE: 'MAINTENANCE',
    INACTIVE: 'INACTIVE',
});

const WASH_BAY_STATUS_VALUES = Object.freeze(Object.values(WASH_BAY_STATUS));

const WASH_BAY_MANUAL_STATUS_VALUES = Object.freeze([
    WASH_BAY_STATUS.AVAILABLE,
    WASH_BAY_STATUS.MAINTENANCE,
    WASH_BAY_STATUS.INACTIVE,
]);

const isValidWashBayStatus = (status) => WASH_BAY_STATUS_VALUES.includes(status);

module.exports = {
    WASH_BAY_STATUS,
    WASH_BAY_STATUS_VALUES,
    WASH_BAY_MANUAL_STATUS_VALUES,
    isValidWashBayStatus,
};
