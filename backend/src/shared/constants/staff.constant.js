const STAFF_TYPES = Object.freeze({
    CUSTOMER_SERVICE_STAFF: 'CUSTOMER_SERVICE_STAFF',
    VEHICLE_INSPECTION_STAFF: 'VEHICLE_INSPECTION_STAFF',
    WASH_OPERATOR: 'WASH_OPERATOR',
    VEHICLE_CARE_STAFF: 'VEHICLE_CARE_STAFF',
});

const STAFF_TYPE_VALUES = Object.freeze(Object.values(STAFF_TYPES));

const isValidStaffType = (staffType) => STAFF_TYPE_VALUES.includes(staffType);

module.exports = {
    STAFF_TYPES,
    STAFF_TYPE_VALUES,
    isValidStaffType,
};
