const tags = [
    {
        name: 'Vehicle Inspections',
        description: 'Vehicle inspection APIs',
    },
];

const vehicleInspectionSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        booking_id: { type: 'string' },
        type: { type: 'string', enum: ['BEFORE_WASH', 'AFTER_WASH'] },
        note: { type: 'string', nullable: true },
        images: {
            type: 'array',
            maxItems: 20,
            description: 'AFTER_WASH inspections require at least one image',
            items: {
                type: 'object',
                properties: {
                    image_url: { type: 'string' },
                    public_id: { type: 'string', nullable: true },
                    caption: { type: 'string', nullable: true },
                },
            },
        },
        inspected_by_id: { type: 'string' },
        inspected_at: { type: 'string', format: 'date-time' },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
    },
};

const createVehicleInspectionRequest = {
    type: 'object',
    required: ['type'],
    properties: {
        type: { type: 'string', enum: ['BEFORE_WASH', 'AFTER_WASH'] },
        note: { type: 'string' },
        images: {
            type: 'array',
            items: {
                type: 'object',
                required: ['image_url'],
                properties: {
                    image_url: { type: 'string' },
                    public_id: { type: 'string' },
                    caption: { type: 'string' },
                },
            },
        },
    },
};

module.exports = {
    tags,
    paths: {},
    schemas: {
        VehicleInspection: vehicleInspectionSchema,
        CreateVehicleInspectionRequest: createVehicleInspectionRequest,
    },
};
