require('dotenv').config();

const mongoose = require('mongoose');

const { connectDB, disconnectDB } = require('../config/db');
const User = require('../modules/users/user.model');
const Vehicle = require('../modules/vehicles/vehicle.model');
const Garage = require('../modules/garages/garage.model');
const ServicePackage = require('../modules/service-packages/servicePackage.model');
const WashBay = require('../modules/wash-bays/washBay.model');
const Booking = require('../modules/bookings/booking.model');
const WashHistory = require('../modules/wash-histories/washHistory.model');
const Promotion = require('../modules/promotions/promotion.model');
const PromotionUsage = require('../modules/promotion-usages/promotionUsage.model');
const Survey = require('../modules/surveys/survey.model');
const SurveyResponse = require('../modules/surveys/surveyResponse.model');
const { USER_ROLES } = require('../shared/constants/roles.constant');
const {
    BOOKING_STATUS,
    BOOKING_PAYMENT_METHOD,
    BOOKING_PAYMENT_STATUS,
} = require('../shared/constants/booking.constant');
const {
    PROMOTION_DISCOUNT_TYPES,
    PROMOTION_AUDIENCES,
    PROMOTION_USAGE_STATUS,
} = require('../shared/constants/promotion.constant');
const {
    SURVEY_STATUSES,
    SURVEY_QUESTION_TYPES,
} = require('../shared/constants/survey.constant');

const DEMO_PREFIX = 'ANALYTICS_DEMO';
const DEMO_SURVEY_TITLE = 'Analytics Demo Service Survey';
const DEMO_PROMOTION_CODE = 'ANALYTICS_DEMO';

const isProductionTarget = () => {
    const dbName = mongoose.connection.name || process.env.MONGODB_DB_NAME || '';
    const nodeEnv = process.env.NODE_ENV || '';

    return nodeEnv.toLowerCase() === 'production' || /prod|production/i.test(dbName);
};

const addMinutes = (date, minutes) => {
    return new Date(date.getTime() + minutes * 60000);
};

const addDays = (date, days) => {
    return new Date(date.getTime() + days * 86400000);
};

const getRequiredSeedData = async () => {
    const [admin, staff, vehicles, garages, servicePackages, washBays] = await Promise.all([
        User.findOne({ role: USER_ROLES.ADMIN }).lean(),
        User.findOne({ role: USER_ROLES.STAFF }).lean(),
        Vehicle.find({ is_active: true }).lean(),
        Garage.find({ is_active: true }).lean(),
        ServicePackage.find({
            is_active: true,
            requires_wash_bay: true,
        }).lean(),
        WashBay.find({ is_active: true }).lean(),
    ]);

    if (!admin || !staff || vehicles.length === 0 || garages.length === 0) {
        throw new Error('Run the base seed before analytics demo seed');
    }

    const compatibleContexts = [];

    for (const garage of garages) {
        for (const washBay of washBays.filter((item) => item.garage_id.toString() === garage._id.toString())) {
            const servicePackage = servicePackages.find(
                (item) => item.vehicle_type === washBay.vehicle_type
            );
            const vehicle = vehicles.find(
                (item) => item.vehicle_type === washBay.vehicle_type
            );

            if (servicePackage && vehicle) {
                compatibleContexts.push({
                    garage,
                    washBay,
                    servicePackage,
                    vehicle,
                });
            }
        }
    }

    if (compatibleContexts.length === 0) {
        throw new Error('No compatible garage, wash bay, service package, and vehicle context found');
    }

    return {
        admin,
        staff,
        compatibleContexts,
    };
};

const deletePreviousDemoData = async () => {
    const demoBookings = await Booking.find({
        note: { $regex: `^${DEMO_PREFIX}:` },
    }).select('_id').lean();
    const bookingIds = demoBookings.map((booking) => booking._id);
    const demoSurvey = await Survey.findOne({
        title: DEMO_SURVEY_TITLE,
    }).select('_id').lean();
    const demoPromotion = await Promotion.findOne({
        code: DEMO_PROMOTION_CODE,
    }).select('_id').lean();

    if (demoSurvey) {
        await SurveyResponse.deleteMany({ survey_id: demoSurvey._id });
        await Survey.deleteOne({ _id: demoSurvey._id });
    }

    if (bookingIds.length > 0) {
        await Promise.all([
            PromotionUsage.deleteMany({ booking_id: { $in: bookingIds } }),
            WashHistory.deleteMany({ booking_id: { $in: bookingIds } }),
            Booking.deleteMany({ _id: { $in: bookingIds } }),
        ]);
    }

    if (demoPromotion) {
        await Promotion.deleteOne({ _id: demoPromotion._id });
    }
};

