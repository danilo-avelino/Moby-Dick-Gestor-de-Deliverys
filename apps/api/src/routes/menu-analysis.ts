import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from 'database';
import { requireRestaurant } from '../middleware/auth';
import { errors } from '../middleware/error-handler';
import type { ApiResponse } from 'types';

export async function menuAnalysisRoutes(fastify: FastifyInstance) {
    // Get menu analysis
    fastify.get<{
        Querystring: {
            startDate?: string;
            endDate?: string;
        };
    }>('/', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Menu Analysis'],
            summary: 'Get menu analysis',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const endDate = request.query.endDate ? new Date(request.query.endDate) : new Date();
        const startDate = request.query.startDate
            ? new Date(request.query.startDate)
            : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Find existing analysis
        let analysis = await prisma.menuAnalysis.findFirst({
            where: {
                restaurantId: request.user!.restaurantId,
                periodStart: { gte: startDate },
                periodEnd: { lte: endDate },
            },
            include: {
                items: {
                    include: {
                        recipe: {
                            select: {
                                id: true,
                                name: true,
                                currentPrice: true,
                                costPerUnit: true,
                                imageUrl: true,
                                category: { select: { name: true } },
                            },
                        },
                    },
                    orderBy: { revenue: 'desc' },
                },
            },
            orderBy: { periodEnd: 'desc' },
        });

        if (!analysis) {
            // Return empty analysis
            const response: ApiResponse = {
                success: true,
                data: {
                    periodStart: startDate.toISOString(),
                    periodEnd: endDate.toISOString(),
                    totalRevenue: 0,
                    totalItemsSold: 0,
                    items: [],
                    needsGeneration: true,
                },
            };
            return reply.send(response);
        }

        const response: ApiResponse = {
            success: true,
            data: {
                id: analysis.id,
                periodStart: analysis.periodStart.toISOString(),
                periodEnd: analysis.periodEnd.toISOString(),
                totalRevenue: analysis.totalRevenue,
                totalItemsSold: analysis.totalItemsSold,
                items: analysis.items.map((item) => ({
                    id: item.id,
                    recipe: item.recipe,
                    quantitySold: item.quantitySold,
                    revenue: item.revenue,
                    cost: item.cost,
                    marginAmount: item.marginAmount,
                    marginPercent: item.marginPercent,
                    popularityScore: item.popularityScore,
                    profitabilityScore: item.profitabilityScore,
                    abcClassification: item.abcClassification,
                    matrixClassification: item.matrixClassification,
                    recommendedAction: item.recommendedAction,
                    actionReasoning: item.actionReasoning,
                })),
            },
        };

        return reply.send(response);
    });

    // Generate menu analysis
    fastify.post<{
        Body: {
            startDate: string;
            endDate: string;
            salesData?: Array<{
                recipeId: string;
                quantity: number;
                revenue: number;
            }>;
        };
    }>('/generate', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Menu Analysis'],
            summary: 'Generate menu analysis',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const { startDate, endDate, salesData } = request.body;

        // Get all active recipes
        const recipes = await prisma.recipe.findMany({
            where: {
                restaurantId: request.user!.restaurantId,
                isActive: true,
            },
            select: {
                id: true,
                name: true,
                currentPrice: true,
                costPerUnit: true,
                packagingCost: true,
            },
        });

        // If no sales data provided, simulate
        const sales = salesData || recipes.map((r) => ({
            recipeId: r.id,
            quantity: Math.floor(Math.random() * 50) + 5,
            revenue: (r.currentPrice || 30) * (Math.floor(Math.random() * 50) + 5),
        }));

        const totalRevenue = sales.reduce((sum, s) => sum + s.revenue, 0);
        const totalItemsSold = sales.reduce((sum, s) => sum + s.quantity, 0);

        // Calculate ABC classification
        const sortedByRevenue = [...sales].sort((a, b) => b.revenue - a.revenue);
        let cumulativeRevenue = 0;
        const abcMap = new Map<string, 'A' | 'B' | 'C'>();

        for (const sale of sortedByRevenue) {
            cumulativeRevenue += sale.revenue;
            const pct = (cumulativeRevenue / totalRevenue) * 100;
            if (pct <= 80) abcMap.set(sale.recipeId, 'A');
            else if (pct <= 95) abcMap.set(sale.recipeId, 'B');
            else abcMap.set(sale.recipeId, 'C');
        }

        // Calculate matrix classifications
        const avgPopularity = totalItemsSold / recipes.length;
        const recipeMap = new Map(recipes.map((r) => [r.id, r]));

        const itemPerformances = sales.map((sale) => {
            const recipe = recipeMap.get(sale.recipeId);
            if (!recipe) return null;

            const cost = (recipe.costPerUnit + recipe.packagingCost) * sale.quantity;
            const marginAmount = sale.revenue - cost;
            const marginPercent = sale.revenue > 0 ? (marginAmount / sale.revenue) * 100 : 0;

            const avgMargin = 30; // Target margin
            const popularityScore = (sale.quantity / avgPopularity) * 50;
            const profitabilityScore = (marginPercent / avgMargin) * 50;

            // Boston Matrix classification
            const highPop = popularityScore >= 50;
            const highProf = profitabilityScore >= 50;
            let matrixClassification: 'STAR' | 'CASH_COW' | 'PUZZLE' | 'DOG';
            let recommendedAction: string;
            let actionReasoning: string;

            if (highPop && highProf) {
                matrixClassification = 'STAR';
                recommendedAction = 'MAINTAIN';
                actionReasoning = 'Item popular e rentável. Mantenha a qualidade e visibilidade.';
            } else if (highPop && !highProf) {
                matrixClassification = 'CASH_COW';
                recommendedAction = 'REPRICE';
                actionReasoning = 'Alta demanda mas baixa margem. Considere ajustar preço ou reduzir custos.';
            } else if (!highPop && highProf) {
                matrixClassification = 'PUZZLE';
                recommendedAction = 'PROMOTE';
                actionReasoning = 'Boa margem mas pouca venda. Promova mais ou melhore posicionamento.';
            } else {
                matrixClassification = 'DOG';
                recommendedAction = 'REMOVE';
                actionReasoning = 'Baixa venda e baixa margem. Considere reformular ou remover do cardápio.';
            }

            return {
                recipeId: sale.recipeId,
                quantitySold: sale.quantity,
                revenue: sale.revenue,
                cost,
                marginAmount,
                marginPercent,
                popularityScore: Math.min(popularityScore, 100),
                profitabilityScore: Math.min(profitabilityScore, 100),
                abcClassification: abcMap.get(sale.recipeId) || 'C',
                matrixClassification,
                recommendedAction,
                actionReasoning,
            };
        }).filter(Boolean);

        // Delete old analysis for same period
        await prisma.menuAnalysis.deleteMany({
            where: {
                restaurantId: request.user!.restaurantId,
                periodStart: { gte: new Date(startDate) },
                periodEnd: { lte: new Date(endDate) },
            },
        });

        // Create new analysis
        const analysis = await prisma.menuAnalysis.create({
            data: {
                restaurantId: request.user!.restaurantId!,
                periodStart: new Date(startDate),
                periodEnd: new Date(endDate),
                totalRevenue,
                totalItemsSold,
                items: {
                    create: itemPerformances as any,
                },
            },
            include: {
                items: {
                    include: {
                        recipe: {
                            select: { id: true, name: true, currentPrice: true, imageUrl: true },
                        },
                    },
                },
            },
        });

        const response: ApiResponse = {
            success: true,
            data: {
                id: analysis.id,
                periodStart: analysis.periodStart.toISOString(),
                periodEnd: analysis.periodEnd.toISOString(),
                totalRevenue: analysis.totalRevenue,
                totalItemsSold: analysis.totalItemsSold,
                itemCount: analysis.items.length,
                classifications: {
                    stars: analysis.items.filter((i) => i.matrixClassification === 'STAR').length,
                    cashCows: analysis.items.filter((i) => i.matrixClassification === 'CASH_COW').length,
                    puzzles: analysis.items.filter((i) => i.matrixClassification === 'PUZZLE').length,
                    dogs: analysis.items.filter((i) => i.matrixClassification === 'DOG').length,
                },
            },
        };

        return reply.status(201).send(response);
    });

    // Get ABC curve data
    fastify.get('/abc-curve', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Menu Analysis'],
            summary: 'Get ABC curve data',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const analysis = await prisma.menuAnalysis.findFirst({
            where: { restaurantId: request.user!.restaurantId },
            orderBy: { periodEnd: 'desc' },
            include: {
                items: {
                    include: {
                        recipe: { select: { id: true, name: true } },
                    },
                    orderBy: { revenue: 'desc' },
                },
            },
        });

        if (!analysis) {
            throw errors.notFound('No analysis available');
        }

        let cumulative = 0;
        const curveData = analysis.items.map((item) => {
            cumulative += item.revenue;
            return {
                name: item.recipe.name,
                revenue: item.revenue,
                cumulativeRevenue: cumulative,
                cumulativePercent: (cumulative / analysis.totalRevenue) * 100,
                classification: item.abcClassification,
            };
        });

        const summary = {
            A: {
                count: analysis.items.filter((i) => i.abcClassification === 'A').length,
                revenue: analysis.items.filter((i) => i.abcClassification === 'A').reduce((s, i) => s + i.revenue, 0),
            },
            B: {
                count: analysis.items.filter((i) => i.abcClassification === 'B').length,
                revenue: analysis.items.filter((i) => i.abcClassification === 'B').reduce((s, i) => s + i.revenue, 0),
            },
            C: {
                count: analysis.items.filter((i) => i.abcClassification === 'C').length,
                revenue: analysis.items.filter((i) => i.abcClassification === 'C').reduce((s, i) => s + i.revenue, 0),
            },
        };

        const response: ApiResponse = {
            success: true,
            data: {
                curve: curveData,
                summary,
                totalRevenue: analysis.totalRevenue,
            },
        };

        return reply.send(response);
    });

    // Get Boston Matrix data
    fastify.get('/matrix', {
        preHandler: [requireRestaurant],
        schema: {
            tags: ['Menu Analysis'],
            summary: 'Get Boston Matrix data',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const analysis = await prisma.menuAnalysis.findFirst({
            where: { restaurantId: request.user!.restaurantId },
            orderBy: { periodEnd: 'desc' },
            include: {
                items: {
                    include: {
                        recipe: { select: { id: true, name: true, imageUrl: true } },
                    },
                },
            },
        });

        if (!analysis) {
            throw errors.notFound('No analysis available');
        }

        const matrixData = {
            stars: analysis.items
                .filter((i) => i.matrixClassification === 'STAR')
                .map((i) => ({
                    recipe: i.recipe,
                    popularity: i.popularityScore,
                    profitability: i.profitabilityScore,
                    revenue: i.revenue,
                    margin: i.marginPercent,
                })),
            cashCows: analysis.items
                .filter((i) => i.matrixClassification === 'CASH_COW')
                .map((i) => ({
                    recipe: i.recipe,
                    popularity: i.popularityScore,
                    profitability: i.profitabilityScore,
                    revenue: i.revenue,
                    margin: i.marginPercent,
                    action: i.recommendedAction,
                })),
            puzzles: analysis.items
                .filter((i) => i.matrixClassification === 'PUZZLE')
                .map((i) => ({
                    recipe: i.recipe,
                    popularity: i.popularityScore,
                    profitability: i.profitabilityScore,
                    revenue: i.revenue,
                    margin: i.marginPercent,
                    action: i.recommendedAction,
                })),
            dogs: analysis.items
                .filter((i) => i.matrixClassification === 'DOG')
                .map((i) => ({
                    recipe: i.recipe,
                    popularity: i.popularityScore,
                    profitability: i.profitabilityScore,
                    revenue: i.revenue,
                    margin: i.marginPercent,
                    action: i.recommendedAction,
                })),
        };

        const response: ApiResponse = {
            success: true,
            data: matrixData,
        };

        return reply.send(response);
    });
}
