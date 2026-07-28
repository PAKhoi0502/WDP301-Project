require('dotenv').config();

const mongoose = require('mongoose');

const { connectDB, disconnectDB } = require('../config/db');
const Booking = require('../modules/bookings/booking.model');
const BookingIncident = require('../modules/booking-incidents/bookingIncident.model');
const BookingViolationEvent = require('../modules/booking-violations/bookingViolationEvent.model');
const CustomerVoucher = require('../modules/customer-vouchers/customerVoucher.model');
const CustomerCase = require('../modules/customer-cases/customerCase.model');
const CustomerCaseEvent = require('../modules/customer-cases/customerCaseEvent.model');
const CustomerCaseMessage = require('../modules/customer-cases/customerCaseMessage.model');
const CustomerCaseTechnicalAssessment = require('../modules/customer-cases/customerCaseTechnicalAssessment.model');
const CustomerCaseResolution = require('../modules/customer-cases/customerCaseResolution.model');
const CustomerCaseRefund = require('../modules/customer-cases/customerCaseRefund.model');
const BookingHandover = require('../modules/booking-handovers/bookingHandover.model');
const CustomerLoyalty = require('../modules/loyalty/customerLoyalty.model');
const PointTransaction = require('../modules/loyalty/pointTransaction.model');
const WashHistory = require('../modules/wash-histories/washHistory.model');
const ServicePackage = require('../modules/service-packages/servicePackage.model');
const StaffProfile = require('../modules/staff-profiles/staffProfile.model');
const Garage = require('../modules/garages/garage.model');
const User = require('../modules/users/user.model');
const WashBay = require('../modules/wash-bays/washBay.model');
const {
    BOOKING_STATUS,
    BOOKING_ITEM_STATUS,
    BOOKING_PAYMENT_STATUS,
} = require('../shared/constants/booking.constant');
const {
    BOOKING_OPERATION_STATUS,
    BOOKING_INCIDENT_TYPES,
    BOOKING_INCIDENT_STATUS,
    BOOKING_INCIDENT_DECISIONS,
    BOOKING_INCIDENT_CONTACT_CHANNELS,
    BOOKING_INCIDENT_DECISION_SOURCES,
    BOOKING_INCIDENT_CONTINUATION_POLICIES,
    BOOKING_CANCELLATION_SOURCES,
} = require('../shared/constants/bookingIncident.constant');
const {
    CUSTOMER_VOUCHER_TYPES,
    CUSTOMER_VOUCHER_STATUS,
} = require('../shared/constants/customerVoucher.constant');
const {
    BOOKING_HANDOVER_STATES,
    BOOKING_HANDOVER_RESPONSES,
    BOOKING_HANDOVER_RESPONSE_SOURCES,
    CUSTOMER_CASE_CATEGORIES,
    CUSTOMER_CASE_STATUSES,
    CUSTOMER_CASE_SOURCES,
    CUSTOMER_CASE_LIABILITY_STATUSES,
    CUSTOMER_CASE_EVENT_TYPES,
    CUSTOMER_CASE_TECHNICAL_ASSESSMENT_STATUSES,
    CUSTOMER_CASE_RESOLUTION_STATUSES,
    CUSTOMER_CASE_RESOLUTION_ACTION_TYPES,
    CUSTOMER_CASE_REFUND_METHODS,
    CUSTOMER_CASE_REFUND_STATUSES,
    getCustomerCasePriority,
    getCustomerCasePriorityRank,
} = require('../shared/constants/customerCase.constant');
const { USER_ROLES } = require('../shared/constants/roles.constant');
const { STAFF_TYPES } = require('../shared/constants/staff.constant');
const { WASH_BAY_STATUS } = require('../shared/constants/washBay.constant');
const { stableHexId } = require('./seedBookingCatalog');
const { getSeedReferenceDate } = require('./seedTime');
const {
    seedPaymentsPromotionUsagesData,
    verifyPaymentsPromotionUsages,
} = require('./seedPaymentsPromotionUsages');
const {
    buildSeedPlan: buildLoyaltyHandoverPlan,
    seedLoyaltyHistoriesHandoversData,
} = require('./seedLoyaltyHistoriesHandovers');
const {
    INCIDENT_TARGETS,
    VOUCHER_TARGETS,
    CUSTOMER_CASE_TARGETS,
    CUSTOMER_CASE_CATEGORY_SEQUENCE,
    CUSTOMER_CASE_STATUS_SEQUENCE,
    CUSTOMER_CASE_DEPENDENT_TARGETS,
} = require('./seedIncidentsVouchersCustomerCasesCatalog');

const toId = (value) => String(value?._id || value || '');
const addMinutes = (date, minutes) => new Date(
    new Date(date).getTime() + minutes * 60000
);
const addDays = (date, days) => addMinutes(date, days * 1440);
const maxDate = (...dates) => new Date(Math.max(
    ...dates.filter(Boolean).map((date) => new Date(date).getTime())
));
const minDate = (...dates) => new Date(Math.min(
    ...dates.filter(Boolean).map((date) => new Date(date).getTime())
));
const sameDate = (left, right) => (
    left === null && right === null
) || (
    left
    && right
    && new Date(left).getTime() === new Date(right).getTime()
);
const sameId = (left, right) => toId(left) === toId(right);
const applySession = (query, session) => (
    session ? query.session(session) : query
);
const countBy = (items, selector) => items.reduce((counts, item) => {
    const key = selector(item);

    counts[key] = (counts[key] || 0) + 1;

    return counts;
}, {});
const countsMatch = (actual, expected) => (
    Object.keys(actual).length === Object.keys(expected).length
    && Object.entries(expected).every(
        ([key, count]) => actual[key] === count
    )
);
const sortByTimeAndId = (left, right, field) => (
    new Date(left[field]).getTime() - new Date(right[field]).getTime()
    || toId(left._id).localeCompare(toId(right._id))
);
const deterministicId = (namespace, naturalKey) => (
    new mongoose.Types.ObjectId(stableHexId(namespace, naturalKey))
);
const uniqueById = (items) => [
    ...new Map(items.map((item) => [toId(item._id), item])).values(),
];

const buildIncidentScheduleSnapshot = ({
    booking,
    startTime = booking.start_time,
    endTime = booking.end_time,
    reportedStatus,
}) => ({
    _id: booking._id,
    customer_id: booking.customer_id || null,
    garage_id: booking.garage_id,
    service_package_id: booking.service_package_id,
    vehicle_type: booking.vehicle_type,
    add_on_service_ids: booking.add_on_service_ids || [],
    start_time: startTime,
    end_time: endTime,
    booking_status: reportedStatus,
    checked_in_at: booking.checked_in_at || null,
    started_at: booking.started_at || null,
    booking_items: (booking.booking_items || []).map((item) => ({
        item_key: item.item_key,
        sequence: item.sequence,
        status: item.status,
        actual_started_at: item.actual_started_at || null,
        countdown_ends_at: item.countdown_ends_at || null,
        actual_completed_at: item.actual_completed_at || null,
        remaining_seconds_at_pause:
            item.remaining_seconds_at_pause || null,
    })),
});

const getStaffMaps = ({ staffProfiles, garages }) => {
    const garageCodeById = new Map(garages.map((garage) => [
        toId(garage._id),
        garage.garage_code,
    ]));
    const profilesByGarageAndType = new Map();

    for (const profile of staffProfiles) {
        profilesByGarageAndType.set(
            `${toId(profile.garage_id)}:${profile.staff_type}`,
            profile
        );
    }

    const getProfile = (garageId, staffType) => {
        const profile = profilesByGarageAndType.get(
            `${toId(garageId)}:${staffType}`
        );

        if (!profile) {
            throw new Error(
                `Seed staff dependency is missing: ${garageCodeById.get(toId(garageId))}:${staffType}`
            );
        }

        return profile;
    };

    return {
        garageCodeById,
        profilesByGarageAndType,
        getProfile,
    };
};

const getLaterBookingCount = ({
    source,
    bookings,
}) => bookings.filter((booking) => (
    sameId(booking.customer_id, source.customer_id)
    && sameId(booking.garage_id, source.garage_id)
    && booking.created_at > source.completed_at
    && (
        (
            booking.status === BOOKING_STATUS.COMPLETED
            && booking.payment_status === BOOKING_PAYMENT_STATUS.PAID
        )
        || booking.status === BOOKING_STATUS.CONFIRMED
    )
)).length;

const getLaterConfirmedBookingCount = ({
    source,
    bookings,
}) => bookings.filter((booking) => (
    sameId(booking.customer_id, source.customer_id)
    && sameId(booking.garage_id, source.garage_id)
    && booking.created_at > source.completed_at
    && booking.status === BOOKING_STATUS.CONFIRMED
)).length;

const selectIncidentBookings = ({
    bookings,
    garages,
    existingIncidents,
    customerTierById,
}) => {
    const garageIds = garages
        .sort((left, right) => (
            left.garage_code.localeCompare(right.garage_code)
        ))
        .map((garage) => toId(garage._id));
    const selected = [];
    const selectedIds = new Set();
    const countByGarage = new Map(garageIds.map((garageId) => [
        garageId,
        0,
    ]));
    const add = (booking, kind) => {
        if (!booking || selectedIds.has(toId(booking._id))) {
            return false;
        }

        const garageId = toId(booking.garage_id);

        if ((countByGarage.get(garageId) || 0) >= 2) {
            return false;
        }

        selected.push({ booking, kind });
        selectedIds.add(toId(booking._id));
        countByGarage.set(garageId, countByGarage.get(garageId) + 1);

        return true;
    };
    const active = bookings
        .filter((booking) => (
            booking.status === BOOKING_STATUS.IN_PROGRESS
            && booking.customer_id
            && !booking.is_walk_in
        ))
        .sort((left, right) => (
            toId(left.garage_id).localeCompare(toId(right.garage_id))
            || toId(left._id).localeCompare(toId(right._id))
        ))[0];

    if (!add(active, 'ACTIVE')) {
        throw new Error('Active registered incident candidate is missing');
    }

    const canceled = bookings
        .filter((booking) => (
            booking.status === BOOKING_STATUS.CANCELED
            && booking.payment_status === BOOKING_PAYMENT_STATUS.UNPAID
        ))
        .sort((left, right) => (
            Number((right.used_points || 0) > 0)
                - Number((left.used_points || 0) > 0)
            || sortByTimeAndId(left, right, 'canceled_at')
        ));

    if (!add(canceled[0], 'CANCELED')) {
        throw new Error('Redeemed cancellation incident candidate is missing');
    }

    const secondCanceled = canceled.find((booking) => (
        !selectedIds.has(toId(booking._id))
        && !booking.is_walk_in
        && (countByGarage.get(toId(booking.garage_id)) || 0) < 2
        && !sameId(booking.garage_id, canceled[0].garage_id)
    )) || canceled.find((booking) => (
        !selectedIds.has(toId(booking._id))
        && !booking.is_walk_in
        && (countByGarage.get(toId(booking.garage_id)) || 0) < 2
    ));

    if (!add(secondCanceled, 'CANCELED')) {
        throw new Error('Second cancellation incident candidate is missing');
    }

    const walkInGarages = garageIds.filter((garageId) => (
        (countByGarage.get(garageId) || 0) < 2
        && bookings.some((booking) => (
            toId(booking.garage_id) === garageId
            && booking.is_walk_in
            && booking.status === BOOKING_STATUS.COMPLETED
            && booking.payment_status === BOOKING_PAYMENT_STATUS.PAID
            && !selectedIds.has(toId(booking._id))
        ))
    )).slice(0, 2);

    for (const garageId of walkInGarages) {
        const candidate = bookings
            .filter((booking) => (
                toId(booking.garage_id) === garageId
                && booking.is_walk_in
                && booking.status === BOOKING_STATUS.COMPLETED
                && booking.payment_status === BOOKING_PAYMENT_STATUS.PAID
                && !selectedIds.has(toId(booking._id))
            ))
            .sort((left, right) => (
                sortByTimeAndId(left, right, 'completed_at')
            ))[0];

        add(candidate, 'HISTORICAL');
    }

    for (const garageId of garageIds) {
        const needed = 2 - (countByGarage.get(garageId) || 0);
        const candidates = bookings
            .filter((booking) => (
                toId(booking.garage_id) === garageId
                && booking.customer_id
                && !booking.is_walk_in
                && booking.status === BOOKING_STATUS.COMPLETED
                && booking.payment_status === BOOKING_PAYMENT_STATUS.PAID
                && !selectedIds.has(toId(booking._id))
            ))
            .sort((left, right) => (
                Number(getLaterConfirmedBookingCount({
                    source: right,
                    bookings,
                }) > 0)
                    - Number(getLaterConfirmedBookingCount({
                        source: left,
                        bookings,
                    }) > 0)
                || Number(
                    customerTierById.get(toId(right.customer_id))
                    === 'BRONZE'
                ) - Number(
                    customerTierById.get(toId(left.customer_id))
                    === 'BRONZE'
                )
                || getLaterBookingCount({
                    source: right,
                    bookings,
                }) - getLaterBookingCount({
                    source: left,
                    bookings,
                })
                || sortByTimeAndId(left, right, 'completed_at')
            ));

        for (const candidate of candidates.slice(0, needed)) {
            add(candidate, 'HISTORICAL');
        }
    }

    if (
        selected.length !== INCIDENT_TARGETS.total
        || [...countByGarage.values()].some(
            (count) => count !== INCIDENT_TARGETS.per_garage
        )
    ) {
        throw new Error(
            `Incident booking selection mismatch: ${selected.length}`
        );
    }

    const walkInCount = selected.filter(
        ({ booking }) => booking.is_walk_in
    ).length;

    if (walkInCount !== 2) {
        throw new Error(
            `Incident walk-in selection mismatch: ${walkInCount}/2`
        );
    }

    const existingByBookingId = new Map(existingIncidents.map(
        (incident) => [toId(incident.booking_id), incident]
    ));

    return {
        selected,
        active,
        existingByBookingId,
    };
};

const getIncidentDescription = (incidentType) => ({
    [BOOKING_INCIDENT_TYPES.WASH_BAY_FAILURE]:
        'Buồng rửa gặp lỗi kỹ thuật trong lúc phục vụ và cần chuyển sang khu vực vận hành khác.',
    [BOOKING_INCIDENT_TYPES.STAFF_UNAVAILABLE]:
        'Nhân sự phụ trách đột xuất không thể tiếp tục ca làm việc và cần bố trí người thay thế.',
    [BOOKING_INCIDENT_TYPES.OTHER_GARAGE_INCIDENT]:
        'Garage gián đoạn vận hành tạm thời do sự cố nguồn điện nội bộ.',
})[incidentType];

