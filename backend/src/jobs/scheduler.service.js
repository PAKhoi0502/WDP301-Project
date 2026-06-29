const bookingWaitlistService = require('../modules/booking-waitlists/bookingWaitlist.service');
const notificationService = require('../modules/notifications/notification.service');
const loyaltyService = require('../modules/loyalty/loyalty.service');

const JOB_NAMES = Object.freeze({
    WAITLIST_EXPIRE: 'waitlist-expire',
    EMAIL_RETRY: 'email-retry',
    POINT_EXPIRATION: 'point-expiration',
    TIER_INACTIVITY_DOWNGRADE: 'tier-inactivity-downgrade',
});

const DEFAULT_INTERVALS = Object.freeze({
    WAITLIST_EXPIRE_JOB_INTERVAL_MS: 60 * 1000,
    EMAIL_RETRY_JOB_INTERVAL_MS: 5 * 60 * 1000,
    POINT_EXPIRATION_JOB_INTERVAL_MS: 24 * 60 * 60 * 1000,
    TIER_INACTIVITY_DOWNGRADE_JOB_INTERVAL_MS: 24 * 60 * 60 * 1000,
});

let activeJobs = [];

const parseBoolean = (value) => {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    return ['true', '1', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

const isSchedulerEnabled = () => {
    const explicitValue = parseBoolean(process.env.SCHEDULER_ENABLED);

    if (explicitValue !== null) {
        return explicitValue;
    }

    return process.env.NODE_ENV !== 'test';
};

const getPositiveIntegerEnv = (name, fallback, max = Number.MAX_SAFE_INTEGER) => {
    const value = Number(process.env[name]);

    if (!Number.isInteger(value) || value < 1) {
        return fallback;
    }

    return Math.min(value, max);
};

const buildJobDefinitions = () => [
    {
        name: JOB_NAMES.WAITLIST_EXPIRE,
        intervalMs: getPositiveIntegerEnv(
            'WAITLIST_EXPIRE_JOB_INTERVAL_MS',
            DEFAULT_INTERVALS.WAITLIST_EXPIRE_JOB_INTERVAL_MS,
            2147483647
        ),
        handler: () => bookingWaitlistService.expireExpiredOffers({
            limit: getPositiveIntegerEnv('WAITLIST_EXPIRE_BATCH_SIZE', 50, 200),
        }),
    },
    {
        name: JOB_NAMES.EMAIL_RETRY,
        intervalMs: getPositiveIntegerEnv(
            'EMAIL_RETRY_JOB_INTERVAL_MS',
            DEFAULT_INTERVALS.EMAIL_RETRY_JOB_INTERVAL_MS,
            2147483647
        ),
        handler: () => notificationService.retryEmailNotifications({
            limit: getPositiveIntegerEnv('EMAIL_RETRY_BATCH_SIZE', 50, 100),
        }),
    },
    {
        name: JOB_NAMES.POINT_EXPIRATION,
        intervalMs: getPositiveIntegerEnv(
            'POINT_EXPIRATION_JOB_INTERVAL_MS',
            DEFAULT_INTERVALS.POINT_EXPIRATION_JOB_INTERVAL_MS,
            2147483647
        ),
        handler: () => loyaltyService.expireDuePoints(),
    },
    {
        name: JOB_NAMES.TIER_INACTIVITY_DOWNGRADE,
        intervalMs: getPositiveIntegerEnv(
            'TIER_INACTIVITY_DOWNGRADE_JOB_INTERVAL_MS',
            DEFAULT_INTERVALS.TIER_INACTIVITY_DOWNGRADE_JOB_INTERVAL_MS,
            2147483647
        ),
        handler: () => loyaltyService.downgradeInactiveCustomerTiers({
            limit: getPositiveIntegerEnv('TIER_INACTIVITY_DOWNGRADE_BATCH_SIZE', 50, 200),
        }),
    },
];

const runJob = async (job) => {
    if (job.isRunning) {
        return {
            skipped: true,
            reason: 'JOB_ALREADY_RUNNING',
        };
    }

    job.isRunning = true;

    try {
        const result = await job.handler();

        console.log(`[scheduler] ${job.name} completed`, result);

        return result;
    } catch (error) {
        console.error(`[scheduler] ${job.name} failed:`, error.message);

        return {
            failed: true,
            error: error.message,
        };
    } finally {
        job.isRunning = false;
    }
};

const startSchedulers = ({ runImmediately = true } = {}) => {
    if (!isSchedulerEnabled()) {
        return {
            started: false,
            reason: 'SCHEDULER_DISABLED',
            jobs: [],
        };
    }

    if (activeJobs.length > 0) {
        return {
            started: false,
            reason: 'SCHEDULER_ALREADY_STARTED',
            jobs: activeJobs.map((job) => ({
                name: job.name,
                interval_ms: job.intervalMs,
            })),
        };
    }

    activeJobs = buildJobDefinitions().map((definition) => {
        const job = {
            ...definition,
            isRunning: false,
            timer: null,
        };

        job.timer = setInterval(() => {
            runJob(job);
        }, job.intervalMs);

        if (job.timer.unref) {
            job.timer.unref();
        }

        if (runImmediately) {
            Promise.resolve().then(() => runJob(job));
        }

        return job;
    });

    return {
        started: true,
        jobs: activeJobs.map((job) => ({
            name: job.name,
            interval_ms: job.intervalMs,
        })),
    };
};

const stopSchedulers = () => {
    const stoppedJobs = activeJobs.map((job) => job.name);

    activeJobs.forEach((job) => {
        if (job.timer) {
            clearInterval(job.timer);
        }
    });

    activeJobs = [];

    return {
        stopped: stoppedJobs.length,
        jobs: stoppedJobs,
    };
};

const runSchedulerJobNow = async (jobName) => {
    const job = activeJobs.find((item) => item.name === jobName)
        || buildJobDefinitions().find((item) => item.name === jobName);

    if (!job) {
        throw new Error(`Unknown scheduler job: ${jobName}`);
    }

    return runJob({
        ...job,
        isRunning: false,
    });
};

module.exports = {
    JOB_NAMES,
    startSchedulers,
    stopSchedulers,
    runSchedulerJobNow,
};
