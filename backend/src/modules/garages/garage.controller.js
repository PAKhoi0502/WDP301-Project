const garageService = require('./garage.service');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../../shared/utils/apiResponse');

const getPublicGarages = asyncHandler(async (req, res) => {
    const { query } = req.validated;

    const result = await garageService.getPublicGarages(query);

    return sendSuccess(res, {
        message: 'Get garages successfully',
        data: result.data,
        meta: result.meta,
    });
});

const getPublicGarageById = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await garageService.getPublicGarageById(id);

    return sendSuccess(res, {
        message: 'Get garage successfully',
        data: result,
    });
});

const getAllGarages = asyncHandler(async (req, res) => {
    const { query } = req.validated;

    const result = await garageService.getAllGarages(query);

    return sendSuccess(res, {
        message: 'Get garages successfully',
        data: result.data,
        meta: result.meta,
    });
});

const getGarageById = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await garageService.getGarageById(id);

    return sendSuccess(res, {
        message: 'Get garage successfully',
        data: result,
    });
});

const createGarage = asyncHandler(async (req, res) => {
    const { body } = req.validated;

    const result = await garageService.createGarage(body);

    return sendCreated(res, {
        message: 'Create garage successfully',
        data: result,
    });
});

const updateGarage = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { body } = req.validated;

    const result = await garageService.updateGarage(id, body);

    return sendSuccess(res, {
        message: 'Update garage successfully',
        data: result,
    });
});

const updateGarageStatus = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { is_active } = req.validated.body;

    const result = await garageService.updateGarageStatus(id, is_active);

    return sendSuccess(res, {
        message: 'Update garage status successfully',
        data: result,
    });
});

const deleteGarage = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await garageService.deleteGarage(id);

    return sendSuccess(res, {
        message: 'Delete garage successfully',
        data: result,
    });
});

module.exports = {
    getPublicGarages,
    getPublicGarageById,
    getAllGarages,
    getGarageById,
    createGarage,
    updateGarage,
    updateGarageStatus,
    deleteGarage,
};
