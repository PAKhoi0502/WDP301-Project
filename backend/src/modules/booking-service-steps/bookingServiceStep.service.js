const BookingServiceStep = require('./bookingServiceStep.model');
const BookingServiceStepMapper = require('./bookingServiceStep.mapper');
const ServicePackage = require('../service-packages/servicePackage.model');
const { AppError } = require('../../shared/utils/appError');
const {
    BOOKING_SERVICE_STEP_STATUS,
} = require('../../shared/constants/bookingServiceStep.constant');
const { SERVICE_STEP_TYPES } = require('../../shared/constants/servicePackage.constant');

const normalizeText = (value) => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value !== 'string') {
        return value;
    }

    const trimmedValue = value.trim();

    return trimmedValue || null;
};

const populateStepQuery = (query) => {
    return query
        .populate('assigned_staff_id', 'full_name email phone role is_active')
        .populate('confirmed_by_staff_id', 'full_name email phone role is_active');
};

const getStepsByBookingId = async (bookingId) => {
    const steps = await populateStepQuery(
        BookingServiceStep.find({ booking_id: bookingId }).sort({ order: 1 })
    );

    return BookingServiceStepMapper.toBookingServiceStepDtoList(steps);
};

const countStepsByBookingId = async (bookingId) => {
    return BookingServiceStep.countDocuments({ booking_id: bookingId });
};

const normalizeStepCode = (value) => {
    return normalizeText(value)?.replace(/[^A-Z0-9_]/gi, '_').toUpperCase() || null;
};

const buildFallbackTemplate = (bookingItem) => {
    return [{
        step_code: `ITEM_${bookingItem.sequence}_DONE`,
        step_name: bookingItem.name_snapshot,
        order: 1,
        step_type: bookingItem.requires_wash_bay && !bookingItem.requires_care_staff
            ? SERVICE_STEP_TYPES.AUTOMATED_WASH_STEP
            : SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
        is_required: true,
        display_staff_type: bookingItem.care_staff_type || null,
        instructions: [],
    }];
};

const buildStepDocumentsForItem = (booking, bookingItem, servicePackage) => {
    const templates = [...(servicePackage?.steps_template || [])].sort((a, b) => a.order - b.order);
    const effectiveTemplates = templates.length > 0 ? templates : buildFallbackTemplate(bookingItem);
    const bookingItemKey = normalizeStepCode(bookingItem.item_key);

    return effectiveTemplates.map((step) => ({
        booking_id: booking._id,
        service_package_id: bookingItem.service_package_id,
        booking_item_key: bookingItemKey,
        step_code: normalizeStepCode(step.step_code),
        step_name: step.step_name,
        order: (bookingItem.sequence * 1000) + step.order,
        step_type: step.step_type,
        is_required: step.is_required,
        display_staff_type: step.display_staff_type || bookingItem.care_staff_type || null,
        assigned_staff_id: null,
        confirmed_by_staff_id: null,
        status: BOOKING_SERVICE_STEP_STATUS.PENDING,
        instructions: step.instructions || [],
        started_at: null,
        completed_at: null,
        note: null,
    }));
};

const createStepsFromTemplate = async (booking, servicePackage) => {
    const existedCount = await countStepsByBookingId(booking._id);

    if (existedCount > 0) {
        return getStepsByBookingId(booking._id);
    }

    const templates = [...(servicePackage.steps_template || [])].sort((a, b) => a.order - b.order);

    if (templates.length === 0) {
        return [];
    }

    const documents = templates.map((step) => ({
        booking_id: booking._id,
        service_package_id: servicePackage._id,
        step_code: step.step_code,
        step_name: step.step_name,
        order: step.order,
        step_type: step.step_type,
        is_required: step.is_required,
        display_staff_type: step.display_staff_type || null,
        assigned_staff_id: null,
        confirmed_by_staff_id: null,
        status: BOOKING_SERVICE_STEP_STATUS.PENDING,
        instructions: step.instructions || [],
        started_at: null,
        completed_at: null,
        note: null,
    }));

    await BookingServiceStep.insertMany(documents, { ordered: true });

    return getStepsByBookingId(booking._id);
};

const createStepsForBooking = async (booking, fallbackServicePackage) => {
    const existedCount = await countStepsByBookingId(booking._id);

    if (existedCount > 0) {
        return getStepsByBookingId(booking._id);
    }

    const bookingItems = [...(booking.booking_items || [])].sort((a, b) => a.sequence - b.sequence);

    if (bookingItems.length === 0) {
        return createStepsFromTemplate(booking, fallbackServicePackage);
    }

    const servicePackageIds = [...new Set(bookingItems.map((item) => item.service_package_id.toString()))];
    const servicePackages = await ServicePackage.find({ _id: { $in: servicePackageIds } });
    const servicePackageMap = new Map(servicePackages.map((item) => [item._id.toString(), item]));

    const documents = bookingItems.flatMap((item) => buildStepDocumentsForItem(
        booking,
        item,
        servicePackageMap.get(item.service_package_id.toString())
    ));

    if (documents.length === 0) {
        return [];
    }

    await BookingServiceStep.insertMany(documents, { ordered: true });

    return getStepsByBookingId(booking._id);
};

const markStepDone = async ({ bookingId, stepId, staffId, note }) => {
    const step = await BookingServiceStep.findOne({
        _id: stepId,
        booking_id: bookingId,
    });

    if (!step) {
        throw new AppError('Booking service step not found', 404, 'BOOKING_SERVICE_STEP_NOT_FOUND');
    }

    if (step.status === BOOKING_SERVICE_STEP_STATUS.DONE) {
        return BookingServiceStepMapper.toBookingServiceStepDto(
            await populateStepQuery(BookingServiceStep.findById(step._id))
        );
    }

    if (step.status === BOOKING_SERVICE_STEP_STATUS.SKIPPED && step.is_required) {
        throw new AppError('Required step cannot be completed after being skipped', 400, 'REQUIRED_STEP_SKIPPED');
    }

    const now = new Date();

    if (!step.started_at) {
        step.started_at = now;
    }

    step.status = BOOKING_SERVICE_STEP_STATUS.DONE;
    step.completed_at = now;
    step.confirmed_by_staff_id = staffId;
    step.note = normalizeText(note);

    await step.save();

    const populatedStep = await populateStepQuery(BookingServiceStep.findById(step._id));

    return BookingServiceStepMapper.toBookingServiceStepDto(populatedStep);
};

const assertAllRequiredStepsDone = async (bookingId) => {
    const pendingRequiredStep = await BookingServiceStep.findOne({
        booking_id: bookingId,
        is_required: true,
        status: { $ne: BOOKING_SERVICE_STEP_STATUS.DONE },
    });

    if (pendingRequiredStep) {
        throw new AppError(
            'All required service steps must be completed before completing booking',
            400,
            'REQUIRED_SERVICE_STEPS_NOT_DONE'
        );
    }
};

const areAllRequiredStepsDoneForBookingItem = async (bookingId, bookingItemKey) => {
    if (!bookingItemKey) {
        return false;
    }

    const pendingRequiredStep = await BookingServiceStep.findOne({
        booking_id: bookingId,
        booking_item_key: bookingItemKey,
        is_required: true,
        status: { $ne: BOOKING_SERVICE_STEP_STATUS.DONE },
    });

    return !pendingRequiredStep;
};

module.exports = {
    getStepsByBookingId,
    countStepsByBookingId,
    createStepsFromTemplate,
    createStepsForBooking,
    markStepDone,
    assertAllRequiredStepsDone,
    areAllRequiredStepsDoneForBookingItem,
};
