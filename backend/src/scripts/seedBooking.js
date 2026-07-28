const mongoose = require('mongoose');

const Booking = require('../modules/bookings/booking.model');
const BookingViolationEvent = require('../modules/booking-violations/bookingViolationEvent.model');
const CustomerBookingViolation = require('../modules/booking-violations/customerBookingViolation.model');
const Garage = require('../modules/garages/garage.model');
const ServicePackage = require('../modules/service-packages/servicePackage.model');
const ServicePriceRule = require('../modules/service-price-rules/servicePriceRule.model');
const StaffProfile = require('../modules/staff-profiles/staffProfile.model');
const User = require('../modules/users/user.model');
const Vehicle = require('../modules/vehicles/vehicle.model');
const WashBay = require('../modules/wash-bays/washBay.model');
const {
    BOOKING_VIOLATION_EVENTS,
    BOOKING_VIOLATION_SCORE,
} = require('../modules/booking-violations/bookingViolation.constant');
const {
    BOOKING_STATUS,
    BOOKING_ITEM_STATUS,
    BOOKING_PAYMENT_METHOD,
    BOOKING_PAYMENT_STATUS,
    BOOKING_ARRIVAL_STATUS,
} = require('../shared/constants/booking.constant');
const {
    BOOKING_OPERATION_STATUS,
    BOOKING_CANCELLATION_SOURCES,
} = require('../shared/constants/bookingIncident.constant');
const { USER_ROLES } = require('../shared/constants/roles.constant');
const { SERVICE_PACKAGE_TYPES } = require('../shared/constants/servicePackage.constant');
const { STAFF_TYPES } = require('../shared/constants/staff.constant');
const {
    VEHICLE_TYPES,
    ENGINE_TYPES,
    MOTORBIKE_CC_GROUPS,
    CAR_BODY_TYPES,
} = require('../shared/constants/vehicle.constant');
const { WASH_BAY_STATUS } = require('../shared/constants/washBay.constant');
const { normalizePhone } = require('../shared/utils/phone');
const {
    buildCustomerSeedUsers,
} = require('./seedCatalog');
const {
    buildBookingScenarios,
    assertBookingScenarioPlan,
    LOYALTY_VISIT_TARGETS,
    stableHexId,
    getGuestVehicleType,
} = require('./seedBookingCatalog');
const {
    buildVehicleDefinitions,
} = require('./seedWashBaysVehiclesCatalog');
const {
    servicePriceRuleMatchesVehicle,
} = require('./seedServiceCatalogData');
const { getSeedReferenceDate } = require('./seedTime');
const PROCESSED_KINDS = new Set([
    'COMPLETED_PAID',
    'COMPLETED_NONPAID',
    'CHECKED_IN',
    'IN_PROGRESS',
]);
const TIER_ORDER = Object.freeze(['PLATINUM', 'GOLD', 'SILVER', 'BRONZE']);
const TIER_WINDOWS = Object.freeze({
    BRONZE: 7,
    SILVER: 10,
    GOLD: 14,
    PLATINUM: 20,
});
const TIER_MAX_UPCOMING = Object.freeze({
    BRONZE: 1,
    SILVER: 1,
    GOLD: 2,
    PLATINUM: 3,
});

const toId = (value) => String(value?._id || value || '');
const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60000);
const addHours = (date, hours) => addMinutes(date, hours * 60);
const uniqueIds = (values) => [
    ...new Map(values.filter(Boolean).map((value) => [toId(value), value])).values(),
];

const buildVehicleSnapshot = (vehicle) => ({
    vehicle_type: vehicle.vehicle_type,
    engine_type: vehicle.engine_type || null,
    motorbike_cc_group: vehicle.motorbike_cc_group || null,
    car_body_type: vehicle.car_body_type || null,
    seat_count: vehicle.seat_count || null,
});

const hasGasVehicle = (profile, vehicleType = null) => profile.vehicles.some(
    (vehicle) => (
        vehicle.engine_type === ENGINE_TYPES.GASOLINE
        && (!vehicleType || vehicle.vehicle_type === vehicleType)
    )
);

const chooseTierProfiles = ({ garageCode, profiles }) => {
    const targets = LOYALTY_VISIT_TARGETS[garageCode];
    const available = [...profiles].sort(
        (left, right) => left.customer.created_at - right.customer.created_at
    );
    const selected = new Set();
    const result = {};
    const take = ({ count, predicate = () => true }) => {
        const matches = available.filter(
            (profile) => !selected.has(profile.phone) && predicate(profile)
        ).slice(0, count);

        if (matches.length !== count) {
            throw new Error(
                `Not enough eligible customers for ${garageCode}: expected ${count}, found ${matches.length}`
            );
        }

        matches.forEach((profile) => selected.add(profile.phone));

        return matches;
    };
    const preferredVehicleType = garageCode === 'GAR002'
        ? VEHICLE_TYPES.MOTORBIKE
        : VEHICLE_TYPES.CAR;

    result.PLATINUM = take({
        count: targets.platinum.length,
        predicate: (profile) => hasGasVehicle(profile, VEHICLE_TYPES.CAR),
    });
    result.GOLD = take({
        count: targets.gold.length,
        predicate: (profile) => hasGasVehicle(profile, preferredVehicleType),
    });
    result.SILVER = take({
        count: targets.silver.length,
    });
    result.BRONZE = take({
        count: targets.bronze.length,
    });

    for (const tier of TIER_ORDER) {
        const visitTargets = targets[tier.toLowerCase()];

        result[tier].forEach((profile, index) => {
            profile.tier_target = tier;
            profile.paid_visit_target = visitTargets[index];
            profile.paid_visit_remaining = visitTargets[index];
            profile.paid_booking_dates = [];
            profile.upcoming_booking_count = 0;
        });
    }

    return result;
};

const selectVehicle = ({
    profile,
    scenario,
    preferGas = false,
}) => {
    const eligible = profile.vehicles.filter(
        (vehicle) => vehicle.created_at < addMinutes(scenario.start_time, -30)
    );
    const gasVehicles = eligible.filter(
        (vehicle) => vehicle.engine_type === ENGINE_TYPES.GASOLINE
    );
    const candidates = (scenario.force_wash_bay || preferGas) && gasVehicles.length > 0
        ? gasVehicles
        : eligible;

    if (candidates.length === 0) {
        return null;
    }

    return candidates[scenario.seed_sequence % candidates.length];
};

const assignPaidCustomers = ({ scenarios, tierProfiles }) => {
    const profiles = TIER_ORDER.flatMap((tier) => tierProfiles[tier]);
    const registeredPaid = scenarios
        .filter((scenario) => (
            scenario.kind === 'COMPLETED_PAID'
            && scenario.channel === 'CUSTOMER'
        ))
        .sort((left, right) => left.start_time - right.start_time);

    for (const scenario of registeredPaid) {
        const dayKey = scenario.start_time.toISOString().slice(0, 10);
        let candidates = profiles.filter((profile) => (
            profile.paid_visit_remaining > 0
            && selectVehicle({ profile, scenario })
        ));
        const withoutSameDay = candidates.filter(
            (profile) => !profile.paid_booking_dates.includes(dayKey)
        );

        if (withoutSameDay.length > 0) {
            candidates = withoutSameDay;
        }

        candidates.sort((left, right) => (
            right.paid_visit_remaining - left.paid_visit_remaining
            || left.customer.created_at - right.customer.created_at
            || left.phone.localeCompare(right.phone)
        ));

        const selected = candidates[0];

        if (!selected) {
            throw new Error(
                `No eligible paid booking customer: ${scenario.garage_code}:${scenario.start_time.toISOString()}`
            );
        }

        scenario.customer_profile = selected;
        selected.paid_visit_remaining -= 1;
        selected.paid_booking_dates.push(dayKey);
    }

    const unassigned = profiles.filter(
        (profile) => profile.paid_visit_remaining !== 0
    );

    if (unassigned.length > 0) {
        throw new Error(
            `Paid visit assignment incomplete: ${unassigned.map(
                (profile) => `${profile.phone}:${profile.paid_visit_remaining}`
            ).join(',')}`
        );
    }
};

