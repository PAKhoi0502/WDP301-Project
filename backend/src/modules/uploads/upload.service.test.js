jest.mock('./upload.model', () => ({
    create: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    deleteOne: jest.fn(),
}));

jest.mock('../../config/cloudinary', () => ({
    configureCloudinary: jest.fn(),
}));

const Upload = require('./upload.model');
const { configureCloudinary } = require('../../config/cloudinary');
const uploadService = require('./upload.service');

describe('upload service', () => {
    const user = {
        _id: '507f1f77bcf86cd799439011',
        role: 'CUSTOMER',
    };

    const adminUser = {
        _id: '507f1f77bcf86cd799439012',
        role: 'ADMIN',
    };

    const file = {
        buffer: Buffer.from('image-content'),
        mimetype: 'image/png',
        size: 128,
        originalname: 'vehicle.png',
    };

    const createUploadDocument = (overrides = {}) => ({
        _id: '507f1f77bcf86cd799439013',
        url: 'https://res.cloudinary.com/demo/image/upload/autowash-pro/uploads/vehicle.png',
        public_id: 'autowash-pro/uploads/vehicle',
        mime_type: 'image/png',
        size: 128,
        purpose: 'VEHICLE_INSPECTION',
        owner_id: user._id,
        related_type: 'BOOKING',
        related_id: '507f1f77bcf86cd799439014',
        created_at: new Date('2026-06-10T00:00:00.000Z'),
        updated_at: new Date('2026-06-10T00:00:00.000Z'),
        ...overrides,
    });

    const createFindByIdPopulateQuery = (value) => ({
        populate: jest.fn().mockResolvedValue(value),
    });

    const createFindListQuery = (value) => {
        const query = {
            sort: jest.fn(() => query),
            skip: jest.fn(() => query),
            limit: jest.fn(() => query),
            populate: jest.fn().mockResolvedValue(value),
        };

        return query;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        Upload.create.mockReset();
        Upload.findById.mockReset();
        Upload.find.mockReset();
        Upload.countDocuments.mockReset();
        Upload.deleteOne.mockReset();
        configureCloudinary.mockReset();
        configureCloudinary.mockReturnValue({
            uploader: {
                upload_stream: jest.fn((options, callback) => ({
                    end: jest.fn(() => callback(null, {
                        secure_url: 'https://res.cloudinary.com/demo/image/upload/autowash-pro/uploads/vehicle.png',
                        public_id: 'autowash-pro/uploads/vehicle',
                    })),
                })),
                destroy: jest.fn().mockResolvedValue({ result: 'ok' }),
            },
        });
    });

    it('uploads a file to Cloudinary and stores metadata', async () => {
        const upload = createUploadDocument();

        Upload.create.mockResolvedValue({ _id: upload._id });
        Upload.findById.mockReturnValue(createFindByIdPopulateQuery(upload));

        const result = await uploadService.createUpload(user, file, {
            purpose: 'VEHICLE_INSPECTION',
            related_type: 'BOOKING',
            related_id: '507f1f77bcf86cd799439014',
        });

        expect(Upload.create).toHaveBeenCalledWith(expect.objectContaining({
            url: upload.url,
            public_id: upload.public_id,
            mime_type: 'image/png',
            size: 128,
            purpose: 'VEHICLE_INSPECTION',
            owner_id: user._id,
            related_type: 'BOOKING',
            related_id: '507f1f77bcf86cd799439014',
        }));
        expect(result.id).toBe(upload._id);
    });

    it('rejects missing file', async () => {
        await expect(uploadService.createUpload(user, null, {})).rejects.toMatchObject({
            statusCode: 400,
            errorCode: 'UPLOAD_FILE_REQUIRED',
        });

        expect(configureCloudinary).not.toHaveBeenCalled();
        expect(Upload.create).not.toHaveBeenCalled();
    });

    it('rejects deleting another user upload', async () => {
        Upload.findById.mockResolvedValue(createUploadDocument({
            owner_id: '507f1f77bcf86cd799439099',
        }));

        await expect(uploadService.deleteUpload(user, '507f1f77bcf86cd799439013')).rejects.toMatchObject({
            statusCode: 403,
            errorCode: 'UPLOAD_DELETE_FORBIDDEN',
        });

        expect(Upload.deleteOne).not.toHaveBeenCalled();
    });

    it('allows admin to list uploads with pagination', async () => {
        const uploads = [
            createUploadDocument({
                owner_id: adminUser._id,
            }),
        ];

        Upload.find.mockReturnValue(createFindListQuery(uploads));
        Upload.countDocuments.mockResolvedValue(1);

        const result = await uploadService.getAllUploads({
            page: 2,
            limit: 5,
            purpose: 'VEHICLE_INSPECTION',
        });

        expect(Upload.find).toHaveBeenCalledWith({
            purpose: 'VEHICLE_INSPECTION',
        });
        expect(result.meta).toEqual({
            page: 2,
            limit: 5,
            total: 1,
            total_pages: 1,
        });
        expect(result.data).toHaveLength(1);
    });
});
