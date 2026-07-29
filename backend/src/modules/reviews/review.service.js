const mongoose = require('mongoose');

const Review = require('./review.model');
const ReviewMapper = require('./review.mapper');
const ReviewSummaryService = require('./reviewSummary.service');
const Booking = require('../bookings/booking.model');
const WashHistory = require('../wash-histories/washHistory.model');
const Garage = require('../garages/garage.model');
const ServicePackage = require('../service-packages/servicePackage.model');
const Upload = require('../uploads/upload.model');
const auditLogService = require('../audit-logs/auditLog.service');
const notificationService = require('../notifications/notification.service');
const { AppError } = require('../../shared/utils/appError');
const {
    BOOKING_STATUS,
    BOOKING_PAYMENT_STATUS,
} = require('../../shared/constants/booking.constant');
const {
    REVIEW_MODERATION_STATUSES,
    REVIEW_SORTS,
} = require('../../shared/constants/review.constant');
const {
    UPLOAD_PURPOSES,
    UPLOAD_RELATED_TYPES,
} = require('../../shared/constants/upload.constant');
const {
    AUDIT_ACTIONS,
    AUDIT_RESOURCE_TYPES,
} = require('../../shared/constants/audit.constant');
const {
    NOTIFICATION_TYPES,
    NOTIFICATION_RELATED_TYPES,
} = require('../../shared/constants/notification.constant');

const ACTIVE_PAYMENT_STATUSES = Object.freeze([
    BOOKING_PAYMENT_STATUS.PAID,
    BOOKING_PAYMENT_STATUS.WAIVED,
]);

const normalizeText = (value) => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value !== 'string') {
        return value;
    }

    const normalized = value.trim();

    return normalized || null;
};

const escapeRegExp = (value) => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const toObjectId = (value) => {
    if (!value) {
        return null;
    }

    return value instanceof mongoose.Types.ObjectId
        ? value
        : new mongoose.Types.ObjectId(value);
};

const toId = (value) => {
    return value?._id?.toString?.() || value?.toString?.() || value || null;
};

const runInTransaction = async (callback) => {
    const session = await mongoose.startSession();
    let result;

    try {
        await session.withTransaction(async () => {
            result = await callback(session);
        });
    } finally {
        await session.endSession();
    }

    return result;
};

const populateReviewQuery = (query) => {
    return query
        .populate('customer_id', 'full_name email phone avatar_url role')
        .populate('garage_id', 'name garage_code address city')
        .populate('service_package_id', 'name service_code vehicle_type service_type')
        .populate('upload_ids')
        .populate('garage_reply.replied_by', 'full_name avatar_url role')
        .populate('moderated_by', 'full_name avatar_url role');
};

const getReviewDocumentById = async (reviewId, filter = {}, session = null) => {
    const query = Review.findOne({
        _id: reviewId,
        ...filter,
    });

    if (session) {
        query.session(session);
    }

    const review = await query;

    if (!review) {
        throw new AppError('Review not found', 404, 'REVIEW_NOT_FOUND');
    }

    return review;
};

const getPopulatedReviewById = async (reviewId, session = null) => {
    const query = populateReviewQuery(Review.findById(reviewId));

    if (session) {
        query.session(session);
    }

    return query;
};

