const mongoose = require('mongoose');

const Promotion = require('./promotion.model');
const PromotionMapper = require('./promotion.mapper');
const ServicePackage = require('../service-packages/servicePackage.model');
const PromotionUsage = require('../promotion-usages/promotionUsage.model');
const loyaltyService = require('../loyalty/loyalty.service');
const { AppError } = require('../../shared/utils/appError');
const {
    PROMOTION_DISCOUNT_TYPES,
    PROMOTION_AUDIENCES,
    PROMOTION_USAGE_STATUS,
} = require('../../shared/constants/promotion.constant');

const normalizeText = (value) => {
    if (typeof value !== 'string') {
        return value;
    }

    const trimmedValue = value.trim();

    return trimmedValue || null;
};

const normalizeRequiredText = (value) => {
    if (typeof value !== 'string') {
        return value;
    }

    return value.trim();
};

const normalizeCode = (value) => {
    if (typeof value !== 'string') {
        return value;
    }

    return value.trim().toUpperCase();
};

const escapeRegExp = (value) => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const normalizeObjectIdList = (values = []) => {
    const ids = values.map((value) => {
        if (value && value._id) {
            return value._id.toString();
        }

        return value.toString();
    });

    return [...new Set(ids)].map((value) => new mongoose.Types.ObjectId(value));
};

const normalizeStringList = (values = []) => {
    return [...new Set(values.filter(Boolean))];
};

const normalizeBasePayload = (payload = {}) => {
    const normalizedPayload = {};

    if (payload.code !== undefined) {
        normalizedPayload.code = normalizeCode(payload.code);
    }

    if (payload.name !== undefined) {
        normalizedPayload.name = normalizeRequiredText(payload.name);
    }

    if (payload.description !== undefined) {
        normalizedPayload.description = normalizeText(payload.description);
    }

    if (payload.discount_type !== undefined) {
        normalizedPayload.discount_type = payload.discount_type;
    }

    if (payload.discount_value !== undefined) {
        normalizedPayload.discount_value = payload.discount_value;
    }

    if (payload.max_discount_amount !== undefined) {
        normalizedPayload.max_discount_amount = payload.max_discount_amount;
    }

    if (payload.min_order_amount !== undefined) {
        normalizedPayload.min_order_amount = payload.min_order_amount;
    }

    if (payload.audience !== undefined) {
        normalizedPayload.audience = payload.audience;
    }

    if (payload.phone_required !== undefined) {
        normalizedPayload.phone_required = payload.phone_required;
    }

    if (payload.per_phone_limit !== undefined) {
        normalizedPayload.per_phone_limit = payload.per_phone_limit;
    }

    if (payload.applicable_tiers !== undefined) {
        normalizedPayload.applicable_tiers = normalizeStringList(payload.applicable_tiers);
    }

    if (payload.applicable_vehicle_types !== undefined) {
        normalizedPayload.applicable_vehicle_types = normalizeStringList(payload.applicable_vehicle_types);
    }

    if (payload.applicable_service_package_ids !== undefined) {
        normalizedPayload.applicable_service_package_ids = normalizeObjectIdList(payload.applicable_service_package_ids);
    }

    if (payload.start_at !== undefined) {
        normalizedPayload.start_at = new Date(payload.start_at);
    }

    if (payload.end_at !== undefined) {
        normalizedPayload.end_at = new Date(payload.end_at);
    }

    if (payload.usage_limit !== undefined) {
        normalizedPayload.usage_limit = payload.usage_limit;
    }

    if (payload.per_customer_limit !== undefined) {
        normalizedPayload.per_customer_limit = payload.per_customer_limit;
    }

    if (payload.is_active !== undefined) {
        normalizedPayload.is_active = payload.is_active;
    }

    return normalizedPayload;
};

