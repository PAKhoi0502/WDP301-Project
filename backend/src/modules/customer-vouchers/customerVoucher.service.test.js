jest.mock('./customerVoucher.model', () => ({
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn(),
}));
jest.mock('../service-packages/servicePackage.model', () => ({
    findById: jest.fn(),
}));
jest.mock('../users/user.model', () => ({
    findOne: jest.fn(),
}));
jest.mock('../garages/garage.model', () => ({
    findOne: jest.fn(),
}));
jest.mock('../staff-profiles/staffProfile.model', () => ({
    findOne: jest.fn(),
}));
jest.mock('../notifications/notification.service', () => ({
    createInAppNotification: jest.fn(),
}));
jest.mock('../audit-logs/auditLog.service', () => ({
    recordAuditEvent: jest.fn(),
}));

const CustomerVoucher = require('./customerVoucher.model');
const ServicePackage = require('../service-packages/servicePackage.model');
const User = require('../users/user.model');
const Garage = require('../garages/garage.model');
const notificationService = require('../notifications/notification.service');
const auditLogService = require('../audit-logs/auditLog.service');
const customerVoucherService = require('./customerVoucher.service');

describe('customer voucher service', () => {
    const customerId = '507f1f77bcf86cd799439011';
    const garageId = '507f1f77bcf86cd799439012';
    const bookingId = '507f1f77bcf86cd799439013';
    const incidentId = '507f1f77bcf86cd799439014';
    const servicePackageId = '507f1f77bcf86cd799439015';

    beforeEach(() => {
        jest.resetAllMocks();
        process.env.GARAGE_COMPENSATION_STAFF_MAX_AMOUNT = '100000';
        User.findOne.mockResolvedValue({
            _id: customerId,
            role: 'CUSTOMER',
            is_active: true,
        });
        Garage.findOne.mockResolvedValue({
            _id: garageId,
            is_active: true,
        });
    });

    afterAll(() => {
        delete process.env.GARAGE_COMPENSATION_STAFF_MAX_AMOUNT;
    });

    it('calculates a capped percentage discount', async () => {
        const voucher = {
            _id: '507f1f77bcf86cd799439016',
            customer_id: customerId,
            status: 'ISSUED',
            expires_at: new Date('2999-01-01T00:00:00.000Z'),
            voucher_type: 'PERCENTAGE',
            value: 20,
            max_discount_amount: 30000,
            min_order_amount: 0,
        };

        CustomerVoucher.findOne.mockResolvedValue(voucher);

        const result = await customerVoucherService.previewVoucherForBooking({
            customerId,
            code: 'care_test',
            servicePackage: {
                _id: servicePackageId,
                base_price: 200000,
            },
            orderAmount: 200000,
        });

        expect(result.discount_amount).toBe(30000);
        expect(CustomerVoucher.findOne).toHaveBeenCalledWith({
            code: 'CARE_TEST',
            customer_id: customerId,
        });
    });

    it('reserves an issued voucher atomically for a booking', async () => {
        CustomerVoucher.findOneAndUpdate.mockResolvedValue({ status: 'RESERVED' });

        await customerVoucherService.reserveVoucherForBooking({
            voucherId: '507f1f77bcf86cd799439016',
            customerId,
            bookingId,
        });

        expect(CustomerVoucher.findOneAndUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                _id: '507f1f77bcf86cd799439016',
                customer_id: customerId,
                status: 'ISSUED',
            }),
            expect.objectContaining({
                status: 'RESERVED',
                reserved_booking_id: bookingId,
            }),
            { new: true }
        );
    });

    it('does not expire a voucher already reserved by a booking', async () => {
        const voucher = {
            status: 'RESERVED',
            expires_at: new Date('2000-01-01T00:00:00.000Z'),
            save: jest.fn(),
        };

        CustomerVoucher.findOne.mockResolvedValue(voucher);

        await expect(customerVoucherService.previewVoucherForBooking({
            customerId,
            code: 'CARE_TEST',
            servicePackage: {
                _id: servicePackageId,
                base_price: 200000,
            },
            orderAmount: 200000,
        })).rejects.toMatchObject({
            errorCode: 'CUSTOMER_VOUCHER_NOT_AVAILABLE',
        });
        expect(voucher.save).not.toHaveBeenCalled();
        expect(voucher.status).toBe('RESERVED');
    });

    it('requires admin approval when staff exceeds the compensation limit', async () => {
        CustomerVoucher.create.mockImplementation(async ([payload]) => [{
            _id: '507f1f77bcf86cd799439016',
            ...payload,
        }]);

        const voucher = await customerVoucherService.issueCompensationVoucher({
            user: {
                _id: '507f1f77bcf86cd799439017',
                role: 'STAFF',
            },
            customerId,
            garageId,
            bookingId,
            incidentId,
            voucherType: 'FIXED_AMOUNT',
            value: 150000,
            expiresAt: new Date('2999-01-01T00:00:00.000Z'),
        });

        expect(voucher.status).toBe('PENDING_APPROVAL');
        expect(voucher.approved_by_id).toBeNull();
    });

    it('lets an admin issue compensation immediately', async () => {
        CustomerVoucher.create.mockImplementation(async ([payload]) => [{
            _id: '507f1f77bcf86cd799439016',
            ...payload,
        }]);

        const voucher = await customerVoucherService.issueCompensationVoucher({
            user: {
                _id: '507f1f77bcf86cd799439017',
                role: 'ADMIN',
            },
            customerId,
            garageId,
            bookingId,
            incidentId,
            voucherType: 'FIXED_AMOUNT',
            value: 500000,
            expiresAt: new Date('2999-01-01T00:00:00.000Z'),
        });

        expect(voucher.status).toBe('ISSUED');
        expect(voucher.approved_by_id).toBe('507f1f77bcf86cd799439017');
    });

    it('rejects a free service voucher when the service package does not exist', async () => {
        ServicePackage.findById.mockResolvedValue(null);

        await expect(customerVoucherService.issueCompensationVoucher({
            user: {
                _id: '507f1f77bcf86cd799439017',
                role: 'ADMIN',
            },
            customerId,
            garageId,
            bookingId,
            incidentId,
            voucherType: 'FREE_SERVICE',
            value: 0,
            servicePackageId,
            expiresAt: new Date('2999-01-01T00:00:00.000Z'),
        })).rejects.toMatchObject({
            errorCode: 'SERVICE_PACKAGE_NOT_FOUND',
        });
    });

    it('rejects a compensation voucher with an expired date', async () => {
        await expect(customerVoucherService.issueCompensationVoucher({
            user: {
                _id: '507f1f77bcf86cd799439017',
                role: 'ADMIN',
            },
            customerId,
            garageId,
            bookingId,
            incidentId,
            voucherType: 'FIXED_AMOUNT',
            value: 50000,
            expiresAt: new Date('2000-01-01T00:00:00.000Z'),
        })).rejects.toMatchObject({
            errorCode: 'CUSTOMER_VOUCHER_EXPIRATION_INVALID',
        });
        expect(CustomerVoucher.create).not.toHaveBeenCalled();
    });

    it('lets an admin gift a customer-bound voucher directly', async () => {
        CustomerVoucher.create.mockImplementation(async ([payload]) => [{
            _id: '507f1f77bcf86cd799439016',
            ...payload,
        }]);

        const voucher = await customerVoucherService.issueAdminGiftVoucher({
            adminId: '507f1f77bcf86cd799439017',
            payload: {
                customer_id: customerId,
                garage_id: garageId,
                voucher_type: 'FIXED_AMOUNT',
                value: 50000,
                min_order_amount: 100000,
                expires_at: '2999-01-01T00:00:00.000Z',
                note: 'Tri ân khách hàng thân thiết',
            },
            auditContext: {
                ip: '127.0.0.1',
                userAgent: 'jest',
            },
        });

        expect(voucher).toMatchObject({
            customer_id: customerId,
            garage_id: garageId,
            source_type: 'ADMIN_GIFT',
            source_booking_id: null,
            source_incident_id: null,
            status: 'ISSUED',
        });
        expect(auditLogService.recordAuditEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'CUSTOMER_VOUCHER_GIFTED',
                resourceType: 'CUSTOMER_VOUCHER',
            })
        );
        expect(notificationService.createInAppNotification).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: customerId,
                type: 'CUSTOMER_VOUCHER_ISSUED',
                relatedType: 'CUSTOMER_VOUCHER',
            })
        );
    });

    it('rejects gifting a voucher to a locked customer', async () => {
        User.findOne.mockResolvedValue({
            _id: customerId,
            role: 'CUSTOMER',
            is_active: false,
        });

        await expect(customerVoucherService.issueAdminGiftVoucher({
            adminId: '507f1f77bcf86cd799439017',
            payload: {
                customer_id: customerId,
                garage_id: garageId,
                voucher_type: 'FIXED_AMOUNT',
                value: 50000,
                expires_at: '2999-01-01T00:00:00.000Z',
                note: 'Tri ân khách hàng thân thiết',
            },
        })).rejects.toMatchObject({
            errorCode: 'CUSTOMER_VOUCHER_CUSTOMER_INACTIVE',
        });
        expect(CustomerVoucher.create).not.toHaveBeenCalled();
    });
});
