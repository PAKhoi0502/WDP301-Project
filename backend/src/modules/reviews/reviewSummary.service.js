const mongoose = require('mongoose');

const Review = require('./review.model');
const {
    REVIEW_MODERATION_STATUSES,
} = require('../../shared/constants/review.constant');

const createEmptyDistribution = () => ({
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
});

const createEmptySummary = () => ({
    rating_average: 0,
    rating_count: 0,
    distribution: createEmptyDistribution(),
});

const normalizeObjectIds = (values = []) => {
    return values
        .filter(Boolean)
        .map((value) => (
            value instanceof mongoose.Types.ObjectId
                ? value
                : new mongoose.Types.ObjectId(value)
        ));
};

const getSummaryMap = async ({
    subjectField,
    ratingField,
    subjectIds,
}) => {
    const normalizedIds = normalizeObjectIds(subjectIds);

    if (normalizedIds.length === 0) {
        return new Map();
    }

    const rows = await Review.aggregate([
        {
            $match: {
                [subjectField]: { $in: normalizedIds },
                moderation_status: REVIEW_MODERATION_STATUSES.PUBLISHED,
                deleted_at: null,
            },
        },
        {
            $group: {
                _id: {
                    subject_id: `$${subjectField}`,
                    rating: `$${ratingField}`,
                },
                count: { $sum: 1 },
            },
        },
        {
            $group: {
                _id: '$_id.subject_id',
                rating_count: { $sum: '$count' },
                weighted_total: {
                    $sum: {
                        $multiply: ['$_id.rating', '$count'],
                    },
                },
                distribution_rows: {
                    $push: {
                        rating: '$_id.rating',
                        count: '$count',
                    },
                },
            },
        },
    ]);

    return new Map(rows.map((row) => {
        const distribution = createEmptyDistribution();

        row.distribution_rows.forEach((item) => {
            distribution[item.rating] = item.count;
        });

        return [
            row._id.toString(),
            {
                rating_average: row.rating_count > 0
                    ? Math.round((row.weighted_total / row.rating_count) * 10) / 10
                    : 0,
                rating_count: row.rating_count,
                distribution,
            },
        ];
    }));
};

const getGarageSummaryMap = async (garageIds = []) => {
    return getSummaryMap({
        subjectField: 'garage_id',
        ratingField: 'garage_rating',
        subjectIds: garageIds,
    });
};

const getServicePackageSummaryMap = async (servicePackageIds = []) => {
    return getSummaryMap({
        subjectField: 'service_package_id',
        ratingField: 'service_rating',
        subjectIds: servicePackageIds,
    });
};

const getGarageSummary = async (garageId) => {
    const summaryMap = await getGarageSummaryMap([garageId]);

    return summaryMap.get(garageId.toString()) || createEmptySummary();
};

const getServicePackageSummary = async (servicePackageId) => {
    const summaryMap = await getServicePackageSummaryMap([servicePackageId]);

    return summaryMap.get(servicePackageId.toString()) || createEmptySummary();
};

module.exports = {
    createEmptySummary,
    getGarageSummaryMap,
    getServicePackageSummaryMap,
    getGarageSummary,
    getServicePackageSummary,
};
