const USER_ROLES = Object.freeze({
    CUSTOMER: 'CUSTOMER',
    STAFF: 'STAFF',
    ADMIN: 'ADMIN',
});

const USER_ROLE_VALUES = Object.freeze(Object.values(USER_ROLES));

const isValidUserRole = (role) => USER_ROLE_VALUES.includes(role);

module.exports = {
    USER_ROLES,
    USER_ROLE_VALUES,
    isValidUserRole,
};