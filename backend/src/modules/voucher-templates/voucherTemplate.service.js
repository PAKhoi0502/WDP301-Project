const mongoose = require('mongoose');
const { randomBytes } = require('crypto');

const VoucherTemplate = require('./voucherTemplate.model');
const VoucherTemplateMapper = require('./voucherTemplate.mapper');
const ServicePackage = require('../service-packages/servicePackage.model');
const Garage = require('../garages/garage.model');
const CustomerVoucher = require('../customer-vouchers/customerVoucher.model');
const TierRule = require('../loyalty/tierRule.model');
const loyaltyService = require('../loyalty/loyalty.service');
const { AppError } = require('../../shared/utils/appError');
const {
    CUSTOMER_VOUCHER_TYPES,
    CUSTOMER_VOUCHER_STATUS,
    CUSTOMER_VOUCHER_SOURCES,
} = require('../../shared/constants/customerVoucher.constant');

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

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

const escapeRegExp = (value) => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const normalizeStringList = (values = []) => {
    return [...new Set(values.filter(Boolean))];
};

const generateVoucherCode = () => `PT_${randomBytes(6).toString('hex').toUpperCase()}`;

const normalizeBasePayload = (payload = {}) => {
    const normalizedPayload = {};

    if (payload.name !== undefined) {
        normalizedPayload.name = normalizeRequiredText(payload.name);
    }

    if (payload.description !== undefined) {
        normalizedPayload.description = normalizeText(payload.description);
    }

    if (payload.voucher_type !== undefined) {
        normalizedPayload.voucher_type = payload.voucher_type;
    }

    if (payload.value !== undefined) {
        normalizedPayload.value = payload.value;
    }

    if (payload.max_discount_amount !== undefined) {
        normalizedPayload.max_discount_amount = payload.max_discount_amount;
    }

    if (payload.min_order_amount !== undefined) {
        normalizedPayload.min_order_amount = payload.min_order_amount;
    }

    if (payload.service_package_id !== undefined) {
        normalizedPayload.service_package_id = payload.service_package_id || null;
    }

    if (payload.points_cost !== undefined) {
        normalizedPayload.points_cost = payload.points_cost;
    }

    if (payload.voucher_validity_days !== undefined) {
        normalizedPayload.voucher_validity_days = payload.voucher_validity_days;
    }

    if (payload.total_quantity !== undefined) {
        normalizedPayload.total_quantity = payload.total_quantity;
    }

    if (payload.per_customer_limit !== undefined) {
        normalizedPayload.per_customer_limit = payload.per_customer_limit;
    }

    if (payload.applicable_tiers !== undefined) {
        normalizedPayload.applicable_tiers = normalizeStringList(payload.applicable_tiers);
    }

    if (payload.start_at !== undefined) {
        normalizedPayload.start_at = new Date(payload.start_at);
    }

    if (payload.end_at !== undefined) {
        normalizedPayload.end_at = new Date(payload.end_at);
    }

    if (payload.is_active !== undefined) {
        normalizedPayload.is_active = payload.is_active;
    }

    return normalizedPayload;
};

