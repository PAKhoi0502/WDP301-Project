require('dotenv').config();

const mongoose = require('mongoose');

const BookingServiceStep = require('../modules/booking-service-steps/bookingServiceStep.model');
const Booking = require('../modules/bookings/booking.model');
const Garage = require('../modules/garages/garage.model');
const ServicePackage = require('../modules/service-packages/servicePackage.model');
const StaffProfile = require('../modules/staff-profiles/staffProfile.model');
const VehicleInspection = require('../modules/vehicle-inspections/vehicleInspection.model');
const { connectDB, disconnectDB } = require('../config/db');
const {
    BOOKING_ITEM_STATUS,
    BOOKING_STATUS,
} = require('../shared/constants/booking.constant');
const {
    BOOKING_SERVICE_STEP_CODES,
    BOOKING_SERVICE_STEP_STATUS,
    BOOKING_SERVICE_STEP_WORKFLOW_TYPES,
} = require('../shared/constants/bookingServiceStep.constant');
const {
    SERVICE_STEP_TYPES,
} = require('../shared/constants/servicePackage.constant');
const {
    STAFF_EMPLOYMENT_STATUS,
    STAFF_TYPES,
} = require('../shared/constants/staff.constant');
const {
    VEHICLE_INSPECTION_TYPES,
} = require('../shared/constants/vehicleInspection.constant');
const {
    buildBookingScenarios,
    stableHexId,
} = require('./seedBookingCatalog');
const {
    INSPECTION_IMAGE_FIXTURES,
    buildInspectionDefinitions,
    shouldSeedServiceSteps,
} = require('./seedServiceStepsInspectionsCatalog');
const { getSeedReferenceDate } = require('./seedTime');

const PRE_SERVICE_GROUP_NAME = 'Trước dịch vụ';
const ADD_ON_GROUP_NAME = 'Dịch vụ bổ sung';
const POST_SERVICE_GROUP_NAME = 'Sau dịch vụ';
const PRIMARY_SERVICE_GROUP_NAME = 'Dịch vụ chính';

const PRE_SERVICE_INSTRUCTIONS = Object.freeze([
    'Xác nhận thông tin đặt lịch và xe',
    'Kiểm tra và ghi nhận tình trạng xe trước dịch vụ',
    'Che chắn thiết bị nhạy cảm nếu cần',
    'Che chắn khu vực sạc xe điện nếu có',
]);

const POST_SERVICE_INSTRUCTIONS = Object.freeze([
    'Kiểm tra tổng thể lần cuối',
    'Chụp ảnh sau dịch vụ nếu cần',
    'Ghi nhận tình trạng sau dịch vụ',
    'Xác nhận xe sẵn sàng để khách hàng kiểm tra và phản hồi',
]);

const EXPECTED_SUMMARY = Object.freeze({
    bookings_with_steps: 368,
    service_steps: 1393,
    step_statuses: Object.freeze({
        [BOOKING_SERVICE_STEP_STATUS.DONE]: 1387,
        [BOOKING_SERVICE_STEP_STATUS.PENDING]: 6,
    }),
    inspections: 734,
    inspection_types: Object.freeze({
        [VEHICLE_INSPECTION_TYPES.BEFORE_WASH]: 369,
        [VEHICLE_INSPECTION_TYPES.AFTER_WASH]: 365,
    }),
    by_garage: Object.freeze({
        GAR001: Object.freeze({ service_steps: 283, inspections: 152 }),
        GAR002: Object.freeze({ service_steps: 316, inspections: 162 }),
        GAR003: Object.freeze({ service_steps: 273, inspections: 145 }),
        GAR004: Object.freeze({ service_steps: 248, inspections: 140 }),
        GAR005: Object.freeze({ service_steps: 273, inspections: 135 }),
    }),
});

const toId = (value) => String(value?._id || value || '');

const countBy = (values, selector) => values.reduce((counts, value) => {
    const key = selector(value);

    counts[key] = (counts[key] || 0) + 1;

    return counts;
}, {});

const countsMatch = (actual, expected) => (
    Object.entries(expected).every(
        ([key, count]) => actual[key] === count
    )
    && Object.entries(actual).every(
        ([key, count]) => expected[key] === count
    )
);

