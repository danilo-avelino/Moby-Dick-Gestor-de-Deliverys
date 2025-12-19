import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from 'database';
import { authenticate } from '../middleware/auth';
import { errors } from '../middleware/error-handler';
import { ApiResponse } from 'types';

// Validation Schemas

const createCategorySchema = z.object({
    costCenterId: z.string(),
    name: z.string().min(1),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().default(true),
    activeForSalao: z.boolean().default(true),
    activeForRetirada: z.boolean().default(true),
    activeForDelivery: z.boolean().default(true),
});

const updateCategorySchema = createCategorySchema.partial();

const optionSchema = z.object({
    id: z.string().optional(), // For updates
    name: z.string().min(1),
    price: z.number().min(0).default(0),
    sortOrder: z.number().int().default(0),
    isActive: z.boolean().default(true),
});

const optionGroupSchema = z.object({
    id: z.string().optional(), // For updates
    name: z.string().min(1),
    selectionType: z.enum(['SINGLE', 'MULTIPLE']).default('SINGLE'),
    isRequired: z.boolean().default(false),
    minOptions: z.number().int().min(0).default(0),
    maxOptions: z.number().int().min(1).default(1),
    sortOrder: z.number().int().default(0),
    options: z.array(optionSchema).default([]),
});

const createItemSchema = z.object({
    menuCategoryId: z.string(),
    name: z.string().min(1),
    description: z.string().optional(),
    imageUrl: z.string().optional(),
    type: z.enum(['SIMPLE', 'COMBO']).default('SIMPLE'),
    price: z.number().min(0).default(0),
    isActive: z.boolean().default(true),
    isFeatured: z.boolean().default(false),
    displayInPdv: z.boolean().default(true),
    activeForSalao: z.boolean().default(true),
    activeForRetirada: z.boolean().default(true),
    activeForDelivery: z.boolean().default(true),

    // Technical Sheet & Cost
    recipeId: z.string().optional(),
    costSnapshot: z.number().optional(),
    markupPercent: z.number().optional(),
    taxPercent: z.number().optional(),
    internalNotes: z.string().optional(),

    // Nested
    optionGroups: z.array(optionGroupSchema).optional(),
});

const updateItemSchema = createItemSchema.partial();

