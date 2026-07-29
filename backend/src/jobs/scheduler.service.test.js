jest.mock('../modules/booking-waitlists/bookingWaitlist.service', () => ({
    expireExpiredOffers: jest.fn(),
}));

jest.mock('../modules/notifications/notification.service', () => ({
    retryEmailNotifications: jest.fn(),
}));

jest.mock('../modules/loyalty/loyalty.service', () => ({
    expireDuePoints: jest.fn(),
    downgradeInactiveCustomerTiers: jest.fn(),
}));

jest.mock('../modules/bookings/booking.service', () => ({
    processDueServiceItemTimers: jest.fn(),
}));

jest.mock('../modules/payments/payment.service', () => ({
    expireDuePayosPayments: jest.fn(),
}));

jest.mock('../modules/staff-profiles/staffTypeChange.service', () => ({
    processDueStaffTypeChanges: jest.fn(),
}));

jest.mock('../modules/customer-cases/customerCaseStage2.service', () => ({
    processDueSlaEscalations: jest.fn(),
}));

jest.mock('../modules/booking-arrivals/bookingArrival.service', () => ({
    purgeExpiredImages: jest.fn(),
    expirePendingScans: jest.fn(),
}));

jest.mock('../modules/feedback-rewards/feedbackReward.service', () => ({
    sendDueReminders: jest.fn(),
}));

jest.mock('../modules/booking-violations/bookingViolation.service', () => ({
    processInactivityRecovery: jest.fn(),
}));

const bookingWaitlistService = require('../modules/booking-waitlists/bookingWaitlist.service');
const notificationService = require('../modules/notifications/notification.service');
const loyaltyService = require('../modules/loyalty/loyalty.service');
const bookingService = require('../modules/bookings/booking.service');
const paymentService = require('../modules/payments/payment.service');
const staffTypeChangeService = require('../modules/staff-profiles/staffTypeChange.service');
const customerCaseStage2Service = require('../modules/customer-cases/customerCaseStage2.service');
const bookingArrivalService = require('../modules/booking-arrivals/bookingArrival.service');
const bookingViolationService = require('../modules/booking-violations/bookingViolation.service');
const schedulerService = require('./scheduler.service');

