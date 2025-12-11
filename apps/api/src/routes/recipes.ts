import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from 'database';
import { requireRestaurant } from '../middleware/auth';
import { errors } from '../middleware/error-handler';
import type { ApiResponse } from 'types';

const ingredientSchema = z.object({
    ingredientType: z.enum(['PRODUCT', 'RECIPE']),
    productId: z.string().optional(),
    subRecipeId: z.string().optional(),
    quantity: z.number().positive(),
    unit: z.string(),
    isOptional: z.boolean().optional(),
});

const createRecipeSchema = z.object({
    name: z.string().min(2),
    description: z.string().optional(),
    type: z.enum(['TRANSFORMED_ITEM', 'PORTIONING', 'FINAL_PRODUCT', 'COMBO']).default('FINAL_PRODUCT'),
    status: z.enum(['DRAFT', 'INCOMPLETE', 'COMPLETE']).default('DRAFT'),
    recipeCategoryId: z.string().optional(),
    outputProductId: z.string().optional(),
    targetCmv: z.number().min(0).max(100).optional(),
    yieldQuantity: z.number().positive().default(1),
    yieldUnit: z.string().default('un'),
    currentPrice: z.number().min(0).optional(),
    packagingCost: z.number().min(0).default(0),
    laborCost: z.number().min(0).default(0),
    overheadPercent: z.number().min(0).max(100).default(0),
    prepTimeMinutes: z.number().min(0).optional(),
    cookTimeMinutes: z.number().min(0).optional(),
    imageUrl: z.string().url().optional(),
    instructions: z.string().optional(),
    ingredients: z.array(ingredientSchema).min(1),
});

// Calculate recipe cost from ingredients
async function calculateRecipeCost(
    restaurantId: string,
    ingredients: Array<{
        ingredientType: string;
        productId?: string;
        subRecipeId?: string;
        quantity: number;
        unit: string;
    }>
): Promise<{ totalCost: number; ingredientCosts: Array<{ id?: string; cost: number }> }> {
    let totalCost = 0;
    const ingredientCosts: Array<{ id?: string; cost: number }> = [];

    for (const ingredient of ingredients) {
        let unitCost = 0;

        if (ingredient.ingredientType === 'PRODUCT' && ingredient.productId) {
            const product = await prisma.product.findFirst({
                where: { id: ingredient.productId, restaurantId },
            });
            if (product) {
                // Convert units if needed
                unitCost = product.avgCost;
                // Simplified: assume same unit for now
            }
        } else if (ingredient.ingredientType === 'RECIPE' && ingredient.subRecipeId) {
            const subRecipe = await prisma.recipe.findFirst({
                where: { id: ingredient.subRecipeId, restaurantId },
            });
            if (subRecipe) {
                unitCost = subRecipe.costPerUnit;
            }
        }

        const cost = unitCost * ingredient.quantity;
        totalCost += cost;
        ingredientCosts.push({ id: ingredient.productId || ingredient.subRecipeId, cost });
    }

    return { totalCost, ingredientCosts };
}

