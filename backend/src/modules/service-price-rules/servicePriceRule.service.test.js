jest.mock('./servicePriceRule.model', () => ({
    find: jest.fn(),
    exists: jest.fn(),
}));
jest.mock('./priceQuote.model', () => ({
    create: jest.fn(),
}));
jest.mock('../service-packages/servicePackage.model', () => ({
    findOne: jest.fn(),
    find: jest.fn(),
}));
jest.mock('../garages/garage.model', () => ({
    findOne: jest.fn(),
}));
jest.mock('../vehicles/vehicle.model', () => ({
    findOne: jest.fn(),
}));
jest.mock('../staff-profiles/staffProfile.model', () => ({
    findOne: jest.fn(),
}));
jest.mock('../audit-logs/auditLog.service', () => ({
    recordAuditEvent: jest.fn(),
}));

const ServicePriceRule = require('./servicePriceRule.model');
const PriceQuote = require('./priceQuote.model');
const ServicePackage = require('../service-packages/servicePackage.model');
const Garage = require('../garages/garage.model');
const Vehicle = require('../vehicles/vehicle.model');
const servicePriceRuleService = require('./servicePriceRule.service');

const servicePackage = {
    _id: '507f1f77bcf86cd799439011',
    base_price: 100000,
    duration_minutes: 30,
    wash_bay_duration_minutes: 30,
    care_staff_duration_minutes: 0,
};

const sedanFiveSeat = {
    vehicle_type: 'CAR',
    engine_type: 'GASOLINE',
    motorbike_cc_group: null,
    car_body_type: 'SEDAN',
    seat_count: 5,
};

const mockRules = (rules, hasConfiguredRules = true) => {
    ServicePriceRule.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue(rules),
    });
    ServicePriceRule.exists.mockResolvedValue(hasConfiguredRules);
};

describe('service price rule resolution', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('uses a matching garage override before global rules', async () => {
        mockRules([
            {
                _id: '507f1f77bcf86cd799439021',
                garage_id: null,
                vehicle_type: 'CAR',
                engine_type: 'GASOLINE',
                car_body_type: 'SEDAN',
                seat_min: 2,
                seat_max: 5,
                price: 140000,
                version: 2,
            },
            {
                _id: '507f1f77bcf86cd799439022',
                garage_id: '507f1f77bcf86cd799439099',
                vehicle_type: 'CAR',
                engine_type: null,
                car_body_type: null,
                seat_min: null,
                seat_max: null,
                price: 125000,
                version: 1,
            },
        ]);

        const result = await servicePriceRuleService.resolveRule({
            servicePackage,
            garageId: '507f1f77bcf86cd799439099',
            vehicleSnapshot: sedanFiveSeat,
        });

        expect(result.price).toBe(125000);
        expect(result.rule._id).toBe('507f1f77bcf86cd799439022');
    });

    it('selects the most specific rule inside the chosen scope', async () => {
        mockRules([
            {
                _id: '507f1f77bcf86cd799439021',
                garage_id: null,
                vehicle_type: 'CAR',
                engine_type: null,
                car_body_type: null,
                seat_min: null,
                seat_max: null,
                price: 100000,
                version: 1,
            },
            {
                _id: '507f1f77bcf86cd799439022',
                garage_id: null,
                vehicle_type: 'CAR',
                engine_type: 'GASOLINE',
                car_body_type: 'SEDAN',
                seat_min: 2,
                seat_max: 5,
                price: 140000,
                version: 3,
            },
        ]);

        const result = await servicePriceRuleService.resolveRule({
            servicePackage,
            garageId: '507f1f77bcf86cd799439099',
            vehicleSnapshot: sedanFiveSeat,
        });

        expect(result.price).toBe(140000);
        expect(result.rule.version).toBe(3);
    });

    it('blocks booking when configured rules do not match', async () => {
        mockRules([], true);

        await expect(servicePriceRuleService.resolveRule({
            servicePackage,
            garageId: '507f1f77bcf86cd799439099',
            vehicleSnapshot: sedanFiveSeat,
        })).rejects.toMatchObject({
            statusCode: 409,
            errorCode: 'PRICE_RULE_NOT_FOUND',
        });
    });

    it('preserves legacy base price only before a package has any rule', async () => {
        mockRules([], false);

        const result = await servicePriceRuleService.resolveRule({
            servicePackage,
            garageId: '507f1f77bcf86cd799439099',
            vehicleSnapshot: sedanFiveSeat,
        });

        expect(result.legacy).toBe(true);
        expect(result.price).toBe(100000);
        expect(result.duration_minutes).toBe(30);
    });

    it('rejects incomplete car classification before resolving a price', async () => {
        await expect(servicePriceRuleService.resolveRule({
            servicePackage,
            garageId: '507f1f77bcf86cd799439099',
            vehicleSnapshot: {
                ...sedanFiveSeat,
                seat_count: null,
            },
        })).rejects.toMatchObject({
            statusCode: 400,
            errorCode: 'VEHICLE_CLASSIFICATION_REQUIRED',
        });

        expect(ServicePriceRule.find).not.toHaveBeenCalled();
    });

    it('creates a quote at the requested effective time', async () => {
        const effectiveAt = '2026-08-01T09:00:00+07:00';
        const garage = {
            _id: '507f1f77bcf86cd799439099',
            is_active: true,
        };
        const vehicle = {
            _id: '507f1f77bcf86cd799439088',
            customer_id: '507f1f77bcf86cd799439077',
            is_active: true,
            ...sedanFiveSeat,
        };
        Garage.findOne.mockResolvedValue(garage);
        ServicePackage.findOne.mockResolvedValue({
            ...servicePackage,
            name: 'Sedan wash',
            vehicle_type: 'CAR',
        });
        ServicePackage.find.mockResolvedValue([]);
        Vehicle.findOne.mockResolvedValue(vehicle);
        mockRules([
            {
                _id: '507f1f77bcf86cd799439022',
                garage_id: null,
                vehicle_type: 'CAR',
                engine_type: 'GASOLINE',
                car_body_type: 'SEDAN',
                seat_min: 2,
                seat_max: 5,
                price: 140000,
                version: 3,
            },
        ]);
        PriceQuote.create.mockImplementation(async (payload) => ({
            _id: '507f1f77bcf86cd799439066',
            ...payload,
        }));

        const result = await servicePriceRuleService.createQuote({
            customerId: vehicle.customer_id,
            garageId: garage._id,
            vehicleId: vehicle._id,
            servicePackageId: servicePackage._id,
            effectiveAt,
        });

        expect(PriceQuote.create).toHaveBeenCalledWith(expect.objectContaining({
            effective_at: effectiveAt,
            subtotal: 140000,
        }));
        expect(result).toMatchObject({
            id: '507f1f77bcf86cd799439066',
            subtotal: 140000,
            effective_at: effectiveAt,
        });
    });
});
