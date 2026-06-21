const mongoose = require('mongoose');

jest.mock('./washHistory.model', () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    countDocuments: jest.fn(),
    create: jest.fn(),
}));

jest.mock('../staff-profiles/staffProfile.model', () => ({
    findOne: jest.fn(),
}));

const WashHistory = require('./washHistory.model');
const StaffProfile = require('../staff-profiles/staffProfile.model');
const WashHistoryService = require('./washHistory.service');
const WashHistoryMapper = require('./washHistory.mapper');
const {
    idParamSchema,
    getMyWashHistoriesSchema,
    getAdminWashHistoriesSchema,
} = require('./washHistory.validator');

const createQueryMock = (result) => {
    const query = {
        populate: jest.fn(() => query),
        sort: jest.fn(() => query),
        skip: jest.fn(() => query),
        limit: jest.fn(() => Promise.resolve(result)),
        session: jest.fn(() => query),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };

    return query;
};

describe('wash history module', () => {
    const washHistoryId = new mongoose.Types.ObjectId();
    const bookingId = new mongoose.Types.ObjectId();
    const customerId = new mongoose.Types.ObjectId();
    const staffId = new mongoose.Types.ObjectId();
    const vehicleId = new mongoose.Types.ObjectId();
    const garageId = new mongoose.Types.ObjectId();
    const otherGarageId = new mongoose.Types.ObjectId();
    const washBayId = new mongoose.Types.ObjectId();
    const servicePackageId = new mongoose.Types.ObjectId();
    const paidAt = new Date('2026-06-06T10:00:00+07:00');
    const completedAt = new Date('2026-06-06T10:30:00+07:00');

    const washHistoryDocument = {
        _id: washHistoryId,
        booking_id: {
            _id: bookingId,
            booking_date: paidAt,
            start_time: paidAt,
            end_time: completedAt,
            status: 'COMPLETED',
            payment_status: 'PAID',
        },
        customer_id: {
            _id: customerId,
            full_name: 'Nguyen Van A',
            email: 'customer@example.com',
            phone: '0900000000',
            role: 'CUSTOMER',
            is_active: true,
        },
        vehicle_id: {
            _id: vehicleId,
            raw_license_plate: '51G-123.45',
            normalized_license_plate: '51G12345',
            vehicle_type: 'MOTORBIKE',
            engine_type: 'GASOLINE',
            brand: 'Honda',
            model: 'Air Blade',
            color: 'Black',
            is_active: true,
        },
        garage_id: {
            _id: garageId,
            name: 'AutoWash Pro',
            garage_code: 'GAR001',
            address: '123 Nguyen Hue',
            city: 'Ho Chi Minh City',
            is_active: true,
        },
        wash_bay_id: {
            _id: washBayId,
            name: 'Bay 1',
            bay_code: 'BAY001',
            vehicle_type: 'MOTORBIKE',
            status: 'AVAILABLE',
            is_active: true,
        },
        service_package_id: {
            _id: servicePackageId,
            name: 'Basic Wash',
            vehicle_type: 'MOTORBIKE',
            service_type: 'WASH',
            base_price: 50000,
            duration_minutes: 30,
            requires_wash_bay: true,
            is_active: true,
        },
        vehicle_type: 'MOTORBIKE',
        amount_paid: 45000,
        original_price: 50000,
        discount_amount: 5000,
        points_earned: 10,
        points_used: 0,
        payment_method: 'CASH',
        paid_at: paidAt,
        service_started_at: paidAt,
        service_completed_at: completedAt,
        created_at: paidAt,
        updated_at: paidAt,
    };

    beforeEach(() => {
        jest.clearAllMocks();
        StaffProfile.findOne.mockResolvedValue({
            user_id: staffId,
            garage_id: garageId,
            is_active: true,
        });
    });

    it('validates customer wash history query filters', () => {
        const result = getMyWashHistoriesSchema.safeParse({
            query: {
                page: '2',
                limit: '10',
                vehicle_id: vehicleId.toString(),
                garage_id: garageId.toString(),
                service_package_id: servicePackageId.toString(),
                vehicle_type: 'MOTORBIKE',
                from: '2026-06-01T00:00:00+07:00',
                to: '2026-06-30T23:59:59+07:00',
            },
        });

        expect(result.success).toBe(true);
        expect(result.data.query).toMatchObject({
            page: 2,
            limit: 10,
            vehicle_type: 'MOTORBIKE',
        });
    });

    it('rejects invalid date range', () => {
        const result = getAdminWashHistoriesSchema.safeParse({
            query: {
                from: '2026-06-30T23:59:59+07:00',
                to: '2026-06-01T00:00:00+07:00',
            },
        });

        expect(result.success).toBe(false);
        expect(result.error.issues[0].message).toBe('From date must be before or equal to to date');
    });

    it('validates id params', () => {
        const result = idParamSchema.safeParse({
            params: {
                id: washHistoryId.toString(),
            },
        });

        expect(result.success).toBe(true);
    });

    it('maps populated wash history documents', () => {
        const dto = WashHistoryMapper.toWashHistoryDto(washHistoryDocument);

        expect(dto).toMatchObject({
            id: washHistoryId.toString(),
            booking_id: bookingId.toString(),
            customer_id: customerId.toString(),
            vehicle_id: vehicleId.toString(),
            garage_id: garageId.toString(),
            wash_bay_id: washBayId.toString(),
            service_package_id: servicePackageId.toString(),
            customer: {
                full_name: 'Nguyen Van A',
            },
            vehicle: {
                normalized_license_plate: '51G12345',
            },
            garage: {
                garage_code: 'GAR001',
            },
            service_package: {
                name: 'Basic Wash',
            },
        });
    });

    it('gets current customer wash histories with filters and pagination', async () => {
        const query = createQueryMock([washHistoryDocument]);

        WashHistory.find.mockReturnValue(query);
        WashHistory.countDocuments.mockResolvedValue(1);

        const result = await WashHistoryService.getMyWashHistories(customerId, {
            page: 2,
            limit: 5,
            garage_id: garageId.toString(),
            from: '2026-06-01T00:00:00+07:00',
            to: '2026-06-30T23:59:59+07:00',
        });

        expect(WashHistory.find).toHaveBeenCalledWith({
            customer_id: customerId,
            garage_id: garageId.toString(),
            paid_at: {
                $gte: expect.any(Date),
                $lte: expect.any(Date),
            },
        });
        expect(query.sort).toHaveBeenCalledWith({ paid_at: -1, created_at: -1 });
        expect(query.skip).toHaveBeenCalledWith(5);
        expect(query.limit).toHaveBeenCalledWith(5);
        expect(result.meta).toMatchObject({
            page: 2,
            limit: 5,
            total: 1,
            total_pages: 1,
        });
        expect(result.data[0].id).toBe(washHistoryId.toString());
    });

    it('gets customer-owned wash history detail', async () => {
        const query = createQueryMock(washHistoryDocument);

        WashHistory.findOne.mockReturnValue(query);

        const result = await WashHistoryService.getMyWashHistoryById(customerId, washHistoryId);

        expect(WashHistory.findOne).toHaveBeenCalledWith({
            _id: washHistoryId,
            customer_id: customerId,
        });
        expect(result.id).toBe(washHistoryId.toString());
    });

    it('gets staff wash histories scoped to assigned garage', async () => {
        const query = createQueryMock([washHistoryDocument]);

        WashHistory.find.mockReturnValue(query);
        WashHistory.countDocuments.mockResolvedValue(1);

        const result = await WashHistoryService.getAllWashHistories(
            { _id: staffId, role: 'STAFF' },
            {
                page: 1,
                limit: 20,
                garage_id: garageId.toString(),
                vehicle_type: 'MOTORBIKE',
            }
        );

        expect(StaffProfile.findOne).toHaveBeenCalledWith({
            user_id: staffId,
            is_active: true,
        });
        expect(WashHistory.find).toHaveBeenCalledWith({
            garage_id: garageId,
            vehicle_type: 'MOTORBIKE',
        });
        expect(WashHistory.countDocuments).toHaveBeenCalledWith({
            garage_id: garageId,
            vehicle_type: 'MOTORBIKE',
        });
        expect(result.data[0].id).toBe(washHistoryId.toString());
    });

    it('rejects staff wash history list outside assigned garage', async () => {
        await expect(
            WashHistoryService.getAllWashHistories(
                { _id: staffId, role: 'STAFF' },
                {
                    garage_id: otherGarageId.toString(),
                }
            )
        ).rejects.toMatchObject({
            statusCode: 403,
            errorCode: 'STAFF_GARAGE_ACCESS_DENIED',
        });
    });

    it('gets staff wash history detail only in assigned garage', async () => {
        const query = createQueryMock(washHistoryDocument);

        WashHistory.findOne.mockReturnValue(query);

        const result = await WashHistoryService.getWashHistoryById(
            { _id: staffId, role: 'STAFF' },
            washHistoryId
        );

        expect(WashHistory.findOne).toHaveBeenCalledWith({
            _id: washHistoryId,
            garage_id: garageId,
        });
        expect(result.id).toBe(washHistoryId.toString());
    });

    it('rejects staff wash histories when staff has no assigned garage', async () => {
        StaffProfile.findOne.mockResolvedValueOnce({
            user_id: staffId,
            garage_id: null,
            is_active: true,
        });

        await expect(
            WashHistoryService.getAllWashHistories(
                { _id: staffId, role: 'STAFF' },
                {}
            )
        ).rejects.toMatchObject({
            statusCode: 403,
            errorCode: 'STAFF_GARAGE_NOT_ASSIGNED',
        });
    });

    it('throws when customer wash history is not found', async () => {
        WashHistory.findOne.mockReturnValue(createQueryMock(null));

        await expect(WashHistoryService.getMyWashHistoryById(customerId, washHistoryId)).rejects.toMatchObject({
            statusCode: 404,
            errorCode: 'WASH_HISTORY_NOT_FOUND',
        });
    });
});
