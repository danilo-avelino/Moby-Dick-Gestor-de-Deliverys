import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import websocket from '@fastify/websocket';

import { prisma } from 'database';
import { authRoutes } from './routes/auth';
import { restaurantRoutes } from './routes/restaurants';
import { productRoutes } from './routes/products';
import { categoryRoutes } from './routes/categories';
import { supplierRoutes } from './routes/suppliers';
import { stockRoutes } from './routes/stock';
import { recipeRoutes } from './routes/recipes';
import { cmvRoutes } from './routes/cmv';
import { alertRoutes } from './routes/alerts';
import { goalRoutes } from './routes/goals';
import { integrationRoutes } from './routes/integrations';
import { dashboardRoutes } from './routes/dashboard';
import { menuAnalysisRoutes } from './routes/menu-analysis';
import { purchaseRoutes } from './routes/purchases';
import { portioningRoutes } from './routes/portioning';
import { workTimesRoutes } from './routes/work-times';
import { integrationManager } from './services/integrations/integration-manager';
import { errorHandler } from './middleware/error-handler';

const PORT = parseInt(process.env.API_PORT || '3001', 10);
const HOST = process.env.API_HOST || '0.0.0.0';

async function buildServer() {
    const fastify = Fastify({
        logger: {
            level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
            transport: process.env.NODE_ENV !== 'production' ? {
                target: 'pino-pretty',
                options: {
                    translateTime: 'HH:MM:ss Z',
                    ignore: 'pid,hostname',
                },
            } : undefined,
        },
    });

    // Security
    await fastify.register(helmet, {
        contentSecurityPolicy: false,
    });

    // CORS
    await fastify.register(cors, {
        origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
        credentials: true,
    });

    // Rate limiting
    await fastify.register(rateLimit, {
        max: 100,
        timeWindow: '1 minute',
    });

    // JWT
    await fastify.register(jwt, {
        secret: process.env.JWT_SECRET || 'super-secret-key-change-in-production',
        sign: {
            expiresIn: process.env.JWT_EXPIRES_IN || '7d',
        },
    });

    // Cookies
    await fastify.register(cookie, {
        secret: process.env.JWT_SECRET || 'super-secret-key-change-in-production',
    });

    // WebSocket
    await fastify.register(websocket);

    // Swagger Documentation
    await fastify.register(swagger, {
        openapi: {
            info: {
                title: 'Moby Dick API',
                description: 'API para gestão de delivery de restaurantes',
                version: '1.0.0',
            },
            servers: [
                {
                    url: `http://localhost:${PORT}`,
                    description: 'Development server',
                },
            ],
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT',
                    },
                },
            },
        },
    });

    await fastify.register(swaggerUI, {
        routePrefix: '/docs',
        uiConfig: {
            docExpansion: 'list',
            deepLinking: false,
        },
    });

    // Error handler
    fastify.setErrorHandler(errorHandler);

    // Health check
    fastify.get('/health', async () => {
        return { status: 'ok', timestamp: new Date().toISOString() };
    });

    // Register routes
    await fastify.register(authRoutes, { prefix: '/api/auth' });
    await fastify.register(restaurantRoutes, { prefix: '/api/restaurants' });
    await fastify.register(productRoutes, { prefix: '/api/products' });
    await fastify.register(categoryRoutes, { prefix: '/api/categories' });
    await fastify.register(supplierRoutes, { prefix: '/api/suppliers' });
    await fastify.register(stockRoutes, { prefix: '/api/stock' });
    await fastify.register(recipeRoutes, { prefix: '/api/recipes' });
    await fastify.register(cmvRoutes, { prefix: '/api/cmv' });
    await fastify.register(alertRoutes, { prefix: '/api/alerts' });
    await fastify.register(goalRoutes, { prefix: '/api/goals' });
    await fastify.register(integrationRoutes, { prefix: '/api/integrations' });
    await fastify.register(dashboardRoutes, { prefix: '/api/dashboard' });
    await fastify.register(menuAnalysisRoutes, { prefix: '/api/menu-analysis' });
    await fastify.register(purchaseRoutes, { prefix: '/api/purchases' });
    await fastify.register(portioningRoutes, { prefix: '/api/portioning' });
    await fastify.register(workTimesRoutes, { prefix: '/api/work-times' });

    // WebSocket for real-time updates
    fastify.get('/ws', { websocket: true }, (connection, _req) => {
        connection.socket.on('message', (message: any) => {
            const data = JSON.parse(message.toString());
            // Handle WebSocket messages
            console.log('WebSocket message:', data);
        });
    });

    return fastify;
}

async function start() {
    try {
        // Test database connection
        await prisma.$connect();
        console.log('✅ Database connected');

        const server = await buildServer();

        await server.listen({ port: PORT, host: HOST });
        console.log(`🚀 Server running on http://${HOST}:${PORT}`);
        console.log(`📚 Documentation available at http://${HOST}:${PORT}/docs`);

        // Initialize integrations after server is ready
        await integrationManager.init();
    } catch (err) {
        console.error('❌ Failed to start server:', err);
        process.exit(1);
    }
}

start();
