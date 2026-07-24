const User = require('../users/user.model');
const StaffProfile = require('../staff-profiles/staffProfile.model');
const notificationService = require('../notifications/notification.service');
const { USER_ROLES } = require('../../shared/constants/roles.constant');
const {
    STAFF_TYPES,
    STAFF_EMPLOYMENT_STATUS,
} = require('../../shared/constants/staff.constant');
const {
    NOTIFICATION_TYPES,
    NOTIFICATION_RELATED_TYPES,
} = require('../../shared/constants/notification.constant');

const toId = (value) => value?._id?.toString?.() || value?.toString?.() || null;

const uniqueUserIds = (values = []) => [...new Set(values.map(toId).filter(Boolean))];

const findGarageCustomerServiceUserIds = async (garageId) => {
    const profiles = await StaffProfile.find({
        garage_id: garageId,
        staff_type: STAFF_TYPES.CUSTOMER_SERVICE_STAFF,
        is_active: true,
        employment_status: STAFF_EMPLOYMENT_STATUS.ACTIVE,
    }).select('user_id');

    const profileUserIds = uniqueUserIds(profiles.map((profile) => profile.user_id));

    if (profileUserIds.length === 0) {
        return [];
    }

    const activeUsers = await User.find({
        _id: { $in: profileUserIds },
        role: USER_ROLES.STAFF,
        is_active: true,
    }).select('_id');

    return uniqueUserIds(activeUsers);
};

const findAdminUserIds = async () => {
    const admins = await User.find({ role: USER_ROLES.ADMIN, is_active: true }).select('_id');
    return uniqueUserIds(admins);
};

const notifyUsers = async ({ userIds, type, title, message, relatedType, relatedId, metadata = {}, excludeUserId = null }) => {
    const excluded = toId(excludeUserId);
    const recipients = uniqueUserIds(userIds).filter((userId) => userId !== excluded);

    return Promise.all(recipients.map((userId) => notificationService.createInAppNotification({
        userId,
        type,
        title,
        message,
        relatedType,
        relatedId,
        metadata,
    })));
};

const notifyHandoverReady = async (handover) => notifyUsers({
    userIds: [handover.customer_id],
    type: NOTIFICATION_TYPES.BOOKING_HANDOVER_READY,
    title: 'Vehicle ready for handover',
    message: 'Your vehicle is ready. Please review the inspection information before confirming receipt.',
    relatedType: NOTIFICATION_RELATED_TYPES.BOOKING_HANDOVER,
    relatedId: handover._id,
    metadata: { booking_id: toId(handover.booking_id) },
});

const notifyHandoverAccepted = async (handover, actorId) => {
    const [customerServiceIds, adminIds] = await Promise.all([
        findGarageCustomerServiceUserIds(handover.garage_id),
        findAdminUserIds(),
    ]);

    return notifyUsers({
        userIds: [...customerServiceIds, ...adminIds],
        excludeUserId: actorId,
        type: NOTIFICATION_TYPES.BOOKING_HANDOVER_ACCEPTED,
        title: 'Vehicle condition accepted',
        message: 'The customer confirmed the vehicle condition and payment can proceed.',
        relatedType: NOTIFICATION_RELATED_TYPES.BOOKING_HANDOVER,
        relatedId: handover._id,
        metadata: { booking_id: toId(handover.booking_id) },
    });
};

const notifyHandoverReleased = async (handover, actorId) => notifyUsers({
    userIds: [handover.customer_id],
    excludeUserId: actorId,
    type: NOTIFICATION_TYPES.BOOKING_HANDOVER_RELEASED,
    title: 'Vehicle handed over',
    message: 'The garage confirmed that the vehicle was physically handed over.',
    relatedType: NOTIFICATION_RELATED_TYPES.BOOKING_HANDOVER,
    relatedId: handover._id,
    metadata: { booking_id: toId(handover.booking_id) },
});

