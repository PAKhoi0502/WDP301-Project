const { BOOKING_STATUS } = require('../shared/constants/booking.constant');
const {
    VEHICLE_INSPECTION_TYPES,
} = require('../shared/constants/vehicleInspection.constant');
const { VEHICLE_TYPES } = require('../shared/constants/vehicle.constant');
const { stableHexId } = require('./seedBookingCatalog');

const INSPECTION_IMAGE_FIXTURES = Object.freeze({
    [VEHICLE_TYPES.CAR]: Object.freeze({
        [VEHICLE_INSPECTION_TYPES.BEFORE_WASH]: Object.freeze({
            image_url: 'https://res.cloudinary.com/dngkdo6ni/image/upload/v1785254196/anh-xe-o-to-bi-tray-xuoc_wqq8fi.png',
            public_id: null,
            caption: 'Ô tô trước khi rửa - ghi nhận tình trạng bề mặt.',
        }),
        [VEHICLE_INSPECTION_TYPES.AFTER_WASH]: Object.freeze({
            image_url: 'https://res.cloudinary.com/dngkdo6ni/image/upload/v1785254193/anh-xe-o-to-sau-khi-rua_zm08le.png',
            public_id: null,
            caption: 'Ô tô sau khi rửa - bề mặt đã được làm sạch.',
        }),
    }),
    [VEHICLE_TYPES.MOTORBIKE]: Object.freeze({
        [VEHICLE_INSPECTION_TYPES.BEFORE_WASH]: Object.freeze({
            image_url: 'https://res.cloudinary.com/dngkdo6ni/image/upload/v1785254192/anh-xe-may-bi-tray-xuoc_pzbwxt.png',
            public_id: null,
            caption: 'Xe máy trước khi rửa - ghi nhận tình trạng bề mặt.',
        }),
        [VEHICLE_INSPECTION_TYPES.AFTER_WASH]: Object.freeze({
            image_url: 'https://res.cloudinary.com/dngkdo6ni/image/upload/v1785254193/anh-xe-may-sau-khi-rua_t4dafq.png',
            public_id: null,
            caption: 'Xe máy sau khi rửa - bề mặt đã được làm sạch.',
        }),
    }),
});

const INSPECTION_NOTES = Object.freeze({
    [VEHICLE_TYPES.CAR]: Object.freeze({
        [VEHICLE_INSPECTION_TYPES.BEFORE_WASH]:
            'Xe có bụi bẩn sử dụng thông thường. Đã ghi nhận vết trầy bề mặt có sẵn trước khi rửa, không phát hiện hư hỏng ảnh hưởng vận hành.',
        [VEHICLE_INSPECTION_TYPES.AFTER_WASH]:
            'Bề mặt xe đã sạch và được kiểm tra lại. Vết trầy có sẵn không thay đổi, không phát sinh hư hỏng trong quá trình dịch vụ.',
    }),
    [VEHICLE_TYPES.MOTORBIKE]: Object.freeze({
        [VEHICLE_INSPECTION_TYPES.BEFORE_WASH]:
            'Xe có bụi bẩn sử dụng thông thường. Đã ghi nhận vết trầy bề mặt có sẵn trước khi rửa, không phát hiện hư hỏng ảnh hưởng vận hành.',
        [VEHICLE_INSPECTION_TYPES.AFTER_WASH]:
            'Xe đã được làm sạch và kiểm tra lại. Vết trầy có sẵn không thay đổi, không phát sinh hư hỏng trong quá trình dịch vụ.',
    }),
});

const addMinutes = (value, minutes) => new Date(
    new Date(value).getTime() + minutes * 60000
);

const shouldSeedServiceSteps = (booking) => (
    booking.status === BOOKING_STATUS.COMPLETED
    || booking.status === BOOKING_STATUS.IN_PROGRESS
);

const shouldSeedBeforeInspection = ({ booking, garageCode }) => (
    booking.status === BOOKING_STATUS.COMPLETED
    || booking.status === BOOKING_STATUS.IN_PROGRESS
    || (
        booking.status === BOOKING_STATUS.CHECKED_IN
        && garageCode === 'GAR001'
    )
);

const shouldSeedAfterInspection = (booking) => (
    booking.status === BOOKING_STATUS.COMPLETED
);

const getBeforeInspectionTime = (booking) => {
    if (booking.status === BOOKING_STATUS.CHECKED_IN) {
        return addMinutes(booking.checked_in_at, 5);
    }

    return addMinutes(booking.started_at, -2);
};

const getAfterInspectionTime = (booking) => (
    addMinutes(booking.completed_at, -2)
);

const getInspectionImage = ({ vehicleType, type }) => {
    const image = INSPECTION_IMAGE_FIXTURES[vehicleType]?.[type];

    if (!image) {
        throw new Error(
            `Inspection image fixture is missing: ${vehicleType}:${type}`
        );
    }

    return { ...image };
};

const getInspectionNote = ({ vehicleType, type }) => {
    const note = INSPECTION_NOTES[vehicleType]?.[type];

    if (!note) {
        throw new Error(
            `Inspection note is missing: ${vehicleType}:${type}`
        );
    }

    return note;
};

const buildInspectionDefinitions = ({ bookings, garageCodeById }) => {
    const definitions = [];

    for (const booking of bookings) {
        const bookingId = String(booking._id);
        const garageCode = garageCodeById.get(String(booking.garage_id));
        const types = [];

        if (shouldSeedBeforeInspection({ booking, garageCode })) {
            types.push(VEHICLE_INSPECTION_TYPES.BEFORE_WASH);
        }

        if (shouldSeedAfterInspection(booking)) {
            types.push(VEHICLE_INSPECTION_TYPES.AFTER_WASH);
        }

        for (const type of types) {
            const inspectedAt = type === VEHICLE_INSPECTION_TYPES.BEFORE_WASH
                ? getBeforeInspectionTime(booking)
                : getAfterInspectionTime(booking);

            definitions.push({
                inspection_id_hex: stableHexId(
                    'AUTOWASH_VEHICLE_INSPECTION_V1',
                    `${bookingId}:${type}`
                ),
                booking_id: booking._id,
                type,
                note: getInspectionNote({
                    vehicleType: booking.vehicle_type,
                    type,
                }),
                images: [getInspectionImage({
                    vehicleType: booking.vehicle_type,
                    type,
                })],
                inspected_by: booking.assigned_inspection_staff_id,
                inspected_at: inspectedAt,
                created_at: inspectedAt,
                updated_at: inspectedAt,
            });
        }
    }

    return definitions;
};

module.exports = {
    INSPECTION_IMAGE_FIXTURES,
    INSPECTION_NOTES,
    addMinutes,
    shouldSeedServiceSteps,
    shouldSeedBeforeInspection,
    shouldSeedAfterInspection,
    getBeforeInspectionTime,
    getAfterInspectionTime,
    getInspectionImage,
    getInspectionNote,
    buildInspectionDefinitions,
};
