const mongoose = require('mongoose');

const ServicePriceRule = require('./servicePriceRule.model');
const PriceQuote = require('./priceQuote.model');
const ServicePackage = require('../service-packages/servicePackage.model');
const Garage = require('../garages/garage.model');
const Vehicle = require('../vehicles/vehicle.model');
const StaffProfile = require('../staff-profiles/staffProfile.model');
const auditLogService = require('../audit-logs/auditLog.service');
const { AppError } = require('../../shared/utils/appError');
const { USER_ROLES } = require('../../shared/constants/roles.constant');
const { VEHICLE_TYPES } = require('../../shared/constants/vehicle.constant');

const DEFAULT_QUOTE_TTL_MINUTES = 15;

const toId = (value) => value?._id?.toString?.() || value?.toString?.() || null;

const toVehicleSnapshot = (vehicle = {}) => ({
    vehicle_type: vehicle.vehicle_type,
    engine_type: vehicle.engine_type || null,
    motorbike_cc_group: vehicle.motorbike_cc_group || null,
    car_body_type: vehicle.car_body_type || null,
    seat_count: vehicle.seat_count || null,
});

const assertVehiclePricingClassification = (vehicle = {}) => {
    const missingFields = [];
    if (!vehicle.vehicle_type) missingFields.push('vehicle_type');
    if (!vehicle.engine_type) missingFields.push('engine_type');
    if (vehicle.vehicle_type === VEHICLE_TYPES.CAR) {
        if (!vehicle.car_body_type) missingFields.push('car_body_type');
        if (
            !Number.isInteger(vehicle.seat_count)
            || vehicle.seat_count < 2
            || vehicle.seat_count > 16
        ) {
            missingFields.push('seat_count');
        }
    }
    if (
        vehicle.vehicle_type === VEHICLE_TYPES.MOTORBIKE
        && !vehicle.motorbike_cc_group
    ) {
        missingFields.push('motorbike_cc_group');
    }
    if (missingFields.length > 0) {
        throw new AppError(
            'Vehicle classification is incomplete for pricing',
            400,
            'VEHICLE_CLASSIFICATION_REQUIRED',
            { missing_fields: missingFields }
        );
    }
};

const toRuleDto = (rule) => {
    const plain = rule?.toObject ? rule.toObject() : rule;
    return {
        id: toId(plain._id),
        rule_code: plain.rule_code || null,
        service_package_id: toId(plain.service_package_id),
        garage_id: toId(plain.garage_id),
        vehicle_type: plain.vehicle_type,
        engine_type: plain.engine_type || null,
        motorbike_cc_group: plain.motorbike_cc_group || null,
        car_body_type: plain.car_body_type || null,
        seat_min: plain.seat_min ?? null,
        seat_max: plain.seat_max ?? null,
        price: plain.price,
        duration_minutes: plain.duration_minutes ?? null,
        wash_bay_duration_minutes: plain.wash_bay_duration_minutes ?? null,
        care_staff_duration_minutes: plain.care_staff_duration_minutes ?? null,
        effective_from: plain.effective_from,
        effective_to: plain.effective_to || null,
        version: plain.version || 1,
        is_active: plain.is_active,
        note: plain.note || null,
        created_by: toId(plain.created_by),
        updated_by: toId(plain.updated_by),
        created_at: plain.created_at,
        updated_at: plain.updated_at,
    };
};

const normalizeRulePayload = (payload = {}) => ({
    service_package_id: payload.service_package_id,
    garage_id: payload.garage_id || null,
    vehicle_type: payload.vehicle_type,
    engine_type: payload.engine_type || null,
    motorbike_cc_group: payload.motorbike_cc_group || null,
    car_body_type: payload.car_body_type || null,
    seat_min: payload.seat_min ?? null,
    seat_max: payload.seat_max ?? null,
    price: payload.price,
    duration_minutes: payload.duration_minutes ?? null,
    wash_bay_duration_minutes: payload.wash_bay_duration_minutes ?? null,
    care_staff_duration_minutes: payload.care_staff_duration_minutes ?? null,
    effective_from: payload.effective_from || new Date(),
    effective_to: payload.effective_to || null,
    is_active: payload.is_active !== false,
    note: payload.note?.trim() || null,
});