const normalizeStepCode = (value) => {
    if (value === null || value === undefined) {
        return null;
    }

    const normalized = String(value)
        .trim()
        .replace(/[^A-Z0-9_]/gi, '_')
        .toUpperCase();

    return normalized || null;
};

const getFirstAssignedStaffUserId = (bookingItem) => {
    const assignments = [
        ...(bookingItem.assigned_execution_staff || []),
        ...(bookingItem.assigned_care_staff || []),
    ];
    const assignment = assignments.find((item) => !item.released_at)
        || assignments[0];

    return assignment?.user_id?._id || assignment?.user_id || null;
};

const getServiceStepGroupName = (bookingItem, fallbackServicePackage) => {
    if (bookingItem.source === 'COMBO_INCLUDED') {
        return fallbackServicePackage?.name || PRIMARY_SERVICE_GROUP_NAME;
    }

    if (bookingItem.source === 'ADD_ON') {
        return ADD_ON_GROUP_NAME;
    }

    return PRIMARY_SERVICE_GROUP_NAME;
};

const buildFallbackTemplate = (bookingItem) => [{
    step_code: `ITEM_${bookingItem.sequence}_DONE`,
    step_name: bookingItem.name_snapshot,
    order: 1,
    step_type: bookingItem.requires_wash_bay
        && !bookingItem.requires_care_staff
        ? SERVICE_STEP_TYPES.AUTOMATED_WASH_STEP
        : SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
    is_required: true,
    display_staff_type: bookingItem.care_staff_type || null,
    instructions: [],
}];

const getInspectionByType = (inspectionByNaturalKey, bookingId, type) => (
    inspectionByNaturalKey.get(`${bookingId}:${type}`)
);

const buildPreServiceStep = ({
    booking,
    fallbackServicePackage,
    inspectionByNaturalKey,
}) => {
    const bookingId = toId(booking._id);
    const inspection = getInspectionByType(
        inspectionByNaturalKey,
        bookingId,
        VEHICLE_INSPECTION_TYPES.BEFORE_WASH
    );

    if (!inspection) {
        throw new Error(
            `Before-wash inspection is missing for service steps: ${bookingId}`
        );
    }

    return {
        booking_id: booking._id,
        service_package_id:
            fallbackServicePackage?._id || booking.service_package_id,
        booking_item_key: null,
        step_code: BOOKING_SERVICE_STEP_CODES.PRE_SERVICE_CHECK_IN,
        step_name: 'Kiểm tra trước dịch vụ',
        order: 1,
        step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
        workflow_type:
            BOOKING_SERVICE_STEP_WORKFLOW_TYPES.PRE_SERVICE,
        group_name: PRE_SERVICE_GROUP_NAME,
        sequence: 1,
        is_required: true,
        requires_wash_bay: false,
        requires_care_staff: false,
        display_staff_type: null,
        assigned_staff_id: null,
        confirmed_by_staff_id: inspection.inspected_by,
        status: BOOKING_SERVICE_STEP_STATUS.DONE,
        instructions: [...PRE_SERVICE_INSTRUCTIONS],
        started_at: inspection.inspected_at,
        completed_at: inspection.inspected_at,
        resource_released_at: null,
        note: `Completed by before-wash inspection ${inspection._id}`,
    };
};

