const mongoose = require('mongoose');

const Booking = require('../bookings/booking.model');
const User = require('../users/user.model');
const WashHistory = require('../wash-histories/washHistory.model');
const PromotionUsage = require('../promotion-usages/promotionUsage.model');
const Survey = require('../surveys/survey.model');
const SurveyResponse = require('../surveys/surveyResponse.model');
const PaymentTransaction = require('../payments/paymentTransaction.model');
const CustomerLoyalty = require('../loyalty/customerLoyalty.model');
const {
    BOOKING_STATUS,
} = require('../../shared/constants/booking.constant');
const { USER_ROLES } = require('../../shared/constants/roles.constant');
const {
    PROMOTION_USAGE_STATUS,
} = require('../../shared/constants/promotion.constant');
const {
    SURVEY_QUESTION_TYPES,
} = require('../../shared/constants/survey.constant');
const {
    ANALYTICS_GROUP_BY,
} = require('../../shared/constants/analytics.constant');
const {
    PAYMENT_TRANSACTION_STATUS,
    PAYMENT_INITIATED_CHANNEL,
} = require('../../shared/constants/payment.constant');
const {
    LOYALTY_TIER_VALUES,
} = require('../../shared/constants/loyalty.constant');
const { AppError } = require('../../shared/utils/appError');

const round = (value, precision = 2) => {
    const numericValue = Number(value || 0);
    const factor = 10 ** precision;

    return Math.round((numericValue + Number.EPSILON) * factor) / factor;
};

const percentage = (part, total) => {
    if (!total) {
        return 0;
    }

    return round((part / total) * 100);
};

const toObjectId = (value) => {
    return value ? new mongoose.Types.ObjectId(value) : null;
};

const getTimezone = () => {
    return process.env.APP_TIMEZONE_OFFSET || '+07:00';
};

const getPeriod = (filters = {}) => ({
    from: filters.from || null,
    to: filters.to || null,
    timezone: getTimezone(),
    group_by: filters.group_by || ANALYTICS_GROUP_BY.DAY,
});

const buildMatch = (filters = {}, dateField) => {
    const match = {};
    const dateRange = {};

    if (filters.from) {
        dateRange.$gte = filters.from;
    }

    if (filters.to) {
        dateRange.$lte = filters.to;
    }

    if (Object.keys(dateRange).length > 0) {
        match[dateField] = dateRange;
    }

    if (filters.garage_id) {
        match.garage_id = toObjectId(filters.garage_id);
    }

    if (filters.service_package_id) {
        match.service_package_id = toObjectId(filters.service_package_id);
    }

    if (filters.vehicle_type) {
        match.vehicle_type = filters.vehicle_type;
    }

    return match;
};

const getDateGroupExpression = (field, groupBy = ANALYTICS_GROUP_BY.DAY) => {
    const formats = {
        [ANALYTICS_GROUP_BY.DAY]: '%Y-%m-%d',
        [ANALYTICS_GROUP_BY.WEEK]: '%G-W%V',
        [ANALYTICS_GROUP_BY.MONTH]: '%Y-%m',
        [ANALYTICS_GROUP_BY.YEAR]: '%Y',
    };

    return {
        $dateToString: {
            date: field,
            format: formats[groupBy] || formats[ANALYTICS_GROUP_BY.DAY],
            timezone: getTimezone(),
        },
    };
};

const mapKeyCount = (rows = []) => {
    return rows.map((row) => ({
        key: row._id === null ? null : row._id?.toString?.() || row._id,
        count: row.count || 0,
    }));
};

const mapTrend = (rows = []) => {
    return rows.map((row) => ({
        period: row._id,
        count: row.count || 0,
        revenue: round(row.revenue),
    }));
};

const mapTierDistribution = (rows = []) => {
    const distribution = Object.fromEntries(
        LOYALTY_TIER_VALUES.map((tier) => [tier, 0])
    );

    rows.forEach((row) => {
        if (LOYALTY_TIER_VALUES.includes(row._id)) {
            distribution[row._id] = row.count || 0;
        }
    });

    return distribution;
};

