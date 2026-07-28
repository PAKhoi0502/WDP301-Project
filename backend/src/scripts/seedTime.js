const parseTimezoneOffsetMinutes = (value = '+07:00') => {
    const match = /^([+-])(\d{2}):(\d{2})$/.exec(value);

    if (!match) {
        throw new Error(`Invalid APP_TIMEZONE_OFFSET: ${value}`);
    }

    const hours = Number(match[2]);
    const minutes = Number(match[3]);

    if (hours > 23 || minutes > 59) {
        throw new Error(`Invalid APP_TIMEZONE_OFFSET: ${value}`);
    }

    const total = hours * 60 + minutes;

    return match[1] === '-' ? -total : total;
};

const toLocalNoon = (date, timezoneOffsetMinutes) => {
    const shifted = new Date(date.getTime() + timezoneOffsetMinutes * 60000);

    return new Date(
        Date.UTC(
            shifted.getUTCFullYear(),
            shifted.getUTCMonth(),
            shifted.getUTCDate(),
            12,
            0,
            0,
            0
        ) - timezoneOffsetMinutes * 60000
    );
};

const getSeedReferenceDate = ({
    value = process.env.SEED_REFERENCE_DATE,
    now = new Date(),
    timezoneOffset = process.env.APP_TIMEZONE_OFFSET || '+07:00',
} = {}) => {
    const timezoneOffsetMinutes = parseTimezoneOffsetMinutes(timezoneOffset);
    let sourceDate = now;

    if (value) {
        const normalizedValue = /^\d{4}-\d{2}-\d{2}$/.test(value)
            ? `${value}T12:00:00${timezoneOffset}`
            : value;

        sourceDate = new Date(normalizedValue);

        if (Number.isNaN(sourceDate.getTime())) {
            throw new Error(`Invalid SEED_REFERENCE_DATE: ${value}`);
        }
    }

    return toLocalNoon(sourceDate, timezoneOffsetMinutes);
};

const atLocalDayAndMinute = ({
    referenceDate,
    dayOffset = 0,
    minuteOfDay = 12 * 60,
}) => {
    if (!(referenceDate instanceof Date) || Number.isNaN(referenceDate.getTime())) {
        throw new Error('Seed reference date is invalid');
    }

    if (!Number.isInteger(dayOffset)) {
        throw new Error('Seed day offset must be an integer');
    }

    if (!Number.isInteger(minuteOfDay) || minuteOfDay < 0 || minuteOfDay >= 1440) {
        throw new Error('Seed minute of day must be between 0 and 1439');
    }

    return new Date(
        referenceDate.getTime()
        + dayOffset * 86400000
        + (minuteOfDay - 12 * 60) * 60000
    );
};

module.exports = {
    parseTimezoneOffsetMinutes,
    getSeedReferenceDate,
    atLocalDayAndMinute,
};
