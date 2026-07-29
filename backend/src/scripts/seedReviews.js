require('dotenv').config();

const mongoose = require('mongoose');

const { connectDB, disconnectDB } = require('../config/db');
const Review = require('../modules/reviews/review.model');
const Booking = require('../modules/bookings/booking.model');
const WashHistory = require('../modules/wash-histories/washHistory.model');
const Garage = require('../modules/garages/garage.model');
const ServicePackage = require('../modules/service-packages/servicePackage.model');
const User = require('../modules/users/user.model');
const StaffProfile = require('../modules/staff-profiles/staffProfile.model');
const {
    BOOKING_STATUS,
    BOOKING_PAYMENT_STATUS,
} = require('../shared/constants/booking.constant');
const {
    REVIEW_MODERATION_STATUSES,
    REVIEW_MODERATION_REASONS,
} = require('../shared/constants/review.constant');
const { USER_ROLES } = require('../shared/constants/roles.constant');
const {
    STAFF_TYPES,
    STAFF_EMPLOYMENT_STATUS,
} = require('../shared/constants/staff.constant');
const { stableHexId } = require('./seedBookingCatalog');

const REVIEW_LIMIT = 30;
const GARAGE_RATINGS = Object.freeze([5, 5, 4, 5, 3, 4, 5, 2, 5, 4]);
const SERVICE_RATINGS = Object.freeze([5, 4, 5, 5, 3, 4, 5, 3, 4, 5]);
const COMMENTS = Object.freeze([
    'Xe sạch và nhân viên hỗ trợ rất nhanh.',
    'Dịch vụ đúng mô tả, thời gian hoàn thành hợp lý.',
    'Garage sạch sẽ, quy trình rõ ràng.',
    'Chất lượng tốt, tôi sẽ tiếp tục sử dụng.',
    'Dịch vụ ổn nhưng thời gian chờ có thể cải thiện thêm.',
    'Nhân viên tư vấn rõ ràng và thân thiện.',
    'Xe được chăm sóc kỹ, kết quả tốt.',
    'Trải nghiệm chưa như mong đợi, garage nên cập nhật tiến độ sớm hơn.',
    'Đặt lịch thuận tiện và nhận xe đúng giờ.',
    null,
]);

const toId = (value) => String(value?._id || value || '');
const addMinutes = (date, minutes) => new Date(
    new Date(date).getTime() + minutes * 60000
);
const deterministicId = (bookingId) => new mongoose.Types.ObjectId(
    stableHexId('review', toId(bookingId))
);

const buildReviewDefinitions = ({
    bookings,
    washHistories,
    garages,
    servicePackages,
    admin,
    customerServiceStaff,
}) => {
    const bookingById = new Map(
        bookings.map((booking) => [toId(booking._id), booking])
    );
    const garageById = new Map(
        garages.map((garage) => [toId(garage._id), garage])
    );
    const servicePackageById = new Map(
        servicePackages.map((servicePackage) => [
            toId(servicePackage._id),
            servicePackage,
        ])
    );
    const staffByGarageId = new Map();

    customerServiceStaff.forEach((staffProfile) => {
        const garageId = toId(staffProfile.garage_id);

        if (!staffByGarageId.has(garageId)) {
            staffByGarageId.set(garageId, staffProfile);
        }
    });

    return washHistories
        .filter((washHistory) => bookingById.has(toId(washHistory.booking_id)))
        .filter((washHistory) => garageById.has(toId(washHistory.garage_id)))
        .filter((washHistory) => (
            servicePackageById.has(toId(washHistory.service_package_id))
        ))
        .slice(0, REVIEW_LIMIT)
        .map((washHistory, index) => {
            const booking = bookingById.get(toId(washHistory.booking_id));
            const garage = garageById.get(toId(washHistory.garage_id));
            const servicePackage = servicePackageById.get(
                toId(washHistory.service_package_id)
            );
            const staffProfile = staffByGarageId.get(toId(washHistory.garage_id));
            const createdAt = addMinutes(
                washHistory.service_completed_at || booking.completed_at,
                30 + index
            );
            const shouldReply = !!staffProfile && index % 3 === 0;
            const shouldHide = !!admin && index > 0 && index % 13 === 0;
            const replyAt = shouldReply ? addMinutes(createdAt, 90) : null;
            const moderatedAt = shouldHide ? addMinutes(createdAt, 120) : null;
            const updatedAt = [createdAt, replyAt, moderatedAt]
                .filter(Boolean)
                .sort((left, right) => right.getTime() - left.getTime())[0];

            return {
                _id: deterministicId(booking._id),
                booking_id: booking._id,
                wash_history_id: washHistory._id,
                customer_id: washHistory.customer_id,
                garage_id: washHistory.garage_id,
                service_package_id: washHistory.service_package_id,
                garage_snapshot: {
                    name: garage.name,
                    garage_code: garage.garage_code || null,
                },
                service_package_snapshot: {
                    name: servicePackage.name,
                    service_code: servicePackage.service_code || null,
                },
                garage_rating: GARAGE_RATINGS[index % GARAGE_RATINGS.length],
                service_rating: SERVICE_RATINGS[index % SERVICE_RATINGS.length],
                comment: COMMENTS[index % COMMENTS.length],
                upload_ids: [],
                is_anonymous: index % 7 === 0,
                moderation_status: shouldHide
                    ? REVIEW_MODERATION_STATUSES.HIDDEN
                    : REVIEW_MODERATION_STATUSES.PUBLISHED,
                moderation_reason: shouldHide
                    ? REVIEW_MODERATION_REASONS.OFF_TOPIC
                    : null,
                moderation_note: shouldHide
                    ? 'Demo moderation example'
                    : null,
                moderated_by: shouldHide ? admin._id : null,
                moderated_at: moderatedAt,
                garage_reply: shouldReply
                    ? {
                        content: 'Cảm ơn bạn đã đánh giá. Garage sẽ tiếp tục cải thiện chất lượng phục vụ.',
                        replied_by: staffProfile.user_id,
                        replied_at: replyAt,
                        updated_at: replyAt,
                    }
                    : null,
                deleted_at: null,
                deleted_by: null,
                created_at: createdAt,
                updated_at: updatedAt,
            };
        });
};

