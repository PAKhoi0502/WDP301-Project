const SERVICE_PACKAGE_TYPES = Object.freeze({
    WASH: 'WASH',
    ADDON: 'ADDON',
    COMBO: 'COMBO',
});

const SERVICE_PACKAGE_TYPE_VALUES = Object.freeze(Object.values(SERVICE_PACKAGE_TYPES));

const SERVICE_STEP_TYPES = Object.freeze({
    AUTOMATED_WASH_STEP: 'AUTOMATED_WASH_STEP',
    MANUAL_SERVICE_STEP: 'MANUAL_SERVICE_STEP',
});

const SERVICE_STEP_TYPE_VALUES = Object.freeze(Object.values(SERVICE_STEP_TYPES));

const SERVICE_TRANSITION_MODES = Object.freeze({
    AUTO: 'AUTO',
    REQUIRE_CONFIRMATION: 'REQUIRE_CONFIRMATION',
});

const SERVICE_TRANSITION_MODE_VALUES = Object.freeze(Object.values(SERVICE_TRANSITION_MODES));

const isValidServicePackageType = (serviceType) => SERVICE_PACKAGE_TYPE_VALUES.includes(serviceType);
const isValidServiceStepType = (stepType) => SERVICE_STEP_TYPE_VALUES.includes(stepType);

module.exports = {
    SERVICE_PACKAGE_TYPES,
    SERVICE_PACKAGE_TYPE_VALUES,
    SERVICE_STEP_TYPES,
    SERVICE_STEP_TYPE_VALUES,
    SERVICE_TRANSITION_MODES,
    SERVICE_TRANSITION_MODE_VALUES,
    isValidServicePackageType,
    isValidServiceStepType,
};
