const toId = (value) => {
    if (!value) {
        return null;
    }

    if (value._id) {
        return value._id.toString();
    }

    if (value.toString) {
        return value.toString();
    }

    return value;
};

const toUserSummaryDto = (user) => {
    if (!user || !user._id) {
        return null;
    }

    return {
        id: user._id.toString(),
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        is_active: user.is_active,
    };
};

const toBookingServiceStepDto = (step) => {
    if (!step) {
        return null;
    }

    const plainStep = step.toObject ? step.toObject() : step;

    return {
        id: plainStep._id?.toString() || plainStep.id || null,
        booking_id: toId(plainStep.booking_id),
        service_package_id: toId(plainStep.service_package_id),
        booking_item_key: plainStep.booking_item_key,
        step_code: plainStep.step_code,
        step_name: plainStep.step_name,
        order: plainStep.order,
        step_type: plainStep.step_type,
        is_required: plainStep.is_required,
        display_staff_type: plainStep.display_staff_type,
        assigned_staff_id: toId(plainStep.assigned_staff_id),
        assigned_staff: toUserSummaryDto(plainStep.assigned_staff_id),
        confirmed_by_staff_id: toId(plainStep.confirmed_by_staff_id),
        confirmed_by_staff: toUserSummaryDto(plainStep.confirmed_by_staff_id),
        status: plainStep.status,
        instructions: plainStep.instructions || [],
        started_at: plainStep.started_at,
        completed_at: plainStep.completed_at,
        note: plainStep.note,
        created_at: plainStep.created_at,
        updated_at: plainStep.updated_at,
    };
};

const toBookingServiceStepDtoList = (steps = []) => {
    return steps.map((step) => toBookingServiceStepDto(step));
};

module.exports = {
    toBookingServiceStepDto,
    toBookingServiceStepDtoList,
};
