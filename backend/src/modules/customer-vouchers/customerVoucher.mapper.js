const toId = (value) => {
    if (!value) {
        return null;
    }

    return value._id ? value._id.toString() : value.toString();
};

const toReferenceSummary = (value, fields) => {
    if (!value || typeof value !== 'object' || !value._id) {
        return null;
    }

    return fields.reduce(
        (summary, field) => {
            summary[field] = value[field] ?? null;
            return summary;
        },
        { id: value._id.toString() }
    );
};

const toCustomerVoucherDto = (voucher) => {
    if (!voucher) {
        return null;
    }

    const plainVoucher = voucher.toObject ? voucher.toObject() : voucher;

    return {
        id: toId(plainVoucher._id),
        code: plainVoucher.code,
        customer_id: toId(plainVoucher.customer_id),
        garage_id: toId(plainVoucher.garage_id),
        customer: toReferenceSummary(
            plainVoucher.customer_id,
            ['full_name', 'email', 'phone']
        ),
        garage: toReferenceSummary(plainVoucher.garage_id, ['name', 'garage_code']),
        source_type: plainVoucher.source_type
            || (plainVoucher.source_incident_id
                ? 'INCIDENT'
                : plainVoucher.source_customer_case_id
                    ? 'CUSTOMER_CASE'
                    : null),
        source_booking_id: toId(plainVoucher.source_booking_id),
        source_incident_id: toId(plainVoucher.source_incident_id),
        source_customer_case_id: toId(plainVoucher.source_customer_case_id),
        source_customer_case_resolution_id: toId(plainVoucher.source_customer_case_resolution_id),
        voucher_type: plainVoucher.voucher_type,
        value: plainVoucher.value,
        max_discount_amount: plainVoucher.max_discount_amount,
        min_order_amount: plainVoucher.min_order_amount,
        service_package_id: toId(plainVoucher.service_package_id),
        service_package: toReferenceSummary(
            plainVoucher.service_package_id,
            ['name', 'service_type', 'vehicle_type', 'base_price']
        ),
        status: plainVoucher.status,
        expires_at: plainVoucher.expires_at,
        note: plainVoucher.note,
        issued_by_id: toId(plainVoucher.issued_by_id),
        approved_by_id: toId(plainVoucher.approved_by_id),
        approved_at: plainVoucher.approved_at,
        reserved_booking_id: toId(plainVoucher.reserved_booking_id),
        reserved_at: plainVoucher.reserved_at,
        used_at: plainVoucher.used_at,
        revoked_at: plainVoucher.revoked_at,
        revoked_by_id: toId(plainVoucher.revoked_by_id),
        created_at: plainVoucher.created_at,
        updated_at: plainVoucher.updated_at,
    };
};

const toCustomerVoucherDtoList = (vouchers = []) => vouchers.map(toCustomerVoucherDto);

module.exports = {
    toCustomerVoucherDto,
    toCustomerVoucherDtoList,
};