const buildSearchFilter = ({ search, vehicle_type, tier, audience, is_active, valid_only, service_package_id } = {}) => {
    const filter = {};

    if (search) {
        const keyword = escapeRegExp(search.trim());
        const normalizedKeyword = normalizeCode(search);

        filter.$or = [
            { code: { $regex: normalizedKeyword, $options: 'i' } },
            { name: { $regex: keyword, $options: 'i' } },
            { description: { $regex: keyword, $options: 'i' } },
        ];
    }

    if (vehicle_type) {
        filter.$and = filter.$and || [];
        filter.$and.push({
            $or: [
                { applicable_vehicle_types: { $size: 0 } },
                { applicable_vehicle_types: vehicle_type },
            ],
        });
    }

    if (tier) {
        filter.$and = filter.$and || [];
        filter.$and.push({
            $or: [
                { applicable_tiers: { $size: 0 } },
                { applicable_tiers: tier },
            ],
        });
    }

    if (audience) {
        filter.audience = audience;
    }

    if (service_package_id) {
        filter.$and = filter.$and || [];
        filter.$and.push({
            $or: [
                { applicable_service_package_ids: { $size: 0 } },
                { applicable_service_package_ids: service_package_id },
            ],
        });
    }

    if (is_active !== undefined) {
        filter.is_active = is_active;
    }

    if (valid_only) {
        const now = new Date();

        filter.is_active = true;
        filter.start_at = { $lte: now };
        filter.end_at = { $gte: now };
    }

    return filter;
};

const populatePromotionQuery = (query) => {
    return query
        .populate('applicable_service_package_ids', 'name vehicle_type service_type base_price is_active')
        .populate('created_by_id', 'full_name email phone role is_active')
        .populate('updated_by_id', 'full_name email phone role is_active');
};

const assertUpdatePayloadNotEmpty = (payload) => {
    if (!payload || Object.keys(payload).length === 0) {
        throw new AppError('No valid fields to update', 400, 'NO_VALID_FIELDS_TO_UPDATE');
    }
};

const assertPromotionDateRangeValid = (payload, currentPromotion = null) => {
    const startAt = payload.start_at !== undefined ? payload.start_at : currentPromotion?.start_at;
    const endAt = payload.end_at !== undefined ? payload.end_at : currentPromotion?.end_at;

    if (startAt && endAt && startAt >= endAt) {
        throw new AppError('Promotion end time must be after start time', 400, 'PROMOTION_DATE_RANGE_INVALID');
    }
};

const assertDiscountRuleValid = (payload, currentPromotion = null) => {
    const discountType = payload.discount_type !== undefined ? payload.discount_type : currentPromotion?.discount_type;
    const discountValue = payload.discount_value !== undefined ? payload.discount_value : currentPromotion?.discount_value;

    if (discountType === PROMOTION_DISCOUNT_TYPES.PERCENTAGE && discountValue > 100) {
        throw new AppError('Percentage discount must not exceed 100', 400, 'PROMOTION_PERCENTAGE_INVALID');
    }
};

const assertAudienceRuleValid = (payload, currentPromotion = null) => {
    const audience = payload.audience !== undefined
        ? payload.audience
        : currentPromotion?.audience || PROMOTION_AUDIENCES.ALL;
    const applicableTiers = payload.applicable_tiers !== undefined
        ? payload.applicable_tiers
        : currentPromotion?.applicable_tiers || [];
    const perCustomerLimit = payload.per_customer_limit !== undefined
        ? payload.per_customer_limit
        : currentPromotion?.per_customer_limit;
    const phoneRequired = payload.phone_required !== undefined
        ? payload.phone_required
        : currentPromotion?.phone_required;
    const perPhoneLimit = payload.per_phone_limit !== undefined
        ? payload.per_phone_limit
        : currentPromotion?.per_phone_limit;

    if (
        audience === PROMOTION_AUDIENCES.WALK_IN
        && (applicableTiers.length || perCustomerLimit)
    ) {
        throw new AppError('Walk-in promotion cannot require customer tier or customer usage limit', 400, 'PROMOTION_AUDIENCE_RULE_INVALID');
    }

    if (
        audience === PROMOTION_AUDIENCES.CUSTOMER
        && (phoneRequired || perPhoneLimit)
    ) {
        throw new AppError('Customer promotion cannot require walk-in phone rules', 400, 'PROMOTION_AUDIENCE_RULE_INVALID');
    }
};

const assertCodeAvailable = async (code, ignoredPromotionId = null) => {
    if (!code) {
        return;
    }

    const filter = { code: normalizeCode(code) };

    if (ignoredPromotionId) {
        filter._id = { $ne: ignoredPromotionId };
    }

    const existed = await Promotion.exists(filter);

    if (existed) {
        throw new AppError('Promotion code already exists', 409, 'PROMOTION_CODE_ALREADY_EXISTS');
    }
};

const assertServicePackagesValid = async (servicePackageIds = []) => {
    const normalizedIds = normalizeObjectIdList(servicePackageIds);

    if (!normalizedIds.length) {
        return;
    }

    const count = await ServicePackage.countDocuments({
        _id: { $in: normalizedIds },
        is_active: true,
    });

    if (count !== normalizedIds.length) {
        throw new AppError('One or more service packages are invalid or inactive', 400, 'INVALID_PROMOTION_SERVICE_PACKAGES');
    }
};