const buildIncidentDefinitions = ({
    selection,
    bookings,
    washBays,
    staffMaps,
    referenceDate,
}) => {
    const activeDescriptor = selection.selected.find(
        ({ kind }) => kind === 'ACTIVE'
    );
    const canceledDescriptors = selection.selected
        .filter(({ kind }) => kind === 'CANCELED')
        .sort((left, right) => (
            Number((right.booking.used_points || 0) > 0)
                - Number((left.booking.used_points || 0) > 0)
            || sortByTimeAndId(
                left.booking,
                right.booking,
                'canceled_at'
            )
        ));
    const historicalDescriptors = selection.selected
        .filter(({ kind }) => kind === 'HISTORICAL')
        .sort((left, right) => (
            sortByTimeAndId(
                left.booking,
                right.booking,
                'completed_at'
            )
        ));
    const historicalTypes = [
        BOOKING_INCIDENT_TYPES.WASH_BAY_FAILURE,
        BOOKING_INCIDENT_TYPES.WASH_BAY_FAILURE,
        BOOKING_INCIDENT_TYPES.WASH_BAY_FAILURE,
        BOOKING_INCIDENT_TYPES.STAFF_UNAVAILABLE,
        BOOKING_INCIDENT_TYPES.STAFF_UNAVAILABLE,
        BOOKING_INCIDENT_TYPES.STAFF_UNAVAILABLE,
        BOOKING_INCIDENT_TYPES.STAFF_UNAVAILABLE,
    ];
    const historicalDecisions = [
        BOOKING_INCIDENT_DECISIONS.REASSIGN_AND_CONTINUE,
        BOOKING_INCIDENT_DECISIONS.REASSIGN_AND_CONTINUE,
        BOOKING_INCIDENT_DECISIONS.REASSIGN_AND_CONTINUE,
        BOOKING_INCIDENT_DECISIONS.RESCHEDULE_NEAREST,
        BOOKING_INCIDENT_DECISIONS.RESCHEDULE_NEAREST,
        BOOKING_INCIDENT_DECISIONS.RESCHEDULE_CUSTOM,
        BOOKING_INCIDENT_DECISIONS.RESCHEDULE_CUSTOM,
    ];
    const descriptors = [
        {
            ...activeDescriptor,
            incidentType: BOOKING_INCIDENT_TYPES.WASH_BAY_FAILURE,
            status: BOOKING_INCIDENT_STATUS.AWAITING_CUSTOMER_DECISION,
            decision: null,
        },
        ...canceledDescriptors.map((descriptor) => ({
            ...descriptor,
            incidentType: BOOKING_INCIDENT_TYPES.OTHER_GARAGE_INCIDENT,
            status: BOOKING_INCIDENT_STATUS.RESOLVED,
            decision: BOOKING_INCIDENT_DECISIONS.CANCEL_BY_GARAGE,
        })),
        ...historicalDescriptors.map((descriptor, index) => ({
            ...descriptor,
            incidentType: historicalTypes[index],
            status: BOOKING_INCIDENT_STATUS.RESOLVED,
            decision: historicalDecisions[index],
        })),
    ];
    const incidentDefinitions = [];
    const bookingUpdates = [];
    const washBayUpdates = [];

    for (const [index, descriptor] of descriptors.entries()) {
        const booking = descriptor.booking;
        const incidentId = deterministicId(
            'AUTOWASH_BOOKING_INCIDENT_V1',
            toId(booking._id)
        );
        const customerService = staffMaps.getProfile(
            booking.garage_id,
            STAFF_TYPES.CUSTOMER_SERVICE_STAFF
        );
        const washOperator = staffMaps.getProfile(
            booking.garage_id,
            STAFF_TYPES.WASH_OPERATOR
        );
        const reporter = descriptor.incidentType
            === BOOKING_INCIDENT_TYPES.WASH_BAY_FAILURE
            ? washOperator
            : customerService;
        const affectedItem = (booking.booking_items || [])[0] || null;
        let reportedAt;
        let resolvedAt = null;
        let reportedStatus;
        let originalStartTime = booking.start_time;
        let originalEndTime = booking.end_time;

        if (descriptor.kind === 'ACTIVE') {
            reportedAt = minDate(
                addMinutes(booking.started_at || booking.start_time, 5),
                addMinutes(referenceDate, -5)
            );
            reportedStatus = BOOKING_STATUS.IN_PROGRESS;
        } else if (descriptor.kind === 'CANCELED') {
            resolvedAt = booking.canceled_at;
            reportedAt = addMinutes(resolvedAt, -25);
            reportedStatus = BOOKING_STATUS.CONFIRMED;
        } else {
            const startedAt = booking.started_at || booking.start_time;
            const completedAt = booking.completed_at;
            const availableMinutes = Math.max(
                4,
                Math.floor(
                    (
                        new Date(completedAt).getTime()
                        - new Date(startedAt).getTime()
                    ) / 120000
                )
            );

            reportedAt = addMinutes(
                startedAt,
                Math.min(8, availableMinutes)
            );
            resolvedAt = minDate(
                addMinutes(reportedAt, 10),
                addMinutes(completedAt, -1)
            );
            reportedStatus = [
                BOOKING_INCIDENT_DECISIONS.RESCHEDULE_NEAREST,
                BOOKING_INCIDENT_DECISIONS.RESCHEDULE_CUSTOM,
            ].includes(descriptor.decision)
                ? BOOKING_STATUS.CONFIRMED
                : BOOKING_STATUS.IN_PROGRESS;

            if ([
                BOOKING_INCIDENT_DECISIONS.RESCHEDULE_NEAREST,
                BOOKING_INCIDENT_DECISIONS.RESCHEDULE_CUSTOM,
            ].includes(descriptor.decision)) {
                originalStartTime = addDays(booking.start_time, -1);
                originalEndTime = addDays(booking.end_time, -1);
            }
        }

        const existing = selection.existingByBookingId.get(
            toId(booking._id)
        );
        const fallbackWashBay = washBays
            .filter((washBay) => (
                sameId(washBay.garage_id, booking.garage_id)
                && washBay.vehicle_type === booking.vehicle_type
            ))
            .sort((left, right) => (
                left.bay_code.localeCompare(right.bay_code)
            ))[0];
        const affectedWashBayId =
            descriptor.incidentType
                === BOOKING_INCIDENT_TYPES.WASH_BAY_FAILURE
                ? booking.wash_bay_id
                    || existing?.affected_wash_bay_id
                    || fallbackWashBay?._id
                    || null
                : null;
        const affectedStaffProfile =
            descriptor.incidentType
                === BOOKING_INCIDENT_TYPES.STAFF_UNAVAILABLE
                ? washOperator
                : null;
        const customerDecision = Boolean(
            descriptor.status === BOOKING_INCIDENT_STATUS.RESOLVED
            && booking.customer_id
            && !booking.is_walk_in
            && index % 2 === 0
        );
        const decisionActorId = descriptor.status
            === BOOKING_INCIDENT_STATUS.RESOLVED
            ? customerDecision
                ? booking.customer_id
                : customerService.user_id
            : null;
        const decisionSource = descriptor.status
            === BOOKING_INCIDENT_STATUS.RESOLVED
            ? customerDecision
                ? BOOKING_INCIDENT_DECISION_SOURCES.CUSTOMER
                : BOOKING_INCIDENT_DECISION_SOURCES.STAFF_RECORDED
            : null;
        const contactChannel = descriptor.status
            === BOOKING_INCIDENT_STATUS.RESOLVED
            ? customerDecision
                ? BOOKING_INCIDENT_CONTACT_CHANNELS.APP
                : index % 3 === 0
                    ? BOOKING_INCIDENT_CONTACT_CHANNELS.IN_PERSON
                    : BOOKING_INCIDENT_CONTACT_CHANNELS.PHONE
            : null;
        const scheduleSnapshot = buildIncidentScheduleSnapshot({
            booking,
            startTime: originalStartTime,
            endTime: originalEndTime,
            reportedStatus,
        });
        const updatedAt = resolvedAt || reportedAt;

        incidentDefinitions.push({
            _id: incidentId,
            booking_id: booking._id,
            garage_id: booking.garage_id,
            customer_id: booking.customer_id || null,
            incident_type: descriptor.incidentType,
            description: getIncidentDescription(
                descriptor.incidentType
            ),
            status: descriptor.status,
            affected_booking_item_key:
                affectedItem?.item_key || null,
            affected_wash_bay_id: affectedWashBayId,
            affected_staff_profile_id:
                affectedStaffProfile?._id || null,
            reported_by_id: reporter.user_id,
            reported_booking_status: reportedStatus,
            reported_schedule_snapshot: scheduleSnapshot,
            countdown_paused_automatically:
                descriptor.kind === 'ACTIVE'
                && affectedItem?.status
                    !== BOOKING_ITEM_STATUS.PENDING,
            decision: descriptor.decision,
            decision_source: decisionSource,
            contact_channel: contactChannel,
            customer_note: descriptor.status
                === BOOKING_INCIDENT_STATUS.RESOLVED
                ? descriptor.decision
                    === BOOKING_INCIDENT_DECISIONS.CANCEL_BY_GARAGE
                        ? 'Khách hàng đồng ý hủy lịch do sự cố từ garage.'
                        : 'Khách hàng xác nhận phương án hỗ trợ của garage.'
                : null,
            new_start_time: [
                BOOKING_INCIDENT_DECISIONS.RESCHEDULE_NEAREST,
                BOOKING_INCIDENT_DECISIONS.RESCHEDULE_CUSTOM,
            ].includes(descriptor.decision)
                ? booking.start_time
                : null,
            continuation_policy:
                descriptor.decision
                === BOOKING_INCIDENT_DECISIONS.REASSIGN_AND_CONTINUE
                    ? BOOKING_INCIDENT_CONTINUATION_POLICIES.RESUME_REMAINING
                    : null,
            customer_confirmed_at: resolvedAt,
            decision_recorded_by_id: decisionActorId,
            resolved_at: resolvedAt,
            resolved_by_id: decisionActorId,
            compensation_voucher_ids: [],
            created_at: reportedAt,
            updated_at: updatedAt,
        });

        if (descriptor.kind === 'ACTIVE') {
            const bookingItems = (booking.booking_items || []).map(
                (item) => ({ ...item })
            );
            const currentItem = bookingItems.find((item) => (
                item.status === BOOKING_ITEM_STATUS.IN_PROGRESS
                || item.status === BOOKING_ITEM_STATUS.PAUSED
            ));

            if (!currentItem || !affectedWashBayId) {
                throw new Error(
                    `Active incident resource dependency is missing: ${booking._id}`
                );
            }

            const countdownEnd = currentItem.countdown_ends_at
                || addMinutes(
                    reportedAt,
                    Math.max(
                        1,
                        Math.ceil(
                            (
                                currentItem.remaining_seconds_at_pause
                                || 300
                            ) / 60
                        )
                    )
                );
            const remainingSeconds = Math.max(
                1,
                Math.ceil(
                    (
                        new Date(countdownEnd).getTime()
                        - reportedAt.getTime()
                    ) / 1000
                )
            );

            currentItem.status = BOOKING_ITEM_STATUS.PAUSED;
            currentItem.remaining_seconds_at_pause = remainingSeconds;
            currentItem.paused_at = reportedAt;
            currentItem.paused_by_staff_id = reporter.user_id;
            currentItem.pause_reason = 'GARAGE_INCIDENT';
            currentItem.countdown_ends_at = null;
            currentItem.timer_claimed_at = null;
            currentItem.timer_claim_token = null;

            bookingUpdates.push({
                booking_id: booking._id,
                operation_status:
                    BOOKING_OPERATION_STATUS.AWAITING_CUSTOMER_DECISION,
                active_incident_id: incidentId,
                wash_bay_id: null,
                booking_items: bookingItems,
                updated_at: maxDate(booking.updated_at, reportedAt),
            });
            washBayUpdates.push({
                wash_bay_id: affectedWashBayId,
                status: WASH_BAY_STATUS.MAINTENANCE,
                current_booking_id: null,
                updated_at: reportedAt,
            });
        }

        if (descriptor.kind === 'CANCELED') {
            bookingUpdates.push({
                booking_id: booking._id,
                operation_status: BOOKING_OPERATION_STATUS.NORMAL,
                active_incident_id: null,
                cancellation_source:
                    BOOKING_CANCELLATION_SOURCES.GARAGE_INCIDENT,
                cancellation_incident_id: incidentId,
                canceled_by_id: customerService.user_id,
                cancel_reason: 'Garage chủ động hủy lịch do sự cố vận hành.',
                updated_at: maxDate(
                    booking.updated_at,
                    resolvedAt
                ),
            });
        }

        if ([
            BOOKING_INCIDENT_DECISIONS.RESCHEDULE_NEAREST,
            BOOKING_INCIDENT_DECISIONS.RESCHEDULE_CUSTOM,
        ].includes(descriptor.decision)) {
            bookingUpdates.push({
                booking_id: booking._id,
                original_start_time: originalStartTime,
                original_end_time: originalEndTime,
                rescheduled_at: resolvedAt,
                rescheduled_by_id: decisionActorId,
                reschedule_reason: 'GARAGE_INCIDENT',
                reschedule_count: Math.max(
                    1,
                    booking.reschedule_count || 0
                ),
                updated_at: maxDate(
                    booking.updated_at,
                    resolvedAt
                ),
            });
        }
    }

    return {
        descriptors,
        incidentDefinitions,
        bookingUpdates,
        washBayUpdates,
    };
};

const takeEvenly = (items, count) => {
    if (count <= 0) {
        return [];
    }

    if (items.length < count) {
        throw new Error(
            `Even selection is incomplete: ${items.length}/${count}`
        );
    }

    if (count === 1) {
        return [items[Math.floor((items.length - 1) / 2)]];
    }

    const selected = [];
    const selectedIds = new Set();

    for (let index = 0; index < count; index += 1) {
        const candidateIndex = Math.round(
            index * (items.length - 1) / (count - 1)
        );
        let candidate = items[candidateIndex];

        if (selectedIds.has(toId(candidate._id))) {
            candidate = items.find(
                (item) => !selectedIds.has(toId(item._id))
            );
        }

        selected.push(candidate);
        selectedIds.add(toId(candidate._id));
    }

    return selected;
};

const selectCustomerCaseBookings = ({
    bookings,
    handoverDefinitions,
    garages,
}) => {
    const bookingById = new Map(bookings.map((booking) => [
        toId(booking._id),
        booking,
    ]));
    const handovers = handoverDefinitions.map((handover) => ({
        ...handover,
        _id: deterministicId(
            'AUTOWASH_BOOKING_HANDOVER_V1',
            toId(handover.booking_id)
        ),
        booking: bookingById.get(toId(handover.booking_id)),
    }));
    const sortedGarages = garages.sort((left, right) => (
        left.garage_code.localeCompare(right.garage_code)
    ));
    const targetsByGarageId = new Map(
        sortedGarages.map((garage, index) => [
            toId(garage._id),
            CUSTOMER_CASE_TARGETS.by_garage[index],
        ])
    );
    const selected = [];
    const selectedBookingIds = new Set();
    const countByGarage = new Map(
        sortedGarages.map((garage) => [toId(garage._id), 0])
    );
    const add = (handover, kind) => {
        if (
            !handover
            || !handover.booking
            || selectedBookingIds.has(toId(handover.booking_id))
        ) {
            return false;
        }

        const garageId = toId(handover.garage_id);
        const target = targetsByGarageId.get(garageId);

        if ((countByGarage.get(garageId) || 0) >= target) {
            return false;
        }

        selected.push({ handover, booking: handover.booking, kind });
        selectedBookingIds.add(toId(handover.booking_id));
        countByGarage.set(garageId, countByGarage.get(garageId) + 1);

        return true;
    };
    const safetyHandover = handovers
        .filter((handover) => (
            handover.state === BOOKING_HANDOVER_STATES.READY_FOR_CUSTOMER
            && handover.booking.customer_id
            && !handover.booking.is_walk_in
        ))
        .sort((left, right) => (
            sortByTimeAndId(
                left.booking,
                right.booking,
                'completed_at'
            )
        ))[0];

    if (!add(safetyHandover, 'SAFETY_HANDOVER')) {
        throw new Error('Safety handover case candidate is missing');
    }

    let walkInNeeded = CUSTOMER_CASE_TARGETS.walk_in;

    for (const garage of sortedGarages) {
        if (walkInNeeded <= 0) {
            break;
        }

        const garageId = toId(garage._id);

        if (
            (countByGarage.get(garageId) || 0)
            >= targetsByGarageId.get(garageId)
        ) {
            continue;
        }

        const candidate = handovers
            .filter((handover) => (
                toId(handover.garage_id) === garageId
                && handover.state === BOOKING_HANDOVER_STATES.RELEASED
                && handover.booking.is_walk_in
                && !selectedBookingIds.has(toId(handover.booking_id))
            ))
            .sort((left, right) => (
                sortByTimeAndId(
                    left.booking,
                    right.booking,
                    'completed_at'
                )
            ))[0];

        if (add(candidate, 'WALK_IN')) {
            walkInNeeded -= 1;
        }
    }

    if (walkInNeeded !== 0) {
        throw new Error(
            `Walk-in customer case selection is incomplete: ${walkInNeeded}`
        );
    }

    for (const garage of sortedGarages) {
        const garageId = toId(garage._id);
        const needed = (
            targetsByGarageId.get(garageId)
            - (countByGarage.get(garageId) || 0)
        );
        const candidates = handovers
            .filter((handover) => (
                toId(handover.garage_id) === garageId
                && handover.state === BOOKING_HANDOVER_STATES.RELEASED
                && handover.booking.customer_id
                && !handover.booking.is_walk_in
                && !selectedBookingIds.has(toId(handover.booking_id))
            ))
            .sort((left, right) => (
                sortByTimeAndId(
                    left.booking,
                    right.booking,
                    'completed_at'
                )
            ));

        for (const candidate of takeEvenly(candidates, needed)) {
            add(candidate, 'REGISTERED');
        }
    }

    const registered = selected.filter(
        ({ booking }) => booking.customer_id && !booking.is_walk_in
    ).length;
    const walkIn = selected.filter(
        ({ booking }) => booking.is_walk_in
    ).length;

    if (
        selected.length !== CUSTOMER_CASE_TARGETS.total
        || registered !== CUSTOMER_CASE_TARGETS.registered
        || walkIn !== CUSTOMER_CASE_TARGETS.walk_in
        || [...countByGarage.entries()].some(
            ([garageId, count]) => (
                count !== targetsByGarageId.get(garageId)
            )
        )
    ) {
        throw new Error(
            `Customer case booking selection mismatch: ${selected.length}:${registered}:${walkIn}`
        );
    }

    const safety = selected.find(
        ({ kind }) => kind === 'SAFETY_HANDOVER'
    );
    const historical = selected
        .filter(({ kind }) => kind !== 'SAFETY_HANDOVER')
        .sort((left, right) => (
            sortByTimeAndId(
                left.booking,
                right.booking,
                'completed_at'
            )
        ));
    const walkInHistorical = historical.filter(
        ({ booking }) => booking.is_walk_in
    );
    const registeredHistorical = historical.filter(
        ({ booking }) => !booking.is_walk_in
    );
    const walkInIndexes = new Set([2, 5, 11]);
    const ordered = [];

    for (let index = 0; index < 17; index += 1) {
        ordered.push(
            walkInIndexes.has(index)
                ? walkInHistorical.shift()
                : registeredHistorical.shift()
        );
    }

    if (
        ordered.some((item) => !item)
        || walkInHistorical.length
        || registeredHistorical.length
    ) {
        throw new Error('Customer case lifecycle ordering is incomplete');
    }

    return [...ordered, safety];
};