const chooseEligibleProfile = ({
    profiles,
    scenario,
    predicate = () => true,
    offset = 0,
}) => {
    const eligible = profiles.filter((profile) => (
        predicate(profile)
        && selectVehicle({
            profile,
            scenario,
            preferGas: scenario.force_wash_bay,
        })
    )).sort((left, right) => (
        left.customer.created_at - right.customer.created_at
        || left.phone.localeCompare(right.phone)
    ));

    if (eligible.length === 0) {
        throw new Error(
            `No eligible customer profile: ${scenario.garage_code}:${scenario.kind}`
        );
    }

    return eligible[offset % eligible.length];
};

const assignNoShowCustomers = ({ garageCode, scenarios, tierProfiles }) => {
    const noShows = scenarios
        .filter((scenario) => scenario.kind === 'NO_SHOW')
        .sort((left, right) => left.start_time - right.start_time);
    const bronze = tierProfiles.BRONZE;
    const preferred = bronze.filter(
        (profile) => profile.paid_visit_target === 0
    );

    if (garageCode === 'GAR001') {
        const repeatProfile = chooseEligibleProfile({
            profiles: preferred.length > 0 ? preferred : bronze,
            scenario: noShows[0],
        });

        for (const scenario of noShows) {
            if (!selectVehicle({ profile: repeatProfile, scenario })) {
                throw new Error(
                    `Repeat no-show customer is not eligible: ${repeatProfile.phone}`
                );
            }

            scenario.customer_profile = repeatProfile;
        }

        return;
    }

    const used = new Set();

    noShows.forEach((scenario, index) => {
        const profile = chooseEligibleProfile({
            profiles: bronze,
            scenario,
            predicate: (candidate) => !used.has(candidate.phone),
            offset: index,
        });

        scenario.customer_profile = profile;
        used.add(profile.phone);
    });
};

const assignFutureCustomers = ({ garageCode, scenarios, tierProfiles }) => {
    const confirmed = scenarios
        .filter((scenario) => scenario.kind === 'CONFIRMED')
        .sort((left, right) => (
            left.day_offset - right.day_offset
            || left.start_time - right.start_time
        ));
    const preferredAssignments = new Map();

    if (garageCode === 'GAR001' || garageCode === 'GAR002') {
        preferredAssignments.set(confirmed[0], tierProfiles.GOLD[0]);
        preferredAssignments.set(confirmed[1], tierProfiles.GOLD[0]);
    }

    if (garageCode === 'GAR003') {
        preferredAssignments.set(confirmed[0], tierProfiles.GOLD[0]);
        preferredAssignments.set(confirmed[1], tierProfiles.GOLD[0]);
        preferredAssignments.set(
            confirmed.find((scenario) => scenario.day_offset === 18),
            tierProfiles.PLATINUM[0]
        );
    }

    if (garageCode === 'GAR004') {
        const longWindowScenarios = confirmed.filter(
            (scenario) => scenario.day_offset >= 11
        );

        preferredAssignments.set(longWindowScenarios[0], tierProfiles.GOLD[0]);
        preferredAssignments.set(longWindowScenarios[1], tierProfiles.GOLD[0]);
    }

    if (garageCode === 'GAR005') {
        confirmed
            .filter((scenario) => [0, 9, 16].includes(scenario.day_offset))
            .forEach((scenario) => {
                preferredAssignments.set(scenario, tierProfiles.PLATINUM[0]);
            });
    }

    const profiles = TIER_ORDER.flatMap((tier) => tierProfiles[tier]);

    for (const scenario of confirmed) {
        const preferred = preferredAssignments.get(scenario);
        const candidates = profiles.filter((profile) => (
            TIER_WINDOWS[profile.tier_target] >= scenario.day_offset
            && profile.upcoming_booking_count
                < TIER_MAX_UPCOMING[profile.tier_target]
            && selectVehicle({ profile, scenario })
        )).sort((left, right) => (
            left.upcoming_booking_count - right.upcoming_booking_count
            || TIER_WINDOWS[left.tier_target] - TIER_WINDOWS[right.tier_target]
            || left.customer.created_at - right.customer.created_at
        ));
        const selected = preferred && candidates.includes(preferred)
            ? preferred
            : candidates[0];

        if (!selected) {
            throw new Error(
                `No eligible future customer: ${garageCode}:+${scenario.day_offset}`
            );
        }

        scenario.customer_profile = selected;
        selected.upcoming_booking_count += 1;
    }
};

const assignRemainingCustomers = ({
    garageCode,
    scenarios,
    tierProfiles,
}) => {
    const profiles = TIER_ORDER.flatMap((tier) => tierProfiles[tier]);
    const remaining = scenarios.filter(
        (scenario) => (
            scenario.channel === 'CUSTOMER'
            && !scenario.customer_profile
        )
    );

    for (const scenario of remaining) {
        const profile = chooseEligibleProfile({
            profiles,
            scenario,
            predicate: (candidate) => (
                !scenario.force_wash_bay || hasGasVehicle(candidate)
            ),
            offset: scenario.seed_sequence + Number(garageCode.slice(-1)),
        });

        scenario.customer_profile = profile;
    }
};

const buildCustomerProfiles = async ({
    referenceDate,
    session,
}) => {
    const customerDefinitions = buildCustomerSeedUsers(referenceDate);
    const vehicleDefinitions = buildVehicleDefinitions(referenceDate);
    const customerPhones = customerDefinitions.map(
        (definition) => normalizePhone(definition.phone)
    );
    const customerQuery = User.find({
        phone: { $in: customerPhones },
        role: USER_ROLES.CUSTOMER,
        is_active: true,
    }).select('_id phone full_name email created_at');
    const vehicleQuery = Vehicle.find({
        normalized_license_plate: {
            $in: vehicleDefinitions.map(
                (definition) => definition.normalized_license_plate
            ),
        },
        is_active: true,
    });

    if (session) {
        customerQuery.session(session);
        vehicleQuery.session(session);
    }

    const [customers, vehicles] = await Promise.all([
        customerQuery.lean(),
        vehicleQuery.lean(),
    ]);

    if (
        customers.length !== customerDefinitions.length
        || vehicles.length !== vehicleDefinitions.length
    ) {
        throw new Error(
            `Booking customer dependencies are incomplete: customers ${customers.length}/${customerDefinitions.length}, vehicles ${vehicles.length}/${vehicleDefinitions.length}`
        );
    }

    const customerByPhone = new Map(
        customers.map((customer) => [customer.phone, customer])
    );
    const vehiclesByCustomerId = new Map();

    for (const vehicle of vehicles) {
        const customerId = toId(vehicle.customer_id);
        const list = vehiclesByCustomerId.get(customerId) || [];

        list.push(vehicle);
        vehiclesByCustomerId.set(customerId, list);
    }

    const profilesByGarage = {};

    for (const definition of customerDefinitions) {
        const phone = normalizePhone(definition.phone);
        const customer = customerByPhone.get(phone);
        const customerVehicles = vehiclesByCustomerId.get(toId(customer?._id)) || [];

        if (!customer || customerVehicles.length === 0) {
            throw new Error(`Booking customer profile is incomplete: ${phone}`);
        }

        const profile = {
            phone,
            customer,
            vehicles: customerVehicles.sort(
                (left, right) => left.created_at - right.created_at
            ),
        };
        const list = profilesByGarage[definition.preferred_garage_code] || [];

        list.push(profile);
        profilesByGarage[definition.preferred_garage_code] = list;
    }

    return profilesByGarage;
};