const buildServiceStepsForItem = ({
    booking,
    bookingItem,
    servicePackage,
    fallbackServicePackage,
}) => {
    const templates = [...(servicePackage?.steps_template || [])]
        .sort((left, right) => left.order - right.order);
    const effectiveTemplates = templates.length > 0
        ? templates
        : buildFallbackTemplate(bookingItem);
    const isDone = booking.status === BOOKING_STATUS.COMPLETED
        && bookingItem.status === BOOKING_ITEM_STATUS.DONE;
    const assignedStaffId = getFirstAssignedStaffUserId(bookingItem);

    return effectiveTemplates.map((template) => ({
        booking_id: booking._id,
        service_package_id: bookingItem.service_package_id,
        booking_item_key: normalizeStepCode(bookingItem.item_key),
        step_code: normalizeStepCode(template.step_code),
        step_name: template.step_name,
        order: bookingItem.sequence * 1000 + template.order,
        step_type: template.step_type,
        workflow_type: BOOKING_SERVICE_STEP_WORKFLOW_TYPES.SERVICE,
        group_name: getServiceStepGroupName(
            bookingItem,
            fallbackServicePackage
        ),
        sequence: bookingItem.sequence * 1000 + template.order,
        is_required: template.is_required !== false,
        requires_wash_bay: bookingItem.requires_wash_bay,
        requires_care_staff: bookingItem.requires_care_staff,
        display_staff_type:
            template.display_staff_type
            || bookingItem.care_staff_type
            || null,
        assigned_staff_id: assignedStaffId,
        confirmed_by_staff_id: isDone
            ? bookingItem.completed_by_staff_id || assignedStaffId
            : null,
        status: isDone
            ? BOOKING_SERVICE_STEP_STATUS.DONE
            : BOOKING_SERVICE_STEP_STATUS.PENDING,
        instructions: [...(template.instructions || [])],
        started_at: isDone ? bookingItem.actual_started_at : null,
        completed_at: isDone ? bookingItem.actual_completed_at : null,
        resource_released_at: isDone
            ? bookingItem.actual_completed_at
            : null,
        note: isDone
            ? 'Hạng mục đã hoàn thành theo lịch sử vận hành.'
            : null,
    }));
};

const buildPostServiceStep = ({
    booking,
    fallbackServicePackage,
    inspectionByNaturalKey,
    order,
}) => {
    const bookingId = toId(booking._id);
    const inspection = getInspectionByType(
        inspectionByNaturalKey,
        bookingId,
        VEHICLE_INSPECTION_TYPES.AFTER_WASH
    );
    const isDone = booking.status === BOOKING_STATUS.COMPLETED;

    if (isDone && !inspection) {
        throw new Error(
            `After-wash inspection is missing for completed booking: ${bookingId}`
        );
    }

    return {
        booking_id: booking._id,
        service_package_id:
            fallbackServicePackage?._id || booking.service_package_id,
        booking_item_key: null,
        step_code: BOOKING_SERVICE_STEP_CODES.POST_SERVICE_HANDOVER,
        step_name: 'Kiểm tra cuối và chuẩn bị bàn giao',
        order,
        step_type: SERVICE_STEP_TYPES.MANUAL_SERVICE_STEP,
        workflow_type:
            BOOKING_SERVICE_STEP_WORKFLOW_TYPES.POST_SERVICE,
        group_name: POST_SERVICE_GROUP_NAME,
        sequence: order,
        is_required: true,
        requires_wash_bay: false,
        requires_care_staff: false,
        display_staff_type: null,
        assigned_staff_id: null,
        confirmed_by_staff_id: isDone ? inspection.inspected_by : null,
        status: isDone
            ? BOOKING_SERVICE_STEP_STATUS.DONE
            : BOOKING_SERVICE_STEP_STATUS.PENDING,
        instructions: [...POST_SERVICE_INSTRUCTIONS],
        started_at: isDone ? inspection.inspected_at : null,
        completed_at: isDone ? inspection.inspected_at : null,
        resource_released_at: null,
        note: isDone
            ? `Completed by after-wash inspection ${inspection._id}`
            : null,
    };
};

const buildServiceStepDefinitions = ({
    bookings,
    servicePackageById,
    inspectionByNaturalKey,
}) => {
    const definitions = [];

    for (const booking of bookings.filter(shouldSeedServiceSteps)) {
        const fallbackServicePackage = servicePackageById.get(
            toId(booking.service_package_id)
        );
        const bookingItems = [...(booking.booking_items || [])]
            .sort((left, right) => left.sequence - right.sequence);
        const serviceSteps = bookingItems.flatMap((bookingItem) => (
            buildServiceStepsForItem({
                booking,
                bookingItem,
                servicePackage: servicePackageById.get(
                    toId(bookingItem.service_package_id)
                ),
                fallbackServicePackage,
            })
        ));
        const maxServiceOrder = serviceSteps.reduce(
            (maximum, step) => Math.max(maximum, step.order),
            (bookingItems.length || 1) * 1000
        );
        const bookingSteps = [
            buildPreServiceStep({
                booking,
                fallbackServicePackage,
                inspectionByNaturalKey,
            }),
            ...serviceSteps,
            buildPostServiceStep({
                booking,
                fallbackServicePackage,
                inspectionByNaturalKey,
                order: maxServiceOrder + 1000,
            }),
        ];

        for (const step of bookingSteps) {
            const createdAt = booking.started_at;
            const logicalTime = new Date(Math.max(
                createdAt.getTime(),
                step.completed_at?.getTime() || 0
            ));

            definitions.push({
                step_id_hex: stableHexId(
                    'AUTOWASH_BOOKING_SERVICE_STEP_V1',
                    `${booking._id}:${step.order}`
                ),
                ...step,
                created_at: createdAt,
                updated_at: logicalTime,
            });
        }
    }

    return definitions;
};

