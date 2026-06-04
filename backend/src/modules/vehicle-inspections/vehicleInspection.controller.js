const vehicleInspectionService = require('./vehicleInspection.service');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../../shared/utils/apiResponse');

const createInspection = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { body } = req.validated;

    const result = await vehicleInspectionService.createInspection(req.user, id, body);

    return sendCreated(res, {
        message: 'Create vehicle inspection successfully',
        data: result,
    });
});

const getAdminBookingInspections = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await vehicleInspectionService.getAdminBookingInspections(req.user, id);

    return sendSuccess(res, {
        message: 'Get vehicle inspections successfully',
        data: result,
    });
});

const getMyBookingInspections = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await vehicleInspectionService.getMyBookingInspections(req.user._id, id);

    return sendSuccess(res, {
        message: 'Get vehicle inspections successfully',
        data: result,
    });
});

module.exports = {
    createInspection,
    getAdminBookingInspections,
    getMyBookingInspections,
};