const getOverview = async (
    filters = {},
    { includeTierDistribution = true } = {}
) => {
    const bookingMatch = buildMatch(filters, 'start_time');
    const revenueMatch = buildMatch(filters, 'paid_at');
    const [bookingRows, revenueRows, tierRows] = await Promise.all([
        Booking.aggregate([
            { $match: bookingMatch },
            {
                $group: {
                    _id: null,
                    total_bookings: { $sum: 1 },
                    completed_bookings: {
                        $sum: { $cond: [{ $eq: ['$status', BOOKING_STATUS.COMPLETED] }, 1, 0] },
                    },
                    canceled_bookings: {
                        $sum: { $cond: [{ $eq: ['$status', BOOKING_STATUS.CANCELED] }, 1, 0] },
                    },
                    no_show_bookings: {
                        $sum: { $cond: [{ $eq: ['$status', BOOKING_STATUS.NO_SHOW] }, 1, 0] },
                    },
                    registered_customer_bookings: {
                        $sum: { $cond: [{ $ne: ['$customer_id', null] }, 1, 0] },
                    },
                    walk_in_bookings: {
                        $sum: { $cond: ['$is_walk_in', 1, 0] },
                    },
                    unique_registered_customers: {
                        $addToSet: {
                            $cond: [{ $ne: ['$customer_id', null] }, '$customer_id', '$$REMOVE'],
                        },
                    },
                },
            },
        ]),
        WashHistory.aggregate([
            { $match: revenueMatch },
            {
                $group: {
                    _id: null,
                    total_revenue: { $sum: '$amount_paid' },
                    paid_booking_count: { $sum: 1 },
                    original_revenue: { $sum: '$original_price' },
                    total_discount: { $sum: '$discount_amount' },
                },
            },
        ]),
        includeTierDistribution
            ? CustomerLoyalty.aggregate([
                {
                    $group: {
                        _id: '$current_tier',
                        count: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ])
            : Promise.resolve([]),
    ]);

    const booking = bookingRows[0] || {};
    const revenue = revenueRows[0] || {};
    const totalBookings = booking.total_bookings || 0;

    return {
        period: getPeriod(filters),
        metrics: {
            total_bookings: totalBookings,
            completed_bookings: booking.completed_bookings || 0,
            canceled_bookings: booking.canceled_bookings || 0,
            no_show_bookings: booking.no_show_bookings || 0,
            completion_rate: percentage(booking.completed_bookings, totalBookings),
            cancellation_rate: percentage(booking.canceled_bookings, totalBookings),
            no_show_rate: percentage(booking.no_show_bookings, totalBookings),
            registered_customer_bookings: booking.registered_customer_bookings || 0,
            unique_registered_customers: booking.unique_registered_customers?.length || 0,
            walk_in_bookings: booking.walk_in_bookings || 0,
            total_revenue: round(revenue.total_revenue),
            original_revenue: round(revenue.original_revenue),
            total_discount: round(revenue.total_discount),
            average_order_value: revenue.paid_booking_count
                ? round(revenue.total_revenue / revenue.paid_booking_count)
                : 0,
        },
        ...(includeTierDistribution
            ? { tier_distribution: mapTierDistribution(tierRows) }
            : {}),
        generated_at: new Date(),
    };
};

const buildCustomerProfileStages = () => [
    { $match: { customer_id: { $ne: null } } },
    {
        $group: {
            _id: {
                customer_id: '$customer_id',
                service_package_id: '$service_package_id',
            },
            usage_count: { $sum: 1 },
            service_spent: { $sum: '$amount_paid' },
            last_visit_at: { $max: '$paid_at' },
        },
    },
    {
        $lookup: {
            from: 'service_packages',
            localField: '_id.service_package_id',
            foreignField: '_id',
            as: 'service_package',
        },
    },
    { $unwind: { path: '$service_package', preserveNullAndEmptyArrays: true } },
    {
        $sort: {
            '_id.customer_id': 1,
            usage_count: -1,
            service_spent: -1,
            '_id.service_package_id': 1,
        },
    },
    {
        $group: {
            _id: '$_id.customer_id',
            total_visits: { $sum: '$usage_count' },
            total_spent: { $sum: '$service_spent' },
            distinct_service_count: { $sum: 1 },
            favorite_service_id: { $first: '$_id.service_package_id' },
            favorite_service_name: { $first: '$service_package.name' },
            favorite_service_usage_count: { $first: '$usage_count' },
            last_visit_at: { $max: '$last_visit_at' },
        },
    },
    {
        $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'customer',
        },
    },
    { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
    {
        $project: {
            _id: 0,
            customer_id: '$_id',
            full_name: { $ifNull: ['$customer.full_name', ''] },
            is_active: { $ifNull: ['$customer.is_active', false] },
            total_visits: 1,
            total_spent: 1,
            average_order_value: {
                $cond: [
                    { $gt: ['$total_visits', 0] },
                    { $divide: ['$total_spent', '$total_visits'] },
                    0,
                ],
            },
            distinct_service_count: 1,
            favorite_service_id: 1,
            favorite_service_name: { $ifNull: ['$favorite_service_name', ''] },
            favorite_service_usage_count: 1,
            last_visit_at: 1,
        },
    },
];

const mapCustomerRows = (rows = []) => rows.map((row) => ({
    customer_id: row.customer_id?.toString?.() || row.customer_id || null,
    full_name: row.full_name || '',
    is_active: Boolean(row.is_active),
    total_visits: row.total_visits || 0,
    total_spent: round(row.total_spent),
    average_order_value: round(row.average_order_value),
    distinct_service_count: row.distinct_service_count || 0,
    favorite_service: {
        id: row.favorite_service_id?.toString?.() || row.favorite_service_id || null,
        name: row.favorite_service_name || '',
        usage_count: row.favorite_service_usage_count || 0,
    },
    last_visit_at: row.last_visit_at || null,
}));

const getStaffOverview = async (
    filters = {},
    { garageId, includeRevenue = false } = {}
) => {
    if (!garageId) {
        throw new AppError(
            'Staff garage assignment is required',
            403,
            'STAFF_GARAGE_REQUIRED'
        );
    }

    const overview = await getOverview(
        {
            ...filters,
            garage_id: garageId,
        },
        {
            includeTierDistribution: false,
        }
    );

    if (includeRevenue) {
        return overview;
    }

    const metrics = { ...overview.metrics };
    [
        'total_revenue',
        'original_revenue',
        'total_discount',
        'average_order_value',
    ].forEach((key) => {
        delete metrics[key];
    });

    return {
        ...overview,
        metrics,
    };
};

const getBookingAnalytics = async (filters = {}) => {
    const match = buildMatch(filters, 'start_time');
    const [result = {}] = await Booking.aggregate([
        { $match: match },
        {
            $facet: {
                status_distribution: [
                    { $group: { _id: '$status', count: { $sum: 1 } } },
                    { $sort: { count: -1, _id: 1 } },
                ],
                trend: [
                    {
                        $group: {
                            _id: getDateGroupExpression('$start_time', filters.group_by),
                            count: { $sum: 1 },
                        },
                    },
                    { $sort: { _id: 1 } },
                ],
                garage_distribution: [
                    { $group: { _id: '$garage_id', count: { $sum: 1 } } },
                    { $sort: { count: -1 } },
                ],
                vehicle_type_distribution: [
                    { $group: { _id: '$vehicle_type', count: { $sum: 1 } } },
                    { $sort: { count: -1 } },
                ],
                time_of_day_distribution: [
                    {
                        $project: {
                            bucket: {
                                $switch: {
                                    branches: [
                                        {
                                            case: {
                                                $lt: [
                                                    { $hour: { date: '$start_time', timezone: getTimezone() } },
                                                    12,
                                                ],
                                            },
                                            then: 'MORNING',
                                        },
                                        {
                                            case: {
                                                $lt: [
                                                    { $hour: { date: '$start_time', timezone: getTimezone() } },
                                                    18,
                                                ],
                                            },
                                            then: 'AFTERNOON',
                                        },
                                    ],
                                    default: 'EVENING',
                                },
                            },
                        },
                    },
                    { $group: { _id: '$bucket', count: { $sum: 1 } } },
                    { $sort: { _id: 1 } },
                ],
                metrics: [
                    {
                        $group: {
                            _id: null,
                            total_bookings: { $sum: 1 },
                            completed_bookings: {
                                $sum: {
                                    $cond: [
                                        { $eq: ['$status', BOOKING_STATUS.COMPLETED] },
                                        1,
                                        0,
                                    ],
                                },
                            },
                            canceled_bookings: {
                                $sum: {
                                    $cond: [
                                        { $eq: ['$status', BOOKING_STATUS.CANCELED] },
                                        1,
                                        0,
                                    ],
                                },
                            },
                            no_show_bookings: {
                                $sum: {
                                    $cond: [
                                        { $eq: ['$status', BOOKING_STATUS.NO_SHOW] },
                                        1,
                                        0,
                                    ],
                                },
                            },
                            scheduled_duration_average: {
                                $avg: {
                                    $dateDiff: {
                                        startDate: '$start_time',
                                        endDate: '$end_time',
                                        unit: 'minute',
                                    },
                                },
                            },
                            actual_duration_average: {
                                $avg: {
                                    $cond: [
                                        {
                                            $and: [
                                                { $ne: ['$started_at', null] },
                                                { $ne: ['$completed_at', null] },
                                            ],
                                        },
                                        {
                                            $dateDiff: {
                                                startDate: '$started_at',
                                                endDate: '$completed_at',
                                                unit: 'minute',
                                            },
                                        },
                                        null,
                                    ],
                                },
                            },
                            late_booking_count: {
                                $sum: { $cond: [{ $gt: ['$late_minutes', 0] }, 1, 0] },
                            },
                            reschedule_count: { $sum: { $ifNull: ['$reschedule_count', 0] } },
                            walk_in_bookings: { $sum: { $cond: ['$is_walk_in', 1, 0] } },
                            registered_customer_bookings: {
                                $sum: { $cond: [{ $ne: ['$customer_id', null] }, 1, 0] },
                            },
                        },
                    },
                ],
            },
        },
    ]);

    const metrics = result.metrics?.[0] || {};
    const totalBookings = metrics.total_bookings || 0;

    return {
        period: getPeriod(filters),
        metrics: {
            total_bookings: totalBookings,
            completed_bookings: metrics.completed_bookings || 0,
            canceled_bookings: metrics.canceled_bookings || 0,
            no_show_bookings: metrics.no_show_bookings || 0,
            completion_rate: percentage(metrics.completed_bookings, totalBookings),
            cancellation_rate: percentage(metrics.canceled_bookings, totalBookings),
            no_show_rate: percentage(metrics.no_show_bookings, totalBookings),
            scheduled_duration_average_minutes: round(metrics.scheduled_duration_average),
            actual_duration_average_minutes: round(metrics.actual_duration_average),
            late_booking_count: metrics.late_booking_count || 0,
            reschedule_count: metrics.reschedule_count || 0,
            walk_in_bookings: metrics.walk_in_bookings || 0,
            registered_customer_bookings: metrics.registered_customer_bookings || 0,
        },
        status_distribution: mapKeyCount(result.status_distribution),
        trend: mapTrend(result.trend),
        garage_distribution: mapKeyCount(result.garage_distribution),
        vehicle_type_distribution: mapKeyCount(result.vehicle_type_distribution),
        time_of_day_distribution: mapKeyCount(result.time_of_day_distribution),
        generated_at: new Date(),
    };
};

const getCustomerAnalytics = async (filters = {}) => {
    const accountDateMatch = {};

    if (filters.from || filters.to) {
        accountDateMatch.created_at = {};

        if (filters.from) {
            accountDateMatch.created_at.$gte = filters.from;
        }

        if (filters.to) {
            accountDateMatch.created_at.$lte = filters.to;
        }
    }

    const paidActivityMatch = {
        $expr: { $eq: ['$customer_id', '$$customerId'] },
    };

    if (filters.to) {
        paidActivityMatch.paid_at = { $lte: filters.to };
    }

    const bookingMatch = buildMatch(filters, 'start_time');
    const washHistoryMatch = buildMatch(filters, 'paid_at');
    const profileStages = buildCustomerProfileStages();

    const [accountRows, bookingRows, customerRows] = await Promise.all([
        User.aggregate([
            { $match: { role: USER_ROLES.CUSTOMER } },
            {
                $facet: {
                    account_metrics: [
                        {
                            $group: {
                                _id: null,
                                total_customers: { $sum: 1 },
                                active_accounts: {
                                    $sum: { $cond: ['$is_active', 1, 0] },
                                },
                                locked_accounts: {
                                    $sum: { $cond: ['$is_active', 0, 1] },
                                },
                                verified_accounts: {
                                    $sum: {
                                        $cond: [
                                            { $ne: ['$phone_verified_at', null] },
                                            1,
                                            0,
                                        ],
                                    },
                                },
                            },
                        },
                    ],
                    registrations: [
                        { $match: accountDateMatch },
                        { $count: 'new_customers' },
                    ],
                    registration_trend: [
                        { $match: accountDateMatch },
                        {
                            $group: {
                                _id: getDateGroupExpression(
                                    '$created_at',
                                    filters.group_by
                                ),
                                count: { $sum: 1 },
                            },
                        },
                        { $sort: { _id: 1 } },
                    ],
                    funnel: [
                        { $match: accountDateMatch },
                        {
                            $lookup: {
                                from: 'wash_histories',
                                let: {
                                    customerId: '$_id',
                                },
                                pipeline: [
                                    { $match: paidActivityMatch },
                                    {
                                        $group: {
                                            _id: null,
                                            paid_visits: { $sum: 1 },
                                            first_paid_at: { $min: '$paid_at' },
                                        },
                                    },
                                ],
                                as: 'paid_activity',
                            },
                        },
                        {
                            $set: {
                                paid_visits: {
                                    $ifNull: [
                                        { $first: '$paid_activity.paid_visits' },
                                        0,
                                    ],
                                },
                                first_paid_at: {
                                    $first: '$paid_activity.first_paid_at',
                                },
                            },
                        },
                        {
                            $group: {
                                _id: null,
                                registered_customers: { $sum: 1 },
                                activated_customers: {
                                    $sum: {
                                        $cond: [
                                            { $gt: ['$paid_visits', 0] },
                                            1,
                                            0,
                                        ],
                                    },
                                },
                                repeat_customers: {
                                    $sum: {
                                        $cond: [
                                            { $gte: ['$paid_visits', 2] },
                                            1,
                                            0,
                                        ],
                                    },
                                },
                                average_days_to_first_paid_visit: {
                                    $avg: {
                                        $cond: [
                                            {
                                                $and: [
                                                    { $ne: ['$first_paid_at', null] },
                                                    {
                                                        $gte: [
                                                            '$first_paid_at',
                                                            '$created_at',
                                                        ],
                                                    },
                                                ],
                                            },
                                            {
                                                $dateDiff: {
                                                    startDate: '$created_at',
                                                    endDate: '$first_paid_at',
                                                    unit: 'day',
                                                },
                                            },
                                            null,
                                        ],
                                    },
                                },
                            },
                        },
                    ],
                },
            },
        ]),
        Booking.aggregate([
            { $match: bookingMatch },
            {
                $group: {
                    _id: null,
                    total_bookings: { $sum: 1 },
                    walk_in_bookings: {
                        $sum: { $cond: ['$is_walk_in', 1, 0] },
                    },
                    registered_customer_bookings: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ['$is_walk_in', false] },
                                        { $ne: ['$customer_id', null] },
                                    ],
                                },
                                1,
                                0,
                            ],
                        },
                    },
                    walk_in_completed_bookings: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        '$is_walk_in',
                                        {
                                            $eq: [
                                                '$status',
                                                BOOKING_STATUS.COMPLETED,
                                            ],
                                        },
                                    ],
                                },
                                1,
                                0,
                            ],
                        },
                    },
                    registered_completed_bookings: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ['$is_walk_in', false] },
                                        { $ne: ['$customer_id', null] },
                                        {
                                            $eq: [
                                                '$status',
                                                BOOKING_STATUS.COMPLETED,
                                            ],
                                        },
                                    ],
                                },
                                1,
                                0,
                            ],
                        },
                    },
                },
            },
        ]),
        WashHistory.aggregate([
            { $match: washHistoryMatch },
            {
                $lookup: {
                    from: 'bookings',
                    localField: 'booking_id',
                    foreignField: '_id',
                    as: 'booking_origin',
                },
            },
            {
                $set: {
                    origin_is_walk_in: {
                        $ifNull: [
                            { $first: '$booking_origin.is_walk_in' },
                            { $eq: ['$customer_id', null] },
                        ],
                    },
                },
            },
            { $unset: 'booking_origin' },
            {
                $facet: {
                    metrics: [
                        {
                            $group: {
                                _id: null,
                                total_paid_visits: { $sum: 1 },
                                total_revenue: { $sum: '$amount_paid' },
                                registered_paid_visits: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $and: [
                                                    { $eq: ['$origin_is_walk_in', false] },
                                                    { $ne: ['$customer_id', null] },
                                                ],
                                            },
                                            1,
                                            0,
                                        ],
                                    },
                                },
                                walk_in_paid_visits: {
                                    $sum: {
                                        $cond: [
                                            '$origin_is_walk_in',
                                            1,
                                            0,
                                        ],
                                    },
                                },
                                registered_revenue: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $and: [
                                                    { $eq: ['$origin_is_walk_in', false] },
                                                    { $ne: ['$customer_id', null] },
                                                ],
                                            },
                                            '$amount_paid',
                                            0,
                                        ],
                                    },
                                },
                                walk_in_revenue: {
                                    $sum: {
                                        $cond: [
                                            '$origin_is_walk_in',
                                            '$amount_paid',
                                            0,
                                        ],
                                    },
                                },
                                paying_customers: {
                                    $addToSet: {
                                        $cond: [
                                            { $ne: ['$customer_id', null] },
                                            '$customer_id',
                                            '$$REMOVE',
                                        ],
                                    },
                                },
                            },
                        },
                    ],
                    by_visits: [
                        ...profileStages,
                        {
                            $sort: {
                                total_visits: -1,
                                total_spent: -1,
                                customer_id: 1,
                            },
                        },
                        { $limit: 10 },
                    ],
                    by_spending: [
                        ...profileStages,
                        {
                            $sort: {
                                total_spent: -1,
                                total_visits: -1,
                                customer_id: 1,
                            },
                        },
                        { $limit: 10 },
                    ],
                    by_service_variety: [
                        ...profileStages,
                        {
                            $sort: {
                                distinct_service_count: -1,
                                total_visits: -1,
                                total_spent: -1,
                                customer_id: 1,
                            },
                        },
                        { $limit: 10 },
                    ],
                    single_service_repeat: [
                        ...profileStages,
                        {
                            $match: {
                                distinct_service_count: 1,
                                total_visits: { $gte: 2 },
                            },
                        },
                        {
                            $sort: {
                                total_visits: -1,
                                total_spent: -1,
                                customer_id: 1,
                            },
                        },
                        { $limit: 10 },
                    ],
                    activity_distribution: [
                        ...profileStages,
                        {
                            $group: {
                                _id: {
                                    $switch: {
                                        branches: [
                                            {
                                                case: {
                                                    $eq: ['$total_visits', 1],
                                                },
                                                then: 'ONE_TIME',
                                            },
                                            {
                                                case: {
                                                    $lt: ['$total_visits', 5],
                                                },
                                                then: 'REPEAT',
                                            },
                                        ],
                                        default: 'LOYAL',
                                    },
                                },
                                count: { $sum: 1 },
                            },
                        },
                        { $sort: { _id: 1 } },
                    ],
                },
            },
        ]),
    ]);

    const accountResult = accountRows[0] || {};
    const bookingResult = bookingRows[0] || {};
    const customerResult = customerRows[0] || {};
    const accountMetrics = accountResult.account_metrics?.[0] || {};
    const registrationMetrics = accountResult.registrations?.[0] || {};
    const funnel = accountResult.funnel?.[0] || {};
    const bookingMetrics = bookingResult || {};
    const valueMetrics = customerResult.metrics?.[0] || {};
    const totalBookings = bookingMetrics.total_bookings || 0;
    const walkInBookings = bookingMetrics.walk_in_bookings || 0;
    const registeredBookings = bookingMetrics.registered_customer_bookings || 0;
    const registeredCustomers = funnel.registered_customers || 0;
    const activatedCustomers = funnel.activated_customers || 0;
    const payingCustomerCount = valueMetrics.paying_customers?.length || 0;
    const totalPaidVisits = valueMetrics.total_paid_visits || 0;

    return {
        period: getPeriod(filters),
        account_metrics: {
            total_customers: accountMetrics.total_customers || 0,
            new_customers: registrationMetrics.new_customers || 0,
            active_accounts: accountMetrics.active_accounts || 0,
            locked_accounts: accountMetrics.locked_accounts || 0,
            verified_accounts: accountMetrics.verified_accounts || 0,
            verification_rate: percentage(
                accountMetrics.verified_accounts,
                accountMetrics.total_customers
            ),
        },
        funnel: {
            registered_customers: registeredCustomers,
            activated_customers: activatedCustomers,
            registered_without_paid_visit:
                registeredCustomers - activatedCustomers,
            repeat_customers: funnel.repeat_customers || 0,
            activation_rate: percentage(
                activatedCustomers,
                registeredCustomers
            ),
            repeat_rate: percentage(
                funnel.repeat_customers,
                activatedCustomers
            ),
            average_days_to_first_paid_visit: round(
                funnel.average_days_to_first_paid_visit
            ),
        },
        registration_trend: (accountResult.registration_trend || []).map((row) => ({
            period: row._id,
            count: row.count || 0,
            group_by: filters.group_by || ANALYTICS_GROUP_BY.DAY,
        })),
        booking_mix: {
            total_bookings: totalBookings,
            walk_in: {
                bookings: walkInBookings,
                share: percentage(walkInBookings, totalBookings),
                completed_bookings:
                    bookingMetrics.walk_in_completed_bookings || 0,
                completion_rate: percentage(
                    bookingMetrics.walk_in_completed_bookings,
                    walkInBookings
                ),
            },
            registered_customer: {
                bookings: registeredBookings,
                share: percentage(registeredBookings, totalBookings),
                completed_bookings:
                    bookingMetrics.registered_completed_bookings || 0,
                completion_rate: percentage(
                    bookingMetrics.registered_completed_bookings,
                    registeredBookings
                ),
            },
        },
        customer_value_metrics: {
            unique_paying_customers: payingCustomerCount,
            total_paid_visits: totalPaidVisits,
            total_revenue: round(valueMetrics.total_revenue),
            average_order_value: totalPaidVisits
                ? round(valueMetrics.total_revenue / totalPaidVisits)
                : 0,
            average_paid_visits_per_customer: payingCustomerCount
                ? round(valueMetrics.registered_paid_visits / payingCustomerCount)
                : 0,
            registered_paid_visits: valueMetrics.registered_paid_visits || 0,
            walk_in_paid_visits: valueMetrics.walk_in_paid_visits || 0,
            registered_revenue: round(valueMetrics.registered_revenue),
            walk_in_revenue: round(valueMetrics.walk_in_revenue),
        },
        activity_distribution: mapKeyCount(
            customerResult.activity_distribution
        ),
        top_customers: {
            by_visits: mapCustomerRows(customerResult.by_visits),
            by_spending: mapCustomerRows(customerResult.by_spending),
            by_service_variety: mapCustomerRows(
                customerResult.by_service_variety
            ),
            single_service_repeat: mapCustomerRows(
                customerResult.single_service_repeat
            ),
        },
        generated_at: new Date(),
    };
};