const buildGuestIdentity = ({ scenario, walkInSequence }) => {
    const garageNumber = Number(scenario.garage_code.slice(-1));
    const vehicleType = getGuestVehicleType(
        scenario.garage_code,
        walkInSequence
    );
    const guestPhone = `0988${garageNumber}${String(
        10000 + walkInSequence
    ).slice(-5)}`;
    const serial = String(30000 + garageNumber * 1000 + walkInSequence * 37);
    const licensePlate = vehicleType === VEHICLE_TYPES.CAR
        ? `51Z-${serial.slice(0, 3)}.${serial.slice(3)}`
        : `59-Z9 ${serial.slice(0, 3)}.${serial.slice(3)}`;
    const electric = walkInSequence % 9 === 0;
    const largeCar = walkInSequence % 5 === 0;
    const snapshot = vehicleType === VEHICLE_TYPES.CAR
        ? {
            vehicle_type: VEHICLE_TYPES.CAR,
            engine_type: electric
                ? ENGINE_TYPES.ELECTRIC
                : ENGINE_TYPES.GASOLINE,
            motorbike_cc_group: null,
            car_body_type: largeCar
                ? CAR_BODY_TYPES.SUV
                : CAR_BODY_TYPES.SEDAN,
            seat_count: 5,
        }
        : {
            vehicle_type: VEHICLE_TYPES.MOTORBIKE,
            engine_type: electric
                ? ENGINE_TYPES.ELECTRIC
                : ENGINE_TYPES.GASOLINE,
            motorbike_cc_group: MOTORBIKE_CC_GROUPS.UNDER_175CC,
            car_body_type: null,
            seat_count: null,
        };

    if (scenario.force_wash_bay) {
        snapshot.engine_type = ENGINE_TYPES.GASOLINE;
    }

    return {
        guest_name: `Khách vãng lai ${String(walkInSequence).padStart(2, '0')}`,
        guest_phone: guestPhone,
        normalized_guest_phone: normalizePhone(guestPhone),
        guest_email: null,
        license_plate: licensePlate,
        normalized_license_plate: licensePlate
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, ''),
        snapshot,
    };
};

const selectServiceCodes = ({
    snapshot,
    tier,
    scenario,
}) => {
    const sequence = scenario.seed_sequence;
    const addOns = [];
    let primary;

    if (snapshot.vehicle_type === VEHICLE_TYPES.MOTORBIKE) {
        if (snapshot.engine_type === ENGINE_TYPES.ELECTRIC) {
            primary = 'MOTORBIKE_WASH_ELECTRIC';

            if (scenario.kind === 'COMPLETED_PAID' && sequence % 3 === 0) {
                addOns.push('MOTORBIKE_BRAKE_CHECK');
            }
        } else if (
            snapshot.motorbike_cc_group === MOTORBIKE_CC_GROUPS.OVER_175CC
        ) {
            primary = 'MOTORBIKE_WASH_BIG';

            if (['GOLD', 'PLATINUM'].includes(tier)) {
                addOns.push('MOTORBIKE_FULL_DETAIL');
            }
        } else if (['GOLD', 'PLATINUM'].includes(tier)) {
            primary = sequence % 2 === 0
                ? 'MOTORBIKE_COMBO_FULL_SERVICE'
                : 'MOTORBIKE_COMBO_WASH_OIL';

            if (scenario.kind === 'COMPLETED_PAID') {
                addOns.push(
                    sequence % 2 === 0
                        ? 'MOTORBIKE_OIL_FILTER'
                        : 'MOTORBIKE_FULL_DETAIL'
                );
            }
        } else if (tier === 'SILVER') {
            primary = sequence % 2 === 0
                ? 'MOTORBIKE_COMBO_WASH_OIL'
                : 'MOTORBIKE_WASH_PREMIUM';

            if (scenario.kind === 'COMPLETED_PAID' && sequence % 3 === 0) {
                addOns.push('MOTORBIKE_BRAKE_CHECK');
            }
        } else {
            primary = sequence % 4 === 0
                ? 'MOTORBIKE_WASH_PREMIUM'
                : 'MOTORBIKE_WASH_BASIC';

            if (scenario.kind === 'COMPLETED_PAID' && sequence % 5 === 0) {
                addOns.push('MOTORBIKE_TIRE_CHECK');
            }
        }

        return { primary, add_ons: addOns };
    }

    if (snapshot.engine_type === ENGINE_TYPES.ELECTRIC) {
        primary = 'CAR_WASH_ELECTRIC';

        if (
            scenario.kind === 'COMPLETED_PAID'
            && ['SILVER', 'GOLD', 'PLATINUM'].includes(tier)
        ) {
            addOns.push('CAR_INTERIOR_VACUUM');
        }
    } else if (
        [
            CAR_BODY_TYPES.SUV,
            CAR_BODY_TYPES.MPV,
            CAR_BODY_TYPES.PICKUP,
            CAR_BODY_TYPES.VAN,
        ].includes(snapshot.car_body_type)
    ) {
        primary = 'CAR_WASH_SUV_PICKUP';

        if (scenario.kind === 'COMPLETED_PAID') {
            if (tier === 'PLATINUM') {
                addOns.push('CAR_EXTERIOR_NANO');
            } else if (tier === 'GOLD') {
                addOns.push('CAR_EXTERIOR_CERAMIC');
            } else if (tier === 'SILVER') {
                addOns.push('CAR_INTERIOR_VACUUM');
            } else if (sequence % 5 === 0) {
                addOns.push('CAR_GLASS_CLEAN');
            }
        }
    } else if (tier === 'PLATINUM') {
        primary = sequence % 3 === 0
            ? 'CAR_COMBO_FULL_DETAIL'
            : 'CAR_COMBO_PROTECT';
    } else if (tier === 'GOLD') {
        primary = sequence % 2 === 0
            ? 'CAR_COMBO_PREMIUM'
            : 'CAR_COMBO_STANDARD';

        if (scenario.kind === 'COMPLETED_PAID' && sequence % 3 === 0) {
            addOns.push('CAR_EXTERIOR_WAX');
        }
    } else if (tier === 'SILVER') {
        primary = sequence % 2 === 0
            ? 'CAR_COMBO_EXPRESS'
            : 'CAR_WASH_STANDARD';

        if (scenario.kind === 'COMPLETED_PAID' && sequence % 3 === 0) {
            addOns.push('CAR_GLASS_COATING');
        }
    } else {
        primary = sequence % 3 === 0
            ? 'CAR_WASH_STANDARD'
            : 'CAR_WASH_BASIC';

        if (scenario.kind === 'COMPLETED_PAID' && sequence % 6 === 0) {
            addOns.push('CAR_GLASS_CLEAN');
        }
    }

    return { primary, add_ons: addOns };
};

