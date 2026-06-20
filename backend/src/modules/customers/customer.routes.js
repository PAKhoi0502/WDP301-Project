const express = require('express');

const customerController = require('./customer.controller');
const { searchAdminCustomersSchema } = require('./customer.validator');
const { validate } = require('../../shared/middlewares/validate.middleware');
const { authenticate, authorize } = require('../../shared/middlewares/auth.middleware');
const { USER_ROLES } = require('../../shared/constants/roles.constant');

const adminRouter = express.Router();

adminRouter.use(authenticate, authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN));

adminRouter.get(
    '/',
    validate(searchAdminCustomersSchema),
    customerController.searchAdminCustomers
);

module.exports = {
    adminRouter,
};