const getRevenueAnalytics = async (filters = {}) => {
    const match = buildMatch(filters, 'paid_at');
    const [result = {}] = await WashHistory.aggregate([
        { $match: match },
        {
            $lookup: {
                from: 'garages',
                localField: 'garage_id',
                foreignField: '_id',
                as: 'garage',
            },
        },
        { $unwind: { path: '$garage', preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: 'service_packages',
                localField: 'service_package_id',
                foreignField: '_id',
                as: 'service_package',
            },
        },
        { $unwind: { path: '$service_package', preserveNullAndEmptyArrays: true } },
        {
            $facet: {
                metrics: [
                    {
                        $group: {
                            _id: null,
                            paid_booking_count: { $sum: 1 },
                            net_revenue: { $sum: '$amount_paid' },
                            original_revenue: { $sum: '$original_price' },
                            total_discount: { $sum: '$discount_amount' },
                        },
                    },
                ],
                trend: [
                    {
                        $group: {
                            _id: getDateGroupExpression('$paid_at', filters.group_by),
                            count: { $sum: 1 },
                            revenue: { $sum: '$amount_paid' },
                        },
                    },
                    { $sort: { _id: 1 } },
                ],
                by_garage: [
                    {
                        $group: {
                            _id: {
                                id: '$garage_id',
                                name: '$garage.name',
                                code: '$garage.garage_code',
                            },
                            count: { $sum: 1 },
                            revenue: { $sum: '$amount_paid' },
                        },
                    },
                    { $sort: { revenue: -1 } },
                ],
                by_service_package: [
                    {
                        $group: {
                            _id: {
                                id: '$service_package_id',
                                name: '$service_package.name',
                                service_type: '$service_package.service_type',
                            },
                            count: { $sum: 1 },
                            revenue: { $sum: '$amount_paid' },
                        },
                    },
                    { $sort: { revenue: -1 } },
                ],
                by_vehicle_type: [
                    {
                        $group: {
                            _id: '$vehicle_type',
                            count: { $sum: 1 },
                            revenue: { $sum: '$amount_paid' },
                        },
                    },
                    { $sort: { revenue: -1 } },
                ],
                by_payment_method: [
                    {
                        $group: {
                            _id: '$payment_method',
                            count: { $sum: 1 },
                            revenue: { $sum: '$amount_paid' },
                        },
                    },
                    { $sort: { revenue: -1 } },
                ],
            },
        },
    ]);

    const metrics = result.metrics?.[0] || {};
    const mapRevenueRows = (rows = []) => rows.map((row) => ({
        key: row._id,
        count: row.count || 0,
        revenue: round(row.revenue),
    }));

    return {
        period: getPeriod(filters),
        metrics: {
            paid_booking_count: metrics.paid_booking_count || 0,
            net_revenue: round(metrics.net_revenue),
            original_revenue: round(metrics.original_revenue),
            total_discount: round(metrics.total_discount),
            average_order_value: metrics.paid_booking_count
                ? round(metrics.net_revenue / metrics.paid_booking_count)
                : 0,
        },
        trend: mapTrend(result.trend),
        by_garage: mapRevenueRows(result.by_garage),
        by_primary_service_package: mapRevenueRows(result.by_service_package),
        by_vehicle_type: mapRevenueRows(result.by_vehicle_type),
        by_payment_method: mapRevenueRows(result.by_payment_method),
        generated_at: new Date(),
    };
};