const applySession = (query, session) => {
    if (session) {
        query.session(session);
    }

    return query;
};

const validateInspectionDefinitions = (definitions) => {
    const naturalKeys = new Set();

    for (const definition of definitions) {
        const key = `${definition.booking_id}:${definition.type}`;

        if (naturalKeys.has(key)) {
            throw new Error(`Duplicate inspection seed key: ${key}`);
        }

        naturalKeys.add(key);

        const validationError = new VehicleInspection({
            _id: new mongoose.Types.ObjectId(
                definition.inspection_id_hex
            ),
            ...definition,
        }).validateSync();

        if (validationError) {
            throw validationError;
        }
    }
};

const validateServiceStepDefinitions = (definitions) => {
    const orderKeys = new Set();
    const itemStepKeys = new Set();

    for (const definition of definitions) {
        const orderKey = `${definition.booking_id}:${definition.order}`;
        const itemStepKey = [
            definition.booking_id,
            definition.booking_item_key || '',
            definition.step_code,
        ].join(':');

        if (orderKeys.has(orderKey)) {
            throw new Error(`Duplicate service step order: ${orderKey}`);
        }

        if (itemStepKeys.has(itemStepKey)) {
            throw new Error(`Duplicate service step key: ${itemStepKey}`);
        }

        orderKeys.add(orderKey);
        itemStepKeys.add(itemStepKey);

        const validationError = new BookingServiceStep({
            _id: new mongoose.Types.ObjectId(definition.step_id_hex),
            ...definition,
        }).validateSync();

        if (validationError) {
            throw validationError;
        }
    }
};

const pruneStaleDocuments = async ({
    model,
    bookingIds,
    definitions,
    buildKey,
    session,
}) => {
    const query = model.find({
        booking_id: { $in: bookingIds },
    }).select('_id booking_id type order');
    const existing = await applySession(query, session).lean();
    const expectedKeys = new Set(definitions.map(buildKey));
    const staleIds = existing
        .filter((document) => !expectedKeys.has(buildKey(document)))
        .map((document) => document._id);

    if (staleIds.length > 0) {
        await model.deleteMany({
            _id: { $in: staleIds },
        }).session(session || null);
    }

    return staleIds.length;
};