const createDemoPromotion = async (adminId, now) => {
    return Promotion.create({
        code: DEMO_PROMOTION_CODE,
        name: 'Analytics Demo Promotion',
        description: 'Promotion for analytics demonstration data',
        discount_type: PROMOTION_DISCOUNT_TYPES.FIXED_AMOUNT,
        discount_value: 10000,
        max_discount_amount: null,
        min_order_amount: 0,
        audience: PROMOTION_AUDIENCES.ALL,
        phone_required: false,
        per_phone_limit: null,
        applicable_tiers: [],
        applicable_vehicle_types: [],
        applicable_service_package_ids: [],
        start_at: addDays(now, -60),
        end_at: addDays(now, 60),
        usage_limit: null,
        per_customer_limit: null,
        used_count: 0,
        reserved_count: 0,
        is_active: true,
        created_by_id: adminId,
        updated_by_id: adminId,
    });
};

const createDemoBookings = async ({ staff, compatibleContexts, promotion, now }) => {
    const bookingDocuments = [];

    for (let index = 0; index < 24; index += 1) {
        const context = compatibleContexts[index % compatibleContexts.length];
        const isWalkIn = index % 3 === 0;
        const isCompleted = index < 18;
        const status = isCompleted
            ? BOOKING_STATUS.COMPLETED
            : index < 21
                ? BOOKING_STATUS.CANCELED
                : BOOKING_STATUS.NO_SHOW;
        const startTime = addDays(now, -(23 - index));

        startTime.setUTCHours(1 + (index % 9), 0, 0, 0);

        const endTime = addMinutes(startTime, context.servicePackage.duration_minutes);
        const actualStartTime = isCompleted
            ? addMinutes(startTime, index % 4 === 0 ? 12 : 2)
            : null;
        const actualEndTime = actualStartTime
            ? addMinutes(
                actualStartTime,
                context.servicePackage.duration_minutes + ((index % 5) - 2) * 5
            )
            : null;
        const promotionDiscount = isCompleted && index % 4 === 0 ? 10000 : 0;
        const pointsDiscount = isCompleted && !isWalkIn && index % 5 === 0 ? 5000 : 0;
        const originalPrice = context.servicePackage.base_price;
        const finalPrice = Math.max(originalPrice - promotionDiscount - pointsDiscount, 0);
        const customerId = isWalkIn ? null : context.vehicle.customer_id;
        const bookingId = new mongoose.Types.ObjectId();

        bookingDocuments.push({
            _id: bookingId,
            customer_id: customerId,
            vehicle_id: isWalkIn ? null : context.vehicle._id,
            is_walk_in: isWalkIn,
            guest_name: isWalkIn ? `Demo Walk In ${index + 1}` : null,
            guest_phone: isWalkIn ? `090900${String(index).padStart(4, '0')}` : null,
            normalized_guest_phone: isWalkIn ? `+8490900${String(index).padStart(4, '0')}` : null,
            guest_email: null,
            license_plate: isWalkIn ? `51A-${String(10000 + index)}` : null,
            normalized_license_plate: isWalkIn ? `51A${String(10000 + index)}` : null,
            vehicle_type: context.servicePackage.vehicle_type,
            created_by_staff_id: isWalkIn ? staff._id : null,
            garage_id: context.garage._id,
            wash_bay_id: isCompleted ? context.washBay._id : null,
            service_package_id: context.servicePackage._id,
            add_on_service_ids: [],
            booking_items: [],
            booking_date: startTime,
            start_time: startTime,
            end_time: endTime,
            wash_bay_start_time: startTime,
            wash_bay_end_time: endTime,
            wash_bay_work_end_time: endTime,
            wash_bay_reserved_until: endTime,
            original_price: originalPrice,
            promotion_discount_amount: promotionDiscount,
            points_discount_amount: pointsDiscount,
            discount_amount: promotionDiscount + pointsDiscount,
            final_price: finalPrice,
            payment_method: index % 2 === 0
                ? BOOKING_PAYMENT_METHOD.CASH
                : BOOKING_PAYMENT_METHOD.PAYOS,
            payment_status: isCompleted
                ? BOOKING_PAYMENT_STATUS.PAID
                : BOOKING_PAYMENT_STATUS.UNPAID,
            used_points: pointsDiscount > 0 ? 5 : 0,
            earned_points: isCompleted && !isWalkIn ? context.servicePackage.points_earned : 0,
            promotion_id: promotionDiscount > 0 ? promotion._id : null,
            requires_wash_bay: true,
            requires_care_staff: false,
            care_staff_required_count: 0,
            assigned_care_staff_ids: [],
            status,
            arrival_status: index % 4 === 0 ? 'LATE' : 'ON_TIME',
            arrived_at: isCompleted ? actualStartTime : null,
            arrival_reference_start_time: startTime,
            late_minutes: index % 4 === 0 ? 12 : 0,
            grace_exceeded_minutes: 0,
            reschedule_count: index % 7 === 0 ? 1 : 0,
            checked_in_at: isCompleted ? actualStartTime : null,
            started_at: actualStartTime,
            completed_at: actualEndTime,
            paid_at: isCompleted ? addMinutes(actualEndTime, 5) : null,
            canceled_at: status === BOOKING_STATUS.CANCELED ? addMinutes(startTime, -120) : null,
            no_show_at: status === BOOKING_STATUS.NO_SHOW ? addMinutes(startTime, 30) : null,
            reward_processed: isCompleted,
            reward_processed_at: isCompleted ? addMinutes(actualEndTime, 5) : null,
            note: `${DEMO_PREFIX}:${index + 1}`,
            created_at: addMinutes(startTime, -1440),
            updated_at: isCompleted ? addMinutes(actualEndTime, 5) : startTime,
        });
    }

    await Booking.collection.insertMany(bookingDocuments);

    return bookingDocuments;
};