const getReviewSeedDependencies = async () => {
    const bookings = await Booking.find({
        status: BOOKING_STATUS.COMPLETED,
        payment_status: {
            $in: [
                BOOKING_PAYMENT_STATUS.PAID,
                BOOKING_PAYMENT_STATUS.WAIVED,
            ],
        },
        $or: [
            { customer_id: { $ne: null } },
            { claimed_customer_id: { $ne: null } },
        ],
    })
        .sort({ completed_at: -1, _id: 1 })
        .lean();
    const bookingIds = bookings.map((booking) => booking._id);
    const [washHistories, garages, servicePackages, admin, customerServiceStaff] = await Promise.all([
        WashHistory.find({
            booking_id: { $in: bookingIds },
            customer_id: { $ne: null },
        })
            .sort({ service_completed_at: -1, _id: 1 })
            .lean(),
        Garage.find({}).lean(),
        ServicePackage.find({}).lean(),
        User.findOne({ role: USER_ROLES.ADMIN }).lean(),
        StaffProfile.find({
            staff_type: STAFF_TYPES.CUSTOMER_SERVICE_STAFF,
            employment_status: STAFF_EMPLOYMENT_STATUS.ACTIVE,
            is_active: true,
        }).lean(),
    ]);

    return {
        bookings,
        washHistories,
        garages,
        servicePackages,
        admin,
        customerServiceStaff,
    };
};

const seedReviewsData = async ({
    dryRun = process.argv.includes('--dry-run'),
} = {}) => {
    const dependencies = await getReviewSeedDependencies();
    const definitions = buildReviewDefinitions(dependencies);

    for (const definition of definitions) {
        await new Review(definition).validate();
    }

    const existingReviews = await Review.find({
        booking_id: {
            $in: definitions.map((definition) => definition.booking_id),
        },
    })
        .select('_id booking_id')
        .lean();
    const existingByBookingId = new Map(
        existingReviews.map((review) => [toId(review.booking_id), review])
    );
    const writableDefinitions = definitions.filter((definition) => {
        const existing = existingByBookingId.get(toId(definition.booking_id));

        return !existing || toId(existing._id) === toId(definition._id);
    });
    const skipped = definitions.length - writableDefinitions.length;

    if (dryRun) {
        return {
            dry_run: true,
            planned: writableDefinitions.length,
            skipped,
        };
    }

    if (writableDefinitions.length > 0) {
        await Review.bulkWrite(
            writableDefinitions.map((definition) => ({
                replaceOne: {
                    filter: { _id: definition._id },
                    replacement: definition,
                    upsert: true,
                },
            })),
            {
                ordered: true,
                timestamps: false,
            }
        );
    }

    const seeded = await Review.countDocuments({
        _id: {
            $in: writableDefinitions.map((definition) => definition._id),
        },
    });

    return {
        dry_run: false,
        planned: writableDefinitions.length,
        seeded,
        skipped,
    };
};

const seedReviews = async () => {
    let exitCode = 0;

    try {
        await connectDB();
        const result = await seedReviewsData();

        console.log('Reviews seed completed');
        console.table([result]);
    } catch (error) {
        console.error('Reviews seed failed:', error);
        exitCode = 1;
    } finally {
        await disconnectDB();
        process.exitCode = exitCode;
    }
};

if (require.main === module) {
    seedReviews();
}

module.exports = {
    buildReviewDefinitions,
    seedReviewsData,
    seedReviews,
};