const getPerformanceAnalytics = async (filters, dimension) => {
    const configs = {
        garage: {
            field: 'garage_id',
            collection: 'garages',
            nameField: 'name',
            codeField: 'garage_code',
        },
        service: {
            field: 'service_package_id',
            collection: 'service_packages',
            nameField: 'name',
            codeField: 'service_type',
        },
    };
    const config = configs[dimension];
    const bookingMatch = buildMatch(filters, 'start_time');
    const revenueMatch = buildMatch(filters, 'paid_at');
    const [bookingRows, revenueRows] = await Promise.all([
        Booking.aggregate([
            { $match: bookingMatch },
            {
                $lookup: {
                    from: config.collection,
                    localField: config.field,
                    foreignField: '_id',
                    as: 'dimension',
                },
            },
            { $unwind: { path: '$dimension', preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: `$${config.field}`,
                    name: { $first: `$dimension.${config.nameField}` },
                    code: { $first: `$dimension.${config.codeField}` },
                    total_bookings: { $sum: 1 },
                    completed_bookings: {
                        $sum: { $cond: [{ $eq: ['$status', BOOKING_STATUS.COMPLETED] }, 1, 0] },
                    },
                    canceled_bookings: {
                        $sum: { $cond: [{ $eq: ['$status', BOOKING_STATUS.CANCELED] }, 1, 0] },
                    },
                    no_show_bookings: {
                        $sum: { $cond: [{ $eq: ['$status', BOOKING_STATUS.NO_SHOW] }, 1, 0] },
                    },
                    scheduled_duration_average: {
                        $avg: {
                            $dateDiff: {
                                startDate: '$start_time',
                                endDate: '$end_time',
                                unit: 'minute',
                            },
                        },
                    },
                    actual_duration_average: {
                        $avg: {
                            $cond: [
                                {
                                    $and: [
                                        { $ne: ['$started_at', null] },
                                        { $ne: ['$completed_at', null] },
                                    ],
                                },
                                {
                                    $dateDiff: {
                                        startDate: '$started_at',
                                        endDate: '$completed_at',
                                        unit: 'minute',
                                    },
                                },
                                null,
                            ],
                        },
                    },
                },
            },
        ]),
        WashHistory.aggregate([
            { $match: revenueMatch },
            {
                $group: {
                    _id: `$${config.field}`,
                    revenue: { $sum: '$amount_paid' },
                    paid_booking_count: { $sum: 1 },
                },
            },
        ]),
    ]);
    const revenueById = new Map(revenueRows.map((row) => [row._id.toString(), row]));

    return {
        period: getPeriod(filters),
        data: bookingRows
            .map((row) => {
                const revenue = revenueById.get(row._id.toString()) || {};

                return {
                    id: row._id.toString(),
                    name: row.name || null,
                    code: row.code || null,
                    total_bookings: row.total_bookings || 0,
                    completed_bookings: row.completed_bookings || 0,
                    canceled_bookings: row.canceled_bookings || 0,
                    no_show_bookings: row.no_show_bookings || 0,
                    completion_rate: percentage(row.completed_bookings, row.total_bookings),
                    cancellation_rate: percentage(row.canceled_bookings, row.total_bookings),
                    no_show_rate: percentage(row.no_show_bookings, row.total_bookings),
                    scheduled_duration_average_minutes: round(row.scheduled_duration_average),
                    actual_duration_average_minutes: round(row.actual_duration_average),
                    revenue: round(revenue.revenue),
                    average_order_value: revenue.paid_booking_count
                        ? round(revenue.revenue / revenue.paid_booking_count)
                        : 0,
                };
            })
            .sort((first, second) => second.revenue - first.revenue),
        generated_at: new Date(),
    };
};