const createDemoRuntimeData = async ({ bookings, promotion }) => {
    const washHistories = bookings
        .filter((booking) => booking.status === BOOKING_STATUS.COMPLETED)
        .map((booking) => ({
            _id: new mongoose.Types.ObjectId(),
            booking_id: booking._id,
            customer_id: booking.customer_id,
            vehicle_id: booking.vehicle_id,
            garage_id: booking.garage_id,
            wash_bay_id: booking.wash_bay_id,
            service_package_id: booking.service_package_id,
            vehicle_type: booking.vehicle_type,
            amount_paid: booking.final_price,
            original_price: booking.original_price,
            discount_amount: booking.discount_amount,
            points_earned: booking.earned_points,
            points_used: booking.used_points,
            payment_method: booking.payment_method,
            paid_at: booking.paid_at,
            service_started_at: booking.started_at,
            service_completed_at: booking.completed_at,
            created_at: booking.paid_at,
            updated_at: booking.paid_at,
        }));

    await WashHistory.collection.insertMany(washHistories);

    const historyByBooking = new Map(
        washHistories.map((history) => [history.booking_id.toString(), history])
    );
    const promotionUsages = bookings
        .filter(
            (booking) => booking.status === BOOKING_STATUS.COMPLETED
                && booking.promotion_id
        )
        .map((booking) => ({
            promotion_id: promotion._id,
            booking_id: booking._id,
            customer_id: booking.customer_id,
            guest_phone_normalized: booking.normalized_guest_phone,
            phone_usage_key: null,
            used_by_staff_id: booking.created_by_staff_id,
            discount_amount: booking.promotion_discount_amount,
            used_at: booking.paid_at,
            status: PROMOTION_USAGE_STATUS.CONSUMED,
            reserved_at: booking.created_at,
            consumed_at: booking.paid_at,
            released_at: null,
            created_at: booking.created_at,
            updated_at: booking.paid_at,
        }));

    if (promotionUsages.length > 0) {
        await PromotionUsage.collection.insertMany(promotionUsages);
        await Promotion.updateOne(
            { _id: promotion._id },
            { $set: { used_count: promotionUsages.length } }
        );
    }

    return {
        washHistories,
        historyByBooking,
        promotionUsages,
    };
};

