const toId = (value) => {
    if (!value) {
        return null;
    }

    return value._id?.toString?.() || value.toString?.() || value;
};

const toUserSummary = (value) => {
    if (!value || typeof value !== 'object' || !value._id) {
        return null;
    }

    return {
        id: toId(value),
        full_name: value.full_name,
        email: value.email,
        phone: value.phone,
        role: value.role,
    };
};

const toStaffTypeChangeDto = (request) => {
    if (!request) {
        return null;
    }

    const item = request.toObject ? request.toObject() : request;

    return {
        id: toId(item._id || item.id),
        staff_profile_id: toId(item.staff_profile_id),
        from_staff_type: item.from_staff_type,
        to_staff_type: item.to_staff_type,
        from_garage_id: toId(item.from_garage_id),
        to_garage_id: toId(item.to_garage_id),
        reason: item.reason,
        effective_at: item.effective_at,
        status: item.status,
        requested_by: toId(item.requested_by),
        requester: toUserSummary(item.requested_by),
        approved_by: toId(item.approved_by),
        approver: toUserSummary(item.approved_by),
        approved_at: item.approved_at,
        applied_at: item.applied_at,
        rejected_by: toId(item.rejected_by),
        rejected_at: item.rejected_at,
        cancelled_by: toId(item.cancelled_by),
        cancelled_at: item.cancelled_at,
        decision_reason: item.decision_reason,
        handover_note: item.handover_note,
        emergency_override: Boolean(item.emergency_override),
        override_reason: item.override_reason,
        impact_snapshot: item.impact_snapshot || null,
        failure_reason: item.failure_reason || null,
        created_at: item.created_at,
        updated_at: item.updated_at,
    };
};

const toStaffTypeChangeDtoList = (requests = []) => (
    requests.map(toStaffTypeChangeDto)
);

module.exports = {
    toStaffTypeChangeDto,
    toStaffTypeChangeDtoList,
};
