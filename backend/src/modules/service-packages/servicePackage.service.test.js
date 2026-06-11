const mongoose = require('mongoose');

jest.mock('./servicePackage.model', () => ({
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
    exists: jest.fn(),
    create: jest.fn(),
    countDocuments: jest.fn(),
}));

jest.mock('../wash-bays/washBay.service', () => ({
    getSupportedVehicleTypesByGarage: jest.fn(),
}));

const ServicePackage = require('./servicePackage.model');
const servicePackageService = require('./servicePackage.service');

const createPopulateQuery = (result) => ({
    populate: jest.fn().mockResolvedValue(result),
});

describe('service package service', () => {
    beforeEach(() => {
        jest.resetAllMocks();
        ServicePackage.exists.mockResolvedValue(null);
    });

    it('derives combo duration and resource summary from included services', async () => {
        const washServiceId = new mongoose.Types.ObjectId();
        const careServiceId = new mongoose.Types.ObjectId();
        const comboId = new mongoose.Types.ObjectId();
        const washService = {
            _id: washServiceId,
            name: 'Quick wash',
            vehicle_type: 'CAR',
            service_type: 'WASH',
            duration_minutes: 15,
            requires_wash_bay: true,
            wash_bay_start_offset_minutes: 0,
            wash_bay_duration_minutes: 15,
            requires_care_staff: false,
            is_active: true,
        };
        const careService = {
            _id: careServiceId,
            name: 'Interior care',
            vehicle_type: 'CAR',
            service_type: 'ADDON',
            duration_minutes: 105,
            requires_wash_bay: false,
            requires_care_staff: true,
            care_staff_type: 'VEHICLE_CARE_STAFF',
            care_staff_required_count: 1,
            care_staff_start_offset_minutes: 0,
            care_staff_duration_minutes: 105,
            is_active: true,
        };

        ServicePackage.find.mockResolvedValueOnce([careService, washService]);
        ServicePackage.create.mockResolvedValue({ _id: comboId });
        ServicePackage.findById.mockReturnValue(createPopulateQuery({
            _id: comboId,
            name: 'Quick clean combo',
            vehicle_type: 'CAR',
            service_type: 'COMBO',
            duration_minutes: 120,
            included_service_ids: [washService, careService],
        }));

        await servicePackageService.createServicePackage({
            name: 'Quick clean combo',
            vehicle_type: 'CAR',
            service_type: 'COMBO',
            base_price: 300000,
            included_service_ids: [washServiceId.toString(), careServiceId.toString()],
        });

        expect(ServicePackage.create).toHaveBeenCalledWith(expect.objectContaining({
            duration_minutes: 120,
            requires_wash_bay: true,
            wash_bay_start_offset_minutes: 0,
            wash_bay_duration_minutes: 15,
            requires_care_staff: true,
            care_staff_type: 'VEHICLE_CARE_STAFF',
            care_staff_required_count: 1,
            care_staff_start_offset_minutes: 15,
            care_staff_duration_minutes: 105,
            steps_template: [],
        }));
    });

    it('refreshes parent combo duration when an included service duration changes', async () => {
        const childId = new mongoose.Types.ObjectId();
        const siblingId = new mongoose.Types.ObjectId();
        const comboId = new mongoose.Types.ObjectId();
        const currentChild = {
            _id: childId,
            name: 'Interior care',
            vehicle_type: 'CAR',
            service_type: 'ADDON',
            duration_minutes: 90,
            requires_wash_bay: false,
            requires_care_staff: true,
            care_staff_type: 'VEHICLE_CARE_STAFF',
            care_staff_required_count: 1,
            care_staff_start_offset_minutes: 0,
            care_staff_duration_minutes: 90,
            included_service_ids: [],
            steps_template: [],
        };
        const updatedChild = {
            ...currentChild,
            duration_minutes: 105,
            care_staff_duration_minutes: 105,
        };
        const sibling = {
            _id: siblingId,
            vehicle_type: 'CAR',
            service_type: 'WASH',
            duration_minutes: 15,
            requires_wash_bay: true,
            wash_bay_start_offset_minutes: 0,
            wash_bay_duration_minutes: 15,
            requires_care_staff: false,
        };
        const parentCombo = {
            _id: comboId,
            service_type: 'COMBO',
            included_service_ids: [siblingId, childId],
        };

        ServicePackage.findById.mockReturnValue(createPopulateQuery(currentChild));
        ServicePackage.findByIdAndUpdate.mockReturnValue(createPopulateQuery(updatedChild));
        ServicePackage.find
            .mockResolvedValueOnce([parentCombo])
            .mockResolvedValueOnce([updatedChild, sibling]);
        ServicePackage.updateOne.mockResolvedValue({});

        await servicePackageService.updateServicePackage(childId.toString(), {
            duration_minutes: 105,
            care_staff_duration_minutes: 105,
        });

        expect(ServicePackage.updateOne).toHaveBeenCalledWith(
            { _id: comboId },
            {
                $set: expect.objectContaining({
                    duration_minutes: 120,
                    wash_bay_start_offset_minutes: 0,
                    wash_bay_duration_minutes: 15,
                    care_staff_start_offset_minutes: 15,
                    care_staff_duration_minutes: 105,
                }),
            },
            { runValidators: true }
        );
    });
});
