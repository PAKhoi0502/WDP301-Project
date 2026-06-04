const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');

const routes = require('./routes');
const openApiSpec = require('./docs/openapi');
const { notFoundHandler } = require('./shared/middlewares/notFound.middleware');
const { errorHandler } = require('./shared/middlewares/error.middleware');

const app = express();

app.set('trust proxy', 1);

const parseCorsOrigins = () => {
    const raw = process.env.CORS_ORIGINS || 'http://localhost:5173';

    return raw
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
};

app.use(helmet());

app.use(
    cors({
        origin: (origin, callback) => {
            const allowedOrigins = parseCorsOrigins();

            if (!origin || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            return callback(new Error('Not allowed by CORS'));
        },
        credentials: true,
    })
);

app.use(cookieParser());

if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many requests. Please try again later.',
        error_code: 'TOO_MANY_REQUESTS',
    },
});

app.get('/health', (req, res) => {
    return res.status(200).json({
        success: true,
        message: 'AutoWash Pro API is running',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
    });
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

app.use('/api/v1', apiLimiter);
app.use('/api/v1', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;