const ruleSpecificity = (rule) => [
    rule.engine_type,
    rule.motorbike_cc_group,
    rule.car_body_type,
    rule.seat_min,
    rule.seat_max,
].filter((value) => value !== null && value !== undefined).length;

const resolvePackage = ({
    servicePackage,
    rulesByPackageId,
    snapshot,
    garageId,
    effectiveAt,
}) => {
    const matches = (rulesByPackageId.get(toId(servicePackage._id)) || [])
        .filter((rule) => (
            rule.is_active
            && rule.effective_from <= effectiveAt
            && (!rule.effective_to || rule.effective_to > effectiveAt)
            && (!rule.garage_id || toId(rule.garage_id) === toId(garageId))
            && servicePriceRuleMatchesVehicle(rule, snapshot)
        ));
    const garageMatches = matches.filter(
        (rule) => toId(rule.garage_id) === toId(garageId)
    );
    const scoped = garageMatches.length > 0
        ? garageMatches
        : matches.filter((rule) => !rule.garage_id);
    const sorted = scoped.sort((left, right) => (
        ruleSpecificity(right) - ruleSpecificity(left)
        || right.version - left.version
    ));
    const rule = sorted[0];

    if (!rule) {
        throw new Error(
            `No compatible price rule: ${servicePackage.service_code}:${JSON.stringify(snapshot)}`
        );
    }

    return {
        ...servicePackage,
        base_price: rule.price,
        duration_minutes: rule.duration_minutes
            ?? servicePackage.duration_minutes,
        wash_bay_duration_minutes: rule.wash_bay_duration_minutes
            ?? servicePackage.wash_bay_duration_minutes,
        care_staff_duration_minutes: rule.care_staff_duration_minutes
            ?? servicePackage.care_staff_duration_minutes,
        pricing_rule: rule,
        pricing_source: 'SERVICE_PRICE_RULE',
    };
};

const ceilToSlot = (date, intervalMinutes) => {
    const intervalMs = intervalMinutes * 60000;

    return new Date(Math.ceil(date.getTime() / intervalMs) * intervalMs);
};

const buildBookingPlan = ({
    scenario,
    snapshot,
    garage,
    packageByCode,
    packageById,
    rulesByPackageId,
}) => {
    const tier = scenario.customer_profile?.tier_target || 'BRONZE';
    const serviceCodes = selectServiceCodes({
        snapshot,
        tier,
        scenario,
    });
    const primaryPackage = packageByCode.get(serviceCodes.primary);

    if (!primaryPackage) {
        throw new Error(`Service package not found: ${serviceCodes.primary}`);
    }

    const resolvedPrimary = resolvePackage({
        servicePackage: primaryPackage,
        rulesByPackageId,
        snapshot,
        garageId: garage._id,
        effectiveAt: scenario.start_time,
    });
    const serviceItems = [];

    if (primaryPackage.service_type === SERVICE_PACKAGE_TYPES.COMBO) {
        for (const includedId of primaryPackage.included_service_ids || []) {
            const includedPackage = packageById.get(toId(includedId));

            if (!includedPackage) {
                throw new Error(
                    `Combo child not found: ${primaryPackage.service_code}:${includedId}`
                );
            }

            serviceItems.push({
                servicePackage: resolvePackage({
                    servicePackage: includedPackage,
                    rulesByPackageId,
                    snapshot,
                    garageId: garage._id,
                    effectiveAt: scenario.start_time,
                }),
                source: 'COMBO_INCLUDED',
                parentComboId: primaryPackage._id,
                priceSnapshot: 0,
            });
        }
    } else {
        serviceItems.push({
            servicePackage: resolvedPrimary,
            source: 'PRIMARY',
            parentComboId: null,
            priceSnapshot: resolvedPrimary.base_price,
        });
    }

    const resolvedAddOns = serviceCodes.add_ons.map((serviceCode) => {
        const servicePackage = packageByCode.get(serviceCode);

        if (!servicePackage) {
            throw new Error(`Add-on service not found: ${serviceCode}`);
        }

        return resolvePackage({
            servicePackage,
            rulesByPackageId,
            snapshot,
            garageId: garage._id,
            effectiveAt: scenario.start_time,
        });
    });

    resolvedAddOns.forEach((servicePackage) => {
        serviceItems.push({
            servicePackage,
            source: 'ADD_ON',
            parentComboId: null,
            priceSnapshot: servicePackage.base_price,
        });
    });

    let elapsedMinutes = 0;
    const bookingItems = serviceItems.map((item, index) => {
        const servicePackage = item.servicePackage;
        const itemStartTime = addMinutes(
            scenario.start_time,
            elapsedMinutes
        );
        const itemEndTime = addMinutes(
            itemStartTime,
            servicePackage.duration_minutes
        );
        const washBayStartTime = servicePackage.requires_wash_bay
            ? addMinutes(
                itemStartTime,
                servicePackage.wash_bay_start_offset_minutes || 0
            )
            : null;
        const washBayWorkEndTime = washBayStartTime
            ? addMinutes(
                washBayStartTime,
                servicePackage.wash_bay_duration_minutes
                    || servicePackage.duration_minutes
            )
            : null;
        const careStaffStartTime = servicePackage.requires_care_staff
            ? addMinutes(
                itemStartTime,
                servicePackage.care_staff_start_offset_minutes || 0
            )
            : null;
        const careStaffWorkEndTime = careStaffStartTime
            ? addMinutes(
                careStaffStartTime,
                servicePackage.care_staff_duration_minutes
                    || servicePackage.duration_minutes
            )
            : null;

        elapsedMinutes += servicePackage.duration_minutes;

        return {
            item_key: `ITEM_${index + 1}_${toId(
                servicePackage._id
            ).toUpperCase()}`,
            service_package_id: servicePackage._id,
            service_price_rule_id: servicePackage.pricing_rule._id,
            price_rule_version: servicePackage.pricing_rule.version,
            pricing_source: 'SERVICE_PRICE_RULE',
            source: item.source,
            parent_combo_id: item.parentComboId,
            name_snapshot: servicePackage.name,
            price_snapshot: item.priceSnapshot,
            duration_minutes: servicePackage.duration_minutes,
            countdown_duration_seconds:
                servicePackage.countdown_duration_seconds
                || servicePackage.duration_minutes * 60,
            transition_mode: servicePackage.transition_mode,
            item_start_time: itemStartTime,
            item_end_time: itemEndTime,
            sequence: index + 1,
            requires_wash_bay: servicePackage.requires_wash_bay,
            wash_bay_start_time: washBayStartTime,
            wash_bay_end_time: washBayWorkEndTime,
            wash_bay_work_end_time: washBayWorkEndTime,
            wash_bay_reserved_until: washBayWorkEndTime
                ? ceilToSlot(
                    washBayWorkEndTime,
                    garage.slot_interval_minutes
                )
                : null,
            requires_care_staff: servicePackage.requires_care_staff,
            care_staff_type: servicePackage.requires_care_staff
                ? servicePackage.care_staff_type
                    || STAFF_TYPES.VEHICLE_CARE_STAFF
                : null,
            care_staff_required_count: servicePackage.requires_care_staff
                ? servicePackage.care_staff_required_count || 1
                : 0,
            care_staff_start_time: careStaffStartTime,
            care_staff_end_time: careStaffWorkEndTime,
            care_staff_work_end_time: careStaffWorkEndTime,
            care_staff_reserved_until: careStaffWorkEndTime
                ? ceilToSlot(
                    careStaffWorkEndTime,
                    garage.slot_interval_minutes
                )
                : null,
            assigned_care_staff: [],
            assigned_execution_staff: [],
            status: BOOKING_ITEM_STATUS.PENDING,
            actual_started_at: null,
            countdown_ends_at: null,
            actual_completed_at: null,
            remaining_seconds_at_pause: null,
            countdown_resume_seconds: null,
            paused_at: null,
            paused_by_staff_id: null,
            pause_reason: null,
            total_paused_seconds: 0,
            completion_source: null,
            completed_by_staff_id: null,
            completion_note: null,
            timer_claimed_at: null,
            timer_claim_token: null,
        };
    });
    const washBayItems = bookingItems.filter(
        (item) => item.requires_wash_bay
    );
    const careStaffItems = bookingItems.filter(
        (item) => item.requires_care_staff
    );
    const getMinimum = (items, field) => (
        items.length > 0
            ? new Date(Math.min(...items.map((item) => item[field].getTime())))
            : null
    );
    const getMaximum = (items, field) => (
        items.length > 0
            ? new Date(Math.max(...items.map((item) => item[field].getTime())))
            : null
    );

    return {
        primary: resolvedPrimary,
        add_ons: resolvedAddOns,
        booking_items: bookingItems,
        end_time: addMinutes(scenario.start_time, elapsedMinutes),
        original_price: resolvedPrimary.base_price
            + resolvedAddOns.reduce(
                (total, servicePackage) => total + servicePackage.base_price,
                0
            ),
        requires_wash_bay: washBayItems.length > 0,
        wash_bay_start_time: getMinimum(
            washBayItems,
            'wash_bay_start_time'
        ),
        wash_bay_end_time: getMaximum(
            washBayItems,
            'wash_bay_end_time'
        ),
        wash_bay_work_end_time: getMaximum(
            washBayItems,
            'wash_bay_work_end_time'
        ),
        wash_bay_reserved_until: getMaximum(
            washBayItems,
            'wash_bay_reserved_until'
        ),
        requires_care_staff: careStaffItems.length > 0,
        care_staff_type: careStaffItems[0]?.care_staff_type || null,
        care_staff_required_count: careStaffItems.length > 0
            ? Math.max(...careStaffItems.map(
                (item) => item.care_staff_required_count
            ))
            : 0,
        care_staff_start_time: getMinimum(
            careStaffItems,
            'care_staff_start_time'
        ),
        care_staff_end_time: getMaximum(
            careStaffItems,
            'care_staff_end_time'
        ),
        care_staff_work_end_time: getMaximum(
            careStaffItems,
            'care_staff_work_end_time'
        ),
        care_staff_reserved_until: getMaximum(
            careStaffItems,
            'care_staff_reserved_until'
        ),
    };
};