const getPromotionDocumentById = async (promotionId) => {
    const promotion = await populatePromotionQuery(Promotion.findById(promotionId));

    if (!promotion) {
        throw new AppError('Promotion not found', 404, 'PROMOTION_NOT_FOUND');
    }

    return promotion;
};

const getPromotionDocumentByCode = async (code) => {
    const promotion = await Promotion.findOne({ code: normalizeCode(code) });

    if (!promotion) {
        throw new AppError('Promotion not found', 404, 'PROMOTION_NOT_FOUND');
    }

    return promotion;
};

const getServicePackageById = async (servicePackageId) => {
    const servicePackage = await ServicePackage.findById(servicePackageId);

    if (!servicePackage) {
        throw new AppError('Service package not found', 404, 'SERVICE_PACKAGE_NOT_FOUND');
    }

    if (!servicePackage.is_active) {
        throw new AppError('Service package is inactive', 400, 'SERVICE_PACKAGE_INACTIVE');
    }

    return servicePackage;
};

const calculateDiscountAmount = (promotion, orderAmount) => {
    let discountAmount = 0;

    if (promotion.discount_type === PROMOTION_DISCOUNT_TYPES.PERCENTAGE) {
        discountAmount = Math.floor(orderAmount * promotion.discount_value / 100);

        if (promotion.max_discount_amount !== null && promotion.max_discount_amount !== undefined) {
            discountAmount = Math.min(discountAmount, promotion.max_discount_amount);
        }
    }

    if (promotion.discount_type === PROMOTION_DISCOUNT_TYPES.FIXED_AMOUNT) {
        discountAmount = promotion.discount_value;
    }

    return Math.min(Math.max(discountAmount, 0), orderAmount);
};

const getCustomerTier = async (customerId) => {
    if (!customerId) {
        return null;
    }

    const loyalty = await loyaltyService.getOrCreateCustomerLoyalty(customerId);

    return loyalty.current_tier;
};

const assertPromotionApplicable = async ({
    promotion,
    customerId,
    customerTier,
    guestPhoneNormalized,
    servicePackage,
    vehicleType,
    orderAmount,
    session = null,
}) => {
    const effectiveTime = new Date();
    const audience = promotion.audience || PROMOTION_AUDIENCES.ALL;
    const isWalkIn = !customerId;

    if (!promotion.is_active) {
        throw new AppError('Promotion is inactive', 400, 'PROMOTION_INACTIVE');
    }

    if (effectiveTime < promotion.start_at || effectiveTime > promotion.end_at) {
        throw new AppError('Promotion is not valid at this time', 400, 'PROMOTION_NOT_IN_VALID_PERIOD');
    }

    if (orderAmount < promotion.min_order_amount) {
        throw new AppError('Order amount does not meet promotion minimum amount', 400, 'PROMOTION_MIN_ORDER_NOT_MET');
    }

    if (
        (isWalkIn && audience === PROMOTION_AUDIENCES.CUSTOMER)
        || (!isWalkIn && audience === PROMOTION_AUDIENCES.WALK_IN)
    ) {
        throw new AppError('Promotion is not available for this booking audience', 400, 'PROMOTION_AUDIENCE_NOT_ELIGIBLE');
    }

    if (isWalkIn && (promotion.phone_required || promotion.per_phone_limit) && !guestPhoneNormalized) {
        throw new AppError('Guest phone is required for this promotion', 400, 'PROMOTION_PHONE_REQUIRED');
    }

    if (promotion.applicable_tiers?.length) {
        if (!customerId || !customerTier) {
            throw new AppError('Customer account is required for this promotion', 400, 'PROMOTION_CUSTOMER_REQUIRED');
        }

        if (!promotion.applicable_tiers.includes(customerTier)) {
            throw new AppError('Promotion is not available for customer tier', 400, 'PROMOTION_TIER_NOT_ELIGIBLE');
        }
    }

    if (promotion.applicable_vehicle_types?.length && !promotion.applicable_vehicle_types.includes(vehicleType)) {
        throw new AppError('Promotion is not available for this vehicle type', 400, 'PROMOTION_VEHICLE_TYPE_NOT_ELIGIBLE');
    }

    if (promotion.applicable_service_package_ids?.length) {
        const servicePackageId = servicePackage._id.toString();
        const isApplicableService = promotion.applicable_service_package_ids.some((item) => item.toString() === servicePackageId);

        if (!isApplicableService) {
            throw new AppError('Promotion is not available for this service package', 400, 'PROMOTION_SERVICE_PACKAGE_NOT_ELIGIBLE');
        }
    }

    if (promotion.usage_limit) {
        const usageQuery = PromotionUsage.countDocuments({
            promotion_id: promotion._id,
            status: { $ne: PROMOTION_USAGE_STATUS.RELEASED },
        });

        if (session && usageQuery.session) {
            usageQuery.session(session);
        }

        const totalUsageCount = await usageQuery;
        const effectiveUsageCount = Math.max(
            totalUsageCount,
            (promotion.used_count || 0) + (promotion.reserved_count || 0)
        );

        if (effectiveUsageCount >= promotion.usage_limit) {
            throw new AppError('Promotion usage limit has been reached', 409, 'PROMOTION_USAGE_LIMIT_REACHED');
        }
    }

    if (promotion.per_customer_limit) {
        if (!customerId) {
            throw new AppError('Customer account is required for this promotion', 400, 'PROMOTION_CUSTOMER_REQUIRED');
        }

        const customerUsageQuery = PromotionUsage.countDocuments({
            promotion_id: promotion._id,
            customer_id: customerId,
            status: { $ne: PROMOTION_USAGE_STATUS.RELEASED },
        });

        if (session && customerUsageQuery.session) {
            customerUsageQuery.session(session);
        }

        const customerUsageCount = await customerUsageQuery;

        if (customerUsageCount >= promotion.per_customer_limit) {
            throw new AppError('Customer promotion usage limit has been reached', 409, 'PROMOTION_CUSTOMER_USAGE_LIMIT_REACHED');
        }
    }

    if (isWalkIn && promotion.per_phone_limit && guestPhoneNormalized) {
        const phoneUsageQuery = PromotionUsage.countDocuments({
            promotion_id: promotion._id,
            guest_phone_normalized: guestPhoneNormalized,
            status: { $ne: PROMOTION_USAGE_STATUS.RELEASED },
        });

        if (session && phoneUsageQuery.session) {
            phoneUsageQuery.session(session);
        }

        const phoneUsageCount = await phoneUsageQuery;

        if (phoneUsageCount >= promotion.per_phone_limit) {
            throw new AppError('Phone promotion usage limit has been reached', 409, 'PROMOTION_PHONE_USAGE_LIMIT_REACHED');
        }
    }
};