const getCaseText = (category) => ({
    [CUSTOMER_CASE_CATEGORIES.VEHICLE_DAMAGE]: {
        description:
            'Khách hàng phát hiện một vết xước mới trên thân xe sau khi hoàn tất dịch vụ.',
        damage_location: 'Khu vực cửa bên trái và phần ốp gần bánh trước.',
        desired_resolution:
            'Đề nghị garage đối chiếu ảnh kiểm tra trước và sau khi rửa.',
    },
    [CUSTOMER_CASE_CATEGORIES.MISSING_PROPERTY]: {
        description:
            'Khách hàng phản ánh một vật dụng nhỏ trong xe không còn ở vị trí ban đầu.',
        damage_location: null,
        desired_resolution:
            'Đề nghị kiểm tra khu vực làm việc và trao đổi với nhân sự phụ trách.',
    },
    [CUSTOMER_CASE_CATEGORIES.SERVICE_QUALITY]: {
        description:
            'Một số vị trí trên xe vẫn còn vệt nước và bụi sau khi hoàn tất gói dịch vụ.',
        damage_location: 'Khu vực kính, gương và phần thân xe phía sau.',
        desired_resolution:
            'Đề nghị kiểm tra chất lượng và có phương án hỗ trợ phù hợp.',
    },
    [CUSTOMER_CASE_CATEGORIES.SERVICE_INCOMPLETE]: {
        description:
            'Khách hàng nhận thấy một hạng mục trong gói dịch vụ chưa được thực hiện đầy đủ.',
        damage_location: null,
        desired_resolution:
            'Đề nghị xác minh service steps và hoàn thiện hạng mục còn thiếu.',
    },
    [CUSTOMER_CASE_CATEGORIES.BILLING_PAYMENT]: {
        description:
            'Khách hàng cần garage kiểm tra lại số tiền giảm giá và số tiền đã thanh toán.',
        damage_location: null,
        desired_resolution:
            'Đề nghị đối chiếu booking, ưu đãi và giao dịch thanh toán.',
    },
    [CUSTOMER_CASE_CATEGORIES.STAFF_CONDUCT]: {
        description:
            'Khách hàng phản ánh cách trao đổi của nhân viên chưa rõ ràng trong quá trình bàn giao.',
        damage_location: null,
        desired_resolution:
            'Đề nghị garage xác minh và phản hồi chính thức.',
    },
    [CUSTOMER_CASE_CATEGORIES.SAFETY_CONCERN]: {
        description:
            'Khách hàng phát hiện dấu hiệu bất thường và chưa đồng ý nhận xe vì lo ngại an toàn.',
        damage_location: 'Khu vực bánh xe và phần gầm gần vị trí vệ sinh.',
        desired_resolution:
            'Giữ xe tại garage và kiểm tra kỹ thuật trước khi bàn giao.',
    },
    [CUSTOMER_CASE_CATEGORIES.OTHER]: {
        description:
            'Khách hàng cần garage làm rõ một vấn đề phát sinh sau dịch vụ.',
        damage_location: null,
        desired_resolution:
            'Đề nghị nhân viên liên hệ để xác minh thêm thông tin.',
    },
})[category];

const buildBookingSnapshot = (booking) => ({
    booking_id: booking._id,
    garage_id: booking.garage_id,
    customer_id: booking.customer_id || null,
    vehicle_id: booking.vehicle_id || null,
    service_package_id: booking.service_package_id,
    vehicle_type: booking.vehicle_type,
    start_time: booking.start_time,
    completed_at: booking.completed_at,
    paid_at: booking.paid_at || null,
    original_price: booking.original_price,
    discount_amount: booking.discount_amount,
    final_price: booking.final_price,
    payment_status: booking.payment_status,
    license_plate:
        booking.normalized_license_plate
        || booking.license_plate
        || null,
});

const buildCustomerCaseDefinitions = ({
    selectedCases,
    staffMaps,
    admins,
    referenceDate,
}) => {
    const definitions = [];

    for (const [index, selected] of selectedCases.entries()) {
        const booking = selected.booking;
        const handover = selected.handover;
        const category = CUSTOMER_CASE_CATEGORY_SEQUENCE[index];
        const status = CUSTOMER_CASE_STATUS_SEQUENCE[index];
        const priority = getCustomerCasePriority(category);
        const customerService = staffMaps.getProfile(
            booking.garage_id,
            STAFF_TYPES.CUSTOMER_SERVICE_STAFF
        );
        const admin = admins[index % admins.length];
        const caseId = deterministicId(
            'AUTOWASH_CUSTOMER_CASE_V1',
            `${toId(booking._id)}:${category}`
        );
        const handoverTime =
            handover.released_at
            || handover.ready_at
            || booking.completed_at;
        const createdAt = addMinutes(handoverTime, 15 + index % 4);
        const discoveredAt = addMinutes(handoverTime, 5 + index % 3);
        const assignedAt = status === CUSTOMER_CASE_STATUSES.SUBMITTED
            ? null
            : addMinutes(createdAt, 20);
        const acknowledgedAt = status === CUSTOMER_CASE_STATUSES.SUBMITTED
            ? null
            : addMinutes(createdAt, 40);
        const firstResponseMinutes = {
            CRITICAL: 15,
            HIGH: 120,
            NORMAL: 240,
        }[priority];
        const resolutionMinutes = {
            CRITICAL: 240,
            HIGH: 1440,
            NORMAL: 4320,
        }[priority];
        let firstResponseDueAt = addMinutes(
            createdAt,
            firstResponseMinutes
        );
        let resolutionDueAt = addMinutes(
            createdAt,
            resolutionMinutes
        );
        let firstResponseBreachedAt = null;
        let resolutionBreachedAt = null;
        let escalationLevel = 0;
        let escalatedAt = null;
        let reopenedAt = null;
        let resolvedAt = null;
        let closedAt = null;
        let liabilityStatus =
            CUSTOMER_CASE_LIABILITY_STATUSES.UNDETERMINED;
        let conclusion = null;
        let resolutionSummary = null;
        let updatedAt = acknowledgedAt || createdAt;
        const reopened = index === 7;
        const escalated = [10, 14].includes(index);

        if ([
            CUSTOMER_CASE_STATUSES.RESOLVED,
            CUSTOMER_CASE_STATUSES.CLOSED,
        ].includes(status)) {
            resolvedAt = addMinutes(createdAt, 360 + index * 10);
            liabilityStatus = index % 3 === 0
                ? CUSTOMER_CASE_LIABILITY_STATUSES.GARAGE_RESPONSIBLE
                : index % 3 === 1
                    ? CUSTOMER_CASE_LIABILITY_STATUSES.PRE_EXISTING_DAMAGE
                    : CUSTOMER_CASE_LIABILITY_STATUSES.INCONCLUSIVE;
            conclusion =
                'Garage đã đối chiếu booking, inspection và trao đổi với các bên liên quan.';
            resolutionSummary =
                'Phương án xử lý đã được khách hàng xác nhận và được admin áp dụng.';
            updatedAt = resolvedAt;

            if (status === CUSTOMER_CASE_STATUSES.CLOSED) {
                closedAt = addMinutes(resolvedAt, 180);
                updatedAt = closedAt;
            }
        }

        if (reopened) {
            const previousResolvedAt = addMinutes(createdAt, 360);

            reopenedAt = minDate(
                addDays(previousResolvedAt, 1),
                addMinutes(referenceDate, -120)
            );
            resolutionDueAt = addMinutes(
                reopenedAt,
                resolutionMinutes
            );
            firstResponseDueAt = addMinutes(
                createdAt,
                firstResponseMinutes
            );
            updatedAt = reopenedAt;
        }

        if (escalated) {
            resolutionBreachedAt = minDate(
                addMinutes(resolutionDueAt, 1),
                addMinutes(referenceDate, -30)
            );
            escalatedAt = resolutionBreachedAt;
            escalationLevel = 1;
            updatedAt = maxDate(updatedAt, escalatedAt);
        }

        const text = getCaseText(category);
        const open = [
            CUSTOMER_CASE_STATUSES.SUBMITTED,
            CUSTOMER_CASE_STATUSES.ACKNOWLEDGED,
            CUSTOMER_CASE_STATUSES.INVESTIGATING,
        ].includes(status);

        definitions.push({
            _id: caseId,
            case_code: `CASE${referenceDate.getUTCFullYear()}${toId(caseId).slice(-10).toUpperCase()}`,
            booking_id: booking._id,
            handover_id: handover._id,
            garage_id: booking.garage_id,
            customer_id: booking.customer_id || null,
            vehicle_id: booking.vehicle_id || null,
            is_walk_in_case: Boolean(booking.is_walk_in),
            reporter_name: booking.is_walk_in
                ? booking.guest_name || 'Khách vãng lai'
                : null,
            reporter_phone: booking.is_walk_in
                ? booking.normalized_guest_phone
                    || booking.guest_phone
                : null,
            created_by_staff_id: booking.is_walk_in
                ? customerService.user_id
                : null,
            category,
            priority,
            priority_rank: getCustomerCasePriorityRank(priority),
            open_dedupe_key: open
                ? `${toId(booking._id)}:${category}`
                : null,
            source: selected.kind === 'SAFETY_HANDOVER'
                ? CUSTOMER_CASE_SOURCES.HANDOVER
                : CUSTOMER_CASE_SOURCES.AFTER_HANDOVER,
            status,
            description: text.description,
            damage_location: text.damage_location,
            desired_resolution: text.desired_resolution,
            discovered_at: discoveredAt,
            vehicle_received:
                selected.kind !== 'SAFETY_HANDOVER',
            upload_ids: [],
            booking_snapshot: buildBookingSnapshot(booking),
            inspection_snapshot: handover.inspection_snapshot || {},
            assigned_to_id: assignedAt
                ? customerService.user_id
                : null,
            assigned_by_id: assignedAt ? admin._id : null,
            assigned_at: assignedAt,
            acknowledged_by_id: acknowledgedAt
                ? customerService.user_id
                : null,
            acknowledged_at: acknowledgedAt,
            first_response_due_at: firstResponseDueAt,
            resolution_due_at: resolutionDueAt,
            first_response_breached_at: firstResponseBreachedAt,
            resolution_breached_at: resolutionBreachedAt,
            escalation_level: escalationLevel,
            escalated_at: escalatedAt,
            reopen_count: reopened ? 1 : 0,
            last_reopened_at: reopenedAt,
            last_reopened_by_id: reopened
                ? booking.customer_id || admin._id
                : null,
            last_reopen_reason: reopened
                ? 'Vấn đề xuất hiện lại sau khi áp dụng phương án hỗ trợ trước đó.'
                : null,
            liability_status: reopened
                ? CUSTOMER_CASE_LIABILITY_STATUSES.UNDETERMINED
                : liabilityStatus,
            conclusion: reopened ? null : conclusion,
            resolution_summary: reopened
                ? null
                : resolutionSummary,
            resolved_by_id: resolvedAt && !reopened
                ? admin._id
                : null,
            resolved_at: reopened ? null : resolvedAt,
            closed_by_id: closedAt && !reopened
                ? admin._id
                : null,
            closed_at: reopened ? null : closedAt,
            created_at: createdAt,
            updated_at: updatedAt,
            seed_index: index,
            seed_admin_id: admin._id,
            seed_customer_service_user_id: customerService.user_id,
            seed_reopened_at: reopenedAt,
        });
    }

    return definitions;
};

const buildCustomerCaseMessages = ({
    customerCases,
}) => {
    const definitions = [];

    for (const customerCase of customerCases) {
        const messageCount = customerCase.seed_index < 12 ? 2 : 1;

        for (let index = 0; index < messageCount; index += 1) {
            const customerSender = Boolean(
                customerCase.customer_id
                && index % 2 === 0
            );
            const senderId = customerSender
                ? customerCase.customer_id
                : customerCase.seed_customer_service_user_id;
            const senderRole = customerSender
                ? USER_ROLES.CUSTOMER
                : USER_ROLES.STAFF;
            const createdAt = addMinutes(
                customerCase.created_at,
                55 + index * 25
            );

            definitions.push({
                _id: deterministicId(
                    'AUTOWASH_CUSTOMER_CASE_MESSAGE_V1',
                    `${toId(customerCase._id)}:${index + 1}`
                ),
                case_id: customerCase._id,
                sender_id: senderId,
                sender_role: senderRole,
                message: customerSender
                    ? 'Tôi đã cung cấp thông tin và mong garage kiểm tra giúp tình trạng này.'
                    : 'Garage đã tiếp nhận thông tin và đang đối chiếu hồ sơ dịch vụ liên quan.',
                upload_ids: [],
                created_at: createdAt,
            });
        }
    }

    if (
        definitions.length
        !== CUSTOMER_CASE_DEPENDENT_TARGETS.messages
    ) {
        throw new Error(
            `Customer case message target mismatch: ${definitions.length}`
        );
    }

    return definitions;
};

const isTechnicalCaseCategory = (category) => [
    CUSTOMER_CASE_CATEGORIES.VEHICLE_DAMAGE,
    CUSTOMER_CASE_CATEGORIES.SERVICE_QUALITY,
    CUSTOMER_CASE_CATEGORIES.SERVICE_INCOMPLETE,
    CUSTOMER_CASE_CATEGORIES.SAFETY_CONCERN,
].includes(category);

