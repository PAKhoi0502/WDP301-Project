const toId = (value) => {
    if (!value) {
        return null;
    }

    if (value._id) {
        return value._id.toString();
    }

    return value.toString();
};

const toServicePackageSummaryDto = (servicePackage) => {
    if (!servicePackage) {
        return null;
    }

    if (!servicePackage.name) {
        return toId(servicePackage);
    }

    return {
        id: toId(servicePackage),
        name: servicePackage.name,
        vehicle_type: servicePackage.vehicle_type,
        service_type: servicePackage.service_type,
        base_price: servicePackage.base_price,
        is_active: servicePackage.is_active,
    };
};

const toVoucherTemplateDto = (voucherTemplate) => {
    if (!voucherTemplate) {
        return null;
    }

    const plainVoucherTemplate = voucherTemplate.toObject ? voucherTemplate.toObject() : voucherTemplate;

    return {
        id: plainVoucherTemplate._id?.toString() || plainVoucherTemplate.id || null,
        name: plainVoucherTemplate.name,
        description: plainVoucherTemplate.description,
        voucher_type: plainVoucherTemplate.voucher_type,
        value: plainVoucherTemplate.value,
        max_discount_amount: plainVoucherTemplate.max_discount_amount,
        min_order_amount: plainVoucherTemplate.min_order_amount,
        service_package_id: toId(plainVoucherTemplate.service_package_id),
        service_package: toServicePackageSummaryDto(plainVoucherTemplate.service_package_id),
        points_cost: plainVoucherTemplate.points_cost,
        voucher_validity_days: plainVoucherTemplate.voucher_validity_days,
        total_quantity: plainVoucherTemplate.total_quantity,
        redeemed_count: plainVoucherTemplate.redeemed_count,
        remaining_quantity: plainVoucherTemplate.total_quantity === null
            ? null
            : Math.max(plainVoucherTemplate.total_quantity - plainVoucherTemplate.redeemed_count, 0),
        per_customer_limit: plainVoucherTemplate.per_customer_limit,
        applicable_tiers: plainVoucherTemplate.applicable_tiers || [],
        start_at: plainVoucherTemplate.start_at,
        end_at: plainVoucherTemplate.end_at,
        is_active: plainVoucherTemplate.is_active,
        created_by_id: toId(plainVoucherTemplate.created_by_id),
        updated_by_id: toId(plainVoucherTemplate.updated_by_id),
        created_at: plainVoucherTemplate.created_at,
        updated_at: plainVoucherTemplate.updated_at,
    };
};

const toVoucherTemplateDtoList = (voucherTemplates = []) => {
    return voucherTemplates.map((voucherTemplate) => toVoucherTemplateDto(voucherTemplate));
};

const toVoucherTemplateRedemptionDto = ({ voucher_template, customer_voucher, loyalty }) => {
    return {
        voucher_template: toVoucherTemplateDto(voucher_template),
        customer_voucher_id: toId(customer_voucher),
        loyalty,
    };
};

const copyDefinedFields = (data = {}, fields = []) => {
    const payload = {};

    fields.forEach((field) => {
        if (data[field] !== undefined) {
            payload[field] = data[field];
        }
    });

    return payload;
};

const baseFields = [
    'name',
    'description',
    'voucher_type',
    'value',
    'max_discount_amount',
    'min_order_amount',
    'service_package_id',
    'points_cost',
    'voucher_validity_days',
    'total_quantity',
    'per_customer_limit',
    'applicable_tiers',
    'start_at',
    'end_at',
    'is_active',
];

const toCreatePayload = (data = {}) => copyDefinedFields(data, baseFields);
const toUpdatePayload = (data = {}) => copyDefinedFields(data, baseFields);

module.exports = {
    toVoucherTemplateDto,
    toVoucherTemplateDtoList,
    toVoucherTemplateRedemptionDto,
    toCreatePayload,
    toUpdatePayload,
};