const getGarageAnalytics = async (filters = {}) => {
    return getPerformanceAnalytics(filters, 'garage');
};

const getServiceAnalytics = async (filters = {}) => {
    return getPerformanceAnalytics(filters, 'service');
};

const getPromotionAnalytics = async (filters = {}) => {
    const match = {
        status: PROMOTION_USAGE_STATUS.CONSUMED,
    };
    const consumedAtRange = {};

    if (filters.from) {
        consumedAtRange.$gte = filters.from;
    }

    if (filters.to) {
        consumedAtRange.$lte = filters.to;
    }

    if (Object.keys(consumedAtRange).length > 0) {
        match.consumed_at = consumedAtRange;
    }

    const bookingMatch = {};

    if (filters.garage_id) {
        bookingMatch['booking.garage_id'] = toObjectId(filters.garage_id);
    }

    if (filters.service_package_id) {
        bookingMatch['booking.service_package_id'] = toObjectId(filters.service_package_id);
    }

    if (filters.vehicle_type) {
        bookingMatch['booking.vehicle_type'] = filters.vehicle_type;
    }

    const pipeline = [
        { $match: match },
        {
            $lookup: {
                from: 'bookings',
                localField: 'booking_id',
                foreignField: '_id',
                as: 'booking',
            },
        },
        { $unwind: '$booking' },
        {
            $lookup: {
                from: 'promotions',
                localField: 'promotion_id',
                foreignField: '_id',
                as: 'promotion',
            },
        },
        { $unwind: { path: '$promotion', preserveNullAndEmptyArrays: true } },
    ];

    if (Object.keys(bookingMatch).length > 0) {
        pipeline.push({ $match: bookingMatch });
    }

    pipeline.push({
        $facet: {
            metrics: [
                {
                    $group: {
                        _id: null,
                        consumed_usage_count: { $sum: 1 },
                        total_discount: { $sum: '$discount_amount' },
                        promoted_booking_revenue: { $sum: '$booking.final_price' },
                        walk_in_usage_count: { $sum: { $cond: ['$booking.is_walk_in', 1, 0] } },
                        unique_customers: {
                            $addToSet: {
                                $cond: [{ $ne: ['$customer_id', null] }, '$customer_id', '$$REMOVE'],
                            },
                        },
                    },
                },
            ],
            top_promotions: [
                {
                    $group: {
                        _id: {
                            id: '$promotion_id',
                            code: '$promotion.code',
                            name: '$promotion.name',
                        },
                        usage_count: { $sum: 1 },
                        total_discount: { $sum: '$discount_amount' },
                        revenue: { $sum: '$booking.final_price' },
                    },
                },
                { $sort: { usage_count: -1, revenue: -1 } },
                { $limit: 10 },
            ],
            usage_by_garage: [
                {
                    $group: {
                        _id: '$booking.garage_id',
                        count: { $sum: 1 },
                    },
                },
                { $sort: { count: -1 } },
            ],
        },
    });

    const [result = {}] = await PromotionUsage.aggregate(pipeline);
    const metrics = result.metrics?.[0] || {};

    return {
        period: getPeriod(filters),
        metrics: {
            consumed_usage_count: metrics.consumed_usage_count || 0,
            unique_customer_count: metrics.unique_customers?.length || 0,
            walk_in_usage_count: metrics.walk_in_usage_count || 0,
            total_discount: round(metrics.total_discount),
            promoted_booking_revenue: round(metrics.promoted_booking_revenue),
            average_discount: metrics.consumed_usage_count
                ? round(metrics.total_discount / metrics.consumed_usage_count)
                : 0,
        },
        top_promotions: (result.top_promotions || []).map((row) => ({
            promotion: row._id,
            usage_count: row.usage_count || 0,
            total_discount: round(row.total_discount),
            revenue: round(row.revenue),
        })),
        usage_by_garage: mapKeyCount(result.usage_by_garage),
        generated_at: new Date(),
    };
};

