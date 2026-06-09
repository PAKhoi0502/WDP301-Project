jest.mock('../modules/booking-waitlists/bookingWaitlist.service', () => ({
    expireExpiredOffers: jest.fn(),
}));

jest.mock('../modules/notifications/notification.service', () => ({
    retryEmailNotifications: jest.fn(),
}));

jest.mock('../modules/loyalty/loyalty.service', () => ({
    expireDuePoints: jest.fn(),
}));

const bookingWaitlistService = require('../modules/booking-waitlists/bookingWaitlist.service');
const notificationService = require('../modules/notifications/notification.service');
const loyaltyService = require('../modules/loyalty/loyalty.service');
const schedulerService = require('./scheduler.service');

describe('scheduler service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        delete process.env.SCHEDULER_ENABLED;
        delete process.env.WAITLIST_EXPIRE_BATCH_SIZE;
        delete process.env.EMAIL_RETRY_BATCH_SIZE;
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
});
