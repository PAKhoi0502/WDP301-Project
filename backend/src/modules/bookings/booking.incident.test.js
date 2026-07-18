const mongoose = require('mongoose');

jest.mock('./booking.model', () => ({
    findById: jest.fn(),
}));
jest.mock('../booking-incidents/bookingIncident.model', () => ({
    create: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
}));
jest.mock('../staff-profiles/staffProfile.model', () => ({
    find: jest.fn(),
    findOne: jest.fn(),
}));
jest.mock('../wash-bays/washBay.model', () => ({
    findOneAndUpdate: jest.fn(),
    exists: jest.fn(),
}));
jest.mock('../booking-service-steps/bookingServiceStep.service', () => ({
    markResourceReleasedForBookingItem: jest.fn(),
}));
jest.mock('../audit-logs/auditLog.service', () => ({
    recordAuditEvent: jest.fn(),
}));
jest.mock('../notifications/notification.service', () => ({
    createInAppNotification: jest.fn(),
}));
jest.mock('../loyalty/loyalty.service', () => ({
    refundRedeemedPointsForBooking: jest.fn(),
}));
jest.mock('../promotion-usages/promotionUsage.service', () => ({
    releaseReservedPromotionForBooking: jest.fn(),
}));
jest.mock('../customer-vouchers/customerVoucher.service', () => ({
    releaseVoucherForBooking: jest.fn(),
}));
jest.mock('./bookingPayment.service', () => ({}));

const Booking = require('./booking.model');
const BookingIncident = require('../booking-incidents/bookingIncident.model');
const StaffProfile = require('../staff-profiles/staffProfile.model');
const bookingServiceStepService = require('../booking-service-steps/bookingServiceStep.service');
const auditLogService = require('../audit-logs/auditLog.service');
const notificationService = require('../notifications/notification.service');
const loyaltyService = require('../loyalty/loyalty.service');
const bookingService = require('./booking.service');

const createPopulateQuery = (result) => ({
    populate: jest.fn().mockReturnThis(),
    then(resolve, reject) {
        return Promise.resolve(result).then(resolve, reject);
    },
});

const createSessionQuery = (result) => ({
    session: jest.fn().mockResolvedValue(result),
});