const applyWorkflowState = ({
    record,
    scenario,
    plan,
    staffByGarageType,
    referenceDate,
}) => {
    const staffTypes = staffByGarageType.get(scenario.garage_code);
    const checkInProfile = staffTypes.get(
        STAFF_TYPES.CUSTOMER_SERVICE_STAFF
    )[0];
    const inspectionProfile = staffTypes.get(
        STAFF_TYPES.VEHICLE_INSPECTION_STAFF
    )[0];
    const processed = PROCESSED_KINDS.has(scenario.kind);
    const completed = scenario.kind.startsWith('COMPLETED');

    if (processed) {
        const arrivedAt = scenario.kind === 'CHECKED_IN'
            ? addMinutes(referenceDate, -10)
            : addMinutes(scenario.start_time, -5);

        Object.assign(record, {
            assigned_inspection_staff_id: inspectionProfile.user_id,
            arrival_status: scenario.kind === 'CHECKED_IN'
                ? BOOKING_ARRIVAL_STATUS.EARLY
                : BOOKING_ARRIVAL_STATUS.ON_TIME,
            arrived_at: arrivedAt,
            arrival_reference_start_time: scenario.start_time,
            check_in_method: 'MANUAL',
            check_in_detected_plate: record.normalized_license_plate,
            check_in_match_type: 'EXACT',
            check_in_manual_override: false,
            checked_in_at: arrivedAt,
        });
    }

    if (scenario.kind === 'CANCELED') {
        Object.assign(record, {
            canceled_at: addHours(scenario.start_time, -8),
            canceled_by_id: record.customer_id || checkInProfile.user_id,
            cancel_reason: 'Khách thay đổi kế hoạch và đã hủy trước giờ hẹn.',
            cancellation_source: record.customer_id
                ? BOOKING_CANCELLATION_SOURCES.CUSTOMER
                : BOOKING_CANCELLATION_SOURCES.STAFF_CUSTOMER_REQUEST,
            updated_at: addHours(scenario.start_time, -8),
        });
    }

    if (scenario.kind === 'NO_SHOW') {
        Object.assign(record, {
            no_show_at: addMinutes(scenario.start_time, 20),
            no_show_by_id: checkInProfile.user_id,
            no_show_reason: 'Khách không đến sau thời gian chờ quy định.',
            updated_at: addMinutes(scenario.start_time, 20),
        });
    }

    if (scenario.kind === 'CHECKED_IN') {
        record.updated_at = addMinutes(referenceDate, -10);
    }

    if (scenario.kind === 'IN_PROGRESS' || completed) {
        record.started_at = scenario.start_time;
    }

    const workflowItems = scenario.kind === 'IN_PROGRESS'
        ? plan.booking_items.slice(0, 1)
        : completed
            ? plan.booking_items
            : [];

    for (const [index, item] of plan.booking_items.entries()) {
        if (!workflowItems.includes(item)) {
            continue;
        }

        const actualStartedAt = item.item_start_time;
        const actualCompletedAt = completed
            ? item.item_end_time
            : null;

        item.status = completed
            ? BOOKING_ITEM_STATUS.DONE
            : BOOKING_ITEM_STATUS.IN_PROGRESS;
        item.actual_started_at = actualStartedAt;
        item.countdown_ends_at = addMinutes(
            actualStartedAt,
            item.duration_minutes
        );
        item.actual_completed_at = actualCompletedAt;
        item.completion_source = completed ? 'TIMER' : null;

        const requiredType = item.requires_care_staff
            ? item.care_staff_type
            : item.requires_wash_bay
                ? STAFF_TYPES.WASH_OPERATOR
                : null;

        if (!requiredType) {
            continue;
        }

        const profiles = staffTypes.get(requiredType);
        const assignmentCount = item.requires_care_staff
            ? item.care_staff_required_count
            : 1;
        const assignments = Array.from(
            { length: assignmentCount },
            (_, assignmentIndex) => {
                const profile = profiles[
                    (scenario.seed_sequence + index + assignmentIndex)
                    % profiles.length
                ];

                return {
                    staff_profile_id: profile._id,
                    user_id: profile.user_id,
                    assigned_at: addMinutes(actualStartedAt, -5),
                    released_at: completed ? actualCompletedAt : null,
                };
            }
        );

        if (item.requires_care_staff) {
            item.assigned_care_staff = assignments;
        }

        item.assigned_execution_staff = assignments;
        item.completed_by_staff_id = completed
            ? assignments[0].user_id
            : null;
    }

    if (completed) {
        record.completed_at = addMinutes(plan.end_time, 5);
        record.updated_at = record.completed_at;
    }

    if (scenario.kind === 'IN_PROGRESS') {
        record.updated_at = referenceDate;
    }

    record.assigned_care_staff_ids = uniqueIds(
        plan.booking_items.flatMap(
            (item) => item.assigned_care_staff
                .filter((assignment) => !assignment.released_at)
                .map((assignment) => assignment.staff_profile_id)
        )
    );
};

