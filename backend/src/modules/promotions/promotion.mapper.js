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

const toPromotionDto = (promotion) => {
    if (!promotion) {
        return null;
    }

    const plainPromotion = promotion.toObject ? promotion.toObject() : promotion;

    return {
        id: plainPromotion._id?.toString() || plainPromotion.id || null,
        code: plainPromotion.code,
        name: plainPromotion.name,
        description: plainPromotion.description,
        discount_type: plainPromotion.discount_type,
        discount_value: plainPromotion.discount_value,
        max_discount_amount: plainPromotion.max_discount_amount,
        min_order_amount: plainPromotion.min_order_amount,
        applicable_tiers: plainPromotion.applicable_tiers || [],
        applicable_vehicle_types: plainPromotion.applicable_vehicle_types || [],
        applicable_service_package_ids: (plainPromotion.applicable_service_package_ids || []).map((item) => toServicePackageSummaryDto(item)),
        start_at: plainPromotion.start_at,
        end_at: plainPromotion.end_at,
        usage_limit: plainPromotion.usage_limit,
        per_customer_limit: plainPromotion.per_customer_limit,
        used_count: plainPromotion.used_count,
        is_active: plainPromotion.is_active,
        created_by_id: toId(plainPromotion.created_by_id),
        updated_by_id: toId(plainPromotion.updated_by_id),
        created_at: plainPromotion.created_at,
        updated_at: plainPromotion.updated_at,
    };
};

const toPromotionDtoList = (promotions = []) => {
    return promotions.map((promotion) => toPromotionDto(promotion));
};

const toPromotionValidationDto = ({ promotion, discount_amount, final_price }) => {
    return {
        promotion: toPromotionDto(promotion),
        discount_amount,
        final_price,
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
    'code',
    'name',
    'description',
    'discount_type',
    'discount_value',
    'max_discount_amount',
    'min_order_amount',
    'applicable_tiers',
    'applicable_vehicle_types',
    'applicable_service_package_ids',
    'start_at',
    'end_at',
    'usage_limit',
    'per_customer_limit',
    'is_active',
];

const toCreatePayload = (data = {}) => copyDefinedFields(data, baseFields);
const toUpdatePayload = (data = {}) => copyDefinedFields(data, baseFields);

module.exports = {
    toPromotionDto,
    toPromotionDtoList,
    toPromotionValidationDto,
    toCreatePayload,
    toUpdatePayload,
};
