const FeedbackRewardRule = require('./feedbackRewardRule.model');
const PointTransaction = require('../loyalty/pointTransaction.model');
const CustomerLoyalty = require('../loyalty/customerLoyalty.model');
const LoyaltyRedeemRule = require('../loyalty/loyaltyRedeemRule.model');
const Booking = require('../bookings/booking.model');
const WashHistory = require('../wash-histories/washHistory.model');
const Survey = require('../surveys/survey.model');
const SurveyResponse = require('../surveys/surveyResponse.model');
const Review = require('../reviews/review.model');
const Notification = require('../notifications/notification.model');
const loyaltyService = require('../loyalty/loyalty.service');
const LoyaltyMapper = require('../loyalty/loyalty.mapper');
const notificationService = require('../notifications/notification.service');
const auditLogService = require('../audit-logs/auditLog.service');
const { AppError } = require('../../shared/utils/appError');
const {
    POINT_TRANSACTION_TYPES,
    POINT_EXPIRY_MONTHS,
} = require('../../shared/constants/loyalty.constant');
const {
    FEEDBACK_REWARD_RULE_CODE,
    FEEDBACK_REWARD_MAX_PER_BOOKING,
    FEEDBACK_REWARD_SOURCES,
    DEFAULT_FEEDBACK_REWARD_RULE,
} = require('../../shared/constants/feedbackReward.constant');
const {
    BOOKING_STATUS,
    BOOKING_PAYMENT_STATUS,
} = require('../../shared/constants/booking.constant');
const {
    NOTIFICATION_TYPES,
    NOTIFICATION_RELATED_TYPES,
} = require('../../shared/constants/notification.constant');
const {
    AUDIT_ACTIONS,
    AUDIT_RESOURCE_TYPES,
} = require('../../shared/constants/audit.constant');
const { SURVEY_STATUSES } = require('../../shared/constants/survey.constant');

const ACTIVE_PAYMENT_STATUSES = Object.freeze([
    BOOKING_PAYMENT_STATUS.PAID,
    BOOKING_PAYMENT_STATUS.WAIVED,
]);

const addMonths = (date, months) => {
    const result = new Date(date);

    result.setMonth(result.getMonth() + months);

    return result;
};

const toRuleDto = (rule) => {
    if (!rule) {
        return null;
    }

    const plainRule = rule.toObject ? rule.toObject() : rule;

    return {
        id: plainRule._id?.toString?.() || plainRule.id || null,
        rule_code: plainRule.rule_code,
        survey_points: plainRule.survey_points,
        review_points: plainRule.review_points,
        max_points_per_booking:
            (plainRule.survey_points || 0) + (plainRule.review_points || 0),
        review_window_days: plainRule.review_window_days,
        reminder_after_hours: plainRule.reminder_after_hours,
        count_toward_tier: plainRule.count_toward_tier,
        is_active: plainRule.is_active,
        starts_at: plainRule.starts_at,
        ends_at: plainRule.ends_at,
        created_by: plainRule.created_by?.toString?.() || null,
        updated_by: plainRule.updated_by?.toString?.() || null,
        created_at: plainRule.created_at,
        updated_at: plainRule.updated_at,
    };
};

const isRuleEffective = (rule, now = new Date()) => {
    if (!rule?.is_active) {
        return false;
    }

    if (rule.starts_at && rule.starts_at > now) {
        return false;
    }

    if (rule.ends_at && rule.ends_at < now) {
        return false;
    }

    return true;
};

const getRuleDocument = async (session = null) => {
    const query = FeedbackRewardRule.findOneAndUpdate(
        { rule_code: FEEDBACK_REWARD_RULE_CODE },
        {
            $setOnInsert: {
                ...DEFAULT_FEEDBACK_REWARD_RULE,
            },
        },
        {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
            session: session || undefined,
        }
    );

    return query;
};

const getRule = async () => {
    const rule = await getRuleDocument();

    return toRuleDto(rule);
};