export async function menuRoutes(fastify: FastifyInstance) {

    // =================================
    // MENU CATEGORIES
    // =================================

    // List Categories
    fastify.get('/categories', {
        preHandler: [authenticate],
    }, async (request, reply) => {
        const { costCenterId } = request.query as { costCenterId?: string };

        if (!costCenterId) {
            throw errors.badRequest('costCenterId is required');
        }

        // Verify access
        // (Assuming standard middleware handles Org scope, but for CostCenter we check linkage)
        // For simplicity, we assume generic read access for authenticated users in the Org, 
        // or check UserCostCenterAccess if strict. Skipping for brevity.

        const categories = await prisma.menuCategory.findMany({
            where: { costCenterId },
            include: {
                _count: { select: { items: true } }
            },
            orderBy: { sortOrder: 'asc' }
        });

        return reply.send({ success: true, data: categories });
    });

    // Create Category
    fastify.post('/categories', {
        preHandler: [authenticate],
    }, async (request, reply) => {
        const body = createCategorySchema.parse(request.body);

        const category = await prisma.menuCategory.create({
            data: {
                ...body,
                organizationId: request.user!.organizationId, // Optional tracking
            }
        });

        return reply.status(201).send({ success: true, data: category });
    });

    // Update Category
    fastify.patch('/categories/:id', {
        preHandler: [authenticate],
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = updateCategorySchema.parse(request.body);

        const category = await prisma.menuCategory.update({
            where: { id },
            data: body
        });

        return reply.send({ success: true, data: category });
    });

    // Delete Category
    fastify.delete('/categories/:id', {
        preHandler: [authenticate],
    }, async (request, reply) => {
        const { id } = request.params as { id: string };

        await prisma.menuCategory.delete({ where: { id } });

        return reply.send({ success: true });
    });

    // =================================
    // MENU ITEMS
    // =================================

    // List Items (by Category)
    fastify.get('/categories/:currCategoryId/items', {
        preHandler: [authenticate],
    }, async (request, reply) => {
        const { currCategoryId } = request.params as { currCategoryId: string };

        const items = await prisma.menuItem.findMany({
            where: { menuCategoryId: currCategoryId },
            orderBy: { name: 'asc' }, // Or sortOrder if we add it
            include: {
                recipe: { select: { id: true, name: true, currentCost: true, yieldUnit: true } }
            }
        });

        return reply.send({ success: true, data: items });
    });

    // Get Single Item (with deep include for editing)
    fastify.get('/items/:id', {
        preHandler: [authenticate],
    }, async (request, reply) => {
        const { id } = request.params as { id: string };

        const item = await prisma.menuItem.findUnique({
            where: { id },
            include: {
                optionGroups: {
                    include: {
                        options: { orderBy: { sortOrder: 'asc' } }
                    },
                    orderBy: { sortOrder: 'asc' }
                },
                recipe: true // For technical sheet details
            }
        });

        if (!item) throw errors.notFound('Item not found');

        return reply.send({ success: true, data: item });
    });

    // Create Item (Complex with nested options)
    fastify.post('/items', {
        preHandler: [authenticate],
    }, async (request, reply) => {
        const { optionGroups, ...itemData } = createItemSchema.parse(request.body);

        const item = await prisma.menuItem.create({
            data: {
                ...itemData,
                optionGroups: optionGroups ? {
                    create: optionGroups.map(group => ({
                        ...group,
                        options: {
                            create: group.options
                        }
                    }))
                } : undefined
            },
            include: {
                optionGroups: { include: { options: true } }
            }
        });

        return reply.status(201).send({ success: true, data: item });
    });

    // Update Item
    fastify.put('/items/:id', {
        preHandler: [authenticate],
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { optionGroups, ...itemData } = updateItemSchema.parse(request.body);

        // Transactional update is tricky with nested lists.
        // Strategy: Update scalar fields -> Logic for Option Groups

        // 1. Update basic fields
        if (Object.keys(itemData).length > 0) {
            await prisma.menuItem.update({
                where: { id },
                data: itemData
            });
        }

        // 2. Handle Option Groups if provided (Full replacement or smart merge?)
        // For simplicity: If optionGroups is sent, we assume full sync or we handle additions.
        // Let's assume full replacement of structure for simpler management:
        // Delete all groups not in list? Or better, use specific endpoints for options?
        // To stick to the "Edit Form" logic where we save everything at once:

        if (optionGroups) {
            // For this MVP, we will wipe and recreate options for the item to ensure sync
            // (Not efficient for huge menus, but fine for single item edit)
            // Alternatively, using upsert is better but deep nested upsert is verbose.

            // Deleting existing
            await prisma.menuOptionGroup.deleteMany({ where: { menuItemId: id } });

            // Recreating
            for (const group of optionGroups) {
                await prisma.menuOptionGroup.create({
                    data: {
                        ...group,
                        id: undefined, // ensure new IDs or handled by DB
                        menuItemId: id,
                        options: {
                            create: group.options.map(opt => ({ ...opt, id: undefined }))
                        }
                    }
                });
            }
        }

        const updated = await prisma.menuItem.findUnique({
            where: { id },
            include: { optionGroups: { include: { options: true } } }
        });

        return reply.send({ success: true, data: updated });
    });

    // Associate Recipe Helper
    fastify.patch('/items/:id/associate-recipe', {
        preHandler: [authenticate],
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { recipeId, updatePrice, markup } = z.object({
            recipeId: z.string(),
            updatePrice: z.boolean().default(false),
            markup: z.number().optional()
        }).parse(request.body);

        const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
        if (!recipe) throw errors.notFound('Recipe not found');

        const cost = recipe.currentCost / recipe.yieldQuantity; // Unit cost

        let priceUpdates = {};
        if (updatePrice && markup !== undefined) {
            const suggested = cost * (1 + markup / 100);
            priceUpdates = { price: suggested };
        }

        const item = await prisma.menuItem.update({
            where: { id },
            data: {
                recipeId,
                costSnapshot: cost,
                markupPercent: markup,
                ...priceUpdates
            }
        });

        return reply.send({ success: true, data: item });
    });

    // =================================
    // PDV PUBLIC/FETCH (Active Menu)
    // =================================

    fastify.get('/pdv', {
        preHandler: [authenticate],
    }, async (request, reply) => {
        const { costCenterId, channel } = request.query as { costCenterId?: string, channel?: string };

        if (!costCenterId) throw errors.badRequest('costCenterId required');

        // Channel filters
        const channelFilter = channel ? {
            [`activeFor${channel === 'SALAO' ? 'Salao' : channel === 'DELIVERY' ? 'Delivery' : 'Retirada'}`]: true
        } : {};

        // Fetch Categories
        const categories = await prisma.menuCategory.findMany({
            where: {
                costCenterId,
                isActive: true,
                ...channelFilter
            },
            orderBy: { sortOrder: 'asc' },
            include: {
                items: {
                    where: {
                        isActive: true,
                        displayInPdv: true,
                        // Note: We might want nested channel filter on items too
                        ...channelFilter
                    },
                    include: {
                        optionGroups: {
                            include: {
                                options: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } }
                            },
                            orderBy: { sortOrder: 'asc' }
                        }
                    }
                }
            }
        });

        // Filter out empty categories? Maybe keep them.

        return reply.send({ success: true, data: categories });
    });
}
