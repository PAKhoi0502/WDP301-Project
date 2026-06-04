const VEHICLE_TYPES = Object.freeze({
    MOTORBIKE: 'MOTORBIKE',
    CAR: 'CAR',
});

const VEHICLE_TYPE_VALUES = Object.freeze(Object.values(VEHICLE_TYPES));

const ENGINE_TYPES = Object.freeze({
    GASOLINE: 'GASOLINE',
    ELECTRIC: 'ELECTRIC',
});

const ENGINE_TYPE_VALUES = Object.freeze(Object.values(ENGINE_TYPES));

const MOTORBIKE_CC_GROUPS = Object.freeze({
    UNDER_175CC: 'UNDER_175CC',
    OVER_175CC: 'OVER_175CC',
});

const MOTORBIKE_CC_GROUP_VALUES = Object.freeze(Object.values(MOTORBIKE_CC_GROUPS));

const CAR_BODY_TYPES = Object.freeze({
    HATCHBACK: 'HATCHBACK',
    SEDAN: 'SEDAN',
    SUV: 'SUV',
    MPV: 'MPV',
    PICKUP: 'PICKUP',
    VAN: 'VAN',
});

const CAR_BODY_TYPE_VALUES = Object.freeze(Object.values(CAR_BODY_TYPES));

const isValidVehicleType = (vehicleType) => VEHICLE_TYPE_VALUES.includes(vehicleType);
const isValidEngineType = (engineType) => ENGINE_TYPE_VALUES.includes(engineType);
const isValidMotorbikeCcGroup = (ccGroup) => MOTORBIKE_CC_GROUP_VALUES.includes(ccGroup);
const isValidCarBodyType = (bodyType) => CAR_BODY_TYPE_VALUES.includes(bodyType);

module.exports = {
    VEHICLE_TYPES,
    VEHICLE_TYPE_VALUES,
    ENGINE_TYPES,
    ENGINE_TYPE_VALUES,
    MOTORBIKE_CC_GROUPS,
    MOTORBIKE_CC_GROUP_VALUES,
    CAR_BODY_TYPES,
    CAR_BODY_TYPE_VALUES,
    isValidVehicleType,
    isValidEngineType,
    isValidMotorbikeCcGroup,
    isValidCarBodyType,
};
