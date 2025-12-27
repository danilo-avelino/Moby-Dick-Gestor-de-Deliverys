
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { hash } from 'bcryptjs';
import { prisma } from 'database';
import { authenticate, requireRole } from '../middleware/auth';
import { errors } from '../middleware/error-handler';
import { UserRole } from 'types';
import dayjs from 'dayjs';


export async function organizationRoutes(app: FastifyInstance) {
    // List Organizations (System Master Only)
    app.get('/', {
        preHandler: [authenticate]
    }, async (request, reply) => {
        const userRole = request.user.role;

        // Only SUPER_ADMIN can list all organizations
        if (userRole !== 'SUPER_ADMIN') {
            // If not super admin, return only their own organization
            if (request.user.organizationId) {
                const org = await prisma.organization.findUnique({
                    where: { id: request.user.organizationId }
                });
                return [org];
            }
            return [];
        }


        const organizations = await prisma.organization.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                costCenters: {
                    take: 1, // Get primary costCenter for plan info
                    select: {
                        plan: true,
                        planExpiresAt: true,
                        isActive: true
                    }
                },
                users: {
                    where: { role: 'DIRETOR' },
                    take: 1,
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                },
                _count: {
                    select: { costCenters: true, users: true }
                }
            }
        });

        const enrichedOrgs = organizations.map(org => {
            const primaryCostCenter = org.costCenters[0];
            const director = org.users[0];

            // Derive Plan Status
            let billingStatus = 'ACTIVE';
            let plan = primaryCostCenter?.plan || 'free';

            if (!primaryCostCenter) {
                billingStatus = 'INCOMPLETE';
            } else if (primaryCostCenter.planExpiresAt && dayjs(primaryCostCenter.planExpiresAt).isBefore(dayjs())) {
                billingStatus = 'PAST_DUE';
            }

            // Compute Health
            let health = 'OK';
            const issues: string[] = [];

            if (!director) {
                health = 'CRITICAL';
                issues.push('Missing Director');
            }
            if (org._count.costCenters === 0) {
                health = 'CRITICAL';
                issues.push('No CostCenters');
            }
            if (billingStatus === 'PAST_DUE') {
                health = 'WARNING';
                issues.push('Payment Overdue');
            }

            // Onboarding Status
            let onboardingStatus = 'COMPLETE';
            if (org._count.costCenters === 0 || !director) {
                onboardingStatus = 'PENDING';
            }

            return {
                ...org,
                plan,
                billingStatus,
                nextBillingDate: primaryCostCenter?.planExpiresAt,
                directorName: director ? `${director.firstName} ${director.lastName}` : 'Não definido',
                directorEmail: director?.email,
                health,
                healthIssues: issues,
                onboardingStatus,
                counts: org._count
            };
        });

        return { success: true, data: enrichedOrgs };
    });

    // Get Organization Details
    app.get('/:id', {
        preHandler: [authenticate],
        schema: {
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        const { id } = request.params as { id: string };

        // Access control: SUPER_ADMIN or Member of Org
        if (request.user.role !== 'SUPER_ADMIN' && request.user.organizationId !== id) {
            throw errors.forbidden("You don't have access to this organization");
        }


        const organization = await prisma.organization.findUnique({
            where: { id },
            include: {
                impersonationLogs: {
                    take: 20,
                    orderBy: { timestamp: 'desc' }
                },
                costCenters: {
                    include: {
                        integrations: {
                            select: { platform: true, status: true, lastSyncAt: true }
                        }
                    }
                },
                users: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        role: true,
                        costCenterId: true,
                        lastLoginAt: true,
                        isActive: true
                    },
                    orderBy: { createdAt: 'desc' },
                }
            }
        });

        if (!organization) {
            throw errors.notFound('Organization not found');
        }

        // Enrich Data
        const primaryCostCenter = organization.costCenters[0];

        let billingStatus = 'ACTIVE';
        let plan = primaryCostCenter?.plan || 'free';

        if (!primaryCostCenter) {
            billingStatus = 'INCOMPLETE';
        } else if (primaryCostCenter.planExpiresAt && dayjs(primaryCostCenter.planExpiresAt).isBefore(dayjs())) {
            billingStatus = 'PAST_DUE';
        }

        let health = 'OK';
        const issues: string[] = [];
        const director = organization.users.find(u => u.role === 'DIRETOR');

        if (!director) {
            health = 'CRITICAL';
            issues.push('Missing Director');
        }
        if (organization.costCenters.length === 0) {
            health = 'CRITICAL';
            issues.push('No CostCenters');
        }
        if (billingStatus === 'PAST_DUE') {
            health = 'WARNING';
            issues.push('Payment Overdue');
        }

        const enrichedOrg = {
            ...organization,
            plan,
            billingStatus,
            nextBillingDate: primaryCostCenter?.planExpiresAt,
            directorName: director ? `${director.firstName} ${director.lastName}` : 'Não definido',
            directorEmail: director?.email,
            health,
            healthIssues: issues,
            stats: {
                users: organization.users.length,
                costCenters: organization.costCenters.length,
            }
        };

        return { success: true, data: enrichedOrg };
    });

    // Update Organization (System Master Only)
    const updateOrgSchema = z.object({
        name: z.string().min(3).optional(),
        slug: z.string().min(3).optional(),
        directorName: z.string().optional(),
        directorEmail: z.string().email().optional(),
        // Address
        street: z.string().optional(),
        number: z.string().optional(),
        neighborhood: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        // Plan
        plan: z.string().optional(),
    });

    app.put('/:id', {
        preHandler: [authenticate, requireRole(UserRole.SUPER_ADMIN)],
        schema: {
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string' }
                }
            },
            body: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    slug: { type: 'string' },
                    directorName: { type: 'string' },
                    directorEmail: { type: 'string' },
                    street: { type: 'string' },
                    number: { type: 'string' },
                    neighborhood: { type: 'string' },
                    city: { type: 'string' },
                    state: { type: 'string' },
                    zipCode: { type: 'string' },
                    plan: { type: 'string' },
                }
            }
        }
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = updateOrgSchema.parse(request.body);

        const org = await prisma.organization.findUnique({
            where: { id },
            include: {
                users: { where: { role: 'DIRETOR' } },
                costCenters: { take: 1 } // Get primary cost center
            }
        });

        if (!org) throw errors.notFound('Organization not found');

        // Check Slug Uniqueness if changing
        if (body.slug && body.slug !== org.slug) {
            const existingSlug = await prisma.organization.findUnique({ where: { slug: body.slug } });
            if (existingSlug) throw errors.conflict('Slug already exists');
        }

        const result = await prisma.$transaction(async (tx) => {
            // 1. Update Org
            const updatedOrg = await tx.organization.update({
                where: { id },
                data: {
                    name: body.name,
                    slug: body.slug,
                }
            });

            // 2. Update Director
            if (body.directorName || body.directorEmail) {
                const director = org.users[0];
                if (director) {
                    const [firstName, ...lastNameParts] = (body.directorName || '').split(' ');
                    const lastName = lastNameParts.join(' ');

                    const dataToUpdate: any = {};
                    if (body.directorName) {
                        dataToUpdate.firstName = firstName;
                        dataToUpdate.lastName = lastName;
                    }
                    if (body.directorEmail) {
                        dataToUpdate.email = body.directorEmail;
                    }

                    // Check email uniqueness if changing
                    if (body.directorEmail && body.directorEmail !== director.email) {
                        const existingUser = await tx.user.findUnique({ where: { email: body.directorEmail } });
                        if (existingUser) throw errors.conflict('Email already in use by another user');
                    }

                    await tx.user.update({
                        where: { id: director.id },
                        data: dataToUpdate
                    });
                }
            }

            // 3. Update CostCenter (Address & Plan)
            const primaryCostCenter = org.costCenters[0];
            if (primaryCostCenter) {
                const costCenterUpdate: any = {};

                // Address fields
                if (body.street !== undefined) costCenterUpdate.street = body.street;
                if (body.number !== undefined) costCenterUpdate.number = body.number;
                if (body.neighborhood !== undefined) costCenterUpdate.neighborhood = body.neighborhood;
                if (body.city !== undefined) costCenterUpdate.city = body.city;
                if (body.state !== undefined) costCenterUpdate.state = body.state;
                if (body.zipCode !== undefined) costCenterUpdate.zipCode = body.zipCode;

                // Plan fields
                if (body.plan !== undefined) {
                    costCenterUpdate.plan = body.plan;
                    // Reset or update expiration logic if needed, 
                    // for now assuming manual plan change keeps existing expiration or sets it elsewhere?
                    // Replicating creation logic: if switching to free_trial, set 30 days? 
                    // Usually editing plan might mean upgrading so we might want to extend validity?
                    // For simplicity, just updating the plan type enum string for now as per request.
                    // If switching TO free_trial from something else, maybe reset expiration?
                    if (body.plan === 'free_trial' && primaryCostCenter.plan !== 'free_trial') {
                        costCenterUpdate.planExpiresAt = dayjs().add(30, 'days').toDate();
                    }
                }

                if (Object.keys(costCenterUpdate).length > 0) {
                    await tx.costCenter.update({
                        where: { id: primaryCostCenter.id },
                        data: costCenterUpdate
                    });
                }
            }

            return updatedOrg;
        });

        return { success: true, data: result };
    });


    // Create Organization (System Master Only)
    const createOrgSchema = z.object({
        name: z.string().min(3),
        // Address
        street: z.string().optional(),
        number: z.string().optional(),
        neighborhood: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        // Plan
        plan: z.string(),
        // Director
        directorName: z.string(),
        directorEmail: z.string().email(),
    });

    app.post('/', {
        preHandler: [authenticate, requireRole(UserRole.SUPER_ADMIN)],
        schema: {
            body: {
                type: 'object',
                required: ['name', 'plan', 'directorName', 'directorEmail'],
                properties: {
                    name: { type: 'string' },
                    street: { type: 'string' },
                    number: { type: 'string' },
                    neighborhood: { type: 'string' },
                    city: { type: 'string' },
                    state: { type: 'string' },
                    zipCode: { type: 'string' },
                    plan: { type: 'string' },
                    directorName: { type: 'string' },
                    directorEmail: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        const body = createOrgSchema.parse(request.body);
        const {
            name,
            street, number, neighborhood, city, state, zipCode,
            plan,
            directorName, directorEmail
        } = body;

        // Auto-generate slug from name
        const slug = name.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
            .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanum with dash
            .replace(/^-+|-+$/g, ''); // Trim dashes

        // Check availability
        const existingOrg = await prisma.organization.findUnique({ where: { slug } });
        if (existingOrg) throw errors.badRequest('Organization slug already exists (derived from name)');

        const existingUser = await prisma.user.findUnique({ where: { email: directorEmail } });
        if (existingUser) throw errors.badRequest('User with this email already exists');

        const hashedPassword = await hash('admin123', 10);

        const result = await prisma.$transaction(async (tx) => {
            // 1. Create Organization
            const org = await tx.organization.create({
                data: {
                    name,
                    slug,
                    status: 'ACTIVE'
                }
            });

            // 2. Create Default CostCenter (holds Address & Plan)
            let planExpiresAt = null;
            if (plan === 'free_trial') {
                planExpiresAt = dayjs().add(30, 'days').toDate();
            }

            const costCenter = await tx.costCenter.create({
                data: {
                    name: name, // Default costCenter name = Org name
                    organizationId: org.id,
                    // Address
                    street, number, neighborhood, city, state, zipCode,
                    // Plan
                    plan,
                    planExpiresAt,
                    // Defaults
                    currency: 'BRL',
                    timezone: 'America/Sao_Paulo'
                }
            });

            // 3. Create Director User
            const [firstName, ...lastNameParts] = directorName.split(' ');
            const lastName = lastNameParts.join(' ') || '';

            const user = await tx.user.create({
                data: {
                    firstName,
                    lastName,
                    email: directorEmail,
                    passwordHash: hashedPassword,
                    role: UserRole.DIRETOR,
                    scope: 'ORG', // Director has ORG scope
                    organizationId: org.id,
                    costCenterId: costCenter.id, // Default context
                    costCenterAccess: {
                        create: {
                            costCenterId: costCenter.id,
                            organizationId: org.id
                        }
                    }
                }
            });

            // 4. Provision Default Categories
            await tx.productCategory.createMany({
                data: [
                    { name: 'Geral', organizationId: org.id },
                    { name: 'Bebidas', organizationId: org.id },
                    { name: 'Comidas', organizationId: org.id },
                    { name: 'Ingredientes', organizationId: org.id }
                ]
            });

            return { org, costCenter, user };
        });


        return { success: true, data: result.org };
    });

    // Start Impersonation (System Master Only)
    app.post('/:id/impersonate', {
        preHandler: [authenticate, requireRole(UserRole.SUPER_ADMIN)],
        schema: {
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const systemMasterId = request.user.id;

        const org = await prisma.organization.findUnique({
            where: { id },
            include: { costCenters: { take: 1 } }
        });
        if (!org) throw errors.notFound('Organization not found');

        // Create a session record
        const session = await prisma.adminImpersonationSession.create({
            data: {
                systemMasterUserId: systemMasterId,
                organizationId: id,
                expiresAt: dayjs().add(1, 'hour').toDate()
            }
        });

        // Log action
        await prisma.adminImpersonationLog.create({
            data: {
                systemMasterUserId: systemMasterId,
                organizationId: id,
                action: 'IMPERSONATE_START'
            }
        });

        const primaryCostCenter = org.costCenters[0];

        // Construct impersonated user object
        const impersonatedUser = {
            id: systemMasterId,
            email: request.user.email,
            firstName: 'Super Admin',
            lastName: '(Impersonating)',
            role: UserRole.SUPER_ADMIN,
            organizationId: id,
            costCenterId: primaryCostCenter?.id || null,
            scope: 'ORG',
            impersonatedBy: systemMasterId
        };

        // Re-issue token with override payload
        const impersonatedToken = app.jwt.sign({
            sub: systemMasterId,
            email: request.user.email,
            role: request.user.role,
            costCenterId: primaryCostCenter?.id || null,
            organizationId: id,
            type: 'IMPERSONATION'
        });

        return {
            success: true,
            data: {
                accessToken: impersonatedToken,
                user: impersonatedUser,
                organization: org,
                session
            }
        };
    });
}
