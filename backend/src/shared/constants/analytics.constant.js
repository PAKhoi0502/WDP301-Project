const ANALYTICS_GROUP_BY = Object.freeze({
    DAY: 'DAY',
    WEEK: 'WEEK',
    MONTH: 'MONTH',
});

const ANALYTICS_GROUP_BY_VALUES = Object.freeze(Object.values(ANALYTICS_GROUP_BY));

module.exports = {
    ANALYTICS_GROUP_BY,
    ANALYTICS_GROUP_BY_VALUES,
};
