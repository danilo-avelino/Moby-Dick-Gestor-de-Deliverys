import { onRequest } from 'firebase-functions/v2/https';
// import { buildServer } from './server'; // Removed to prevent top-level side effects (Prisma init)
delete process.env.PRISMA_QUERY_ENGINE_LIBRARY; // Ensure we use the auto-resolved engine

let serverPromise: Promise<any> | null = null;

export const api = onRequest({
    region: 'us-east4',
    memory: "1GiB",
    timeoutSeconds: 60,
    invoker: 'public',
}, async (req, res) => {
    try {
        if (!serverPromise) {
            console.log('Lazy initializing server...');
            // Dynamic import to prevent top-level crashes
            const mod = await import('./server');
            serverPromise = mod.buildServer();
        }

        const app = await serverPromise;
        console.log('App resolved, waiting for ready...');
        await app.ready();
        console.log('App ready, emitting request...');
        app.server.emit('request', req, res);
    } catch (err: any) {
        console.error('CRITICAL ERROR in api function:', err);
        // Explicitly set content type to JSON to help distinguish who sent this
        res.status(500).contentType('application/json').send(JSON.stringify({
            error: 'Internal Server Error (Caught in entry point)',
            message: err.message,
            stack: err.stack
        }));
    }
});
