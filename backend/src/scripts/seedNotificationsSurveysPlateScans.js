require('dotenv').config();

const mongoose = require('mongoose');

const { connectDB, disconnectDB } = require('../config/db');
const Notification = require('../modules/notifications/notification.model');
const Survey = require('../modules/surveys/survey.model');
const SurveyResponse = require('../modules/surveys/surveyResponse.model');
const BookingPlateScan = require('../modules/booking-arrivals/bookingPlateScan.model');
const CameraDevice = require('../modules/booking-arrivals/cameraDevice.model');
const Booking = require('../modules/bookings/booking.model');
const BookingHandover = require('../modules/booking-handovers/bookingHandover.model');
const BookingIncident = require('../modules/booking-incidents/bookingIncident.model');
const CustomerVoucher = require('../modules/customer-vouchers/customerVoucher.model');
const CustomerCase = require('../modules/customer-cases/customerCase.model');
const CustomerCaseMessage = require('../modules/customer-cases/customerCaseMessage.model');
const CustomerCaseTechnicalAssessment = require('../modules/customer-cases/customerCaseTechnicalAssessment.model');
const CustomerCaseResolution = require('../modules/customer-cases/customerCaseResolution.model');
const CustomerCaseRefund = require('../modules/customer-cases/customerCaseRefund.model');
const PointTransaction = require('../modules/loyalty/pointTransaction.model');
const WashHistory = require('../modules/wash-histories/washHistory.model');
const StaffProfile = require('../modules/staff-profiles/staffProfile.model');
const Garage = require('../modules/garages/garage.model');
const User = require('../modules/users/user.model');
const Upload = require('../modules/uploads/upload.model');
const {
    BOOKING_STATUS,
    BOOKING_PAYMENT_STATUS,
} = require('../shared/constants/booking.constant');
const {
    NOTIFICATION_CHANNELS,
    NOTIFICATION_TYPES,
    NOTIFICATION_RELATED_TYPES,
    IN_APP_STATUSES,
    EMAIL_STATUSES,
} = require('../shared/constants/notification.constant');
const {
    SURVEY_STATUSES,
    SURVEY_QUESTION_TYPES,
} = require('../shared/constants/survey.constant');
const {
    PLATE_SCAN_STATUSES,
    PLATE_SCAN_MODES,
    PLATE_CAPTURE_SOURCES,
    PLATE_MATCH_TYPES,
    PLATE_QUALITY_FLAGS,
    PLATE_SCAN_REJECTION_REASONS,
    normalizeLicensePlate,
} = require('../shared/constants/bookingArrival.constant');
const {
    BOOKING_HANDOVER_STATES,
    CUSTOMER_CASE_STATUSES,
    CUSTOMER_CASE_TECHNICAL_ASSESSMENT_STATUSES,
    CUSTOMER_CASE_RESOLUTION_STATUSES,
} = require('../shared/constants/customerCase.constant');
const { USER_ROLES } = require('../shared/constants/roles.constant');
const { STAFF_TYPES } = require('../shared/constants/staff.constant');
const { POINT_TRANSACTION_TYPES } = require('../shared/constants/loyalty.constant');
const { stableHexId } = require('./seedBookingCatalog');
const { getSeedReferenceDate } = require('./seedTime');
const { GARAGE_SEEDS } = require('./seedCatalog');
const {
    SURVEY_KEYS,
    SURVEY_TARGETS,
    SURVEY_CATALOG,
    SURVEY_RESPONSE_TARGETS,
    PLATE_SCAN_TARGETS,
    NOTIFICATION_RECENT_BOOKING_TARGET,
    NOTIFICATION_SEED_KEY,
    PLATE_SCAN_CLIENT_EVENT_PREFIX,
} = require('./seedNotificationsSurveysPlateScansCatalog');