const getEffectiveRule = async (session = null) => {
    const rule = await getRuleDocument(session);

    return isRuleEffective(rule) ? rule : null;
};

const updateRule = async (user, payload, auditContext = {}) => {
    const rule = await getRuleDocument();
    const before = toRuleDto(rule);
    const nextSurveyPoints = payload.survey_points ?? rule.survey_points;
    const nextReviewPoints = payload.review_points ?? rule.review_points;

    if (
        nextSurveyPoints + nextReviewPoints >
        FEEDBACK_REWARD_MAX_PER_BOOKING
    ) {
        throw new AppError(
            `Feedback rewards must not exceed ${FEEDBACK_REWARD_MAX_PER_BOOKING} points per booking`,
            400,
            'FEEDBACK_REWARD_BOOKING_LIMIT_EXCEEDED'
        );
    }

    Object.assign(rule, payload, {
        updated_by: user._id,
        created_by: rule.created_by || user._id,
    });

    await rule.save();

    const result = toRuleDto(rule);

    await auditLogService.recordAuditEvent({
        actorId: user._id,
        action: AUDIT_ACTIONS.FEEDBACK_REWARD_RULE_UPDATED,
        resourceType: AUDIT_RESOURCE_TYPES.FEEDBACK_REWARD_RULE,
        resourceId: rule._id,
        before,
        after: result,
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
    });

    return result;
};

const getTransactionType = (source) => {
    if (source === FEEDBACK_REWARD_SOURCES.SURVEY) {
        return POINT_TRANSACTION_TYPES.SURVEY_REWARD;
    }

    if (source === FEEDBACK_REWARD_SOURCES.REVIEW) {
        return POINT_TRANSACTION_TYPES.REVIEW_REWARD;
    }

    throw new AppError('Feedback reward source is invalid', 400, 'FEEDBACK_REWARD_SOURCE_INVALID');
};

const getRewardPoints = (rule, source) => {
    return source === FEEDBACK_REWARD_SOURCES.SURVEY
        ? rule.survey_points
        : rule.review_points;
};

const getQualifyingPoints = (loyalty) => {
    if (Number.isFinite(loyalty.qualifying_points)) {
        return loyalty.qualifying_points;
    }

    return Math.max(
        0,
        (Number(loyalty.total_points) || 0) - (Number(loyalty.bonus_points) || 0)
    );
};