const selectWashBay = ({
    scenario,
    garageId,
    vehicleType,
    washBaysByGarageType,
}) => {
    const key = `${toId(garageId)}:${vehicleType}`;
    const candidates = washBaysByGarageType.get(key) || [];

    if (candidates.length === 0) {
        throw new Error(
            `Wash bay is missing: ${scenario.garage_code}:${vehicleType}`
        );
    }

    return candidates[scenario.seed_sequence % candidates.length];
};

const buildPaymentSets = (scenarios) => {
    const paid = scenarios.filter(
        (scenario) => scenario.kind === 'COMPLETED_PAID'
    );
    const payosIds = new Set();

    for (let index = 0; index < 125; index += 1) {
        const position = Math.floor(
            ((index + 0.5) * paid.length) / 125
        );

        payosIds.add(paid[position].booking_id_hex);
    }

    if (payosIds.size !== 125) {
        throw new Error(`PayOS booking target mismatch: ${payosIds.size}`);
    }

    return { payosIds };
};

const buildBookingRecord = ({
    scenario,
    garage,
    plan,
    vehicle,
    guest,
    staffByGarageType,
    washBaysByGarageType,
    paymentSets,
    referenceDate,
}) => {
    const checkInProfile = staffByGarageType
        .get(scenario.garage_code)
        .get(STAFF_TYPES.CUSTOMER_SERVICE_STAFF)[0];
    const snapshot = guest?.snapshot || buildVehicleSnapshot(vehicle);
    const processed = PROCESSED_KINDS.has(scenario.kind);
    const walkIn = scenario.channel === 'WALK_IN';
    const completedPaid = scenario.kind === 'COMPLETED_PAID';
    const completedNonpaid = scenario.kind === 'COMPLETED_NONPAID';
    const completedAt = addMinutes(plan.end_time, 5);
    const preferredCreatedAt = walkIn
        ? scenario.kind === 'CANCELED'
            ? addHours(scenario.start_time, -24)
            : scenario.kind === 'CHECKED_IN'
                ? addMinutes(scenario.start_time, -50)
                : addMinutes(scenario.start_time, -12)
        : addHours(scenario.start_time, -(18 + scenario.seed_sequence % 55));
    const minimumCreatedAt = vehicle
        ? addMinutes(vehicle.created_at, 30)
        : preferredCreatedAt;
    const createdAt = new Date(Math.max(
        preferredCreatedAt.getTime(),
        minimumCreatedAt.getTime()
    ));

    if (createdAt >= scenario.start_time) {
        throw new Error(
            `Booking was created after start: ${scenario.garage_code}:${scenario.seed_sequence}`
        );
    }

    const bookingDate = new Date(Date.UTC(
        scenario.start_time.getUTCFullYear(),
        scenario.start_time.getUTCMonth(),
        scenario.start_time.getUTCDate()
    ));
    const record = {
        _id: new mongoose.Types.ObjectId(scenario.booking_id_hex),
        customer_id: walkIn
            ? null
            : scenario.customer_profile.customer._id,
        vehicle_id: walkIn ? null : vehicle._id,
        is_walk_in: walkIn,
        is_rework: false,
        original_booking_id: null,
        customer_case_id: null,
        customer_case_resolution_id: null,
        guest_name: guest?.guest_name || null,
        guest_phone: guest?.guest_phone || null,
        normalized_guest_phone: guest?.normalized_guest_phone || null,
        guest_email: guest?.guest_email || null,
        license_plate: guest?.license_plate || vehicle.raw_license_plate,
        normalized_license_plate:
            guest?.normalized_license_plate
            || vehicle.normalized_license_plate,
        vehicle_type: snapshot.vehicle_type,
        quoted_vehicle_snapshot: snapshot,
        verified_vehicle_snapshot: processed || walkIn ? snapshot : null,
        pricing_review_status: processed || walkIn
            ? 'NOT_REQUIRED'
            : 'REVIEW_REQUIRED',
        price_adjustments: [],
        created_by_staff_id: walkIn ? checkInProfile.user_id : null,
        assigned_inspection_staff_id: null,
        garage_id: garage._id,
        wash_bay_id: null,
        service_package_id: plan.primary._id,
        service_price_rule_id: plan.primary.pricing_rule._id,
        price_rule_version: plan.primary.pricing_rule.version,
        pricing_source: 'SERVICE_PRICE_RULE',
        add_on_service_ids: plan.add_ons.map(
            (servicePackage) => servicePackage._id
        ),
        booking_items: plan.booking_items,
        booking_date: bookingDate,
        start_time: scenario.start_time,
        end_time: plan.end_time,
        wash_bay_start_time: plan.wash_bay_start_time,
        wash_bay_end_time: plan.wash_bay_end_time,
        wash_bay_work_end_time: plan.wash_bay_work_end_time,
        wash_bay_reserved_until: plan.wash_bay_reserved_until,
        original_price: plan.original_price,
        promotion_discount_amount: 0,
        points_discount_amount: 0,
        voucher_discount_amount: 0,
        discount_amount: 0,
        final_price: plan.original_price,
        payment_method: completedPaid
            && paymentSets.payosIds.has(scenario.booking_id_hex)
            ? BOOKING_PAYMENT_METHOD.PAYOS
            : BOOKING_PAYMENT_METHOD.CASH,
        payment_status: completedPaid
            ? BOOKING_PAYMENT_STATUS.PAID
            : BOOKING_PAYMENT_STATUS.UNPAID,
        pre_waiver_final_price: null,
        waived_amount: 0,
        waiver_resolution_ids: [],
        used_points: 0,
        earned_points: 0,
        promotion_id: null,
        customer_voucher_id: null,
        requires_wash_bay: plan.requires_wash_bay,
        requires_care_staff: plan.requires_care_staff,
        care_staff_type: plan.care_staff_type,
        care_staff_required_count: plan.care_staff_required_count,
        care_staff_start_time: plan.care_staff_start_time,
        care_staff_end_time: plan.care_staff_end_time,
        care_staff_work_end_time: plan.care_staff_work_end_time,
        care_staff_reserved_until: plan.care_staff_reserved_until,
        assigned_care_staff_ids: [],
        status: scenario.status,
        operation_status: BOOKING_OPERATION_STATUS.NORMAL,
        active_incident_id: null,
        arrival_status: null,
        arrived_at: null,
        arrival_reference_start_time: null,
        late_minutes: 0,
        grace_exceeded_minutes: 0,
        late_resolution: null,
        checked_in_at: null,
        started_at: null,
        completed_at: null,
        paid_at: completedPaid
            ? addMinutes(completedAt, 5)
            : null,
        canceled_at: null,
        no_show_at: null,
        canceled_by_id: null,
        cancellation_source: null,
        reward_processed: false,
        reward_processed_at: null,
        note: walkIn
            ? 'Khách vãng lai được tiếp nhận trực tiếp tại garage.'
            : null,
        created_at: createdAt,
        updated_at: createdAt,
    };

    applyWorkflowState({
        record,
        scenario,
        plan,
        staffByGarageType,
        referenceDate,
    });

    if (
        plan.requires_wash_bay
        && (scenario.kind === 'IN_PROGRESS' || completedPaid || completedNonpaid)
    ) {
        record.wash_bay_id = selectWashBay({
            scenario,
            garageId: garage._id,
            vehicleType: snapshot.vehicle_type,
            washBaysByGarageType,
        })._id;
    }

    const validationError = new Booking(record).validateSync();

    if (validationError) {
        throw validationError;
    }

    return record;
};

