const toId = (value) => {
    if (!value) {
        return null;
    }

    if (value._id) {
        return value._id.toString();
    }

    return value.toString();
};

const toUserSummaryDto = (user) => {
    if (!user || typeof user !== 'object' || !user._id) {
        return null;
    }

    const plainUser = user.toObject ? user.toObject() : user;

    return {
        id: plainUser._id?.toString() || plainUser.id || null,
        full_name: plainUser.full_name || '',
        email: plainUser.email || null,
        phone: plainUser.phone || null,
        role: plainUser.role,
        is_active: plainUser.is_active,
    };
};

const toFiltersDto = (filters = {}) => {
    const plainFilters = filters.toObject ? filters.toObject() : filters;

    return {
        survey_id: toId(plainFilters.survey_id),
        from: plainFilters.from || null,
        to: plainFilters.to || null,
        garage_id: toId(plainFilters.garage_id),
        service_package_id: toId(plainFilters.service_package_id),
        vehicle_type: plainFilters.vehicle_type || null,
        group_by: plainFilters.group_by || 'DAY',
    };
};

const toResearchReportDto = (report) => {
    if (!report) {
        return null;
    }

    const plainReport = report.toObject ? report.toObject() : report;

    return {
        id: plainReport._id?.toString() || plainReport.id || null,
        title: plainReport.title,
        objective: plainReport.objective,
        type: plainReport.type,
        status: plainReport.status,
        filters: toFiltersDto(plainReport.filters),
        data_snapshot: plainReport.data_snapshot || null,
        result: plainReport.result || null,
        model: plainReport.model || null,
        prompt_version: plainReport.prompt_version || null,
        usage_metadata: plainReport.usage_metadata || null,
        error: plainReport.error || null,
        created_by_id: toId(plainReport.created_by),
        created_by: toUserSummaryDto(plainReport.created_by),
        started_at: plainReport.started_at || null,
        completed_at: plainReport.completed_at || null,
        created_at: plainReport.created_at,
        updated_at: plainReport.updated_at,
    };
};

const toResearchReportDtoList = (reports = []) => {
    return reports.map((report) => toResearchReportDto(report));
};

module.exports = {
    toResearchReportDto,
    toResearchReportDtoList,
    toFiltersDto,
};