const awardFeedbackReward = async ({
    customerId,
    bookingId,
    source,
    sourceId,
    session = null,
} = {}) => {
    const transactionType = getTransactionType(source);
    const existingQuery = PointTransaction.findOne({
        booking_id: bookingId,
        type: transactionType,
    });

    if (session) {
        existingQuery.session(session);
    }

    const existingTransaction = await existingQuery;

    if (existingTransaction) {
        if (existingTransaction.customer_id.toString() !== customerId.toString()) {
            throw new AppError(
                'Feedback reward belongs to another customer',
                409,
                'FEEDBACK_REWARD_CUSTOMER_CONFLICT'
            );
        }

        return {
            awarded: true,
            already_processed: true,
            points: existingTransaction.points,
            point_transaction: LoyaltyMapper.toPointTransactionDto(existingTransaction),
            rule: existingTransaction.rule_snapshot || null,
        };
    }

    const rule = await getEffectiveRule(session);

    if (!rule) {
        return {
            awarded: false,
            already_processed: false,
            points: 0,
            point_transaction: null,
            rule: null,
        };
    }

    const points = getRewardPoints(rule, source);

    if (!points || points <= 0) {
        return {
            awarded: false,
            already_processed: false,
            points: 0,
            point_transaction: null,
            rule: toRuleDto(rule),
        };
    }

    const loyalty = await loyaltyService.getOrCreateCustomerLoyalty(customerId, session);
    const now = new Date();
    const balanceBefore = loyalty.available_points;
    const balanceAfter = balanceBefore + points;
    const qualifyingPointsBefore = getQualifyingPoints(loyalty);

    loyalty.total_points += points;
    loyalty.available_points = balanceAfter;

    if (rule.count_toward_tier) {
        loyalty.qualifying_points = qualifyingPointsBefore + points;
    } else {
        loyalty.qualifying_points = qualifyingPointsBefore;
        loyalty.bonus_points = (Number(loyalty.bonus_points) || 0) + points;
    }

    if (rule.count_toward_tier) {
        await loyaltyService.reviewCustomerTier(loyalty, session);
    }

    await loyalty.save(session ? { session } : undefined);

    const ruleSnapshot = toRuleDto(rule);
    const transactions = await PointTransaction.create(
        [
            {
                customer_id: customerId,
                booking_id: bookingId,
                source_id: sourceId,
                type: transactionType,
                points,
                remaining_points: points,
                balance_before: balanceBefore,
                balance_after: balanceAfter,
                description: source === FEEDBACK_REWARD_SOURCES.SURVEY
                    ? 'Reward points for completed post-service survey'
                    : 'Reward points for completed garage and service review',
                earned_at: now,
                expires_at: addMonths(now, POINT_EXPIRY_MONTHS),
                expired_at: null,
                source_transaction_ids: [],
                created_by: customerId,
                counts_toward_tier: rule.count_toward_tier,
                rule_snapshot: ruleSnapshot,
            },
        ],
        session ? { session } : undefined
    );
    const pointTransaction = transactions[0];

    await notificationService.emitFeedbackRewardEarned({
        customerId,
        bookingId,
        source,
        points,
        transactionId: pointTransaction._id,
        session,
    });

    return {
        awarded: true,
        already_processed: false,
        points,
        point_transaction: LoyaltyMapper.toPointTransactionDto(pointTransaction),
        loyalty: LoyaltyMapper.toCustomerLoyaltyDto(loyalty),
        rule: ruleSnapshot,
    };
};

const getReviewDeadline = (rule, booking, washHistory) => {
    const baseDate = washHistory?.service_completed_at || booking?.completed_at;

    if (!baseDate) {
        return null;
    }

    const deadline = new Date(baseDate);

    deadline.setUTCDate(deadline.getUTCDate() + rule.review_window_days);

    return deadline;
};

const assertReviewWindowOpen = async ({ booking, washHistory, session = null }) => {
    const rule = await getRuleDocument(session);
    const deadline = getReviewDeadline(rule, booking, washHistory);

    if (deadline && deadline < new Date()) {
        throw new AppError(
            'Review submission window has expired',
            409,
            'REVIEW_WINDOW_EXPIRED'
        );
    }

    return {
        deadline,
        reward_points: isRuleEffective(rule) ? rule.review_points : 0,
    };
};