const getPublicPromotions = async ({ page = 1, limit = 20, search, vehicle_type, audience, service_package_id } = {}) => {
    const filter = buildSearchFilter({
        search,
        vehicle_type,
        audience,
        service_package_id,
        valid_only: true,
    });
    const skip = (page - 1) * limit;

    const [promotions, total] = await Promise.all([
        populatePromotionQuery(Promotion.find(filter))
            .sort({ end_at: 1, created_at: -1 })
            .skip(skip)
            .limit(limit),
        Promotion.countDocuments(filter),
    ]);

    return {
        data: PromotionMapper.toPromotionDtoList(promotions),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

const getPublicPromotionById = async (promotionId) => {
    const now = new Date();
    const promotion = await populatePromotionQuery(Promotion.findOne({
        _id: promotionId,
        is_active: true,
        start_at: { $lte: now },
        end_at: { $gte: now },
    }));

    if (!promotion) {
        throw new AppError('Promotion not found', 404, 'PROMOTION_NOT_FOUND');
    }

    return PromotionMapper.toPromotionDto(promotion);
};

const getAllPromotions = async ({ page = 1, limit = 20, search, vehicle_type, tier, audience, is_active, valid_only } = {}) => {
    const filter = buildSearchFilter({
        search,
        vehicle_type,
        tier,
        audience,
        is_active,
        valid_only,
    });
    const skip = (page - 1) * limit;

    const [promotions, total] = await Promise.all([
        populatePromotionQuery(Promotion.find(filter))
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit),
        Promotion.countDocuments(filter),
    ]);

    return {
        data: PromotionMapper.toPromotionDtoList(promotions),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

const getPromotionById = async (promotionId) => {
    const promotion = await getPromotionDocumentById(promotionId);

    return PromotionMapper.toPromotionDto(promotion);
};

const createPromotion = async (actorId, payload = {}) => {
    const createPayload = normalizeBasePayload(PromotionMapper.toCreatePayload(payload));

    assertPromotionDateRangeValid(createPayload);
    assertDiscountRuleValid(createPayload);
    assertAudienceRuleValid(createPayload);
    await assertCodeAvailable(createPayload.code);
    await assertServicePackagesValid(createPayload.applicable_service_package_ids || []);

    const promotion = await Promotion.create({
        ...createPayload,
        created_by_id: actorId || null,
        updated_by_id: actorId || null,
    });
    const populatedPromotion = await getPromotionDocumentById(promotion._id);

    return PromotionMapper.toPromotionDto(populatedPromotion);
};

const updatePromotion = async (actorId, promotionId, payload = {}) => {
    const promotion = await getPromotionDocumentById(promotionId);
    const updatePayload = normalizeBasePayload(PromotionMapper.toUpdatePayload(payload));

    assertUpdatePayloadNotEmpty(updatePayload);
    assertPromotionDateRangeValid(updatePayload, promotion);
    assertDiscountRuleValid(updatePayload, promotion);
    assertAudienceRuleValid(updatePayload, promotion);

    if (updatePayload.code !== undefined) {
        await assertCodeAvailable(updatePayload.code, promotionId);
    }

    if (updatePayload.applicable_service_package_ids !== undefined) {
        await assertServicePackagesValid(updatePayload.applicable_service_package_ids);
    }

    const updatedPromotion = await Promotion.findByIdAndUpdate(
        promotionId,
        {
            $set: {
                ...updatePayload,
                updated_by_id: actorId || null,
            },
        },
        { new: true, runValidators: true }
    );

    const populatedPromotion = await getPromotionDocumentById(updatedPromotion._id);

    return PromotionMapper.toPromotionDto(populatedPromotion);
};

const updatePromotionStatus = async (actorId, promotionId, isActive) => {
    const promotion = await getPromotionDocumentById(promotionId);

    if (promotion.is_active === isActive) {
        throw new AppError('Promotion status is unchanged', 400, 'NO_CHANGE');
    }

    const updatedPromotion = await Promotion.findByIdAndUpdate(
        promotionId,
        {
            $set: {
                is_active: isActive,
                updated_by_id: actorId || null,
            },
        },
        { new: true, runValidators: true }
    );

    const populatedPromotion = await getPromotionDocumentById(updatedPromotion._id);

    return PromotionMapper.toPromotionDto(populatedPromotion);
};

const deletePromotion = async (promotionId) => {
    const promotion = await getPromotionDocumentById(promotionId);
    const usageCount = await PromotionUsage.countDocuments({ promotion_id: promotion._id });

    if (usageCount > 0) {
        throw new AppError('Promotion already has usage history and cannot be deleted', 409, 'PROMOTION_HAS_USAGE_HISTORY');
    }

    await Promotion.deleteOne({ _id: promotion._id });

    return PromotionMapper.toPromotionDto(promotion);
};

const validatePromotionForBooking = async ({
    promotion_code,
    customer_id,
    guest_phone_normalized,
    servicePackage,
    vehicleType,
    orderAmount,
    bookingStartTime,
    session = null,
} = {}) => {
    if (!promotion_code) {
        return {
            promotion: null,
            discount_amount: 0,
            final_price: orderAmount,
        };
    }

    const promotion = await getPromotionDocumentByCode(promotion_code);
    const customerTier = await getCustomerTier(customer_id);

    await assertPromotionApplicable({
        promotion,
        customerId: customer_id,
        customerTier,
        guestPhoneNormalized: guest_phone_normalized,
        servicePackage,
        vehicleType,
        orderAmount,
        session,
    });

    const discountAmount = calculateDiscountAmount(promotion, orderAmount);

    return {
        promotion,
        discount_amount: discountAmount,
        final_price: Math.max(orderAmount - discountAmount, 0),
    };
};

const validatePromotion = async (customerId, { promotion_code, service_package_id } = {}) => {
    const servicePackage = await getServicePackageById(service_package_id);
    const result = await validatePromotionForBooking({
        promotion_code,
        customer_id: customerId,
        servicePackage,
        vehicleType: servicePackage.vehicle_type,
        orderAmount: servicePackage.base_price,
        bookingStartTime: new Date(),
    });

    return PromotionMapper.toPromotionValidationDto({
        promotion: result.promotion,
        discount_amount: result.discount_amount,
        final_price: result.final_price,
    });
};

module.exports = {
    getPublicPromotions,
    getPublicPromotionById,
    getAllPromotions,
    getPromotionById,
    createPromotion,
    updatePromotion,
    updatePromotionStatus,
    deletePromotion,
    validatePromotion,
    validatePromotionForBooking,
};
