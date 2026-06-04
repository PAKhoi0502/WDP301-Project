const mongoose = require('mongoose');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

mongoose.set('strictQuery', true);

const setupConnectionListeners = () => {
    mongoose.connection.on('error', (err) => {
        console.error('MongoDB runtime error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
        console.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
        console.log('MongoDB reconnected');
    });
};

setupConnectionListeners();

const connectDB = async (retries = 5, baseDelayMs = 5000) => {
    const mongoUri = process.env.MONGO_URI;
    const dbName = process.env.MONGODB_DB_NAME || 'wdp301_project';

    if (!mongoUri) {
        console.error('MONGO_URI is missing in environment variables.');
        process.exit(1);
    }

    for (let attempt = 1; attempt <= retries; attempt += 1) {
        try {
            const conn = await mongoose.connect(mongoUri, {
                dbName,
                serverSelectionTimeoutMS: 10000,
            });

            console.log(
                `MongoDB connected: ${conn.connection.host} | DB: ${conn.connection.name}`
            );

            return conn;
        } catch (error) {
            console.error(
                `MongoDB connection error (attempt ${attempt}/${retries}): ${error.message}`
            );

            if (attempt === retries) {
                console.error('Max MongoDB connection retries reached. Exiting process.');
                process.exit(1);
            }

            const delay = baseDelayMs * attempt;
            console.log(`Retrying MongoDB connection in ${delay}ms...`);
            await sleep(delay);
        }
    }
};

const disconnectDB = async () => {
    try {
        await mongoose.connection.close();
        console.log('MongoDB connection closed');
    } catch (error) {
        console.error('MongoDB disconnect error:', error.message);
    }
};

module.exports = {
    connectDB,
    disconnectDB,
};