const toId = (value) => String(value?._id || value || '');
const addMinutes = (date, minutes) => new Date(
    new Date(date).getTime() + minutes * 60000
);
const addDays = (date, days) => addMinutes(date, days * 1440);
const sameId = (left, right) => toId(left) === toId(right);
const applySession = (query, session) => (
    session ? query.session(session) : query
);
const deterministicId = (namespace, naturalKey) => (
    new mongoose.Types.ObjectId(stableHexId(namespace, naturalKey))
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
const maxDate = (...dates) => new Date(Math.max(
    ...dates.filter(Boolean).map((date) => new Date(date).getTime())
));
const minDate = (...dates) => new Date(Math.min(
    ...dates.filter(Boolean).map((date) => new Date(date).getTime())
));
const clampBefore = (date, ceiling) => (
    new Date(date) < new Date(ceiling)
        ? new Date(date)
        : addMinutes(ceiling, -1)
);
const sortByTimeAndId = (left, right, field) => (
    new Date(left[field]).getTime() - new Date(right[field]).getTime()
    || toId(left._id).localeCompare(toId(right._id))
);
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
const takeEvenly = (items, count) => {
    if (count > items.length) {
        throw new Error(
            `Cannot select ${count} records from ${items.length} candidates`
        );
    }

    if (count === items.length) {
        return [...items];
    }

    const selected = [];
    const usedIndexes = new Set();

    for (let index = 0; index < count; index += 1) {
        const position = Math.round(
            index * (items.length - 1) / Math.max(1, count - 1)
        );
        let candidateIndex = position;

        while (usedIndexes.has(candidateIndex)) {
            candidateIndex = (candidateIndex + 1) % items.length;
        }

        usedIndexes.add(candidateIndex);
        selected.push(items[candidateIndex]);
    }

    return selected;
};

const buildSurveyDefinitions = ({
    admins,
    referenceDate,
}) => SURVEY_CATALOG.map((catalogItem, surveyIndex) => {
    const surveyId = deterministicId(
        'AUTOWASH_SURVEY_V1',
        catalogItem.key
    );
    const createdAt = addDays(
        referenceDate,
        catalogItem.created_day_offset
    );
    const publishedAt = catalogItem.published_day_offset === null
        ? null
        : addDays(referenceDate, catalogItem.published_day_offset);
    const closedAt = catalogItem.closed_day_offset === null
        ? null
        : addDays(referenceDate, catalogItem.closed_day_offset);
    const updatedAt = closedAt || publishedAt || createdAt;

    return {
        _id: surveyId,
        title: catalogItem.title,
        description: catalogItem.description,
        status: catalogItem.status,
        questions: catalogItem.questions.map((question) => ({
            _id: deterministicId(
                'AUTOWASH_SURVEY_QUESTION_V1',
                `${catalogItem.key}:${question.key}`
            ),
            text: question.text,
            type: question.type,
            is_required: question.is_required,
            options: [...question.options],
            order: question.order,
        })),
        response_window_days: catalogItem.response_window_days,
        created_by: admins[surveyIndex % admins.length]._id,
        published_at: publishedAt,
        closed_at: closedAt,
        created_at: createdAt,
        updated_at: updatedAt,
    };
});

const buildRatingValues = () => Object.entries(
    SURVEY_RESPONSE_TARGETS.rating_distribution
).flatMap(([rating, count]) => Array(count).fill(Number(rating)));

const buildNpsValues = () => [
    ...Array.from({ length: 12 }, (_, index) => 3 + (index % 4)),
    ...Array.from({ length: 20 }, (_, index) => 7 + (index % 2)),
    ...Array.from({ length: 28 }, (_, index) => 9 + (index % 2)),
];

const getSurveySelectionTargets = ({
    garageIndex,
    surveyKey,
}) => {
    if (surveyKey === SURVEY_KEYS.POST_SERVICE) {
        return garageIndex === 4 ? 4 : 5;
    }

    return garageIndex === 4 ? 8 : 7;
};

const selectSurveyBookings = ({
    bookings,
    washHistoryByBookingId,
    garages,
    surveys,
    referenceDate,
}) => {
    const selectedIds = new Set();
    const selections = [];

    for (const [garageIndex, garage] of garages.entries()) {
        for (const surveyKey of [
            SURVEY_KEYS.POST_SERVICE,
            SURVEY_KEYS.HANDOVER_QUALITY,
        ]) {
            const survey = surveys.find(
                (definition) => definition.seed_key === surveyKey
            );
            const target = getSurveySelectionTargets({
                garageIndex,
                surveyKey,
            });
            const responseCeiling = survey.closed_at || referenceDate;
            const earliestCompletion = surveyKey === SURVEY_KEYS.POST_SERVICE
                ? addDays(referenceDate, -7)
                : addDays(referenceDate, -21);
            const candidates = bookings
                .filter((booking) => (
                    sameId(booking.garage_id, garage._id)
                    && booking.status === BOOKING_STATUS.COMPLETED
                    && booking.payment_status === BOOKING_PAYMENT_STATUS.PAID
                    && !booking.is_walk_in
                    && booking.customer_id
                    && booking.completed_at
                    && new Date(booking.completed_at) >= earliestCompletion
                    && new Date(booking.completed_at)
                        >= addMinutes(survey.published_at, 30)
                    && new Date(booking.completed_at)
                        <= addMinutes(responseCeiling, -60)
                    && washHistoryByBookingId.has(toId(booking._id))
                    && !selectedIds.has(toId(booking._id))
                ))
                .sort((left, right) => (
                    sortByTimeAndId(left, right, 'completed_at')
                ));

            const chosen = takeEvenly(candidates, target);

            for (const booking of chosen) {
                selectedIds.add(toId(booking._id));
                selections.push({
                    survey,
                    booking,
                    washHistory: washHistoryByBookingId.get(
                        toId(booking._id)
                    ),
                    garage,
                });
            }
        }
    }

    return selections;
};

const getTextAnswer = ({
    booking,
    responseIndex,
}) => {
    const caseComments = [
        'Garage đã tiếp nhận góp ý nghiêm túc, mong lần sau kiểm tra kỹ hơn trước khi bàn giao.',
        'Nhân viên phản hồi rõ ràng, tuy nhiên thời gian xử lý tình huống có thể nhanh hơn.',
        'Mong garage thông báo tiến độ chủ động hơn khi phát sinh vấn đề trong quá trình làm xe.',
    ];
    const regularComments = [
        'Xe sạch, nhân viên hướng dẫn rõ ràng và thời gian hoàn thành đúng như dự kiến.',
        'Khu vực chờ ổn, mong garage cập nhật tiến độ thường xuyên hơn trên ứng dụng.',
        'Quy trình nhận và bàn giao xe dễ hiểu, chất lượng dịch vụ phù hợp với chi phí.',
        'Nhân viên thân thiện, lần sau tôi vẫn ưu tiên đặt lịch tại garage này.',
        'Dịch vụ nhìn chung tốt, có thể cải thiện thêm thời gian chờ vào khung giờ đông.',
    ];

    return booking.customer_case_id
        ? caseComments[responseIndex % caseComments.length]
        : regularComments[responseIndex % regularComments.length];
};

const buildAnswers = ({
    survey,
    booking,
    responseIndex,
    rating,
    nps,
    includeText,
}) => {
    const answers = [];

    for (const question of survey.questions) {
        const answer = {
            question_id: question._id,
            question_text_snapshot: question.text,
            question_type_snapshot: question.type,
            numeric_value: null,
            text_value: null,
            selected_options: [],
        };

        if (question.type === SURVEY_QUESTION_TYPES.RATING) {
            answer.numeric_value = rating;
        } else if (question.type === SURVEY_QUESTION_TYPES.NPS) {
            answer.numeric_value = nps;
        } else if (
            question.type === SURVEY_QUESTION_TYPES.SINGLE_CHOICE
        ) {
            answer.selected_options = [
                question.options[responseIndex % question.options.length],
            ];
        } else if (
            question.type === SURVEY_QUESTION_TYPES.MULTI_CHOICE
        ) {
            if (rating <= 3 || responseIndex % 3 === 0) {
                answer.selected_options = [
                    question.options[responseIndex % question.options.length],
                    question.options[
                        (responseIndex + 2) % question.options.length
                    ],
                ].filter((value, index, values) => (
                    values.indexOf(value) === index
                ));
            }
        } else if (
            question.type === SURVEY_QUESTION_TYPES.TEXT
            && includeText
        ) {
            answer.text_value = getTextAnswer({
                booking,
                responseIndex,
            });
        } else if (
            question.type === SURVEY_QUESTION_TYPES.TEXT
            && !question.is_required
        ) {
            continue;
        }

        answers.push(answer);
    }

    return answers;
};

const buildSurveyResponseDefinitions = ({
    bookings,
    washHistories,
    garages,
    surveyDefinitions,
    referenceDate,
}) => {
    const surveys = surveyDefinitions.map((survey, index) => ({
        ...survey,
        seed_key: SURVEY_CATALOG[index].key,
    }));
    const washHistoryByBookingId = new Map(washHistories.map(
        (history) => [toId(history.booking_id), history]
    ));
    const selections = selectSurveyBookings({
        bookings,
        washHistoryByBookingId,
        garages,
        surveys,
        referenceDate,
    });
    const caseFirstSelections = [...selections].sort((left, right) => (
        Number(Boolean(right.booking.customer_case_id))
            - Number(Boolean(left.booking.customer_case_id))
        || new Date(left.booking.completed_at).getTime()
            - new Date(right.booking.completed_at).getTime()
        || toId(left.booking._id).localeCompare(toId(right.booking._id))
    ));
    const ratings = buildRatingValues();
    const npsValues = buildNpsValues();

    return caseFirstSelections.map((selection, responseIndex) => {
        const submittedAt = clampBefore(
            addMinutes(selection.booking.completed_at, 45),
            selection.survey.closed_at || referenceDate
        );

        return {
            _id: deterministicId(
                'AUTOWASH_SURVEY_RESPONSE_V1',
                `${toId(selection.survey._id)}:${toId(selection.booking._id)}`
            ),
            survey_id: selection.survey._id,
            booking_id: selection.booking._id,
            wash_history_id: selection.washHistory._id,
            customer_id: selection.booking.customer_id,
            answers: buildAnswers({
                survey: selection.survey,
                booking: selection.booking,
                responseIndex,
                rating: ratings[responseIndex],
                nps: npsValues[responseIndex],
                includeText:
                    responseIndex < SURVEY_RESPONSE_TARGETS.text_answers,
            }),
            upload_ids: [],
            submitted_at: submittedAt,
            created_at: submittedAt,
            updated_at: submittedAt,
        };
    });
};

const formatPlate = (normalizedPlate) => {
    const plate = normalizeLicensePlate(normalizedPlate);

    if (plate.length <= 5) {
        return plate;
    }

    return `${plate.slice(0, 3)}-${plate.slice(3, 6)}.${plate.slice(6)}`;
};

const mutatePlate = (normalizedPlate, offset = 1) => {
    const plate = normalizeLicensePlate(normalizedPlate);
    const lastCharacter = plate.slice(-1);
    const replacement = /\d/.test(lastCharacter)
        ? String((Number(lastCharacter) + offset) % 10)
        : String(offset % 10);

    return `${plate.slice(0, -1)}${replacement}`;
};

const buildCharacterConfidences = (plate, baseConfidence) => (
    [...normalizeLicensePlate(plate)].map((character, index) => ({
        character,
        confidence: Math.max(
            0.7,
            Number((baseConfidence - (index % 3) * 0.01).toFixed(2))
        ),
    }))
);

const buildFrameResult = ({
    uploadId,
    rawPlate,
    normalizedPlate,
    confidence,
    vehicleType,
    qualityFlags = [],
    processingTimeMs,
    errorCode = null,
}) => ({
    upload_id: uploadId,
    raw_plate_text: rawPlate,
    normalized_plate: normalizedPlate,
    confidence,
    character_confidences: normalizedPlate
        ? buildCharacterConfidences(normalizedPlate, confidence)
        : [],
    vehicle_type: vehicleType || 'UNKNOWN',
    quality_flags: qualityFlags,
    multiple_plate_count: 0,
    bounding_box: normalizedPlate
        ? {
            x: 0.31,
            y: 0.58,
            width: 0.38,
            height: 0.15,
        }
        : null,
    processing_time_ms: processingTimeMs,
    error_code: errorCode,
});

const getStaffMaps = ({
    staffProfiles,
    garages,
}) => {
    const profilesByGarage = new Map(garages.map((garage) => [
        toId(garage._id),
        staffProfiles.filter((profile) => (
            sameId(profile.garage_id, garage._id)
        )),
    ]));
    const getProfile = (garageId, staffType) => {
        const profile = (profilesByGarage.get(toId(garageId)) || [])
            .find((candidate) => candidate.staff_type === staffType);

        if (!profile) {
            throw new Error(
                `Missing staff profile ${toId(garageId)}:${staffType}`
            );
        }

        return profile;
    };

    return {
        profilesByGarage,
        getProfile,
    };
};

const selectPlateScanBookings = ({
    bookings,
    garages,
    referenceDate,
}) => {
    const cutoff = addDays(referenceDate, -8);
    const byGarage = new Map();

    for (const garage of garages) {
        const candidates = bookings
            .filter((booking) => (
                sameId(booking.garage_id, garage._id)
                && booking.status === BOOKING_STATUS.COMPLETED
                && booking.arrived_at
                && booking.checked_in_at
                && booking.normalized_license_plate
                && new Date(booking.arrived_at) < cutoff
            ))
            .sort((left, right) => (
                new Date(right.arrived_at).getTime()
                    - new Date(left.arrived_at).getTime()
                || toId(left._id).localeCompare(toId(right._id))
            ));

        byGarage.set(toId(garage._id), takeEvenly(candidates, 4));
    }

    return byGarage;
};

const buildConfirmedScan = ({
    booking,
    garage,
    camera,
    customerServiceProfile,
    sequence,
}) => {
    const scanId = deterministicId(
        'AUTOWASH_PLATE_SCAN_CONFIRMED_V1',
        `${garage.garage_code}:${sequence}`
    );
    const uploadId = deterministicId(
        'AUTOWASH_PLATE_SCAN_PURGED_UPLOAD_V1',
        `${toId(scanId)}:0`
    );
    const normalizedPlate = normalizeLicensePlate(
        booking.normalized_license_plate
    );
    const capturedAt = new Date(booking.arrived_at);
    const serverReceivedAt = addMinutes(capturedAt, 0.05);
    const confirmedAt = addMinutes(capturedAt, 1);
    const retainUntil = addDays(capturedAt, 7);
    const imageDeletedAt = addMinutes(retainUntil, 60);
    const confidence = Number((0.96 - sequence * 0.01).toFixed(2));

    return {
        _id: scanId,
        garage_id: garage._id,
        staff_id: null,
        camera_device_id: camera._id,
        client_event_id:
            `${PLATE_SCAN_CLIENT_EVENT_PREFIX}-CONF-${garage.garage_code}-${sequence + 1}`,
        mode: PLATE_SCAN_MODES.GATE,
        capture_source: PLATE_CAPTURE_SOURCES.GATE_CAMERA,
        captured_at: capturedAt,
        server_received_at: serverReceivedAt,
        status: PLATE_SCAN_STATUSES.CONFIRMED,
        upload_ids: [uploadId],
        primary_upload_id: uploadId,
        plate_crop_url: null,
        frame_results: [
            buildFrameResult({
                uploadId,
                rawPlate: formatPlate(normalizedPlate),
                normalizedPlate,
                confidence,
                vehicleType: booking.vehicle_type,
                processingTimeMs: 430 + sequence * 35,
            }),
        ],
        raw_plate_text: formatPlate(normalizedPlate),
        normalized_plate: normalizedPlate,
        confidence,
        character_confidences: buildCharacterConfidences(
            normalizedPlate,
            confidence
        ),
        detected_vehicle_type: booking.vehicle_type,
        quality_flags: [],
        multiple_plate_count: 0,
        weather: sequence % 3 === 0 ? 'RAIN' : 'CLEAR',
        time_of_day: 'DAY',
        provider: 'SEED_PLATE_RECOGNITION',
        model_version: 'seed-v1.0',
        processing_time_ms: 430 + sequence * 35,
        retry_of_scan_id: null,
        retry_count: 0,
        candidates: [{
            booking_id: booking._id,
            match_type: PLATE_MATCH_TYPES.EXACT,
            edit_distance: 0,
            scheduled_distance_minutes: Math.round(Math.abs(
                new Date(booking.start_time).getTime()
                    - capturedAt.getTime()
            ) / 60000),
            vehicle_type_mismatch: false,
        }],
        matched_booking_id: booking._id,
        match_type: PLATE_MATCH_TYPES.EXACT,
        confirmed_booking_id: booking._id,
        confirmed_by_id: customerServiceProfile.user_id,
        confirmed_at: confirmedAt,
        staff_confirmed_vehicle: true,
        manual_override: false,
        override_reason: null,
        rejection_reason: null,
        rejection_note: null,
        rejected_by_id: null,
        rejected_at: null,
        alternate_vehicle_status: 'NONE',
        failure_code: null,
        failure_message: null,
        retain_until: retainUntil,
        image_deleted_at: imageDeletedAt,
        expires_at: addMinutes(capturedAt, 360),
        created_at: serverReceivedAt,
        updated_at: imageDeletedAt,
    };
};

const buildRejectedScan = ({
    booking,
    garage,
    customerServiceProfile,
}) => {
    const scanId = deterministicId(
        'AUTOWASH_PLATE_SCAN_REJECTED_V1',
        garage.garage_code
    );
    const uploadId = deterministicId(
        'AUTOWASH_PLATE_SCAN_PURGED_UPLOAD_V1',
        `${toId(scanId)}:0`
    );
    const capturedAt = addMinutes(booking.arrived_at, -20);
    const normalizedPlate = mutatePlate(
        booking.normalized_license_plate,
        Number(garage.garage_code.slice(-1)) || 1
    );
    const rejectedAt = addMinutes(capturedAt, 2);
    const retainUntil = addDays(capturedAt, 7);
    const imageDeletedAt = addMinutes(retainUntil, 60);
    const isVehicleMismatch = Number(garage.garage_code.slice(-1)) % 2 === 0;

    return {
        _id: scanId,
        garage_id: garage._id,
        staff_id: customerServiceProfile.user_id,
        camera_device_id: null,
        client_event_id:
            `${PLATE_SCAN_CLIENT_EVENT_PREFIX}-REJ-${garage.garage_code}`,
        mode: PLATE_SCAN_MODES.SINGLE,
        capture_source: PLATE_CAPTURE_SOURCES.STAFF_CAMERA,
        captured_at: capturedAt,
        server_received_at: addMinutes(capturedAt, 0.03),
        status: PLATE_SCAN_STATUSES.REJECTED,
        upload_ids: [uploadId],
        primary_upload_id: uploadId,
        plate_crop_url: null,
        frame_results: [
            buildFrameResult({
                uploadId,
                rawPlate: formatPlate(normalizedPlate),
                normalizedPlate,
                confidence: 0.84,
                vehicleType: isVehicleMismatch
                    ? (booking.vehicle_type === 'CAR' ? 'MOTORBIKE' : 'CAR')
                    : booking.vehicle_type,
                qualityFlags: [PLATE_QUALITY_FLAGS.BAD_ANGLE],
                processingTimeMs: 690,
            }),
        ],
        raw_plate_text: formatPlate(normalizedPlate),
        normalized_plate: normalizedPlate,
        confidence: 0.84,
        character_confidences: buildCharacterConfidences(
            normalizedPlate,
            0.84
        ),
        detected_vehicle_type: isVehicleMismatch
            ? (booking.vehicle_type === 'CAR' ? 'MOTORBIKE' : 'CAR')
            : booking.vehicle_type,
        quality_flags: [PLATE_QUALITY_FLAGS.BAD_ANGLE],
        multiple_plate_count: 0,
        weather: 'CLEAR',
        time_of_day: 'DAY',
        provider: 'SEED_PLATE_RECOGNITION',
        model_version: 'seed-v1.0',
        processing_time_ms: 690,
        retry_of_scan_id: null,
        retry_count: 0,
        candidates: [{
            booking_id: booking._id,
            match_type: PLATE_MATCH_TYPES.FUZZY,
            edit_distance: 1,
            scheduled_distance_minutes: 20,
            vehicle_type_mismatch: isVehicleMismatch,
        }],
        matched_booking_id: booking._id,
        match_type: PLATE_MATCH_TYPES.FUZZY,
        confirmed_booking_id: null,
        confirmed_by_id: null,
        confirmed_at: null,
        staff_confirmed_vehicle: false,
        manual_override: false,
        override_reason: null,
        rejection_reason: isVehicleMismatch
            ? PLATE_SCAN_REJECTION_REASONS.VEHICLE_MISMATCH
            : PLATE_SCAN_REJECTION_REASONS.WRONG_BOOKING,
        rejection_note: isVehicleMismatch
            ? 'Loại phương tiện nhận diện không khớp hồ sơ đặt lịch.'
            : 'Nhân viên xác nhận biển số không thuộc booking được gợi ý.',
        rejected_by_id: customerServiceProfile.user_id,
        rejected_at: rejectedAt,
        alternate_vehicle_status: 'NONE',
        failure_code: null,
        failure_message: null,
        retain_until: retainUntil,
        image_deleted_at: imageDeletedAt,
        expires_at: addMinutes(capturedAt, 30),
        created_at: addMinutes(capturedAt, 0.03),
        updated_at: imageDeletedAt,
    };
};

const buildExpiredScan = ({
    garage,
    vehicleType,
    garageIndex,
    sequence,
    referenceDate,
}) => {
    const isBatch = sequence === 0;
    const scanId = deterministicId(
        'AUTOWASH_PLATE_SCAN_EXPIRED_V1',
        `${garage.garage_code}:${sequence}`
    );
    const uploadCount = isBatch ? 3 : 1;
    const uploadIds = Array.from(
        { length: uploadCount },
        (_, uploadIndex) => deterministicId(
            'AUTOWASH_PLATE_SCAN_PURGED_UPLOAD_V1',
            `${toId(scanId)}:${uploadIndex}`
        )
    );
    const capturedAt = addDays(
        referenceDate,
        -(10 + garageIndex * 2 + sequence)
    );
    const captureSource = isBatch
        ? PLATE_CAPTURE_SOURCES.LIVE_CAMERA
        : garageIndex < 3
            ? PLATE_CAPTURE_SOURCES.GALLERY
            : PLATE_CAPTURE_SOURCES.OFFLINE_GATE;
    const qualityFlags = isBatch
        ? [PLATE_QUALITY_FLAGS.NO_PLATE_DETECTED]
        : [PLATE_QUALITY_FLAGS.BLUR, PLATE_QUALITY_FLAGS.GLARE];
    const retainUntil = addDays(capturedAt, 7);
    const imageDeletedAt = addMinutes(retainUntil, 60);

    return {
        _id: scanId,
        garage_id: garage._id,
        staff_id: null,
        camera_device_id: null,
        client_event_id:
            `${PLATE_SCAN_CLIENT_EVENT_PREFIX}-EXP-${garage.garage_code}-${sequence + 1}`,
        mode: isBatch
            ? PLATE_SCAN_MODES.LIVE_BATCH
            : PLATE_SCAN_MODES.SINGLE,
        capture_source: captureSource,
        captured_at: capturedAt,
        server_received_at: addMinutes(capturedAt, 0.05),
        status: PLATE_SCAN_STATUSES.EXPIRED,
        upload_ids: uploadIds,
        primary_upload_id: uploadIds[0],
        plate_crop_url: null,
        frame_results: uploadIds.map((uploadId, uploadIndex) => (
            buildFrameResult({
                uploadId,
                rawPlate: null,
                normalizedPlate: null,
                confidence: 0,
                vehicleType,
                qualityFlags,
                processingTimeMs: 510 + uploadIndex * 40,
                errorCode: isBatch
                    ? 'NO_PLATE_DETECTED'
                    : 'LOW_IMAGE_QUALITY',
            })
        )),
        raw_plate_text: null,
        normalized_plate: null,
        confidence: 0,
        character_confidences: [],
        detected_vehicle_type: vehicleType,
        quality_flags: qualityFlags,
        multiple_plate_count: 0,
        weather: captureSource === PLATE_CAPTURE_SOURCES.OFFLINE_GATE
            ? 'RAIN'
            : 'UNKNOWN',
        time_of_day: captureSource === PLATE_CAPTURE_SOURCES.OFFLINE_GATE
            ? 'NIGHT'
            : 'DAY',
        provider: 'SEED_PLATE_RECOGNITION',
        model_version: 'seed-v1.0',
        processing_time_ms: 510,
        retry_of_scan_id: null,
        retry_count: 0,
        candidates: [],
        matched_booking_id: null,
        match_type: PLATE_MATCH_TYPES.NONE,
        confirmed_booking_id: null,
        confirmed_by_id: null,
        confirmed_at: null,
        staff_confirmed_vehicle: false,
        manual_override: false,
        override_reason: null,
        rejection_reason: null,
        rejection_note: null,
        rejected_by_id: null,
        rejected_at: null,
        alternate_vehicle_status: 'NONE',
        failure_code: isBatch
            ? 'NO_STAFF_CONFIRMATION'
            : 'SCAN_SESSION_EXPIRED',
        failure_message: isBatch
            ? 'Phiên quét trực tiếp kết thúc mà không nhận diện được biển số.'
            : 'Kết quả quét hết thời gian xác nhận của nhân viên.',
        retain_until: retainUntil,
        image_deleted_at: imageDeletedAt,
        expires_at: addMinutes(
            capturedAt,
            captureSource === PLATE_CAPTURE_SOURCES.OFFLINE_GATE
                ? 360
                : 30
        ),
        created_at: addMinutes(capturedAt, 0.05),
        updated_at: imageDeletedAt,
    };
};

const buildPlateScanDefinitions = ({
    bookings,
    garages,
    cameras,
    staffMaps,
    referenceDate,
}) => {
    const bookingsByGarage = selectPlateScanBookings({
        bookings,
        garages,
        referenceDate,
    });
    const cameraByGarageId = new Map(cameras.map(
        (camera) => [toId(camera.garage_id), camera]
    ));
    const confirmed = [];
    const rejected = [];
    const expired = [];

    for (const [garageIndex, garage] of garages.entries()) {
        const selected = bookingsByGarage.get(toId(garage._id));
        const camera = cameraByGarageId.get(toId(garage._id));
        const customerServiceProfile = staffMaps.getProfile(
            garage._id,
            STAFF_TYPES.CUSTOMER_SERVICE_STAFF
        );

        if (!camera) {
            throw new Error(
                `Missing camera dependency for ${garage.garage_code}`
            );
        }

        for (let sequence = 0; sequence < 3; sequence += 1) {
            confirmed.push(buildConfirmedScan({
                booking: selected[sequence],
                garage,
                camera,
                customerServiceProfile,
                sequence,
            }));
        }

        rejected.push(buildRejectedScan({
            booking: selected[3],
            garage,
            customerServiceProfile,
        }));
        expired.push(buildExpiredScan({
            garage,
            vehicleType: selected[0].vehicle_type,
            garageIndex,
            sequence: 0,
            referenceDate,
        }));
        expired.push(buildExpiredScan({
            garage,
            vehicleType: selected[0].vehicle_type,
            garageIndex,
            sequence: 1,
            referenceDate,
        }));
    }

    for (
        let retryIndex = 0;
        retryIndex < PLATE_SCAN_TARGETS.retry_chains;
        retryIndex += 1
    ) {
        const retryScan = confirmed[retryIndex * 3];
        const originalScan = expired[retryIndex * 2 + 1];
        const originalCapturedAt = addMinutes(retryScan.captured_at, -15);
        const originalRetainUntil = addDays(originalCapturedAt, 7);

        retryScan.retry_of_scan_id = originalScan._id;
        retryScan.retry_count = 1;
        originalScan.captured_at = originalCapturedAt;
        originalScan.server_received_at = addMinutes(
            originalCapturedAt,
            0.05
        );
        originalScan.expires_at = addMinutes(originalCapturedAt, 30);
        originalScan.retain_until = originalRetainUntil;
        originalScan.image_deleted_at = addMinutes(
            originalRetainUntil,
            60
        );
        originalScan.created_at = addMinutes(originalCapturedAt, 0.05);
        originalScan.updated_at = originalScan.image_deleted_at;
    }

    return [...confirmed, ...rejected, ...expired];
};

const buildBookingPlateUpdates = (plateScans) => plateScans
    .filter((scan) => scan.status === PLATE_SCAN_STATUSES.CONFIRMED)
    .map((scan) => ({
        booking_id: scan.confirmed_booking_id,
        arrival_detected_at: scan.captured_at,
        arrival_detection_scan_id: scan._id,
        check_in_method: 'PLATE_SCAN',
        check_in_verification_id: scan._id,
        check_in_detected_plate: scan.normalized_plate,
        check_in_match_type: PLATE_MATCH_TYPES.EXACT,
        check_in_manual_override: false,
        check_in_override_reason: null,
    }));

const buildCameraUpdates = ({
    cameras,
    plateScans,
    referenceDate,
}) => cameras.map((camera) => {
    const cameraScans = plateScans.filter(
        (scan) => sameId(scan.camera_device_id, camera._id)
    );
    const lastEventAt = cameraScans.reduce(
        (latest, scan) => (
            !latest || new Date(scan.captured_at) > latest
                ? new Date(scan.captured_at)
                : latest
        ),
        null
    );

    return {
        camera_id: camera._id,
        last_heartbeat_at: addMinutes(referenceDate, -2),
        last_event_at: lastEventAt,
        updated_at: referenceDate,
    };
});

const getUserMaps = ({
    users,
    staffProfiles,
    garages,
}) => {
    const userById = new Map(users.map((user) => [
        toId(user._id),
        user,
    ]));
    const staffUsersByGarage = new Map(garages.map((garage) => [
        toId(garage._id),
        staffProfiles
            .filter((profile) => sameId(profile.garage_id, garage._id))
            .map((profile) => userById.get(toId(profile.user_id)))
            .filter(Boolean),
    ]));
    const customerServiceUsersByGarage = new Map(garages.map((garage) => [
        toId(garage._id),
        staffProfiles
            .filter((profile) => (
                sameId(profile.garage_id, garage._id)
                && profile.staff_type
                    === STAFF_TYPES.CUSTOMER_SERVICE_STAFF
            ))
            .map((profile) => userById.get(toId(profile.user_id)))
            .filter(Boolean),
    ]));
    const roleByUserId = new Map(users.map((user) => [
        toId(user._id),
        user.role,
    ]));

    return {
        userById,
        staffUsersByGarage,
        customerServiceUsersByGarage,
        roleByUserId,
    };
};

const notificationCopy = {
    [NOTIFICATION_TYPES.PAYMENT_CONFIRMED]: {
        title: 'Thanh toán đã được xác nhận',
        message: 'Thanh toán cho booking của bạn đã hoàn tất.',
    },
    [NOTIFICATION_TYPES.REWARD_EARNED]: {
        title: 'Điểm thưởng đã được ghi nhận',
        message: 'Điểm thành viên từ booking đã được cộng vào tài khoản.',
    },
    [NOTIFICATION_TYPES.BOOKING_HANDOVER_READY]: {
        title: 'Phương tiện đã sẵn sàng bàn giao',
        message: 'Garage đã hoàn tất kiểm tra và phương tiện đang chờ bạn nhận.',
    },
    [NOTIFICATION_TYPES.BOOKING_HANDOVER_RELEASED]: {
        title: 'Phương tiện đã được bàn giao',
        message: 'Quy trình bàn giao phương tiện đã hoàn tất.',
    },
    [NOTIFICATION_TYPES.BOOKING_CANCELED]: {
        title: 'Booking đã được hủy',
        message: 'Booking của bạn đã được ghi nhận trạng thái hủy.',
    },
    [NOTIFICATION_TYPES.BOOKING_INCIDENT_REPORTED]: {
        title: 'Booking phát sinh sự cố',
        message: 'Garage đã ghi nhận một sự cố cần theo dõi trong quá trình phục vụ.',
    },
    [NOTIFICATION_TYPES.BOOKING_CUSTOMER_DECISION_REQUIRED]: {
        title: 'Cần xác nhận phương án xử lý',
        message: 'Garage cần bạn xác nhận phương án tiếp tục xử lý booking.',
    },
    [NOTIFICATION_TYPES.BOOKING_INCIDENT_RESOLVED]: {
        title: 'Sự cố booking đã được xử lý',
        message: 'Garage đã hoàn tất phương án xử lý sự cố của booking.',
    },
    [NOTIFICATION_TYPES.COMPENSATION_VOUCHER_ISSUED]: {
        title: 'Voucher bồi hoàn đã được cấp',
        message: 'Một voucher bồi hoàn mới đã được thêm vào tài khoản của bạn.',
    },
    [NOTIFICATION_TYPES.CUSTOMER_CASE_SUBMITTED]: {
        title: 'Yêu cầu hỗ trợ đã được tiếp nhận',
        message: 'Customer case đã được ghi nhận và đưa vào quy trình xử lý.',
    },
    [NOTIFICATION_TYPES.CUSTOMER_CASE_ASSIGNED]: {
        title: 'Customer case đã được phân công',
        message: 'Bạn được phân công phụ trách một customer case.',
    },
    [NOTIFICATION_TYPES.CUSTOMER_CASE_ACKNOWLEDGED]: {
        title: 'Garage đã xác nhận tiếp nhận',
        message: 'Nhân viên phụ trách đã xác nhận tiếp nhận customer case.',
    },
    [NOTIFICATION_TYPES.CUSTOMER_CASE_MESSAGE_RECEIVED]: {
        title: 'Customer case có tin nhắn mới',
        message: 'Bạn nhận được một tin nhắn mới trong customer case.',
    },
    [NOTIFICATION_TYPES.CUSTOMER_CASE_TECHNICAL_ASSESSMENT_ASSIGNED]: {
        title: 'Yêu cầu đánh giá kỹ thuật',
        message: 'Bạn được phân công thực hiện đánh giá kỹ thuật cho customer case.',
    },
    [NOTIFICATION_TYPES.CUSTOMER_CASE_TECHNICAL_ASSESSMENT_SUBMITTED]: {
        title: 'Đánh giá kỹ thuật đã hoàn tất',
        message: 'Kết quả đánh giá kỹ thuật của customer case đã được gửi.',
    },
    [NOTIFICATION_TYPES.CUSTOMER_CASE_RESOLUTION_PROPOSED]: {
        title: 'Garage đã đề xuất phương án xử lý',
        message: 'Một phương án xử lý mới đã được đề xuất cho customer case.',
    },
    [NOTIFICATION_TYPES.CUSTOMER_CASE_RESOLUTION_RESPONDED]: {
        title: 'Khách hàng đã phản hồi phương án',
        message: 'Khách hàng đã phản hồi phương án xử lý customer case.',
    },
    [NOTIFICATION_TYPES.CUSTOMER_CASE_RESOLUTION_APPLIED]: {
        title: 'Phương án xử lý đã được áp dụng',
        message: 'Garage đã hoàn tất áp dụng phương án của customer case.',
    },
    [NOTIFICATION_TYPES.CUSTOMER_CASE_SLA_ESCALATED]: {
        title: 'Customer case cần ưu tiên xử lý',
        message: 'Customer case đã được nâng mức cảnh báo do tiến gần hoặc vượt SLA.',
    },
    [NOTIFICATION_TYPES.CUSTOMER_CASE_REOPENED]: {
        title: 'Customer case đã được mở lại',
        message: 'Customer case được mở lại để tiếp tục xử lý.',
    },
    [NOTIFICATION_TYPES.CUSTOMER_CASE_REFUND_UPDATED]: {
        title: 'Trạng thái hoàn tiền đã cập nhật',
        message: 'Quy trình hoàn tiền của customer case vừa có thay đổi.',
    },
    [NOTIFICATION_TYPES.CUSTOMER_CASE_RESOLVED]: {
        title: 'Customer case đã được giải quyết',
        message: 'Garage đã hoàn tất kết luận và phương án xử lý customer case.',
    },
    [NOTIFICATION_TYPES.CUSTOMER_CASE_CLOSED]: {
        title: 'Customer case đã đóng',
        message: 'Customer case đã kết thúc sau khi hoàn tất các bước xử lý.',
    },
};

const getNotificationReadState = ({
    createdAt,
    referenceDate,
    naturalKey,
    forceUnread,
}) => {
    if (forceUnread) {
        return {
            in_app_status: IN_APP_STATUSES.UNREAD,
            read_at: null,
        };
    }

    const ageMinutes = (
        new Date(referenceDate).getTime() - new Date(createdAt).getTime()
    ) / 60000;
    const hashNibble = Number.parseInt(
        stableHexId('AUTOWASH_NOTIFICATION_READ_V1', naturalKey).slice(-1),
        16
    );
    const isRead = ageMinutes >= 2880
        || (ageMinutes >= 720 && hashNibble % 3 !== 0);

    return isRead
        ? {
            in_app_status: IN_APP_STATUSES.READ,
            read_at: minDate(
                addMinutes(createdAt, 180 + hashNibble * 10),
                addMinutes(referenceDate, -1)
            ),
        }
        : {
            in_app_status: IN_APP_STATUSES.UNREAD,
            read_at: null,
        };
};

const buildNotificationDefinitions = ({
    referenceDate,
    garages,
    bookings,
    handovers,
    pointTransactions,
    incidents,
    vouchers,
    customerCases,
    caseMessages,
    assessments,
    resolutions,
    refunds,
    users,
    staffProfiles,
}) => {
    const definitions = [];
    const naturalKeys = new Set();
    const userMaps = getUserMaps({ users, staffProfiles, garages });
    const admins = users.filter((user) => user.role === USER_ROLES.ADMIN);
    const bookingById = new Map(bookings.map((booking) => [
        toId(booking._id),
        booking,
    ]));
    const handoverByBookingId = new Map(handovers.map((handover) => [
        toId(handover.booking_id),
        handover,
    ]));
    const earnTransactionByBookingId = new Map(
        pointTransactions
            .filter((transaction) => (
                transaction.type === POINT_TRANSACTION_TYPES.EARN
            ))
            .map((transaction) => [
                toId(transaction.booking_id),
                transaction,
            ])
    );
    const caseById = new Map(customerCases.map((customerCase) => [
        toId(customerCase._id),
        customerCase,
    ]));
    const add = ({
        userId,
        type,
        relatedType,
        relatedId,
        createdAt,
        eventKey,
        actorId = null,
        forceUnread = false,
        metadata = {},
    }) => {
        if (!userId || sameId(userId, actorId)) {
            return;
        }

        const recipient = userMaps.userById.get(toId(userId));

        if (!recipient) {
            throw new Error(
                `Notification recipient is missing: ${toId(userId)}`
            );
        }

        const boundedCreatedAt = minDate(
            createdAt || referenceDate,
            addMinutes(referenceDate, -1)
        );
        const naturalKey = [
            toId(userId),
            type,
            relatedType,
            toId(relatedId),
            eventKey,
        ].join(':');

        if (naturalKeys.has(naturalKey)) {
            return;
        }

        const copy = notificationCopy[type];

        if (!copy) {
            throw new Error(`Missing notification copy for ${type}`);
        }

        naturalKeys.add(naturalKey);
        const readState = getNotificationReadState({
            createdAt: boundedCreatedAt,
            referenceDate,
            naturalKey,
            forceUnread,
        });
        const updatedAt = readState.read_at || boundedCreatedAt;

        definitions.push({
            _id: deterministicId(
                'AUTOWASH_NOTIFICATION_V1',
                naturalKey
            ),
            user_id: userId,
            recipient_email: null,
            type,
            title: copy.title,
            message: copy.message,
            channels: [NOTIFICATION_CHANNELS.IN_APP],
            related_type: relatedType,
            related_id: relatedId,
            in_app_status: readState.in_app_status,
            read_at: readState.read_at,
            email_status: EMAIL_STATUSES.NOT_REQUIRED,
            email_sent_at: null,
            email_failed_reason: null,
            metadata: {
                seed_key: NOTIFICATION_SEED_KEY,
                event_key: eventKey,
                recipient_role: recipient.role,
                ...metadata,
            },
            created_at: boundedCreatedAt,
            updated_at: updatedAt,
        });
    };

    for (const garage of garages) {
        const candidates = bookings
            .filter((booking) => {
                const handover = handoverByBookingId.get(toId(booking._id));
                const earnTransaction = earnTransactionByBookingId.get(
                    toId(booking._id)
                );

                return (
                    sameId(booking.garage_id, garage._id)
                    && booking.status === BOOKING_STATUS.COMPLETED
                    && booking.payment_status === BOOKING_PAYMENT_STATUS.PAID
                    && !booking.is_walk_in
                    && booking.customer_id
                    && booking.paid_at
                    && booking.completed_at
                    && new Date(booking.completed_at)
                        >= addDays(referenceDate, -7)
                    && handover?.state === BOOKING_HANDOVER_STATES.RELEASED
                    && handover.ready_at
                    && handover.released_at
                    && earnTransaction
                );
            })
            .sort((left, right) => (
                sortByTimeAndId(left, right, 'completed_at')
            ));
        const perGarageTarget = Math.floor(
            NOTIFICATION_RECENT_BOOKING_TARGET / garages.length
        );
        const selected = takeEvenly(candidates, perGarageTarget);

        for (const booking of selected) {
            const handover = handoverByBookingId.get(toId(booking._id));
            const earnTransaction = earnTransactionByBookingId.get(
                toId(booking._id)
            );

            add({
                userId: booking.customer_id,
                type: NOTIFICATION_TYPES.PAYMENT_CONFIRMED,
                relatedType: NOTIFICATION_RELATED_TYPES.BOOKING,
                relatedId: booking._id,
                createdAt: booking.paid_at,
                eventKey: 'PAYMENT_CONFIRMED',
                metadata: { garage_code: garage.garage_code },
            });
            add({
                userId: booking.customer_id,
                type: NOTIFICATION_TYPES.REWARD_EARNED,
                relatedType: NOTIFICATION_RELATED_TYPES.LOYALTY,
                relatedId: earnTransaction._id,
                createdAt: addMinutes(booking.paid_at, 1),
                eventKey: 'REWARD_EARNED',
                metadata: {
                    booking_id: booking._id,
                    points: earnTransaction.points,
                },
            });
            add({
                userId: booking.customer_id,
                type: NOTIFICATION_TYPES.BOOKING_HANDOVER_READY,
                relatedType: NOTIFICATION_RELATED_TYPES.BOOKING_HANDOVER,
                relatedId: handover._id,
                createdAt: handover.ready_at,
                eventKey: 'HANDOVER_READY',
            });
            add({
                userId: booking.customer_id,
                type: NOTIFICATION_TYPES.BOOKING_HANDOVER_RELEASED,
                relatedType: NOTIFICATION_RELATED_TYPES.BOOKING_HANDOVER,
                relatedId: handover._id,
                createdAt: handover.released_at,
                eventKey: 'HANDOVER_RELEASED',
            });
        }
    }

    for (const booking of bookings.filter((candidate) => (
        candidate.status === BOOKING_STATUS.CANCELED
        && !candidate.is_walk_in
        && candidate.customer_id
        && candidate.canceled_at
    ))) {
        add({
            userId: booking.customer_id,
            type: NOTIFICATION_TYPES.BOOKING_CANCELED,
            relatedType: NOTIFICATION_RELATED_TYPES.BOOKING,
            relatedId: booking._id,
            createdAt: booking.canceled_at,
            eventKey: 'BOOKING_CANCELED',
        });
    }

    for (const incident of incidents) {
        const staffUsers = userMaps.staffUsersByGarage.get(
            toId(incident.garage_id)
        ) || [];

        for (const staffUser of staffUsers) {
            add({
                userId: staffUser._id,
                type: NOTIFICATION_TYPES.BOOKING_INCIDENT_REPORTED,
                relatedType: NOTIFICATION_RELATED_TYPES.BOOKING,
                relatedId: incident.booking_id,
                createdAt: incident.created_at,
                eventKey: `INCIDENT_REPORTED:${toId(incident._id)}`,
                actorId: incident.reported_by_id,
            });
        }

        add({
            userId: incident.customer_id,
            type: NOTIFICATION_TYPES.BOOKING_CUSTOMER_DECISION_REQUIRED,
            relatedType: NOTIFICATION_RELATED_TYPES.BOOKING,
            relatedId: incident.booking_id,
            createdAt: incident.created_at,
            eventKey: `INCIDENT_DECISION:${toId(incident._id)}`,
            forceUnread: !incident.resolved_at,
        });

        if (incident.resolved_at) {
            for (const recipient of [
                ...staffUsers,
                userMaps.userById.get(toId(incident.customer_id)),
            ].filter(Boolean)) {
                add({
                    userId: recipient._id,
                    type: NOTIFICATION_TYPES.BOOKING_INCIDENT_RESOLVED,
                    relatedType: NOTIFICATION_RELATED_TYPES.BOOKING,
                    relatedId: incident.booking_id,
                    createdAt: incident.resolved_at,
                    eventKey:
                        `INCIDENT_RESOLVED:${toId(incident._id)}`,
                    actorId: incident.resolved_by_id,
                });
            }
        }
    }

    for (const voucher of vouchers) {
        add({
            userId: voucher.customer_id,
            type: NOTIFICATION_TYPES.COMPENSATION_VOUCHER_ISSUED,
            relatedType: NOTIFICATION_RELATED_TYPES.BOOKING,
            relatedId: voucher.source_booking_id,
            createdAt: voucher.approved_at || voucher.created_at,
            eventKey: `VOUCHER_ISSUED:${toId(voucher._id)}`,
            actorId: voucher.issued_by_id,
            metadata: {
                voucher_id: voucher._id,
                voucher_code: voucher.code,
            },
        });
    }

    for (const customerCase of customerCases) {
        const customerServiceUsers =
            userMaps.customerServiceUsersByGarage.get(
                toId(customerCase.garage_id)
            ) || [];
        const operationalRecipients = [
            ...customerServiceUsers,
            ...admins,
        ];

        for (const recipient of [
            userMaps.userById.get(toId(customerCase.customer_id)),
            ...operationalRecipients,
        ].filter(Boolean)) {
            add({
                userId: recipient._id,
                type: NOTIFICATION_TYPES.CUSTOMER_CASE_SUBMITTED,
                relatedType: NOTIFICATION_RELATED_TYPES.CUSTOMER_CASE,
                relatedId: customerCase._id,
                createdAt: customerCase.created_at,
                eventKey: 'CASE_SUBMITTED',
                actorId: customerCase.created_by_staff_id
                    || customerCase.customer_id,
                forceUnread: [
                    CUSTOMER_CASE_STATUSES.SUBMITTED,
                    CUSTOMER_CASE_STATUSES.ACKNOWLEDGED,
                    CUSTOMER_CASE_STATUSES.INVESTIGATING,
                ].includes(customerCase.status),
            });
        }

        add({
            userId: customerCase.assigned_to_id,
            type: NOTIFICATION_TYPES.CUSTOMER_CASE_ASSIGNED,
            relatedType: NOTIFICATION_RELATED_TYPES.CUSTOMER_CASE,
            relatedId: customerCase._id,
            createdAt: customerCase.assigned_at,
            eventKey: 'CASE_ASSIGNED',
            actorId: customerCase.assigned_by_id,
            forceUnread: [
                CUSTOMER_CASE_STATUSES.SUBMITTED,
                CUSTOMER_CASE_STATUSES.ACKNOWLEDGED,
                CUSTOMER_CASE_STATUSES.INVESTIGATING,
            ].includes(customerCase.status),
        });
        add({
            userId: customerCase.customer_id,
            type: NOTIFICATION_TYPES.CUSTOMER_CASE_ACKNOWLEDGED,
            relatedType: NOTIFICATION_RELATED_TYPES.CUSTOMER_CASE,
            relatedId: customerCase._id,
            createdAt: customerCase.acknowledged_at,
            eventKey: 'CASE_ACKNOWLEDGED',
            actorId: customerCase.acknowledged_by_id,
        });

        if (customerCase.escalated_at) {
            for (const recipient of [
                userMaps.userById.get(toId(customerCase.assigned_to_id)),
                ...admins,
            ].filter(Boolean)) {
                add({
                    userId: recipient._id,
                    type: NOTIFICATION_TYPES.CUSTOMER_CASE_SLA_ESCALATED,
                    relatedType: NOTIFICATION_RELATED_TYPES.CUSTOMER_CASE,
                    relatedId: customerCase._id,
                    createdAt: customerCase.escalated_at,
                    eventKey: 'CASE_SLA_ESCALATED',
                    forceUnread: ![
                        CUSTOMER_CASE_STATUSES.RESOLVED,
                        CUSTOMER_CASE_STATUSES.CLOSED,
                    ].includes(customerCase.status),
                });
            }
        }

        if (customerCase.last_reopened_at) {
            for (const recipient of [
                userMaps.userById.get(toId(customerCase.customer_id)),
                userMaps.userById.get(toId(customerCase.assigned_to_id)),
                ...admins,
            ].filter(Boolean)) {
                add({
                    userId: recipient._id,
                    type: NOTIFICATION_TYPES.CUSTOMER_CASE_REOPENED,
                    relatedType: NOTIFICATION_RELATED_TYPES.CUSTOMER_CASE,
                    relatedId: customerCase._id,
                    createdAt: customerCase.last_reopened_at,
                    eventKey: 'CASE_REOPENED',
                    actorId: customerCase.last_reopened_by_id,
                    forceUnread: true,
                });
            }
        }

        if (customerCase.resolved_at) {
            add({
                userId: customerCase.customer_id,
                type: NOTIFICATION_TYPES.CUSTOMER_CASE_RESOLVED,
                relatedType: NOTIFICATION_RELATED_TYPES.CUSTOMER_CASE,
                relatedId: customerCase._id,
                createdAt: customerCase.resolved_at,
                eventKey: 'CASE_RESOLVED',
                actorId: customerCase.resolved_by_id,
            });
        }

        if (customerCase.closed_at) {
            add({
                userId: customerCase.customer_id,
                type: NOTIFICATION_TYPES.CUSTOMER_CASE_CLOSED,
                relatedType: NOTIFICATION_RELATED_TYPES.CUSTOMER_CASE,
                relatedId: customerCase._id,
                createdAt: customerCase.closed_at,
                eventKey: 'CASE_CLOSED',
                actorId: customerCase.closed_by_id,
            });
        }
    }

    for (const message of caseMessages) {
        const customerCase = caseById.get(toId(message.case_id));

        if (!customerCase) {
            throw new Error(
                `Customer case message is orphaned: ${toId(message._id)}`
            );
        }

        const recipientIds = message.sender_role === USER_ROLES.CUSTOMER
            ? [customerCase.assigned_to_id]
            : [customerCase.customer_id];

        for (const recipientId of recipientIds) {
            add({
                userId: recipientId,
                type: NOTIFICATION_TYPES.CUSTOMER_CASE_MESSAGE_RECEIVED,
                relatedType: NOTIFICATION_RELATED_TYPES.CUSTOMER_CASE,
                relatedId: customerCase._id,
                createdAt: message.created_at,
                eventKey: `CASE_MESSAGE:${toId(message._id)}`,
                actorId: message.sender_id,
                forceUnread: [
                    CUSTOMER_CASE_STATUSES.SUBMITTED,
                    CUSTOMER_CASE_STATUSES.ACKNOWLEDGED,
                    CUSTOMER_CASE_STATUSES.INVESTIGATING,
                ].includes(customerCase.status),
            });
        }
    }

    for (const assessment of assessments) {
        const customerCase = caseById.get(toId(assessment.case_id));

        add({
            userId: assessment.inspector_user_id,
            type: NOTIFICATION_TYPES.CUSTOMER_CASE_TECHNICAL_ASSESSMENT_ASSIGNED,
            relatedType: NOTIFICATION_RELATED_TYPES.CUSTOMER_CASE,
            relatedId: assessment.case_id,
            createdAt: assessment.assigned_at || assessment.created_at,
            eventKey: `ASSESSMENT_ASSIGNED:${toId(assessment._id)}`,
            actorId: assessment.assigned_by_id,
            forceUnread:
                assessment.status
                    !== CUSTOMER_CASE_TECHNICAL_ASSESSMENT_STATUSES.SUBMITTED,
        });

        if (
            assessment.status
                === CUSTOMER_CASE_TECHNICAL_ASSESSMENT_STATUSES.SUBMITTED
        ) {
            for (const recipientId of [
                customerCase?.customer_id,
                customerCase?.assigned_to_id,
            ]) {
                add({
                    userId: recipientId,
                    type: NOTIFICATION_TYPES.CUSTOMER_CASE_TECHNICAL_ASSESSMENT_SUBMITTED,
                    relatedType: NOTIFICATION_RELATED_TYPES.CUSTOMER_CASE,
                    relatedId: assessment.case_id,
                    createdAt:
                        assessment.submitted_at || assessment.updated_at,
                    eventKey:
                        `ASSESSMENT_SUBMITTED:${toId(assessment._id)}`,
                    actorId: assessment.inspector_user_id,
                });
            }
        }
    }

    for (const resolution of resolutions) {
        const customerCase = caseById.get(toId(resolution.case_id));

        add({
            userId: customerCase?.customer_id,
            type: NOTIFICATION_TYPES.CUSTOMER_CASE_RESOLUTION_PROPOSED,
            relatedType: NOTIFICATION_RELATED_TYPES.CUSTOMER_CASE,
            relatedId: resolution.case_id,
            createdAt: resolution.proposed_at || resolution.created_at,
            eventKey: `RESOLUTION_PROPOSED:${toId(resolution._id)}`,
            actorId: resolution.proposed_by_id,
            forceUnread:
                resolution.status === CUSTOMER_CASE_RESOLUTION_STATUSES.PROPOSED,
        });

        if ([
            CUSTOMER_CASE_RESOLUTION_STATUSES.CUSTOMER_ACCEPTED,
            CUSTOMER_CASE_RESOLUTION_STATUSES.CUSTOMER_REJECTED,
            CUSTOMER_CASE_RESOLUTION_STATUSES.APPLIED,
        ].includes(resolution.status)) {
            for (const recipient of [
                userMaps.userById.get(toId(customerCase?.assigned_to_id)),
                ...admins,
            ].filter(Boolean)) {
                add({
                    userId: recipient._id,
                    type: NOTIFICATION_TYPES.CUSTOMER_CASE_RESOLUTION_RESPONDED,
                    relatedType: NOTIFICATION_RELATED_TYPES.CUSTOMER_CASE,
                    relatedId: resolution.case_id,
                    createdAt: resolution.customer_responded_at,
                    eventKey:
                        `RESOLUTION_RESPONDED:${toId(resolution._id)}`,
                });
            }
        }

        if (
            resolution.status === CUSTOMER_CASE_RESOLUTION_STATUSES.APPLIED
        ) {
            add({
                userId: customerCase?.customer_id,
                type: NOTIFICATION_TYPES.CUSTOMER_CASE_RESOLUTION_APPLIED,
                relatedType: NOTIFICATION_RELATED_TYPES.CUSTOMER_CASE,
                relatedId: resolution.case_id,
                createdAt: resolution.applied_at,
                eventKey: `RESOLUTION_APPLIED:${toId(resolution._id)}`,
                actorId: resolution.applied_by_id,
            });
        }
    }

    for (const refund of refunds) {
        const customerCase = caseById.get(toId(refund.case_id));

        for (const recipientId of [
            customerCase?.customer_id,
            customerCase?.assigned_to_id,
        ]) {
            add({
                userId: recipientId,
                type: NOTIFICATION_TYPES.CUSTOMER_CASE_REFUND_UPDATED,
                relatedType: NOTIFICATION_RELATED_TYPES.CUSTOMER_CASE,
                relatedId: refund.case_id,
                createdAt:
                    refund.processed_at || refund.approved_at
                    || refund.updated_at,
                eventKey: `REFUND_UPDATED:${toId(refund._id)}`,
                actorId: refund.processed_by_id || refund.approved_by_id,
            });
        }
    }

    return definitions;
};

const getAnswerValue = (response, questionType) => {
    const answer = response.answers.find(
        (candidate) => (
            candidate.question_type_snapshot === questionType
        )
    );

    return answer?.numeric_value ?? null;
};

const getNpsSegment = (value) => {
    if (value <= 6) {
        return 'DETRACTOR';
    }

    if (value <= 8) {
        return 'PASSIVE';
    }

    return 'PROMOTER';
};

const summarizePlan = ({
    surveyDefinitions,
    responseDefinitions,
    plateScanDefinitions,
    notificationDefinitions,
    garages,
    users,
}) => {
    const surveyKeyById = new Map(surveyDefinitions.map(
        (survey, index) => [
            toId(survey._id),
            SURVEY_CATALOG[index].key,
        ]
    ));
    const bookingGarageById = new Map(
        responseDefinitions.map((response) => [
            toId(response.booking_id),
            toId(response.booking_garage_id),
        ])
    );
    const garageCodeById = new Map(garages.map((garage) => [
        toId(garage._id),
        garage.garage_code,
    ]));
    const roleByUserId = new Map(users.map((user) => [
        toId(user._id),
        user.role,
    ]));
    const ratingCounts = countBy(
        responseDefinitions,
        (response) => String(getAnswerValue(
            response,
            SURVEY_QUESTION_TYPES.RATING
        ))
    );
    const npsSegmentCounts = countBy(
        responseDefinitions,
        (response) => getNpsSegment(getAnswerValue(
            response,
            SURVEY_QUESTION_TYPES.NPS
        ))
    );
    const npsScore = (
        ((npsSegmentCounts.PROMOTER || 0)
            - (npsSegmentCounts.DETRACTOR || 0))
        / Math.max(1, responseDefinitions.length)
        * 100
    );

    return {
        surveys: {
            total: surveyDefinitions.length,
            by_status: countBy(
                surveyDefinitions,
                (survey) => survey.status
            ),
        },
        responses: {
            total: responseDefinitions.length,
            by_survey: countBy(
                responseDefinitions,
                (response) => surveyKeyById.get(toId(response.survey_id))
            ),
            by_garage: countBy(
                responseDefinitions,
                (response) => (
                    garageCodeById.get(
                        bookingGarageById.get(toId(response.booking_id))
                    ) || 'UNKNOWN'
                )
            ),
            rating_distribution: ratingCounts,
            nps_segments: npsSegmentCounts,
            nps_score: Number(npsScore.toFixed(2)),
            text_answers: responseDefinitions.reduce(
                (total, response) => total + response.answers.filter(
                    (answer) => (
                        answer.question_type_snapshot
                            === SURVEY_QUESTION_TYPES.TEXT
                        && Boolean(answer.text_value)
                    )
                ).length,
                0
            ),
        },
        plate_scans: {
            total: plateScanDefinitions.length,
            by_status: countBy(
                plateScanDefinitions,
                (scan) => scan.status
            ),
            by_mode: countBy(
                plateScanDefinitions,
                (scan) => scan.mode
            ),
            by_capture_source: countBy(
                plateScanDefinitions,
                (scan) => scan.capture_source
            ),
            by_garage: countBy(
                plateScanDefinitions,
                (scan) => garageCodeById.get(toId(scan.garage_id))
            ),
            retry_chains: plateScanDefinitions.filter(
                (scan) => scan.retry_of_scan_id
            ).length,
            retained_images: plateScanDefinitions.filter(
                (scan) => !scan.image_deleted_at
            ).length,
        },
        notifications: {
            total: notificationDefinitions.length,
            by_type: countBy(
                notificationDefinitions,
                (notification) => notification.type
            ),
            by_status: countBy(
                notificationDefinitions,
                (notification) => notification.in_app_status
            ),
            by_recipient_role: countBy(
                notificationDefinitions,
                (notification) => (
                    roleByUserId.get(toId(notification.user_id))
                    || 'UNKNOWN'
                )
            ),
            email_channels: notificationDefinitions.filter(
                (notification) => (
                    notification.channels.includes(
                        NOTIFICATION_CHANNELS.EMAIL
                    )
                )
            ).length,
        },
    };
};

const assertPlanTargets = ({
    summary,
}) => {
    if (
        summary.surveys.total !== SURVEY_TARGETS.total
        || !countsMatch(
            summary.surveys.by_status,
            SURVEY_TARGETS.by_status
        )
    ) {
        throw new Error('Survey seed targets mismatch');
    }

    const expectedGarageResponses = Object.fromEntries(
        Object.keys(summary.responses.by_garage).map((garageCode) => [
            garageCode,
            SURVEY_RESPONSE_TARGETS.per_garage,
        ])
    );

    if (
        summary.responses.total !== SURVEY_RESPONSE_TARGETS.total
        || !countsMatch(
            summary.responses.by_survey,
            SURVEY_RESPONSE_TARGETS.by_survey
        )
        || !countsMatch(
            summary.responses.by_garage,
            expectedGarageResponses
        )
        || !countsMatch(
            summary.responses.rating_distribution,
            SURVEY_RESPONSE_TARGETS.rating_distribution
        )
        || !countsMatch(
            summary.responses.nps_segments,
            SURVEY_RESPONSE_TARGETS.nps_segments
        )
        || summary.responses.text_answers
            !== SURVEY_RESPONSE_TARGETS.text_answers
    ) {
        throw new Error('Survey response seed targets mismatch');
    }

    const expectedGarageScans = Object.fromEntries(
        Object.keys(summary.plate_scans.by_garage).map((garageCode) => [
            garageCode,
            PLATE_SCAN_TARGETS.per_garage,
        ])
    );

    if (
        summary.plate_scans.total !== PLATE_SCAN_TARGETS.total
        || !countsMatch(
            summary.plate_scans.by_status,
            PLATE_SCAN_TARGETS.by_status
        )
        || !countsMatch(
            summary.plate_scans.by_mode,
            PLATE_SCAN_TARGETS.by_mode
        )
        || !countsMatch(
            summary.plate_scans.by_capture_source,
            PLATE_SCAN_TARGETS.by_capture_source
        )
        || !countsMatch(
            summary.plate_scans.by_garage,
            expectedGarageScans
        )
        || summary.plate_scans.retry_chains
            !== PLATE_SCAN_TARGETS.retry_chains
        || summary.plate_scans.retained_images
            !== PLATE_SCAN_TARGETS.retained_images
    ) {
        throw new Error('Plate scan seed targets mismatch');
    }

    if (
        summary.notifications.total === 0
        || summary.notifications.email_channels !== 0
        || summary.notifications.by_recipient_role.UNKNOWN
    ) {
        throw new Error('Notification seed targets mismatch');
    }
};

const validateDefinitions = async ({
    surveyDefinitions,
    responseDefinitions,
    plateScanDefinitions,
    notificationDefinitions,
}) => {
    for (const definition of surveyDefinitions) {
        await new Survey(definition).validate();
    }

    for (const definition of responseDefinitions) {
        await new SurveyResponse(definition).validate();
    }

    for (const definition of plateScanDefinitions) {
        await new BookingPlateScan(definition).validate();
    }

    for (const definition of notificationDefinitions) {
        await new Notification(definition).validate();
    }
};

const loadSeedDependencies = async ({
    session,
}) => {
    const [
        garages,
        admins,
        users,
        staffProfiles,
        cameras,
        bookings,
        washHistories,
        handovers,
        pointTransactions,
        incidents,
        vouchers,
        customerCases,
        caseMessages,
        assessments,
        resolutions,
        refunds,
    ] = await Promise.all([
        applySession(
            Garage.find({
                garage_code: {
                    $in: GARAGE_SEEDS.map((garage) => garage.garage_code),
                },
            }).sort({ garage_code: 1 }),
            session
        ).lean(),
        applySession(
            User.find({ role: USER_ROLES.ADMIN }).sort({ phone: 1 }),
            session
        ).lean(),
        applySession(User.find({}), session).lean(),
        applySession(
            StaffProfile.find({ is_active: true }).sort({ staff_code: 1 }),
            session
        ).lean(),
        applySession(
            CameraDevice.find({ status: 'ACTIVE' }).sort({ device_code: 1 }),
            session
        ).lean(),
        applySession(Booking.find({}), session).lean(),
        applySession(WashHistory.find({}), session).lean(),
        applySession(BookingHandover.find({}), session).lean(),
        applySession(PointTransaction.find({}), session).lean(),
        applySession(BookingIncident.find({}), session).lean(),
        applySession(CustomerVoucher.find({}), session).lean(),
        applySession(CustomerCase.find({}), session).lean(),
        applySession(CustomerCaseMessage.find({}), session).lean(),
        applySession(
            CustomerCaseTechnicalAssessment.find({}),
            session
        ).lean(),
        applySession(CustomerCaseResolution.find({}), session).lean(),
        applySession(CustomerCaseRefund.find({}), session).lean(),
    ]);

    if (
        garages.length !== 5
        || admins.length !== 2
        || staffProfiles.length !== 50
        || cameras.length !== 5
        || bookings.length === 0
        || washHistories.length === 0
        || handovers.length === 0
        || pointTransactions.length === 0
    ) {
        throw new Error(
            'Notifications, surveys and plate scan dependencies are incomplete'
        );
    }

    return {
        garages,
        admins,
        users,
        staffProfiles,
        cameras,
        bookings,
        washHistories,
        handovers,
        pointTransactions,
        incidents,
        vouchers,
        customerCases,
        caseMessages,
        assessments,
        resolutions,
        refunds,
    };
};

const buildSeedPlan = async ({
    referenceDate = getSeedReferenceDate(),
    session = null,
} = {}) => {
    const dependencies = await loadSeedDependencies({ session });
    const surveyDefinitions = buildSurveyDefinitions({
        admins: dependencies.admins,
        referenceDate,
    });
    const responseDefinitions = buildSurveyResponseDefinitions({
        bookings: dependencies.bookings,
        washHistories: dependencies.washHistories,
        garages: dependencies.garages,
        surveyDefinitions,
        referenceDate,
    });
    const bookingById = new Map(dependencies.bookings.map((booking) => [
        toId(booking._id),
        booking,
    ]));

    for (const response of responseDefinitions) {
        response.booking_garage_id = bookingById.get(
            toId(response.booking_id)
        ).garage_id;
    }

    const staffMaps = getStaffMaps(dependencies);
    const plateScanDefinitions = buildPlateScanDefinitions({
        bookings: dependencies.bookings,
        garages: dependencies.garages,
        cameras: dependencies.cameras,
        staffMaps,
        referenceDate,
    });
    const bookingPlateUpdates = buildBookingPlateUpdates(
        plateScanDefinitions
    );
    const cameraUpdates = buildCameraUpdates({
        cameras: dependencies.cameras,
        plateScans: plateScanDefinitions,
        referenceDate,
    });
    const notificationDefinitions = buildNotificationDefinitions({
        referenceDate,
        ...dependencies,
    });
    const summary = summarizePlan({
        surveyDefinitions,
        responseDefinitions,
        plateScanDefinitions,
        notificationDefinitions,
        garages: dependencies.garages,
        users: dependencies.users,
    });

    assertPlanTargets({ summary });
    await validateDefinitions({
        surveyDefinitions,
        responseDefinitions,
        plateScanDefinitions,
        notificationDefinitions,
    });

    return {
        ...dependencies,
        surveyDefinitions,
        responseDefinitions: responseDefinitions.map((response) => {
            const {
                booking_garage_id: bookingGarageId,
                ...definition
            } = response;

            return definition;
        }),
        plateScanDefinitions,
        bookingPlateUpdates,
        cameraUpdates,
        notificationDefinitions,
        summary,
    };
};

const clearPreviousPlateBookingLinks = async ({
    session,
}) => {
    const previousScans = await applySession(
        BookingPlateScan.find({
            client_event_id: {
                $regex: `^${PLATE_SCAN_CLIENT_EVENT_PREFIX}`,
            },
            confirmed_booking_id: { $ne: null },
        }).select('_id confirmed_booking_id'),
        session
    ).lean();
    const bookingIds = previousScans.map(
        (scan) => scan.confirmed_booking_id
    );

    if (bookingIds.length === 0) {
        return {
            planned: 0,
            matched: 0,
            modified: 0,
        };
    }

    const bookings = await applySession(
        Booking.find({ _id: { $in: bookingIds } })
            .select('_id normalized_license_plate'),
        session
    ).lean();
    const result = await Booking.bulkWrite(
        bookings.map((booking) => ({
            updateOne: {
                filter: { _id: booking._id },
                update: {
                    $set: {
                        arrival_detected_at: null,
                        arrival_detection_scan_id: null,
                        check_in_method: 'MANUAL',
                        check_in_verification_id: null,
                        check_in_detected_plate:
                            booking.normalized_license_plate,
                        check_in_match_type: PLATE_MATCH_TYPES.EXACT,
                        check_in_manual_override: false,
                        check_in_override_reason: null,
                    },
                },
            },
        })),
        {
            ordered: true,
            session,
            timestamps: false,
        }
    );

    return {
        planned: bookings.length,
        matched: result.matchedCount,
        modified: result.modifiedCount,
    };
};

const writeBookingPlateUpdates = async ({
    updates,
    session,
}) => {
    const result = await Booking.bulkWrite(
        updates.map((update) => {
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
        planned: updates.length,
        matched: result.matchedCount,
        modified: result.modifiedCount,
    };
};

const writeCameraUpdates = async ({
    updates,
    session,
}) => {
    const result = await CameraDevice.bulkWrite(
        updates.map((update) => {
            const {
                camera_id: cameraId,
                ...values
            } = update;

            return {
                updateOne: {
                    filter: { _id: cameraId },
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

const pruneSeedData = async ({
    plan,
    session,
}) => {
    const surveyIds = plan.surveyDefinitions.map(
        (definition) => definition._id
    );
    const responseIds = plan.responseDefinitions.map(
        (definition) => definition._id
    );
    const scanIds = plan.plateScanDefinitions.map(
        (definition) => definition._id
    );
    const notificationIds = plan.notificationDefinitions.map(
        (definition) => definition._id
    );
    const [responses, surveys, scans, notifications] = await Promise.all([
        SurveyResponse.deleteMany({
            survey_id: { $in: surveyIds },
            _id: { $nin: responseIds },
        }).session(session || null),
        Survey.deleteMany({
            _id: { $nin: surveyIds },
            title: { $in: SURVEY_CATALOG.map((item) => item.title) },
        }).session(session || null),
        BookingPlateScan.deleteMany({
            client_event_id: {
                $regex: `^${PLATE_SCAN_CLIENT_EVENT_PREFIX}`,
            },
            _id: { $nin: scanIds },
        }).session(session || null),
        Notification.deleteMany({
            'metadata.seed_key': NOTIFICATION_SEED_KEY,
            _id: { $nin: notificationIds },
        }).session(session || null),
    ]);

    return {
        survey_responses: responses.deletedCount,
        surveys: surveys.deletedCount,
        booking_plate_scans: scans.deletedCount,
        notifications: notifications.deletedCount,
    };
};

const seedNotificationsSurveysPlateScansData = async ({
    session = null,
    referenceDate = getSeedReferenceDate(),
    dryRun = false,
} = {}) => {
    console.log(
        '== Seeding notifications, surveys, responses and plate scans =='
    );
    const plan = await buildSeedPlan({
        referenceDate,
        session,
    });

    if (dryRun) {
        return {
            dry_run: true,
            reference_date: referenceDate,
            ...plan.summary,
        };
    }

    const previousBookingLinks = await clearPreviousPlateBookingLinks({
        session,
    });
    const stale = await pruneSeedData({ plan, session });
    const surveyWrite = await replaceDefinitions({
        model: Survey,
        definitions: plan.surveyDefinitions,
        session,
    });
    const responseWrite = await replaceDefinitions({
        model: SurveyResponse,
        definitions: plan.responseDefinitions,
        session,
    });
    const scanWrite = await replaceDefinitions({
        model: BookingPlateScan,
        definitions: plan.plateScanDefinitions,
        session,
    });
    const bookingWrite = await writeBookingPlateUpdates({
        updates: plan.bookingPlateUpdates,
        session,
    });
    const cameraWrite = await writeCameraUpdates({
        updates: plan.cameraUpdates,
        session,
    });
    const notificationWrite = await replaceDefinitions({
        model: Notification,
        definitions: plan.notificationDefinitions,
        session,
    });

    return {
        dry_run: false,
        reference_date: referenceDate,
        ...plan.summary,
        writes: {
            stale,
            previous_booking_links: previousBookingLinks,
            surveys: surveyWrite,
            responses: responseWrite,
            plate_scans: scanWrite,
            bookings: bookingWrite,
            cameras: cameraWrite,
            notifications: notificationWrite,
        },
    };
};

const verifyNotificationsSurveysPlateScans = async ({
    referenceDate = getSeedReferenceDate(),
    session = null,
} = {}) => {
    const plan = await buildSeedPlan({
        referenceDate,
        session,
    });
    const surveyIds = plan.surveyDefinitions.map(
        (definition) => definition._id
    );
    const responseIds = plan.responseDefinitions.map(
        (definition) => definition._id
    );
    const scanIds = plan.plateScanDefinitions.map(
        (definition) => definition._id
    );
    const notificationIds = plan.notificationDefinitions.map(
        (definition) => definition._id
    );
    const [
        surveys,
        responses,
        scans,
        notifications,
        bookings,
        cameras,
        retainedUploads,
    ] = await Promise.all([
        applySession(
            Survey.find({ _id: { $in: surveyIds } }),
            session
        ).lean(),
        applySession(
            SurveyResponse.find({ _id: { $in: responseIds } }),
            session
        ).lean(),
        applySession(
            BookingPlateScan.find({ _id: { $in: scanIds } }),
            session
        ).lean(),
        applySession(
            Notification.find({ _id: { $in: notificationIds } }),
            session
        ).lean(),
        applySession(
            Booking.find({
                _id: {
                    $in: plan.bookingPlateUpdates.map(
                        (update) => update.booking_id
                    ),
                },
            }),
            session
        ).lean(),
        applySession(
            CameraDevice.find({
                _id: {
                    $in: plan.cameraUpdates.map(
                        (update) => update.camera_id
                    ),
                },
            }),
            session
        ).lean(),
        applySession(
            Upload.find({
                _id: {
                    $in: plan.plateScanDefinitions.flatMap(
                        (scan) => scan.upload_ids
                    ),
                },
            }),
            session
        ).lean(),
    ]);

    if (
        surveys.length !== plan.surveyDefinitions.length
        || responses.length !== plan.responseDefinitions.length
        || scans.length !== plan.plateScanDefinitions.length
        || notifications.length !== plan.notificationDefinitions.length
        || bookings.length !== plan.bookingPlateUpdates.length
        || cameras.length !== plan.cameraUpdates.length
        || retainedUploads.length !== 0
    ) {
        throw new Error(
            'Persisted notification, survey or plate scan totals mismatch'
        );
    }

    const responsePlanById = new Map(plan.responseDefinitions.map(
        (response) => [toId(response._id), response]
    ));

    for (const response of responses) {
        const expected = responsePlanById.get(toId(response._id));

        if (
            !expected
            || !sameId(response.survey_id, expected.survey_id)
            || !sameId(response.booking_id, expected.booking_id)
            || !sameId(
                response.wash_history_id,
                expected.wash_history_id
            )
            || !sameId(response.customer_id, expected.customer_id)
        ) {
            throw new Error(
                `Survey response relation mismatch: ${toId(response._id)}`
            );
        }
    }

    const scanById = new Map(scans.map((scan) => [
        toId(scan._id),
        scan,
    ]));

    for (const booking of bookings) {
        const scan = scanById.get(toId(booking.check_in_verification_id));

        if (
            !scan
            || booking.check_in_method !== 'PLATE_SCAN'
            || !sameId(scan.confirmed_booking_id, booking._id)
            || booking.check_in_detected_plate
                !== scan.normalized_plate
            || booking.check_in_match_type !== PLATE_MATCH_TYPES.EXACT
        ) {
            throw new Error(
                `Plate scan booking audit mismatch: ${toId(booking._id)}`
            );
        }
    }

    if (notifications.some((notification) => (
        notification.channels.includes(NOTIFICATION_CHANNELS.EMAIL)
        || notification.email_status !== EMAIL_STATUSES.NOT_REQUIRED
        || notification.recipient_email
    ))) {
        throw new Error('Seed notifications must remain in-app only');
    }

    return {
        verified: true,
        reference_date: referenceDate,
        ...plan.summary,
        orphan_responses: 0,
        orphan_confirmed_scans: 0,
        retained_plate_uploads: retainedUploads.length,
    };
};

const seedNotificationsSurveysPlateScans = async ({
    dryRun = process.argv.includes('--dry-run'),
} = {}) => {
    const referenceDate = getSeedReferenceDate();

    await connectDB();

    if (dryRun) {
        try {
            return await seedNotificationsSurveysPlateScansData({
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
                await seedNotificationsSurveysPlateScansData({
                    session,
                    referenceDate,
                });
        });
        result.verification =
            await verifyNotificationsSurveysPlateScans({
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
        const result = await seedNotificationsSurveysPlateScans();

        console.log(
            'Notifications, surveys, responses and plate scans seed completed'
        );
        console.dir(result.verification || result, { depth: null });
    } catch (error) {
        console.error(
            'Notifications, surveys, responses and plate scans seed failed:',
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
    buildSurveyDefinitions,
    buildSurveyResponseDefinitions,
    buildPlateScanDefinitions,
    buildNotificationDefinitions,
    summarizePlan,
    assertPlanTargets,
    buildSeedPlan,
    seedNotificationsSurveysPlateScansData,
    verifyNotificationsSurveysPlateScans,
    seedNotificationsSurveysPlateScans,
};