const getBookingForCustomer = async (customerId, bookingId, session = null) => {
    const query = Booking.findOne({
        _id: bookingId,
        $or: [
            { customer_id: customerId },
            { claimed_customer_id: customerId },
        ],
    });

    if (session) {
        query.session(session);
    }

    const booking = await query;

    if (!booking) {
        throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    return booking;
};

const getWashHistoryForCustomerBooking = async (customerId, bookingId, session = null) => {
    const query = WashHistory.findOne({
        booking_id: bookingId,
        customer_id: customerId,
    });

    if (session) {
        query.session(session);
    }

    return query;
};

const assertBookingReviewEligible = (booking, washHistory) => {
    if (booking.status !== BOOKING_STATUS.COMPLETED) {
        throw new AppError(
            'Review is only available after booking completion',
            409,
            'REVIEW_BOOKING_NOT_COMPLETED'
        );
    }

    if (!ACTIVE_PAYMENT_STATUSES.includes(booking.payment_status)) {
        throw new AppError(
            'Review is only available after payment or an approved payment waiver',
            409,
            'REVIEW_BOOKING_NOT_SETTLED'
        );
    }

    if (!washHistory) {
        throw new AppError(
            'Wash history is required before creating a review',
            409,
            'REVIEW_WASH_HISTORY_REQUIRED'
        );
    }
};

const getEligibleReviewContext = async (customerId, bookingId, session = null) => {
    const booking = await getBookingForCustomer(customerId, bookingId, session);
    const washHistory = await getWashHistoryForCustomerBooking(
        customerId,
        booking._id,
        session
    );

    assertBookingReviewEligible(booking, washHistory);

    const garageQuery = Garage.findById(washHistory.garage_id);
    const servicePackageQuery = ServicePackage.findById(washHistory.service_package_id);

    if (session) {
        garageQuery.session(session);
        servicePackageQuery.session(session);
    }

    const [garage, servicePackage] = await Promise.all([
        garageQuery,
        servicePackageQuery,
    ]);

    if (!garage) {
        throw new AppError('Garage not found', 404, 'GARAGE_NOT_FOUND');
    }

    if (!servicePackage) {
        throw new AppError('Service package not found', 404, 'SERVICE_PACKAGE_NOT_FOUND');
    }

    return {
        booking,
        washHistory,
        garage,
        servicePackage,
    };
};

const getReviewUploads = async ({
    customerId,
    uploadIds = [],
    reviewId = null,
    session = null,
}) => {
    const uniqueUploadIds = [...new Set(uploadIds)];

    if (uniqueUploadIds.length !== uploadIds.length) {
        throw new AppError('Review upload ids must be unique', 400, 'DUPLICATE_REVIEW_UPLOADS');
    }

    if (uniqueUploadIds.length === 0) {
        return [];
    }

    const relationFilters = [
        {
            related_type: null,
            related_id: null,
        },
    ];

    if (reviewId) {
        relationFilters.push({
            related_type: UPLOAD_RELATED_TYPES.REVIEW,
            related_id: reviewId,
        });
    }

    const query = Upload.find({
        _id: { $in: uniqueUploadIds },
        owner_id: customerId,
        purpose: UPLOAD_PURPOSES.REVIEW,
        $or: relationFilters,
    });

    if (session) {
        query.session(session);
    }

    const uploads = await query;

    if (uploads.length !== uniqueUploadIds.length) {
        throw new AppError(
            'One or more review uploads are invalid, already used, or not owned by customer',
            400,
            'INVALID_REVIEW_UPLOADS'
        );
    }

    if (uploads.some((upload) => !upload.mime_type.startsWith('image/'))) {
        throw new AppError('Review only accepts image uploads', 400, 'REVIEW_UPLOAD_IMAGE_REQUIRED');
    }

    return uploads;
};

const syncReviewUploads = async ({
    review,
    customerId,
    nextUploadIds,
    session,
}) => {
    const uploads = await getReviewUploads({
        customerId,
        uploadIds: nextUploadIds,
        reviewId: review._id,
        session,
    });
    const previousIds = new Set((review.upload_ids || []).map((uploadId) => uploadId.toString()));
    const nextIds = new Set(nextUploadIds.map((uploadId) => toId(uploadId)));
    const addedIds = uploads
        .filter((upload) => !previousIds.has(upload._id.toString()))
        .map((upload) => upload._id);
    const removedIds = [...previousIds]
        .filter((uploadId) => !nextIds.has(uploadId))
        .map((uploadId) => toObjectId(uploadId));

    if (addedIds.length > 0) {
        const attachResult = await Upload.updateMany(
            {
                _id: { $in: addedIds },
                owner_id: customerId,
                related_type: null,
                related_id: null,
            },
            {
                $set: {
                    related_type: UPLOAD_RELATED_TYPES.REVIEW,
                    related_id: review._id,
                },
            },
            { session }
        );

        if ((attachResult.modifiedCount || 0) !== addedIds.length) {
            throw new AppError(
                'Failed to attach one or more review uploads',
                409,
                'REVIEW_UPLOAD_ATTACH_CONFLICT'
            );
        }
    }

    if (removedIds.length > 0) {
        await Upload.updateMany(
            {
                _id: { $in: removedIds },
                owner_id: customerId,
                related_type: UPLOAD_RELATED_TYPES.REVIEW,
                related_id: review._id,
            },
            {
                $set: {
                    related_type: null,
                    related_id: null,
                },
            },
            { session }
        );
    }

    review.upload_ids = uploads.map((upload) => upload._id);
};

const buildHasCommentFilter = (hasComment) => {
    if (hasComment === undefined) {
        return {};
    }

    if (hasComment) {
        return {
            comment: {
                $type: 'string',
                $ne: '',
            },
        };
    }

    return {
        $or: [
            { comment: null },
            { comment: '' },
        ],
    };
};

const buildPublicSort = (sort, ratingField) => {
    if (sort === REVIEW_SORTS.OLDEST) {
        return { created_at: 1 };
    }

    if (sort === REVIEW_SORTS.HIGHEST) {
        return { [ratingField]: -1, created_at: -1 };
    }

    if (sort === REVIEW_SORTS.LOWEST) {
        return { [ratingField]: 1, created_at: -1 };
    }

    return { created_at: -1 };
};

const getPublicReviews = async ({
    subjectField,
    subjectId,
    ratingField,
    page,
    limit,
    rating,
    has_comment,
    sort,
}) => {
    const filter = {
        [subjectField]: subjectId,
        moderation_status: REVIEW_MODERATION_STATUSES.PUBLISHED,
        deleted_at: null,
        ...buildHasCommentFilter(has_comment),
    };

    if (rating) {
        filter[ratingField] = rating;
    }

    const skip = (page - 1) * limit;
    const [reviews, total] = await Promise.all([
        populateReviewQuery(
            Review.find(filter)
                .sort(buildPublicSort(sort, ratingField))
                .skip(skip)
                .limit(limit)
        ),
        Review.countDocuments(filter),
    ]);

    return {
        data: ReviewMapper.toReviewDtoList(reviews, {
            access: 'public',
            legacyRatingField: ratingField,
        }),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

const assertPublicGarageExists = async (garageId) => {
    const exists = await Garage.exists({
        _id: garageId,
        is_active: true,
    });

    if (!exists) {
        throw new AppError('Garage not found', 404, 'GARAGE_NOT_FOUND');
    }
};

const assertPublicServicePackageExists = async (servicePackageId) => {
    const exists = await ServicePackage.exists({
        _id: servicePackageId,
        is_active: true,
    });

    if (!exists) {
        throw new AppError('Service package not found', 404, 'SERVICE_PACKAGE_NOT_FOUND');
    }
};

const getGarageReviews = async (garageId, query = {}) => {
    await assertPublicGarageExists(garageId);

    return getPublicReviews({
        subjectField: 'garage_id',
        subjectId: garageId,
        ratingField: 'garage_rating',
        ...query,
    });
};

const getGarageReviewSummary = async (garageId) => {
    await assertPublicGarageExists(garageId);

    return ReviewSummaryService.getGarageSummary(garageId);
};

const getServicePackageReviews = async (servicePackageId, query = {}) => {
    await assertPublicServicePackageExists(servicePackageId);

    return getPublicReviews({
        subjectField: 'service_package_id',
        subjectId: servicePackageId,
        ratingField: 'service_rating',
        ...query,
    });
};

const getServicePackageReviewSummary = async (servicePackageId) => {
    await assertPublicServicePackageExists(servicePackageId);

    return ReviewSummaryService.getServicePackageSummary(servicePackageId);
};

const getReviewEligibility = async (customerId, bookingId) => {
    const booking = await getBookingForCustomer(customerId, bookingId);
    const existingReview = await populateReviewQuery(
        Review.findOne({
            booking_id: booking._id,
            customer_id: customerId,
        })
    );

    if (existingReview) {
        return {
            eligible: false,
            reason_code: existingReview.deleted_at
                ? 'REVIEW_ALREADY_DELETED'
                : 'REVIEW_ALREADY_EXISTS',
            review: ReviewMapper.toReviewDto(existingReview, { access: 'customer' }),
        };
    }

    if (booking.status !== BOOKING_STATUS.COMPLETED) {
        return {
            eligible: false,
            reason_code: 'REVIEW_BOOKING_NOT_COMPLETED',
            review: null,
        };
    }

    if (!ACTIVE_PAYMENT_STATUSES.includes(booking.payment_status)) {
        return {
            eligible: false,
            reason_code: 'REVIEW_BOOKING_NOT_SETTLED',
            review: null,
        };
    }

    const washHistory = await getWashHistoryForCustomerBooking(customerId, booking._id);

    if (!washHistory) {
        return {
            eligible: false,
            reason_code: 'REVIEW_WASH_HISTORY_REQUIRED',
            review: null,
        };
    }

    return {
        eligible: true,
        reason_code: null,
        review: null,
        context: {
            booking_id: booking._id.toString(),
            wash_history_id: washHistory._id.toString(),
            garage_id: washHistory.garage_id.toString(),
            service_package_id: washHistory.service_package_id.toString(),
        },
    };
};

const createReview = async (
    user,
    payload,
    auditContext = {},
    expectedGarageId = null
) => {
    try {
        return await runInTransaction(async (session) => {
            const context = await getEligibleReviewContext(
                user._id,
                payload.booking_id,
                session
            );

            if (
                expectedGarageId
                && context.washHistory.garage_id.toString() !== expectedGarageId.toString()
            ) {
                throw new AppError(
                    'Booking does not belong to the requested garage',
                    409,
                    'REVIEW_GARAGE_MISMATCH'
                );
            }

            const existingReview = await Review.exists({
                booking_id: context.booking._id,
            }).session(session);

            if (existingReview) {
                throw new AppError(
                    'Review already exists for this booking',
                    409,
                    'REVIEW_ALREADY_EXISTS'
                );
            }

            const uploads = await getReviewUploads({
                customerId: user._id,
                uploadIds: payload.upload_ids || [],
                session,
            });
            const documents = await Review.create(
                [
                    {
                        booking_id: context.booking._id,
                        wash_history_id: context.washHistory._id,
                        customer_id: user._id,
                        garage_id: context.washHistory.garage_id,
                        service_package_id: context.washHistory.service_package_id,
                        garage_snapshot: {
                            name: context.garage.name,
                            garage_code: context.garage.garage_code || null,
                        },
                        service_package_snapshot: {
                            name: context.servicePackage.name,
                            service_code: context.servicePackage.service_code || null,
                        },
                        garage_rating: payload.garage_rating,
                        service_rating: payload.service_rating,
                        comment: normalizeText(payload.comment),
                        upload_ids: uploads.map((upload) => upload._id),
                        is_anonymous: payload.is_anonymous || false,
                    },
                ],
                { session }
            );
            const [review] = documents;

            if (uploads.length > 0) {
                const uploadIds = uploads.map((upload) => upload._id);
                const attachResult = await Upload.updateMany(
                    {
                        _id: { $in: uploadIds },
                        owner_id: user._id,
                        related_type: null,
                        related_id: null,
                    },
                    {
                        $set: {
                            related_type: UPLOAD_RELATED_TYPES.REVIEW,
                            related_id: review._id,
                        },
                    },
                    { session }
                );

                if ((attachResult.modifiedCount || 0) !== uploads.length) {
                    throw new AppError(
                        'Failed to attach one or more review uploads',
                        409,
                        'REVIEW_UPLOAD_ATTACH_CONFLICT'
                    );
                }
            }

            const populatedReview = await getPopulatedReviewById(review._id, session);
            const result = ReviewMapper.toReviewDto(populatedReview, { access: 'customer' });

            await auditLogService.recordAuditEvent({
                actorId: user._id,
                action: AUDIT_ACTIONS.REVIEW_CREATED,
                resourceType: AUDIT_RESOURCE_TYPES.REVIEW,
                resourceId: review._id,
                after: result,
                ip: auditContext.ip,
                userAgent: auditContext.userAgent,
                metadata: {
                    booking_id: context.booking._id.toString(),
                    garage_id: context.washHistory.garage_id.toString(),
                    service_package_id: context.washHistory.service_package_id.toString(),
                },
                session,
            });

            return result;
        });
    } catch (error) {
        if (error?.code === 11000) {
            throw new AppError(
                'Review already exists for this booking',
                409,
                'REVIEW_ALREADY_EXISTS'
            );
        }

        throw error;
    }
};

const getMyReviews = async (
    customerId,
    {
        page = 1,
        limit = 20,
        garage_id,
        service_package_id,
        moderation_status,
    } = {}
) => {
    const filter = {
        customer_id: customerId,
        deleted_at: null,
    };

    if (garage_id) {
        filter.garage_id = garage_id;
    }

    if (service_package_id) {
        filter.service_package_id = service_package_id;
    }

    if (moderation_status) {
        filter.moderation_status = moderation_status;
    }

    const skip = (page - 1) * limit;
    const [reviews, total] = await Promise.all([
        populateReviewQuery(
            Review.find(filter)
                .sort({ created_at: -1 })
                .skip(skip)
                .limit(limit)
        ),
        Review.countDocuments(filter),
    ]);

    return {
        data: ReviewMapper.toReviewDtoList(reviews, { access: 'customer' }),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

const getMyReviewByBooking = async (customerId, bookingId) => {
    await getBookingForCustomer(customerId, bookingId);
    const review = await populateReviewQuery(
        Review.findOne({
            booking_id: bookingId,
            customer_id: customerId,
            deleted_at: null,
        })
    );

    return ReviewMapper.toReviewDto(review, { access: 'customer' });
};

const updateMyReview = async (user, reviewId, payload, auditContext = {}) => {
    return runInTransaction(async (session) => {
        const review = await getReviewDocumentById(
            reviewId,
            {
                customer_id: user._id,
                deleted_at: null,
            },
            session
        );
        const populatedBefore = await getPopulatedReviewById(review._id, session);
        const before = ReviewMapper.toReviewDto(populatedBefore, { access: 'customer' });

        if (payload.garage_rating !== undefined) {
            review.garage_rating = payload.garage_rating;
        }

        if (payload.service_rating !== undefined) {
            review.service_rating = payload.service_rating;
        }

        if (payload.comment !== undefined) {
            review.comment = normalizeText(payload.comment);
        }

        if (payload.is_anonymous !== undefined) {
            review.is_anonymous = payload.is_anonymous;
        }

        if (payload.upload_ids !== undefined) {
            await syncReviewUploads({
                review,
                customerId: user._id,
                nextUploadIds: payload.upload_ids,
                session,
            });
        }

        await review.save({ session });

        const populatedAfter = await getPopulatedReviewById(review._id, session);
        const result = ReviewMapper.toReviewDto(populatedAfter, { access: 'customer' });

        await auditLogService.recordAuditEvent({
            actorId: user._id,
            action: AUDIT_ACTIONS.REVIEW_UPDATED,
            resourceType: AUDIT_RESOURCE_TYPES.REVIEW,
            resourceId: review._id,
            before,
            after: result,
            ip: auditContext.ip,
            userAgent: auditContext.userAgent,
            session,
        });

        return result;
    });
};

const deleteMyReview = async (user, reviewId, auditContext = {}) => {
    return runInTransaction(async (session) => {
        const review = await getReviewDocumentById(
            reviewId,
            {
                customer_id: user._id,
                deleted_at: null,
            },
            session
        );
        const populatedBefore = await getPopulatedReviewById(review._id, session);
        const before = ReviewMapper.toReviewDto(populatedBefore, { access: 'customer' });

        review.deleted_at = new Date();
        review.deleted_by = user._id;

        await review.save({ session });

        const result = ReviewMapper.toReviewDto(review, { access: 'customer' });

        await auditLogService.recordAuditEvent({
            actorId: user._id,
            action: AUDIT_ACTIONS.REVIEW_DELETED,
            resourceType: AUDIT_RESOURCE_TYPES.REVIEW,
            resourceId: review._id,
            before,
            after: result,
            ip: auditContext.ip,
            userAgent: auditContext.userAgent,
            session,
        });

        return result;
    });
};

const buildDateRangeFilter = (from, to) => {
    if (!from && !to) {
        return null;
    }

    const range = {};

    if (from) {
        range.$gte = from;
    }

    if (to) {
        range.$lte = to;
    }

    return range;
};

const buildHasReplyFilter = (hasReply) => {
    if (hasReply === undefined) {
        return {};
    }

    return hasReply
        ? { 'garage_reply.content': { $type: 'string', $ne: '' } }
        : {
            $or: [
                { garage_reply: null },
                { 'garage_reply.content': { $exists: false } },
            ],
        };
};

const buildReviewListFilter = ({
    customer_id,
    booking_id,
    garage_id,
    service_package_id,
    garage_rating,
    service_rating,
    moderation_status,
    has_reply,
    is_anonymous,
    from,
    to,
    search,
} = {}) => {
    const filter = {
        deleted_at: null,
        ...buildHasReplyFilter(has_reply),
    };

    if (customer_id) {
        filter.customer_id = customer_id;
    }

    if (booking_id) {
        filter.booking_id = booking_id;
    }

    if (garage_id) {
        filter.garage_id = garage_id;
    }

    if (service_package_id) {
        filter.service_package_id = service_package_id;
    }

    if (garage_rating) {
        filter.garage_rating = garage_rating;
    }

    if (service_rating) {
        filter.service_rating = service_rating;
    }

    if (moderation_status) {
        filter.moderation_status = moderation_status;
    }

    if (is_anonymous !== undefined) {
        filter.is_anonymous = is_anonymous;
    }

    const createdAtRange = buildDateRangeFilter(from, to);

    if (createdAtRange) {
        filter.created_at = createdAtRange;
    }

    if (search) {
        const keyword = escapeRegExp(search.trim());

        filter.$and = [
            ...(filter.$and || []),
            {
                $or: [
                    { comment: { $regex: keyword, $options: 'i' } },
                    { 'garage_snapshot.name': { $regex: keyword, $options: 'i' } },
                    { 'garage_snapshot.garage_code': { $regex: keyword, $options: 'i' } },
                    { 'service_package_snapshot.name': { $regex: keyword, $options: 'i' } },
                    { 'service_package_snapshot.service_code': { $regex: keyword, $options: 'i' } },
                ],
            },
        ];
    }

    return filter;
};

const getReviewsByFilter = async (filter, { page = 1, limit = 20, access }) => {
    const skip = (page - 1) * limit;
    const [reviews, total] = await Promise.all([
        populateReviewQuery(
            Review.find(filter)
                .sort({ created_at: -1 })
                .skip(skip)
                .limit(limit)
        ),
        Review.countDocuments(filter),
    ]);

    return {
        data: ReviewMapper.toReviewDtoList(reviews, { access }),
        meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        },
    };
};

const assertStaffGarageContext = (staffContext) => {
    if (!staffContext?.garage_id) {
        throw new AppError(
            'Staff garage assignment is required',
            403,
            'STAFF_GARAGE_REQUIRED'
        );
    }
};

const getStaffReviews = async (staffContext, query = {}) => {
    assertStaffGarageContext(staffContext);

    const filter = buildReviewListFilter({
        ...query,
        garage_id: staffContext.garage_id,
    });

    return getReviewsByFilter(filter, {
        page: query.page,
        limit: query.limit,
        access: 'staff',
    });
};

const getStaffReviewById = async (staffContext, reviewId) => {
    assertStaffGarageContext(staffContext);

    const review = await populateReviewQuery(
        Review.findOne({
            _id: reviewId,
            garage_id: staffContext.garage_id,
            deleted_at: null,
        })
    );

    if (!review) {
        throw new AppError('Review not found', 404, 'REVIEW_NOT_FOUND');
    }

    return ReviewMapper.toReviewDto(review, { access: 'staff' });
};

const replyToReview = async (
    user,
    staffContext,
    reviewId,
    content,
    auditContext = {}
) => {
    assertStaffGarageContext(staffContext);

    return runInTransaction(async (session) => {
        const review = await getReviewDocumentById(
            reviewId,
            {
                garage_id: staffContext.garage_id,
                deleted_at: null,
            },
            session
        );
        const populatedBefore = await getPopulatedReviewById(review._id, session);
        const before = ReviewMapper.toReviewDto(populatedBefore, { access: 'staff' });
        const now = new Date();
        const repliedAt = review.garage_reply?.replied_at || now;

        review.garage_reply = {
            content: content.trim(),
            replied_by: user._id,
            replied_at: repliedAt,
            updated_at: now,
        };

        await review.save({ session });

        const populatedAfter = await getPopulatedReviewById(review._id, session);
        const result = ReviewMapper.toReviewDto(populatedAfter, { access: 'staff' });

        await auditLogService.recordAuditEvent({
            actorId: user._id,
            action: AUDIT_ACTIONS.REVIEW_REPLIED,
            resourceType: AUDIT_RESOURCE_TYPES.REVIEW,
            resourceId: review._id,
            before,
            after: result,
            ip: auditContext.ip,
            userAgent: auditContext.userAgent,
            metadata: {
                garage_id: staffContext.garage_id,
            },
            session,
        });

        await notificationService.createInAppNotification({
            userId: review.customer_id,
            type: NOTIFICATION_TYPES.REVIEW_REPLIED,
            title: 'Garage replied to your review',
            message: `${review.garage_snapshot.name} replied to your review.`,
            relatedType: NOTIFICATION_RELATED_TYPES.REVIEW,
            relatedId: review._id,
            metadata: {
                review_id: review._id.toString(),
                booking_id: review.booking_id.toString(),
                garage_id: review.garage_id.toString(),
            },
            session,
        });

        return result;
    });
};

const deleteReviewReply = async (
    user,
    staffContext,
    reviewId,
    auditContext = {}
) => {
    assertStaffGarageContext(staffContext);

    return runInTransaction(async (session) => {
        const review = await getReviewDocumentById(
            reviewId,
            {
                garage_id: staffContext.garage_id,
                deleted_at: null,
            },
            session
        );

        if (!review.garage_reply) {
            throw new AppError('Review reply not found', 404, 'REVIEW_REPLY_NOT_FOUND');
        }

        const populatedBefore = await getPopulatedReviewById(review._id, session);
        const before = ReviewMapper.toReviewDto(populatedBefore, { access: 'staff' });

        review.garage_reply = null;

        await review.save({ session });

        const populatedAfter = await getPopulatedReviewById(review._id, session);
        const result = ReviewMapper.toReviewDto(populatedAfter, { access: 'staff' });

        await auditLogService.recordAuditEvent({
            actorId: user._id,
            action: AUDIT_ACTIONS.REVIEW_REPLY_DELETED,
            resourceType: AUDIT_RESOURCE_TYPES.REVIEW,
            resourceId: review._id,
            before,
            after: result,
            ip: auditContext.ip,
            userAgent: auditContext.userAgent,
            metadata: {
                garage_id: staffContext.garage_id,
            },
            session,
        });

        return result;
    });
};

const getAdminReviews = async (query = {}) => {
    const filter = buildReviewListFilter(query);

    return getReviewsByFilter(filter, {
        page: query.page,
        limit: query.limit,
        access: 'admin',
    });
};

const getAdminReviewById = async (reviewId) => {
    const review = await populateReviewQuery(
        Review.findOne({
            _id: reviewId,
            deleted_at: null,
        })
    );

    if (!review) {
        throw new AppError('Review not found', 404, 'REVIEW_NOT_FOUND');
    }

    return ReviewMapper.toReviewDto(review, { access: 'admin' });
};

const moderateReview = async (
    user,
    reviewId,
    payload,
    auditContext = {}
) => {
    return runInTransaction(async (session) => {
        const review = await getReviewDocumentById(
            reviewId,
            { deleted_at: null },
            session
        );

        if (review.moderation_status === payload.status) {
            throw new AppError(
                'Review already has the requested moderation status',
                409,
                'REVIEW_MODERATION_STATUS_UNCHANGED'
            );
        }

        const populatedBefore = await getPopulatedReviewById(review._id, session);
        const before = ReviewMapper.toReviewDto(populatedBefore, { access: 'admin' });
        const isHidden = payload.status === REVIEW_MODERATION_STATUSES.HIDDEN;

        review.moderation_status = payload.status;
        review.moderation_reason = isHidden ? payload.reason : null;
        review.moderation_note = normalizeText(payload.note);
        review.moderated_by = user._id;
        review.moderated_at = new Date();

        await review.save({ session });

        const populatedAfter = await getPopulatedReviewById(review._id, session);
        const result = ReviewMapper.toReviewDto(populatedAfter, { access: 'admin' });

        await auditLogService.recordAuditEvent({
            actorId: user._id,
            action: isHidden
                ? AUDIT_ACTIONS.REVIEW_HIDDEN
                : AUDIT_ACTIONS.REVIEW_PUBLISHED,
            resourceType: AUDIT_RESOURCE_TYPES.REVIEW,
            resourceId: review._id,
            before,
            after: result,
            ip: auditContext.ip,
            userAgent: auditContext.userAgent,
            metadata: {
                moderation_reason: review.moderation_reason,
                moderation_note: review.moderation_note,
            },
            session,
        });

        await notificationService.createInAppNotification({
            userId: review.customer_id,
            type: isHidden
                ? NOTIFICATION_TYPES.REVIEW_HIDDEN
                : NOTIFICATION_TYPES.REVIEW_PUBLISHED,
            title: isHidden ? 'Your review was hidden' : 'Your review was published',
            message: isHidden
                ? 'Your review was hidden after moderation. Open the review to see the reason.'
                : 'Your review is public again after moderation.',
            relatedType: NOTIFICATION_RELATED_TYPES.REVIEW,
            relatedId: review._id,
            metadata: {
                review_id: review._id.toString(),
                booking_id: review.booking_id.toString(),
                moderation_reason: review.moderation_reason,
            },
            session,
        });

        return result;
    });
};

const getReviewAnalytics = async ({
    garage_id,
    service_package_id,
    moderation_status,
    from,
    to,
} = {}) => {
    const match = {
        deleted_at: null,
        moderation_status,
    };

    if (garage_id) {
        match.garage_id = toObjectId(garage_id);
    }

    if (service_package_id) {
        match.service_package_id = toObjectId(service_package_id);
    }

    const createdAtRange = buildDateRangeFilter(from, to);

    if (createdAtRange) {
        match.created_at = createdAtRange;
    }

    const [facetResult] = await Review.aggregate([
        { $match: match },
        {
            $facet: {
                summary: [
                    {
                        $group: {
                            _id: null,
                            total: { $sum: 1 },
                            garage_rating_average: { $avg: '$garage_rating' },
                            service_rating_average: { $avg: '$service_rating' },
                            replied_count: {
                                $sum: {
                                    $cond: [
                                        { $ne: ['$garage_reply', null] },
                                        1,
                                        0,
                                    ],
                                },
                            },
                            low_rating_count: {
                                $sum: {
                                    $cond: [
                                        {
                                            $or: [
                                                { $lte: ['$garage_rating', 2] },
                                                { $lte: ['$service_rating', 2] },
                                            ],
                                        },
                                        1,
                                        0,
                                    ],
                                },
                            },
                        },
                    },
                ],
                garage_distribution: [
                    {
                        $group: {
                            _id: '$garage_rating',
                            count: { $sum: 1 },
                        },
                    },
                    { $sort: { _id: 1 } },
                ],
                service_distribution: [
                    {
                        $group: {
                            _id: '$service_rating',
                            count: { $sum: 1 },
                        },
                    },
                    { $sort: { _id: 1 } },
                ],
                top_garages: [
                    {
                        $group: {
                            _id: '$garage_id',
                            rating_average: { $avg: '$garage_rating' },
                            rating_count: { $sum: 1 },
                        },
                    },
                    { $sort: { rating_average: -1, rating_count: -1 } },
                    { $limit: 10 },
                    {
                        $lookup: {
                            from: 'garages',
                            localField: '_id',
                            foreignField: '_id',
                            as: 'garage',
                        },
                    },
                    {
                        $unwind: {
                            path: '$garage',
                            preserveNullAndEmptyArrays: true,
                        },
                    },
                ],
                top_services: [
                    {
                        $group: {
                            _id: '$service_package_id',
                            rating_average: { $avg: '$service_rating' },
                            rating_count: { $sum: 1 },
                        },
                    },
                    { $sort: { rating_average: -1, rating_count: -1 } },
                    { $limit: 10 },
                    {
                        $lookup: {
                            from: 'service_packages',
                            localField: '_id',
                            foreignField: '_id',
                            as: 'service_package',
                        },
                    },
                    {
                        $unwind: {
                            path: '$service_package',
                            preserveNullAndEmptyArrays: true,
                        },
                    },
                ],
            },
        },
    ]);

    const summary = facetResult?.summary?.[0] || {
        total: 0,
        garage_rating_average: 0,
        service_rating_average: 0,
        replied_count: 0,
        low_rating_count: 0,
    };
    const buildDistribution = (rows = []) => {
        const distribution = {
            1: 0,
            2: 0,
            3: 0,
            4: 0,
            5: 0,
        };

        rows.forEach((row) => {
            distribution[row._id] = row.count;
        });

        return distribution;
    };

    return {
        total: summary.total,
        garage_rating_average: Math.round((summary.garage_rating_average || 0) * 10) / 10,
        service_rating_average: Math.round((summary.service_rating_average || 0) * 10) / 10,
        replied_count: summary.replied_count,
        response_rate: summary.total > 0
            ? Math.round((summary.replied_count / summary.total) * 1000) / 10
            : 0,
        low_rating_count: summary.low_rating_count,
        garage_distribution: buildDistribution(facetResult?.garage_distribution),
        service_distribution: buildDistribution(facetResult?.service_distribution),
        top_garages: (facetResult?.top_garages || []).map((item) => ({
            garage_id: item._id.toString(),
            garage_name: item.garage?.name || null,
            garage_code: item.garage?.garage_code || null,
            rating_average: Math.round(item.rating_average * 10) / 10,
            rating_count: item.rating_count,
        })),
        top_services: (facetResult?.top_services || []).map((item) => ({
            service_package_id: item._id.toString(),
            service_package_name: item.service_package?.name || null,
            service_code: item.service_package?.service_code || null,
            rating_average: Math.round(item.rating_average * 10) / 10,
            rating_count: item.rating_count,
        })),
    };
};

module.exports = {
    getGarageReviews,
    getGarageReviewSummary,
    getServicePackageReviews,
    getServicePackageReviewSummary,
    getReviewEligibility,
    createReview,
    getMyReviews,
    getMyReviewByBooking,
    updateMyReview,
    deleteMyReview,
    getStaffReviews,
    getStaffReviewById,
    replyToReview,
    deleteReviewReply,
    getAdminReviews,
    getAdminReviewById,
    moderateReview,
    getReviewAnalytics,
};
