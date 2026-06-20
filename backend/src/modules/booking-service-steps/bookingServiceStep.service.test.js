jest.mock('./bookingServiceStep.model', () => ({
    countDocuments: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    insertMany: jest.fn(),
    updateMany: jest.fn(),
}));

jest.mock('../service-packages/servicePackage.model', () => ({
    find: jest.fn(),
}));

const BookingServiceStep = require('./bookingServiceStep.model');
const ServicePackage = require('../service-packages/servicePackage.model');
const bookingServiceStepService = require('./bookingServiceStep.service');

const createFindQuery = (result = []) => ({
    sort: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    then(resolve, reject) {
        return Promise.resolve(result).then(resolve, reject);
    },
});

describe('booking service step service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        BookingServiceStep.countDocuments.mockResolvedValue(0);
        BookingServiceStep.find.mockReturnValue(createFindQuery([]));
        BookingServiceStep.insertMany.mockResolvedValue([]);
        BookingServiceStep.updateMany.mockResolvedValue({ modifiedCount: 1 });
    });

    it('creates pre-service, child service, add-on, and post-service steps for combo booking items', async () => {
        const bookingId = '507f1f77bcf86cd799439001';
        const comboId = '507f1f77bcf86cd799439002';
        const washServiceId = '507f1f77bcf86cd799439003';
        const careServiceId = '507f1f77bcf86cd799439004';
        const addOnServiceId = '507f1f77bcf86cd799439005';
        const careStaffUserId = '507f1f77bcf86cd799439006';
        const booking = {
            _id: bookingId,
            service_package_id: comboId,
            booking_items: [
                {
                    item_key: 'ITEM_1_507F1F77BCF86CD799439003',
                    service_package_id: washServiceId,
                    source: 'COMBO_INCLUDED',
                    name_snapshot: 'Premium wash',
                    sequence: 1,
                    requires_wash_bay: true,
                    requires_care_staff: false,
                },
                {
                    item_key: 'ITEM_2_507F1F77BCF86CD799439004',
                    service_package_id: careServiceId,
                    source: 'COMBO_INCLUDED',
                    name_snapshot: 'Interior care',
                    sequence: 2,
                    requires_wash_bay: false,
                    requires_care_staff: true,
                    care_staff_type: 'VEHICLE_CARE_STAFF',
                    assigned_care_staff: [
                        {
                            staff_profile_id: '507f1f77bcf86cd799439007',
                            user_id: careStaffUserId,
                            assigned_at: new Date('2999-01-01T06:30:00.000Z'),
                            released_at: null,
                        },
                    ],
                },
                {
                    item_key: 'ITEM_3_507F1F77BCF86CD799439005',
                    service_package_id: addOnServiceId,
                    source: 'ADD_ON',
                    name_snapshot: 'AC cleaning',
                    sequence: 3,
                    requires_wash_bay: false,
                    requires_care_staff: true,
                    care_staff_type: 'VEHICLE_CARE_STAFF',
                },
            ],
        };
        const comboPackage = {
            _id: comboId,
            name: 'Basic Clean',
            steps_template: [
                {
                    step_code: 'COMBO_PARENT_STEP',
                    step_name: 'Combo parent process',
                    order: 1,
                    step_type: 'MANUAL_SERVICE_STEP',
                    is_required: true,
                },
            ],
        };
        const packages = [
            {
                _id: washServiceId,
                steps_template: [
                    {
                        step_code: 'CAR_PREMIUM_WASH',
                        step_name: 'Car premium wash process',
                        order: 1,
                        step_type: 'AUTOMATED_WASH_STEP',
                        is_required: true,
                        display_staff_type: 'WASH_OPERATOR',
                        instructions: ['Wash exterior body'],
                    },
                ],
            },
            {
                _id: careServiceId,
                steps_template: [
                    {
                        step_code: 'INTERIOR_CARE',
                        step_name: 'Interior care process',
                        order: 1,
                        step_type: 'MANUAL_SERVICE_STEP',
                        is_required: true,
                        display_staff_type: 'VEHICLE_CARE_STAFF',
                        instructions: ['Vacuum interior'],
                    },
                ],
            },
            {
                _id: addOnServiceId,
                steps_template: [
                    {
                        step_code: 'AC_CLEANING',
                        step_name: 'AC cleaning process',
                        order: 1,
                        step_type: 'MANUAL_SERVICE_STEP',
                        is_required: true,
                        display_staff_type: 'VEHICLE_CARE_STAFF',
                        instructions: ['Clean AC vents'],
                    },
                ],
            },
        ];

        ServicePackage.find.mockResolvedValue(packages);

        await bookingServiceStepService.createStepsForBooking(booking, comboPackage);

        const inserted = BookingServiceStep.insertMany.mock.calls[0][0];
        expect(inserted).toHaveLength(5);
        expect(inserted.map((step) => step.step_code)).toEqual([
            'PRE_SERVICE_CHECK_IN',
            'CAR_PREMIUM_WASH',
            'INTERIOR_CARE',
            'AC_CLEANING',
            'POST_SERVICE_HANDOVER',
        ]);
        expect(inserted.some((step) => step.step_code === 'COMBO_PARENT_STEP')).toBe(false);
        expect(inserted[0]).toMatchObject({
            workflow_type: 'PRE_SERVICE',
            group_name: 'Trước dịch vụ',
            requires_wash_bay: false,
            requires_care_staff: false,
        });
        expect(inserted[1]).toMatchObject({
            booking_item_key: 'ITEM_1_507F1F77BCF86CD799439003',
            workflow_type: 'SERVICE',
            group_name: 'Basic Clean',
            requires_wash_bay: true,
            requires_care_staff: false,
        });
        expect(inserted[3]).toMatchObject({
            booking_item_key: 'ITEM_3_507F1F77BCF86CD799439005',
            workflow_type: 'SERVICE',
            group_name: 'Dịch vụ bổ sung',
            requires_wash_bay: false,
            requires_care_staff: true,
        });
        expect(inserted[2]).toMatchObject({
            booking_item_key: 'ITEM_2_507F1F77BCF86CD799439004',
            assigned_staff_id: careStaffUserId,
        });
        expect(inserted[4]).toMatchObject({
            workflow_type: 'POST_SERVICE',
            group_name: 'Sau dịch vụ',
        });
    });

    it('marks item steps as resource released once booking item resources are freed', async () => {
        const bookingId = '507f1f77bcf86cd799439001';
        const bookingItemKey = 'ITEM_1_507F1F77BCF86CD799439003';
        const releasedAt = new Date('2999-01-01T06:30:00.000Z');

        await bookingServiceStepService.markResourceReleasedForBookingItem(
            bookingId,
            bookingItemKey,
            releasedAt
        );

        expect(BookingServiceStep.updateMany).toHaveBeenCalledWith(
            {
                booking_id: bookingId,
                booking_item_key: bookingItemKey,
                resource_released_at: null,
            },
            {
                $set: {
                    resource_released_at: releasedAt,
                },
            }
        );
    });
});
