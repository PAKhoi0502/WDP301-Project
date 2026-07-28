const {
    SURVEY_STATUSES,
    SURVEY_QUESTION_TYPES,
} = require('../shared/constants/survey.constant');
const {
    PLATE_SCAN_STATUSES,
    PLATE_SCAN_MODES,
    PLATE_CAPTURE_SOURCES,
} = require('../shared/constants/bookingArrival.constant');

const SURVEY_KEYS = Object.freeze({
    POST_SERVICE: 'POST_SERVICE',
    HANDOVER_QUALITY: 'HANDOVER_QUALITY',
    BOOKING_EXPERIENCE_DRAFT: 'BOOKING_EXPERIENCE_DRAFT',
});

const SURVEY_TARGETS = Object.freeze({
    total: 3,
    by_status: Object.freeze({
        [SURVEY_STATUSES.DRAFT]: 1,
        [SURVEY_STATUSES.PUBLISHED]: 1,
        [SURVEY_STATUSES.CLOSED]: 1,
    }),
});

const SURVEY_CATALOG = Object.freeze([
    Object.freeze({
        key: SURVEY_KEYS.POST_SERVICE,
        title: 'Khảo sát trải nghiệm sau dịch vụ',
        description:
            'Ghi nhận mức độ hài lòng và khả năng giới thiệu dịch vụ sau khi khách hoàn tất thanh toán.',
        status: SURVEY_STATUSES.PUBLISHED,
        response_window_days: 7,
        created_day_offset: -10,
        published_day_offset: -8,
        closed_day_offset: null,
        questions: Object.freeze([
            Object.freeze({
                key: 'SATISFACTION',
                text: 'Bạn hài lòng ở mức nào với dịch vụ vừa sử dụng?',
                type: SURVEY_QUESTION_TYPES.RATING,
                is_required: true,
                options: Object.freeze([]),
                order: 1,
            }),
            Object.freeze({
                key: 'NPS',
                text: 'Bạn có sẵn sàng giới thiệu garage cho người thân hoặc bạn bè không?',
                type: SURVEY_QUESTION_TYPES.NPS,
                is_required: true,
                options: Object.freeze([]),
                order: 2,
            }),
            Object.freeze({
                key: 'BEST_ASPECT',
                text: 'Điểm nào làm bạn hài lòng nhất?',
                type: SURVEY_QUESTION_TYPES.SINGLE_CHOICE,
                is_required: true,
                options: Object.freeze([
                    'Chất lượng làm sạch',
                    'Thời gian phục vụ',
                    'Thái độ nhân viên',
                    'Giá và ưu đãi',
                    'Quy trình bàn giao',
                ]),
                order: 3,
            }),
            Object.freeze({
                key: 'IMPROVEMENT_AREAS',
                text: 'Garage nên cải thiện những nội dung nào?',
                type: SURVEY_QUESTION_TYPES.MULTI_CHOICE,
                is_required: false,
                options: Object.freeze([
                    'Thời gian chờ',
                    'Chất lượng làm sạch',
                    'Khu vực chờ',
                    'Thông tin tiến độ',
                    'Giá dịch vụ',
                ]),
                order: 4,
            }),
            Object.freeze({
                key: 'COMMENT',
                text: 'Bạn có góp ý cụ thể nào cho garage không?',
                type: SURVEY_QUESTION_TYPES.TEXT,
                is_required: false,
                options: Object.freeze([]),
                order: 5,
            }),
        ]),
    }),
    Object.freeze({
        key: SURVEY_KEYS.HANDOVER_QUALITY,
        title: 'Đánh giá chất lượng bàn giao',
        description:
            'Khảo sát lịch sử về tình trạng phương tiện, cách giải thích và trải nghiệm nhận xe.',
        status: SURVEY_STATUSES.CLOSED,
        response_window_days: 14,
        created_day_offset: -25,
        published_day_offset: -22,
        closed_day_offset: -7,
        questions: Object.freeze([
            Object.freeze({
                key: 'HANDOVER_RATING',
                text: 'Bạn hài lòng ở mức nào với quy trình bàn giao phương tiện?',
                type: SURVEY_QUESTION_TYPES.RATING,
                is_required: true,
                options: Object.freeze([]),
                order: 1,
            }),
            Object.freeze({
                key: 'HANDOVER_NPS',
                text: 'Sau trải nghiệm bàn giao, khả năng bạn giới thiệu garage là bao nhiêu?',
                type: SURVEY_QUESTION_TYPES.NPS,
                is_required: true,
                options: Object.freeze([]),
                order: 2,
            }),
            Object.freeze({
                key: 'HANDOVER_CLARITY',
                text: 'Thông tin nào được nhân viên giải thích rõ nhất?',
                type: SURVEY_QUESTION_TYPES.SINGLE_CHOICE,
                is_required: true,
                options: Object.freeze([
                    'Tình trạng phương tiện',
                    'Hạng mục đã thực hiện',
                    'Chi phí thanh toán',
                    'Điểm thưởng và ưu đãi',
                ]),
                order: 3,
            }),
            Object.freeze({
                key: 'HANDOVER_COMMENT',
                text: 'Bạn muốn garage cải thiện điều gì khi bàn giao?',
                type: SURVEY_QUESTION_TYPES.TEXT,
                is_required: false,
                options: Object.freeze([]),
                order: 4,
            }),
        ]),
    }),
    Object.freeze({
        key: SURVEY_KEYS.BOOKING_EXPERIENCE_DRAFT,
        title: 'Trải nghiệm đặt lịch và chờ phục vụ',
        description:
            'Bản nháp để quản trị viên tiếp tục hoàn thiện trước khi phát hành.',
        status: SURVEY_STATUSES.DRAFT,
        response_window_days: 7,
        created_day_offset: -3,
        published_day_offset: null,
        closed_day_offset: null,
        questions: Object.freeze([
            Object.freeze({
                key: 'BOOKING_EASE',
                text: 'Bạn đánh giá mức độ thuận tiện khi đặt lịch như thế nào?',
                type: SURVEY_QUESTION_TYPES.RATING,
                is_required: true,
                options: Object.freeze([]),
                order: 1,
            }),
            Object.freeze({
                key: 'BOOKING_CHANNEL',
                text: 'Bạn thường sử dụng kênh nào để đặt lịch?',
                type: SURVEY_QUESTION_TYPES.SINGLE_CHOICE,
                is_required: true,
                options: Object.freeze([
                    'Ứng dụng',
                    'Điện thoại',
                    'Đến trực tiếp',
                ]),
                order: 2,
            }),
            Object.freeze({
                key: 'BOOKING_COMMENT',
                text: 'Bạn muốn cải thiện điều gì trong quá trình đặt lịch?',
                type: SURVEY_QUESTION_TYPES.TEXT,
                is_required: false,
                options: Object.freeze([]),
                order: 3,
            }),
        ]),
    }),
]);

