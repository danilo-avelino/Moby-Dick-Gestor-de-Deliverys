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
import { recipeCategoriesRoutes } from './routes/recipe-categories';
import { cmvRoutes } from './routes/cmv';
import { alertRoutes } from './routes/alerts';
import { goalRoutes } from './routes/goals';
import { integrationRoutes } from './routes/integrations';
import { dashboardRoutes } from './routes/dashboard';
import { menuAnalysisRoutes } from './routes/menu-analysis';
import { purchaseRoutes } from './routes/purchases';
import { portioningRoutes } from './routes/portioning';
import { workTimesRoutes } from './routes/work-times';
import { inventoryRoutes, inventoryPublicRoutes } from './routes/inventory';
import { stockImportRoutes } from './routes/stock-import';
import { recipeAIRoutes } from './routes/recipe-ai';
import { stockRequestRoutes } from './routes/stock-requests';
import { userRoutes } from './routes/users';
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
        origin: (origin, cb) => {
            const allowedOrigins = [
                'http://localhost:5173',
                'http://localhost:5174',
                'http://localhost:5175',
                'http://localhost:5176',
                'http://localhost:5177',
                'http://localhost:5178',
                'http://localhost:5179',
                process.env.CORS_ORIGIN
            ].filter(Boolean);

            if (!origin || allowedOrigins.includes(origin)) {
                cb(null, true);
                return;
            }
            cb(new Error("Not allowed"), false);
        },
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

    /*
    
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
        */


    // Error handler
    fastify.setErrorHandler(errorHandler);

    // Health check
    fastify.get('/health', async () => {
        return { status: 'ok', timestamp: new Date().toISOString() };
    });


    // Register routes
    // Safe route registration helper
    const registerSafe = async (plugin: any, options: any) => {
        try {
            await fastify.register(plugin, options);
        } catch (err) {
            console.error(`❌ Failed to register route ${options.prefix}:`, err);
            // Don't crash, just log. Future improvement: verify if critical routes must crash.
        }
    };

    // Register routes safely
    await registerSafe(authRoutes, { prefix: '/api/auth' });
    await registerSafe(restaurantRoutes, { prefix: '/api/restaurants' });
    await registerSafe(productRoutes, { prefix: '/api/products' });
    await registerSafe(categoryRoutes, { prefix: '/api/categories' });
    await registerSafe(supplierRoutes, { prefix: '/api/suppliers' });
    await registerSafe(stockRoutes, { prefix: '/api/stock' });
    await registerSafe(recipeRoutes, { prefix: '/api/recipes' });
    await registerSafe(recipeCategoriesRoutes, { prefix: '/api/recipe-categories' });
    await registerSafe(cmvRoutes, { prefix: '/api/cmv' });
    await registerSafe(alertRoutes, { prefix: '/api/alerts' });
    await registerSafe(goalRoutes, { prefix: '/api/goals' });
    await registerSafe(integrationRoutes, { prefix: '/api/integrations' });
    await registerSafe(dashboardRoutes, { prefix: '/api/dashboard' });
    await registerSafe(menuAnalysisRoutes, { prefix: '/api/menu-analysis' });
    await registerSafe(purchaseRoutes, { prefix: '/api/purchases' });
    await registerSafe(portioningRoutes, { prefix: '/api/portioning' });
    await registerSafe(workTimesRoutes, { prefix: '/api/work-times' });
    await registerSafe(inventoryRoutes, { prefix: '/api/inventory' });
    await registerSafe(inventoryPublicRoutes, { prefix: '/api/public/inventory' });
    await registerSafe(stockImportRoutes, { prefix: '/api/stock' });
    await registerSafe(recipeAIRoutes, { prefix: '/api/recipes/ai' });
    await registerSafe(stockRequestRoutes, { prefix: '/api/stock-requests' });
    await registerSafe(userRoutes, { prefix: '/api/users' });


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