const buildTechnicalAssessmentDefinitions = ({
    customerCases,
    staffMaps,
}) => {
    const candidates = customerCases.filter((customerCase) => (
        isTechnicalCaseCategory(customerCase.category)
        && customerCase.status !== CUSTOMER_CASE_STATUSES.SUBMITTED
    ));

    if (
        candidates.length
        !== CUSTOMER_CASE_DEPENDENT_TARGETS.technical_assessments
    ) {
        throw new Error(
            `Technical assessment candidate mismatch: ${candidates.length}`
        );
    }

    return candidates.map((customerCase, index) => {
        const inspector = staffMaps.getProfile(
            customerCase.garage_id,
            STAFF_TYPES.VEHICLE_INSPECTION_STAFF
        );
        const status = index < 6
            ? CUSTOMER_CASE_TECHNICAL_ASSESSMENT_STATUSES.SUBMITTED
            : index < 8
                ? CUSTOMER_CASE_TECHNICAL_ASSESSMENT_STATUSES.IN_PROGRESS
                : CUSTOMER_CASE_TECHNICAL_ASSESSMENT_STATUSES.ASSIGNED;
        const assignedAt = addMinutes(
            customerCase.acknowledged_at
                || customerCase.created_at,
            25
        );
        const startedAt = status
            === CUSTOMER_CASE_TECHNICAL_ASSESSMENT_STATUSES.ASSIGNED
            ? null
            : addMinutes(assignedAt, 20);
        const submittedAt = status
            === CUSTOMER_CASE_TECHNICAL_ASSESSMENT_STATUSES.SUBMITTED
            ? addMinutes(startedAt, 45)
            : null;
        const updatedAt = submittedAt || startedAt || assignedAt;

        return {
            _id: deterministicId(
                'AUTOWASH_CUSTOMER_CASE_ASSESSMENT_V1',
                toId(customerCase._id)
            ),
            case_id: customerCase._id,
            garage_id: customerCase.garage_id,
            inspector_staff_profile_id: inspector._id,
            inspector_user_id: inspector.user_id,
            assigned_by_id:
                customerCase.seed_customer_service_user_id,
            assigned_at: assignedAt,
            status,
            started_at: startedAt,
            findings: submittedAt
                ? 'Đã đối chiếu ảnh trước và sau dịch vụ cùng lịch sử thao tác của booking.'
                : null,
            root_cause: submittedAt
                ? customerCase.category
                    === CUSTOMER_CASE_CATEGORIES.VEHICLE_DAMAGE
                        ? 'Chưa đủ cơ sở kết luận vết xước phát sinh trong quá trình rửa.'
                        : 'Quy trình kiểm tra cuối chưa phát hiện đầy đủ vấn đề khách hàng phản ánh.'
                : null,
            severity: submittedAt
                ? customerCase.priority === 'CRITICAL'
                    ? 'SAFETY_CRITICAL'
                    : customerCase.priority === 'HIGH'
                        ? 'MODERATE'
                        : 'MINOR'
                : null,
            recommended_resolution: submittedAt
                ? 'Đề nghị quản lý xem xét hồ sơ và đưa ra phương án hỗ trợ phù hợp.'
                : null,
            upload_ids: [],
            submitted_at: submittedAt,
            created_at: assignedAt,
            updated_at: updatedAt,
        };
    });
};

const getCaseVoucherAction = ({
    customerCase,
    booking,
}) => {
    const configs = {
        0: {
            voucher_type: CUSTOMER_VOUCHER_TYPES.FIXED_AMOUNT,
            value: 70000,
            max_discount_amount: null,
            min_order_amount: 100000,
            service_package_id: null,
        },
        3: {
            voucher_type: CUSTOMER_VOUCHER_TYPES.PERCENTAGE,
            value: 15,
            max_discount_amount: 100000,
            min_order_amount: 150000,
            service_package_id: null,
        },
        4: {
            voucher_type: CUSTOMER_VOUCHER_TYPES.FREE_SERVICE,
            value: 0,
            max_discount_amount: null,
            min_order_amount: 0,
            service_package_id: booking.service_package_id,
        },
        7: {
            voucher_type: CUSTOMER_VOUCHER_TYPES.FIXED_AMOUNT,
            value: 60000,
            max_discount_amount: null,
            min_order_amount: 100000,
            service_package_id: null,
        },
    };
    const config = configs[customerCase.seed_index];

    if (!config) {
        return null;
    }

    return {
        action_type: CUSTOMER_CASE_RESOLUTION_ACTION_TYPES.VOUCHER,
        ...config,
        expires_at: customerCase.seed_index === 4
            ? addDays(customerCase.created_at, 2)
            : addDays(customerCase.created_at, 90),
        rework_start_time: null,
        amount: null,
        refund_method: null,
        note: 'Voucher hỗ trợ sau khi xử lý customer case.',
    };
};

const getCaseRefundAction = ({
    customerCase,
    booking,
}) => {
    const methodByIndex = {
        1: CUSTOMER_CASE_REFUND_METHODS.CASH,
        3: CUSTOMER_CASE_REFUND_METHODS.BANK_TRANSFER,
        5: CUSTOMER_CASE_REFUND_METHODS.ORIGINAL_PAYMENT,
        6: CUSTOMER_CASE_REFUND_METHODS.CASH,
    };
    const method = methodByIndex[customerCase.seed_index];

    if (!method) {
        return null;
    }

    return {
        action_type: CUSTOMER_CASE_RESOLUTION_ACTION_TYPES.REFUND,
        amount: Math.max(
            20000,
            Math.min(
                100000,
                Math.floor((booking.final_price || 100000) * 0.25)
            )
        ),
        refund_method: method,
        voucher_type: null,
        value: null,
        max_discount_amount: null,
        min_order_amount: 0,
        service_package_id: null,
        expires_at: null,
        rework_start_time: null,
        note: 'Hoàn tiền một phần theo kết quả xử lý customer case.',
    };
};

const withActionIds = (resolutionId, actions) => actions.map(
    (action, index) => ({
        _id: deterministicId(
            'AUTOWASH_CUSTOMER_CASE_RESOLUTION_ACTION_V1',
            `${toId(resolutionId)}:${index + 1}`
        ),
        ...action,
    })
);

const buildResolutionDefinitions = ({
    customerCases,
    bookingById,
    referenceDate,
}) => {
    const definitions = [];
    const addResolution = ({
        customerCase,
        version,
        status,
        actions,
        proposedAt,
        respondedAt = null,
        appliedAt = null,
    }) => {
        const resolutionId = deterministicId(
            'AUTOWASH_CUSTOMER_CASE_RESOLUTION_V1',
            `${toId(customerCase._id)}:${version}`
        );
        const responseActorId = customerCase.customer_id
            || customerCase.seed_customer_service_user_id;
        const refundAction = actions.find((action) => (
            action.action_type
            === CUSTOMER_CASE_RESOLUTION_ACTION_TYPES.REFUND
        ));
        const voucherAction = actions.find((action) => (
            action.action_type
            === CUSTOMER_CASE_RESOLUTION_ACTION_TYPES.VOUCHER
        ));

        definitions.push({
            _id: resolutionId,
            case_id: customerCase._id,
            version,
            status,
            summary:
                'Phương án được đề xuất dựa trên booking, inspection và kết quả xác minh.',
            actions: withActionIds(resolutionId, actions),
            proposed_by_id: customerCase.seed_admin_id,
            proposed_at: proposedAt,
            customer_responded_by_id: respondedAt
                ? responseActorId
                : null,
            customer_response_note: respondedAt
                ? status === CUSTOMER_CASE_RESOLUTION_STATUSES.CUSTOMER_REJECTED
                    ? 'Khách hàng chưa đồng ý và đề nghị xem xét phương án khác.'
                    : 'Khách hàng đồng ý với phương án garage đề xuất.'
                : null,
            customer_responded_at: respondedAt,
            applied_by_id: appliedAt
                ? customerCase.seed_admin_id
                : null,
            applied_at: appliedAt,
            failure_reason: null,
            refund_ids: refundAction
                && status === CUSTOMER_CASE_RESOLUTION_STATUSES.APPLIED
                ? [
                    deterministicId(
                        'AUTOWASH_CUSTOMER_CASE_REFUND_V1',
                        toId(resolutionId)
                    ),
                ]
                : [],
            voucher_ids: voucherAction
                && status === CUSTOMER_CASE_RESOLUTION_STATUSES.APPLIED
                ? [
                    deterministicId(
                        'AUTOWASH_CUSTOMER_CASE_VOUCHER_V1',
                        toId(resolutionId)
                    ),
                ]
                : [],
            rework_booking_ids: [],
            created_at: proposedAt,
            updated_at: appliedAt || respondedAt || proposedAt,
        });
    };

    for (const customerCase of customerCases) {
        const booking = bookingById.get(toId(customerCase.booking_id));

        if (customerCase.seed_index === 0) {
            addResolution({
                customerCase,
                version: 1,
                status:
                    CUSTOMER_CASE_RESOLUTION_STATUSES.SUPERSEDED,
                actions: [{
                    action_type:
                        CUSTOMER_CASE_RESOLUTION_ACTION_TYPES.NO_COMPENSATION,
                    amount: null,
                    refund_method: null,
                    voucher_type: null,
                    value: null,
                    max_discount_amount: null,
                    min_order_amount: 0,
                    service_package_id: null,
                    expires_at: null,
                    rework_start_time: null,
                    note: 'Đề xuất ban đầu được thay thế sau khi bổ sung kết quả xác minh.',
                }],
                proposedAt: addMinutes(customerCase.created_at, 120),
            });
        }

        if (customerCase.seed_index <= 7) {
            const version = customerCase.seed_index === 0 ? 2 : 1;
            const proposedAt = addMinutes(
                customerCase.created_at,
                customerCase.seed_index === 0 ? 180 : 150
            );
            const respondedAt = addMinutes(proposedAt, 35);
            const appliedAt = addMinutes(respondedAt, 25);
            const voucherAction = getCaseVoucherAction({
                customerCase,
                booking,
            });
            const refundAction = getCaseRefundAction({
                customerCase,
                booking,
            });
            const actions = [
                voucherAction,
                refundAction,
            ].filter(Boolean);

            if (actions.length === 0) {
                actions.push({
                    action_type:
                        CUSTOMER_CASE_RESOLUTION_ACTION_TYPES.NO_COMPENSATION,
                    amount: null,
                    refund_method: null,
                    voucher_type: null,
                    value: null,
                    max_discount_amount: null,
                    min_order_amount: 0,
                    service_package_id: null,
                    expires_at: null,
                    rework_start_time: null,
                    note: 'Kết quả xác minh không phát sinh nghĩa vụ bồi thường.',
                });
            }

            addResolution({
                customerCase,
                version,
                status: CUSTOMER_CASE_RESOLUTION_STATUSES.APPLIED,
                actions,
                proposedAt,
                respondedAt,
                appliedAt,
            });
        }
    }

    const openResolutionCases = customerCases.filter(
        (customerCase) => [8, 10, 11].includes(customerCase.seed_index)
    );

    for (const customerCase of openResolutionCases) {
        const booking = bookingById.get(toId(customerCase.booking_id));
        const proposedAt = addMinutes(customerCase.created_at, 180);

        if (customerCase.seed_index === 8) {
            addResolution({
                customerCase,
                version: 1,
                status: CUSTOMER_CASE_RESOLUTION_STATUSES.PROPOSED,
                actions: [{
                    action_type:
                        CUSTOMER_CASE_RESOLUTION_ACTION_TYPES.REWORK,
                    amount: null,
                    refund_method: null,
                    voucher_type: null,
                    value: null,
                    max_discount_amount: null,
                    min_order_amount: 0,
                    service_package_id: null,
                    expires_at: null,
                    rework_start_time: addDays(referenceDate, 2),
                    note: 'Đề xuất thực hiện lại hạng mục chưa đạt yêu cầu.',
                }],
                proposedAt,
            });
        }

        if (customerCase.seed_index === 10) {
            addResolution({
                customerCase,
                version: 1,
                status:
                    CUSTOMER_CASE_RESOLUTION_STATUSES.CUSTOMER_ACCEPTED,
                actions: [{
                    action_type:
                        CUSTOMER_CASE_RESOLUTION_ACTION_TYPES.REFUND,
                    amount: Math.max(
                        20000,
                        Math.min(
                            80000,
                            Math.floor(booking.final_price * 0.2)
                        )
                    ),
                    refund_method:
                        CUSTOMER_CASE_REFUND_METHODS.BANK_TRANSFER,
                    voucher_type: null,
                    value: null,
                    max_discount_amount: null,
                    min_order_amount: 0,
                    service_package_id: null,
                    expires_at: null,
                    rework_start_time: null,
                    note: 'Chờ admin áp dụng phương án hoàn tiền.',
                }],
                proposedAt,
                respondedAt: addMinutes(proposedAt, 30),
            });
        }

        if (customerCase.seed_index === 11) {
            addResolution({
                customerCase,
                version: 1,
                status:
                    CUSTOMER_CASE_RESOLUTION_STATUSES.CUSTOMER_REJECTED,
                actions: [{
                    action_type:
                        CUSTOMER_CASE_RESOLUTION_ACTION_TYPES.NO_COMPENSATION,
                    amount: null,
                    refund_method: null,
                    voucher_type: null,
                    value: null,
                    max_discount_amount: null,
                    min_order_amount: 0,
                    service_package_id: null,
                    expires_at: null,
                    rework_start_time: null,
                    note: 'Khách hàng đề nghị garage tiếp tục xác minh trước khi kết luận.',
                }],
                proposedAt,
                respondedAt: addMinutes(proposedAt, 30),
            });
        }
    }

    if (
        definitions.length
        !== CUSTOMER_CASE_DEPENDENT_TARGETS.resolutions
    ) {
        throw new Error(
            `Customer case resolution target mismatch: ${definitions.length}`
        );
    }

    return definitions;
};

const buildRefundDefinitions = ({
    resolutions,
    customerCaseById,
    bookingById,
}) => {
    const appliedWithRefund = resolutions.filter((resolution) => (
        resolution.status === CUSTOMER_CASE_RESOLUTION_STATUSES.APPLIED
        && resolution.actions.some((action) => (
            action.action_type
            === CUSTOMER_CASE_RESOLUTION_ACTION_TYPES.REFUND
        ))
    ));
    const statuses = [
        CUSTOMER_CASE_REFUND_STATUSES.COMPLETED,
        CUSTOMER_CASE_REFUND_STATUSES.COMPLETED,
        CUSTOMER_CASE_REFUND_STATUSES.PROCESSING,
        CUSTOMER_CASE_REFUND_STATUSES.FAILED,
    ];

    if (
        appliedWithRefund.length
        !== CUSTOMER_CASE_DEPENDENT_TARGETS.refunds
    ) {
        throw new Error(
            `Customer case refund candidate mismatch: ${appliedWithRefund.length}`
        );
    }

    return appliedWithRefund.map((resolution, index) => {
        const customerCase = customerCaseById.get(
            toId(resolution.case_id)
        );
        const booking = bookingById.get(toId(customerCase.booking_id));
        const action = resolution.actions.find((item) => (
            item.action_type
            === CUSTOMER_CASE_RESOLUTION_ACTION_TYPES.REFUND
        ));
        const status = statuses[index];
        const approvedAt = resolution.applied_at;
        const processedAt = status === CUSTOMER_CASE_REFUND_STATUSES.COMPLETED
            || status === CUSTOMER_CASE_REFUND_STATUSES.FAILED
            ? addMinutes(approvedAt, 90)
            : status === CUSTOMER_CASE_REFUND_STATUSES.PROCESSING
                ? addMinutes(approvedAt, 30)
                : null;

        return {
            _id: deterministicId(
                'AUTOWASH_CUSTOMER_CASE_REFUND_V1',
                toId(resolution._id)
            ),
            case_id: customerCase._id,
            resolution_id: resolution._id,
            booking_id: booking._id,
            amount: action.amount,
            method: action.refund_method,
            status,
            approved_by_id: customerCase.seed_admin_id,
            approved_at: approvedAt,
            processed_by_id: processedAt
                ? customerCase.seed_admin_id
                : null,
            processed_at: processedAt,
            transaction_reference:
                status === CUSTOMER_CASE_REFUND_STATUSES.COMPLETED
                    ? `CASE-REFUND-${toId(resolution._id).slice(-10).toUpperCase()}`
                    : null,
            note: status === CUSTOMER_CASE_REFUND_STATUSES.PROCESSING
                ? 'Khoản hoàn tiền đang được đối soát trước khi chuyển cho khách hàng.'
                : null,
            failure_reason:
                status === CUSTOMER_CASE_REFUND_STATUSES.FAILED
                    ? 'Thông tin tài khoản nhận tiền chưa hợp lệ.'
                    : null,
            created_at: approvedAt,
            updated_at: processedAt || approvedAt,
        };
    });
};