const buildSearchFilter = ({ search, voucher_type, tier, is_active, valid_only } = {}) => {
    const filter = {};

    if (search) {
        const keyword = escapeRegExp(search.trim());

        filter.$or = [
            { name: { $regex: keyword, $options: 'i' } },
            { description: { $regex: keyword, $options: 'i' } },
        ];
    }

    if (voucher_type) {
        filter.voucher_type = voucher_type;
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

    if (is_active !== undefined) {
        filter.is_active = is_active;
    }

    if (valid_only) {
        const now = new Date();

        filter.is_active = true;
        filter.start_at = { $lte: now };
        filter.end_at = { $gte: now };
        filter.$expr = {
            $or: [
                { $eq: ['$total_quantity', null] },
                { $lt: ['$redeemed_count', '$total_quantity'] },
            ],
        };
    }

    return filter;
};

const populateVoucherTemplateQuery = (query) => {
    return query
        .populate('service_package_id', 'name vehicle_type service_type base_price is_active')
        .populate('created_by_id', 'full_name email phone role is_active')
        .populate('updated_by_id', 'full_name email phone role is_active');
};

const assertUpdatePayloadNotEmpty = (payload) => {
    if (!payload || Object.keys(payload).length === 0) {
        throw new AppError('No valid fields to update', 400, 'NO_VALID_FIELDS_TO_UPDATE');
    }
};

const assertDateRangeValid = (payload, current = null) => {
    const startAt = payload.start_at !== undefined ? payload.start_at : current?.start_at;
    const endAt = payload.end_at !== undefined ? payload.end_at : current?.end_at;

    if (startAt && endAt && startAt >= endAt) {
        throw new AppError('Voucher template end time must be after start time', 400, 'VOUCHER_TEMPLATE_DATE_RANGE_INVALID');
    }
};

const assertVoucherRuleValid = (payload, current = null) => {
    const voucherType = payload.voucher_type !== undefined ? payload.voucher_type : current?.voucher_type;
    const value = payload.value !== undefined ? payload.value : current?.value;
    const servicePackageId = payload.service_package_id !== undefined ? payload.service_package_id : current?.service_package_id;

    if (voucherType === CUSTOMER_VOUCHER_TYPES.PERCENTAGE && value > 100) {
        throw new AppError('Percentage value must not exceed 100', 400, 'VOUCHER_TEMPLATE_PERCENTAGE_INVALID');
    }

    if (voucherType === CUSTOMER_VOUCHER_TYPES.FREE_SERVICE && !servicePackageId) {
        throw new AppError('Free service voucher template requires a service package', 400, 'VOUCHER_TEMPLATE_SERVICE_PACKAGE_REQUIRED');
    }

    if (voucherType === CUSTOMER_VOUCHER_TYPES.FREE_SERVICE && value !== 0) {
        throw new AppError('Free service voucher template value must be 0', 400, 'VOUCHER_TEMPLATE_FREE_SERVICE_VALUE_INVALID');
    }

    if (voucherType !== CUSTOMER_VOUCHER_TYPES.FREE_SERVICE && value <= 0) {
        throw new AppError('Voucher template value must be greater than 0', 400, 'VOUCHER_TEMPLATE_VALUE_INVALID');
    }
};

const assertTierNamesValid = async (tierNames = []) => {
    const normalizedTierNames = normalizeStringList(tierNames)
        .map((tierName) => tierName.trim().toUpperCase());

    if (!normalizedTierNames.length) {
        return;
    }

    const count = await TierRule.countDocuments({
        tier_name: { $in: normalizedTierNames },
        is_active: true,
    });

    if (count !== new Set(normalizedTierNames).size) {
        throw new AppError(
            'One or more applicable tiers are invalid or inactive',
            400,
            'INVALID_VOUCHER_TEMPLATE_TIERS'
        );
    }
};

const assertServicePackageValid = async (servicePackageId) => {
    if (!servicePackageId) {
        return;
    }

    const servicePackage = await ServicePackage.findOne({ _id: servicePackageId, is_active: true });

    if (!servicePackage) {
        throw new AppError('Service package is invalid or inactive', 400, 'INVALID_VOUCHER_TEMPLATE_SERVICE_PACKAGE');
    }
};

const getVoucherTemplateDocumentById = async (voucherTemplateId) => {
    const voucherTemplate = await populateVoucherTemplateQuery(VoucherTemplate.findById(voucherTemplateId));

    if (!voucherTemplate) {
        throw new AppError('Voucher template not found', 404, 'VOUCHER_TEMPLATE_NOT_FOUND');
    }

    return voucherTemplate;
};

const getCustomerVoucherTemplates = async (customerId, { page = 1, limit = 20, search, voucher_type } = {}) => {
    const loyalty = await loyaltyService.getOrCreateCustomerLoyalty(customerId);
    const filter = buildSearchFilter({ search, voucher_type, valid_only: true });

    filter.$and = filter.$and || [];
    filter.$and.push({
        $or: [
            { applicable_tiers: { $size: 0 } },
            { applicable_tiers: loyalty.current_tier || '__NONE__' },
        ],
    });

    const skip = (page - 1) * limit;
    const [voucherTemplates, total] = await Promise.all([
        populateVoucherTemplateQuery(VoucherTemplate.find(filter))
            .sort({ points_cost: 1, created_at: -1 })
            .skip(skip)
            .limit(limit),
        VoucherTemplate.countDocuments(filter),
    ]);

    return {
        data: VoucherTemplateMapper.toVoucherTemplateDtoList(voucherTemplates),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
            available_points: loyalty.available_points,
        },
    };
};