describe('booking incident service', () => {
    const bookingId = '507f1f77bcf86cd799439011';
    const incidentId = '507f1f77bcf86cd799439012';
    const customerId = '507f1f77bcf86cd799439013';
    const garageId = '507f1f77bcf86cd799439014';
    let session;
    let startSessionSpy;

    beforeEach(() => {
        jest.resetAllMocks();
        session = {
            withTransaction: jest.fn(async (callback) => callback()),
            endSession: jest.fn(),
        };
        startSessionSpy = jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
        StaffProfile.find.mockReturnValue({
            select: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue([]),
            }),
        });
        auditLogService.recordAuditEvent.mockResolvedValue(null);
        notificationService.createInAppNotification.mockResolvedValue({});
        bookingServiceStepService.markResourceReleasedForBookingItem.mockResolvedValue(null);
        loyaltyService.refundRedeemedPointsForBooking.mockResolvedValue(null);
    });

    afterEach(() => {
        startSessionSpy.mockRestore();
    });

    it('pauses an active countdown and locks the booking when an incident is reported', async () => {
        const bookingItem = {
            item_key: 'ITEM_1',
            sequence: 1,
            status: 'IN_PROGRESS',
            countdown_ends_at: new Date(Date.now() + 60000),
            assigned_care_staff: [],
        };
        const booking = {
            _id: bookingId,
            customer_id: customerId,
            garage_id: garageId,
            service_package_id: '507f1f77bcf86cd799439015',
            vehicle_type: 'CAR',
            status: 'IN_PROGRESS',
            operation_status: 'NORMAL',
            active_incident_id: null,
            start_time: new Date('2999-01-01T06:00:00.000Z'),
            end_time: new Date('2999-01-01T07:00:00.000Z'),
            booking_items: [bookingItem],
            markModified: jest.fn(),
            save: jest.fn().mockResolvedValue(undefined),
        };
        const incident = {
            _id: incidentId,
            incident_type: 'OTHER_GARAGE_INCIDENT',
            created_at: new Date(),
        };

        Booking.findById
            .mockReturnValueOnce(createSessionQuery(booking))
            .mockReturnValueOnce(createPopulateQuery(booking));
        BookingIncident.create.mockResolvedValue([incident]);
        BookingIncident.findById.mockReturnValue(createPopulateQuery(incident));

        const result = await bookingService.reportBookingIncident(
            { _id: '507f1f77bcf86cd799439016', role: 'ADMIN' },
            bookingId,
            {
                incident_type: 'OTHER_GARAGE_INCIDENT',
                description: 'Power failure',
            }
        );

        expect(bookingItem.status).toBe('PAUSED');
        expect(bookingItem.remaining_seconds_at_pause).toBeGreaterThan(0);
        expect(bookingItem.countdown_ends_at).toBeNull();
        expect(booking.operation_status).toBe('AWAITING_CUSTOMER_DECISION');
        expect(booking.active_incident_id).toBe(incidentId);
        expect(booking.save).toHaveBeenCalledWith({ session });
        expect(auditLogService.recordAuditEvent).toHaveBeenCalled();
        expect(result.incident.id).toBe(incidentId);
    });

    it('records customer-approved garage cancellation without a customer violation', async () => {
        const releasedAt = null;
        const booking = {
            _id: bookingId,
            customer_id: customerId,
            garage_id: garageId,
            status: 'IN_PROGRESS',
            operation_status: 'AWAITING_CUSTOMER_DECISION',
            active_incident_id: incidentId,
            payment_status: 'UNPAID',
            wash_bay_id: null,
            is_walk_in: false,
            customer_voucher_id: null,
            booking_items: [
                {
                    item_key: 'ITEM_1',
                    assigned_care_staff: [
                        {
                            staff_profile_id: '507f1f77bcf86cd799439017',
                            released_at: releasedAt,
                        },
                    ],
                },
            ],
            markModified: jest.fn(),
            save: jest.fn().mockResolvedValue(undefined),
        };
        const incident = {
            _id: incidentId,
            status: 'AWAITING_CUSTOMER_DECISION',
            incident_type: 'STAFF_UNAVAILABLE',
            reported_schedule_snapshot: {
                _id: bookingId,
                garage_id: garageId,
            },
            compensation_voucher_ids: [],
            save: jest.fn().mockResolvedValue(undefined),
        };

        Booking.findById
            .mockReturnValueOnce(createSessionQuery(booking))
            .mockReturnValueOnce(createPopulateQuery(booking));
        BookingIncident.findOne.mockReturnValue(createSessionQuery(incident));
        BookingIncident.findById.mockReturnValue(createPopulateQuery(incident));

        const result = await bookingService.resolveMyBookingIncident(
            { _id: customerId, role: 'CUSTOMER' },
            bookingId,
            incidentId,
            {
                decision: 'CANCEL_BY_GARAGE',
                customer_note: 'Please cancel the booking',
            }
        );

        expect(booking.status).toBe('CANCELED');
        expect(booking.cancellation_source).toBe('GARAGE_INCIDENT');
        expect(booking.cancellation_incident_id).toBe(incidentId);
        expect(booking.operation_status).toBe('NORMAL');
        expect(booking.active_incident_id).toBeNull();
        expect(incident.status).toBe('RESOLVED');
        expect(incident.decision_source).toBe('CUSTOMER');
        expect(incident.contact_channel).toBe('APP');
        expect(loyaltyService.refundRedeemedPointsForBooking).toHaveBeenCalledWith(
            expect.objectContaining({ booking, session })
        );
        expect(result.released_booking_snapshot).toEqual(incident.reported_schedule_snapshot);
    });
});