const findVoucherTargetBooking = ({
    sourceIncident,
    bookings,
    status,
    usedTargetIds,
    customerTierById,
}) => {
    const issuedAt = addMinutes(sourceIncident.created_at, 5);
    const candidates = bookings.filter((booking) => {
        const targetStatusMatches =
            status === CUSTOMER_VOUCHER_STATUS.USED
                ? (
                    booking.status === BOOKING_STATUS.COMPLETED
                    && booking.payment_status
                        === BOOKING_PAYMENT_STATUS.PAID
                )
                : booking.status === BOOKING_STATUS.CONFIRMED;

        return (
            targetStatusMatches
            && sameId(booking.customer_id, sourceIncident.customer_id)
            && sameId(booking.garage_id, sourceIncident.garage_id)
            && !sameId(booking._id, sourceIncident.booking_id)
            && booking.created_at > issuedAt
            && (booking.used_points || 0) === 0
            && !usedTargetIds.has(toId(booking._id))
            && (
                status !== CUSTOMER_VOUCHER_STATUS.USED
                || customerTierById.get(toId(booking.customer_id))
                    === 'BRONZE'
            )
            && (
                status !== CUSTOMER_VOUCHER_STATUS.USED
                || booking.paid_at > issuedAt
            )
        );
    }).sort((left, right) => (
        sortByTimeAndId(left, right, 'created_at')
    ));

    return candidates[0] || null;
};

const buildIncidentVoucherSources = ({
    incidents,
    bookings,
    customerTierById,
}) => {
    const sources = incidents
        .filter((incident) => incident.customer_id)
        .sort((left, right) => (
            sortByTimeAndId(left, right, 'created_at')
        ));
    const unusedSourceIds = new Set(sources.map((source) => toId(source._id)));
    const usedTargetIds = new Set();
    const assignments = [];
    const allocateTargetStatus = (status) => {
        const sourceWithTarget = sources
            .filter((source) => unusedSourceIds.has(toId(source._id)))
            .map((source) => ({
                source,
                target: findVoucherTargetBooking({
                    sourceIncident: source,
                    bookings,
                    status,
                    usedTargetIds,
                    customerTierById,
                }),
            }))
            .find(({ target }) => target);

        if (!sourceWithTarget) {
            throw new Error(
                `Voucher target booking is missing: ${status}`
            );
        }

        unusedSourceIds.delete(toId(sourceWithTarget.source._id));
        usedTargetIds.add(toId(sourceWithTarget.target._id));
        assignments.push({
            source: sourceWithTarget.source,
            status,
            targetBooking: sourceWithTarget.target,
        });
    };

    allocateTargetStatus(CUSTOMER_VOUCHER_STATUS.RESERVED);
    allocateTargetStatus(CUSTOMER_VOUCHER_STATUS.RESERVED);
    allocateTargetStatus(CUSTOMER_VOUCHER_STATUS.USED);
    allocateTargetStatus(CUSTOMER_VOUCHER_STATUS.USED);

    const remaining = sources.filter(
        (source) => unusedSourceIds.has(toId(source._id))
    );
    const oldEnoughForExpiry = [...remaining]
        .sort((left, right) => (
            sortByTimeAndId(left, right, 'created_at')
        ))[0];

    if (!oldEnoughForExpiry) {
        throw new Error('Expired incident voucher source is missing');
    }

    unusedSourceIds.delete(toId(oldEnoughForExpiry._id));
    assignments.push({
        source: oldEnoughForExpiry,
        status: CUSTOMER_VOUCHER_STATUS.EXPIRED,
        targetBooking: null,
    });

    const finalStatuses = [
        CUSTOMER_VOUCHER_STATUS.PENDING_APPROVAL,
        CUSTOMER_VOUCHER_STATUS.PENDING_APPROVAL,
        CUSTOMER_VOUCHER_STATUS.ISSUED,
    ];

    for (const status of finalStatuses) {
        const source = sources.find(
            (candidate) => unusedSourceIds.has(toId(candidate._id))
        );

        if (!source) {
            throw new Error(
                `Incident voucher source is missing: ${status}`
            );
        }

        unusedSourceIds.delete(toId(source._id));
        assignments.push({
            source,
            status,
            targetBooking: null,
        });
    }

    if (
        assignments.length !== VOUCHER_TARGETS.by_source.INCIDENT
        || unusedSourceIds.size !== 0
    ) {
        throw new Error(
            `Incident voucher source target mismatch: ${assignments.length}`
        );
    }

    return assignments;
};

const getIncidentVoucherConfig = (assignment, index) => {
    const configs = [
        {
            voucher_type: CUSTOMER_VOUCHER_TYPES.FIXED_AMOUNT,
            value: 30000,
            max_discount_amount: null,
            min_order_amount: 0,
        },
        {
            voucher_type: CUSTOMER_VOUCHER_TYPES.PERCENTAGE,
            value: 10,
            max_discount_amount: 80000,
            min_order_amount: 0,
        },
        {
            voucher_type: CUSTOMER_VOUCHER_TYPES.FIXED_AMOUNT,
            value: 80000,
            max_discount_amount: null,
            min_order_amount: 0,
        },
        {
            voucher_type: CUSTOMER_VOUCHER_TYPES.PERCENTAGE,
            value: 15,
            max_discount_amount: 100000,
            min_order_amount: 0,
        },
    ];

    if (assignment.status === CUSTOMER_VOUCHER_STATUS.USED) {
        return configs[index];
    }

    if (assignment.status === CUSTOMER_VOUCHER_STATUS.RESERVED) {
        return configs[index];
    }

    if (assignment.status === CUSTOMER_VOUCHER_STATUS.EXPIRED) {
        return {
            voucher_type: CUSTOMER_VOUCHER_TYPES.FIXED_AMOUNT,
            value: 50000,
            max_discount_amount: null,
            min_order_amount: 100000,
        };
    }

    if (assignment.status === CUSTOMER_VOUCHER_STATUS.PENDING_APPROVAL) {
        return index % 2 === 0
            ? {
                voucher_type: CUSTOMER_VOUCHER_TYPES.FIXED_AMOUNT,
                value: 150000,
                max_discount_amount: null,
                min_order_amount: 200000,
            }
            : {
                voucher_type: CUSTOMER_VOUCHER_TYPES.PERCENTAGE,
                value: 20,
                max_discount_amount: 150000,
                min_order_amount: 300000,
            };
    }

    return {
        voucher_type: CUSTOMER_VOUCHER_TYPES.FREE_SERVICE,
        value: 0,
        max_discount_amount: null,
        min_order_amount: 0,
    };
};

const calculateSeedVoucherDiscount = ({
    voucher,
    booking,
    servicePackageById,
}) => {
    const orderAmount = Math.max(
        0,
        booking.original_price
        - (booking.promotion_discount_amount || 0)
    );
    let amount;

    if (voucher.voucher_type === CUSTOMER_VOUCHER_TYPES.FIXED_AMOUNT) {
        amount = voucher.value;
    } else if (
        voucher.voucher_type === CUSTOMER_VOUCHER_TYPES.PERCENTAGE
    ) {
        amount = Math.floor(orderAmount * voucher.value / 100);

        if (voucher.max_discount_amount !== null) {
            amount = Math.min(amount, voucher.max_discount_amount);
        }
    } else {
        amount = servicePackageById.get(
            toId(voucher.service_package_id)
        )?.base_price || 0;
    }

    return Math.max(0, Math.min(Math.floor(amount), orderAmount));
};

const buildVoucherDefinitions = ({
    incidentDefinitions,
    customerCases,
    resolutions,
    bookings,
    staffMaps,
    customerTierById,
    servicePackageById,
    referenceDate,
}) => {
    const incidentAssignments = buildIncidentVoucherSources({
        incidents: incidentDefinitions,
        bookings,
        customerTierById,
    });
    const voucherDefinitions = [];
    const bookingVoucherUpdates = [];
    const targetBookingIds = new Set();
    let usedIndex = 0;
    let reservedIndex = 2;
    let pendingIndex = 0;

    for (const [index, assignment] of incidentAssignments.entries()) {
        let configIndex = 0;

        if (assignment.status === CUSTOMER_VOUCHER_STATUS.USED) {
            configIndex = usedIndex;
            usedIndex += 1;
        } else if (
            assignment.status === CUSTOMER_VOUCHER_STATUS.RESERVED
        ) {
            configIndex = reservedIndex;
            reservedIndex += 1;
        } else if (
            assignment.status
            === CUSTOMER_VOUCHER_STATUS.PENDING_APPROVAL
        ) {
            configIndex = pendingIndex;
            pendingIndex += 1;
        } else {
            configIndex = index;
        }

        const config = getIncidentVoucherConfig(
            assignment,
            configIndex
        );
        const source = assignment.source;
        const booking = bookings.find((candidate) => (
            sameId(candidate._id, source.booking_id)
        ));
        const issuer = source.reported_by_id;
        const voucherId = deterministicId(
            'AUTOWASH_INCIDENT_VOUCHER_V1',
            toId(source._id)
        );
        const issuedAt = addMinutes(source.created_at, 5);
        const expired = assignment.status
            === CUSTOMER_VOUCHER_STATUS.EXPIRED;
        const pending = assignment.status
            === CUSTOMER_VOUCHER_STATUS.PENDING_APPROVAL;
        const expiresAt = expired
            ? addDays(issuedAt, 1)
            : addDays(referenceDate, 60 + index * 3);
        const targetBooking = assignment.targetBooking;
        const servicePackageId =
            config.voucher_type
            === CUSTOMER_VOUCHER_TYPES.FREE_SERVICE
                ? booking.service_package_id
                : null;
        const definition = {
            _id: voucherId,
            code: `CARE_INC_${String(index + 1).padStart(2, '0')}_${toId(voucherId).slice(-8).toUpperCase()}`,
            customer_id: source.customer_id,
            garage_id: source.garage_id,
            source_booking_id: source.booking_id,
            source_incident_id: source._id,
            source_customer_case_id: null,
            source_customer_case_resolution_id: null,
            voucher_type: config.voucher_type,
            value: config.value,
            max_discount_amount: config.max_discount_amount,
            min_order_amount: config.min_order_amount,
            service_package_id: servicePackageId,
            status: assignment.status,
            expires_at: expiresAt,
            note: 'Voucher hỗ trợ khách hàng do sự cố vận hành tại garage.',
            issued_by_id: issuer,
            approved_by_id: pending ? null : issuer,
            approved_at: pending ? null : issuedAt,
            reserved_booking_id: targetBooking?._id || null,
            reserved_at: targetBooking?.created_at || null,
            used_at:
                assignment.status === CUSTOMER_VOUCHER_STATUS.USED
                    ? targetBooking.paid_at
                    : null,
            revoked_at: null,
            revoked_by_id: null,
            created_at: issuedAt,
            updated_at:
                assignment.status === CUSTOMER_VOUCHER_STATUS.USED
                    ? targetBooking.paid_at
                    : targetBooking?.created_at || issuedAt,
        };

        voucherDefinitions.push(definition);

        if (targetBooking) {
            if (targetBookingIds.has(toId(targetBooking._id))) {
                throw new Error(
                    `Duplicate voucher target booking: ${targetBooking._id}`
                );
            }

            targetBookingIds.add(toId(targetBooking._id));
            bookingVoucherUpdates.push({
                booking_id: targetBooking._id,
                customer_voucher_id: voucherId,
                voucher_discount_amount:
                    calculateSeedVoucherDiscount({
                        voucher: definition,
                        booking: targetBooking,
                        servicePackageById,
                    }),
                updated_at: maxDate(
                    targetBooking.updated_at,
                    definition.used_at || definition.reserved_at
                ),
            });
        }
    }

    const customerCaseById = new Map(customerCases.map(
        (customerCase) => [toId(customerCase._id), customerCase]
    ));
    const caseVoucherResolutions = resolutions.filter((resolution) => (
        resolution.status === CUSTOMER_CASE_RESOLUTION_STATUSES.APPLIED
        && resolution.actions.some((action) => (
            action.action_type
            === CUSTOMER_CASE_RESOLUTION_ACTION_TYPES.VOUCHER
        ))
    ));
    const caseVoucherStatuses = [
        CUSTOMER_VOUCHER_STATUS.ISSUED,
        CUSTOMER_VOUCHER_STATUS.ISSUED,
        CUSTOMER_VOUCHER_STATUS.EXPIRED,
        CUSTOMER_VOUCHER_STATUS.REVOKED,
    ];

    if (
        caseVoucherResolutions.length
        !== VOUCHER_TARGETS.by_source.CUSTOMER_CASE
    ) {
        throw new Error(
            `Case voucher resolution mismatch: ${caseVoucherResolutions.length}`
        );
    }

    for (
        let index = 0;
        index < caseVoucherResolutions.length;
        index += 1
    ) {
        const resolution = caseVoucherResolutions[index];
        const customerCase = customerCaseById.get(
            toId(resolution.case_id)
        );
        const action = resolution.actions.find((item) => (
            item.action_type
            === CUSTOMER_CASE_RESOLUTION_ACTION_TYPES.VOUCHER
        ));
        const status = caseVoucherStatuses[index];
        const voucherId = deterministicId(
            'AUTOWASH_CUSTOMER_CASE_VOUCHER_V1',
            toId(resolution._id)
        );
        const issuedAt = resolution.applied_at;
        const revokedAt = status === CUSTOMER_VOUCHER_STATUS.REVOKED
            ? addMinutes(issuedAt, 120)
            : null;

        voucherDefinitions.push({
            _id: voucherId,
            code: `CARE_CASE_${String(index + 1).padStart(2, '0')}_${toId(voucherId).slice(-8).toUpperCase()}`,
            customer_id: customerCase.customer_id,
            garage_id: customerCase.garage_id,
            source_booking_id: customerCase.booking_id,
            source_incident_id: null,
            source_customer_case_id: customerCase._id,
            source_customer_case_resolution_id: resolution._id,
            voucher_type: action.voucher_type,
            value: action.value,
            max_discount_amount: action.max_discount_amount,
            min_order_amount: action.min_order_amount,
            service_package_id: action.service_package_id,
            status,
            expires_at: action.expires_at,
            note: action.note,
            issued_by_id: customerCase.seed_admin_id,
            approved_by_id: customerCase.seed_admin_id,
            approved_at: issuedAt,
            reserved_booking_id: null,
            reserved_at: null,
            used_at: null,
            revoked_at: revokedAt,
            revoked_by_id: revokedAt
                ? customerCase.seed_admin_id
                : null,
            created_at: issuedAt,
            updated_at: revokedAt || issuedAt,
        });
    }

    if (voucherDefinitions.length !== VOUCHER_TARGETS.total) {
        throw new Error(
            `Voucher definition target mismatch: ${voucherDefinitions.length}`
        );
    }

    const voucherIdsByIncidentId = new Map();

    for (const voucher of voucherDefinitions.filter(
        (definition) => definition.source_incident_id
    )) {
        const incidentId = toId(voucher.source_incident_id);
        const values = voucherIdsByIncidentId.get(incidentId) || [];

        values.push(voucher._id);
        voucherIdsByIncidentId.set(incidentId, values);
    }

    for (const incident of incidentDefinitions) {
        incident.compensation_voucher_ids =
            voucherIdsByIncidentId.get(toId(incident._id)) || [];
        incident.updated_at = maxDate(
            incident.updated_at,
            ...incident.compensation_voucher_ids.map((voucherId) => (
                voucherDefinitions.find(
                    (voucher) => sameId(voucher._id, voucherId)
                )?.created_at
            ))
        );
    }

    return {
        voucherDefinitions,
        bookingVoucherUpdates,
    };
};

