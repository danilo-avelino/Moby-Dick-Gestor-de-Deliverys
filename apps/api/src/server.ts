import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
// import swagger from '@fastify/swagger';
// import swaggerUI from '@fastify/swagger-ui';
import websocket from '@fastify/websocket';
import multipart from '@fastify/multipart';

import { prisma } from 'database';
import { authRoutes } from './routes/auth';
import { costCenterRoutes } from './routes/cost-centers';
import { productRoutes } from './routes/products';
import { categoryRoutes } from './routes/categories';
import { supplierRoutes } from './routes/suppliers';
import { stockRoutes } from './routes/stock';
import { recipeRoutes } from './routes/recipes';
import { recipeCategoriesRoutes } from './routes/recipe-categories';
import { cmvRoutes } from './routes/cmv';
import { alertRoutes } from './routes/alerts';
import { indicatorRoutes } from './routes/indicators';
// import { goalRoutes } from './routes/goals'; // Deprecated
import { integrationRoutes } from './routes/integrations';
import { dashboardRoutes } from './routes/dashboard';
import { menuAnalysisRoutes } from './routes/menu-analysis';
import { purchaseRoutes } from './routes/purchases';
import { portioningRoutes } from './routes/portioning';
import { workTimesRoutes } from './routes/work-times';
import { menuRoutes } from './routes/menu';
import { inventoryRoutes, inventoryPublicRoutes } from './routes/inventory';
import { stockImportRoutes } from './routes/stock-import';
import { recipeAIRoutes } from './routes/recipe-ai';
import { stockRequestRoutes } from './routes/stock-requests';
import { userRoutes } from './routes/users';
import { pdvOrdersRoutes } from './routes/pdv-orders';
import { pdvPaymentsRoutes } from './routes/pdv-payments';
import { cashSessionRoutes } from './routes/cash-session';
import { customersRoutes } from './routes/customers';
import { tablesRoutes } from './routes/tables';
import { purchaseListRoutes, purchaseConfigRoutes } from './routes/purchase-lists';
import { integrationManager } from './services/integrations/integration-manager';
import { organizationRoutes } from './routes/organizations';
import { scheduleRoutes } from './routes/schedules';
import { platformRoutes } from './routes/platform';
import { backupRoutes } from './routes/backup';
import { revenueRoutes } from './routes/revenues';
import { publicRevenueRoutes } from './routes/public-revenue';
import { errorHandler } from './middleware/error-handler';

const PORT = parseInt(process.env.API_PORT || '3001', 10);
const HOST = process.env.API_HOST || '0.0.0.0';

