require('dotenv').config();

const app = require('./app');
const { connectDB, disconnectDB } = require('./config/db');
const schedulerService = require('./jobs/scheduler.service');
const phoneVerificationService = require('./modules/auth/services/phoneVerification.service');

const PORT = process.env.PORT || 5000;

let server;

const shutdown = async (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);

    try {
        schedulerService.stopSchedulers();

        if (server) {
            await new Promise((resolve, reject) => {
                server.close((err) => {
                    if (err) return reject(err);
                    return resolve();
                });
            });

            console.log('HTTP server closed.');
        }

        await disconnectDB();

        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error.message);
        process.exit(1);
    }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);

    if (server) {
        shutdown('UNHANDLED_REJECTION');
    } else {
        process.exit(1);
    }
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

const startServer = async () => {
    phoneVerificationService.validateConfiguration();
    await connectDB();

    const schedulerStatus = schedulerService.startSchedulers();

    if (schedulerStatus.started) {
        console.log('Schedulers started:', schedulerStatus.jobs);
    }

    server = app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
        console.log(`Health check: http://localhost:${PORT}/health`);
        console.log(`Swagger docs: http://localhost:${PORT}/api-docs`);
    });
};

startServer().catch((error) => {
    console.error('Failed to start server:', error.message);
    process.exit(1);
});
