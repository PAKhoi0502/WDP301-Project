const vehicleService = require('./vehicle.service');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../../shared/utils/apiResponse');

const getMyVehicles = asyncHandler(async (req, res) => {
    const { query } = req.validated;

    const result = await vehicleService.getMyVehicles(req.user._id, query);

    return sendSuccess(res, {
        message: 'Get vehicles successfully',
        data: result.data,
        meta: result.meta,
    });
});

const getAllVehicles = asyncHandler(async (req, res) => {
    const { query } = req.validated;

    const result = await vehicleService.getAllVehicles(query);

    return sendSuccess(res, {
        message: 'Get vehicles successfully',
        data: result.data,
        meta: result.meta,
    });
});

const getMyVehicleById = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await vehicleService.getMyVehicleById(req.user._id, id);

    return sendSuccess(res, {
        message: 'Get vehicle successfully',
        data: result,
    });
});

const getVehicleById = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await vehicleService.getVehicleById(id);

    return sendSuccess(res, {
        message: 'Get vehicle successfully',
        data: result,
    });
});

const createMyVehicle = asyncHandler(async (req, res) => {
    const { body } = req.validated;

    const result = await vehicleService.createVehicle(req.user._id, body);

    return sendCreated(res, {
        message: 'Create vehicle successfully',
        data: result,
    });
});

const createVehicleByAdmin = asyncHandler(async (req, res) => {
    const { body } = req.validated;

    const result = await vehicleService.createVehicleByAdmin(body);

    return sendCreated(res, {
        message: 'Create vehicle successfully',
        data: result,
    });
});

const updateMyVehicle = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { body } = req.validated;

    const result = await vehicleService.updateMyVehicle(req.user._id, id, body);

    return sendSuccess(res, {
        message: 'Update vehicle successfully',
        data: result,
    });
});

const updateVehicle = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { body } = req.validated;

    const result = await vehicleService.updateVehicle(id, body);

    return sendSuccess(res, {
        message: 'Update vehicle successfully',
        data: result,
    });
});

const deactivateMyVehicle = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await vehicleService.deactivateMyVehicle(req.user._id, id);

    return sendSuccess(res, {
        message: 'Deactivate vehicle successfully',
        data: result,
    });
});

const deactivateVehicle = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await vehicleService.deactivateVehicle(id);

    return sendSuccess(res, {
        message: 'Deactivate vehicle successfully',
        data: result,
    });
});

module.exports = {
    getMyVehicles,
    getAllVehicles,
    getMyVehicleById,
    getVehicleById,
    createMyVehicle,
    createVehicleByAdmin,
    updateMyVehicle,
    updateVehicle,
    deactivateMyVehicle,
    deactivateVehicle,
};
