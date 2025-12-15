
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { authRoutes } from './routes/auth';
import { prisma } from 'database';

// Mock config
process.env.JWT_SECRET = 'test-secret';

const fastify = Fastify({
    logger: true
});

fastify.register(jwt, {
    secret: 'test-secret'
});

// Mock decorateRequest - removed as jwt handles it

fastify.register(authRoutes, { prefix: '/api/auth' });

async function main() {
    try {
        await fastify.listen({ port: 3001 });
        console.log('Test Server listening on 3001');

        // Self-test
        console.log('Sending login request...');
        const response = await fetch('http://localhost:3001/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@burgerhouse.com.br',
                password: 'password123'
            })
        });

        console.log('Status:', response.status);
        const text = await response.text();
        console.log('Body:', text);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

main();
