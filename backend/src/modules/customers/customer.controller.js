const customerService = require('./customer.service');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess } = require('../../shared/utils/apiResponse');

const searchAdminCustomers = asyncHandler(async (req, res) => {
    const { query } = req.validated;

    const result = await customerService.searchAdminCustomers(req.user, query);

    return sendSuccess(res, {
        message: 'Get customers successfully',
        data: result.data,
        meta: result.meta,
    });
});

module.exports = {
    searchAdminCustomers,
};
