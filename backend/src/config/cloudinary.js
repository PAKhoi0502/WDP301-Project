const { v2: cloudinary } = require('cloudinary');
const { AppError } = require('../shared/utils/appError');

const requiredEnvKeys = [
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
];

const getMissingConfigKeys = () => {
    return requiredEnvKeys.filter((key) => !process.env[key]);
};

const configureCloudinary = () => {
    const missingKeys = getMissingConfigKeys();

    if (missingKeys.length > 0) {
        throw new AppError(
            'Cloudinary configuration is missing',
            500,
            'CLOUDINARY_CONFIG_MISSING',
            missingKeys.map((key) => ({
                path: key,
                message: `${key} is required`,
            }))
        );
    }

    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true,
    });

    return cloudinary;
};

module.exports = {
    cloudinary,
    configureCloudinary,
};