const SURVEY_RESPONSE_TARGETS = Object.freeze({
    total: 60,
    by_survey: Object.freeze({
        [SURVEY_KEYS.POST_SERVICE]: 24,
        [SURVEY_KEYS.HANDOVER_QUALITY]: 36,
    }),
    per_garage: 12,
    rating_distribution: Object.freeze({
        1: 2,
        2: 6,
        3: 10,
        4: 24,
        5: 18,
    }),
    nps_segments: Object.freeze({
        DETRACTOR: 12,
        PASSIVE: 20,
        PROMOTER: 28,
    }),
    text_answers: 30,
});

const PLATE_SCAN_TARGETS = Object.freeze({
    total: 30,
    per_garage: 6,
    by_status: Object.freeze({
        [PLATE_SCAN_STATUSES.CONFIRMED]: 15,
        [PLATE_SCAN_STATUSES.REJECTED]: 5,
        [PLATE_SCAN_STATUSES.EXPIRED]: 10,
    }),
    by_mode: Object.freeze({
        [PLATE_SCAN_MODES.GATE]: 15,
        [PLATE_SCAN_MODES.SINGLE]: 10,
        [PLATE_SCAN_MODES.LIVE_BATCH]: 5,
    }),
    by_capture_source: Object.freeze({
        [PLATE_CAPTURE_SOURCES.GATE_CAMERA]: 15,
        [PLATE_CAPTURE_SOURCES.STAFF_CAMERA]: 5,
        [PLATE_CAPTURE_SOURCES.LIVE_CAMERA]: 5,
        [PLATE_CAPTURE_SOURCES.GALLERY]: 3,
        [PLATE_CAPTURE_SOURCES.OFFLINE_GATE]: 2,
    }),
    retry_chains: 2,
    retained_images: 0,
});

const NOTIFICATION_RECENT_BOOKING_TARGET = 80;
const NOTIFICATION_SEED_KEY = 'AUTOWASH_NOTIFICATION_SEED_V1';
const PLATE_SCAN_CLIENT_EVENT_PREFIX = 'SEED-PLATE-V1';

module.exports = {
    SURVEY_KEYS,
    SURVEY_TARGETS,
    SURVEY_CATALOG,
    SURVEY_RESPONSE_TARGETS,
    PLATE_SCAN_TARGETS,
    NOTIFICATION_RECENT_BOOKING_TARGET,
    NOTIFICATION_SEED_KEY,
    PLATE_SCAN_CLIENT_EVENT_PREFIX,
};
