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

const toUploadSummary = (value) => {
    if (!value) {
        return null;
    }

    if (!value.url) {
        return { id: toId(value) };
    }

    return {
        id: toId(value._id),
        url: value.url,
        mime_type: value.mime_type,
        size: value.size,
        purpose: value.purpose,
        owner_id: toId(value.owner_id),
        created_at: value.created_at,
    };
};

const toPublicBookingSnapshot = (snapshot = {}) => ({
    id: snapshot.id,
    status: snapshot.status,
    garage_id: snapshot.garage_id,
    vehicle_id: snapshot.vehicle_id,
    service_package_id: snapshot.service_package_id,
    license_plate: snapshot.license_plate,
    start_time: snapshot.start_time,
    service_started_at: snapshot.service_started_at,
    completed_at: snapshot.completed_at,
    payment_status: snapshot.payment_status,
    final_price: snapshot.final_price,
    booking_items: (snapshot.booking_items || []).map((item) => ({
        item_key: item.item_key,
        service_package_id: item.service_package_id,
        name_snapshot: item.name_snapshot,
        status: item.status,
        actual_started_at: item.actual_started_at,
        actual_completed_at: item.actual_completed_at,
    })),
});

const toCustomerCaseDto = (customerCase, { customerView = false, includeSnapshots = true } = {}) => {
    if (!customerCase) {
        return null;
    }

    const item = customerCase.toObject ? customerCase.toObject() : customerCase;

    return {
        id: toId(item._id),
        case_code: item.case_code,
        booking_id: toId(item.booking_id),
        handover_id: toId(item.handover_id),
        garage_id: toId(item.garage_id),
        customer_id: toId(item.customer_id),
        customer: toUserSummary(item.customer_id),
        vehicle_id: toId(item.vehicle_id),
        is_walk_in_case: item.is_walk_in_case === true,
        reporter_name: item.reporter_name,
        reporter_phone: item.reporter_phone,
        created_by_staff_id: toId(item.created_by_staff_id),
        category: item.category,
        priority: item.priority,
        source: item.source,
        status: item.status,
        description: item.description,
        damage_location: item.damage_location,
        desired_resolution: item.desired_resolution,
        discovered_at: item.discovered_at,
        vehicle_received: item.vehicle_received,
        evidence: (item.upload_ids || []).map(toUploadSummary).filter(Boolean),
        booking_snapshot: includeSnapshots
            ? (customerView ? toPublicBookingSnapshot(item.booking_snapshot) : item.booking_snapshot || {})
            : undefined,
        inspection_snapshot: includeSnapshots ? item.inspection_snapshot || {} : undefined,
        assigned_to_id: toId(item.assigned_to_id),
        assigned_to: toUserSummary(item.assigned_to_id),
        assigned_by_id: toId(item.assigned_by_id),
        assigned_at: item.assigned_at,
        acknowledged_by_id: toId(item.acknowledged_by_id),
        acknowledged_at: item.acknowledged_at,
        first_response_due_at: item.first_response_due_at,
        resolution_due_at: item.resolution_due_at,
        first_response_breached_at: item.first_response_breached_at,
        resolution_breached_at: item.resolution_breached_at,
        escalation_level: item.escalation_level || 0,
        reopen_count: item.reopen_count || 0,
        last_reopened_at: item.last_reopened_at,
        last_reopen_reason: item.last_reopen_reason,
        liability_status: item.liability_status,
        conclusion: item.conclusion,
        resolution_summary: item.resolution_summary,
        resolved_by_id: toId(item.resolved_by_id),
        resolved_at: item.resolved_at,
        closed_by_id: toId(item.closed_by_id),
        closed_at: item.closed_at,
        created_at: item.created_at,
        updated_at: item.updated_at,
    };
};

const toTechnicalAssessmentDto = (assessment, { customerView = false } = {}) => {
    if (!assessment) return null;
    const item = assessment.toObject ? assessment.toObject() : assessment;
    return {
        ...item,
        id: toId(item._id),
        case_id: toId(item.case_id),
        garage_id: toId(item.garage_id),
        inspector_staff_profile_id: customerView ? undefined : toId(item.inspector_staff_profile_id),
        inspector_user_id: customerView ? undefined : toId(item.inspector_user_id),
        assigned_by_id: customerView ? undefined : toId(item.assigned_by_id),
        evidence: (item.upload_ids || []).map(toUploadSummary).filter(Boolean),
        upload_ids: undefined,
        _id: undefined,
        __v: undefined,
    };
};

const toResolutionDto = (resolution) => {
    if (!resolution) return null;
    const item = resolution.toObject ? resolution.toObject() : resolution;
    return {
        ...item,
        id: toId(item._id),
        case_id: toId(item.case_id),
        proposed_by_id: toId(item.proposed_by_id),
        customer_responded_by_id: toId(item.customer_responded_by_id),
        applied_by_id: toId(item.applied_by_id),
        refund_ids: (item.refund_ids || []).map(toId),
        voucher_ids: (item.voucher_ids || []).map(toId),
        rework_booking_ids: (item.rework_booking_ids || []).map(toId),
        actions: (item.actions || []).map((action) => ({
            ...(action.toObject ? action.toObject() : action),
            id: toId(action._id),
            service_package_id: toId(action.service_package_id),
            _id: undefined,
        })),
        _id: undefined,
        __v: undefined,
    };
};

const toRefundDto = (refund) => {
    if (!refund) return null;
    const item = refund.toObject ? refund.toObject() : refund;
    return {
        ...item,
        id: toId(item._id),
        case_id: toId(item.case_id),
        resolution_id: toId(item.resolution_id),
        booking_id: toId(item.booking_id),
        approved_by_id: toId(item.approved_by_id),
        processed_by_id: toId(item.processed_by_id),
        _id: undefined,
        __v: undefined,
    };
};

const toCustomerCaseMessageDto = (message) => {
    if (!message) {
        return null;
    }

    const item = message.toObject ? message.toObject() : message;

    return {
        id: toId(item._id),
        case_id: toId(item.case_id),
        sender_id: toId(item.sender_id),
        sender: toUserSummary(item.sender_id),
        sender_role: item.sender_role,
        message: item.message,
        evidence: (item.upload_ids || []).map(toUploadSummary).filter(Boolean),
        created_at: item.created_at,
    };
};

const toCustomerCaseEventDto = (event) => {
    if (!event) {
        return null;
    }

    const item = event.toObject ? event.toObject() : event;

    return {
        id: toId(item._id),
        case_id: toId(item.case_id),
        event_type: item.event_type,
        actor_id: toId(item.actor_id),
        actor: toUserSummary(item.actor_id),
        actor_role: item.actor_role,
        from_status: item.from_status,
        to_status: item.to_status,
        visible_to_customer: item.visible_to_customer,
        metadata: item.metadata || {},
        created_at: item.created_at,
    };
};

module.exports = {
    toCustomerCaseDto,
    toCustomerCaseMessageDto,
    toCustomerCaseEventDto,
    toCustomerCaseDtoList: (items = [], options = {}) => items.map((item) => toCustomerCaseDto(item, options)),
    toCustomerCaseMessageDtoList: (items = []) => items.map(toCustomerCaseMessageDto),
    toCustomerCaseEventDtoList: (items = []) => items.map(toCustomerCaseEventDto),
    toTechnicalAssessmentDto,
    toResolutionDto,
    toRefundDto,
};