const getCustomerFeedbackStatus = async (customerId, bookingId) => {
    const booking = await Booking.findOne({
        _id: bookingId,
        $or: [
            { customer_id: customerId },
            { claimed_customer_id: customerId },
        ],
    });

    if (!booking) {
        throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    const [
        rule,
        washHistory,
        survey,
        surveyResponse,
        review,
        transactions,
        loyalty,
    ] = await Promise.all([
        getRuleDocument(),
        WashHistory.findOne({ booking_id: booking._id, customer_id: customerId }),
        Survey.findOne({ status: SURVEY_STATUSES.PUBLISHED }).sort({
            published_at: -1,
        }),
        SurveyResponse.findOne({ booking_id: booking._id, customer_id: customerId }),
        Review.findOne({ booking_id: booking._id, customer_id: customerId }),
        PointTransaction.find({
            booking_id: booking._id,
            type: {
                $in: [
                    POINT_TRANSACTION_TYPES.SURVEY_REWARD,
                    POINT_TRANSACTION_TYPES.REVIEW_REWARD,
                ],
            },
        }),
        CustomerLoyalty.findOne({ customer_id: customerId }),
    ]);
    const transactionByType = new Map(
        transactions.map((transaction) => [transaction.type, transaction])
    );
    const surveyTransaction = transactionByType.get(POINT_TRANSACTION_TYPES.SURVEY_REWARD);
    const reviewTransaction = transactionByType.get(POINT_TRANSACTION_TYPES.REVIEW_REWARD);
    const reviewDeadline = getReviewDeadline(rule, booking, washHistory);
    const responseBaseDate = washHistory?.service_completed_at || booking.completed_at;
    const surveyDeadline = survey && responseBaseDate
        ? new Date(responseBaseDate)
        : null;

    if (surveyDeadline) {
        surveyDeadline.setUTCDate(
            surveyDeadline.getUTCDate() + survey.response_window_days
        );
    }

    const settled = ACTIVE_PAYMENT_STATUSES.includes(booking.payment_status);
    const eligibleContext = booking.status === BOOKING_STATUS.COMPLETED && settled && Boolean(washHistory);

    return {
        booking_id: booking._id.toString(),
        eligible_context: eligibleContext,
        rule: toRuleDto(rule),
        survey: {
            completed: Boolean(surveyResponse),
            rewarded: Boolean(surveyTransaction),
            reward_points: isRuleEffective(rule) ? rule.survey_points : 0,
            awarded_points: surveyTransaction?.points || 0,
            rewarded_at: surveyTransaction?.earned_at || null,
            transaction_id: surveyTransaction?._id?.toString() || null,
            response_expires_at: surveyDeadline,
            response_window_open: Boolean(survey) &&
                (!surveyDeadline || surveyDeadline >= new Date()),
        },
        review: {
            completed: Boolean(review),
            rewarded: Boolean(reviewTransaction),
            reward_points: isRuleEffective(rule) ? rule.review_points : 0,
            awarded_points: reviewTransaction?.points || 0,
            rewarded_at: reviewTransaction?.earned_at || null,
            transaction_id: reviewTransaction?._id?.toString() || null,
            response_expires_at: reviewDeadline,
            response_window_open: !reviewDeadline || reviewDeadline >= new Date(),
        },
        total_awarded_points:
            (surveyTransaction?.points || 0) + (reviewTransaction?.points || 0),
        available_points: loyalty?.available_points || 0,
    };
};

const buildDateMatch = ({ from, to } = {}) => {
    const createdAt = {};

    if (from) {
        createdAt.$gte = from;
    }

    if (to) {
        createdAt.$lte = to;
    }

    return Object.keys(createdAt).length > 0 ? { created_at: createdAt } : {};
};

const getAnalytics = async ({ from, to } = {}) => {
    const dateMatch = buildDateMatch({ from, to });
    const rewardFilter = {
        ...dateMatch,
        type: {
            $in: [
                POINT_TRANSACTION_TYPES.SURVEY_REWARD,
                POINT_TRANSACTION_TYPES.REVIEW_REWARD,
            ],
        },
    };
    const notificationFilter = {
        ...dateMatch,
        type: {
            $in: [
                NOTIFICATION_TYPES.SURVEY_REQUEST,
                NOTIFICATION_TYPES.REVIEW_REQUEST,
            ],
        },
    };
    const [
        rule,
        rewards,
        invitationStats,
        surveyResponses,
        surveyStats,
        reviewStats,
        redeemRule,
    ] =
        await Promise.all([
            getRuleDocument(),
            PointTransaction.aggregate([
                { $match: rewardFilter },
                {
                    $group: {
                        _id: '$type',
                        count: { $sum: 1 },
                        points: { $sum: '$points' },
                        remaining_points: { $sum: '$remaining_points' },
                        customers: { $addToSet: '$customer_id' },
                    },
                },
            ]),
            Notification.aggregate([
                { $match: notificationFilter },
                {
                    $group: {
                        _id: '$type',
                        total: { $sum: 1 },
                        opened: {
                            $sum: {
                                $cond: [{ $eq: ['$in_app_status', 'READ'] }, 1, 0],
                            },
                        },
                    },
                },
            ]),
            SurveyResponse.countDocuments(dateMatch),
            SurveyResponse.aggregate([
                { $match: dateMatch },
                { $unwind: '$answers' },
                {
                    $match: {
                        'answers.question_type_snapshot': 'NPS',
                        'answers.numeric_value': { $ne: null },
                    },
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        promoters: {
                            $sum: {
                                $cond: [{ $gte: ['$answers.numeric_value', 9] }, 1, 0],
                            },
                        },
                        detractors: {
                            $sum: {
                                $cond: [{ $lte: ['$answers.numeric_value', 6] }, 1, 0],
                            },
                        },
                    },
                },
            ]),
            Review.aggregate([
                {
                    $match: {
                        ...dateMatch,
                        deleted_at: null,
                    },
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        hidden: {
                            $sum: {
                                $cond: [{ $eq: ['$moderation_status', 'HIDDEN'] }, 1, 0],
                            },
                        },
                        spam: {
                            $sum: {
                                $cond: [{ $eq: ['$moderation_reason', 'SPAM'] }, 1, 0],
                            },
                        },
                        average_garage_rating: {
                            $avg: {
                                $cond: [
                                    { $eq: ['$moderation_status', 'PUBLISHED'] },
                                    '$garage_rating',
                                    null,
                                ],
                            },
                        },
                        average_service_rating: {
                            $avg: {
                                $cond: [
                                    { $eq: ['$moderation_status', 'PUBLISHED'] },
                                    '$service_rating',
                                    null,
                                ],
                            },
                        },
                    },
                },
            ]),
            LoyaltyRedeemRule.findOne({ is_active: true }).sort({ created_at: -1 }),
        ]);
    const rewardByType = new Map(rewards.map((item) => [item._id, item]));
    const invitationByType = new Map(invitationStats.map((item) => [item._id, item]));
    const surveyReward = rewardByType.get(POINT_TRANSACTION_TYPES.SURVEY_REWARD);
    const reviewReward = rewardByType.get(POINT_TRANSACTION_TYPES.REVIEW_REWARD);
    const surveyInvitation = invitationByType.get(NOTIFICATION_TYPES.SURVEY_REQUEST);
    const reviewInvitation = invitationByType.get(NOTIFICATION_TYPES.REVIEW_REQUEST);
    const surveyResponseCount = surveyResponses;
    const reviewCount = reviewStats[0]?.total || 0;
    const invitationCount =
        (surveyInvitation?.total || 0) + (reviewInvitation?.total || 0);
    const openedInvitationCount =
        (surveyInvitation?.opened || 0) + (reviewInvitation?.opened || 0);
    const totalPoints = (surveyReward?.points || 0) + (reviewReward?.points || 0);
    const remainingPoints =
        (surveyReward?.remaining_points || 0) + (reviewReward?.remaining_points || 0);
    const consumedPoints = Math.max(0, totalPoints - remainingPoints);
    const rewardedFeedbackCount =
        (surveyReward?.count || 0) + (reviewReward?.count || 0);
    const estimatedValueAmount = totalPoints * (redeemRule?.point_value_amount || 0);
    const npsAnswers = surveyStats[0] || null;
    const npsScore = npsAnswers?.total
        ? Number(
            (
                ((npsAnswers.promoters - npsAnswers.detractors) / npsAnswers.total) *
                100
            ).toFixed(2)
        )
        : null;
    const uniqueCustomers = new Set([
        ...(surveyReward?.customers || []).map((item) => item.toString()),
        ...(reviewReward?.customers || []).map((item) => item.toString()),
    ]);

    return {
        period: {
            from: from || null,
            to: to || null,
        },
        rule: toRuleDto(rule),
        invitations: {
            total: invitationCount,
            opened: openedInvitationCount,
            open_rate: invitationCount > 0
                ? Number(((openedInvitationCount / invitationCount) * 100).toFixed(2))
                : 0,
            survey: {
                total: surveyInvitation?.total || 0,
                opened: surveyInvitation?.opened || 0,
                open_rate: surveyInvitation?.total
                    ? Number(
                        (
                            ((surveyInvitation.opened || 0) / surveyInvitation.total) *
                            100
                        ).toFixed(2)
                    )
                    : 0,
            },
            review: {
                total: reviewInvitation?.total || 0,
                opened: reviewInvitation?.opened || 0,
                open_rate: reviewInvitation?.total
                    ? Number(
                        (
                            ((reviewInvitation.opened || 0) / reviewInvitation.total) *
                            100
                        ).toFixed(2)
                    )
                    : 0,
            },
        },
        completions: {
            survey_responses: surveyResponseCount,
            reviews: reviewCount,
            survey_rate: surveyInvitation?.total
                ? Number(((surveyResponseCount / surveyInvitation.total) * 100).toFixed(2))
                : 0,
            review_rate: reviewInvitation?.total
                ? Number(((reviewCount / reviewInvitation.total) * 100).toFixed(2))
                : 0,
        },
        rewards: {
            survey_count: surveyReward?.count || 0,
            survey_points: surveyReward?.points || 0,
            review_count: reviewReward?.count || 0,
            review_points: reviewReward?.points || 0,
            unique_customers: uniqueCustomers.size,
            total_points: totalPoints,
            remaining_points: remainingPoints,
            consumed_points_estimate: consumedPoints,
            estimated_value_amount: estimatedValueAmount,
            estimated_cost_per_feedback: rewardedFeedbackCount > 0
                ? Number((estimatedValueAmount / rewardedFeedbackCount).toFixed(2))
                : 0,
        },
        quality: {
            hidden_reviews: reviewStats[0]?.hidden || 0,
            spam_reviews: reviewStats[0]?.spam || 0,
            nps_response_count: npsAnswers?.total || 0,
            nps_score: npsScore,
            average_garage_rating: reviewStats[0]?.average_garage_rating
                ? Number(reviewStats[0].average_garage_rating.toFixed(2))
                : null,
            average_service_rating: reviewStats[0]?.average_service_rating
                ? Number(reviewStats[0].average_service_rating.toFixed(2))
                : null,
        },
    };
};