export async function buildServer() {
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

    // Register Multipart EARLY to avoid conflicts
    try {
        // Debugging
        // @ts-ignore
        console.log('Parsers keys (pre-remove):', fastify.contentTypeParser?.customParsers?.keys ? Array.from(fastify.contentTypeParser.customParsers.keys()) : 'unknown');
        fastify.removeAllContentTypeParsers();
        // @ts-ignore
        console.log('Parsers keys (post-remove):', fastify.contentTypeParser?.customParsers?.keys ? Array.from(fastify.contentTypeParser.customParsers.keys()) : 'unknown');

        await fastify.register(multipart, {
            limits: {
                fileSize: 10 * 1024 * 1024, // 10MB max
            },
        });
    } catch (e) {
        console.error('Multipart registration failed:', e);
    }

    // Handle pre-parsed bodies (e.g. from Firebase Functions)
    // Handle pre-parsed bodies (e.g. from Firebase Functions)
    fastify.addContentTypeParser('application/json', {}, (req, payload, done) => {
        // Firebase attaches body to the raw IncomingMessage (req.raw)
        // Fastify Request (req) is a wrapper and body is not set yet
        const rawBody = (req.raw as any).body;
        if (rawBody) {
            console.log('ContentTypeParser: Using req.raw.body');
            done(null, rawBody);
        } else {
            let data = '';
            payload.on('data', chunk => { data += chunk; });
            payload.on('end', () => {
                if (!data) {
                    // Empty body handling (prevent JSON parse error on empty string)
                    done(null, {});
                    return;
                }
                console.log('ContentTypeParser: body parsing fallback (stream)');
                try {
                    done(null, JSON.parse(data));
                } catch (err: any) {
                    console.error('ContentTypeParser: Stream parse error:', err);
                    done(err, undefined);
                }
            });
        }
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
                'https://moby-dick-f15b4.web.app',
                'https://moby-dick-f15b4.firebaseapp.com',
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
        try {
            await prisma.$queryRaw`SELECT 1`;
            return { status: 'ok', db: 'connected', timestamp: new Date().toISOString() };
        } catch (err: any) {
            return { status: 'error', db: 'failed', error: err.message, timestamp: new Date().toISOString() };
        }
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
    await registerSafe(authRoutes, { prefix: '/auth' });
    await registerSafe(platformRoutes, { prefix: '/platform' });
    await registerSafe(organizationRoutes, { prefix: '/organizations' });
    await registerSafe(costCenterRoutes, { prefix: '/restaurants' });
    await registerSafe(productRoutes, { prefix: '/products' });
    await registerSafe(categoryRoutes, { prefix: '/categories' });
    await registerSafe(supplierRoutes, { prefix: '/suppliers' });
    await registerSafe(stockRoutes, { prefix: '/stock' });
    await registerSafe(recipeRoutes, { prefix: '/recipes' });
    await registerSafe(recipeCategoriesRoutes, { prefix: '/recipe-categories' });
    await registerSafe(cmvRoutes, { prefix: '/cmv' });
    await registerSafe(alertRoutes, { prefix: '/alerts' });
    // await registerSafe(goalRoutes, { prefix: '/goals' });
    await registerSafe(indicatorRoutes, { prefix: '/indicators' });
    await registerSafe(integrationRoutes, { prefix: '/integrations' });
    await registerSafe(dashboardRoutes, { prefix: '/dashboard' });
    await registerSafe(menuAnalysisRoutes, { prefix: '/menu-analysis' });
    await registerSafe(purchaseRoutes, { prefix: '/purchases' });
    await registerSafe(portioningRoutes, { prefix: '/portioning' });
    await registerSafe(workTimesRoutes, { prefix: '/work-times' });
    await registerSafe(menuRoutes, { prefix: '/menu' });
    await registerSafe(inventoryRoutes, { prefix: '/inventory' });
    await registerSafe(inventoryPublicRoutes, { prefix: '/public/inventory' });
    await registerSafe(stockImportRoutes, { prefix: '/stock' });
    await registerSafe(recipeAIRoutes, { prefix: '/recipes/ai' });
    await registerSafe(stockRequestRoutes, { prefix: '/stock-requests' });
    await registerSafe(userRoutes, { prefix: '/users' });
    await registerSafe(backupRoutes, { prefix: '/backup' });
    await registerSafe(revenueRoutes, { prefix: '/revenues' });
    await registerSafe(publicRevenueRoutes, { prefix: '/public/revenues' });

    // PDV Routes
    await registerSafe(pdvOrdersRoutes, { prefix: '/pdv/orders' });
    await registerSafe(pdvPaymentsRoutes, { prefix: '/pdv' });
    await registerSafe(cashSessionRoutes, { prefix: '/pdv/cash' });
    await registerSafe(customersRoutes, { prefix: '/customers' });

    await registerSafe(tablesRoutes, { prefix: '/tables' });

    // Schedules Routes
    await registerSafe(scheduleRoutes, { prefix: '/schedules' });

    // Purchase Lists
    await registerSafe(purchaseListRoutes, { prefix: '/purchase-lists' });
    await registerSafe(purchaseConfigRoutes, { prefix: '/purchase-config' });


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

if (require.main === module) {
    start();
}