const buildCustomerCaseEvents = ({
    customerCases,
    messages,
    assessments,
    resolutions,
}) => {
    const events = [];
    const serialByCaseAndType = new Map();
    const addEvent = ({
        customerCase,
        eventType,
        actorId = null,
        actorRole = null,
        fromStatus = null,
        toStatus = null,
        visibleToCustomer = true,
        metadata = {},
        createdAt,
    }) => {
        const serialKey = `${toId(customerCase._id)}:${eventType}`;
        const serial = (serialByCaseAndType.get(serialKey) || 0) + 1;

        serialByCaseAndType.set(serialKey, serial);
        events.push({
            _id: deterministicId(
                'AUTOWASH_CUSTOMER_CASE_EVENT_V1',
                `${serialKey}:${serial}`
            ),
            case_id: customerCase._id,
            event_type: eventType,
            actor_id: actorId,
            actor_role: actorRole,
            from_status: fromStatus,
            to_status: toStatus,
            visible_to_customer: visibleToCustomer,
            metadata,
            created_at: createdAt,
        });
    };
    const caseById = new Map(customerCases.map((customerCase) => [
        toId(customerCase._id),
        customerCase,
    ]));

    for (const customerCase of customerCases) {
        const submitterId = customerCase.customer_id
            || customerCase.seed_customer_service_user_id;
        const submitterRole = customerCase.customer_id
            ? USER_ROLES.CUSTOMER
            : USER_ROLES.STAFF;

        addEvent({
            customerCase,
            eventType: CUSTOMER_CASE_EVENT_TYPES.SUBMITTED,
            actorId: submitterId,
            actorRole: submitterRole,
            toStatus: CUSTOMER_CASE_STATUSES.SUBMITTED,
            metadata: {
                category: customerCase.category,
                priority: customerCase.priority,
                vehicle_received: customerCase.vehicle_received,
            },
            createdAt: customerCase.created_at,
        });

        if (customerCase.assigned_at) {
            addEvent({
                customerCase,
                eventType: CUSTOMER_CASE_EVENT_TYPES.ASSIGNED,
                actorId: customerCase.assigned_by_id,
                actorRole: USER_ROLES.ADMIN,
                metadata: {
                    assigned_to_id: customerCase.assigned_to_id,
                },
                createdAt: customerCase.assigned_at,
            });
        }

        if (customerCase.acknowledged_at) {
            addEvent({
                customerCase,
                eventType: CUSTOMER_CASE_EVENT_TYPES.ACKNOWLEDGED,
                actorId: customerCase.acknowledged_by_id,
                actorRole: USER_ROLES.STAFF,
                fromStatus: CUSTOMER_CASE_STATUSES.SUBMITTED,
                toStatus: CUSTOMER_CASE_STATUSES.ACKNOWLEDGED,
                createdAt: customerCase.acknowledged_at,
            });
        }
    }

    for (const message of messages) {
        const customerCase = caseById.get(toId(message.case_id));

        addEvent({
            customerCase,
            eventType: CUSTOMER_CASE_EVENT_TYPES.MESSAGE_SENT,
            actorId: message.sender_id,
            actorRole: message.sender_role,
            metadata: {
                message_id: message._id,
                sender_role: message.sender_role,
            },
            createdAt: message.created_at,
        });
    }

    for (const assessment of assessments) {
        const customerCase = caseById.get(toId(assessment.case_id));

        addEvent({
            customerCase,
            eventType:
                CUSTOMER_CASE_EVENT_TYPES.TECHNICAL_ASSESSMENT_ASSIGNED,
            actorId: assessment.assigned_by_id,
            actorRole: USER_ROLES.STAFF,
            metadata: {
                assessment_id: assessment._id,
                inspector_user_id: assessment.inspector_user_id,
            },
            createdAt: assessment.assigned_at,
        });

        if (assessment.started_at) {
            addEvent({
                customerCase,
                eventType:
                    CUSTOMER_CASE_EVENT_TYPES.TECHNICAL_ASSESSMENT_STARTED,
                actorId: assessment.inspector_user_id,
                actorRole: USER_ROLES.STAFF,
                metadata: { assessment_id: assessment._id },
                createdAt: assessment.started_at,
            });
        }

        if (assessment.submitted_at) {
            addEvent({
                customerCase,
                eventType:
                    CUSTOMER_CASE_EVENT_TYPES.TECHNICAL_ASSESSMENT_SUBMITTED,
                actorId: assessment.inspector_user_id,
                actorRole: USER_ROLES.STAFF,
                metadata: {
                    assessment_id: assessment._id,
                    severity: assessment.severity,
                },
                createdAt: assessment.submitted_at,
            });
        }
    }

    for (const resolution of resolutions) {
        const customerCase = caseById.get(toId(resolution.case_id));

        addEvent({
            customerCase,
            eventType:
                CUSTOMER_CASE_EVENT_TYPES.RESOLUTION_PROPOSED,
            actorId: resolution.proposed_by_id,
            actorRole: USER_ROLES.ADMIN,
            metadata: {
                resolution_id: resolution._id,
                version: resolution.version,
                status: resolution.status,
            },
            createdAt: resolution.proposed_at,
        });

        if (resolution.customer_responded_at) {
            addEvent({
                customerCase,
                eventType:
                    resolution.status
                    === CUSTOMER_CASE_RESOLUTION_STATUSES.CUSTOMER_REJECTED
                        ? CUSTOMER_CASE_EVENT_TYPES.RESOLUTION_REJECTED
                        : CUSTOMER_CASE_EVENT_TYPES.RESOLUTION_ACCEPTED,
                actorId: resolution.customer_responded_by_id,
                actorRole: customerCase.customer_id
                    ? USER_ROLES.CUSTOMER
                    : USER_ROLES.STAFF,
                metadata: {
                    resolution_id: resolution._id,
                    version: resolution.version,
                },
                createdAt: resolution.customer_responded_at,
            });
        }

        if (resolution.applied_at) {
            addEvent({
                customerCase,
                eventType:
                    CUSTOMER_CASE_EVENT_TYPES.RESOLUTION_APPLIED,
                actorId: resolution.applied_by_id,
                actorRole: USER_ROLES.ADMIN,
                metadata: {
                    resolution_id: resolution._id,
                    version: resolution.version,
                    refund_ids: resolution.refund_ids,
                    voucher_ids: resolution.voucher_ids,
                },
                createdAt: resolution.applied_at,
            });
        }
    }

    for (const customerCase of customerCases) {
        if (customerCase.seed_reopened_at) {
            const priorResolution = resolutions.find((resolution) => (
                sameId(resolution.case_id, customerCase._id)
                && resolution.status
                    === CUSTOMER_CASE_RESOLUTION_STATUSES.APPLIED
            ));
            const previousResolvedAt = addMinutes(
                priorResolution.applied_at,
                60
            );

            addEvent({
                customerCase,
                eventType: CUSTOMER_CASE_EVENT_TYPES.CONCLUDED,
                actorId: customerCase.seed_admin_id,
                actorRole: USER_ROLES.ADMIN,
                fromStatus: CUSTOMER_CASE_STATUSES.INVESTIGATING,
                toStatus: CUSTOMER_CASE_STATUSES.RESOLVED,
                metadata: {
                    liability_status:
                        CUSTOMER_CASE_LIABILITY_STATUSES.GARAGE_RESPONSIBLE,
                    historical_resolution: true,
                },
                createdAt: previousResolvedAt,
            });
            addEvent({
                customerCase,
                eventType: CUSTOMER_CASE_EVENT_TYPES.REOPENED,
                actorId: customerCase.last_reopened_by_id,
                actorRole: customerCase.customer_id
                    ? USER_ROLES.CUSTOMER
                    : USER_ROLES.ADMIN,
                fromStatus: CUSTOMER_CASE_STATUSES.RESOLVED,
                toStatus: CUSTOMER_CASE_STATUSES.INVESTIGATING,
                metadata: {
                    reason: customerCase.last_reopen_reason,
                    reopen_count: customerCase.reopen_count,
                },
                createdAt: customerCase.seed_reopened_at,
            });
        } else if (customerCase.resolved_at) {
            addEvent({
                customerCase,
                eventType: CUSTOMER_CASE_EVENT_TYPES.CONCLUDED,
                actorId: customerCase.resolved_by_id,
                actorRole: USER_ROLES.ADMIN,
                fromStatus: CUSTOMER_CASE_STATUSES.INVESTIGATING,
                toStatus: CUSTOMER_CASE_STATUSES.RESOLVED,
                metadata: {
                    liability_status: customerCase.liability_status,
                    conclusion: customerCase.conclusion,
                },
                createdAt: customerCase.resolved_at,
            });
        }

        if (customerCase.closed_at) {
            addEvent({
                customerCase,
                eventType: CUSTOMER_CASE_EVENT_TYPES.CLOSED,
                actorId: customerCase.closed_by_id,
                actorRole: USER_ROLES.ADMIN,
                fromStatus: CUSTOMER_CASE_STATUSES.RESOLVED,
                toStatus: CUSTOMER_CASE_STATUSES.CLOSED,
                createdAt: customerCase.closed_at,
            });
        }

        if (customerCase.escalated_at) {
            addEvent({
                customerCase,
                eventType: CUSTOMER_CASE_EVENT_TYPES.SLA_ESCALATED,
                visibleToCustomer: false,
                metadata: {
                    first_response_breached: Boolean(
                        customerCase.first_response_breached_at
                    ),
                    resolution_breached: Boolean(
                        customerCase.resolution_breached_at
                    ),
                    escalation_level: customerCase.escalation_level,
                },
                createdAt: customerCase.escalated_at,
            });
        }
    }

    return events.sort((left, right) => (
        toId(left.case_id).localeCompare(toId(right.case_id))
        || left.created_at - right.created_at
        || toId(left._id).localeCompare(toId(right._id))
    ));
};

const buildCaseHandoverUpdates = ({
    customerCases,
    handoverById,
}) => customerCases.map((customerCase) => {
    const handover = handoverById.get(toId(customerCase.handover_id));

    if (!handover) {
        throw new Error(
            `Customer case handover dependency is missing: ${customerCase._id}`
        );
    }

    return {
        handover_id: handover._id,
        state:
            customerCase.source === CUSTOMER_CASE_SOURCES.HANDOVER
                ? BOOKING_HANDOVER_STATES.ON_HOLD
                : BOOKING_HANDOVER_STATES.RELEASED,
        customer_response:
            BOOKING_HANDOVER_RESPONSES.ISSUE_REPORTED,
        customer_responded_at: customerCase.created_at,
        customer_response_source: customerCase.is_walk_in_case
            ? BOOKING_HANDOVER_RESPONSE_SOURCES.STAFF_ASSISTED
            : BOOKING_HANDOVER_RESPONSE_SOURCES.CUSTOMER_SELF_SERVICE,
        customer_response_recorded_by_id:
            customerCase.customer_id
            || customerCase.created_by_staff_id,
        customer_response_note: customerCase.description,
        issue_case_ids: [customerCase._id],
        updated_at: maxDate(
            handover.updated_at,
            customerCase.created_at
        ),
    };
});

const stripCustomerCaseSeedFields = (customerCase) => {
    const {
        seed_index: seedIndex,
        seed_admin_id: seedAdminId,
        seed_customer_service_user_id: seedCustomerServiceUserId,
        seed_reopened_at: seedReopenedAt,
        ...definition
    } = customerCase;

    return definition;
};

const validateDefinitions = ({
    incidentDefinitions,
    voucherDefinitions,
    customerCases,
    messages,
    assessments,
    resolutions,
    refunds,
    events,
    referenceDate,
}) => {
    const validate = (Model, definitions, label) => {
        for (const definition of definitions) {
            const validationError = new Model(definition).validateSync();

            if (validationError) {
                throw new Error(
                    `${label} validation failed: ${validationError.message}`
                );
            }
        }
    };

    validate(BookingIncident, incidentDefinitions, 'Incident');
    validate(CustomerVoucher, voucherDefinitions, 'Voucher');
    validate(
        CustomerCase,
        customerCases.map(stripCustomerCaseSeedFields),
        'Customer case'
    );
    validate(CustomerCaseMessage, messages, 'Customer case message');
    validate(
        CustomerCaseTechnicalAssessment,
        assessments,
        'Technical assessment'
    );
    validate(
        CustomerCaseResolution,
        resolutions,
        'Customer case resolution'
    );
    validate(CustomerCaseRefund, refunds, 'Customer case refund');
    validate(CustomerCaseEvent, events, 'Customer case event');

    for (const voucher of voucherDefinitions) {
        const sourceCount = Number(Boolean(voucher.source_incident_id))
            + Number(Boolean(voucher.source_customer_case_id));

        if (
            sourceCount !== 1
            || (
                voucher.status === CUSTOMER_VOUCHER_STATUS.EXPIRED
                && voucher.expires_at > referenceDate
            )
            || (
                voucher.status !== CUSTOMER_VOUCHER_STATUS.EXPIRED
                && voucher.expires_at <= voucher.created_at
            )
            || (
                [
                    CUSTOMER_VOUCHER_STATUS.RESERVED,
                    CUSTOMER_VOUCHER_STATUS.USED,
                ].includes(voucher.status)
                && (
                    !voucher.reserved_booking_id
                    || !voucher.reserved_at
                )
            )
            || (
                voucher.status === CUSTOMER_VOUCHER_STATUS.USED
                && !voucher.used_at
            )
            || (
                voucher.status
                    === CUSTOMER_VOUCHER_STATUS.PENDING_APPROVAL
                && (
                    voucher.approved_by_id
                    || voucher.approved_at
                )
            )
        ) {
            throw new Error(
                `Voucher lifecycle is invalid: ${voucher.code}`
            );
        }
    }
};

const summarizePlan = ({
    incidentDefinitions,
    voucherDefinitions,
    customerCases,
    messages,
    assessments,
    resolutions,
    refunds,
    events,
    garageCodeById,
}) => ({
    incidents: {
        total: incidentDefinitions.length,
        by_type: countBy(
            incidentDefinitions,
            (incident) => incident.incident_type
        ),
        by_status: countBy(
            incidentDefinitions,
            (incident) => incident.status
        ),
        by_decision: countBy(
            incidentDefinitions.filter((incident) => incident.decision),
            (incident) => incident.decision
        ),
        by_garage: countBy(
            incidentDefinitions,
            (incident) => garageCodeById.get(toId(incident.garage_id))
        ),
    },
    vouchers: {
        total: voucherDefinitions.length,
        by_type: countBy(
            voucherDefinitions,
            (voucher) => voucher.voucher_type
        ),
        by_status: countBy(
            voucherDefinitions,
            (voucher) => voucher.status
        ),
        by_source: {
            INCIDENT: voucherDefinitions.filter(
                (voucher) => voucher.source_incident_id
            ).length,
            CUSTOMER_CASE: voucherDefinitions.filter(
                (voucher) => voucher.source_customer_case_id
            ).length,
        },
    },
    customer_cases: {
        total: customerCases.length,
        registered: customerCases.filter(
            (customerCase) => !customerCase.is_walk_in_case
        ).length,
        walk_in: customerCases.filter(
            (customerCase) => customerCase.is_walk_in_case
        ).length,
        by_status: countBy(
            customerCases,
            (customerCase) => customerCase.status
        ),
        by_category: countBy(
            customerCases,
            (customerCase) => customerCase.category
        ),
        by_source: countBy(
            customerCases,
            (customerCase) => customerCase.source
        ),
        by_garage: countBy(
            customerCases,
            (customerCase) => (
                garageCodeById.get(toId(customerCase.garage_id))
            )
        ),
        reopened: customerCases.filter(
            (customerCase) => customerCase.reopen_count > 0
        ).length,
        sla_escalated: customerCases.filter(
            (customerCase) => customerCase.escalation_level > 0
        ).length,
    },
    dependents: {
        messages: messages.length,
        events: events.length,
        technical_assessments: assessments.length,
        assessment_statuses: countBy(
            assessments,
            (assessment) => assessment.status
        ),
        resolutions: resolutions.length,
        resolution_statuses: countBy(
            resolutions,
            (resolution) => resolution.status
        ),
        refunds: refunds.length,
        refund_statuses: countBy(
            refunds,
            (refund) => refund.status
        ),
    },
});