const sendDueReminders = async ({ limit = 100 } = {}) => {
    const rule = await getEffectiveRule();

    if (!rule) {
        return {
            scanned: 0,
            sent: 0,
        };
    }

    const cutoff = new Date(Date.now() - rule.reminder_after_hours * 60 * 60 * 1000);
    const oldestAllowed = new Date(
        Date.now() - Math.max(rule.review_window_days, 7) * 24 * 60 * 60 * 1000
    );
    const requests = await Notification.find({
        type: NOTIFICATION_TYPES.REVIEW_REQUEST,
        created_at: {
            $gte: oldestAllowed,
            $lte: cutoff,
        },
    })
        .sort({ created_at: 1 })
        .limit(limit);
    let sent = 0;

    for (const request of requests) {
        const existingReminder = await Notification.exists({
            user_id: request.user_id,
            type: NOTIFICATION_TYPES.FEEDBACK_REMINDER,
            related_type: NOTIFICATION_RELATED_TYPES.BOOKING,
            related_id: request.related_id,
        });

        if (existingReminder) {
            continue;
        }

        const rewardCount = await PointTransaction.countDocuments({
            customer_id: request.user_id,
            booking_id: request.related_id,
            type: {
                $in: [
                    POINT_TRANSACTION_TYPES.SURVEY_REWARD,
                    POINT_TRANSACTION_TYPES.REVIEW_REWARD,
                ],
            },
        });

        if (rewardCount >= 2) {
            continue;
        }

        await notificationService.emitFeedbackReminder({
            customerId: request.user_id,
            bookingId: request.related_id,
            remainingRewardCount: 2 - rewardCount,
        });
        sent += 1;
    }

    return {
        scanned: requests.length,
        sent,
    };
};

module.exports = {
    getRule,
    getEffectiveRule,
    updateRule,
    awardFeedbackReward,
    assertReviewWindowOpen,
    getCustomerFeedbackStatus,
    getAnalytics,
    sendDueReminders,
    toRuleDto,
};
