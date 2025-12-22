import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from 'database';
import { UserRole } from 'types';
import { errors } from './error-handler';

// Extend Fastify types
// Extend Fastify types
declare module 'fastify' {
    interface FastifySchema {
        tags?: string[];
        security?: Record<string, any[]>[];
        summary?: string;
        description?: string;
    }
}

declare module '@fastify/jwt' {
    interface FastifyJWT {
        payload: {
            sub: string;
            email: string;
            role: UserRole;
            costCenterId: string | null;
            organizationId?: string | null;
            scope?: string;
            type?: string;
            impersonatedBy?: string; // ID of the system master impersonating
        };
        user: {
            id: string;
            email: string;
            role: UserRole;
            costCenterId: string | null;
            organizationId: string | null;
            scope: 'ORG' | 'RESTAURANTS';
            permissions?: {
                allowedCostCenterIds: string[] | 'ALL';
                indicators: {
                    view: boolean;
                    configure: boolean;
                };
            };
            impersonatedBy?: string;
        };
    }
}

// Authentication middleware
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    try {
        const decoded = await request.jwtVerify<{
            sub: string,
            impersonatedBy?: string,
            organizationId?: string // Support override from token
        }>();

        // Verify user still exists and is active
        const user = await prisma.user.findUnique({
            where: { id: decoded.sub },
            select: {
                id: true,
                email: true,
                role: true,
                costCenterId: true,
                organizationId: true,
                scope: true,
                isActive: true
            },
        });

        if (!user || !user.isActive) {
            throw errors.unauthorized('User not found or inactive');
        }

        // Use organizationId from token if present (Impersonation), otherwise from DB
        const activeOrganizationId = decoded.organizationId || user.organizationId;

        // Determine permissions based on scope
        let allowedCostCenterIds: string[] | 'ALL' = [];

        // If impersonating or ORG scope...
        if (decoded.organizationId || user.scope === 'ORG' || ['SUPER_ADMIN', 'DIRETOR', 'ADMIN'].includes(user.role)) {
            allowedCostCenterIds = 'ALL';
        } else {
            // Fetch allowed cost centers from UserCostCenterAccess
            const accesses = await prisma.userCostCenterAccess.findMany({
                where: { userId: user.id }, // TODO: Filter by organizationId too if strict strict
                select: { costCenterId: true }
            });
            allowedCostCenterIds = accesses.map(a => a.costCenterId);

            // Also include the linked cost center if any (legacy compatibility)
            if (user.costCenterId && !allowedCostCenterIds.includes(user.costCenterId)) {
                allowedCostCenterIds.push(user.costCenterId);
            }
        }

        request.user = {
            id: user.id,
            email: user.email,
            role: user.role as UserRole,
            costCenterId: user.costCenterId,
            organizationId: activeOrganizationId,
            scope: user.scope as 'ORG' | 'RESTAURANTS',
            permissions: {
                allowedCostCenterIds,
                indicators: {
                    // Everyone can potentially view if they are "Interessados" (Staff), 
                    // but Managers/Directors/Admins have implicit view access to everything or at least the module.
                    // For now, we set the capability to TRUE for all active users, 
                    // and actual data visibility is filtered by IndicatorAccess table.
                    view: true,

                    // Only Manager and Director (and above) can configure
                    configure: ['SUPER_ADMIN', 'ADMIN', 'DIRETOR', 'MANAGER'].includes(user.role)
                }
            },
            impersonatedBy: decoded.impersonatedBy
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

// Require cost center context
export async function requireCostCenter(request: FastifyRequest, reply: FastifyReply) {
    await authenticate(request, reply);

    if (!request.user?.costCenterId) {
        // Allow Global users (DIRETOR, SUPER_ADMIN) to bypass checks
        const allowedGlobalRoles = ['SUPER_ADMIN', 'DIRETOR', 'ADMIN'];
        if (request.user?.role && allowedGlobalRoles.includes(request.user.role)) {
            return;
        }

        throw errors.forbidden('Cost Center context required');
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
