import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from 'database';
import { UserRole } from 'types';
import { errors } from './error-handler';

// Extend Fastify types
declare module 'fastify' {
    interface FastifyRequest {
        user?: {
            id: string;
            email: string;
            role: UserRole;
            restaurantId: string | null;
        };
    }
}

declare module '@fastify/jwt' {
    interface FastifyJWT {
        payload: {
            sub: string;
            email: string;
            role: UserRole;
            restaurantId: string | null;
        };
        user: {
            id: string;
            email: string;
            role: UserRole;
            restaurantId: string | null;
        };
    }
}

// Authentication middleware
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    try {
        const decoded = await request.jwtVerify();

        // Verify user still exists and is active
        const user = await prisma.user.findUnique({
            where: { id: decoded.sub },
            select: { id: true, email: true, role: true, restaurantId: true, isActive: true },
        });

        if (!user || !user.isActive) {
            throw errors.unauthorized('User not found or inactive');
        }

        request.user = {
            id: user.id,
            email: user.email,
            role: user.role as UserRole,
            restaurantId: user.restaurantId,
        };
    } catch (err) {
        throw errors.unauthorized('Invalid or expired token');
    }
}

// Role-based access control
export function requireRole(...allowedRoles: UserRole[]) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        await authenticate(request, reply);

        if (!request.user) {
            throw errors.unauthorized();
        }

        if (!allowedRoles.includes(request.user.role)) {
            throw errors.forbidden('Insufficient permissions');
        }
    };
}

// Require restaurant context
export async function requireRestaurant(request: FastifyRequest, reply: FastifyReply) {
    await authenticate(request, reply);

    if (!request.user?.restaurantId) {
        // Allow Global users (DIRETOR, SUPER_ADMIN) to bypass checks
        const allowedGlobalRoles = ['SUPER_ADMIN', 'DIRETOR', 'ADMIN'];
        if (request.user?.role && allowedGlobalRoles.includes(request.user.role)) {
            return;
        }

        throw errors.forbidden('Restaurant context required');
    }
}

// Owner/admin only for specific resource
export function requireOwnerOrAdmin(getResourceOwnerId: (request: FastifyRequest) => Promise<string | null>) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        await authenticate(request, reply);

        if (!request.user) {
            throw errors.unauthorized();
        }

        // Admins and super admins can access anything
        if (request.user.role === UserRole.ADMIN || request.user.role === UserRole.SUPER_ADMIN) {
            return;
        }

        const ownerId = await getResourceOwnerId(request);
        if (ownerId !== request.user.id) {
            throw errors.forbidden('Access denied');
        }
    };
}
