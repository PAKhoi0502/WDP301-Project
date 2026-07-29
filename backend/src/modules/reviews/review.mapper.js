const UploadMapper = require('../uploads/upload.mapper');

const toId = (value) => {
    if (!value) {
        return null;
    }

    return value._id?.toString?.() || value.id?.toString?.() || value.toString?.() || value;
};

const toCustomerDto = (customer, isAnonymous, access) => {
    if (access === 'public' && isAnonymous) {
        return {
            id: null,
            full_name: 'Anonymous customer',
            avatar_url: null,
        };
    }

    if (!customer || typeof customer !== 'object' || !customer._id) {
        return null;
    }

    return {
        id: access === 'public' ? null : toId(customer),
        full_name: customer.full_name || 'Customer',
        avatar_url: customer.avatar_url || null,
        ...(access === 'admin' ? {
            email: customer.email || null,
            phone: customer.phone || null,
        } : {}),
    };
};

const toUserSummaryDto = (user) => {
    if (!user || typeof user !== 'object' || !user._id) {
        return null;
    }

    return {
        id: toId(user),
        full_name: user.full_name || '',
        avatar_url: user.avatar_url || null,
        role: user.role || null,
    };
};

const toGarageDto = (garage, snapshot) => {
    if (garage && typeof garage === 'object' && garage._id) {
        return {
            id: toId(garage),
            name: garage.name,
            garage_code: garage.garage_code || null,
            address: garage.address || null,
            city: garage.city || null,
        };
    }

    return {
        id: toId(garage),
        name: snapshot?.name || null,
        garage_code: snapshot?.garage_code || null,
    };
};

const toServicePackageDto = (servicePackage, snapshot) => {
    if (servicePackage && typeof servicePackage === 'object' && servicePackage._id) {
        return {
            id: toId(servicePackage),
            name: servicePackage.name,
            service_code: servicePackage.service_code || null,
            vehicle_type: servicePackage.vehicle_type || null,
            service_type: servicePackage.service_type || null,
        };
    }

    return {
        id: toId(servicePackage),
        name: snapshot?.name || null,
        service_code: snapshot?.service_code || null,
    };
};

const toGarageReplyDto = (reply, access) => {
    if (!reply) {
        return null;
    }

    return {
        content: reply.content,
        replied_by_id: access === 'public' ? undefined : toId(reply.replied_by),
        replied_by: reply.replied_by && typeof reply.replied_by === 'object'
            ? {
                ...toUserSummaryDto(reply.replied_by),
                ...(access === 'public' ? { id: undefined } : {}),
            }
            : null,
        replied_at: reply.replied_at,
        updated_at: reply.updated_at,
    };
};

const toReviewUploadDto = (upload, access) => {
    if (access !== 'public') {
        return UploadMapper.toUploadDto(upload);
    }

    return {
        id: toId(upload),
        url: upload.url,
        mime_type: upload.mime_type,
        width: upload.width,
        height: upload.height,
    };
};

const toReviewDto = (
    review,
    {
        access = 'public',
        legacyRatingField = 'garage_rating',
    } = {}
) => {
    if (!review) {
        return null;
    }

    const plainReview = review.toObject ? review.toObject() : review;
    const isPublic = access === 'public';

    return {
        id: toId(plainReview),
        booking_id: isPublic ? undefined : toId(plainReview.booking_id),
        wash_history_id: isPublic ? undefined : toId(plainReview.wash_history_id),
        customer_id: isPublic ? undefined : toId(plainReview.customer_id),
        customer: toCustomerDto(plainReview.customer_id, plainReview.is_anonymous, access),
        garage_id: toId(plainReview.garage_id),
        garage: toGarageDto(plainReview.garage_id, plainReview.garage_snapshot),
        service_package_id: toId(plainReview.service_package_id),
        service_package: toServicePackageDto(
            plainReview.service_package_id,
            plainReview.service_package_snapshot
        ),
        garage_rating: plainReview.garage_rating,
        service_rating: plainReview.service_rating,
        rating: plainReview[legacyRatingField],
        comment: plainReview.comment,
        upload_ids: isPublic
            ? undefined
            : (plainReview.upload_ids || []).map((upload) => toId(upload)),
        uploads: (plainReview.upload_ids || [])
            .filter((upload) => upload && typeof upload === 'object' && upload._id)
            .map((upload) => toReviewUploadDto(upload, access)),
        is_anonymous: plainReview.is_anonymous,
        moderation_status: isPublic ? undefined : plainReview.moderation_status,
        moderation_reason: isPublic ? undefined : plainReview.moderation_reason,
        moderation_note: isPublic ? undefined : plainReview.moderation_note,
        moderated_by_id: isPublic ? undefined : toId(plainReview.moderated_by),
        moderated_by: isPublic ? undefined : toUserSummaryDto(plainReview.moderated_by),
        moderated_at: isPublic ? undefined : plainReview.moderated_at,
        garage_reply: toGarageReplyDto(plainReview.garage_reply, access),
        deleted_at: isPublic ? undefined : plainReview.deleted_at,
        created_at: plainReview.created_at,
        updated_at: plainReview.updated_at,
    };
};

const toReviewDtoList = (reviews = [], options = {}) => {
    return reviews.map((review) => toReviewDto(review, options));
};

module.exports = {
    toReviewDto,
    toReviewDtoList,
};
