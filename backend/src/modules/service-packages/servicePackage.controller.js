const servicePackageService = require('./servicePackage.service');
const { asyncHandler } = require('../../shared/utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../../shared/utils/apiResponse');

const getPublicServicePackages = asyncHandler(async (req, res) => {
    const { query } = req.validated;

    const result = await servicePackageService.getPublicServicePackages(query);

    return sendSuccess(res, {
        message: 'Get service packages successfully',
        data: result.data,
        meta: result.meta,
    });
});

const getPublicServicePackageById = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await servicePackageService.getPublicServicePackageById(id);

    return sendSuccess(res, {
        message: 'Get service package successfully',
        data: result,
    });
});

const getAllServicePackages = asyncHandler(async (req, res) => {
    const { query } = req.validated;

    const result = await servicePackageService.getAllServicePackages(query);

    return sendSuccess(res, {
        message: 'Get service packages successfully',
        data: result.data,
        meta: result.meta,
    });
});

const getServicePackageById = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await servicePackageService.getServicePackageById(id);

    return sendSuccess(res, {
        message: 'Get service package successfully',
        data: result,
    });
});

const createServicePackage = asyncHandler(async (req, res) => {
    const { body } = req.validated;

    const result = await servicePackageService.createServicePackage(body);

    return sendCreated(res, {
        message: 'Create service package successfully',
        data: result,
    });
});

const updateServicePackage = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { body } = req.validated;

    const result = await servicePackageService.updateServicePackage(id, body);

    return sendSuccess(res, {
        message: 'Update service package successfully',
        data: result,
    });
});

const activateServicePackage = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await servicePackageService.updateServicePackageStatus(id, true);

    return sendSuccess(res, {
        message: 'Activate service package successfully',
        data: result,
    });
});

const deactivateServicePackage = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    const result = await servicePackageService.updateServicePackageStatus(id, false);

    return sendSuccess(res, {
        message: 'Deactivate service package successfully',
        data: result,
    });
});

const updateStepsTemplate = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { steps_template } = req.validated.body;

    const result = await servicePackageService.updateStepsTemplate(id, steps_template);

    return sendSuccess(res, {
        message: 'Update service package steps template successfully',
        data: result,
    });
});

const updateIncludedServices = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { included_service_ids } = req.validated.body;

    const result = await servicePackageService.updateIncludedServices(id, included_service_ids);

    return sendSuccess(res, {
        message: 'Update service package included services successfully',
        data: result,
    });
});

module.exports = {
    getPublicServicePackages,
    getPublicServicePackageById,
    getAllServicePackages,
    getServicePackageById,
    createServicePackage,
    updateServicePackage,
    activateServicePackage,
    deactivateServicePackage,
    updateStepsTemplate,
    updateIncludedServices,
};