const upsertInspections = async ({
    definitions,
    bookingIds,
    session,
}) => {
    const deleted = await pruneStaleDocuments({
        model: VehicleInspection,
        bookingIds,
        definitions,
        buildKey: (value) => `${value.booking_id}:${value.type}`,
        session,
    });
    const result = await VehicleInspection.bulkWrite(
        definitions.map((definition) => {
            const {
                inspection_id_hex: inspectionIdHex,
                created_at: createdAt,
                ...values
            } = definition;

            return {
                updateOne: {
                    filter: {
                        booking_id: definition.booking_id,
                        type: definition.type,
                    },
                    update: {
                        $set: values,
                        $setOnInsert: {
                            _id: new mongoose.Types.ObjectId(
                                inspectionIdHex
                            ),
                            created_at: createdAt,
                        },
                    },
                    upsert: true,
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
        planned: definitions.length,
        inserted: result.upsertedCount,
        matched: result.matchedCount,
        modified: result.modifiedCount,
        deleted,
    };
};

const loadInspectionMap = async ({ bookingIds, session }) => {
    const query = VehicleInspection.find({
        booking_id: { $in: bookingIds },
    });
    const inspections = await applySession(query, session).lean();

    return new Map(inspections.map((inspection) => [
        `${inspection.booking_id}:${inspection.type}`,
        inspection,
    ]));
};

const upsertServiceSteps = async ({
    definitions,
    bookingIds,
    session,
}) => {
    const deleted = await pruneStaleDocuments({
        model: BookingServiceStep,
        bookingIds,
        definitions,
        buildKey: (value) => `${value.booking_id}:${value.order}`,
        session,
    });
    const result = await BookingServiceStep.bulkWrite(
        definitions.map((definition) => {
            const {
                step_id_hex: stepIdHex,
                created_at: createdAt,
                ...values
            } = definition;

            return {
                updateOne: {
                    filter: {
                        booking_id: definition.booking_id,
                        order: definition.order,
                    },
                    update: {
                        $set: values,
                        $setOnInsert: {
                            _id: new mongoose.Types.ObjectId(stepIdHex),
                            created_at: createdAt,
                        },
                    },
                    upsert: true,
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
        planned: definitions.length,
        inserted: result.upsertedCount,
        matched: result.matchedCount,
        modified: result.modifiedCount,
        deleted,
    };
};

const loadSeedDependencies = async ({ referenceDate, session }) => {
    const scenarios = buildBookingScenarios(referenceDate);
    const bookingIds = scenarios.map((scenario) => scenario.booking_id_hex);
    const bookingQuery = Booking.find({
        _id: { $in: bookingIds },
    });
    const garageQuery = Garage.find({
        garage_code: { $in: ['GAR001', 'GAR002', 'GAR003', 'GAR004', 'GAR005'] },
    }).select('_id garage_code');
    const [bookings, garages, servicePackages] = await Promise.all([
        applySession(bookingQuery, session).lean(),
        applySession(garageQuery, session).lean(),
        applySession(ServicePackage.find({}), session).lean(),
    ]);

    if (bookings.length !== scenarios.length) {
        throw new Error(
            `Seeded bookings are incomplete: ${bookings.length}/${scenarios.length}`
        );
    }

    if (garages.length !== 5) {
        throw new Error(`Seeded garages are incomplete: ${garages.length}/5`);
    }

    return {
        bookingIds,
        bookings,
        garageCodeById: new Map(garages.map((garage) => [
            toId(garage._id),
            garage.garage_code,
        ])),
        servicePackageById: new Map(servicePackages.map((servicePackage) => [
            toId(servicePackage._id),
            servicePackage,
        ])),
    };
};

const summarizeDefinitions = ({
    bookings,
    garageCodeById,
    inspectionDefinitions,
    serviceStepDefinitions,
}) => ({
    bookings_with_steps: bookings.filter(shouldSeedServiceSteps).length,
    service_steps: serviceStepDefinitions.length,
    step_statuses: countBy(
        serviceStepDefinitions,
        (step) => step.status
    ),
    inspections: inspectionDefinitions.length,
    inspection_types: countBy(
        inspectionDefinitions,
        (inspection) => inspection.type
    ),
    by_garage: Object.fromEntries(
        [...new Set(garageCodeById.values())].sort().map((garageCode) => {
            const garageIds = new Set(
                [...garageCodeById.entries()]
                    .filter(([, code]) => code === garageCode)
                    .map(([garageId]) => garageId)
            );
            const bookingIds = new Set(bookings
                .filter((booking) => garageIds.has(toId(booking.garage_id)))
                .map((booking) => toId(booking._id)));

            return [garageCode, {
                service_steps: serviceStepDefinitions.filter(
                    (step) => bookingIds.has(toId(step.booking_id))
                ).length,
                inspections: inspectionDefinitions.filter(
                    (inspection) => bookingIds.has(
                        toId(inspection.booking_id)
                    )
                ).length,
            }];
        })
    ),
});

const assertExpectedSummary = (summary) => {
    if (JSON.stringify(summary) !== JSON.stringify(EXPECTED_SUMMARY)) {
        throw new Error(
            `Service steps and inspections target mismatch: ${JSON.stringify(summary)}`
        );
    }
};

const buildSeedPlan = async ({ referenceDate, session = null }) => {
    const dependencies = await loadSeedDependencies({
        referenceDate,
        session,
    });
    const inspectionDefinitions = buildInspectionDefinitions({
        bookings: dependencies.bookings,
        garageCodeById: dependencies.garageCodeById,
    });

    validateInspectionDefinitions(inspectionDefinitions);

    const inspectionByNaturalKey = new Map(
        inspectionDefinitions.map((definition) => {
            const inspection = {
                ...definition,
                _id: new mongoose.Types.ObjectId(
                    definition.inspection_id_hex
                ),
            };

            return [
                `${definition.booking_id}:${definition.type}`,
                inspection,
            ];
        })
    );
    const serviceStepDefinitions = buildServiceStepDefinitions({
        bookings: dependencies.bookings,
        servicePackageById: dependencies.servicePackageById,
        inspectionByNaturalKey,
    });

    validateServiceStepDefinitions(serviceStepDefinitions);

    const summary = summarizeDefinitions({
        bookings: dependencies.bookings,
        garageCodeById: dependencies.garageCodeById,
        inspectionDefinitions,
        serviceStepDefinitions,
    });

    assertExpectedSummary(summary);

    return {
        ...dependencies,
        inspectionDefinitions,
        serviceStepDefinitions,
        summary,
    };
};

const seedServiceStepsInspectionsData = async ({
    session = null,
    referenceDate = getSeedReferenceDate(),
    dryRun = false,
} = {}) => {
    console.log('== Seeding service steps and vehicle inspections ==');

    const plan = await buildSeedPlan({ referenceDate, session });

    if (dryRun) {
        return {
            dry_run: true,
            ...plan.summary,
        };
    }

    const inspectionWrite = await upsertInspections({
        definitions: plan.inspectionDefinitions,
        bookingIds: plan.bookingIds,
        session,
    });
    const inspectionByNaturalKey = await loadInspectionMap({
        bookingIds: plan.bookingIds,
        session,
    });
    const serviceStepDefinitions = buildServiceStepDefinitions({
        bookings: plan.bookings,
        servicePackageById: plan.servicePackageById,
        inspectionByNaturalKey,
    });

    validateServiceStepDefinitions(serviceStepDefinitions);

    const serviceStepWrite = await upsertServiceSteps({
        definitions: serviceStepDefinitions,
        bookingIds: plan.bookingIds,
        session,
    });

    console.table([{
        service_steps: serviceStepDefinitions.length,
        step_inserted: serviceStepWrite.inserted,
        step_matched: serviceStepWrite.matched,
        inspections: plan.inspectionDefinitions.length,
        inspection_inserted: inspectionWrite.inserted,
        inspection_matched: inspectionWrite.matched,
    }]);
    console.log('Service steps and vehicle inspections seeding completed');

    return {
        dry_run: false,
        ...plan.summary,
        writes: {
            service_steps: serviceStepWrite,
            inspections: inspectionWrite,
        },
    };
};

const verifyServiceStepsInspections = async ({
    referenceDate = getSeedReferenceDate(),
} = {}) => {
    const plan = await buildSeedPlan({ referenceDate });
    const [serviceSteps, inspections] = await Promise.all([
        BookingServiceStep.find({
            booking_id: { $in: plan.bookingIds },
        }).lean(),
        VehicleInspection.find({
            booking_id: { $in: plan.bookingIds },
        }).lean(),
    ]);
    const inspectorIds = [
        ...new Set(inspections.map(
            (inspection) => toId(inspection.inspected_by)
        )),
    ];
    const inspectorProfiles = await StaffProfile.find({
        user_id: { $in: inspectorIds },
    }).lean();
    const inspectorProfileByUserId = new Map(
        inspectorProfiles.map((profile) => [
            toId(profile.user_id),
            profile,
        ])
    );

    if (
        serviceSteps.length !== EXPECTED_SUMMARY.service_steps
        || inspections.length !== EXPECTED_SUMMARY.inspections
    ) {
        throw new Error(
            `Persisted lifecycle totals mismatch: ${serviceSteps.length}/${inspections.length}`
        );
    }

    const bookingById = new Map(plan.bookings.map((booking) => [
        toId(booking._id),
        booking,
    ]));
    const inspectionByNaturalKey = new Map(inspections.map((inspection) => [
        `${inspection.booking_id}:${inspection.type}`,
        inspection,
    ]));
    const stepStatusCounts = countBy(serviceSteps, (step) => step.status);
    const inspectionTypeCounts = countBy(
        inspections,
        (inspection) => inspection.type
    );

    if (
        !countsMatch(
            stepStatusCounts,
            EXPECTED_SUMMARY.step_statuses
        )
        || !countsMatch(
            inspectionTypeCounts,
            EXPECTED_SUMMARY.inspection_types
        )
    ) {
        throw new Error(
            `Persisted lifecycle distribution mismatch: ${JSON.stringify({
                stepStatusCounts,
                inspectionTypeCounts,
            })}`
        );
    }

    for (const inspection of inspections) {
        const booking = bookingById.get(toId(inspection.booking_id));
        const expectedImage = INSPECTION_IMAGE_FIXTURES[
            booking?.vehicle_type
        ]?.[inspection.type];
        const inspectorProfile = inspectorProfileByUserId.get(
            toId(inspection.inspected_by)
        );

        if (
            !booking
            || toId(inspection.inspected_by)
                !== toId(booking.assigned_inspection_staff_id)
            || inspection.images.length !== 1
            || inspection.images[0].image_url !== expectedImage?.image_url
            || inspection.images[0].public_id !== null
            || !inspection.note
            || !inspectorProfile
            || inspectorProfile.staff_type
                !== STAFF_TYPES.VEHICLE_INSPECTION_STAFF
            || !inspectorProfile.is_active
            || inspectorProfile.employment_status
                !== STAFF_EMPLOYMENT_STATUS.ACTIVE
            || toId(inspectorProfile.garage_id)
                !== toId(booking.garage_id)
            || inspection.updated_at < inspection.created_at
        ) {
            throw new Error(
                `Invalid persisted inspection: ${inspection._id}`
            );
        }

        if (
            inspection.type === VEHICLE_INSPECTION_TYPES.BEFORE_WASH
            && (
                inspection.inspected_at < booking.checked_in_at
                || (
                    booking.started_at
                    && inspection.inspected_at >= booking.started_at
                )
            )
        ) {
            throw new Error(
                `Invalid before-wash inspection time: ${inspection._id}`
            );
        }

        if (
            inspection.type === VEHICLE_INSPECTION_TYPES.AFTER_WASH
            && (
                booking.status !== BOOKING_STATUS.COMPLETED
                || inspection.inspected_at <= booking.started_at
                || inspection.inspected_at >= booking.completed_at
            )
        ) {
            throw new Error(
                `Invalid after-wash inspection time: ${inspection._id}`
            );
        }
    }

    const ordersByBooking = new Map();

    for (const step of serviceSteps) {
        const booking = bookingById.get(toId(step.booking_id));
        const orders = ordersByBooking.get(toId(step.booking_id))
            || new Set();

        if (
            !booking
            || !shouldSeedServiceSteps(booking)
            || orders.has(step.order)
            || step.updated_at < step.created_at
            || (
                step.status === BOOKING_SERVICE_STEP_STATUS.DONE
                && (
                    !step.started_at
                    || !step.completed_at
                    || step.started_at > step.completed_at
                )
            )
            || (
                step.status === BOOKING_SERVICE_STEP_STATUS.PENDING
                && step.completed_at
            )
        ) {
            throw new Error(`Invalid persisted service step: ${step._id}`);
        }

        orders.add(step.order);
        ordersByBooking.set(toId(step.booking_id), orders);

        if (
            booking.status === BOOKING_STATUS.COMPLETED
            && step.status !== BOOKING_SERVICE_STEP_STATUS.DONE
        ) {
            throw new Error(
                `Completed booking has incomplete step: ${step._id}`
            );
        }

        if (
            booking.status === BOOKING_STATUS.IN_PROGRESS
            && step.workflow_type
                === BOOKING_SERVICE_STEP_WORKFLOW_TYPES.PRE_SERVICE
            && step.status !== BOOKING_SERVICE_STEP_STATUS.DONE
        ) {
            throw new Error(
                `In-progress booking has incomplete pre-service step: ${step._id}`
            );
        }

        if (
            booking.status === BOOKING_STATUS.IN_PROGRESS
            && step.workflow_type
                !== BOOKING_SERVICE_STEP_WORKFLOW_TYPES.PRE_SERVICE
            && step.status !== BOOKING_SERVICE_STEP_STATUS.PENDING
        ) {
            throw new Error(
                `In-progress booking step should remain pending: ${step._id}`
            );
        }

        if (
            step.workflow_type
                === BOOKING_SERVICE_STEP_WORKFLOW_TYPES.PRE_SERVICE
        ) {
            const inspection = getInspectionByType(
                inspectionByNaturalKey,
                toId(step.booking_id),
                VEHICLE_INSPECTION_TYPES.BEFORE_WASH
            );

            if (
                !inspection
                || toId(step.confirmed_by_staff_id)
                    !== toId(inspection.inspected_by)
                || step.completed_at.getTime()
                    !== inspection.inspected_at.getTime()
                || step.note
                    !== `Completed by before-wash inspection ${inspection._id}`
            ) {
                throw new Error(
                    `Pre-service inspection link mismatch: ${step._id}`
                );
            }
        }

        if (
            step.workflow_type
                === BOOKING_SERVICE_STEP_WORKFLOW_TYPES.POST_SERVICE
            && booking.status === BOOKING_STATUS.COMPLETED
        ) {
            const inspection = getInspectionByType(
                inspectionByNaturalKey,
                toId(step.booking_id),
                VEHICLE_INSPECTION_TYPES.AFTER_WASH
            );

            if (
                !inspection
                || toId(step.confirmed_by_staff_id)
                    !== toId(inspection.inspected_by)
                || step.completed_at.getTime()
                    !== inspection.inspected_at.getTime()
                || step.note
                    !== `Completed by after-wash inspection ${inspection._id}`
            ) {
                throw new Error(
                    `Post-service inspection link mismatch: ${step._id}`
                );
            }
        }
    }

    if (ordersByBooking.size !== EXPECTED_SUMMARY.bookings_with_steps) {
        throw new Error(
            `Bookings with service steps mismatch: ${ordersByBooking.size}`
        );
    }

    const persistedByGarage = {};

    for (const [garageCode, expected] of Object.entries(
        EXPECTED_SUMMARY.by_garage
    )) {
        const garageIds = new Set(
            [...plan.garageCodeById.entries()]
                .filter(([, code]) => code === garageCode)
                .map(([garageId]) => garageId)
        );
        const garageBookingIds = new Set(plan.bookings
            .filter((booking) => garageIds.has(toId(booking.garage_id)))
            .map((booking) => toId(booking._id)));
        const actual = {
            service_steps: serviceSteps.filter(
                (step) => garageBookingIds.has(toId(step.booking_id))
            ).length,
            inspections: inspections.filter(
                (inspection) => garageBookingIds.has(
                    toId(inspection.booking_id)
                )
            ).length,
        };

        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(
                `Garage lifecycle mismatch: ${garageCode}:${JSON.stringify(actual)}`
            );
        }

        persistedByGarage[garageCode] = actual;
    }

    const imageUsage = countBy(
        inspections,
        (inspection) => inspection.images[0].image_url
    );

    return {
        service_steps: {
            total: serviceSteps.length,
            by_status: stepStatusCounts,
            bookings: ordersByBooking.size,
        },
        inspections: {
            total: inspections.length,
            by_type: inspectionTypeCounts,
            images: inspections.length,
            public_ids: inspections.filter(
                (inspection) => inspection.images.some(
                    (image) => image.public_id
                )
            ).length,
            inspectors: inspectorProfiles.length,
            image_usage: imageUsage,
        },
        by_garage: persistedByGarage,
    };
};

const seedServiceStepsInspections = async ({
    dryRun = process.argv.includes('--dry-run'),
} = {}) => {
    const referenceDate = getSeedReferenceDate();

    await connectDB();

    if (dryRun) {
        try {
            return await seedServiceStepsInspectionsData({
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
            result.seed = await seedServiceStepsInspectionsData({
                session,
                referenceDate,
            });
        });

        result.verification = await verifyServiceStepsInspections({
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
        const result = await seedServiceStepsInspections();

        console.log('Service steps and inspections seed completed');
        console.dir(result.verification || result, { depth: null });
    } catch (error) {
        console.error(
            'Service steps and inspections seed failed:',
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
    EXPECTED_SUMMARY,
    normalizeStepCode,
    buildFallbackTemplate,
    buildServiceStepDefinitions,
    validateInspectionDefinitions,
    validateServiceStepDefinitions,
    summarizeDefinitions,
    assertExpectedSummary,
    buildSeedPlan,
    seedServiceStepsInspectionsData,
    verifyServiceStepsInspections,
    seedServiceStepsInspections,
};