const parseOperatingMinutes = (openingTime, closingTime) => {
    const toMinutes = (value) => {
        const [hour, minute] = String(value || '').split(':').map(Number);

        return Number.isInteger(hour) && Number.isInteger(minute) ? hour * 60 + minute : 0;
    };
    const openingMinutes = toMinutes(openingTime);
    const closingMinutes = toMinutes(closingTime);

    return Math.max(closingMinutes - openingMinutes, 0);
};

const getInclusivePeriodDays = (filters = {}) => {
    if (!filters.from || !filters.to) {
        return null;
    }

    const milliseconds = filters.to.getTime() - filters.from.getTime();

    return Math.max(Math.floor(milliseconds / 86400000) + 1, 1);
};

const getWashBayAnalytics = async (filters = {}) => {
    const match = buildMatch(filters, 'service_completed_at');

    match.wash_bay_id = { $ne: null };

    const [result = {}] = await WashHistory.aggregate([
        { $match: match },
        {
            $lookup: {
                from: 'wash_bays',
                localField: 'wash_bay_id',
                foreignField: '_id',
                as: 'wash_bay',
            },
        },
        { $unwind: '$wash_bay' },
        {
            $lookup: {
                from: 'garages',
                localField: 'garage_id',
                foreignField: '_id',
                as: 'garage',
            },
        },
        { $unwind: { path: '$garage', preserveNullAndEmptyArrays: true } },
        {
            $facet: {
                metrics: [
                    {
                        $group: {
                            _id: null,
                            assigned_booking_count: { $sum: 1 },
                            occupied_minutes: {
                                $sum: {
                                    $cond: [
                                        {
                                            $and: [
                                                { $ne: ['$service_started_at', null] },
                                                { $ne: ['$service_completed_at', null] },
                                            ],
                                        },
                                        {
                                            $dateDiff: {
                                                startDate: '$service_started_at',
                                                endDate: '$service_completed_at',
                                                unit: 'minute',
                                            },
                                        },
                                        0,
                                    ],
                                },
                            },
                        },
                    },
                ],
                by_wash_bay: [
                    {
                        $group: {
                            _id: {
                                id: '$wash_bay_id',
                                name: '$wash_bay.name',
                                bay_code: '$wash_bay.bay_code',
                                garage_id: '$garage_id',
                                garage_name: '$garage.name',
                                opening_time: '$garage.opening_time',
                                closing_time: '$garage.closing_time',
                            },
                            booking_count: { $sum: 1 },
                            occupied_minutes: {
                                $sum: {
                                    $cond: [
                                        {
                                            $and: [
                                                { $ne: ['$service_started_at', null] },
                                                { $ne: ['$service_completed_at', null] },
                                            ],
                                        },
                                        {
                                            $dateDiff: {
                                                startDate: '$service_started_at',
                                                endDate: '$service_completed_at',
                                                unit: 'minute',
                                            },
                                        },
                                        0,
                                    ],
                                },
                            },
                            revenue: { $sum: '$amount_paid' },
                            average_service_duration: {
                                $avg: {
                                    $cond: [
                                        {
                                            $and: [
                                                { $ne: ['$service_started_at', null] },
                                                { $ne: ['$service_completed_at', null] },
                                            ],
                                        },
                                        {
                                            $dateDiff: {
                                                startDate: '$service_started_at',
                                                endDate: '$service_completed_at',
                                                unit: 'minute',
                                            },
                                        },
                                        null,
                                    ],
                                },
                            },
                        },
                    },
                    { $sort: { occupied_minutes: -1 } },
                ],
                vehicle_type_split: [
                    { $group: { _id: '$vehicle_type', count: { $sum: 1 } } },
                    { $sort: { count: -1 } },
                ],
            },
        },
    ]);
    const periodDays = getInclusivePeriodDays(filters);
    let totalAvailableMinutes = 0;
    const byWashBay = (result.by_wash_bay || []).map((row) => {
        const dailyMinutes = parseOperatingMinutes(
            row._id.opening_time,
            row._id.closing_time
        );
        const availableMinutes = periodDays ? dailyMinutes * periodDays : null;

        if (availableMinutes) {
            totalAvailableMinutes += availableMinutes;
        }

        return {
            wash_bay: {
                id: row._id.id?.toString() || null,
                name: row._id.name || null,
                bay_code: row._id.bay_code || null,
                garage_id: row._id.garage_id?.toString() || null,
                garage_name: row._id.garage_name || null,
            },
            booking_count: row.booking_count || 0,
            occupied_minutes: row.occupied_minutes || 0,
            estimated_utilization: availableMinutes
                ? percentage(row.occupied_minutes, availableMinutes)
                : null,
            revenue: round(row.revenue),
            average_service_duration_minutes: round(row.average_service_duration),
        };
    });
    const metrics = result.metrics?.[0] || {};

    return {
        period: getPeriod(filters),
        metrics: {
            assigned_booking_count: metrics.assigned_booking_count || 0,
            occupied_minutes: metrics.occupied_minutes || 0,
            estimated_utilization: totalAvailableMinutes
                ? percentage(metrics.occupied_minutes, totalAvailableMinutes)
                : null,
        },
        by_wash_bay: byWashBay,
        vehicle_type_split: mapKeyCount(result.vehicle_type_split),
        data_quality_notes: periodDays
            ? ['Utilization excludes unavailable and maintenance history because it is not stored.']
            : ['Utilization requires both from and to filters.'],
        generated_at: new Date(),
    };
};