const getSpecificity = (rule) => [
    rule.engine_type,
    rule.motorbike_cc_group,
    rule.car_body_type,
    rule.seat_min !== null && rule.seat_min !== undefined ? 'SEAT_RANGE' : null,
].filter(Boolean).length;

const optionalDimensionMatches = (ruleValue, actualValue) => !ruleValue || ruleValue === actualValue;

const ruleMatchesVehicle = (rule, vehicle) => {
    if (rule.vehicle_type !== vehicle.vehicle_type) {
        return false;
    }
    if (!optionalDimensionMatches(rule.engine_type, vehicle.engine_type)) {
        return false;
    }
    if (!optionalDimensionMatches(rule.motorbike_cc_group, vehicle.motorbike_cc_group)) {
        return false;
    }
    if (!optionalDimensionMatches(rule.car_body_type, vehicle.car_body_type)) {
        return false;
    }
    if (rule.seat_min !== null && rule.seat_min !== undefined) {
        if (!vehicle.seat_count) {
            return false;
        }
        if (vehicle.seat_count < rule.seat_min || vehicle.seat_count > rule.seat_max) {
            return false;
        }
    }
    return true;
};

const dimensionsOverlap = (left, right) => {
    const engineOverlaps = !left.engine_type || !right.engine_type || left.engine_type === right.engine_type;
    const ccOverlaps = !left.motorbike_cc_group
        || !right.motorbike_cc_group
        || left.motorbike_cc_group === right.motorbike_cc_group;
    const bodyOverlaps = !left.car_body_type
        || !right.car_body_type
        || left.car_body_type === right.car_body_type;
    const leftHasSeats = left.seat_min !== null && left.seat_min !== undefined;
    const rightHasSeats = right.seat_min !== null && right.seat_min !== undefined;
    const seatOverlaps = !leftHasSeats
        || !rightHasSeats
        || left.seat_min <= right.seat_max && right.seat_min <= left.seat_max;
    return engineOverlaps && ccOverlaps && bodyOverlaps && seatOverlaps;
};

const effectivePeriodsOverlap = (left, right) => {
    const leftEnd = left.effective_to ? new Date(left.effective_to) : new Date('9999-12-31T23:59:59.999Z');
    const rightEnd = right.effective_to ? new Date(right.effective_to) : new Date('9999-12-31T23:59:59.999Z');
    return new Date(left.effective_from) < rightEnd && new Date(right.effective_from) < leftEnd;
};

const assertRuleReferencesValid = async (payload) => {
    const [servicePackage, garage] = await Promise.all([
        ServicePackage.findById(payload.service_package_id),
        payload.garage_id ? Garage.findById(payload.garage_id) : Promise.resolve(null),
    ]);
    if (!servicePackage) {
        throw new AppError('Service package not found', 404, 'SERVICE_PACKAGE_NOT_FOUND');
    }
    if (servicePackage.vehicle_type !== payload.vehicle_type) {
        throw new AppError(
            'Price rule vehicle type must match service package vehicle type',
            400,
            'PRICE_RULE_VEHICLE_TYPE_MISMATCH'
        );
    }
    if (payload.garage_id && !garage) {
        throw new AppError('Garage not found', 404, 'GARAGE_NOT_FOUND');
    }
    return { servicePackage, garage };
};

const assertNoAmbiguousOverlap = async (payload, ignoredRuleId = null) => {
    const candidates = await ServicePriceRule.find({
        service_package_id: payload.service_package_id,
        garage_id: payload.garage_id || null,
        vehicle_type: payload.vehicle_type,
        is_active: true,
        ...(ignoredRuleId ? { _id: { $ne: ignoredRuleId } } : {}),
    }).lean();
    const specificity = getSpecificity(payload);
    const conflict = candidates.find((candidate) => (
        getSpecificity(candidate) === specificity
        && dimensionsOverlap(candidate, payload)
        && effectivePeriodsOverlap(candidate, payload)
    ));
    if (conflict) {
        throw new AppError(
            'Price rule overlaps another rule with the same specificity',
            409,
            'PRICE_RULE_OVERLAP',
            {
                conflicting_rule_id: conflict._id.toString(),
            }
        );
    }
};

