const mongoose = require('mongoose');

const {
    BOOKING_ITEM_STATUS,
    BOOKING_STATUS,
} = require('../shared/constants/booking.constant');
const {
    BOOKING_SERVICE_STEP_STATUS,
    BOOKING_SERVICE_STEP_WORKFLOW_TYPES,
} = require('../shared/constants/bookingServiceStep.constant');
const {
    SERVICE_STEP_TYPES,
} = require('../shared/constants/servicePackage.constant');
const {
    VEHICLE_INSPECTION_TYPES,
} = require('../shared/constants/vehicleInspection.constant');
const { VEHICLE_TYPES } = require('../shared/constants/vehicle.constant');
const {
    INSPECTION_IMAGE_FIXTURES,
    buildInspectionDefinitions,
    shouldSeedBeforeInspection,
    shouldSeedAfterInspection,
    shouldSeedServiceSteps,
} = require('./seedServiceStepsInspectionsCatalog');
const {
    EXPECTED_SUMMARY,
    buildServiceStepDefinitions,
    validateInspectionDefinitions,
    validateServiceStepDefinitions,
} = require('./seedServiceStepsInspections');

const objectId = () => new mongoose.Types.ObjectId();

const buildBooking = ({
    status,
    garageId,
    vehicleType = VEHICLE_TYPES.CAR,
}) => {
    const startedAt = new Date('2026-07-20T02:00:00.000Z');
    const completedAt = new Date('2026-07-20T02:35:00.000Z');

    return {
        _id: objectId(),
        garage_id: garageId,
        vehicle_type: vehicleType,
        service_package_id: objectId(),
        assigned_inspection_staff_id: objectId(),
        status,
        checked_in_at: new Date('2026-07-20T01:55:00.000Z'),
        started_at: [
            BOOKING_STATUS.COMPLETED,
            BOOKING_STATUS.IN_PROGRESS,
        ].includes(status)
            ? startedAt
            : null,
        completed_at: status === BOOKING_STATUS.COMPLETED
            ? completedAt
            : null,
        updated_at: completedAt,
        booking_items: [],
    };
};