const assertPlanTargets = (summary) => {
    if (
        summary.incidents.total !== INCIDENT_TARGETS.total
        || !countsMatch(
            summary.incidents.by_type,
            INCIDENT_TARGETS.by_type
        )
        || !countsMatch(
            summary.incidents.by_status,
            INCIDENT_TARGETS.by_status
        )
        || !countsMatch(
            summary.incidents.by_decision,
            INCIDENT_TARGETS.by_decision
        )
        || Object.values(summary.incidents.by_garage).some(
            (count) => count !== INCIDENT_TARGETS.per_garage
        )
    ) {
        throw new Error(
            `Incident seed target mismatch: ${JSON.stringify(summary.incidents)}`
        );
    }

    if (
        summary.vouchers.total !== VOUCHER_TARGETS.total
        || !countsMatch(summary.vouchers.by_type, VOUCHER_TARGETS.by_type)
        || !countsMatch(
            summary.vouchers.by_status,
            VOUCHER_TARGETS.by_status
        )
        || !countsMatch(
            summary.vouchers.by_source,
            VOUCHER_TARGETS.by_source
        )
    ) {
        throw new Error(
            `Voucher seed target mismatch: ${JSON.stringify(summary.vouchers)}`
        );
    }

    if (
        summary.customer_cases.total !== CUSTOMER_CASE_TARGETS.total
        || summary.customer_cases.registered
            !== CUSTOMER_CASE_TARGETS.registered
        || summary.customer_cases.walk_in
            !== CUSTOMER_CASE_TARGETS.walk_in
        || !countsMatch(
            summary.customer_cases.by_status,
            CUSTOMER_CASE_TARGETS.by_status
        )
        || !countsMatch(
            summary.customer_cases.by_category,
            CUSTOMER_CASE_TARGETS.by_category
        )
        || !countsMatch(
            summary.customer_cases.by_source,
            CUSTOMER_CASE_TARGETS.by_source
        )
        || summary.customer_cases.reopened
            !== CUSTOMER_CASE_TARGETS.reopened
        || summary.customer_cases.sla_escalated
            !== CUSTOMER_CASE_TARGETS.sla_escalated
        || Object.values(summary.customer_cases.by_garage)
            .sort((left, right) => right - left)
            .join(',')
            !== [...CUSTOMER_CASE_TARGETS.by_garage]
                .sort((left, right) => right - left)
                .join(',')
    ) {
        throw new Error(
            `Customer case seed target mismatch: ${JSON.stringify(summary.customer_cases)}`
        );
    }

    if (
        summary.dependents.messages
            !== CUSTOMER_CASE_DEPENDENT_TARGETS.messages
        || summary.dependents.technical_assessments
            !== CUSTOMER_CASE_DEPENDENT_TARGETS.technical_assessments
        || !countsMatch(
            summary.dependents.assessment_statuses,
            CUSTOMER_CASE_DEPENDENT_TARGETS.assessment_statuses
        )
        || summary.dependents.resolutions
            !== CUSTOMER_CASE_DEPENDENT_TARGETS.resolutions
        || !countsMatch(
            summary.dependents.resolution_statuses,
            CUSTOMER_CASE_DEPENDENT_TARGETS.resolution_statuses
        )
        || summary.dependents.refunds
            !== CUSTOMER_CASE_DEPENDENT_TARGETS.refunds
        || !countsMatch(
            summary.dependents.refund_statuses,
            CUSTOMER_CASE_DEPENDENT_TARGETS.refund_statuses
        )
    ) {
        throw new Error(
            `Customer case dependent target mismatch: ${JSON.stringify(summary.dependents)}`
        );
    }
};

const loadSeedDependencies = async ({
    referenceDate,
    session,
}) => {
    const loyaltyHandoverPlan = await buildLoyaltyHandoverPlan({
        referenceDate,
        session,
    });
    const queries = [
        Garage.find({ is_active: true }).sort({ garage_code: 1 }),
        StaffProfile.find({ is_active: true }),
        User.find({
            role: USER_ROLES.ADMIN,
            is_active: true,
        }).sort({ phone: 1 }),
        WashBay.find({ is_active: true }),
        BookingIncident.find({}),
        CustomerLoyalty.find({}),
        ServicePackage.find({ is_active: true }),
    ];
    const [
        garages,
        staffProfiles,
        admins,
        washBays,
        existingIncidents,
        customerLoyalties,
        servicePackages,
    ] = await Promise.all(
        queries.map((query) => applySession(query, session).lean())
    );

    if (
        garages.length !== 5
        || admins.length !== 2
        || staffProfiles.length !== 50
    ) {
        throw new Error(
            `Incident and case dependencies are incomplete: ${garages.length}:${admins.length}:${staffProfiles.length}`
        );
    }

    return {
        loyaltyHandoverPlan,
        garages,
        staffProfiles,
        admins,
        washBays,
        existingIncidents,
        customerLoyalties,
        servicePackages,
    };
};

const buildSeedPlan = async ({
    referenceDate = getSeedReferenceDate(),
    session = null,
} = {}) => {
    const dependencies = await loadSeedDependencies({
        referenceDate,
        session,
    });
    const bookings = dependencies.loyaltyHandoverPlan.bookings;
    const bookingById = new Map(bookings.map((booking) => [
        toId(booking._id),
        booking,
    ]));
    const servicePackageById = new Map(
        dependencies.servicePackages.map((servicePackage) => [
            toId(servicePackage._id),
            servicePackage,
        ])
    );
    const customerTierById = new Map(
        dependencies.customerLoyalties.map((loyalty) => [
            toId(loyalty.customer_id),
            loyalty.current_tier,
        ])
    );
    const staffMaps = getStaffMaps(dependencies);
    const incidentSelection = selectIncidentBookings({
        bookings,
        garages: [...dependencies.garages],
        existingIncidents: dependencies.existingIncidents,
        customerTierById,
    });
    const incidentPlan = buildIncidentDefinitions({
        selection: incidentSelection,
        bookings,
        washBays: dependencies.washBays,
        staffMaps,
        referenceDate,
    });
    const handoverDefinitions =
        dependencies.loyaltyHandoverPlan.handovers.map((handover) => ({
            ...handover,
            _id: deterministicId(
                'AUTOWASH_BOOKING_HANDOVER_V1',
                toId(handover.booking_id)
            ),
        }));
    const selectedCases = selectCustomerCaseBookings({
        bookings,
        handoverDefinitions,
        garages: [...dependencies.garages],
    });
    const customerCases = buildCustomerCaseDefinitions({
        selectedCases,
        staffMaps,
        admins: dependencies.admins,
        referenceDate,
    });
    const customerCaseById = new Map(customerCases.map(
        (customerCase) => [toId(customerCase._id), customerCase]
    ));
    const messages = buildCustomerCaseMessages({ customerCases });
    const assessments = buildTechnicalAssessmentDefinitions({
        customerCases,
        staffMaps,
    });
    const resolutions = buildResolutionDefinitions({
        customerCases,
        bookingById,
        referenceDate,
    });
    const refunds = buildRefundDefinitions({
        resolutions,
        customerCaseById,
        bookingById,
    });
    const voucherPlan = buildVoucherDefinitions({
        incidentDefinitions: incidentPlan.incidentDefinitions,
        customerCases,
        resolutions,
        bookings,
        staffMaps,
        customerTierById,
        servicePackageById,
        referenceDate,
    });
    const events = buildCustomerCaseEvents({
        customerCases,
        messages,
        assessments,
        resolutions,
    });

    for (const customerCase of customerCases) {
        const relatedTimes = [
            customerCase.updated_at,
            ...messages
                .filter((message) => sameId(
                    message.case_id,
                    customerCase._id
                ))
                .map((message) => message.created_at),
            ...assessments
                .filter((assessment) => sameId(
                    assessment.case_id,
                    customerCase._id
                ))
                .map((assessment) => assessment.updated_at),
            ...resolutions
                .filter((resolution) => sameId(
                    resolution.case_id,
                    customerCase._id
                ))
                .map((resolution) => resolution.updated_at),
            ...refunds
                .filter((refund) => sameId(
                    refund.case_id,
                    customerCase._id
                ))
                .map((refund) => refund.updated_at),
            ...events
                .filter((event) => sameId(
                    event.case_id,
                    customerCase._id
                ))
                .map((event) => event.created_at),
        ];

        customerCase.updated_at = maxDate(...relatedTimes);
    }

    const handoverById = new Map(handoverDefinitions.map(
        (handover) => [toId(handover._id), handover]
    ));
    const handoverUpdates = buildCaseHandoverUpdates({
        customerCases,
        handoverById,
    });
    const cleanCustomerCases = customerCases.map(
        stripCustomerCaseSeedFields
    );

    validateDefinitions({
        incidentDefinitions: incidentPlan.incidentDefinitions,
        voucherDefinitions: voucherPlan.voucherDefinitions,
        customerCases,
        messages,
        assessments,
        resolutions,
        refunds,
        events,
        referenceDate,
    });

    for (const definition of [
        ...incidentPlan.incidentDefinitions,
        ...voucherPlan.voucherDefinitions,
        ...cleanCustomerCases,
        ...messages,
        ...assessments,
        ...resolutions,
        ...refunds,
        ...events,
    ]) {
        if (
            definition.created_at
            && definition.created_at > referenceDate
        ) {
            throw new Error(
                `Seed domain record is in the future: ${definition._id}`
            );
        }
    }

    const summary = summarizePlan({
        incidentDefinitions: incidentPlan.incidentDefinitions,
        voucherDefinitions: voucherPlan.voucherDefinitions,
        customerCases,
        messages,
        assessments,
        resolutions,
        refunds,
        events,
        garageCodeById: staffMaps.garageCodeById,
    });

    assertPlanTargets(summary);

    return {
        ...dependencies,
        bookings,
        bookingById,
        servicePackageById,
        customerTierById,
        staffMaps,
        incidentSelection,
        incidentPlan,
        selectedCases,
        customerCases,
        cleanCustomerCases,
        customerCaseById,
        messages,
        assessments,
        resolutions,
        refunds,
        voucherPlan,
        events,
        handoverDefinitions,
        handoverUpdates,
        summary,
    };
};

const replaceDefinitions = async ({
    model,
    definitions,
    session,
}) => {
    if (definitions.length === 0) {
        return {
            planned: 0,
            inserted: 0,
            matched: 0,
            modified: 0,
        };
    }

    const result = await model.bulkWrite(
        definitions.map((definition) => ({
            replaceOne: {
                filter: { _id: definition._id },
                replacement: definition,
                upsert: true,
            },
        })),
        {
            ordered: true,
            session,
            timestamps: false,
        }
    );

    return {
        planned: definitions.length,
        inserted: result.upsertedCount,
        matched: result.matchedCount,
        modified: result.modifiedCount,
    };
};

const clearPreviousVoucherBookingLinks = async ({
    session,
}) => {
    const previousVouchers = await applySession(
        CustomerVoucher.find({
            code: { $regex: '^CARE_(INC|CASE)_' },
        }).select('_id'),
        session
    ).lean();
    const voucherIds = previousVouchers.map((voucher) => voucher._id);

    if (voucherIds.length === 0) {
        return { matched: 0, modified: 0 };
    }

    const result = await Booking.updateMany(
        { customer_voucher_id: { $in: voucherIds } },
        {
            $set: {
                customer_voucher_id: null,
                voucher_discount_amount: 0,
            },
        },
        {
            session,
            timestamps: false,
        }
    );

    return {
        matched: result.matchedCount,
        modified: result.modifiedCount,
    };
};

const writeBookingUpdates = async ({
    updates,
    session,
}) => {
    if (updates.length === 0) {
        return {
            planned: 0,
            matched: 0,
            modified: 0,
        };
    }

    const mergedByBookingId = new Map();

    for (const update of updates) {
        const bookingId = toId(update.booking_id);
        const current = mergedByBookingId.get(bookingId) || {
            booking_id: update.booking_id,
        };

        mergedByBookingId.set(bookingId, {
            ...current,
            ...update,
        });
    }

    const merged = [...mergedByBookingId.values()];
    const result = await Booking.bulkWrite(
        merged.map((update) => {
            const {
                booking_id: bookingId,
                ...values
            } = update;

            return {
                updateOne: {
                    filter: { _id: bookingId },
                    update: { $set: values },
                },
            };
        }),
        {
            ordered: true,
            session,
            timestamps: false,
        }
    );

    return {
        planned: merged.length,
        matched: result.matchedCount,
        modified: result.modifiedCount,
    };
};

const writeWashBayUpdates = async ({
    updates,
    session,
}) => {
    if (updates.length === 0) {
        return {
            planned: 0,
            matched: 0,
            modified: 0,
        };
    }

    const result = await WashBay.bulkWrite(
        updates.map((update) => {
            const {
                wash_bay_id: washBayId,
                ...values
            } = update;

            return {
                updateOne: {
                    filter: { _id: washBayId },
                    update: { $set: values },
                },
            };
        }),
        {
            ordered: true,
            session,
            timestamps: false,
        }
    );

    return {
        planned: updates.length,
        matched: result.matchedCount,
        modified: result.modifiedCount,
    };
};

const writeHandoverUpdates = async ({
    updates,
    session,
}) => {
    const result = await BookingHandover.bulkWrite(
        updates.map((update) => {
            const {
                handover_id: handoverId,
                ...values
            } = update;

            return {
                updateOne: {
                    filter: { _id: handoverId },
                    update: { $set: values },
                },
            };
        }),
        {
            ordered: true,
            session,
            timestamps: false,
        }
    );

    return {
        planned: updates.length,
        matched: result.matchedCount,
        modified: result.modifiedCount,
    };
};

const pruneCaseDependents = async ({
    plan,
    session,
}) => {
    const caseIds = plan.cleanCustomerCases.map(
        (customerCase) => customerCase._id
    );
    const targets = [
        [CustomerCaseEvent, plan.events],
        [CustomerCaseMessage, plan.messages],
        [CustomerCaseTechnicalAssessment, plan.assessments],
        [CustomerCaseResolution, plan.resolutions],
        [CustomerCaseRefund, plan.refunds],
    ];
    const deleted = {};

    for (const [model, definitions] of targets) {
        const expectedIds = definitions.map(
            (definition) => definition._id
        );
        const result = await model.deleteMany({
            case_id: { $in: caseIds },
            _id: { $nin: expectedIds },
        }).session(session || null);

        deleted[model.collection.collectionName] =
            result.deletedCount;
    }

    return deleted;
};

const seedIncidentsVouchersCustomerCasesData = async ({
    session = null,
    referenceDate = getSeedReferenceDate(),
    dryRun = false,
} = {}) => {
    console.log(
        '== Seeding incidents, vouchers and customer cases =='
    );

    const plan = await buildSeedPlan({
        referenceDate,
        session,
    });

    if (dryRun) {
        return {
            dry_run: true,
            ...plan.summary,
        };
    }

    const previousVoucherLinks = await clearPreviousVoucherBookingLinks({
        session,
    });
    const incidentWrite = await replaceDefinitions({
        model: BookingIncident,
        definitions: plan.incidentPlan.incidentDefinitions,
        session,
    });
    const caseWrite = await replaceDefinitions({
        model: CustomerCase,
        definitions: plan.cleanCustomerCases,
        session,
    });
    const staleDependents = await pruneCaseDependents({ plan, session });
    const messageWrite = await replaceDefinitions({
        model: CustomerCaseMessage,
        definitions: plan.messages,
        session,
    });
    const assessmentWrite = await replaceDefinitions({
        model: CustomerCaseTechnicalAssessment,
        definitions: plan.assessments,
        session,
    });
    const resolutionWrite = await replaceDefinitions({
        model: CustomerCaseResolution,
        definitions: plan.resolutions,
        session,
    });
    const refundWrite = await replaceDefinitions({
        model: CustomerCaseRefund,
        definitions: plan.refunds,
        session,
    });
    const voucherWrite = await replaceDefinitions({
        model: CustomerVoucher,
        definitions: plan.voucherPlan.voucherDefinitions,
        session,
    });
    const eventWrite = await replaceDefinitions({
        model: CustomerCaseEvent,
        definitions: plan.events,
        session,
    });
    const bookingWrite = await writeBookingUpdates({
        updates: [
            ...plan.incidentPlan.bookingUpdates,
            ...plan.voucherPlan.bookingVoucherUpdates,
        ],
        session,
    });
    const washBayWrite = await writeWashBayUpdates({
        updates: plan.incidentPlan.washBayUpdates,
        session,
    });
    const paymentWrite = await seedPaymentsPromotionUsagesData({
        session,
        referenceDate,
    });
    const loyaltyWrite = await seedLoyaltyHistoriesHandoversData({
        session,
        referenceDate,
    });
    const handoverWrite = await writeHandoverUpdates({
        updates: plan.handoverUpdates,
        session,
    });

    console.table([{
        incidents: plan.incidentPlan.incidentDefinitions.length,
        vouchers: plan.voucherPlan.voucherDefinitions.length,
        customer_cases: plan.cleanCustomerCases.length,
        case_events: plan.events.length,
        messages: plan.messages.length,
        assessments: plan.assessments.length,
        resolutions: plan.resolutions.length,
        refunds: plan.refunds.length,
    }]);
    console.log(
        'Incidents, vouchers and customer cases seeding completed'
    );

    return {
        dry_run: false,
        ...plan.summary,
        writes: {
            previous_voucher_links: previousVoucherLinks,
            incidents: incidentWrite,
            customer_cases: caseWrite,
            stale_dependents: staleDependents,
            messages: messageWrite,
            assessments: assessmentWrite,
            resolutions: resolutionWrite,
            refunds: refundWrite,
            vouchers: voucherWrite,
            events: eventWrite,
            bookings: bookingWrite,
            wash_bays: washBayWrite,
            payments_promotions: paymentWrite.writes,
            loyalty_histories_handovers: loyaltyWrite.writes,
            handovers: handoverWrite,
        },
    };
};