const listRules = async ({
    service_package_id,
    garage_id,
    vehicle_type,
    is_active,
    page = 1,
    limit = 100,
} = {}) => {
    const filter = {};
    if (service_package_id) filter.service_package_id = service_package_id;
    if (garage_id) filter.garage_id = garage_id;
    if (vehicle_type) filter.vehicle_type = vehicle_type;
    if (is_active !== undefined) filter.is_active = is_active;
    const skip = (page - 1) * limit;
    const [rules, total] = await Promise.all([
        ServicePriceRule.find(filter)
            .sort({ garage_id: 1, vehicle_type: 1, price: 1, effective_from: -1 })
            .skip(skip)
            .limit(limit),
        ServicePriceRule.countDocuments(filter),
    ]);
    return {
        data: rules.map(toRuleDto),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

const createRule = async (actor, payload, auditContext = {}) => {
    const normalized = normalizeRulePayload(payload);
    await assertRuleReferencesValid(normalized);
    const candidate = new ServicePriceRule({
        ...normalized,
        created_by: actor._id,
        updated_by: actor._id,
    });
    await candidate.validate();
    await assertNoAmbiguousOverlap(candidate.toObject());
    await candidate.save();
    await auditLogService.recordAuditEvent({
        actorId: actor._id,
        action: 'SERVICE_PRICE_RULE_CREATED',
        resourceType: 'SERVICE_PRICE_RULE',
        resourceId: candidate._id,
        after: candidate,
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
    });
    return toRuleDto(candidate);
};

const updateRule = async (actor, ruleId, payload, auditContext = {}) => {
    const rule = await ServicePriceRule.findById(ruleId);
    if (!rule) {
        throw new AppError('Price rule not found', 404, 'PRICE_RULE_NOT_FOUND');
    }
    const before = rule.toObject();
    const merged = normalizeRulePayload({
        ...before,
        ...payload,
        effective_from: payload.effective_from ?? before.effective_from,
        effective_to: payload.effective_to !== undefined ? payload.effective_to : before.effective_to,
        is_active: payload.is_active !== undefined ? payload.is_active : before.is_active,
    });
    await assertRuleReferencesValid(merged);
    Object.assign(rule, merged, {
        version: rule.version + 1,
        updated_by: actor._id,
    });
    await rule.validate();
    if (rule.is_active) {
        await assertNoAmbiguousOverlap(rule.toObject(), rule._id);
    }
    await rule.save();
    await auditLogService.recordAuditEvent({
        actorId: actor._id,
        action: 'SERVICE_PRICE_RULE_UPDATED',
        resourceType: 'SERVICE_PRICE_RULE',
        resourceId: rule._id,
        before,
        after: rule,
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
    });
    return toRuleDto(rule);
};

const deactivateRule = async (actor, ruleId, auditContext = {}) => {
    return updateRule(actor, ruleId, { is_active: false }, auditContext);
};

const resolveRule = async ({
    servicePackage,
    garageId,
    vehicleSnapshot,
    effectiveAt = new Date(),
    session = null,
}) => {
    assertVehiclePricingClassification(vehicleSnapshot);
    const query = ServicePriceRule.find({
        service_package_id: servicePackage._id,
        vehicle_type: vehicleSnapshot.vehicle_type,
        is_active: true,
        effective_from: { $lte: effectiveAt },
        $or: [
            { effective_to: null },
            { effective_to: { $gt: effectiveAt } },
        ],
        garage_id: { $in: [garageId || null, null] },
    });
    if (session) query.session(session);
    const rules = await query.lean();
    const matches = rules.filter((rule) => ruleMatchesVehicle(rule, vehicleSnapshot));
    const garageMatches = garageId
        ? matches.filter((rule) => toId(rule.garage_id) === toId(garageId))
        : [];
    const scopedMatches = garageMatches.length > 0
        ? garageMatches
        : matches.filter((rule) => !rule.garage_id);
    if (scopedMatches.length === 0) {
        const anyRuleQuery = ServicePriceRule.exists({
            service_package_id: servicePackage._id,
            is_active: true,
        });
        if (session) anyRuleQuery.session(session);
        const hasConfiguredRules = await anyRuleQuery;
        if (!hasConfiguredRules) {
            return {
                rule: null,
                legacy: true,
                price: servicePackage.base_price,
                duration_minutes: servicePackage.duration_minutes,
                wash_bay_duration_minutes: servicePackage.wash_bay_duration_minutes,
                care_staff_duration_minutes: servicePackage.care_staff_duration_minutes,
            };
        }
        throw new AppError(
            'No price rule matches this vehicle classification',
            409,
            'PRICE_RULE_NOT_FOUND',
            {
                service_package_id: toId(servicePackage._id),
                vehicle_snapshot: vehicleSnapshot,
            }
        );
    }
    const highestSpecificity = Math.max(...scopedMatches.map(getSpecificity));
    const winners = scopedMatches.filter((rule) => getSpecificity(rule) === highestSpecificity);
    if (winners.length !== 1) {
        throw new AppError(
            'Multiple price rules match this vehicle classification',
            409,
            'PRICE_RULE_AMBIGUOUS',
            {
                service_package_id: toId(servicePackage._id),
                matching_rule_ids: winners.map((rule) => toId(rule._id)),
            }
        );
    }
    const rule = winners[0];
    return {
        rule,
        legacy: false,
        price: rule.price,
        duration_minutes: rule.duration_minutes ?? servicePackage.duration_minutes,
        wash_bay_duration_minutes: rule.wash_bay_duration_minutes ?? servicePackage.wash_bay_duration_minutes,
        care_staff_duration_minutes: rule.care_staff_duration_minutes ?? servicePackage.care_staff_duration_minutes,
    };
};

const applyResolvedRule = async ({
    servicePackage,
    garageId,
    vehicleSnapshot,
    effectiveAt = new Date(),
    session = null,
}) => {
    const resolution = await resolveRule({
        servicePackage,
        garageId,
        vehicleSnapshot,
        effectiveAt,
        session,
    });
    const plain = servicePackage.toObject ? servicePackage.toObject() : { ...servicePackage };
    return {
        ...plain,
        base_price: resolution.price,
        duration_minutes: resolution.duration_minutes,
        countdown_duration_seconds: Math.min(
            plain.countdown_duration_seconds || resolution.duration_minutes * 60,
            resolution.duration_minutes * 60
        ),
        wash_bay_duration_minutes: resolution.wash_bay_duration_minutes,
        care_staff_duration_minutes: resolution.care_staff_duration_minutes,
        pricing_rule: resolution.rule ? {
            id: toId(resolution.rule._id),
            version: resolution.rule.version || 1,
            garage_id: toId(resolution.rule.garage_id),
        } : null,
        pricing_source: resolution.legacy ? 'LEGACY_BASE_PRICE' : 'SERVICE_PRICE_RULE',
    };
};

const loadQuoteInputs = async ({
    customerId = null,
    staffUser = null,
    garageId,
    vehicleId = null,
    vehicleSnapshot = null,
    servicePackageId,
    addOnServiceIds = [],
    effectiveAt = new Date(),
}) => {
    const [garage, servicePackage, addOns, vehicle] = await Promise.all([
        Garage.findOne({ _id: garageId, is_active: true }),
        ServicePackage.findOne({ _id: servicePackageId, is_active: true }),
        ServicePackage.find({
            _id: { $in: addOnServiceIds },
            is_active: true,
        }),
        vehicleId
            ? Vehicle.findOne({
                _id: vehicleId,
                ...(customerId ? { customer_id: customerId } : {}),
                is_active: true,
            })
            : Promise.resolve(null),
    ]);
    if (!garage) throw new AppError('Garage not found or inactive', 404, 'GARAGE_NOT_FOUND');
    if (!servicePackage) throw new AppError('Service package not found or inactive', 404, 'SERVICE_PACKAGE_NOT_FOUND');
    const uniqueAddOnIds = new Set(addOnServiceIds.map(toId));
    if (
        uniqueAddOnIds.size !== addOnServiceIds.length
        || addOns.length !== uniqueAddOnIds.size
    ) {
        throw new AppError('One or more add-on services are invalid', 400, 'INVALID_ADD_ON_SERVICE');
    }
    if (vehicleId && !vehicle) throw new AppError('Vehicle not found', 404, 'VEHICLE_NOT_FOUND');
    if (staffUser?.role === USER_ROLES.STAFF) {
        const profile = await StaffProfile.findOne({ user_id: staffUser._id, is_active: true });
        if (!profile || toId(profile.garage_id) !== toId(garageId)) {
            throw new AppError('Staff cannot quote another garage', 403, 'STAFF_GARAGE_ACCESS_DENIED');
        }
    }
    const snapshot = vehicle ? toVehicleSnapshot(vehicle) : toVehicleSnapshot(vehicleSnapshot);
    assertVehiclePricingClassification(snapshot);
    const allServices = [servicePackage, ...addOns];
    const mismatch = allServices.find((item) => item.vehicle_type !== snapshot.vehicle_type);
    if (mismatch) {
        throw new AppError(
            'Selected service does not match vehicle type',
            400,
            'SERVICE_PACKAGE_VEHICLE_TYPE_MISMATCH'
        );
    }
    return { garage, servicePackage, addOns, vehicle, snapshot };
};

const createQuote = async ({
    customerId = null,
    staffUser = null,
    garageId,
    vehicleId = null,
    vehicleSnapshot = null,
    servicePackageId,
    addOnServiceIds = [],
    effectiveAt = new Date(),
}) => {
    const { garage, servicePackage, addOns, vehicle, snapshot } = await loadQuoteInputs({
        customerId,
        staffUser,
        garageId,
        vehicleId,
        vehicleSnapshot,
        servicePackageId,
        addOnServiceIds,
    });
    const services = [
        { item: servicePackage, source: 'PRIMARY' },
        ...addOns.map((item) => ({ item, source: 'ADD_ON' })),
    ];
    const resolved = await Promise.all(services.map(async ({ item, source }) => ({
        item: await applyResolvedRule({
            servicePackage: item,
            garageId: garage._id,
            vehicleSnapshot: snapshot,
            effectiveAt,
        }),
        source,
    })));
    const quoteItems = resolved.map(({ item, source }) => ({
        service_package_id: item._id,
        service_price_rule_id: item.pricing_rule?.id || null,
        rule_version: item.pricing_rule?.version || null,
        source,
        name_snapshot: item.name,
        price_snapshot: item.base_price,
        duration_minutes: item.duration_minutes,
    }));
    const quote = await PriceQuote.create({
        customer_id: customerId,
        created_by_staff_id: staffUser?._id || null,
        garage_id: garage._id,
        vehicle_id: vehicle?._id || null,
        vehicle_snapshot: snapshot,
        service_package_id: servicePackage._id,
        add_on_service_ids: addOns.map((item) => item._id),
        items: quoteItems,
        subtotal: quoteItems.reduce((sum, item) => sum + item.price_snapshot, 0),
        total_duration_minutes: quoteItems.reduce((sum, item) => sum + item.duration_minutes, 0),
        effective_at: effectiveAt,
        expires_at: new Date(Date.now() + DEFAULT_QUOTE_TTL_MINUTES * 60 * 1000),
    });
    return {
        id: quote._id.toString(),
        garage_id: garage._id.toString(),
        vehicle_id: vehicle?._id?.toString() || null,
        vehicle_snapshot: snapshot,
        service_package_id: servicePackage._id.toString(),
        add_on_service_ids: addOns.map((item) => item._id.toString()),
        items: quoteItems.map((item) => ({
            ...item,
            service_package_id: item.service_package_id.toString(),
            service_price_rule_id: item.service_price_rule_id?.toString() || null,
        })),
        subtotal: quote.subtotal,
        total_duration_minutes: quote.total_duration_minutes,
        effective_at: quote.effective_at,
        expires_at: quote.expires_at,
    };
};

const getActiveQuote = async ({ quoteId, customerId = null, staffUserId = null, session = null }) => {
    const query = PriceQuote.findOne({
        _id: quoteId,
        status: 'ACTIVE',
        expires_at: { $gt: new Date() },
        ...(customerId ? { customer_id: customerId } : {}),
        ...(staffUserId ? { created_by_staff_id: staffUserId } : {}),
    });
    if (session) query.session(session);
    const quote = await query;
    if (!quote) {
        throw new AppError('Price quote is invalid or expired', 409, 'PRICE_QUOTE_EXPIRED');
    }
    return quote;
};

const consumeQuote = async ({ quoteId, bookingId, session = null }) => {
    const update = {
        status: 'CONSUMED',
        consumed_at: new Date(),
        booking_id: bookingId,
    };
    const query = PriceQuote.findOneAndUpdate(
        { _id: quoteId, status: 'ACTIVE', expires_at: { $gt: new Date() } },
        { $set: update },
        { new: true }
    );
    if (session) query.session(session);
    const quote = await query;
    if (!quote) {
        throw new AppError('Price quote is invalid or expired', 409, 'PRICE_QUOTE_EXPIRED');
    }
    return quote;
};

const assertQuoteMatchesPlan = ({ quote, garageId, vehicleId, vehicleSnapshot, servicePackage, addOnServices, bookingPlan }) => {
    const expectedAddOns = [...(quote.add_on_service_ids || [])].map(toId).sort();
    const actualAddOns = addOnServices.map((item) => toId(item._id)).sort();
    const sameAddOns = expectedAddOns.length === actualAddOns.length
        && expectedAddOns.every((item, index) => item === actualAddOns[index]);
    const sameVehicle = vehicleId
        ? toId(quote.vehicle_id) === toId(vehicleId)
        : JSON.stringify(toVehicleSnapshot(quote.vehicle_snapshot)) === JSON.stringify(toVehicleSnapshot(vehicleSnapshot));
    const currentRuleSignatures = [
        {
            service_package_id: servicePackage._id,
            service_price_rule_id: servicePackage.pricing_rule?.id || null,
            price_rule_version: servicePackage.pricing_rule?.version || null,
            price_snapshot: servicePackage.base_price,
        },
        ...bookingPlan.bookingItems.filter((item) => item.source === 'ADD_ON'),
    ]
        .map((item) => `${toId(item.service_package_id)}:${toId(item.service_price_rule_id)}:${item.price_rule_version || ''}:${item.price_snapshot}`)
        .sort();
    const quotedRuleSignatures = quote.items
        .map((item) => `${toId(item.service_package_id)}:${toId(item.service_price_rule_id)}:${item.rule_version || ''}:${item.price_snapshot}`)
        .sort();
    const sameRules = currentRuleSignatures.length === quotedRuleSignatures.length
        && currentRuleSignatures.every((item, index) => item === quotedRuleSignatures[index]);
    if (
        toId(quote.garage_id) !== toId(garageId)
        || !sameVehicle
        || toId(quote.service_package_id) !== toId(servicePackage._id)
        || !sameAddOns
        || quote.subtotal !== bookingPlan.originalPrice
        || !sameRules
    ) {
        throw new AppError(
            'Price or vehicle classification changed after quote creation',
            409,
            'PRICE_QUOTE_CHANGED'
        );
    }
};

module.exports = {
    toVehicleSnapshot,
    toRuleDto,
    listRules,
    createRule,
    updateRule,
    deactivateRule,
    resolveRule,
    applyResolvedRule,
    createQuote,
    getActiveQuote,
    consumeQuote,
    assertQuoteMatchesPlan,
};
