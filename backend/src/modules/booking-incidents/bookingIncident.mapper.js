const toId = (value) => {
    if (!value) {
        return null;
    }

    return value._id ? value._id.toString() : value.toString();
};

const toUserSummary = (value) => {
    if (!value || !value._id) {
        return null;
    }

    return {
        id: value._id.toString(),
        full_name: value.full_name,
        role: value.role,
    };
};

const toBookingIncidentDto = (incident) => {
    if (!incident) {
        return null;
    }

    const plainIncident = incident.toObject ? incident.toObject() : incident;

    return {
        id: toId(plainIncident._id),
        booking_id: toId(plainIncident.booking_id),
        garage_id: toId(plainIncident.garage_id),
        customer_id: toId(plainIncident.customer_id),
        incident_type: plainIncident.incident_type,
        description: plainIncident.description,
        status: plainIncident.status,
        affected_booking_item_key: plainIncident.affected_booking_item_key,
        affected_wash_bay_id: toId(plainIncident.affected_wash_bay_id),
        affected_staff_profile_id: toId(plainIncident.affected_staff_profile_id),
        released_booking_item_keys: plainIncident.released_booking_item_keys || [],
        reported_by_id: toId(plainIncident.reported_by_id),
        reported_by: toUserSummary(plainIncident.reported_by_id),
        reported_booking_status: plainIncident.reported_booking_status,
        reported_schedule_snapshot: plainIncident.reported_schedule_snapshot,
        countdown_paused_automatically: plainIncident.countdown_paused_automatically,
        decision: plainIncident.decision,
        decision_source: plainIncident.decision_source,
        contact_channel: plainIncident.contact_channel,
        customer_note: plainIncident.customer_note,
        new_start_time: plainIncident.new_start_time,
        continuation_policy: plainIncident.continuation_policy,
        customer_confirmed_at: plainIncident.customer_confirmed_at,
        decision_recorded_by_id: toId(plainIncident.decision_recorded_by_id),
        decision_recorded_by: toUserSummary(plainIncident.decision_recorded_by_id),
        resolved_at: plainIncident.resolved_at,
        resolved_by_id: toId(plainIncident.resolved_by_id),
        resolved_by: toUserSummary(plainIncident.resolved_by_id),
        compensation_voucher_ids: (plainIncident.compensation_voucher_ids || []).map(toId),
        compensation_vouchers: (plainIncident.compensation_voucher_ids || [])
            .filter((voucher) => voucher && voucher._id)
            .map((voucher) => ({
                id: toId(voucher),
                code: voucher.code,
                status: voucher.status,
                expires_at: voucher.expires_at,
                customer_id: toId(voucher.customer_id),
                guest_phone: voucher.guest_phone || null,
                normalized_guest_phone: voucher.normalized_guest_phone || null,
            })),
        created_at: plainIncident.created_at,
        updated_at: plainIncident.updated_at,
    };
};

const toBookingIncidentDtoList = (incidents = []) => incidents.map(toBookingIncidentDto);

module.exports = {
    toBookingIncidentDto,
    toBookingIncidentDtoList,
};