const verifyIncidentsVouchersCustomerCases = async ({
    referenceDate = getSeedReferenceDate(),
} = {}) => {
    const plan = await buildSeedPlan({ referenceDate });
    const incidentIds = plan.incidentPlan.incidentDefinitions.map(
        (definition) => definition._id
    );
    const voucherIds = plan.voucherPlan.voucherDefinitions.map(
        (definition) => definition._id
    );
    const caseIds = plan.cleanCustomerCases.map(
        (definition) => definition._id
    );
    const bookingIds = plan.bookings.map((booking) => booking._id);
    const [
        incidents,
        vouchers,
        customerCases,
        messages,
        assessments,
        resolutions,
        refunds,
        events,
        handovers,
        bookings,
        violations,
        pointTransactions,
        customerLoyalties,
        washHistories,
    ] = await Promise.all([
        BookingIncident.find({ _id: { $in: incidentIds } }).lean(),
        CustomerVoucher.find({ _id: { $in: voucherIds } }).lean(),
        CustomerCase.find({ _id: { $in: caseIds } }).lean(),
        CustomerCaseMessage.find({ case_id: { $in: caseIds } }).lean(),
        CustomerCaseTechnicalAssessment.find({
            case_id: { $in: caseIds },
        }).lean(),
        CustomerCaseResolution.find({
            case_id: { $in: caseIds },
        }).lean(),
        CustomerCaseRefund.find({ case_id: { $in: caseIds } }).lean(),
        CustomerCaseEvent.find({ case_id: { $in: caseIds } }).lean(),
        BookingHandover.find({
            _id: {
                $in: plan.handoverDefinitions.map(
                    (handover) => handover._id
                ),
            },
        }).lean(),
        Booking.find({ _id: { $in: bookingIds } }).lean(),
        BookingViolationEvent.find({
            booking_id: {
                $in: plan.incidentPlan.incidentDefinitions
                    .filter((incident) => (
                        incident.decision
                        === BOOKING_INCIDENT_DECISIONS.CANCEL_BY_GARAGE
                    ))
                    .map((incident) => incident.booking_id),
            },
        }).lean(),
        PointTransaction.find({
            customer_id: {
                $in: plan.loyaltyHandoverPlan.customers.map(
                    (customer) => customer._id
                ),
            },
        }).lean(),
        CustomerLoyalty.find({
            customer_id: {
                $in: plan.loyaltyHandoverPlan.customers.map(
                    (customer) => customer._id
                ),
            },
        }).lean(),
        WashHistory.find({
            booking_id: {
                $in: plan.loyaltyHandoverPlan.bookingIds,
            },
        }).lean(),
    ]);
    const expectedIncidentById = new Map(
        plan.incidentPlan.incidentDefinitions.map((definition) => [
            toId(definition._id),
            definition,
        ])
    );
    const expectedVoucherById = new Map(
        plan.voucherPlan.voucherDefinitions.map((definition) => [
            toId(definition._id),
            definition,
        ])
    );
    const expectedCaseById = new Map(
        plan.cleanCustomerCases.map((definition) => [
            toId(definition._id),
            definition,
        ])
    );
    const bookingById = new Map(bookings.map((booking) => [
        toId(booking._id),
        booking,
    ]));

    for (const incident of incidents) {
        const expected = expectedIncidentById.get(toId(incident._id));
        const booking = bookingById.get(toId(incident.booking_id));

        if (
            !expected
            || !booking
            || incident.incident_type !== expected.incident_type
            || incident.status !== expected.status
            || incident.decision !== expected.decision
            || !sameId(incident.garage_id, booking.garage_id)
            || !sameId(incident.customer_id, booking.customer_id)
            || !sameDate(incident.resolved_at, expected.resolved_at)
            || incident.compensation_voucher_ids
                .map(toId)
                .sort()
                .join(',')
                !== expected.compensation_voucher_ids
                    .map(toId)
                    .sort()
                    .join(',')
        ) {
            throw new Error(
                `Invalid persisted booking incident: ${incident._id}`
            );
        }
    }

    for (const voucher of vouchers) {
        const expected = expectedVoucherById.get(toId(voucher._id));
        const sourceCount = Number(Boolean(voucher.source_incident_id))
            + Number(Boolean(voucher.source_customer_case_id));

        if (
            !expected
            || sourceCount !== 1
            || voucher.status !== expected.status
            || voucher.voucher_type !== expected.voucher_type
            || voucher.value !== expected.value
            || !sameId(voucher.customer_id, expected.customer_id)
            || !sameId(voucher.garage_id, expected.garage_id)
            || !sameId(
                voucher.reserved_booking_id,
                expected.reserved_booking_id
            )
            || !sameDate(voucher.used_at, expected.used_at)
            || !sameDate(voucher.expires_at, expected.expires_at)
        ) {
            throw new Error(
                `Invalid persisted customer voucher: ${voucher._id}`
            );
        }

        if (voucher.reserved_booking_id) {
            const booking = bookingById.get(
                toId(voucher.reserved_booking_id)
            );
            const expectedUpdate =
                plan.voucherPlan.bookingVoucherUpdates.find(
                    (update) => sameId(
                        update.booking_id,
                        booking?._id
                    )
                );

            if (
                !booking
                || !expectedUpdate
                || !sameId(
                    booking.customer_voucher_id,
                    voucher._id
                )
                || booking.voucher_discount_amount
                    !== expectedUpdate.voucher_discount_amount
                || !sameId(booking.customer_id, voucher.customer_id)
                || !sameId(booking.garage_id, voucher.garage_id)
            ) {
                throw new Error(
                    `Invalid voucher booking relation: ${voucher._id}`
                );
            }
        }
    }

    for (const customerCase of customerCases) {
        const expected = expectedCaseById.get(toId(customerCase._id));
        const booking = bookingById.get(toId(customerCase.booking_id));

        if (
            !expected
            || !booking
            || customerCase.status !== expected.status
            || customerCase.category !== expected.category
            || customerCase.priority !== expected.priority
            || customerCase.source !== expected.source
            || customerCase.is_walk_in_case
                !== expected.is_walk_in_case
            || !sameId(customerCase.garage_id, booking.garage_id)
            || !sameId(customerCase.customer_id, booking.customer_id)
            || customerCase.reopen_count !== expected.reopen_count
            || customerCase.escalation_level
                !== expected.escalation_level
        ) {
            throw new Error(
                `Invalid persisted customer case: ${customerCase._id}`
            );
        }
    }

    const expectedDependentIds = new Set([
        ...plan.messages,
        ...plan.assessments,
        ...plan.resolutions,
        ...plan.refunds,
        ...plan.events,
    ].map((definition) => toId(definition._id)));
    const persistedDependents = [
        ...messages,
        ...assessments,
        ...resolutions,
        ...refunds,
        ...events,
    ];

    if (
        persistedDependents.length !== expectedDependentIds.size
        || persistedDependents.some(
            (definition) => !expectedDependentIds.has(toId(definition._id))
        )
    ) {
        throw new Error(
            `Customer case dependent relation mismatch: ${persistedDependents.length}/${expectedDependentIds.size}`
        );
    }

    const expectedPointById = new Map(
        plan.loyaltyHandoverPlan.pointTransactions.map(
            (transaction) => [
                transaction.transaction_id_hex,
                transaction,
            ]
        )
    );

    for (const transaction of pointTransactions) {
        const expected = expectedPointById.get(toId(transaction._id));

        if (
            !expected
            || transaction.type !== expected.type
            || transaction.points !== expected.points
            || transaction.remaining_points
                !== expected.remaining_points
            || transaction.balance_before !== expected.balance_before
            || transaction.balance_after !== expected.balance_after
        ) {
            throw new Error(
                `Voucher-adjusted point ledger mismatch: ${transaction._id}`
            );
        }
    }

    const expectedLoyaltyByCustomerId = new Map(
        plan.loyaltyHandoverPlan.customerLoyalties.map(
            (loyalty) => [toId(loyalty.customer_id), loyalty]
        )
    );

    for (const loyalty of customerLoyalties) {
        const expected = expectedLoyaltyByCustomerId.get(
            toId(loyalty.customer_id)
        );

        if (
            !expected
            || loyalty.current_tier !== expected.current_tier
            || loyalty.total_points !== expected.total_points
            || loyalty.available_points !== expected.available_points
            || loyalty.redeemed_points !== expected.redeemed_points
            || loyalty.total_spent !== expected.total_spent
            || loyalty.total_visits !== expected.total_visits
        ) {
            throw new Error(
                `Voucher-adjusted loyalty mismatch: ${loyalty._id}`
            );
        }
    }

    const expectedWashById = new Map(
        plan.loyaltyHandoverPlan.washHistories.map(
            (history) => [history.wash_history_id_hex, history]
        )
    );

    for (const history of washHistories) {
        const expected = expectedWashById.get(toId(history._id));

        if (
            !expected
            || history.amount_paid !== expected.amount_paid
            || history.discount_amount !== expected.discount_amount
            || history.points_earned !== expected.points_earned
            || history.points_used !== expected.points_used
        ) {
            throw new Error(
                `Voucher-adjusted wash history mismatch: ${history._id}`
            );
        }
    }

    const handoverUpdateById = new Map(
        plan.handoverUpdates.map((update) => [
            toId(update.handover_id),
            update,
        ])
    );

    for (const handover of handovers) {
        const expectedUpdate = handoverUpdateById.get(toId(handover._id));

        if (expectedUpdate) {
            if (
                handover.state !== expectedUpdate.state
                || handover.customer_response
                    !== BOOKING_HANDOVER_RESPONSES.ISSUE_REPORTED
                || handover.issue_case_ids.map(toId).join(',')
                    !== expectedUpdate.issue_case_ids.map(toId).join(',')
            ) {
                throw new Error(
                    `Customer case handover mismatch: ${handover._id}`
                );
            }
        }
    }

    const activeIncident = incidents.find((incident) => (
        incident.status
        === BOOKING_INCIDENT_STATUS.AWAITING_CUSTOMER_DECISION
    ));
    const activeBooking = bookingById.get(
        toId(activeIncident?.booking_id)
    );
    const activeWashBay = activeIncident?.affected_wash_bay_id
        ? await WashBay.findById(
            activeIncident.affected_wash_bay_id
        ).lean()
        : null;

    if (
        !activeIncident
        || !activeBooking
        || activeBooking.operation_status
            !== BOOKING_OPERATION_STATUS.AWAITING_CUSTOMER_DECISION
        || !sameId(activeBooking.active_incident_id, activeIncident._id)
        || !activeBooking.booking_items.some(
            (item) => item.status === BOOKING_ITEM_STATUS.PAUSED
        )
        || !activeWashBay
        || activeWashBay.status !== WASH_BAY_STATUS.MAINTENANCE
        || activeWashBay.current_booking_id
    ) {
        throw new Error('Active incident hold relation is invalid');
    }

    const canceledIncidentBookings = incidents
        .filter((incident) => (
            incident.decision
            === BOOKING_INCIDENT_DECISIONS.CANCEL_BY_GARAGE
        ))
        .map((incident) => bookingById.get(toId(incident.booking_id)));

    if (
        violations.length !== 0
        || canceledIncidentBookings.some((booking) => (
            !booking
            || booking.status !== BOOKING_STATUS.CANCELED
            || booking.payment_status !== BOOKING_PAYMENT_STATUS.UNPAID
            || booking.cancellation_source
                !== BOOKING_CANCELLATION_SOURCES.GARAGE_INCIDENT
        ))
    ) {
        throw new Error(
            'Garage incident cancellation relation is invalid'
        );
    }

    const persistedSummary = summarizePlan({
        incidentDefinitions: incidents,
        voucherDefinitions: vouchers,
        customerCases,
        messages,
        assessments,
        resolutions,
        refunds,
        events,
        garageCodeById: plan.staffMaps.garageCodeById,
    });

    assertPlanTargets(persistedSummary);

    if (
        persistedSummary.dependents.events
        !== plan.summary.dependents.events
        || incidents.length !== incidentIds.length
        || vouchers.length !== voucherIds.length
        || customerCases.length !== caseIds.length
        || pointTransactions.length
            !== plan.loyaltyHandoverPlan.pointTransactions.length
        || customerLoyalties.length
            !== plan.loyaltyHandoverPlan.customerLoyalties.length
        || washHistories.length
            !== plan.loyaltyHandoverPlan.washHistories.length
    ) {
        throw new Error('Persisted incident and case totals mismatch');
    }

    return persistedSummary;
};

const seedIncidentsVouchersCustomerCases = async ({
    dryRun = process.argv.includes('--dry-run'),
} = {}) => {
    const referenceDate = getSeedReferenceDate();

    await connectDB();

    if (dryRun) {
        try {
            return await seedIncidentsVouchersCustomerCasesData({
                referenceDate,
                dryRun: true,
            });
        } finally {
            await disconnectDB();
        }
    }

    const session = await Booking.startSession();
    const result = {
        dry_run: false,
        reference_date: referenceDate,
    };

    try {
        await session.withTransaction(async () => {
            result.seed =
                await seedIncidentsVouchersCustomerCasesData({
                    session,
                    referenceDate,
                });
        });

        result.payment_promotion_verification =
            await verifyPaymentsPromotionUsages({ referenceDate });
        result.verification =
            await verifyIncidentsVouchersCustomerCases({
                referenceDate,
            });

        return result;
    } finally {
        await session.endSession();
        await disconnectDB();
    }
};

const run = async () => {
    try {
        const result = await seedIncidentsVouchersCustomerCases();

        console.log(
            'Incidents, vouchers and customer cases seed completed'
        );
        console.dir(result.verification || result, { depth: null });
    } catch (error) {
        console.error(
            'Incidents, vouchers and customer cases seed failed:',
            error
        );
        process.exitCode = 1;

        await disconnectDB().catch(() => {});
    }
};

if (require.main === module) {
    run();
}

module.exports = {
    takeEvenly,
    selectIncidentBookings,
    buildIncidentDefinitions,
    selectCustomerCaseBookings,
    buildCustomerCaseDefinitions,
    buildCustomerCaseMessages,
    buildTechnicalAssessmentDefinitions,
    buildResolutionDefinitions,
    buildRefundDefinitions,
    buildVoucherDefinitions,
    buildCustomerCaseEvents,
    buildCaseHandoverUpdates,
    summarizePlan,
    assertPlanTargets,
    buildSeedPlan,
    seedIncidentsVouchersCustomerCasesData,
    verifyIncidentsVouchersCustomerCases,
    seedIncidentsVouchersCustomerCases,
};
