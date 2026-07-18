const toId = (value) => {
    if (!value) {
        return null;
    }

    return value._id?.toString?.() || value.toString?.() || value;
};

const toUserSummary = (value) => {
    if (!value?._id) {
        return null;
    }

    return {
        id: value._id.toString(),
        full_name: value.full_name,
        role: value.role,
    };
};

const toBookingHandoverDto = (handover) => {
    if (!handover) {
        return null;
    }

    const item = handover.toObject ? handover.toObject() : handover;

    return {
        id: toId(item._id),
        booking_id: toId(item.booking_id),
        garage_id: toId(item.garage_id),
        customer_id: toId(item.customer_id),
        vehicle_id: toId(item.vehicle_id),
        guest_name: item.guest_name,
        guest_phone: item.guest_phone,
        state: item.state,
        customer_response: item.customer_response,
        ready_at: item.ready_at,
        ready_by_id: toId(item.ready_by_id),
        ready_by: toUserSummary(item.ready_by_id),
        ready_note: item.ready_note,
        customer_responded_at: item.customer_responded_at,
        accepted_at: item.accepted_at,
        released_at: item.released_at,
        released_by_id: toId(item.released_by_id),
        released_by: toUserSummary(item.released_by_id),
        release_note: item.release_note,
        issue_case_ids: (item.issue_case_ids || []).map(toId),
        inspection_snapshot: item.inspection_snapshot || {},
        created_at: item.created_at,
        updated_at: item.updated_at,
    };
};

module.exports = {
    toBookingHandoverDto,
};
