const washBayService = require('./washBay.service');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../../shared/utils/apiResponse');

const getAllWashBays = asyncHandler(async (req, res) => {
    const { query } = req.validated;

    const result = await washBayService.getAllWashBays(query);

    return sendSuccess(res, {
        message: 'Get wash bays successfully',
        data: result.data,
        meta: result.meta,
    });
});

const getWashBaysByGarage = asyncHandler(async (req, res) => {
    const { garageId } = req.validated.params;
    const { query } = req.validated;

    const result = await washBayService.getWashBaysByGarage(garageId, query);

    return sendSuccess(res, {
        message: 'Get wash bays successfully',
        data: result.data,
        meta: result.meta,
    });
});

const getStaffWorkspaceWashBays = asyncHandler(async (req, res) => {
    const result = await washBayService.getWashBaysForGarageWorkspace(
        req.staffContext.garage_id
    );

    return sendSuccess(res, {
        message: 'Get staff workspace wash bays successfully',
        data: result,
    });
});

const getAvailableWashBaysByGarage = asyncHandler(async (req, res) => {
    const { garageId } = req.validated.params;
    const { query } = req.validated;

    const result = await washBayService.getAvailableWashBaysByGarage(garageId, query);

    return sendSuccess(res, {
        message: 'Get available wash bays successfully',
        data: result,
    });
});

const getWashBayById = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await washBayService.getWashBayById(id);

    return sendSuccess(res, {
        message: 'Get wash bay successfully',
        data: result,
    });
});

const createWashBay = asyncHandler(async (req, res) => {
    const { body } = req.validated;

    const result = await washBayService.createWashBay(body);

    return sendCreated(res, {
        message: 'Create wash bay successfully',
        data: result,
    });
});

const updateWashBay = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { body } = req.validated;

    const result = await washBayService.updateWashBay(id, body);

    return sendSuccess(res, {
        message: 'Update wash bay successfully',
        data: result,
    });
});

const updateWashBayStatus = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { status } = req.validated.body;

    const result = await washBayService.updateWashBayStatus(id, status);

    return sendSuccess(res, {
        message: 'Update wash bay status successfully',
        data: result,
    });
});

const deactivateWashBay = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await washBayService.deactivateWashBay(id);

    return sendSuccess(res, {
        message: 'Deactivate wash bay successfully',
        data: result,
    });
});

module.exports = {
    getAllWashBays,
    getWashBaysByGarage,
    getStaffWorkspaceWashBays,
    getAvailableWashBaysByGarage,
    getWashBayById,
    createWashBay,
    updateWashBay,
    updateWashBayStatus,
    deactivateWashBay,
};