const groupStaffProfiles = (profiles, garageById) => {
    const result = new Map();

    for (const garageCode of [...garageById.values()].map(
        (garage) => garage.garage_code
    )) {
        result.set(garageCode, new Map());
    }

    for (const profile of profiles) {
        const garage = garageById.get(toId(profile.garage_id));

        if (!garage) {
            continue;
        }

        const byType = result.get(garage.garage_code);
        const list = byType.get(profile.staff_type) || [];

        list.push(profile);
        byType.set(profile.staff_type, list);
    }

    for (const [garageCode, byType] of result.entries()) {
        for (const staffType of Object.values(STAFF_TYPES)) {
            if (!(byType.get(staffType) || []).length) {
                throw new Error(
                    `Booking staff dependency is missing: ${garageCode}:${staffType}`
                );
            }
        }
    }

    return result;
};

const groupWashBays = (washBays) => {
    const result = new Map();

    for (const washBay of washBays) {
        const key = `${toId(washBay.garage_id)}:${washBay.vehicle_type}`;
        const list = result.get(key) || [];

        list.push(washBay);
        result.set(key, list);
    }

    return result;
};

const loadBookingDependencies = async ({ session }) => {
    const queries = [
        Garage.find({ is_active: true }),
        ServicePackage.find({ is_active: true }),
        ServicePriceRule.find({ is_active: true }),
        StaffProfile.find({ is_active: true }),
        WashBay.find({ is_active: true }),
    ];

    if (session) {
        queries.forEach((query) => query.session(session));
    }

    const [
        garages,
        servicePackages,
        priceRules,
        staffProfiles,
        washBays,
    ] = await Promise.all(queries.map((query) => query.lean()));
    const garageByCode = new Map(
        garages.map((garage) => [garage.garage_code, garage])
    );
    const garageById = new Map(
        garages.map((garage) => [toId(garage._id), garage])
    );
    const packageByCode = new Map(
        servicePackages.map(
            (servicePackage) => [
                servicePackage.service_code,
                servicePackage,
            ]
        )
    );
    const packageById = new Map(
        servicePackages.map(
            (servicePackage) => [toId(servicePackage._id), servicePackage]
        )
    );
    const rulesByPackageId = new Map();

    for (const rule of priceRules) {
        const packageId = toId(rule.service_package_id);
        const list = rulesByPackageId.get(packageId) || [];

        list.push(rule);
        rulesByPackageId.set(packageId, list);
    }

    if (garageByCode.size !== 5) {
        throw new Error(
            `Booking garage dependency mismatch: ${garageByCode.size}/5`
        );
    }

    return {
        garageByCode,
        packageByCode,
        packageById,
        rulesByPackageId,
        staffByGarageType: groupStaffProfiles(
            staffProfiles,
            garageById
        ),
        washBays,
        washBaysByGarageType: groupWashBays(washBays),
    };
};

const assignScenarioCustomers = ({
    scenarios,
    profilesByGarage,
}) => {
    for (const [garageCode, garageProfiles] of Object.entries(
        profilesByGarage
    )) {
        const garageScenarios = scenarios.filter(
            (scenario) => scenario.garage_code === garageCode
        );
        const tierProfiles = chooseTierProfiles({
            garageCode,
            profiles: garageProfiles,
        });

        assignPaidCustomers({
            scenarios: garageScenarios,
            tierProfiles,
        });
        assignNoShowCustomers({
            garageCode,
            scenarios: garageScenarios,
            tierProfiles,
        });
        assignFutureCustomers({
            garageCode,
            scenarios: garageScenarios,
            tierProfiles,
        });
        assignRemainingCustomers({
            garageCode,
            scenarios: garageScenarios,
            tierProfiles,
        });
    }
};

const buildBookingRecords = async ({
    scenarios,
    referenceDate,
    session,
}) => {
    const dependencies = await loadBookingDependencies({ session });
    const profilesByGarage = await buildCustomerProfiles({
        referenceDate,
        session,
    });

    assignScenarioCustomers({
        scenarios,
        profilesByGarage,
    });

    const paymentSets = buildPaymentSets(scenarios);
    const records = [];
    let walkInSequence = 0;

    for (const scenario of scenarios) {
        const garage = dependencies.garageByCode.get(
            scenario.garage_code
        );
        let vehicle = null;
        let guest = null;

        if (scenario.channel === 'WALK_IN') {
            walkInSequence += 1;
            guest = buildGuestIdentity({
                scenario,
                walkInSequence,
            });
        } else {
            vehicle = selectVehicle({
                profile: scenario.customer_profile,
                scenario,
                preferGas: scenario.force_wash_bay
                    || ['GOLD', 'PLATINUM'].includes(
                        scenario.customer_profile.tier_target
                    ),
            });

            if (!vehicle) {
                throw new Error(
                    `Booking vehicle assignment failed: ${scenario.garage_code}:${scenario.seed_sequence}`
                );
            }
        }

        const snapshot = guest?.snapshot || buildVehicleSnapshot(vehicle);
        const plan = buildBookingPlan({
            scenario,
            snapshot,
            garage,
            packageByCode: dependencies.packageByCode,
            packageById: dependencies.packageById,
            rulesByPackageId: dependencies.rulesByPackageId,
        });

        records.push(buildBookingRecord({
            scenario,
            garage,
            plan,
            vehicle,
            guest,
            staffByGarageType: dependencies.staffByGarageType,
            washBaysByGarageType:
                dependencies.washBaysByGarageType,
            paymentSets,
            referenceDate,
        }));
    }

    return {
        records,
        dependencies,
    };
};

const upsertBookings = async ({ records, session }) => {
    const result = await Booking.bulkWrite(
        records.map((record) => ({
            replaceOne: {
                filter: { _id: record._id },
                replacement: record,
                upsert: true,
            },
        })),
        {
            ordered: true,
            session,
            timestamps: false,
        }
    );

    return {
        matched: result.matchedCount,
        modified: result.modifiedCount,
        inserted: result.upsertedCount,
    };
};