const buildSurveyResponsePipeline = (surveyId, filters = {}) => {
    const responseMatch = {
        survey_id: toObjectId(surveyId),
    };
    const submittedAtRange = {};

    if (filters.from) {
        submittedAtRange.$gte = filters.from;
    }

    if (filters.to) {
        submittedAtRange.$lte = filters.to;
    }

    if (Object.keys(submittedAtRange).length > 0) {
        responseMatch.submitted_at = submittedAtRange;
    }

    const historyMatch = {};

    if (filters.garage_id) {
        historyMatch['wash_history.garage_id'] = toObjectId(filters.garage_id);
    }

    if (filters.service_package_id) {
        historyMatch['wash_history.service_package_id'] = toObjectId(filters.service_package_id);
    }

    if (filters.vehicle_type) {
        historyMatch['wash_history.vehicle_type'] = filters.vehicle_type;
    }

    const pipeline = [
        { $match: responseMatch },
        {
            $lookup: {
                from: 'wash_histories',
                localField: 'wash_history_id',
                foreignField: '_id',
                as: 'wash_history',
            },
        },
        { $unwind: '$wash_history' },
    ];

    if (Object.keys(historyMatch).length > 0) {
        pipeline.push({ $match: historyMatch });
    }

    return pipeline;
};

const getEligibleSurveyBookingCount = async (survey, filters = {}) => {
    if (!survey.published_at) {
        return 0;
    }

    const now = new Date();
    const intervalStart = new Date(Math.max(
        survey.published_at.getTime(),
        filters.from?.getTime?.() || survey.published_at.getTime()
    ));
    const surveyEnd = survey.closed_at || now;
    const intervalEnd = new Date(Math.min(
        surveyEnd.getTime(),
        filters.to?.getTime?.() || surveyEnd.getTime()
    ));

    if (intervalStart > intervalEnd) {
        return 0;
    }

    const eligibleStart = new Date(intervalStart);

    eligibleStart.setUTCDate(eligibleStart.getUTCDate() - survey.response_window_days);

    const match = buildMatch(filters, 'service_completed_at');

    match.service_completed_at = {
        $gte: eligibleStart,
        $lte: intervalEnd,
    };

    return WashHistory.countDocuments(match);
};

const getSurveyAnalytics = async (surveyId, filters = {}) => {
    const survey = await Survey.findById(surveyId).lean();

    if (!survey) {
        throw new AppError('Survey not found', 404, 'SURVEY_NOT_FOUND');
    }

    const basePipeline = buildSurveyResponsePipeline(surveyId, filters);
    const [
        responseCountRows,
        summaryRows,
        numericDistributionRows,
        choiceDistributionRows,
        npsRows,
        eligibleBookingCount,
    ] = await Promise.all([
        SurveyResponse.aggregate([
            ...basePipeline,
            { $count: 'count' },
        ]),
        SurveyResponse.aggregate([
            ...basePipeline,
            { $unwind: '$answers' },
            {
                $group: {
                    _id: '$answers.question_id',
                    question_text: { $first: '$answers.question_text_snapshot' },
                    question_type: { $first: '$answers.question_type_snapshot' },
                    response_count: { $sum: 1 },
                    numeric_average: { $avg: '$answers.numeric_value' },
                    text_response_count: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $ne: ['$answers.text_value', null] },
                                        { $ne: ['$answers.text_value', ''] },
                                    ],
                                },
                                1,
                                0,
                            ],
                        },
                    },
                },
            },
        ]),
        SurveyResponse.aggregate([
            ...basePipeline,
            { $unwind: '$answers' },
            { $match: { 'answers.numeric_value': { $ne: null } } },
            {
                $group: {
                    _id: {
                        question_id: '$answers.question_id',
                        value: '$answers.numeric_value',
                    },
                    count: { $sum: 1 },
                },
            },
            { $sort: { '_id.value': 1 } },
        ]),
        SurveyResponse.aggregate([
            ...basePipeline,
            { $unwind: '$answers' },
            { $unwind: '$answers.selected_options' },
            {
                $group: {
                    _id: {
                        question_id: '$answers.question_id',
                        option: '$answers.selected_options',
                    },
                    count: { $sum: 1 },
                },
            },
            { $sort: { count: -1, '_id.option': 1 } },
        ]),
        SurveyResponse.aggregate([
            ...basePipeline,
            { $unwind: '$answers' },
            { $match: { 'answers.question_type_snapshot': SURVEY_QUESTION_TYPES.NPS } },
            {
                $group: {
                    _id: '$answers.question_id',
                    total: { $sum: 1 },
                    promoters: {
                        $sum: { $cond: [{ $gte: ['$answers.numeric_value', 9] }, 1, 0] },
                    },
                    passives: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $gte: ['$answers.numeric_value', 7] },
                                        { $lte: ['$answers.numeric_value', 8] },
                                    ],
                                },
                                1,
                                0,
                            ],
                        },
                    },
                    detractors: {
                        $sum: { $cond: [{ $lte: ['$answers.numeric_value', 6] }, 1, 0] },
                    },
                },
            },
        ]),
        getEligibleSurveyBookingCount(survey, filters),
    ]);

    const responseCount = responseCountRows[0]?.count || 0;
    const summaryByQuestion = new Map(
        summaryRows.map((row) => [row._id.toString(), row])
    );
    const numericByQuestion = new Map();
    const choicesByQuestion = new Map();
    const npsByQuestion = new Map(
        npsRows.map((row) => [row._id.toString(), row])
    );

    numericDistributionRows.forEach((row) => {
        const key = row._id.question_id.toString();
        const values = numericByQuestion.get(key) || [];

        values.push({
            value: row._id.value,
            count: row.count || 0,
        });
        numericByQuestion.set(key, values);
    });

    choiceDistributionRows.forEach((row) => {
        const key = row._id.question_id.toString();
        const values = choicesByQuestion.get(key) || [];

        values.push({
            option: row._id.option,
            count: row.count || 0,
        });
        choicesByQuestion.set(key, values);
    });

    const questions = (survey.questions || [])
        .sort((first, second) => first.order - second.order)
        .map((question) => {
            const questionId = question._id.toString();
            const summary = summaryByQuestion.get(questionId) || {};
            const nps = npsByQuestion.get(questionId);

            return {
                question_id: questionId,
                question_text: question.text,
                question_type: question.type,
                response_count: summary.response_count || 0,
                rating_average: question.type === SURVEY_QUESTION_TYPES.RATING
                    ? round(summary.numeric_average)
                    : null,
                numeric_score_average: [
                    SURVEY_QUESTION_TYPES.RATING,
                    SURVEY_QUESTION_TYPES.NPS,
                ].includes(question.type)
                    ? round(summary.numeric_average)
                    : null,
                numeric_distribution: numericByQuestion.get(questionId) || [],
                choice_distribution: choicesByQuestion.get(questionId) || [],
                text_response_count: summary.text_response_count || 0,
                nps: nps
                    ? round(
                        percentage(nps.promoters, nps.total)
                        - percentage(nps.detractors, nps.total)
                    )
                    : null,
                promoter_percentage: nps ? percentage(nps.promoters, nps.total) : null,
                passive_percentage: nps ? percentage(nps.passives, nps.total) : null,
                detractor_percentage: nps ? percentage(nps.detractors, nps.total) : null,
            };
        });

    return {
        period: getPeriod(filters),
        survey: {
            id: survey._id.toString(),
            title: survey.title,
            status: survey.status,
        },
        metrics: {
            response_count: responseCount,
            eligible_booking_count: eligibleBookingCount,
            response_rate: percentage(responseCount, eligibleBookingCount),
        },
        questions,
        generated_at: new Date(),
    };
};