const createDemoSurvey = async ({ admin, bookings, historyByBooking, now }) => {
    const survey = await Survey.create({
        title: DEMO_SURVEY_TITLE,
        description: 'Survey data for analytics and research demonstration',
        status: SURVEY_STATUSES.PUBLISHED,
        questions: [
            {
                text: 'How satisfied are you with the service?',
                type: SURVEY_QUESTION_TYPES.RATING,
                is_required: true,
                options: [],
                order: 1,
            },
            {
                text: 'How likely are you to recommend AutoWash Pro?',
                type: SURVEY_QUESTION_TYPES.NPS,
                is_required: true,
                options: [],
                order: 2,
            },
            {
                text: 'What did you value most?',
                type: SURVEY_QUESTION_TYPES.SINGLE_CHOICE,
                is_required: true,
                options: ['Speed', 'Cleanliness', 'Staff', 'Price'],
                order: 3,
            },
            {
                text: 'What should we improve?',
                type: SURVEY_QUESTION_TYPES.TEXT,
                is_required: false,
                options: [],
                order: 4,
            },
        ],
        response_window_days: 365,
        created_by: admin._id,
        published_at: addDays(now, -60),
        closed_at: null,
    });
    const customerBookings = bookings.filter(
        (booking) => booking.status === BOOKING_STATUS.COMPLETED
            && booking.customer_id
            && historyByBooking.has(booking._id.toString())
    );
    const textAnswers = [
        'Service was fast and the vehicle was very clean.',
        'Staff were friendly but waiting time should be shorter.',
        'The wash quality was good and price was reasonable.',
        'Please improve the waiting area and service updates.',
        'I liked the careful cleaning and professional staff.',
        'The service took longer than expected during busy hours.',
    ];
    const responseDocuments = customerBookings.map((booking, index) => {
        const history = historyByBooking.get(booking._id.toString());
        const rating = Math.max(1, 5 - (index % 4 === 0 ? 2 : index % 3 === 0 ? 1 : 0));
        const nps = index % 5 === 0 ? 6 : index % 3 === 0 ? 8 : 9 + (index % 2);
        const choice = ['Speed', 'Cleanliness', 'Staff', 'Price'][index % 4];

        return {
            survey_id: survey._id,
            booking_id: booking._id,
            wash_history_id: history._id,
            customer_id: booking.customer_id,
            answers: [
                {
                    question_id: survey.questions[0]._id,
                    question_text_snapshot: survey.questions[0].text,
                    question_type_snapshot: survey.questions[0].type,
                    numeric_value: rating,
                    text_value: null,
                    selected_options: [],
                },
                {
                    question_id: survey.questions[1]._id,
                    question_text_snapshot: survey.questions[1].text,
                    question_type_snapshot: survey.questions[1].type,
                    numeric_value: nps,
                    text_value: null,
                    selected_options: [],
                },
                {
                    question_id: survey.questions[2]._id,
                    question_text_snapshot: survey.questions[2].text,
                    question_type_snapshot: survey.questions[2].type,
                    numeric_value: null,
                    text_value: null,
                    selected_options: [choice],
                },
                {
                    question_id: survey.questions[3]._id,
                    question_text_snapshot: survey.questions[3].text,
                    question_type_snapshot: survey.questions[3].type,
                    numeric_value: null,
                    text_value: textAnswers[index % textAnswers.length],
                    selected_options: [],
                },
            ],
            upload_ids: [],
            submitted_at: addMinutes(booking.completed_at, 30),
            created_at: addMinutes(booking.completed_at, 30),
            updated_at: addMinutes(booking.completed_at, 30),
        };
    });

    if (responseDocuments.length > 0) {
        await SurveyResponse.collection.insertMany(responseDocuments);
    }

    return {
        survey,
        responseCount: responseDocuments.length,
    };
};

const seedAnalyticsDemo = async ({ dryRun = process.argv.includes('--dry-run') } = {}) => {
    if (isProductionTarget()) {
        throw new Error('Analytics demo seed is blocked for production target');
    }

    const seedData = await getRequiredSeedData();

    if (dryRun) {
        return {
            dry_run: true,
            compatible_contexts: seedData.compatibleContexts.length,
            planned_bookings: 24,
        };
    }

    await deletePreviousDemoData();

    const now = new Date();
    const promotion = await createDemoPromotion(seedData.admin._id, now);
    const bookings = await createDemoBookings({
        staff: seedData.staff,
        compatibleContexts: seedData.compatibleContexts,
        promotion,
        now,
    });
    const runtimeData = await createDemoRuntimeData({
        bookings,
        promotion,
    });
    const surveyData = await createDemoSurvey({
        admin: seedData.admin,
        bookings,
        historyByBooking: runtimeData.historyByBooking,
        now,
    });

    return {
        dry_run: false,
        bookings: bookings.length,
        wash_histories: runtimeData.washHistories.length,
        promotion_usages: runtimeData.promotionUsages.length,
        survey_id: surveyData.survey._id.toString(),
        survey_responses: surveyData.responseCount,
    };
};

const run = async () => {
    let exitCode = 0;

    try {
        await connectDB();
        const result = await seedAnalyticsDemo();

        console.log('Analytics demo seed completed');
        console.table([result]);
    } catch (error) {
        console.error('Analytics demo seed failed:', error);
        exitCode = 1;
    } finally {
        await disconnectDB();
        process.exitCode = exitCode;
    }
};

if (require.main === module) {
    run();
}

module.exports = {
    seedAnalyticsDemo,
};