const rebuildNoShowViolations = async ({
    records,
    staffByGarageType,
    garageByCode,
    session,
}) => {
    const noShows = records
        .filter((record) => record.status === BOOKING_STATUS.NO_SHOW)
        .sort((left, right) => left.no_show_at - right.no_show_at);
    const eventIds = noShows.map(
        (booking) => new mongoose.Types.ObjectId(
            stableHexId(
                'AUTOWASH_BOOKING_VIOLATION_V1',
                toId(booking._id)
            )
        )
    );

    await BookingViolationEvent.bulkWrite(
        noShows.map((booking, index) => {
            const garageCode = [...garageByCode.entries()].find(
                ([, garage]) => (
                    toId(garage._id) === toId(booking.garage_id)
                )
            )?.[0];
            const checkInProfile = staffByGarageType
                .get(garageCode)
                .get(STAFF_TYPES.CUSTOMER_SERVICE_STAFF)[0];
            const payload = {
                _id: eventIds[index],
                booking_id: booking._id,
                customer_id: booking.customer_id,
                event: BOOKING_VIOLATION_EVENTS.NO_SHOW,
                score_change:
                    BOOKING_VIOLATION_SCORE[
                        BOOKING_VIOLATION_EVENTS.NO_SHOW
                    ],
                score_before: 0,
                score_after:
                    BOOKING_VIOLATION_SCORE[
                        BOOKING_VIOLATION_EVENTS.NO_SHOW
                    ],
                reason: booking.no_show_reason,
                created_by: checkInProfile.user_id,
                created_at: booking.no_show_at,
            };
            const validationError = new BookingViolationEvent(
                payload
            ).validateSync();

            if (validationError) {
                throw validationError;
            }

            return {
                replaceOne: {
                    filter: { _id: payload._id },
                    replacement: payload,
                    upsert: true,
                },
            };
        }),
        {
            ordered: true,
            session,
            timestamps: false,
        }
    );

    const customerIds = uniqueIds(
        noShows.map((booking) => booking.customer_id)
    );
    const eventQuery = BookingViolationEvent.find({
        customer_id: { $in: customerIds },
    }).sort({ customer_id: 1, created_at: 1, _id: 1 });

    if (session) {
        eventQuery.session(session);
    }

    const allEvents = await eventQuery.lean();
    const scoreByCustomer = new Map();
    const lastViolationByCustomer = new Map();
    const eventUpdates = [];

    for (const event of allEvents) {
        const customerId = toId(event.customer_id);
        const scoreBefore = scoreByCustomer.get(customerId) || 0;
        const scoreAfter = Math.max(
            0,
            scoreBefore + event.score_change
        );

        scoreByCustomer.set(customerId, scoreAfter);

        if (event.score_change > 0) {
            lastViolationByCustomer.set(customerId, event.created_at);
        }

        eventUpdates.push({
            updateOne: {
                filter: { _id: event._id },
                update: {
                    $set: {
                        score_before: scoreBefore,
                        score_after: scoreAfter,
                    },
                },
                timestamps: false,
            },
        });
    }

    if (eventUpdates.length > 0) {
        await BookingViolationEvent.bulkWrite(eventUpdates, {
            ordered: true,
            session,
        });
    }

    const summaryOperations = customerIds.map((customerId) => {
        const customerEvents = allEvents.filter(
            (event) => toId(event.customer_id) === toId(customerId)
        );
        const lastEvent = customerEvents[customerEvents.length - 1];
        const payload = {
            customer_id: customerId,
            violation_score: scoreByCustomer.get(toId(customerId)) || 0,
            booking_blocked_until: null,
            booking_block_count: 0,
            last_violation_at:
                lastViolationByCustomer.get(toId(customerId)) || null,
            last_event_at: lastEvent?.created_at || null,
            updated_at: lastEvent?.created_at || new Date(),
        };
        const validationError = new CustomerBookingViolation(
            payload
        ).validateSync();

        if (validationError) {
            throw validationError;
        }

        return {
            updateOne: {
                filter: { customer_id: customerId },
                update: {
                    $set: payload,
                    $setOnInsert: {
                        created_at: lastEvent?.created_at || new Date(),
                    },
                },
                upsert: true,
                timestamps: false,
            },
        };
    });

    if (summaryOperations.length > 0) {
        await CustomerBookingViolation.bulkWrite(summaryOperations, {
            ordered: true,
            session,
        });
    }

    return {
        events: noShows.length,
        customers: customerIds.length,
    };
};

const syncWashBayState = async ({
    records,
    washBays,
    session,
}) => {
    await WashBay.updateMany(
        {
            _id: { $in: washBays.map((washBay) => washBay._id) },
        },
        {
            $set: {
                status: WASH_BAY_STATUS.AVAILABLE,
                current_booking_id: null,
            },
        },
        {
            session,
        }
    );
    const active = records.filter(
        (record) => (
            record.status === BOOKING_STATUS.IN_PROGRESS
            && record.wash_bay_id
        )
    );

    if (active.length > 0) {
        await WashBay.bulkWrite(
            active.map((booking) => ({
                updateOne: {
                    filter: { _id: booking.wash_bay_id },
                    update: {
                        $set: {
                            status: WASH_BAY_STATUS.OCCUPIED,
                            current_booking_id: booking._id,
                        },
                    },
                },
            })),
            {
                ordered: true,
                session,
            }
        );
    }

    return {
        available: washBays.length - active.length,
        occupied: active.length,
    };
};

const summarizeRecords = (records) => ({
    planned: records.length,
    by_status: records.reduce((counts, record) => ({
        ...counts,
        [record.status]: (counts[record.status] || 0) + 1,
    }), {}),
    walk_in: records.filter((record) => record.is_walk_in).length,
    customer: records.filter((record) => !record.is_walk_in).length,
    completed_paid: records.filter((record) => (
        record.status === BOOKING_STATUS.COMPLETED
        && record.payment_status === BOOKING_PAYMENT_STATUS.PAID
    )).length,
    completed_nonpaid: records.filter((record) => (
        record.status === BOOKING_STATUS.COMPLETED
        && record.payment_status !== BOOKING_PAYMENT_STATUS.PAID
    )).length,
    cash_paid: records.filter((record) => (
        record.payment_status === BOOKING_PAYMENT_STATUS.PAID
        && record.payment_method === BOOKING_PAYMENT_METHOD.CASH
    )).length,
    payos_paid: records.filter((record) => (
        record.payment_status === BOOKING_PAYMENT_STATUS.PAID
        && record.payment_method === BOOKING_PAYMENT_METHOD.PAYOS
    )).length,
});

const seedBooking = async ({
    session = null,
    referenceDate = getSeedReferenceDate(),
    dryRun = false,
} = {}) => {
    console.log('== Seeding bookings and booking violations ==');

    const scenarios = buildBookingScenarios(referenceDate);
    const scenarioSummary = assertBookingScenarioPlan(scenarios);

    if (dryRun) {
        console.table(Object.entries(scenarioSummary.by_garage).map(
            ([garageCode, total]) => ({
                garage_code: garageCode,
                total,
            })
        ));

        return {
            ...scenarioSummary,
            dry_run: true,
        };
    }

    const { records, dependencies } = await buildBookingRecords({
        scenarios,
        referenceDate,
        session,
    });
    const recordSummary = summarizeRecords(records);

    if (
        recordSummary.completed_paid !== 355
        || recordSummary.completed_nonpaid !== 10
        || recordSummary.cash_paid !== 230
        || recordSummary.payos_paid !== 125
    ) {
        throw new Error(
            `Booking payment target mismatch: ${JSON.stringify(recordSummary)}`
        );
    }

    const bookingWrite = await upsertBookings({ records, session });
    const violations = await rebuildNoShowViolations({
        records,
        staffByGarageType: dependencies.staffByGarageType,
        garageByCode: dependencies.garageByCode,
        session,
    });
    const washBays = await syncWashBayState({
        records,
        washBays: dependencies.washBays,
        session,
    });
    const completedSummary = {
        ...recordSummary,
        dry_run: false,
        booking_write: bookingWrite,
        violations,
        wash_bays: washBays,
    };

    console.table([{
        planned: completedSummary.planned,
        inserted: bookingWrite.inserted,
        matched: bookingWrite.matched,
        completed_paid: completedSummary.completed_paid,
        no_show: completedSummary.by_status.NO_SHOW,
        violation_customers: violations.customers,
    }]);
    console.log('Bookings and booking violations seeding completed');

    return completedSummary;
};

module.exports = seedBooking;
module.exports.buildBookingRecords = buildBookingRecords;
module.exports.summarizeRecords = summarizeRecords;