const getPaymentAnalytics = async (filters = {}) => {
    const paymentMatch = {};
    const createdAtRange = {};

    if (filters.from) {
        createdAtRange.$gte = filters.from;
    }

    if (filters.to) {
        createdAtRange.$lte = filters.to;
    }

    if (Object.keys(createdAtRange).length > 0) {
        paymentMatch.created_at = createdAtRange;
    }

    const bookingMatch = {};

    if (filters.garage_id) {
        bookingMatch['booking.garage_id'] = toObjectId(filters.garage_id);
    }

    if (filters.service_package_id) {
        bookingMatch['booking.service_package_id'] = toObjectId(filters.service_package_id);
    }

    if (filters.vehicle_type) {
        bookingMatch['booking.vehicle_type'] = filters.vehicle_type;
    }

    const initiatedChannelExpression = {
        $ifNull: [
            '$initiated_channel',
            {
                $cond: [
                    { $ne: ['$created_by_staff_id', null] },
                    PAYMENT_INITIATED_CHANNEL.STAFF_ASSISTED,
                    'UNKNOWN',
                ],
            },
        ],
    };
    const paidCondition = {
        $eq: ['$status', PAYMENT_TRANSACTION_STATUS.PAID],
    };
    const activeCondition = {
        $in: [
            '$status',
            [
                PAYMENT_TRANSACTION_STATUS.INITIATED,
                PAYMENT_TRANSACTION_STATUS.PENDING,
                PAYMENT_TRANSACTION_STATUS.CANCELING,
            ],
        ],
    };
    const pipeline = [
        { $match: paymentMatch },
        {
            $lookup: {
                from: 'bookings',
                localField: 'booking_id',
                foreignField: '_id',
                as: 'booking',
            },
        },
        { $unwind: '$booking' },
    ];

    if (Object.keys(bookingMatch).length > 0) {
        pipeline.push({ $match: bookingMatch });
    }

    pipeline.push({
        $facet: {
            metrics: [
                {
                    $group: {
                        _id: null,
                        total_transactions: { $sum: 1 },
                        paid_transactions: { $sum: { $cond: [paidCondition, 1, 0] } },
                        active_transactions: { $sum: { $cond: [activeCondition, 1, 0] } },
                        paid_amount: { $sum: { $cond: [paidCondition, '$amount', 0] } },
                    },
                },
            ],
            by_initiated_channel: [
                {
                    $group: {
                        _id: initiatedChannelExpression,
                        transaction_count: { $sum: 1 },
                        paid_count: { $sum: { $cond: [paidCondition, 1, 0] } },
                        paid_amount: { $sum: { $cond: [paidCondition, '$amount', 0] } },
                    },
                },
                { $sort: { transaction_count: -1, _id: 1 } },
            ],
            by_status: [
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        amount: { $sum: '$amount' },
                    },
                },
                { $sort: { count: -1, _id: 1 } },
            ],
            trend: [
                {
                    $group: {
                        _id: getDateGroupExpression('$created_at', filters.group_by),
                        count: { $sum: 1 },
                        paid_count: { $sum: { $cond: [paidCondition, 1, 0] } },
                        paid_amount: { $sum: { $cond: [paidCondition, '$amount', 0] } },
                    },
                },
                { $sort: { _id: 1 } },
            ],
        },
    });

    const [result = {}] = await PaymentTransaction.aggregate(pipeline);
    const metrics = result.metrics?.[0] || {};

    return {
        period: getPeriod(filters),
        metrics: {
            total_transactions: metrics.total_transactions || 0,
            paid_transactions: metrics.paid_transactions || 0,
            active_transactions: metrics.active_transactions || 0,
            paid_amount: round(metrics.paid_amount),
            success_rate: percentage(metrics.paid_transactions, metrics.total_transactions),
        },
        by_initiated_channel: (result.by_initiated_channel || []).map((row) => ({
            channel: row._id,
            transaction_count: row.transaction_count || 0,
            paid_count: row.paid_count || 0,
            paid_amount: round(row.paid_amount),
            success_rate: percentage(row.paid_count, row.transaction_count),
        })),
        by_status: (result.by_status || []).map((row) => ({
            status: row._id,
            count: row.count || 0,
            amount: round(row.amount),
        })),
        trend: (result.trend || []).map((row) => ({
            period: row._id,
            count: row.count || 0,
            paid_count: row.paid_count || 0,
            paid_amount: round(row.paid_amount),
        })),
        generated_at: new Date(),
    };
};

module.exports = {
    getOverview,
    getStaffOverview,
    getBookingAnalytics,
    getCustomerAnalytics,
    getRevenueAnalytics,
    getGarageAnalytics,
    getServiceAnalytics,
    getPromotionAnalytics,
    getWashBayAnalytics,
    getSurveyAnalytics,
    getPaymentAnalytics,
    buildSurveyResponsePipeline,
    round,
    percentage,
};