export async function recipeRoutes(fastify: FastifyInstance) {
    // List recipes
    fastify.get<{
        Querystring: {
            page?: string;
            limit?: string;
            search?: string;
            categoryId?: string;
            isActive?: string;
        };
    }>('/', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Recipes'],
            summary: 'List recipes',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const page = parseInt(request.query.page || '1', 10);
        const limit = Math.min(parseInt(request.query.limit || '20', 10), 100);
        const skip = (page - 1) * limit;

        const where: any = {
            restaurantId: request.user!.restaurantId,
        };

        if (request.query.search) {
            where.name = { contains: request.query.search, mode: 'insensitive' };
        }

        if (request.query.categoryId) {
            where.recipeCategoryId = request.query.categoryId;
        }

        if (request.query.isActive !== undefined) {
            where.isActive = request.query.isActive === 'true';
        }

        const [recipes, total] = await Promise.all([
            prisma.recipe.findMany({
                where,
                include: {
                    recipeCategory: { select: { id: true, name: true } },
                    _count: { select: { ingredients: true } },
                },
                skip,
                take: limit,
                orderBy: { name: 'asc' },
            }),
            prisma.recipe.count({ where }),
        ]);

        // Calculate margin for each recipe
        const recipesWithMargin = recipes.map((r) => {
            const margin = r.currentPrice && r.currentCost > 0
                ? ((r.currentPrice - r.currentCost - r.packagingCost) / r.currentPrice) * 100
                : null;

            return {
                id: r.id,
                name: r.name,
                description: r.description,
                category: r.recipeCategory,
                yieldQuantity: r.yieldQuantity,
                yieldUnit: r.yieldUnit,
                currentCost: r.currentCost,
                costPerUnit: r.costPerUnit,
                currentPrice: r.currentPrice,
                marginPercent: margin,
                ingredientCount: r._count.ingredients,
                isActive: r.isActive,
                imageUrl: r.imageUrl,
                createdAt: r.createdAt.toISOString(),
            };
        });

        const response: ApiResponse = {
            success: true,
            data: {
                data: recipesWithMargin,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                    hasNext: page < Math.ceil(total / limit),
                    hasPrev: page > 1,
                },
            },
        };

        return reply.send(response);
    });

    // Get single recipe with ingredients
    fastify.get<{ Params: { id: string } }>('/:id', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Recipes'],
            summary: 'Get recipe by ID',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const recipe = await prisma.recipe.findFirst({
            where: {
                id: request.params.id,
                restaurantId: request.user!.restaurantId,
            },
            include: {
                recipeCategory: true,
                ingredients: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                                sku: true,
                                baseUnit: true,
                                avgCost: true,
                                currentStock: true,
                            },
                        },
                    },
                },
                pricingSuggestions: {
                    orderBy: { generatedAt: 'desc' },
                    take: 6,
                },
            },
        });

        if (!recipe) {
            throw errors.notFound('Recipe not found');
        }

        // Get sub-recipes if any
        const subRecipeIds = recipe.ingredients
            .filter((i) => i.ingredientType === 'RECIPE' && i.subRecipeId)
            .map((i) => i.subRecipeId!);

        const subRecipes = subRecipeIds.length > 0
            ? await prisma.recipe.findMany({
                where: { id: { in: subRecipeIds } },
                select: { id: true, name: true, costPerUnit: true },
            })
            : [];

        const subRecipeMap = new Map(subRecipes.map((r) => [r.id, r]));

        // Calculate margin
        const margin = recipe.currentPrice && recipe.currentCost > 0
            ? ((recipe.currentPrice - recipe.currentCost - recipe.packagingCost) / recipe.currentPrice) * 100
            : null;

        const response: ApiResponse = {
            success: true,
            data: {
                id: recipe.id,
                name: recipe.name,
                description: recipe.description,
                category: recipe.recipeCategory,
                yieldQuantity: recipe.yieldQuantity,
                yieldUnit: recipe.yieldUnit,
                currentCost: recipe.currentCost,
                costPerUnit: recipe.costPerUnit,
                suggestedPrice: recipe.suggestedPrice,
                currentPrice: recipe.currentPrice,
                marginPercent: margin,
                packagingCost: recipe.packagingCost,
                laborCost: recipe.laborCost,
                overheadPercent: recipe.overheadPercent,
                prepTimeMinutes: recipe.prepTimeMinutes,
                cookTimeMinutes: recipe.cookTimeMinutes,
                version: recipe.version,
                isActive: recipe.isActive,
                imageUrl: recipe.imageUrl,
                instructions: recipe.instructions,
                ingredients: recipe.ingredients.map((i) => ({
                    id: i.id,
                    ingredientType: i.ingredientType,
                    product: i.product,
                    subRecipe: i.subRecipeId ? subRecipeMap.get(i.subRecipeId) : null,
                    quantity: i.quantity,
                    unit: i.unit,
                    costSnapshot: i.costSnapshot,
                    totalCost: i.costSnapshot * i.quantity,
                    isOptional: i.isOptional,
                })),
                pricingSuggestions: recipe.pricingSuggestions,
                costHistory: recipe.costHistory,
                createdAt: recipe.createdAt.toISOString(),
                updatedAt: recipe.updatedAt.toISOString(),
            },
        };

        return reply.send(response);
    });

    // Create recipe
    fastify.post('/', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Recipes'],
            summary: 'Create recipe',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const body = createRecipeSchema.parse(request.body);

        // Calculate cost
        const { totalCost, ingredientCosts } = await calculateRecipeCost(
            request.user!.restaurantId!,
            body.ingredients
        );

        const costWithOverhead = totalCost * (1 + body.overheadPercent / 100) + body.laborCost;
        const costPerUnit = costWithOverhead / body.yieldQuantity;

        // Calculate suggested price (30% margin target)
        const suggestedPrice = (costPerUnit + body.packagingCost) / 0.7;

        const recipe = await prisma.recipe.create({
            data: {
                restaurantId: request.user!.restaurantId!,
                name: body.name,
                description: body.description,
                type: body.type,
                status: body.status,
                recipeCategoryId: body.recipeCategoryId,
                outputProductId: body.outputProductId,
                targetCmv: body.targetCmv,
                yieldQuantity: body.yieldQuantity,
                yieldUnit: body.yieldUnit,
                currentCost: costWithOverhead,
                costPerUnit,
                suggestedPrice,
                currentPrice: body.currentPrice,
                packagingCost: body.packagingCost,
                laborCost: body.laborCost,
                overheadPercent: body.overheadPercent,
                prepTimeMinutes: body.prepTimeMinutes,
                cookTimeMinutes: body.cookTimeMinutes,
                imageUrl: body.imageUrl,
                instructions: body.instructions,
                costHistory: [{ date: new Date().toISOString(), cost: costWithOverhead }],
                ingredients: {
                    create: body.ingredients.map((i, idx) => ({
                        ingredientType: i.ingredientType as any,
                        productId: i.productId,
                        subRecipeId: i.subRecipeId,
                        quantity: i.quantity,
                        unit: i.unit,
                        costSnapshot: ingredientCosts[idx]?.cost || 0,
                        isOptional: i.isOptional || false,
                    })),
                },
            },
            include: {
                recipeCategory: true,
                ingredients: {
                    include: { product: true },
                },
            },
        });

        const response: ApiResponse = {
            success: true,
            data: {
                ...recipe,
                createdAt: recipe.createdAt.toISOString(),
                updatedAt: recipe.updatedAt.toISOString(),
            },
        };

        return reply.status(201).send(response);
    });

    // Update recipe
    fastify.patch<{ Params: { id: string } }>('/:id', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Recipes'],
            summary: 'Update recipe',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const body = createRecipeSchema.partial().parse(request.body);

        const existing = await prisma.recipe.findFirst({
            where: {
                id: request.params.id,
                restaurantId: request.user!.restaurantId,
            },
            include: { ingredients: true },
        });

        if (!existing) {
            throw errors.notFound('Recipe not found');
        }

        // If ingredients changed, recalculate cost
        let updateData: any = { ...body };
        delete updateData.ingredients;

        if (body.ingredients) {
            const { totalCost, ingredientCosts } = await calculateRecipeCost(
                request.user!.restaurantId!,
                body.ingredients
            );

            const yieldQty = body.yieldQuantity || existing.yieldQuantity;
            const laborCost = body.laborCost ?? existing.laborCost;
            const overheadPercent = body.overheadPercent ?? existing.overheadPercent;

            const costWithOverhead = totalCost * (1 + overheadPercent / 100) + laborCost;
            const costPerUnit = costWithOverhead / yieldQty;

            updateData.currentCost = costWithOverhead;
            updateData.costPerUnit = costPerUnit;
            updateData.version = existing.version + 1;
            updateData.costHistory = [
                ...(existing.costHistory as any[] || []),
                { date: new Date().toISOString(), cost: costWithOverhead },
            ];

            // Delete old ingredients and create new ones
            await prisma.recipeIngredient.deleteMany({
                where: { recipeId: request.params.id },
            });

            await prisma.recipeIngredient.createMany({
                data: body.ingredients.map((i, idx) => ({
                    recipeId: request.params.id,
                    ingredientType: i.ingredientType as any,
                    productId: i.productId,
                    subRecipeId: i.subRecipeId,
                    quantity: i.quantity,
                    unit: i.unit,
                    costSnapshot: ingredientCosts[idx]?.cost || 0,
                    isOptional: i.isOptional || false,
                })),
            });
        }

        const recipe = await prisma.recipe.update({
            where: { id: request.params.id },
            data: updateData,
            include: {
                recipeCategory: true,
                ingredients: { include: { product: true } },
            },
        });

        const response: ApiResponse = {
            success: true,
            data: {
                ...recipe,
                createdAt: recipe.createdAt.toISOString(),
                updatedAt: recipe.updatedAt.toISOString(),
            },
        };

        return reply.send(response);
    });

    // Delete recipe
    fastify.delete<{ Params: { id: string } }>('/:id', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Recipes'],
            summary: 'Delete recipe',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const existing = await prisma.recipe.findFirst({
            where: {
                id: request.params.id,
                restaurantId: request.user!.restaurantId,
            },
        });

        if (!existing) {
            throw errors.notFound('Recipe not found');
        }

        // Check if used as sub-recipe
        const usedAsSubRecipe = await prisma.recipeIngredient.count({
            where: { subRecipeId: request.params.id },
        });

        if (usedAsSubRecipe > 0) {
            throw errors.conflict('Recipe is used as ingredient in other recipes');
        }

        await prisma.recipe.delete({
            where: { id: request.params.id },
        });

        const response: ApiResponse = {
            success: true,
            data: { message: 'Recipe deleted successfully' },
        };

        return reply.send(response);
    });

    // Recalculate all recipe costs
    fastify.post('/recalculate-costs', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Recipes'],
            summary: 'Recalculate all recipe costs',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const recipes = await prisma.recipe.findMany({
            where: {
                restaurantId: request.user!.restaurantId,
                isActive: true,
            },
            include: { ingredients: true },
        });

        let updatedCount = 0;
        const significantChanges: Array<{ name: string; oldCost: number; newCost: number; change: number }> = [];

        for (const recipe of recipes) {
            const { totalCost } = await calculateRecipeCost(
                request.user!.restaurantId!,
                recipe.ingredients.map((i) => ({
                    ingredientType: i.ingredientType,
                    productId: i.productId || undefined,
                    subRecipeId: i.subRecipeId || undefined,
                    quantity: i.quantity,
                    unit: i.unit,
                }))
            );

            const costWithOverhead = totalCost * (1 + recipe.overheadPercent / 100) + recipe.laborCost;
            const costPerUnit = costWithOverhead / recipe.yieldQuantity;

            const changePercent = ((costWithOverhead - recipe.currentCost) / recipe.currentCost) * 100;

            if (Math.abs(changePercent) > 1) { // More than 1% change
                await prisma.recipe.update({
                    where: { id: recipe.id },
                    data: {
                        currentCost: costWithOverhead,
                        costPerUnit,
                        costHistory: [
                            ...(recipe.costHistory as any[] || []),
                            { date: new Date().toISOString(), cost: costWithOverhead },
                        ],
                    },
                });

                updatedCount++;

                if (Math.abs(changePercent) > 5) { // Significant change
                    significantChanges.push({
                        name: recipe.name,
                        oldCost: recipe.currentCost,
                        newCost: costWithOverhead,
                        change: changePercent,
                    });
                }
            }
        }

        // Create alerts for significant changes
        for (const change of significantChanges) {
            await prisma.alert.create({
                data: {
                    restaurantId: request.user!.restaurantId!,
                    type: 'COST_INCREASE',
                    severity: Math.abs(change.change) > 10 ? 'HIGH' : 'MEDIUM',
                    title: `Custo alterado: ${change.name}`,
                    message: `O custo da receita ${change.name} ${change.change > 0 ? 'aumentou' : 'diminuiu'} ${Math.abs(change.change).toFixed(1)}%`,
                    data: change,
                    actionUrl: '/recipes',
                },
            });
        }

        const response: ApiResponse = {
            success: true,
            data: {
                message: `${updatedCount} recipes updated`,
                significantChanges,
            },
        };

        return reply.send(response);
    });

    // Generate pricing suggestions
    fastify.post<{ Params: { id: string } }>('/:id/pricing', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Recipes'],
            summary: 'Generate pricing suggestions',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const recipe = await prisma.recipe.findFirst({
            where: {
                id: request.params.id,
                restaurantId: request.user!.restaurantId,
            },
        });

        if (!recipe) {
            throw errors.notFound('Recipe not found');
        }

        const channels = [
            { channel: 'DINE_IN', platformFee: 0, deliveryFee: 0, packagingCost: 0 },
            { channel: 'TAKEOUT', platformFee: 0, deliveryFee: 0, packagingCost: recipe.packagingCost * 0.5 },
            { channel: 'DELIVERY_OWN', platformFee: 0, deliveryFee: 5, packagingCost: recipe.packagingCost },
            { channel: 'DELIVERY_IFOOD', platformFee: 27, deliveryFee: 0, packagingCost: recipe.packagingCost },
            { channel: 'DELIVERY_RAPPI', platformFee: 25, deliveryFee: 0, packagingCost: recipe.packagingCost },
        ];

        const suggestions = channels.map((ch) => {
            const totalCost = recipe.costPerUnit + ch.packagingCost + ch.deliveryFee;
            const platformFeeMultiplier = 1 - ch.platformFee / 100;

            // Target 30% margin after platform fees
            const targetMargin = 0.30;
            const suggestedPrice = totalCost / (platformFeeMultiplier * (1 - targetMargin));

            const marginAmount = (suggestedPrice * platformFeeMultiplier) - totalCost;
            const marginPercent = (marginAmount / suggestedPrice) * 100;
            const markupPercent = ((suggestedPrice - totalCost) / totalCost) * 100;

            return {
                recipeId: recipe.id,
                channel: ch.channel as any,
                recipeCost: recipe.costPerUnit,
                packagingCost: ch.packagingCost,
                deliveryFee: ch.deliveryFee,
                platformFee: ch.platformFee,
                suggestedPrice: Math.ceil(suggestedPrice * 10) / 10, // Round up to nearest 0.10
                currentPrice: recipe.currentPrice,
                markupPercent,
                marginPercent,
                marginAmount,
            };
        });

        // Delete old suggestions and create new
        await prisma.pricingSuggestion.deleteMany({
            where: { recipeId: recipe.id },
        });

        await prisma.pricingSuggestion.createMany({
            data: suggestions,
        });

        const response: ApiResponse = {
            success: true,
            data: suggestions,
        };

        return reply.send(response);
    });
}