const getAllVoucherTemplates = async ({ page = 1, limit = 20, search, voucher_type, tier, is_active, valid_only } = {}) => {
    const filter = buildSearchFilter({ search, voucher_type, tier, is_active, valid_only });
    const skip = (page - 1) * limit;

    const [voucherTemplates, total] = await Promise.all([
        populateVoucherTemplateQuery(VoucherTemplate.find(filter))
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit),
        VoucherTemplate.countDocuments(filter),
    ]);

    return {
        data: VoucherTemplateMapper.toVoucherTemplateDtoList(voucherTemplates),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

const getVoucherTemplateById = async (voucherTemplateId) => {
    const voucherTemplate = await getVoucherTemplateDocumentById(voucherTemplateId);

    return VoucherTemplateMapper.toVoucherTemplateDto(voucherTemplate);
};

const createVoucherTemplate = async (actorId, payload = {}) => {
    const createPayload = normalizeBasePayload(VoucherTemplateMapper.toCreatePayload(payload));

    assertDateRangeValid(createPayload);
    assertVoucherRuleValid(createPayload);
    await assertTierNamesValid(createPayload.applicable_tiers || []);
    await assertServicePackageValid(createPayload.service_package_id);

    const voucherTemplate = await VoucherTemplate.create({
        ...createPayload,
        created_by_id: actorId || null,
        updated_by_id: actorId || null,
    });
    const populatedVoucherTemplate = await getVoucherTemplateDocumentById(voucherTemplate._id);

    return VoucherTemplateMapper.toVoucherTemplateDto(populatedVoucherTemplate);
};

const updateVoucherTemplate = async (actorId, voucherTemplateId, payload = {}) => {
    const voucherTemplate = await getVoucherTemplateDocumentById(voucherTemplateId);
    const updatePayload = normalizeBasePayload(VoucherTemplateMapper.toUpdatePayload(payload));

    assertUpdatePayloadNotEmpty(updatePayload);
    assertDateRangeValid(updatePayload, voucherTemplate);
    assertVoucherRuleValid(updatePayload, voucherTemplate);

    if (updatePayload.applicable_tiers !== undefined) {
        await assertTierNamesValid(updatePayload.applicable_tiers);
    }

    if (updatePayload.service_package_id !== undefined) {
        await assertServicePackageValid(updatePayload.service_package_id);
    }

    if (
        updatePayload.total_quantity !== undefined
        && updatePayload.total_quantity !== null
        && updatePayload.total_quantity < voucherTemplate.redeemed_count
    ) {
        throw new AppError(
            'Total quantity cannot be lower than the number already redeemed',
            400,
            'VOUCHER_TEMPLATE_TOTAL_QUANTITY_TOO_LOW'
        );
    }

    const updatedVoucherTemplate = await VoucherTemplate.findByIdAndUpdate(
        voucherTemplateId,
        {
            $set: {
                ...updatePayload,
                updated_by_id: actorId || null,
            },
        },
        { new: true, runValidators: true }
    );

    const populatedVoucherTemplate = await getVoucherTemplateDocumentById(updatedVoucherTemplate._id);

    return VoucherTemplateMapper.toVoucherTemplateDto(populatedVoucherTemplate);
};

const updateVoucherTemplateStatus = async (actorId, voucherTemplateId, isActive) => {
    const voucherTemplate = await getVoucherTemplateDocumentById(voucherTemplateId);

    if (voucherTemplate.is_active === isActive) {
        throw new AppError('Voucher template status is unchanged', 400, 'NO_CHANGE');
    }

    const updatedVoucherTemplate = await VoucherTemplate.findByIdAndUpdate(
        voucherTemplateId,
        {
            $set: {
                is_active: isActive,
                updated_by_id: actorId || null,
            },
        },
        { new: true, runValidators: true }
    );

    const populatedVoucherTemplate = await getVoucherTemplateDocumentById(updatedVoucherTemplate._id);

    return VoucherTemplateMapper.toVoucherTemplateDto(populatedVoucherTemplate);
};

const deleteVoucherTemplate = async (voucherTemplateId) => {
    const voucherTemplate = await getVoucherTemplateDocumentById(voucherTemplateId);

    if (voucherTemplate.redeemed_count > 0) {
        throw new AppError(
            'Voucher template already has redemption history and cannot be deleted',
            409,
            'VOUCHER_TEMPLATE_HAS_REDEMPTION_HISTORY'
        );
    }

    await VoucherTemplate.deleteOne({ _id: voucherTemplate._id });

    return VoucherTemplateMapper.toVoucherTemplateDto(voucherTemplate);
};

const assertVoucherTemplateRedeemable = (voucherTemplate) => {
    const now = new Date();

    if (!voucherTemplate.is_active) {
        throw new AppError('Voucher template is inactive', 400, 'VOUCHER_TEMPLATE_INACTIVE');
    }

    if (now < voucherTemplate.start_at || now > voucherTemplate.end_at) {
        throw new AppError('Voucher template is not available at this time', 400, 'VOUCHER_TEMPLATE_NOT_IN_VALID_PERIOD');
    }
};

const redeemVoucherTemplate = async ({ customerId, voucherTemplateId, garageId }) => {
    const [voucherTemplate, garage, loyalty] = await Promise.all([
        VoucherTemplate.findById(voucherTemplateId),
        Garage.findOne({ _id: garageId, is_active: true }),
        loyaltyService.getOrCreateCustomerLoyalty(customerId),
    ]);

    if (!voucherTemplate) {
        throw new AppError('Voucher template not found', 404, 'VOUCHER_TEMPLATE_NOT_FOUND');
    }

    if (!garage) {
        throw new AppError('Active garage not found', 404, 'GARAGE_NOT_FOUND');
    }

    assertVoucherTemplateRedeemable(voucherTemplate);

    if (voucherTemplate.applicable_tiers?.length && !voucherTemplate.applicable_tiers.includes(loyalty.current_tier)) {
        throw new AppError('Customer tier is not eligible for this voucher template', 400, 'VOUCHER_TEMPLATE_TIER_NOT_ELIGIBLE');
    }

    if (voucherTemplate.points_cost > loyalty.available_points) {
        throw new AppError('Available points are not enough to redeem this voucher', 409, 'LOYALTY_POINTS_NOT_ENOUGH');
    }

    const session = await mongoose.startSession();

    try {
        let redemptionResult = null;

        await session.withTransaction(async () => {
            const stockFilter = {
                _id: voucherTemplateId,
                is_active: true,
                start_at: { $lte: new Date() },
                end_at: { $gte: new Date() },
            };

            if (voucherTemplate.total_quantity !== null) {
                stockFilter.$expr = { $lt: ['$redeemed_count', voucherTemplate.total_quantity] };
            }

            const reservedTemplate = await VoucherTemplate.findOneAndUpdate(
                stockFilter,
                { $inc: { redeemed_count: 1 } },
                { new: true, session }
            );

            if (!reservedTemplate) {
                throw new AppError('Voucher template is no longer available', 409, 'VOUCHER_TEMPLATE_NOT_AVAILABLE');
            }

            if (reservedTemplate.per_customer_limit) {
                const redeemedByCustomer = await CustomerVoucher.countDocuments({
                    source_voucher_template_id: voucherTemplateId,
                    customer_id: customerId,
                }).session(session);

                if (redeemedByCustomer >= reservedTemplate.per_customer_limit) {
                    throw new AppError(
                        'You have reached the redemption limit for this voucher template',
                        409,
                        'VOUCHER_TEMPLATE_CUSTOMER_LIMIT_REACHED'
                    );
                }
            }

            const loyaltyResult = await loyaltyService.redeemPointsForVoucherRedemption({
                customerId,
                points: reservedTemplate.points_cost,
                sourceId: reservedTemplate._id,
                description: `Đổi điểm lấy voucher "${reservedTemplate.name}"`,
                actorId: customerId,
                session,
            });

            const now = new Date();
            const expiresAt = new Date(now.getTime() + reservedTemplate.voucher_validity_days * MILLISECONDS_PER_DAY);

            const createdVouchers = await CustomerVoucher.create(
                [
                    {
                        code: generateVoucherCode(),
                        customer_id: customerId,
                        garage_id: garageId,
                        source_type: CUSTOMER_VOUCHER_SOURCES.POINTS_REDEMPTION,
                        source_voucher_template_id: reservedTemplate._id,
                        voucher_type: reservedTemplate.voucher_type,
                        value: reservedTemplate.value,
                        max_discount_amount: reservedTemplate.max_discount_amount,
                        min_order_amount: reservedTemplate.min_order_amount,
                        service_package_id: reservedTemplate.service_package_id,
                        status: CUSTOMER_VOUCHER_STATUS.ISSUED,
                        expires_at: expiresAt,
                        note: `Đổi bằng ${reservedTemplate.points_cost} điểm tích lũy`,
                        issued_by_id: customerId,
                        approved_by_id: customerId,
                        approved_at: now,
                    },
                ],
                { session }
            );

            redemptionResult = {
                voucherTemplate: reservedTemplate,
                customerVoucher: createdVouchers[0],
                loyalty: loyaltyResult.loyalty,
            };
        });

        return VoucherTemplateMapper.toVoucherTemplateRedemptionDto({
            voucher_template: redemptionResult.voucherTemplate,
            customer_voucher: redemptionResult.customerVoucher,
            loyalty: redemptionResult.loyalty,
        });
    } finally {
        await session.endSession();
    }
};

module.exports = {
    getCustomerVoucherTemplates,
    getAllVoucherTemplates,
    getVoucherTemplateById,
    createVoucherTemplate,
    updateVoucherTemplate,
    updateVoucherTemplateStatus,
    deleteVoucherTemplate,
    redeemVoucherTemplate,
};