describe('scheduler service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        delete process.env.SCHEDULER_ENABLED;
        delete process.env.WAITLIST_EXPIRE_BATCH_SIZE;
        delete process.env.EMAIL_RETRY_BATCH_SIZE;
        delete process.env.TIER_INACTIVITY_DOWNGRADE_BATCH_SIZE;
        delete process.env.SERVICE_ITEM_TIMER_BATCH_SIZE;
        delete process.env.PAYMENT_EXPIRE_BATCH_SIZE;
        delete process.env.STAFF_TYPE_CHANGE_BATCH_SIZE;
        delete process.env.CUSTOMER_CASE_SLA_BATCH_SIZE;
        delete process.env.PLATE_SCAN_RETENTION_BATCH_SIZE;
        delete process.env.PLATE_SCAN_EXPIRE_BATCH_SIZE;
        delete process.env.BOOKING_VIOLATION_RECOVERY_BATCH_SIZE;
    });

    afterEach(() => {
        schedulerService.stopSchedulers();
        console.log.mockRestore();
        console.error.mockRestore();
    });

    it('does not start schedulers by default during tests', () => {
        const result = schedulerService.startSchedulers();

        expect(result).toEqual({
            started: false,
            reason: 'SCHEDULER_DISABLED',
            jobs: [],
        });
    });

    it('starts configured jobs when explicitly enabled', () => {
        process.env.SCHEDULER_ENABLED = 'true';

        const result = schedulerService.startSchedulers({ runImmediately: false });

        expect(result.started).toBe(true);
        expect(result.jobs).toEqual(expect.arrayContaining([
            expect.objectContaining({ name: schedulerService.JOB_NAMES.WAITLIST_EXPIRE }),
            expect.objectContaining({ name: schedulerService.JOB_NAMES.EMAIL_RETRY }),
            expect.objectContaining({ name: schedulerService.JOB_NAMES.POINT_EXPIRATION }),
            expect.objectContaining({ name: schedulerService.JOB_NAMES.TIER_INACTIVITY_DOWNGRADE }),
            expect.objectContaining({ name: schedulerService.JOB_NAMES.SERVICE_ITEM_TIMER }),
            expect.objectContaining({ name: schedulerService.JOB_NAMES.PAYMENT_EXPIRE }),
            expect.objectContaining({ name: schedulerService.JOB_NAMES.STAFF_TYPE_CHANGE }),
            expect.objectContaining({ name: schedulerService.JOB_NAMES.CUSTOMER_CASE_SLA }),
            expect.objectContaining({ name: schedulerService.JOB_NAMES.PLATE_SCAN_RETENTION }),
            expect.objectContaining({ name: schedulerService.JOB_NAMES.PLATE_SCAN_EXPIRE }),
            expect.objectContaining({ name: schedulerService.JOB_NAMES.BOOKING_VIOLATION_RECOVERY }),
        ]));
    });

    it('runs waitlist expire job on demand', async () => {
        process.env.WAITLIST_EXPIRE_BATCH_SIZE = '25';
        bookingWaitlistService.expireExpiredOffers.mockResolvedValue({ expired: 2 });

        const result = await schedulerService.runSchedulerJobNow(schedulerService.JOB_NAMES.WAITLIST_EXPIRE);

        expect(bookingWaitlistService.expireExpiredOffers).toHaveBeenCalledWith({ limit: 25 });
        expect(result).toEqual({ expired: 2 });
    });

    it('runs email retry job on demand', async () => {
        process.env.EMAIL_RETRY_BATCH_SIZE = '20';
        notificationService.retryEmailNotifications.mockResolvedValue({ attempted: 3, sent: 2, failed: 1 });

        const result = await schedulerService.runSchedulerJobNow(schedulerService.JOB_NAMES.EMAIL_RETRY);

        expect(notificationService.retryEmailNotifications).toHaveBeenCalledWith({ limit: 20 });
        expect(result).toEqual({ attempted: 3, sent: 2, failed: 1 });
    });

    it('runs point expiration job on demand', async () => {
        loyaltyService.expireDuePoints.mockResolvedValue({ expired_points: 10 });

        const result = await schedulerService.runSchedulerJobNow(schedulerService.JOB_NAMES.POINT_EXPIRATION);

        expect(loyaltyService.expireDuePoints).toHaveBeenCalledWith();
        expect(result).toEqual({ expired_points: 10 });
    });

    it('runs tier inactivity downgrade job on demand', async () => {
        process.env.TIER_INACTIVITY_DOWNGRADE_BATCH_SIZE = '30';
        loyaltyService.downgradeInactiveCustomerTiers.mockResolvedValue({ downgraded_customers: 1 });

        const result = await schedulerService.runSchedulerJobNow(schedulerService.JOB_NAMES.TIER_INACTIVITY_DOWNGRADE);

        expect(loyaltyService.downgradeInactiveCustomerTiers).toHaveBeenCalledWith({ limit: 30 });
        expect(result).toEqual({ downgraded_customers: 1 });
    });

    it('runs service item timer job on demand', async () => {
        process.env.SERVICE_ITEM_TIMER_BATCH_SIZE = '10';
        bookingService.processDueServiceItemTimers.mockResolvedValue({
            processed: 2,
            auto_completed: 1,
            awaiting_confirmation: 1,
            failed: 0,
        });

        const result = await schedulerService.runSchedulerJobNow(schedulerService.JOB_NAMES.SERVICE_ITEM_TIMER);

        expect(bookingService.processDueServiceItemTimers).toHaveBeenCalledWith({ limit: 10 });
        expect(result).toEqual({
            processed: 2,
            auto_completed: 1,
            awaiting_confirmation: 1,
            failed: 0,
        });
    });

    it('runs payment expiration job on demand', async () => {
        process.env.PAYMENT_EXPIRE_BATCH_SIZE = '15';
        paymentService.expireDuePayosPayments.mockResolvedValue({
            processed: 2,
            expired: 2,
            failed: 0,
        });

        const result = await schedulerService.runSchedulerJobNow(
            schedulerService.JOB_NAMES.PAYMENT_EXPIRE
        );

        expect(paymentService.expireDuePayosPayments).toHaveBeenCalledWith({ limit: 15 });
        expect(result).toEqual({
            processed: 2,
            expired: 2,
            failed: 0,
        });
    });

    it('runs due staff type changes on demand', async () => {
        process.env.STAFF_TYPE_CHANGE_BATCH_SIZE = '15';
        staffTypeChangeService.processDueStaffTypeChanges.mockResolvedValue({
            processed: 1,
            applied: 1,
            deferred: 0,
            failed: 0,
        });

        const result = await schedulerService.runSchedulerJobNow(
            schedulerService.JOB_NAMES.STAFF_TYPE_CHANGE
        );

        expect(staffTypeChangeService.processDueStaffTypeChanges).toHaveBeenCalledWith({ limit: 15 });
        expect(result.applied).toBe(1);
    });

    it('runs customer case SLA escalation on demand', async () => {
        process.env.CUSTOMER_CASE_SLA_BATCH_SIZE = '12';
        customerCaseStage2Service.processDueSlaEscalations.mockResolvedValue({ processed: 2, escalated: 2 });

        const result = await schedulerService.runSchedulerJobNow(
            schedulerService.JOB_NAMES.CUSTOMER_CASE_SLA
        );

        expect(customerCaseStage2Service.processDueSlaEscalations).toHaveBeenCalledWith({ limit: 12 });
        expect(result).toEqual({ processed: 2, escalated: 2 });
    });

    it('runs plate scan image retention on demand', async () => {
        process.env.PLATE_SCAN_RETENTION_BATCH_SIZE = '18';
        bookingArrivalService.purgeExpiredImages.mockResolvedValue({ scanned: 3, purged: 3, failed: 0 });

        const result = await schedulerService.runSchedulerJobNow(
            schedulerService.JOB_NAMES.PLATE_SCAN_RETENTION
        );

        expect(bookingArrivalService.purgeExpiredImages).toHaveBeenCalledWith({ limit: 18 });
        expect(result).toEqual({ scanned: 3, purged: 3, failed: 0 });
    });

    it('expires unresolved scans on demand', async () => {
        process.env.PLATE_SCAN_EXPIRE_BATCH_SIZE = '21';
        bookingArrivalService.expirePendingScans.mockResolvedValue({ processed: 2, expired: 2 });

        const result = await schedulerService.runSchedulerJobNow(
            schedulerService.JOB_NAMES.PLATE_SCAN_EXPIRE
        );

        expect(bookingArrivalService.expirePendingScans).toHaveBeenCalledWith({ limit: 21 });
        expect(result).toEqual({ processed: 2, expired: 2 });
    });
});