const notifyCaseSubmitted = async (customerCase, actorId) => {
    const [customerServiceIds, adminIds] = await Promise.all([
        findGarageCustomerServiceUserIds(customerCase.garage_id),
        findAdminUserIds(),
    ]);
    const metadata = {
        case_id: toId(customerCase._id),
        case_code: customerCase.case_code,
        booking_id: toId(customerCase.booking_id),
        priority: customerCase.priority,
    };

    return Promise.all([
        notifyUsers({
            userIds: [customerCase.customer_id],
            type: NOTIFICATION_TYPES.CUSTOMER_CASE_SUBMITTED,
            title: `Issue ${customerCase.case_code} received`,
            message: 'Your issue was recorded and will be reviewed by the garage.',
            relatedType: NOTIFICATION_RELATED_TYPES.CUSTOMER_CASE,
            relatedId: customerCase._id,
            metadata,
        }),
        notifyUsers({
            userIds: [...customerServiceIds, ...adminIds],
            excludeUserId: actorId,
            type: NOTIFICATION_TYPES.CUSTOMER_CASE_SUBMITTED,
            title: `New customer case ${customerCase.case_code}`,
            message: `A ${customerCase.priority.toLowerCase()} priority customer issue requires triage.`,
            relatedType: NOTIFICATION_RELATED_TYPES.CUSTOMER_CASE,
            relatedId: customerCase._id,
            metadata,
        }),
    ]);
};

const notifyCaseAssigned = async (customerCase, assigneeId, actorId) => notifyUsers({
    userIds: [assigneeId],
    excludeUserId: actorId,
    type: NOTIFICATION_TYPES.CUSTOMER_CASE_ASSIGNED,
    title: `Case ${customerCase.case_code} assigned`,
    message: 'A customer case has been assigned to you.',
    relatedType: NOTIFICATION_RELATED_TYPES.CUSTOMER_CASE,
    relatedId: customerCase._id,
    metadata: { case_code: customerCase.case_code, booking_id: toId(customerCase.booking_id) },
});

const notifyCustomerCaseUpdate = async (customerCase, { type, title, message, actorId }) => notifyUsers({
    userIds: customerCase.customer_id ? [customerCase.customer_id] : [],
    excludeUserId: actorId,
    type,
    title,
    message,
    relatedType: NOTIFICATION_RELATED_TYPES.CUSTOMER_CASE,
    relatedId: customerCase._id,
    metadata: { case_code: customerCase.case_code, booking_id: toId(customerCase.booking_id) },
});

const notifyCaseMessage = async (customerCase, actor) => {
    if (actor.role === USER_ROLES.CUSTOMER) {
        const recipients = customerCase.assigned_to_id
            ? [customerCase.assigned_to_id]
            : await findGarageCustomerServiceUserIds(customerCase.garage_id);

        return notifyUsers({
            userIds: recipients,
            excludeUserId: actor._id,
            type: NOTIFICATION_TYPES.CUSTOMER_CASE_MESSAGE_RECEIVED,
            title: `New message on ${customerCase.case_code}`,
            message: 'The customer sent a new message.',
            relatedType: NOTIFICATION_RELATED_TYPES.CUSTOMER_CASE,
            relatedId: customerCase._id,
            metadata: { case_code: customerCase.case_code },
        });
    }

    return notifyCustomerCaseUpdate(customerCase, {
        actorId: actor._id,
        type: NOTIFICATION_TYPES.CUSTOMER_CASE_MESSAGE_RECEIVED,
        title: `New message on ${customerCase.case_code}`,
        message: 'The garage sent a new message about your reported issue.',
    });
};

module.exports = {
    notifyHandoverReady,
    notifyHandoverAccepted,
    notifyHandoverReleased,
    notifyCaseSubmitted,
    notifyCaseAssigned,
    notifyCustomerCaseUpdate,
    notifyCaseMessage,
    notifyUsers,
    findGarageCustomerServiceUserIds,
    findAdminUserIds,
};