describe('service steps and inspections seed', () => {
    test('uses the four Cloudinary fixtures without managed public ids', () => {
        const images = Object.values(INSPECTION_IMAGE_FIXTURES)
            .flatMap((byType) => Object.values(byType));

        expect(images).toHaveLength(4);
        expect(new Set(images.map((image) => image.image_url)).size).toBe(4);

        for (const image of images) {
            expect(image.image_url).toMatch(
                /^https:\/\/res\.cloudinary\.com\/dngkdo6ni\/image\/upload\//
            );
            expect(image.public_id).toBeNull();
            expect(image.caption.length).toBeGreaterThan(10);
        }
    });

    test('applies inspection coverage only to lifecycle-compatible bookings', () => {
        const checkedIn = {
            status: BOOKING_STATUS.CHECKED_IN,
        };
        const completed = {
            status: BOOKING_STATUS.COMPLETED,
        };
        const inProgress = {
            status: BOOKING_STATUS.IN_PROGRESS,
        };
        const confirmed = {
            status: BOOKING_STATUS.CONFIRMED,
        };

        expect(shouldSeedServiceSteps(completed)).toBe(true);
        expect(shouldSeedServiceSteps(inProgress)).toBe(true);
        expect(shouldSeedServiceSteps(checkedIn)).toBe(false);
        expect(shouldSeedBeforeInspection({
            booking: checkedIn,
            garageCode: 'GAR001',
        })).toBe(true);
        expect(shouldSeedBeforeInspection({
            booking: checkedIn,
            garageCode: 'GAR002',
        })).toBe(false);
        expect(shouldSeedAfterInspection(completed)).toBe(true);
        expect(shouldSeedAfterInspection(inProgress)).toBe(false);
        expect(shouldSeedBeforeInspection({
            booking: confirmed,
            garageCode: 'GAR001',
        })).toBe(false);
    });

    test('builds schema-valid inspections with realistic event ordering', () => {
        const garageOneId = objectId();
        const garageTwoId = objectId();
        const bookings = [
            buildBooking({
                status: BOOKING_STATUS.COMPLETED,
                garageId: garageOneId,
            }),
            buildBooking({
                status: BOOKING_STATUS.IN_PROGRESS,
                garageId: garageOneId,
                vehicleType: VEHICLE_TYPES.MOTORBIKE,
            }),
            buildBooking({
                status: BOOKING_STATUS.CHECKED_IN,
                garageId: garageOneId,
            }),
            buildBooking({
                status: BOOKING_STATUS.CHECKED_IN,
                garageId: garageTwoId,
            }),
        ];
        const definitions = buildInspectionDefinitions({
            bookings,
            garageCodeById: new Map([
                [garageOneId.toString(), 'GAR001'],
                [garageTwoId.toString(), 'GAR002'],
            ]),
        });

        expect(definitions).toHaveLength(4);
        expect(() => validateInspectionDefinitions(definitions))
            .not.toThrow();
        expect(definitions.filter(
            (definition) => (
                definition.type === VEHICLE_INSPECTION_TYPES.BEFORE_WASH
            )
        )).toHaveLength(3);
        expect(definitions.filter(
            (definition) => (
                definition.type === VEHICLE_INSPECTION_TYPES.AFTER_WASH
            )
        )).toHaveLength(1);

        for (const definition of definitions) {
            const booking = bookings.find(
                (item) => item._id.toString()
                    === definition.booking_id.toString()
            );

            expect(definition.images).toHaveLength(1);
            expect(definition.inspected_by).toEqual(
                booking.assigned_inspection_staff_id
            );

            if (
                definition.type
                === VEHICLE_INSPECTION_TYPES.BEFORE_WASH
            ) {
                expect(definition.inspected_at.getTime())
                    .toBeGreaterThan(booking.checked_in_at.getTime());
            } else {
                expect(definition.inspected_at.getTime())
                    .toBeLessThan(booking.completed_at.getTime());
            }
        }
    });

    test('links completed workflow steps to before and after inspections', () => {
        const booking = buildBooking({
            status: BOOKING_STATUS.COMPLETED,
            garageId: objectId(),
        });
        const servicePackage = {
            _id: booking.service_package_id,
            name: 'Rửa xe tiêu chuẩn',
            steps_template: [{
                step_code: 'CAR_STANDARD_WASH_STEP',
                step_name: 'Vận hành quy trình rửa tiêu chuẩn',
                order: 1,
                step_type: SERVICE_STEP_TYPES.AUTOMATED_WASH_STEP,
                is_required: true,
                display_staff_type: 'WASH_OPERATOR',
                instructions: ['Kiểm tra khu vực rửa trước khi vận hành'],
            }],
        };
        const assignedUserId = objectId();

        booking.booking_items = [{
            item_key: 'ITEM_1_STANDARD',
            service_package_id: servicePackage._id,
            source: 'PRIMARY',
            name_snapshot: servicePackage.name,
            sequence: 1,
            requires_wash_bay: true,
            requires_care_staff: false,
            care_staff_type: null,
            assigned_execution_staff: [{
                user_id: assignedUserId,
                released_at: booking.completed_at,
            }],
            assigned_care_staff: [],
            status: BOOKING_ITEM_STATUS.DONE,
            actual_started_at: booking.started_at,
            actual_completed_at: new Date(
                booking.completed_at.getTime() - 5 * 60000
            ),
            completed_by_staff_id: assignedUserId,
        }];

        const beforeInspection = {
            _id: objectId(),
            booking_id: booking._id,
            type: VEHICLE_INSPECTION_TYPES.BEFORE_WASH,
            inspected_by: booking.assigned_inspection_staff_id,
            inspected_at: new Date(
                booking.started_at.getTime() - 2 * 60000
            ),
        };
        const afterInspection = {
            _id: objectId(),
            booking_id: booking._id,
            type: VEHICLE_INSPECTION_TYPES.AFTER_WASH,
            inspected_by: booking.assigned_inspection_staff_id,
            inspected_at: new Date(
                booking.completed_at.getTime() - 2 * 60000
            ),
        };
        const steps = buildServiceStepDefinitions({
            bookings: [booking],
            servicePackageById: new Map([
                [servicePackage._id.toString(), servicePackage],
            ]),
            inspectionByNaturalKey: new Map([
                [
                    `${booking._id}:${beforeInspection.type}`,
                    beforeInspection,
                ],
                [
                    `${booking._id}:${afterInspection.type}`,
                    afterInspection,
                ],
            ]),
        });

        expect(steps).toHaveLength(3);
        expect(() => validateServiceStepDefinitions(steps)).not.toThrow();
        expect(steps.map((step) => step.workflow_type)).toEqual([
            BOOKING_SERVICE_STEP_WORKFLOW_TYPES.PRE_SERVICE,
            BOOKING_SERVICE_STEP_WORKFLOW_TYPES.SERVICE,
            BOOKING_SERVICE_STEP_WORKFLOW_TYPES.POST_SERVICE,
        ]);
        expect(steps.every(
            (step) => step.status === BOOKING_SERVICE_STEP_STATUS.DONE
        )).toBe(true);
        expect(steps.every(
            (step) => step.updated_at >= step.created_at
        )).toBe(true);
        expect(steps[0].note).toContain(beforeInspection._id.toString());
        expect(steps[2].note).toContain(afterInspection._id.toString());
    });

    test('locks the agreed lifecycle totals and garage distribution', () => {
        expect(EXPECTED_SUMMARY).toEqual({
            bookings_with_steps: 368,
            service_steps: 1393,
            step_statuses: {
                DONE: 1387,
                PENDING: 6,
            },
            inspections: 734,
            inspection_types: {
                BEFORE_WASH: 369,
                AFTER_WASH: 365,
            },
            by_garage: {
                GAR001: { service_steps: 283, inspections: 152 },
                GAR002: { service_steps: 316, inspections: 162 },
                GAR003: { service_steps: 273, inspections: 145 },
                GAR004: { service_steps: 248, inspections: 140 },
                GAR005: { service_steps: 273, inspections: 135 },
            },
        });
    });
});
